// Cableado Foundry de la asistencia entre puestos (#309).
//
// `scripts/asistencia/` es un motor entero y puro que hasta ahora no estaba
// enchufado a nada: ningún archivo del módulo lo importaba, así que un jugador no
// podía ayudar a nadie por mucho que las reglas estuvieran escritas y probadas.
// Esto es el enchufe, y nada más. Capa fina y no testeable en Node —usa globales
// de Foundry—, así que aquí no vive ni una decisión: todas están en `relevo.mjs`,
// `sesion.mjs` y el catálogo, ya cubiertas por pruebas.
//
// ## Transporte, y por qué es el mismo que el de las órdenes
//
// El asistente escribe su petición en un flag de SU PROPIO documento `User`. El
// GM la recoge en `updateUser`, donde el documento que cambió ES la identidad
// autenticada de quien pidió. Ni `game.socket` ni un `userId` declarado: el
// primero no acredita a quien emite y el segundo es un campo que cualquiera
// escribe. Misma regla que #237 y que el relé de órdenes, por la misma razón.
//
// La respuesta SÍ va por socket, y eso no lo contradice: lo que viaja de vuelta
// es la oferta que el GM calculó para una persona concreta. Un cliente que se
// invente un mensaje de vuelta solo consigue pintarse a sí mismo una ventana
// bonita — no hay nada al otro lado que la crea, porque la sesión vive en el GM.
//
// ## Dónde NO está el efecto sobre la nave
//
// En ningún sitio de este archivo. La asistencia no emite: produce una propuesta,
// y esa propuesta solo se convierte en efecto cuando el TITULAR del puesto emite
// su propia orden por el relé de siempre, bajo su identidad. Por eso el consumo
// se cuelga de `prepareOrder`, que es un punto del camino que YA existía, y no de
// una vía nueva hacia el puente (ADR-0002). El día que este archivo importe
// `BridgeClient`, el error estará aquí.

import { CATALOGO_BASE } from "./asistencia/catalogo.mjs";
import { crearSesion, podar } from "./asistencia/sesion.mjs";
import {
  ASISTENCIA_FLAG,
  construirPeticionAsistencia,
  despacharCambioDeAsistencia,
  prepararOrdenAsistida,
} from "./asistencia/relevo.mjs";
import { normalizeStation } from "./station-assignment.mjs";
import { AJUSTE_TELEMETRIA } from "./ship-view/telemetria-difusion.mjs";

/** Mensajes de vuelta. El GM habla; el asistente escucha. */
const MENSAJE_OFERTA = "asistencia-oferta";
const MENSAJE_RESULTADO = "asistencia-resultado";
const MENSAJE_RECHAZO = "asistencia-rechazo";

/** Hooks locales con los que la interfaz (rebanada siguiente) se enterará. */
export const HOOK_OFERTA = "lagunakAsistenciaOferta";
export const HOOK_RESULTADO = "lagunakAsistenciaResultado";
export const HOOK_RECHAZO = "lagunakAsistenciaRechazo";

function canalSocket(moduleId) {
  return `module.${moduleId}`;
}

let moduloConfigurado = null;
let catalogo = CATALOGO_BASE;
const escuchas = [];

/**
 * La sesión de asistencia vive EN MEMORIA del GM coordinador, a propósito.
 *
 * Una reserva dura dos minutos y su único cometido es no dejar que dos personas
 * gasten el mismo hueco; persistirla en ajustes de mundo la volvería un dato de
 * partida —recargar dejaría propuestas vivas de una crisis que ya terminó— y
 * escribiría en la base del mundo cada vez que alguien pulsa un botón. Si el GM
 * recarga, las ayudas en vuelo se pierden: es exactamente lo que ya pasa con
 * cualquier cosa que caduque en dos minutos, y la orden del titular sigue
 * saliendo igual, sin mejorar y con aviso.
 */
let sesion = crearSesion();

