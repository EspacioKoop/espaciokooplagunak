// Pesos automáticos y despiece por región (#603, fase 2).
//
// La fase 1 (foundry-module/scripts/rig-esqueleto.mjs) da el formato de rig,
// los pesos y la deformación por LBS, pero los pesos se pasaban a mano. Esta
// herramienta los asigna sola —por distancia de cada vértice al hueso— y recorta
// una región como pieza suelta, que es lo que el issue pide para el despiece:
// la cabeza de un busto escaneado ya es contenido completo, no hace falta
// re-estilizarlo.
//
// Sin dependencias: reusa el rig de fase 1 y su álgebra mínima.

import { MAX_INFLUENCIAS, normalizarPesos } from "../foundry-module/scripts/rig-esqueleto.mjs";

// Por debajo de esto la distancia no aporta: un vértice justo sobre el hueso no
// puede pesar infinito, y además evita dividir por cero.
const EPSILON = 1e-3;

/** Distancia del punto `p` al segmento [a, b] (cabeza del padre → cabeza del hueso). */
function distanciaASegmento(p, a, b) {
  const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
  const apx = p[0] - a[0], apy = p[1] - a[1], apz = p[2] - a[2];
  const ab2 = abx * abx + aby * aby + abz * abz;
  let t = ab2 === 0 ? 0 : (apx * abx + apy * aby + apz * abz) / ab2;
  if (t < 0) t = 0; else if (t > 1) t = 1;
  const cx = a[0] + abx * t, cy = a[1] + aby * t, cz = a[2] + abz * t;
  return Math.hypot(p[0] - cx, p[1] - cy, p[2] - cz);
}

/** Cabeza del padre de un hueso, o el origen si es raíz. */
function cabezaDelPadre(rig, i) {
  const padre = rig.huesos[i].padre;
  return padre === null ? [0, 0, 0] : rig.huesos[rig.indice.get(padre)].cabeza;
}

/**
 * Pesos de piel por distancia al hueso.
 *
 * Para cada vértice se mide la distancia a cada hueso (su segmento
 * cabeza-padre) y se quedan las `MAX_INFLUENCIAS` más cercanas; el peso es
 * inversamente proporcional a la distancia, normalizado a suma 1. Eso es
 * justo lo que hacen los auto-weights de cualquier suite: el hueso más cercano
 * manda y los de al lado atenúan.
 *
 * @param {{vertices:number[][]}} malla
 * @param {object} rig de `crearRig`
 * @returns pesos normalizados listos para `deformarMalla`.
 */
export function pesosAutomaticos(malla, rig) {
  const total = malla.vertices.length;
  const crudos = malla.vertices.map((p) => {
    const distancias = rig.huesos.map((hueso, i) => ({
      id: hueso.id,
      d: distanciaASegmento(p, cabezaDelPadre(rig, i), hueso.cabeza),
    }));
    distancias.sort((x, y) => x.d - y.d);
    const mejores = distancias.slice(0, Math.min(MAX_INFLUENCIAS, distancias.length));
    return mejores.map(({ id, d }) => ({ hueso: id, peso: 1 / (d + EPSILON) }));
  });
  return normalizarPesos(rig, crudos, total);
}

/** Peso que el hueso `idx` tiene sobre el vértice (0 si no lo influye). */
function pesoDe(influencias, idx) {
  for (const { indice, peso } of influencias) {
    if (indice === idx) return peso;
  }
  return 0;
}

/**
 * Recorta la región dominada por un hueso como malla aparte.
 *
 * Un vértice entra si su peso para `hueso` es ≥ `threshold`; una cara entra si
 * TODOS sus vértices entran (así la pieza no queda con aristas colgando). Sirve
 * para sacar la cabeza de un busto escaneado sin re-escanearla.
 *
 * @returns {{vertices:number[][], caras:number[][]}}
 */
export function extraerRegion(malla, pesos, rig, { hueso, threshold = 0.5 }) {
  const idx = rig.indice.get(hueso);
  if (idx === undefined) {
    throw new Error(`extraerRegion: hueso inexistente "${hueso}"`);
  }
  const mantener = new Set();
  pesos.forEach((influencias, v) => {
    if (pesoDe(influencias, idx) >= threshold) mantener.add(v);
  });
  const mapa = new Map();
  const vertices = [];
  for (const v of mantener) {
    mapa.set(v, vertices.length);
    vertices.push(malla.vertices[v]);
  }
  const caras = [];
  for (const cara of malla.caras) {
    if (cara.every((vi) => mantener.has(vi))) {
      caras.push(cara.map((vi) => mapa.get(vi)));
    }
  }
  return { vertices, caras };
}
