import {
  AJUSTE_SESION,
  vistasPrivadas,
  FLAG_PROPUESTA,
  aceptarVistaPrivada,
  adoptarSesionPublicada,
  construirPropuesta,
  despacharCambioDeUsuario,
} from "./minijuegos/adaptador-sesion.mjs";
import { crearSesion } from "./minijuegos/sesion-motor.mjs";
import { MESA_POR_DEFECTO, configuracionPoker } from "./minijuegos/mesa-config.mjs";
import * as poker from "./minijuegos/poker-motor.mjs";

// Cableado Foundry de las sesiones de minijuegos (#308, paso 3). Capa fina y no
// testeable en Node (usa globales de Foundry): toda la lógica de autoridad vive
// en los módulos puros minijuegos/sesion-motor.mjs y minijuegos/adaptador-sesion.mjs,
// ya cubiertos por pruebas. Aquí solo se conectan hook, ajuste y socket.
//
// Reparto de responsabilidades:
// - el participante escribe su propuesta en un flag de SU PROPIO documento User;
// - el GM coordinador la recoge por `updateUser` —donde el documento que cambió
//   ES la identidad autenticada— y la aplica con el motor;
// - el estado público se publica en un ajuste de mundo que todos leen;
// - las vistas privadas se envían una a una por socket, dirigidas a su userId.
//
// La sesión viva (con semilla, mazo y manos) NO se persiste: existe solo en
// memoria del coordinador. Si se pierde, el relevo la cancela con checkpoint,
// que es exactamente lo que manda el contrato.

let moduloConfigurado = null;
let desregistrar = () => {};
// Estado privado del coordinador. Nunca se escribe en Documents, flags ni
// ajustes: solo vive aquí, en el cliente del GM que coordina.
let sesionViva = null;

function canalSocket(moduleId) {
  return `module.${moduleId}`;
}

// Entero positivo de 31 bits desde el CSPRNG del entorno. El motor exige un
// entero como semilla y no admite otra fuente de aleatoriedad.
function semillaCriptografica() {
  const buffer = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buffer);
  return buffer[0] % 2 ** 31;
}

export const AJUSTE_MESA = "minijuegoMesaConfig";

// Usuarios a los que reparte el coordinador: los conectados. A un cliente
// desconectado no hay a quién entregarle nada, y cuando vuelva pedirá relevo de
// vista con `repartirVistas` a la primera acción que ocurra.
function usuariosConectados() {
  return (game.users?.contents ?? []).filter((u) => u.active).map((u) => u.id);
}

// Entrega dirigida de una vista. `game.socket.emit` no se autoentrega, así que
// al destinatario que es este mismo cliente se le pasa en local.
function entregarVista(moduleId, userId, vista, acciones) {
  if (userId === game.user?.id) {
    Hooks.callAll("lagunakMinijuegoVistaPrivada", vista, acciones);
    return;
  }
  game.socket?.emit(canalSocket(moduleId), {
    tipo: "minijuego:vista-privada",
    destinatarioId: userId,
    vista,
    acciones,
  });
}

// Reparte la vista dirigida de la sesión viva a todos los conectados. Se usa
// donde el estado cambia FUERA del despachador de propuestas: al abrir la mesa
// y al relevar coordinador. Sin esto, la mesa recién abierta no le llegaba a
// nadie con sus acciones y la ventana no tenía qué ofrecer.
function repartirVistas(moduleId) {
  if (!sesionViva) return;
  for (const { userId, vista, acciones } of vistasPrivadas(
    sesionViva,
    juegoActivo(),
    usuariosConectados(),
  )) {
    entregarVista(moduleId, userId, vista, acciones);
  }
}

export function registrarAjustesMinijuegos(moduleId) {
  moduloConfigurado = moduleId;
  // Entrada y ciegas de la mesa. Ajuste de MUNDO y no memoria del coordinador:
  // tiene que sobrevivir a un relevo, o la mano siguiente se repartiría con
  // otras fichas sin que nadie lo hubiera decidido.
  game.settings.register(moduleId, AJUSTE_MESA, {
    name: "LAGUNAK.Minijuegos.Ajustes.Mesa.Nombre",
    hint: "LAGUNAK.Minijuegos.Ajustes.Mesa.Pista",
    scope: "world",
    config: true,
    type: Object,
    default: { ...MESA_POR_DEFECTO },
  });
  game.settings.register(moduleId, AJUSTE_SESION, {
    scope: "world",
    config: false,
    type: Object,
    default: null,
  });
}