function esCoordinador() {
  return game.user === game.users?.activeGM;
}

function puestoDe(userId) {
  try {
    return normalizeStation(game.users?.get(userId)?.getFlag(moduloConfigurado, "station") ?? null);
  } catch {
    return null;
  }
}

// Entrega dirigida. `game.socket.emit` no se autoentrega, así que al GM que se
// ayuda a sí mismo se le pasa en local o no se enteraría de su propia respuesta.
const HOOK_DE_MENSAJE = Object.freeze({
  [MENSAJE_OFERTA]: HOOK_OFERTA,
  [MENSAJE_RESULTADO]: HOOK_RESULTADO,
  [MENSAJE_RECHAZO]: HOOK_RECHAZO,
});

function responder(destinatarioId, tipo, carga) {
  if (!destinatarioId) return;
  const hook = HOOK_DE_MENSAJE[tipo];
  if (!hook) return;
  if (destinatarioId === game.user?.id) {
    Hooks.callAll(hook, carga);
    return;
  }
  if (!game.socket) {
    // Callarlo deja a quien pidió ayuda mirando una ventana que no responde, y a
    // nosotros sin saber por qué.
    console.error("[lagunak] no hay socket: la respuesta de asistencia no puede salir");
    return;
  }
  game.socket.emit(canalSocket(moduloConfigurado), { tipo, destinatarioId, carga });
}

/**
 * ¿Puede esta persona echar una mano?
 *
 * Quien ocupa el puesto no se asiste a sí mismo: eso no es cooperación, es un
 * rodeo para mejorar su propia orden, y convertiría la ayuda en un peaje que todo
 * titular pagaría siempre. El GM tampoco asiste — arbitra—. Lo demás lo decide el
 * presupuesto de concurrencia dentro del motor, que es donde sabe contarse.
 *
 * `despacharPeticion` (relevo.mjs) aplica esta misma puerta a "abrir" Y a
 * "resolver", pero una petición "resolver" NUNCA declara `tareaId` —la tarea
 * ya quedó fijada en la reserva que abrió el nonce, y resolver no la repite
 * (`construirPeticionAsistencia`). Sin este caso aparte, `catalogo.buscar(null)`
 * devolvía `null` siempre y CUALQUIER resolución se rechazaba con
 * "no-puede-asistir" antes de llegar al motor: la ayuda se podía pedir y ver
 * la oferta, pero nunca cerrarse. El chequeo de "no te asistas a ti mismo"
 * solo tiene sentido con una tarea que mirar, así que en resolver se deja a
 * `despacharPeticion`, que ya comprueba aparte que el nonce es de quien lo
 * resuelve (`RELEVO_ERRORES.NO_ES_SU_RESERVA`).
 */
function puedeAsistir(tareaId) {
  return (asistenteId) => {
    const usuario = game.users?.get(asistenteId);
    if (!usuario || usuario.isGM) return false;
    if (!tareaId) return true;
    const tarea = catalogo.buscar(tareaId);
    if (!tarea) return false;
    return puestoDe(asistenteId) !== tarea.puestoAsistido;
  };
}

// --- Lado GM coordinador -----------------------------------------------------

