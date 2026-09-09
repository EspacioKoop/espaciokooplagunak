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

// La caída es inversa al CUADRADO de la distancia, no a la distancia. Con 1/d
// un hueso a un metro todavía pesaba una décima de otro a diez centímetros, y
// eso es lo que arrastraba el hombro al doblar el codo.
const POTENCIA = 2;

// Y por debajo de esta fracción del hueso más fuerte, la influencia se descarta
// en vez de atenuarse: un residuo del 2 % no dobla nada, pero SÍ mueve un punto
// que debería estar quieto, y un hombro que se desplaza siete centímetros no se
// lee como una atenuación sino como un rig roto.
//
// SUBIDO DE 0,05 A 0,10 AL MEDIRLO SOBRE UNA MALLA DE VERDAD (#603, fase 4).
// El 0,05 se ajustó contra el brazo sintético de la fase 1 —dos tramos, dos
// huesos, dos unidades de largo— y ahí no se notaba. Sobre la Venus de Milo
// (448 vértices, 2 m, cadena de cuatro huesos) dejaba pasar exactamente el
// fallo que este comentario dice evitar: un vértice del PIE, a 1,4 m del
// pecho, conservaba un 7 % de su influencia, así que al inclinar el pecho 45°
// los pies se iban 6 cm de lado. Una estatua sobre un pedestal cuyos pies
// resbalan no se lee como una atenuación; se lee como que la estatua flota.
// Con 0,10 la deriva del pie es CERO exacta y la pose se entrega mejor —la
// coronilla se va 0,421 m en vez de 0,398, porque el giro deja de repartirse
// por donde no toca—, y siguen mezclando 384 de los 448 vértices, así que no
// es un tajo: el degradado se conserva donde importa.
const UMBRAL_RELATIVO = 0.10;

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

/**
 * El SEGMENTO que ocupa un hueso: de su cabeza a su cola.
 *
 * La cola es la cabeza de su hijo —el tramo de carne que ese hueso mueve al
 * girar—. Ponderar por el segmento cabeza-del-padre → cabeza, como se hacía
 * antes, describe el hueso ANTERIOR: el «brazo» quedaba reducido a un punto en
 * el origen y el «antebrazo» cubría todo el brazo, así que el hombro salía
 * medio del antebrazo y se iba con el codo.
 *
 * Un hueso sin hijos (la punta de una cadena) no tiene cola declarada: se
 * prolonga en la misma dirección por la que le llega su padre, tan largo como
 * ese tramo. Es lo que hace cualquier suite al importar un esqueleto sin colas,
 * y evita el otro extremo del mismo fallo —un hueso-punto que no pesa sobre la
 * mano que sostiene—.
 */
function segmentoDelHueso(rig, i) {
  const cabeza = rig.huesos[i].cabeza;
  const hijo = rig.huesos.find((h) => h.padre === rig.huesos[i].id);
  if (hijo) return [cabeza, hijo.cabeza];
  const padre = rig.huesos[i].padre;
  const desde = padre === null ? [0, 0, 0] : rig.huesos[rig.indice.get(padre)].cabeza;
  const dir = [cabeza[0] - desde[0], cabeza[1] - desde[1], cabeza[2] - desde[2]];
  const largo = Math.hypot(dir[0], dir[1], dir[2]);
  if (largo === 0) return [cabeza, cabeza];
  return [cabeza, [cabeza[0] + dir[0], cabeza[1] + dir[1], cabeza[2] + dir[2]]];
}

/**
 * Pesos de piel por distancia al hueso.
 *
 * Para cada vértice se mide la distancia a cada hueso (su segmento
 * cabeza → cola) y se quedan las `MAX_INFLUENCIAS` más cercanas; el peso es
 * inverso al cuadrado de la distancia, se descartan los residuos por debajo de
 * `UMBRAL_RELATIVO` del más fuerte y se normaliza a suma 1. Eso es justo lo que
 * hacen los auto-weights de cualquier suite: el hueso más cercano manda, los de
 * al lado atenúan y los lejanos no cuentan.
 *
 * @param {{vertices:number[][]}} malla
 * @param {object} rig de `crearRig`
 * @returns pesos normalizados listos para `deformarMalla`.
 */
export function pesosAutomaticos(malla, rig) {
  const total = malla.vertices.length;
  const segmentos = rig.huesos.map((_, i) => segmentoDelHueso(rig, i));
  const crudos = malla.vertices.map((p) => {
    const candidatos = rig.huesos.map((hueso, i) => ({
      hueso: hueso.id,
      peso: 1 / (distanciaASegmento(p, segmentos[i][0], segmentos[i][1]) + EPSILON) ** POTENCIA,
    }));
    candidatos.sort((x, y) => y.peso - x.peso);
    const mejores = candidatos.slice(0, Math.min(MAX_INFLUENCIAS, candidatos.length));
    const tope = mejores[0].peso;
    // Siempre queda al menos el más fuerte: `normalizarPesos` exige que ningún
    // vértice se quede sin hueso.
    return mejores.filter((c, j) => j === 0 || c.peso >= tope * UMBRAL_RELATIVO);
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
 * Una cara entra si TODOS sus vértices pesan ≥ `threshold` para `hueso`, y los
 * vértices de la pieza se DERIVAN de las caras que entraron. Al revés —quedarse
 * los vértices y luego filtrar caras— la pieza se lleva puntos que no pertenecen
 * a ninguna cara: geometría suelta que no se dibuja, no se puede tocar y en el
 * caso límite (un solo vértice por encima del umbral) devolvía una «pieza» sin
 * una sola cara. Sirve para sacar la cabeza de un busto escaneado sin
 * re-escanearla.
 *
 * @returns {{vertices:number[][], caras:number[][]}}
 */
export function extraerRegion(malla, pesos, rig, { hueso, threshold = 0.5 }) {
  const idx = rig.indice.get(hueso);
  if (idx === undefined) {
    throw new Error(`extraerRegion: hueso inexistente "${hueso}"`);
  }
  const dominado = malla.vertices.map((_, v) => pesoDe(pesos[v], idx) >= threshold);
  const mapa = new Map();
  const vertices = [];
  const caras = [];
  for (const cara of malla.caras) {
    if (!cara.every((vi) => dominado[vi])) continue;
    caras.push(cara.map((vi) => {
      if (!mapa.has(vi)) {
        mapa.set(vi, vertices.length);
        vertices.push(malla.vertices[vi]);
      }
      return mapa.get(vi);
    }));
  }
  return { vertices, caras };
}
