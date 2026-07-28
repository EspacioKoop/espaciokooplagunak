import {
  AJUSTE_SESION,
  FLAG_PROPUESTA,
  aceptarVistaPrivada,
  adoptarSesionPublicada,
  construirPropuesta,
  despacharCambioDeUsuario,
} from "./minijuegos/adaptador-sesion.mjs";
import { crearSesion } from "./minijuegos/sesion-motor.mjs";

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

export function registrarAjustesMinijuegos(moduleId) {
  moduloConfigurado = moduleId;
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
    Hooks.callAll("lagunakMinijuegoVistaPrivada", mensaje.vista);
  };
  game.socket?.on(canalSocket(moduleId), receptor);
  escuchas.push(() => game.socket?.off?.(canalSocket(moduleId), receptor));

  if (game.user?.isGM) {
    // Un GM puede pasar a ser el activo sin recargar la página: se comprueba al
    // registrar y en cada conexión o desconexión.
    asegurarCoordinacion();
    const alCambiarConexion = () => asegurarCoordinacion();
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
        publicar: (publico) => game.settings.set(moduleId, AJUSTE_SESION, publico),
        enviarPrivada: (userId, vista) => {
          game.socket?.emit(canalSocket(moduleId), {
            tipo: "minijuego:vista-privada",
            destinatarioId: userId,
            vista,
          });
          // `game.socket.emit` no se autoentrega: si el destinatario es el
          // propio GM, se le pasa la vista en local.
          if (userId === game.user?.id) {
            Hooks.callAll("lagunakMinijuegoVistaPrivada", vista);
          }
        },
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
let juego = null;

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
