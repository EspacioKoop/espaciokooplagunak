import {
  AJUSTE_SESION,
  vistasPrivadas,
  FLAG_PROPUESTA,
  aceptarVistaPrivada,
  adoptarSesionPublicada,
  construirPropuesta,
  despacharCambioDeUsuario,
} from "./minijuegos/adaptador-sesion.mjs";
import {
  crearSesion,
  marcarAusente,
  reconectar,
  vistaPublicaSesion,
} from "./minijuegos/sesion-motor.mjs";
import {
  MESA_POR_DEFECTO,
  MESA_POR_DEFECTO_BLACKJACK,
  configuracionBlackjack,
  configuracionPoker,
} from "./minijuegos/mesa-config.mjs";
import * as poker from "./minijuegos/poker-motor.mjs";
import { decidirAccionAutomatica } from "./minijuegos/agente-automatico.mjs";
import * as dadosMotor from "./minijuegos/dados-motor.mjs";
import { decidirJugadaDados } from "./minijuegos/dados-agente.mjs";
import * as blackjackMotor from "./minijuegos/blackjack-motor.mjs";
import { resolverTurnosAutomaticos } from "./minijuegos/turnos-automaticos.mjs";

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

// Mensajes del canal. La vista dirigida la MANDA el coordinador; los otros dos
// los manda cualquiera y no declaran identidad (ver `pedirVista`).
const MENSAJE_VISTA = "minijuego:vista-privada";
const MENSAJE_PEDIR = "minijuego:pedir-vista";
const MENSAJE_RECHAZO = "minijuego:rechazo";

// Entero positivo de 31 bits desde el CSPRNG del entorno. El motor exige un
// entero como semilla y no admite otra fuente de aleatoriedad.
function semillaCriptografica() {
  const buffer = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buffer);
  return buffer[0] % 2 ** 31;
}

// Entrada y ciegas, un ajuste por cifra.
//
// Estuvo un rato como UN ajuste de tipo Object, y era una mina: al guardar,
// `SettingsConfig` de Foundry v11 hace `flattenObject(formData)`, y un ajuste
// visible de tipo Object vuelve del formulario COMO OBJETO, así que se aplana en
// claves inexistentes (`…minijuegoMesaConfig.fichasIniciales`) y el guardado
// entero revienta con «Cannot read properties of undefined (reading
// 'namespace')» — llevándose por delante los demás ajustes del panel, no solo
// este. Además se editaba como «[object Object]», que no es editable en
// absoluto. Tres números sueltos se escriben solos.
export const AJUSTE_FICHAS = "minijuegoFichasIniciales";
export const AJUSTE_CIEGA_PEQUENA = "minijuegoCiegaPequena";
export const AJUSTE_CIEGA_GRANDE = "minijuegoCiegaGrande";
// Apuesta fija de blackjack: no hay ciegas ni botón, todos arriesgan lo mismo
// cada mano. `AJUSTE_FICHAS` sí se comparte con el póker —es la misma idea de
// "con cuánto se sienta cada uno"—, así que solo hace falta un ajuste nuevo.
export const AJUSTE_APUESTA_BLACKJACK = "minijuegoApuestaBlackjack";

