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

import { degradarContactos } from "../contactos-degradados.mjs";

export const TIPO_TELEMETRIA = "lagunak:telemetria-nave";

/** Ajuste de mundo donde el GM publica. Solo un GM puede escribirlo. */
export const AJUSTE_TELEMETRIA = "telemetriaNave";

/**
 * Ajuste de mundo de la base de datos científica (#520). Aparte del sobre de
 * telemetría a propósito: aquel se reescribe en cada sondeo y esto se pide una
 * vez. No lleva nada sensible —son fichas de escenario— pero sí es grande.
 */
export const AJUSTE_BASE_DATOS = "baseDatosCientifica";

/** Redondeo de lo que se publica. Ver la cabecera: sin esto se escribe siempre. */
function numero(valor) {
  if (typeof valor !== "number" && (typeof valor !== "string" || valor.trim() === "")) return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function redondear(valor) {
  const n = numero(valor);
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
    // OJO: esta función es una LISTA BLANCA. Un campo nuevo de `/v1/state` llega
    // al GM (que sondea el puente) pero NO a las consolas de tripulación hasta
    // que se copia aquí a mano, y el modo de fallo es silencioso: el control no
    // aparece y no salta ningún error. Que sea lista blanca es deliberado —lo
    // que no se copia no puede escaparse por este canal— pero hay que acordarse
    // al añadir lecturas.
    //
    // La carga de maniobra (#519) se copia SIN redondear a un decimal como el
    // resto: es una fracción 0..1, y `redondear` la dejaría en saltos del 10 %.
    combat_maneuver: recortarManiobra(ship.combat_maneuver),
    // De la autodestrucción (#518) se copian SOLO `active` y `countdown`, y
    // nunca un código, aunque el puente llegara a publicarlos: este sobre acaba
    // en un ajuste de mundo que toda la mesa puede leer, así que un código aquí
    // sería un código público y el puzle de tres personas dejaría de existir.
    self_destruct: recortarAutodestruccion(ship.self_destruct),
    shield_calibration: recortarCalibracion(ship.shield_calibration),
    // La condición de alerta (#517) va a TODA la tripulación a propósito, no
    // solo a Relay: que la nave esté en roja es justo lo que todo el mundo debe
    // saber. Fijarla sigue siendo solo de Relay (#237); esto es leerla.
    alert_level: recortarNivelAlerta(ship.alert_level),
    probes: recortarSondas(ship.probes),
    // Del enlace sonda→ciencia (#520) se copia solo el indicativo: la POSICIÓN
    // de la sonda no viaja. No hace falta —la lectura desde la sonda ya se
    // difunde degradada en `sensoresSonda`— y este sobre acaba en un ajuste de
    // mundo que toda la mesa puede leer, así que una coordenada exacta ahí
    // sería una coordenada exacta para todos.
    science_link: recortarEnlaceCiencia(ship.science_link),
    // #522. OJO: esta función es una LISTA BLANCA. Un campo nuevo de
    // `/v1/state` llega al GM (que sondea el puente) pero NO a las consolas de
    // tripulación hasta que se copia aquí a mano, y el modo de fallo es
    // silencioso: el control no aparece y no salta ningún error.
    //
    // El interior sí viaja entero: el plano de la propia nave y dónde están sus
    // equipos no es información que ningún puesto tenga que ganarse — es la
    // nave en la que van todos. Lo que se sigue sin difundir es lo de FUERA.
    internal: recortarInterior(ship.internal),
  };
}

/**
 * Planta de la nave y equipos de reparación. Se copia tal cual (son enteros de
 * rejilla, no hay nada que redondear) filtrando lo que no tenga forma: una sala
 * a medias pintaría un plano mentiroso.
 */