// Solo el GM activo coordina, igual que en el relé de órdenes: con varios GM
// conectados todos reciben el hook, pero uno solo aplica.
function esCoordinador() {
  return game.user === game.users?.activeGM;
}

// Relevo real del coordinador. El motor sabe hacer el relevo, pero alguien tiene
// que detectar que toca hacerlo: si el GM que coordinaba se marcha, `activeGM`
// pasa a otro cliente cuya `sesionViva` es null, y sin esto descartaría todas
// las propuestas por «no hay sesión» mientras el ajuste público sigue congelado
// con la época y la mano del anterior.
//
// Se ejecuta al arrancar y en cada cambio de conexión. Es idempotente: solo
// actúa el GM activo, y solo cuando el estado público dice que coordinaba otro.
function asegurarCoordinacion() {
  if (!moduloConfigurado || !esCoordinador()) return null;
  const miId = game.user?.id;
  if (!miId) return null;
  // Ya coordino y conservo los secretos: no hay nada que relevar.
  if (sesionViva?.publico?.coordinadorId === miId) return null;
  const publico = game.settings.get(moduloConfigurado, AJUSTE_SESION);
  if (!publico || publico.coordinadorId === miId) return null;

  const adopcion = adoptarSesionPublicada({ publico, coordinadorId: miId });
  if (!adopcion) return null;
  sesionViva = adopcion.sesion;
  game.settings.set(moduloConfigurado, AJUSTE_SESION, adopcion.publico);
  // La mano cancelada se anuncia para que la UI (paso 4) pueda explicar por qué
  // la mesa volvió al estado previo al reparto.
  Hooks.callAll("lagunakMinijuegoRelevoCoordinador", adopcion.publico);
  // El relevo cambia el estado fuera del despachador: hay que volver a repartir
  // o las ventanas abiertas se quedarían con las acciones de la época anterior.
  repartirVistas(moduloConfigurado);
  return adopcion.publico;
}

export function registrarSesionesMinijuegos(moduleId) {
  moduloConfigurado = moduleId;
  desregistrar();
  const escuchas = [];

  // Receptor de vistas privadas: cada cliente descarta lo que no va dirigido a
  // su usuario. Es privacidad de interfaz, no secreto criptográfico.
  const receptor = (mensaje) => {
    if (mensaje?.tipo !== "minijuego:vista-privada") return;
    if (!aceptarVistaPrivada({ destinatarioId: mensaje.destinatarioId, userId: game.user?.id })) {
      return;
    }
    Hooks.callAll("lagunakMinijuegoVistaPrivada", mensaje.vista, mensaje.acciones);
  };
  game.socket?.on(canalSocket(moduleId), receptor);
  escuchas.push(() => game.socket?.off?.(canalSocket(moduleId), receptor));

  if (game.user?.isGM) {
    // Un GM puede pasar a ser el activo sin recargar la página: se comprueba al
    // registrar y en cada conexión o desconexión.
    asegurarCoordinacion();
    // Al conectarse alguien se reparte de nuevo: quien acaba de entrar (o de
    // recargar) no tiene vista ni acciones, y sin esto se quedaría mirando una
    // mesa muerta hasta que otro hiciera algo.
    const alCambiarConexion = () => {
      asegurarCoordinacion();
      repartirVistas(moduleId);
    };
    Hooks.on("userConnected", alCambiarConexion);
    escuchas.push(() => Hooks.off("userConnected", alCambiarConexion));

    const alCambiarUsuario = (userDoc, changes) => {
      // Red de seguridad: si el relevo no se detectó por conexión (p. ej. el GM
      // anterior sigue conectado pero dejó de ser el activo), se resuelve antes
      // de procesar la propuesta en vez de descartarla.
      asegurarCoordinacion();
      const resultado = despacharCambioDeUsuario({
        userDoc,
        changes,
        moduleId,
        obtenerSesion: () => sesionViva,
        puedeCoordinar: esCoordinador,
        juego: juegoActivo(),
        // Semilla del coordinador: se crea aquí y no sale nunca al estado
        // público ni al sobre del cliente. Se toma del CSPRNG del navegador,
        // no de Math.random(): con una baraja de por medio, una semilla
        // adivinable es un mazo adivinable.
        semillaNueva: semillaCriptografica,
        // Sin esto, `start` fallaba SIEMPRE: la sesión deriva los asientos sin
        // fichas y el motor de póker exige un stack. La entrada de la mesa es
        // una decisión de la mesa, no una regla del juego.
        configuracionJuego: configuracionPoker(
          game.settings.get(moduleId, AJUSTE_SESION),
          game.settings.get(moduleId, AJUSTE_MESA) ?? {},
        ),
        // Se reparte a TODOS los conectados, no solo a los sentados: quien
        // aún no juega necesita su vista y sus acciones para que la ventana
        // pueda ofrecerle sentarse o mirar. Al que no está sentado se le manda
        // exactamente la vista pública, que ya es un ajuste de mundo.
        destinatarios: usuariosConectados,
        publicar: (publico) => game.settings.set(moduleId, AJUSTE_SESION, publico),
        enviarPrivada: (userId, vista, acciones) =>
          entregarVista(moduleId, userId, vista, acciones),
        alRechazar: ({ codigo }) => {
          console.debug(`[lagunak] propuesta de minijuego rechazada: ${codigo}`);
        },
      });
      // El despachador devuelve la sesión resultante; se conserva como sesión
      // viva para la acción siguiente. Un rechazo devuelve la sesión intacta y
      // un cambio ajeno devuelve null, así que solo se pisa cuando hay algo.
      if (resultado?.sesion) sesionViva = resultado.sesion;
    };
    Hooks.on("updateUser", alCambiarUsuario);
    escuchas.push(() => Hooks.off("updateUser", alCambiarUsuario));
  }

  desregistrar = () => {
    for (const parar of escuchas) parar();
    desregistrar = () => {};
  };
}

