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
// POR AJUSTE DE MUNDO Y NO POR SOCKET, y esta es la decisión importante.
//
// El primer intento fue el socket, por barato: no persiste nada y el dato caduca
// en segundos. Pero `game.socket` NO acredita a quien emite. Cualquier cliente
// podía mandar un sobre con esta misma forma y toda la tripulación lo aceptaba
// como telemetría legítima —casco, rumbo y sistemas inventados— y, con un sello
// en el futuro, dejaba además clavada la consola: las emisiones reales del GM
// llegaban «viejas» y se descartaban. El socket del módulo es un bus, no una
// frontera de autorización.
//
// Un ajuste de MUNDO sí lo es: el servidor de Foundry solo deja escribirlo a un
// GM, y esa comprobación no está en el cliente, así que no se puede saltar desde
// la consola de nadie. El precio es la persistencia, y se paga acotándola: lo
// que se publica va RECORTADO y REDONDEADO, y solo se escribe cuando cambia algo
// de verdad. Con la nave quieta no se escribe nada; moviéndose, una vez por
// sondeo. Sin el redondeo, el ruido del último decimal escribiría siempre.
//
// Puro salvo el emisor: recibe `emitir` y `alRecibir` desde fuera, así que se
// prueba en Node sin Foundry.

export const TIPO_TELEMETRIA = "lagunak:telemetria-nave";

/** Ajuste de mundo donde el GM publica. Solo un GM puede escribirlo. */
export const AJUSTE_TELEMETRIA = "telemetriaNave";

/** Redondeo de lo que se publica. Ver la cabecera: sin esto se escribe siempre. */
function redondear(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
}

/**
 * Recorta la nave a lo que las consolas enseñan, ya redondeado.
 *
 * Recortar no es solo higiene de tamaño: lo que no se copia aquí no puede
 * escaparse por este canal, y este canal es público para toda la mesa.
 */
export function recortarNave(ship) {
  if (!ship || typeof ship !== "object") return null;
  const sistemas = {};
  for (const [nombre, datos] of Object.entries(ship.systems ?? {})) {
    if (!datos || typeof datos !== "object") continue;
    sistemas[nombre] = {
      health: redondear(datos.health),
      heat: redondear(datos.heat),
      power: redondear(datos.power),
      coolant: redondear(datos.coolant),
    };
  }
  return {
    callsign: typeof ship.callsign === "string" ? ship.callsign : null,
    heading: redondear(ship.heading),
    hull: redondear(ship.hull),
    energy: redondear(ship.energy),
    shields: Array.isArray(ship.shields) ? ship.shields.map(redondear) : null,
    destination: ship.destination ?? null,
    systems: sistemas,
  };
}

/** ¿Ha cambiado algo que se vea? Compara lo ya recortado, no el crudo. */
export function hayCambio(nave, anterior) {
  return JSON.stringify(nave) !== JSON.stringify(anterior ?? null);
}

/**
 * Sobre a difundir. Se recorta a lo que la tripulación puede ver: la nave propia
 * y nada más.
 *
 * Los contactos NO van aquí a propósito (excepción de #331): callsign, facción y
 * coordenadas exactas son lo que el sistema de sensores debería decidir cuánto
 * revela, y difundirlos crudos regalaría el trabajo de ese puesto. Cuando se
 * abran, será degradados y por su propio camino — por eso este sobre lleva
 * `ship` y no `statePayload` entero: para que añadir contactos aquí sea una
 * decisión y no un descuido.
 */
export function sobreTelemetria(statePayload, ahora = Date.now()) {
  const ship = recortarNave(statePayload?.ship);
  if (!ship) return null;
  return { tipo: TIPO_TELEMETRIA, ship, sello: ahora };
}

/**
 * Difunde la telemetría. Devuelve el sobre enviado, o `null` si no había nada
 * que enviar — un sondeo fallido no debe borrar de las consolas ajenas la última
 * lectura buena.
 */
export function difundirTelemetria({ statePayload, publicar, anterior = null, ahora }) {
  const sobre = sobreTelemetria(statePayload, ahora);
  if (!sobre || typeof publicar !== "function") return null;
  // Nada nuevo, nada que escribir: es lo que hace barata la persistencia.
  if (!hayCambio(sobre.ship, anterior?.ship)) return null;
  publicar(sobre);
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
  return ship;
}

/**
 * Descarta un sobre más viejo que el que ya se tenía. Sigue haciendo falta con
 * el ajuste de mundo: dos escrituras seguidas pueden llegar cruzadas a un
 * cliente, y sin esto la consola parpadearía hacia atrás un instante — en una
 * lectura de rumbo eso se ve como una sacudida de la nave.
 *
 * Ya no es una defensa contra nadie: un sello en el futuro solo puede ponerlo un
 * GM, porque solo un GM puede escribir el ajuste.
 */
export function esMasReciente(sobre, selloAnterior) {
  const sello = Number(sobre?.sello);
  if (!Number.isFinite(sello)) return false;
  if (!Number.isFinite(Number(selloAnterior))) return true;
  return sello >= Number(selloAnterior);
}