function recortarInterior(interior) {
  if (!interior || typeof interior !== "object") return null;
  const rooms = Array.isArray(interior.rooms) ? interior.rooms : null;
  if (rooms === null) return null;
  const salas = rooms
    .filter((sala) => ["x", "y", "w", "h"].every((k) => Number.isFinite(numero(sala?.[k]))))
    .map((sala) => ({
      x: Math.round(Number(sala.x)),
      y: Math.round(Number(sala.y)),
      w: Math.round(Number(sala.w)),
      h: Math.round(Number(sala.h)),
      system: typeof sala.system === "string" && sala.system !== "" ? sala.system : null,
    }));
  if (salas.length === 0) return null;
  const crews = Array.isArray(interior.crews) ? interior.crews : [];
  return {
    rooms: salas,
    crews: crews
      .filter((eq) => Number.isFinite(numero(eq?.position?.x)) && Number.isFinite(numero(eq?.position?.y)))
      .map((eq) => ({
        position: { x: Math.round(Number(eq.position.x)), y: Math.round(Number(eq.position.y)) },
        target:
          Number.isFinite(numero(eq?.target?.x)) && Number.isFinite(numero(eq?.target?.y))
            ? { x: Math.round(Number(eq.target.x)), y: Math.round(Number(eq.target.y)) }
            : null,
      })),
  };
}

/** Solo si está armada y cuánto queda. Nunca códigos. */
function recortarAutodestruccion(autodestruccion) {
  if (!autodestruccion || typeof autodestruccion !== "object") return null;
  if (typeof autodestruccion.active !== "boolean") return null;
  return {
    active: autodestruccion.active,
    countdown: autodestruccion.active ? redondear(autodestruccion.countdown) : null,
  };
}

/** Frecuencia actual y lo que le queda de recalibrado. */
function recortarCalibracion(calibracion) {
  if (!calibracion || typeof calibracion !== "object") return null;
  const frecuencia = numero(calibracion.frequency);
  if (!Number.isFinite(frecuencia)) return null;
  return {
    frequency: Math.round(frecuencia),
    calibration_delay: redondear(calibracion.calibration_delay),
  };
}

/**
 * Carga de la maniobra de combate. Conserva la diferencia entre "no hay
 * lectura" (`null`) y "la hay y está a cero", que es la que separa «no sé si
 * puedes maniobrar» de «no puedes».
 */
function recortarManiobra(maniobra) {
  if (!maniobra || typeof maniobra !== "object") return null;
  const carga = numero(maniobra.charge);
  if (!Number.isFinite(carga)) return null;
  return { charge: Math.round(carga * 1000) / 1000 };
}

/** Los tres niveles del contrato, o `null`. Nunca se cae a "normal": eso diría
 * que la nave está tranquila justo cuando no se sabe si lo está. */
function recortarNivelAlerta(nivel) {
  return nivel === "normal" || nivel === "yellow" || nivel === "red" ? nivel : null;
}

/** Sondas restantes y máximo. `0` es una lectura legítima —se han gastado— y se
 * distingue de la ausencia de lanzador. */
function recortarSondas(probes) {
  const stock = numero(probes?.stock);
  const max = numero(probes?.max);
  if (!Number.isFinite(stock) || !Number.isFinite(max)) return null;
  return { stock: Math.round(stock), max: Math.round(max) };
}

/** Solo el indicativo de la sonda enlazada. Nunca su posición. */
function recortarEnlaceCiencia(enlace) {
  if (!enlace || typeof enlace !== "object") return null;
  const callsign = typeof enlace.callsign === "string" && enlace.callsign !== ""
    ? enlace.callsign
    : null;
  return { callsign };
}

/** ¿Ha cambiado algo que se vea? Compara lo ya recortado, no el crudo. */
export function hayCambio(nave, anterior) {
  return JSON.stringify(nave) !== JSON.stringify(anterior ?? null);
}