// Opciones de mesa tal como las espera `configuracionPoker`, compuestas desde
// los tres ajustes. `normalizarMesa` sigue acotando: son cifras que edita una
// persona a mano y una errata no debe dejar la mesa inarrancable.
function opcionesMesa(moduleId) {
  return {
    fichasIniciales: game.settings.get(moduleId, AJUSTE_FICHAS),
    ciegaPequena: game.settings.get(moduleId, AJUSTE_CIEGA_PEQUENA),
    ciegaGrande: game.settings.get(moduleId, AJUSTE_CIEGA_GRANDE),
  };
}

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
  if (!game.socket) {
    // Sin socket no hay reparto dirigido posible, y callarlo deja a los demás
    // con una mesa que no responde y a nosotros sin saber por qué.
    console.error("[lagunak] no hay socket: la vista dirigida no puede salir");
    return;
  }
  game.socket.emit(canalSocket(moduleId), {
    tipo: MENSAJE_VISTA,
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
  const cifraDeMesa = (clave, nombre, pista, valorPorDefecto) =>
    game.settings.register(moduleId, clave, {
      name: nombre,
      hint: pista,
      scope: "world",
      config: true,
      type: Number,
      default: valorPorDefecto,
    });
  cifraDeMesa(
    AJUSTE_FICHAS,
    "LAGUNAK.Minijuegos.Ajustes.Fichas.Nombre",
    "LAGUNAK.Minijuegos.Ajustes.Fichas.Pista",
    MESA_POR_DEFECTO.fichasIniciales,
  );
  cifraDeMesa(
    AJUSTE_CIEGA_PEQUENA,
    "LAGUNAK.Minijuegos.Ajustes.CiegaPequena.Nombre",
    "LAGUNAK.Minijuegos.Ajustes.CiegaPequena.Pista",
    MESA_POR_DEFECTO.ciegaPequena,
  );
  cifraDeMesa(
    AJUSTE_CIEGA_GRANDE,
    "LAGUNAK.Minijuegos.Ajustes.CiegaGrande.Nombre",
    "LAGUNAK.Minijuegos.Ajustes.CiegaGrande.Pista",
    MESA_POR_DEFECTO.ciegaGrande,
  );
  cifraDeMesa(
    AJUSTE_APUESTA_BLACKJACK,
    "LAGUNAK.Minijuegos.Ajustes.ApuestaBlackjack.Nombre",
    "LAGUNAK.Minijuegos.Ajustes.ApuestaBlackjack.Pista",
    MESA_POR_DEFECTO_BLACKJACK.apuesta,
  );
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
  if (!publico) return null;
  // Ojo con la condición: lo que decide el relevo es NO TENER la sesión viva,
  // no quién figure en el estado público. El coordinador que recarga la página
  // sigue figurando como coordinador —el ajuste de mundo no se entera de un
  // F5— pero ha perdido semilla, mazo y manos, que solo vivían en su memoria.
  // Con la condición mirando el nombre en vez de los secretos, ese GM no
  // readoptaba su propia mesa y descartaba en silencio todo lo que le
  // proponían: la mesa quedaba muerta hasta reabrirla. Readoptar sube la época,
  // cancela la mano y restaura el checkpoint, que es lo honesto: sin semilla no
  // se puede continuar una mano a medias.

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
    // Petición de reparto. La atiende solo el coordinador, y NO se fía de
    // ninguna identidad declarada en el mensaje: reparte a todos, y cada
    // cliente se queda con lo suyo. Así una petición inventada no puede
    // sonsacar la vista de otro; lo peor que consigue es un reparto de más.
    if (mensaje?.tipo === MENSAJE_PEDIR) {
      if (esCoordinador()) repartirVistas(moduleId);
      return;
    }
    if (mensaje?.tipo === MENSAJE_RECHAZO) {
      if (!aceptarVistaPrivada({ destinatarioId: mensaje.destinatarioId, userId: game.user?.id })) {
        return;
      }
      Hooks.callAll("lagunakMinijuegoPropuestaRechazada", mensaje.codigo);
      return;
    }
    if (mensaje?.tipo !== MENSAJE_VISTA) return;
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
    const alCambiarConexion = (usuario, conectado) => {
      asegurarCoordinacion();
      // Presencia. El motor sabe marcar ausente y activo desde el principio,
      // pero nadie se lo decía: un jugador que cerraba la pestaña seguía
      // figurando como activo y la mesa lo esperaba eternamente. Se aplica solo
      // a quien está sentado; a los demás no les cambia nada.
      const id = usuario?.id;
      if (sesionViva && id && sesionViva.publico.jugadores.some((j) => j.userId === id)) {
        const siguiente = conectado
          ? reconectar(sesionViva, id)
          : marcarAusente(sesionViva, id);
        if (siguiente !== sesionViva) {
          sesionViva = siguiente;
          game.settings.set(moduleId, AJUSTE_SESION, vistaPublicaSesion(sesionViva));
        }
      }
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
        // La configuración la compone el vertical, no el cableado: el póker
        // necesita entrada y ciegas, y los dados no necesitan ninguna.
        configuracionJuego: verticalActivo()?.configuracion?.(moduleId) ?? undefined,
        // Se reparte a TODOS los conectados, no solo a los sentados: quien
        // aún no juega necesita su vista y sus acciones para que la ventana
        // pueda ofrecerle sentarse o mirar. Al que no está sentado se le manda
        // exactamente la vista pública, que ya es un ajuste de mundo.
        destinatarios: usuariosConectados,
        publicar: (publico) => game.settings.set(moduleId, AJUSTE_SESION, publico),
        enviarPrivada: (userId, vista, acciones) =>
          entregarVista(moduleId, userId, vista, acciones),
        // Un rechazo silencioso es indistinguible de un botón roto: se le dice
        // a quien lo propuso, que es el único que puede hacer algo al respecto.
        alRechazar: ({ actorId, codigo }) => {
          console.debug(`[lagunak] propuesta de minijuego rechazada: ${codigo}`);
          if (!actorId) return;
          if (actorId === game.user?.id) {
            Hooks.callAll("lagunakMinijuegoPropuestaRechazada", codigo);
            return;
          }
          game.socket?.emit(canalSocket(moduleId), {
            tipo: MENSAJE_RECHAZO,
            destinatarioId: actorId,
            codigo,
          });
        },
      });
      // El despachador devuelve la sesión resultante; se conserva como sesión
      // viva para la acción siguiente. Un rechazo devuelve la sesión intacta y
      // un cambio ajeno devuelve null, así que solo se pisa cuando hay algo.
      if (resultado?.sesion) sesionViva = resultado.sesion;
      // Y ahora juegan las máquinas. Va DESPUÉS de publicar lo que hizo la
      // persona, no en su lugar: la mesa enseña primero la jugada humana y
      // luego la respuesta automática, que es el orden en que ocurren.
      jugarTurnosAutomaticos(moduleId);
    };
    Hooks.on("updateUser", alCambiarUsuario);
    escuchas.push(() => Hooks.off("updateUser", alCambiarUsuario));
  }

  desregistrar = () => {
    for (const parar of escuchas) parar();
    desregistrar = () => {};
  };
}