function alCambiarUsuario(userDoc, changes) {
  const asistenteId = userDoc?.id;
  const peticion = userDoc?.flags?.[moduloConfigurado]?.[ASISTENCIA_FLAG] ?? null;
  const resultado = despacharCambioDeAsistencia({
    estado: sesion,
    userDoc,
    changes,
    moduleId: moduloConfigurado,
    buscarTarea: (id) => catalogo.buscar(id),
    puedeAsistir: puedeAsistir(peticion?.tareaId),
    canHandle: esCoordinador,
    opcionesApertura: {
      // Lo que el motor necesita saber de la hoja del asistente y de la mesa. La
      // presencia de ficha entra como un booleano APARTE del `system` en sí: sin
      // dnd5e —o sin personaje— la asistencia se degrada al reto de
      // temporización, que produce las MISMAS bandas, y esa degradación es lo
      // que mantiene al módulo jugable sin sistema de juego.
      tieneFicha: Boolean(game.users?.get(asistenteId)?.character),
      // El `system` del Actor tal cual lo expone dnd5e (#500): de ahí sale el
      // modificador real de cada enfoque con `habilidad` declarada. Es la única
      // línea de este archivo que toca la forma de datos de dnd5e; el resto —
      // `modificadorDeFicha`, en `ficha-dnd5e.mjs`— es puro y no sabe qué es un
      // `User` de Foundry.
      ficha: game.users?.get(asistenteId)?.character?.system ?? null,
      // Gastar un espacio de conjuro es un coste de campaña real, así que esa vía
      // la abre el GM o no existe. Sin el ajuste declarado, cerrada.
      gmPermiteRecursos: ajusteBooleano("asistenciaPermiteRecursos"),
      reglaCasaNatural: ajusteBooleano("asistenciaReglaCasaNatural"),
    },
  });
  if (!resultado) return;

  // El estado avanza pase lo que pase: un rechazo devuelve la sesión podada, y
  // quedarse con la anterior resucitaría reservas ya caducadas.
  sesion = resultado.estado ?? sesion;

  if (!resultado.ok) {
    // El nonce viaja en las TRES respuestas, no solo en la oferta: sin él, quien
    // pidió ayuda no puede distinguir la respuesta a lo que está esperando de la
    // respuesta tardía a algo que ya abandonó.
    responder(asistenteId, MENSAJE_RECHAZO, { nonce: peticion?.nonce ?? null, codigo: resultado.error });
    return;
  }
  if (resultado.reserva) {
    responder(asistenteId, MENSAJE_OFERTA, {
      nonce: resultado.reserva.nonce,
      tareaId: resultado.reserva.tareaId,
      puestoAsistido: resultado.reserva.puestoAsistido,
      caducaEn: resultado.reserva.caducaEn,
      oferta: resultado.oferta,
    });
    return;
  }
  if (resultado.propuesta) {
    responder(asistenteId, MENSAJE_RESULTADO, { nonce: peticion?.nonce ?? null, propuesta: resultado.propuesta });
  }
}

function ajusteBooleano(clave) {
  try {
    return Boolean(game.settings.get(moduloConfigurado, clave));
  } catch {
    // Un ajuste que nadie registró se lee como cerrado. Es la lectura segura: la
    // vía que gasta recursos de la ficha no debe abrirse por un descuido de
    // registro.
    return false;
  }
}

/**
 * El punto donde la ayuda se cobra, para inyectar en el relé de órdenes.
 *
 * Se exporta en vez de registrarse por su cuenta porque el relé ya tiene su
 * propio `updateUser` y su propio criterio de GM primario: colgar aquí un segundo
 * manejador que emitiera al puente daría dos órdenes por cada una. Esto es una
 * función pura de cableado; quien la llama es `station-order-wiring.mjs`.
 */
export function prepararOrdenConAsistencia({ userId, order }) {
  const resultado = prepararOrdenAsistida({
    estado: sesion,
    userId,
    orden: order,
    resolverPuesto: puestoDe,
    leerBase,
  });
  sesion = resultado.estado ?? sesion;
  return { orden: resultado.orden, aviso: resultado.aviso };
}

/**
 * El valor ACTUAL sobre el que la ayuda mueve el parámetro, leído de la
 * telemetría que el GM ya difunde a toda la mesa (`telemetria-difusion.mjs`,
 * el mismo ajuste de mundo que alimenta la consola de tripulación).
 *
 * `set_impulse`/`set_warp` no tienen lectura en el DTO v0 del puente (mismo
 * límite documentado en `maniobra-control.mjs`): devolver `null` ahí no es un
 * hueco pendiente, es lo que hay. El motor reconoce `null` como ausencia
 * (`SIN_LECTURA`) y no como cero: la orden del titular sale intacta y la
 * propuesta se conserva para cuando haya lectura.
 */
