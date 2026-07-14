/**
 * Lógica pura de la «ventana de la nave»: el mapa vivo con estética Neo Geo
 * (paleta saturada, blips pixelados) y sensación de mirar por la escotilla de
 * una nave pequeña, con un campo de estrellas de varias capas en parallax que
 * finge la profundidad (sin 3D real).
 *
 * ESM sin dependencias de Foundry ni del DOM: se importa desde el módulo
 * (navegador) y desde Node para las pruebas. Todo lo que toca el <canvas> vive
 * fuera de aquí; esto solo calcula posiciones, colores y desplazamientos.
 */

// Paleta arcade saturada tipo Neo Geo para las facciones.
export const PALETA_FACCIONES = [
  "#ff2e88", // magenta
  "#00e5ff", // cian
  "#ffb703", // ámbar
  "#38b000", // verde
  "#9d4edd", // púrpura
  "#ef233c", // rojo
  "#3a86ff", // azul
  "#f15bb5", // rosa
];
export const COLOR_JUGADOR = "#fdfffc"; // blanco cálido: la nave propia destaca
export const COLOR_NEUTRO = "#7d8597"; // gris azulado: objetos sin facción

/** Color determinista para una facción. El jugador y los objetos sin facción
 * tienen colores reservados; el resto se reparte por hash sobre la paleta. */
export function colorFaccion(faction, esJugador = false) {
  if (esJugador) return COLOR_JUGADOR;
  if (faction == null || faction === "") return COLOR_NEUTRO;
  let hash = 0;
  for (let i = 0; i < faction.length; i += 1) {
    hash = (hash * 31 + faction.charCodeAt(i)) >>> 0;
  }
  return PALETA_FACCIONES[hash % PALETA_FACCIONES.length];
}