// Deja que los asientos automáticos jueguen lo suyo y publica el resultado.
//
// Solo el coordinador: es quien tiene la sesión viva —con la mano y la semilla—
// y quien puede aplicar jugadas. Si no hay nada que jugar, `resolver` devuelve
// la misma sesión y aquí no se publica nada, así que llamarlo de más es gratis.
function jugarTurnosAutomaticos(moduleId) {
  if (!sesionViva || !esCoordinador()) return;
  const { sesion, jugadas, cortadoPor } = resolverTurnosAutomaticos(sesionViva, {
    juego: juegoActivo(),
    decidir: verticalActivo()?.decidir ?? null,
  });
  if (jugadas.length === 0) {
    // Un corte con jugadas a cero y motivo es un turno automático atascado: la
    // mesa se queda esperando a una máquina que no sabe jugar. Se dice, porque
    // desde la silla se ve igual que una mesa colgada.
    if (cortadoPor && cortadoPor !== "sin_acciones") {
      console.warn(`[lagunak] turno automático sin resolver: ${cortadoPor}`);
    }
    return;
  }
  sesionViva = sesion;
  game.settings.set(moduleId, AJUSTE_SESION, vistaPublicaSesion(sesionViva));
  repartirVistas(moduleId);
}

// Verticales registrados, POR NOMBRE. El cableado no conoce las reglas de
// ninguno: se le inyectan el motor, la política de sus NPC y cómo se compone su
// configuración de mesa, y con eso ya sabe alojarlo.
//
// Fue un solo módulo mientras hubo un solo juego, y con el segundo (#413) eso ya
// no valía: la mesa dice en su estado público a qué se juega, y el coordinador
// tiene que resolver el vertical POR ESE NOMBRE. Con una variable única, abrir
// una mesa de dados y otra de póker en el mismo mundo dejaba al último que
// registrase mandando sobre las dos, y las propuestas se despachaban contra el
// motor equivocado.
const verticales = new Map();