function leerBase({ accion, params }) {
  const sobre = game.settings?.get?.(moduloConfigurado, AJUSTE_TELEMETRIA);
  const sistema = sobre?.ship?.systems?.[params?.system];
  if (!sistema) return null;
  if (accion === "set_system_power") return typeof sistema.power === "number" ? sistema.power : null;
  if (accion === "set_system_coolant") return typeof sistema.coolant === "number" ? sistema.coolant : null;
  return null;
}

// --- Lado asistente ----------------------------------------------------------

/**
 * Pide abrir una asistencia. Devuelve el nonce con el que seguirla: la respuesta
 * no llega por aquí sino por `HOOK_OFERTA`, porque quien decide es el GM y su
 * respuesta puede tardar o no llegar.
 */
export function pedirAsistencia(tareaId) {
  if (!moduloConfigurado) return null;
  const nonce = foundry.utils.randomID();
  const peticion = construirPeticionAsistencia({ tipo: "abrir", tareaId, nonce });
  game.user?.setFlag(moduloConfigurado, ASISTENCIA_FLAG, peticion);
  return nonce;
}

/**
 * Cierra la asistencia con la banda lograda, venga de la tirada de dnd5e o del
 * reto de temporización: a esta altura ya da igual cuál de las dos, que es justo
 * el punto del diseño.
 */
export function resolverAsistencia({ nonce, banda, enfoqueId = null }) {
  if (!moduloConfigurado) return;
  const peticion = construirPeticionAsistencia({ tipo: "resolver", tareaId: null, nonce, banda, enfoqueId });
  game.user?.setFlag(moduloConfigurado, ASISTENCIA_FLAG, peticion);
}

/** Las tareas con las que hoy se puede ayudar a un puesto. */
export function tareasParaPuesto(puesto) {
  return catalogo.paraPuesto(puesto);
}

// --- Registro ----------------------------------------------------------------

/**
 * Engancha la asistencia. Idempotente: vuelve a registrar si se llama de nuevo
 * (p. ej. tras un relevo de GM), y en clientes de tripulación solo deja la
 * escucha del socket, que es lo único que necesitan.
 */
export function registrarAsistencia(moduleId, { catalogo: propio = null } = {}) {
  moduloConfigurado = moduleId;
  if (propio) catalogo = propio;
  while (escuchas.length) escuchas.pop()();

  const receptor = (mensaje) => {
    // Dirigido: un mensaje para otro no se pinta aquí. No es una defensa —quien
    // manda estos mensajes es el GM— sino el filtro del reparto, porque
    // `socket.emit` va a todo el mundo y no a un destinatario.
    if (mensaje?.destinatarioId !== game.user?.id) return;
    const hook = HOOK_DE_MENSAJE[mensaje.tipo];
    if (hook) Hooks.callAll(hook, mensaje.carga);
  };
  game.socket?.on(canalSocket(moduleId), receptor);
  escuchas.push(() => game.socket?.off?.(canalSocket(moduleId), receptor));

  if (!game.user?.isGM) return;

  Hooks.on("updateUser", alCambiarUsuario);
  escuchas.push(() => Hooks.off("updateUser", alCambiarUsuario));
}

/**
 * Poda las reservas y propuestas caducadas. NO hace falta llamarla para que las
 * reglas sean correctas —cada paso del motor poda por su cuenta— y por eso no hay
 * aquí ningún temporizador: un reloj que no cambia ningún resultado es un reloj
 * que solo puede dar problemas, y el primero fue dejar colgado al proceso que
 * carga este módulo en las pruebas.
 *
 * Se exporta para la interfaz que pinte «quién está ayudando», que sí necesita
 * poder refrescar la lista sin provocar un cambio de juego.
 */
export function podarAsistencias() {
  if (!esCoordinador()) return;
  sesion = podar(sesion);
}