/** PRNG determinista (mulberry32): misma semilla, mismo campo de estrellas. */
export function rngSemilla(seed) {
  let a = seed >>> 0;
  return function siguiente() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Campo de estrellas por capas para el parallax. Las capas se ordenan de
 * lejana (factor pequeño, se mueve poco) a cercana (factor grande, se mueve
 * mucho): esa diferencia de velocidad es lo que finge la profundidad.
 *
 * @returns {{factor:number, estrellas:{x:number,y:number,r:number,brillo:number}[]}[]}
 */
export function crearCampoEstrellas(seed, { capas = 3, porCapa = 40, ancho = 320, alto = 320 } = {}) {
  const rng = rngSemilla(seed);
  const salida = [];
  for (let c = 0; c < capas; c += 1) {
    const factor = (c + 1) / capas; // 1/capas … 1
    const estrellas = [];
    for (let i = 0; i < porCapa; i += 1) {
      estrellas.push({
        x: rng() * ancho,
        y: rng() * alto,
        r: 0.5 + factor * 1.5, // las cercanas, más gordas
        brillo: 0.35 + factor * 0.65,
      });
    }
    salida.push({ factor, estrellas });
  }
  return salida;
}

/**
 * Desplazamiento en parallax de una capa según la posición del mundo (la nave).
 * Al moverse la nave, las estrellas se desplazan en sentido contrario, tanto
 * más cuanto más «cerca» está la capa. Se envuelve al tamaño del lienzo para
 * teselar sin costuras visibles.
 */
export function offsetParallax(factorCapa, centroMundo, escalaFondo, ancho, alto) {
  const bruto = (v, tam) => {
    const d = -(v * escalaFondo * factorCapa) % tam;
    return d < 0 ? d + tam : d; // siempre en [0, tam)
  };
  return {
    dx: bruto(centroMundo?.x ?? 0, ancho),
    dy: bruto(centroMundo?.y ?? 0, alto),
  };
}

/**
 * Proyecta los contactos al lienzo, centrados en la nave del jugador. Escala
 * `radioMundo` unidades de mundo al radio del visor. Con `headingDeg` rota el
 * mundo para que el morro de la nave apunte hacia arriba (sensación de cabina).
 *
 * @returns {{callsign:string,faction:(string|null),esJugador:boolean,
 *   x:number,y:number,distancia:number,dentro:boolean}[]}
 */
export function proyectarContactos({ contacts = [], centro, headingDeg = 0, radioMundo = 30000, ancho = 320, alto = 320 }) {
  const cx = ancho / 2;
  const cy = alto / 2;
  const radioVisor = Math.min(ancho, alto) / 2;
  const escala = radioVisor / radioMundo;
  const a = (-headingDeg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const ox = centro?.x ?? 0;
  const oy = centro?.y ?? 0;

  return contacts.map((c) => {
    const relx = (c.position?.x ?? 0) - ox;
    const rely = (c.position?.y ?? 0) - oy;
    const rx = relx * cos - rely * sin;
    const ry = relx * sin + rely * cos;
    const distancia = Math.hypot(relx, rely);
    return {
      callsign: c.callsign ?? "?",
      faction: c.faction ?? null,
      esJugador: Boolean(c.is_player),
      x: cx + rx * escala,
      y: cy + ry * escala,
      distancia,
      dentro: distancia * escala <= radioVisor,
    };
  });
}

/**
 * Interpola el centro (posición de la nave propia) entre las dos últimas
 * muestras CONFIRMADAS del puente. `t` se acota a [0,1]: nunca se extrapola
 * más allá de la última muestra — el mapa es una vista de lo que el puente ha
 * dicho, no un simulador propio (docs/FOUNDRY.md). Con una sola muestra (o
 * timestamps degenerados) devuelve la actual tal cual.
 *
 * @param {{tMs:number,centro:{x:number,y:number}}|null} prev
 * @param {{tMs:number,centro:{x:number,y:number}}} actual
 * @param {number} tMs instante de dibujo (misma base de tiempo que las muestras)
 */
export function interpolarCentro(prev, actual, tMs) {
  if (!actual) return { x: 0, y: 0 };
  if (!prev || !(actual.tMs > prev.tMs)) return { ...actual.centro };
  const t = Math.min(1, Math.max(0, (tMs - prev.tMs) / (actual.tMs - prev.tMs)));
  return {
    x: prev.centro.x + (actual.centro.x - prev.centro.x) * t,
    y: prev.centro.y + (actual.centro.y - prev.centro.y) * t,
  };
}

/**
 * Interpola dos rumbos en grados por el camino angular corto (350°→10° cruza
 * por 0°, no da la vuelta por 180°). Resultado normalizado a [0, 360).
 */
export function interpolarAngulo(a, b, t) {
  const ta = Math.min(1, Math.max(0, t));
  let delta = (((b - a) % 360) + 540) % 360 - 180; // en (-180, 180]
  const bruto = a + delta * ta;
  return ((bruto % 360) + 360) % 360;
}

/** Throttle del bucle de dibujo: ¿toca pintar este tick de rAF a `fpsMax`?
 * El primer frame (sin dibujo previo) pinta siempre. */
export function debeDibujar(ultimoMs, ahoraMs, fpsMax = 30) {
  if (ultimoMs == null) return true;
  return ahoraMs - ultimoMs >= 1000 / fpsMax;
}

/**
 * Rota las muestras del sondeo creando una VENTANA DE REPRODUCCIÓN. El dibujo
 * ocurre siempre en tiempos posteriores a la recepción, así que timestampear
 * la muestra nueva con "ahora" dejaría el tween clavado en t=1 (ningún frame
 * intermedio). En su lugar, al recibir una muestra el tween se programa hacia
 * delante: `prev` (la posición confirmada ANTERIOR) se ancla en `ahoraMs` y
 * `actual` (la recién confirmada) en `ahoraMs + ventana`, donde `ventana` es
 * el tiempo real transcurrido entre recepciones (acotado por `ventanaMaxMs`,
 * para que un hueco de backoff no produzca un tween de un minuto). Los frames
 * de ese intervalo interpolan 0→1 y después el clamp deja el mapa clavado en
 * la última muestra confirmada: se REPRODUCE movimiento ya confirmado con un
 * intervalo de retardo — nunca se extrapola.
 *
 * @param {object|null} muestraActual la muestra `actual` vigente (null si es la primera)
 * @param {{centro:{x:number,y:number}, rumboDeg:number}} nueva datos confirmados del puente
 * @param {number} ahoraMs instante de recepción (misma base de tiempo que el dibujo)
 * @returns {{prev: object|null, actual: object}}
 */
export function rotarMuestras(muestraActual, nueva, ahoraMs, ventanaMaxMs = 4000) {
  const entrante = {
    centro: { x: nueva.centro?.x ?? 0, y: nueva.centro?.y ?? 0 },
    rumboDeg: nueva.rumboDeg ?? 0,
    recibidaMs: ahoraMs,
  };
  if (!muestraActual) {
    // Primera muestra: se pinta directa, sin tween (no hay "anterior").
    return { prev: null, actual: { ...entrante, tMs: ahoraMs } };
  }
  const transcurrido = ahoraMs - (muestraActual.recibidaMs ?? ahoraMs);
  const ventana = Math.min(Math.max(transcurrido, 0), ventanaMaxMs);
  return {
    prev: { tMs: ahoraMs, centro: muestraActual.centro, rumboDeg: muestraActual.rumboDeg },
    actual: { ...entrante, tMs: ahoraMs + ventana },
  };
}

/**
 * Compone el «frame» del mapa vivo: TODO lo que el pintor de canvas necesita,
 * calculado de forma pura y determinista (mismas entradas → mismo frame). El
 * movimiento propio se tweenea entre las dos últimas muestras del puente
 * (interpolarCentro/interpolarAngulo, sin extrapolación); los contactos se
 * proyectan con sus últimas posiciones conocidas. El `parpadeo` retro de los
 * blips sale de la fase temporal, no de estado mutable.
 *
 * @returns {{sinDatos:boolean, centro:{x,y}, rumboDeg:number,
 *   capas:{dx:number,dy:number,estrellas:object[]}[],
 *   blips:{callsign,faction,color,esJugador,x,y,distancia,dentro,parpadeo}[]}}
 */
export function componerFrame({
  muestraPrev = null,
  muestraActual = null,
  contactos = [],
  campo = [],
  tMs = 0,
  ancho = 320,
  alto = 320,
  radioMundo = 30000,
  escalaFondo = 0.05,
} = {}) {
  if (!muestraActual) {
    return { sinDatos: true, centro: { x: 0, y: 0 }, rumboDeg: 0, capas: [], blips: [] };
  }
  const centro = interpolarCentro(muestraPrev, muestraActual, tMs);
  const rumboDeg = muestraPrev && muestraActual.tMs > muestraPrev.tMs
    ? interpolarAngulo(
        muestraPrev.rumboDeg ?? 0,
        muestraActual.rumboDeg ?? 0,
        (tMs - muestraPrev.tMs) / (muestraActual.tMs - muestraPrev.tMs),
      )
    : ((muestraActual.rumboDeg ?? 0) % 360 + 360) % 360;

  const capas = campo.map((capa) => ({
    ...offsetParallax(capa.factor, centro, escalaFondo, ancho, alto),
    estrellas: capa.estrellas,
  }));

  const encendido = Math.floor(tMs / 300) % 2 === 0; // fase de parpadeo retro
  const blips = proyectarContactos({
    contacts: contactos, centro, headingDeg: rumboDeg, radioMundo, ancho, alto,
  }).map((p) => ({
    ...p,
    color: colorFaccion(p.faction, p.esJugador),
    parpadeo: p.esJugador ? true : encendido, // la nave propia no parpadea
  }));

  return { sinDatos: false, centro, rumboDeg, capas, blips };
}
