// Comprobaciones numéricas del cuerpo del avatar retro (#976, punto 3).
//
// Las cinco reglas del issue, hechas aserción en vez de mirada: cada función
// toma datos ya calculados —vértices y caras de una malla, anclajes, o
// posiciones de pie por fotograma— y devuelve un veredicto verificable sin
// abrir ningún PNG. Puro: ni Playwright, ni <canvas>, ni Foundry, así que se
// prueba con `node --test` como cualquier módulo de `foundry-module/scripts`.
//
// Estas funciones NO afirman que la geometría de hoy (`tools/banco-figura.mjs`,
// hecha de `caja()`) cumpla las cinco reglas — construir esa geometría es #974,
// declarado fuera de alcance por #976. Lo que este módulo entrega es el
// INSTRUMENTO: la prueba lo ejercita sobre datos sintéticos, unos que cumplen
// y otros que no, para dejar fijado que cada regla detecta lo que dice detectar.

const EPS = 1e-9;

function resta(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cruz(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function largo(v) {
  return Math.hypot(v[0], v[1], v[2]);
}

// ---- (a) ninguna cara del cuerpo es un rectángulo alineado a ejes ---------

/**
 * ¿Es esta cara —cuatro vértices, en orden— un rectángulo alineado a un eje
 * del mundo? Cada arista de una cara de `escena-primitivas.caja()` es
 * paralela a X, Y o Z: es justo lo que la hace leerse como una caja de
 * Minecraft. Basta con que las CUATRO aristas lo sean para marcarla.
 */
export function esRectanguloAlineado(vertices, cara, tolerancia = 1e-3) {
  if (!Array.isArray(cara) || cara.length !== 4) return false;
  const puntos = cara.map((i) => vertices[i]);
  if (puntos.some((p) => !Array.isArray(p) || p.length < 3)) return false;
  const paralelaAUnEje = (v) => {
    const l = largo(v);
    if (l < tolerancia) return false;
    return v.some((c) => Math.abs(c) / l > 1 - tolerancia);
  };
  for (let i = 0; i < 4; i += 1) {
    const arista = resta(puntos[(i + 1) % 4], puntos[i]);
    if (!paralelaAUnEje(arista)) return false;
  }
  return true;
}

/**
 * Recorre toda la malla y devuelve qué caras infringen la regla 1 de #974.
 * `cumple` es `true` solo si ninguna lo hace.
 */
export function ningunaCaraRectangularAlineada(malla, tolerancia = 1e-3) {
  const vertices = Array.isArray(malla?.vertices) ? malla.vertices : [];
  const caras = Array.isArray(malla?.caras) ? malla.caras : [];
  const infractoras = [];
  caras.forEach((cara, indice) => {
    if (esRectanguloAlineado(vertices, cara, tolerancia)) infractoras.push(indice);
  });
  return { cumple: infractoras.length === 0, infractoras, totalCaras: caras.length };
}

// ---- (b) proporción: yemas de dedos a medio muslo --------------------------

/**
 * Con la altura Y de cadera, rodilla y yema de dedos —el mismo eje que usa
 * `piezasFigura`—, comprueba que la yema cae a MEDIO muslo: ni a la altura de
 * la rodilla ni a la de la cadera, y cerca del punto medio entre ambas.
 */
export function proporcionDedosAMuslo({ cadera, rodilla, yemaDedos }, margen = 0.25) {
  const arriba = Math.max(cadera, rodilla);
  const abajo = Math.min(cadera, rodilla);
  const tramo = arriba - abajo;
  const medioMuslo = (arriba + abajo) / 2;
  if (tramo <= EPS) return { cumple: false, medioMuslo, yemaDedos, motivo: "muslo de longitud nula" };
  const dentroDelTramo = yemaDedos > abajo + EPS && yemaDedos < arriba - EPS;
  const cercaDelMedio = Math.abs(yemaDedos - medioMuslo) <= tramo * margen;
  return { cumple: dentroDelTramo && cercaDelMedio, medioMuslo, yemaDedos, tramo };
}

// ---- (c) pie plantado: siempre uno en el suelo, ninguno lo atraviesa ------

/**
 * `fotogramas` es una lista de `{ pies: [{y}, {y}, ...] }` en orden de ciclo.
 * En cada fotograma, al menos un pie debe tocar el suelo (`y <= sueloY`,
 * dentro de tolerancia) y ninguno puede quedar por debajo de él.
 */
export function piesPlantados(fotogramas, sueloY = 0, tolerancia = 1e-3) {
  const problemas = [];
  (fotogramas ?? []).forEach((fotograma, indice) => {
    const alturas = (fotograma.pies ?? []).map((p) => p.y - sueloY);
    const algunoTocaSuelo = alturas.some((h) => h <= tolerancia);
    const ningunoAtraviesa = alturas.every((h) => h >= -tolerancia);
    if (!algunoTocaSuelo || !ningunoAtraviesa) {
      problemas.push({ fotograma: indice, alturas, algunoTocaSuelo, ningunoAtraviesa });
    }
  });
  return { cumple: problemas.length === 0, problemas };
}

// ---- (d) huellas alternas y alineadas con el eje de marcha ----------------

/**
 * `huellas` es la secuencia de pisadas en vista de planta:
 * `{ x, z, pie: "izq" | "der" }`, en el orden en que se dejan. `ejeMarcha` es
 * el vector `[x, z]` en el que avanza la figura.
 *
 * Tres cosas tienen que cumplirse: no se repite el mismo pie dos veces
 * seguidas (alternas), cada pisada avanza sobre el eje de marcha respecto a
 * la anterior, y las pisadas de un pie quedan siempre al mismo lado del eje
 * —nunca cruzadas con las del otro—.
 */
export function huellasAlternasYAlineadas(huellas, ejeMarcha = [0, 1], tolerancia = 1e-3) {
  const lista = huellas ?? [];
  if (lista.length < 2) return { cumple: true, problemas: [] };
  const [ex, ez] = ejeMarcha;
  const normal = Math.hypot(ex, ez) || 1;
  const dx = ex / normal;
  const dz = ez / normal;
  // Perpendicular al eje de marcha, en el plano XZ: dice a qué lado cae cada
  // pisada.
  const perpX = -dz;
  const perpZ = dx;
  const lateral = (h) => h.x * perpX + h.z * perpZ;
  const problemas = [];
  for (let i = 1; i < lista.length; i += 1) {
    const anterior = lista[i - 1];
    const actual = lista[i];
    if (anterior.pie === actual.pie) {
      problemas.push({ indice: i, motivo: "mismo pie dos veces seguidas" });
    }
    const avance = (actual.x - anterior.x) * dx + (actual.z - anterior.z) * dz;
    if (avance <= tolerancia) {
      problemas.push({ indice: i, motivo: "no avanza sobre el eje de marcha", avance });
    }
  }
  const lateralesIzq = lista.filter((h) => h.pie === "izq").map(lateral);
  const lateralesDer = lista.filter((h) => h.pie === "der").map(lateral);
  if (lateralesIzq.length > 0 && lateralesDer.length > 0) {
    const signoIzq = Math.sign(lateralesIzq.reduce((s, v) => s + v, 0));
    const signoDer = Math.sign(lateralesDer.reduce((s, v) => s + v, 0));
    const cruzadas =
      signoIzq === 0 ||
      signoDer === 0 ||
      signoIzq === signoDer ||
      lateralesIzq.some((v) => Math.sign(v) !== signoIzq) ||
      lateralesDer.some((v) => Math.sign(v) !== signoDer);
    if (cruzadas) problemas.push({ motivo: "pisadas cruzadas o sin lado consistente" });
  }
  return { cumple: problemas.length === 0, problemas };
}

// ---- (e) silueta por clase: mago y guerrero no coinciden ------------------

/**
 * Envolvente 2D (caja alineada, vista frontal por defecto — `plano` elige qué
 * dos coordenadas mirar: `"xy"` de frente, `"xz"` en planta) de una lista de
 * vértices `[x, y, z]`.
 */
export function envolvente2D(vertices, plano = "xy") {
  const [ia, ib] = plano === "xz" ? [0, 2] : [0, 1];
  const as = vertices.map((v) => v[ia]);
  const bs = vertices.map((v) => v[ib]);
  return { min: [Math.min(...as), Math.min(...bs)], max: [Math.max(...as), Math.max(...bs)] };
}

/**
 * ¿Difieren las envolventes de dos mallas de clase? Compara ambas cajas 2D
 * componente a componente; si cualquiera difiere más de `tolerancia`, las
 * siluetas no coinciden, que es lo que #976 exige entre mago y guerrero.
 */
export function siluetasDistintasPorClase(verticesA, verticesB, plano = "xy", tolerancia = 1e-3) {
  const a = envolvente2D(verticesA, plano);
  const b = envolvente2D(verticesB, plano);
  const diferencias = [...a.min, ...a.max].map((v, i) => Math.abs(v - [...b.min, ...b.max][i]));
  const distinta = diferencias.some((d) => d > tolerancia);
  return { cumple: distinta, envolventeA: a, envolventeB: b };
}