// Verticales registrados. El cableado no conoce ninguno: se le inyecta el módulo
// del juego, que solo tiene que cumplir la interfaz interna del contrato.
//
// El póker se registra por defecto (#308) porque hasta ahora NADIE llamaba a
// `registrarJuego`: `juegoActivo()` devolvía null y toda propuesta se
// despachaba sin vertical, así que la mesa era inalcanzable desde Foundry.
// Sigue siendo inyección —otro juego puede sustituirlo llamando a
// `registrarJuego`—, solo que ya no arranca vacío.
let juego = poker;

export function registrarJuego(moduloDeJuego) {
  juego = moduloDeJuego;
}

function juegoActivo() {
  return juego;
}

// Abre una mesa nueva. Solo el coordinador la crea, porque la sesión viva vive
// en su memoria.
export function abrirMesa({ id, nombreJuego, limites } = {}) {
  if (!moduloConfigurado || !esCoordinador()) return null;
  sesionViva = crearSesion({
    id: id ?? foundry.utils.randomID(),
    juego: nombreJuego ?? "poker",
    anfitrionId: game.user.id,
    coordinadorId: game.user.id,
    limites,
  });
  game.settings.set(moduloConfigurado, AJUSTE_SESION, sesionViva.publico);
  repartirVistas(moduloConfigurado);
  return sesionViva.publico;
}

// Lado participante: propone una acción escribiéndola en su propio flag. No
// declara identidad —la resuelve el coordinador— solo tipo y parámetros.
export function proponerAccion({ tipo, parametros } = {}) {
  if (!moduloConfigurado) return undefined;
  const publico = game.settings.get(moduloConfigurado, AJUSTE_SESION);
  if (!publico) return undefined;
  const sobre = construirPropuesta({
    publico,
    tipo,
    parametros,
    nonce: foundry.utils.randomID(),
  });
  return game.user?.setFlag(moduloConfigurado, FLAG_PROPUESTA, sobre);
}

// Estado público vigente, para que la UI (paso 4) lo pinte sin conocer el
// transporte.
export function estadoPublicoVigente() {
  if (!moduloConfigurado) return null;
  return game.settings.get(moduloConfigurado, AJUSTE_SESION) ?? null;
}