/**
 * @param {string} nombre el que lleva la sesión en su estado público.
 * @param {object} definicion
 *   - `motor`: el módulo del juego (interfaz interna del contrato #308);
 *   - `decidir`: política de los asientos automáticos, o null si no los admite;
 *   - `configuracion(moduleId)`: configuración de la mano/ronda siguiente, o
 *     null si el juego no necesita ninguna —los dados no la necesitan: sus
 *     asientos los deriva la sesión y los dados los pone el propio motor—.
 *   - `limites`: límites de mesa que pasa `abrirMesa` cuando quien la abre no
 *     trae los suyos, o null para los de `sesion-motor.mjs` (dos jugadores
 *     como mínimo). Solo hace falta declararlo cuando el juego se juega con
 *     menos: el blackjack es el primer caso, porque un jugador solo contra la
 *     banca ya es una mesa completa.
 */
export function registrarJuego(nombre, definicion) {
  // Compatibilidad con la forma de un solo argumento, que registraba «el» juego
  // cuando solo había uno: se toma como el póker, que es lo que se le pasaba.
  if (typeof nombre !== "string") {
    verticales.set("poker", { motor: nombre, decidir: decidirAccionAutomatica, configuracion: configuracionDePoker });
    return;
  }
  verticales.set(nombre, {
    motor: definicion?.motor ?? null,
    decidir: definicion?.decidir ?? null,
    configuracion: definicion?.configuracion ?? null,
    limites: definicion?.limites ?? null,
  });
}

function configuracionDePoker(moduleId) {
  return configuracionPoker(
    game.settings.get(moduleId, AJUSTE_SESION),
    opcionesMesa(moduleId),
  );
}

function configuracionDeBlackjack(moduleId) {
  return configuracionBlackjack(
    game.settings.get(moduleId, AJUSTE_SESION),
    {
      fichasIniciales: game.settings.get(moduleId, AJUSTE_FICHAS),
      apuesta: game.settings.get(moduleId, AJUSTE_APUESTA_BLACKJACK),
    },
  );
}

// Los dos verticales de serie. Se registran aquí y no en `main.mjs` porque son
// del propio módulo: quien quiera sustituir uno o añadir un tercero llama a
// `registrarJuego` igual, que para eso sigue siendo inyección.
registrarJuego("poker", {
  motor: poker,
  decidir: decidirAccionAutomatica,
  configuracion: configuracionDePoker,
});
registrarJuego("dados", {
  motor: dadosMotor,
  decidir: decidirJugadaDados,
  // Sin configuración: los asientos los deriva la sesión de quien esté sentado y
  // los dados de cada uno los pone el motor. Una mesa de dados no tiene entrada.
  configuracion: null,
});
// El tercer vertical (#308, cerrado #340). Sin política de asientos automáticos
// todavía: `decidir: null` dice que esta mesa no admite NPC, no que el motor no
// pudiera jugarlos — nadie ha escrito aún la política de cuándo pedir o
// plantarse. Un asiento "automatico" en una mesa de blackjack se queda sin
// turno resuelto hasta que llegue esa política, igual que le pasaría a
// cualquier otro vertical sin la suya.
registrarJuego("blackjack", {
  motor: blackjackMotor,
  decidir: null,
  configuracion: configuracionDeBlackjack,
  // Único vertical que se juega con un solo jugador: no hay "banca" que se
  // siente aparte, la banca es el propio motor. Con el mínimo de dos que trae
  // `sesion-motor.mjs` una mesa para uno nunca podría arrancar `start`.
  limites: { minJugadores: 1 },
});

/** El vertical de la mesa viva, resuelto por el nombre que ella misma declara. */
function verticalActivo() {
  const nombre = sesionViva?.publico?.juego ?? "poker";
  return verticales.get(nombre) ?? verticales.get("poker") ?? null;
}

function juegoActivo() {
  return verticalActivo()?.motor ?? null;
}

