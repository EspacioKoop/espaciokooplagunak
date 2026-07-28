import { proyectarContactos } from "./contactos-proyeccion.mjs";

// Difusión de telemetría de la nave propia a toda la tripulación (#331, paso 1).
//
// El problema que resuelve. Solo el GM tiene el Bearer del puente, así que solo
// él puede sondear `/v1/state`. Hasta ahora eso significaba que solo él veía la
// telemetría, y las consolas de la tripulación salían vacías. Pero «quién puede
// PEDIR el dato» y «quién puede LEERLO» son preguntas distintas, y este módulo
// separa las dos: el GM sigue siendo el único que habla con el puente, y reparte
// lo que recibe.
//
// EL TOKEN NO VIAJA. Lo que se difunde es el `statePayload` ya obtenido, nunca
// la credencial ni la URL. Un cliente de jugador no puede sondear el puente por
// su cuenta —no tiene con qué— y este canal no le da nada para intentarlo.
//
// POR SOCKET Y NO POR AJUSTE DE MUNDO. Un ajuste de mundo se persiste, y aquí
// hay un `/v1/state` por sondeo: sería escritura continua en la base de datos de
// la campaña para un dato que caduca en segundos. La contrapartida —quien
// recarga se queda a oscuras hasta el siguiente tick— es barata: el GM sondea
// cada pocos segundos y la repara sola. Es el mismo canal que las órdenes de
// puesto, en sentido inverso.
//
// Puro salvo el emisor: recibe `emitir` y `alRecibir` desde fuera, así que se
// prueba en Node sin Foundry.

export const TIPO_TELEMETRIA = "lagunak:telemetria-nave";

/** Canal de socket del módulo. Mismo que usan las vistas privadas y las órdenes. */
export function canalTelemetria(moduleId) {
  return `module.${moduleId}`;
}

/**
 * Sobre a difundir. Se recorta a lo que la tripulación puede ver: la nave propia
 * y nada más.
 *
 * Los contactos van DEGRADADOS y nunca crudos (paso 4): `contactos-proyeccion`
 * decide qué se puede saber de cada uno desde donde está la nave. El payload
 * completo del GM —callsign, facción y coordenadas exactas de todo el mapa— no
 * sale de su cliente, y este es el único punto por el que podría escaparse.
 */
export function sobreTelemetria(statePayload, contactsPayload = null) {
  const ship = statePayload?.ship ?? null;
  if (!ship) return null;
  // Los contactos viajan YA DEGRADADOS (#331 paso 4). Nunca el payload crudo:
  // callsign, facción y coordenadas exactas de todo el mapa son del GM, y este
  // es el único punto por el que podrían escaparse.
  const contactos = proyectarContactos({
    contacts: contactsPayload?.contacts ?? [],
    origen: ship.position,
  });
  return { tipo: TIPO_TELEMETRIA, ship, contactos, sello: Date.now() };
}

/**
 * Difunde la telemetría. Devuelve el sobre enviado, o `null` si no había nada
 * que enviar — un sondeo fallido no debe borrar de las consolas ajenas la última
 * lectura buena.
 */
export function difundirTelemetria({ statePayload, contactsPayload = null, emitir }) {
  const sobre = sobreTelemetria(statePayload, contactsPayload);
  if (!sobre || typeof emitir !== "function") return null;
  emitir(sobre);
  return sobre;
}

/**
 * Acepta un mensaje recibido y devuelve la nave, o `null` si el mensaje no era
 * para esto. Se filtra por tipo y no por «lo que venga»: por este canal viajan
 * también las vistas privadas de los minijuegos.
 */
export function aceptarTelemetria(mensaje) {
  if (mensaje?.tipo !== TIPO_TELEMETRIA) return null;
  const ship = mensaje.ship;
  if (!ship || typeof ship !== "object") return null;
  return { ship, contactos: Array.isArray(mensaje.contactos) ? mensaje.contactos : [] };
}

/**
 * Descarta un sobre más viejo que el que ya se tenía. El socket no garantiza
 * orden, y dos sondeos seguidos pueden llegar cruzados: sin esto, la consola
 * parpadearía hacia atrás durante un instante y en una lectura de rumbo eso se
 * ve como una sacudida de la nave.
 */
export function esMasReciente(sobre, selloAnterior) {
  const sello = Number(sobre?.sello);
  if (!Number.isFinite(sello)) return false;
  if (!Number.isFinite(Number(selloAnterior))) return true;
  return sello >= Number(selloAnterior);
}
