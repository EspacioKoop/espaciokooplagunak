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