// Abre una mesa nueva. Solo el coordinador la crea, porque la sesión viva vive
// en su memoria.
//
// Sin `limites` explícitos se toman los que declaró el propio vertical al
// registrarse. Hace falta porque el mínimo de jugadores NO es el mismo para
// todos: dos personas hacen falta para que una mano de póker o de dados
// tengan sentido, pero una mesa de blackjack se juega igual de bien un
// jugador solo contra la banca — si `abrirMesa` impusiera aquí el mínimo de
// dos, una mesa de blackjack para uno nunca podría arrancar `start`.
export function abrirMesa({ id, nombreJuego, limites } = {}) {
  if (!moduloConfigurado || !esCoordinador()) return null;
  const nombre = nombreJuego ?? "poker";
  sesionViva = crearSesion({
    id: id ?? foundry.utils.randomID(),
    juego: nombre,
    anfitrionId: game.user.id,
    coordinadorId: game.user.id,
    limites: limites ?? verticales.get(nombre)?.limites,
  });
  // Se publica la VISTA pública, no el estado interno a pelo: la vista añade
  // las acciones de forastero, que son el respaldo de quien no reciba su envío
  // dirigido. Publicando `sesionViva.publico` la mesa nacía sin ellas.
  game.settings.set(moduloConfigurado, AJUSTE_SESION, vistaPublicaSesion(sesionViva));
  repartirVistas(moduloConfigurado);
  return sesionViva.publico;
}

// Lado participante: propone una acción escribiéndola en su propio flag. No
// declara identidad —la resuelve el coordinador— solo tipo y parámetros.
export function proponerAccion({ tipo, parametros } = {}) {
  // Nada de fallar en silencio. Este camino tiene cuatro formas de no hacer
  // nada —módulo sin registrar, mesa inexistente, sobre imposible de construir
  // y escritura del flag rechazada— y las cuatro se veían igual desde la silla:
  // pulsas el botón y no pasa nada. Cada una avisa por su nombre.
  if (!moduloConfigurado) {
    avisarFallo("sin_modulo");
    return undefined;
  }
  const publico = game.settings.get(moduloConfigurado, AJUSTE_SESION);
  if (!publico) {
    avisarFallo("sesion_desconocida");
    return undefined;
  }
  let sobre;
  try {
    sobre = construirPropuesta({
      publico,
      tipo,
      parametros,
      nonce: foundry.utils.randomID(),
    });
  } catch (err) {
    console.error("[lagunak] no se pudo construir la propuesta", err);
    avisarFallo("payload_invalido");
    return undefined;
  }
  return Promise.resolve(game.user?.setFlag(moduloConfigurado, FLAG_PROPUESTA, sobre)).catch(
    (err) => {
      // Aquí acaba, por ejemplo, un cliente sin permiso para escribir su propio
      // documento: la propuesta no llega a salir y el coordinador no se entera
      // de nada, así que el aviso solo puede darlo este lado.
      console.error("[lagunak] el flag de la propuesta no se pudo escribir", err);
      avisarFallo("sin_identidad");
      return undefined;
    },
  );
}

function avisarFallo(codigo) {
  Hooks.callAll("lagunakMinijuegoPropuestaRechazada", codigo);
}

// Pide al coordinador que reparta las vistas.
//
// POR QUÉ HACE FALTA UN TIRÓN Y NO BASTA EL EMPUJÓN. El coordinador reparte
// cuando alguien se conecta, pero `userConnected` le llega mucho antes de que
// el cliente recién llegado haya terminado su `ready` y se haya suscrito al
// canal: ese reparto se pierde en el vacío. El síntoma era una mesa visible sin
// un solo botón —el cliente tenía el estado público, que es un ajuste de mundo,
// pero ninguna acción concedida—, y parecía que la mesa «no dejaba sentarse».
//
// No lleva identidad: no hay forma de autenticar el emisor de un socket, así
// que el coordinador responde repartiendo a todos y cada cual se queda con lo
// suyo.
export function pedirVista() {
  if (!moduloConfigurado) return;
  if (esCoordinador()) {
    repartirVistas(moduloConfigurado);
    return;
  }
  game.socket?.emit(canalSocket(moduloConfigurado), { tipo: MENSAJE_PEDIR });
}

// Estado público vigente, para que la UI (paso 4) lo pinte sin conocer el
// transporte.
export function estadoPublicoVigente() {
  if (!moduloConfigurado) return null;
  return game.settings.get(moduloConfigurado, AJUSTE_SESION) ?? null;
}