/**
 * Sobre a difundir. Se recorta a lo que la tripulación puede ver: la nave propia
 * y nada más.
 *
 * Los contactos ya no van crudos, pero tampoco se quedan fuera (#331 paso 3):
 * viajan DEGRADADOS por el alcance real del radar de la nave. La degradación
 * ocurre aquí, en el origen, y no al pintar: este sobre acaba en un ajuste de
 * mundo que toda la mesa puede leer, así que recortar en la vista no defendería
 * nada —el dato crudo ya estaría en el cliente de cualquiera—. Lo que no sale de
 * esta función es lo único que de verdad no sale.
 *
 * Sin lectura de radar no se publica ningún contacto. `null` ahí significa «no
 * se puede decidir qué ve esta nave», que no es «no ve nada», y ante esa duda se
 * calla en vez de abrir.
 */
export function sobreTelemetria(statePayload, ahora = Date.now(), contactsPayload = null) {
  const ship = recortarNave(statePayload?.ship);
  if (!ship) return null;
  const sensores = degradarContactos(
    contactsPayload,
    statePayload?.ship?.position ?? null,
    statePayload?.ship?.radar ?? null,
  );
  // Vista de sonda (#520). La pantalla nativa de Science, con una sonda
  // enlazada, RECENTRA el radar en ella conservando los alcances de la nave
  // (`scienceScreen.cpp`). Aquí se hace lo mismo: la MISMA degradación, el
  // MISMO alcance, otro centro. Eso es lo que la hace útil —ver lo que hay
  // alrededor de la sonda, lejos— sin inventarle a la sonda un alcance propio
  // que el juego no le da.
  //
  // Sin enlace no se difunde nada: `null` apaga la vista, y una lista vacía
  // diría «he mirado desde la sonda y no hay nada» sin haber sonda.
  const posicionSonda = statePayload?.ship?.science_link?.position ?? null;
  const sensoresSonda = posicionSonda
    ? degradarContactos(contactsPayload, posicionSonda, statePayload?.ship?.radar ?? null)
    : null;
  return { tipo: TIPO_TELEMETRIA, ship, sensores, sensoresSonda, sello: ahora };
}

/**
 * Difunde la telemetría. Devuelve el sobre enviado, o `null` si no había nada
 * que enviar — un sondeo fallido no debe borrar de las consolas ajenas la última
 * lectura buena.
 */
export function difundirTelemetria({
  statePayload,
  publicar,
  anterior = null,
  ahora,
  contactsPayload = null,
}) {
  const sobre = sobreTelemetria(statePayload, ahora, contactsPayload);
  if (!sobre || typeof publicar !== "function") return null;
  // Nada nuevo, nada que escribir: es lo que hace barata la persistencia. Los
  // contactos entran en la comparación porque un contacto que se acerca cambia
  // de banda sin que la nave propia se mueva, y eso sí hay que repartirlo.
  if (!hayCambio(sobre.ship, anterior?.ship)
      && !hayCambio(sobre.sensores, anterior?.sensores)
      && !hayCambio(sobre.sensoresSonda, anterior?.sensoresSonda)) return null;
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

/** Los contactos degradados del sobre, o `null` si no traía. */
export function aceptarSensores(mensaje) {
  if (mensaje?.tipo !== TIPO_TELEMETRIA) return null;
  const sensores = mensaje.sensores;
  if (!sensores || !Array.isArray(sensores.contactos)) return null;
  return sensores;
}

/**
 * La lectura degradada centrada en la sonda enlazada (#520), o `null`.
 *
 * Misma comprobación que `aceptarSensores` y por el mismo motivo: un sobre sin
 * la forma esperada no se interpreta a medias. `null` apaga la vista de sonda,
 * que es distinto de una lista vacía —«no hay sonda» frente a «desde la sonda
 * no se ve nada»—.
 */
export function aceptarSensoresSonda(mensaje) {
  if (mensaje?.tipo !== TIPO_TELEMETRIA) return null;
  const sensores = mensaje.sensoresSonda;
  if (!sensores || !Array.isArray(sensores.contactos)) return null;
  return sensores;
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
