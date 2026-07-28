// Arte pixel procedural de la baraja de póker (#308). Genera cada carta como
// SVG en rejilla de píxeles (shape-rendering: crispEdges), sin assets binarios
// ni dependencias: la carta se deriva del código estable de `naipes.mjs`
// ("As", "Td", "2c"…) en el cliente, así que la baraja pesa cero bytes en el
// repositorio.
//
// Criterio de diseño nº 1: LEGIBILIDAD. Cada carta se identifica de un vistazo
// por su índice — valor en tipografía pixel 5x7 + palo 7x7 — repetido en las
// esquinas superior-izquierda e inferior-derecha (invertido, como en una baraja
// física). El centro lleva el palo a gran tamaño. Paleta de alto contraste:
// cara pergamino, tinta casi negra para palos negros y carmesí para rojos,
// coherente con la estética retro/pulp del proyecto. El dorso es un d20 pixel
// sobre campo estrellado: el guiño D&D vive en el dorso para no robar contraste
// a la cara.

import { interpretarCodigo } from "./naipes.mjs";
import { PIXEL } from "../paleta.mjs";

// Lienzo lógico en píxeles de arte; el SVG escala sin difuminar.
export const ANCHO = 30;
export const ALTO = 42;

// Los colores de la baraja son los de la paleta común del arte de rejilla
// (#351); aquí solo se les da el nombre con el que los usa la carta.
export const PALETA = Object.freeze({
  cara: PIXEL.cara, // pergamino claro: máximo contraste con ambas tintas
  borde: PIXEL.borde, // marco tinta sepia oscura
  negro: PIXEL.negro, // palos ♠ ♣: tinta índigo casi negra
  rojo: PIXEL.rojo, // palos ♥ ♦: carmesí profundo
  dorsoFondo: PIXEL.dorsoFondo, // campo estrellado
  dorsoMotivo: PIXEL.dorsoMotivo, // d20 dorado
  dorsoEstrella: PIXEL.dorsoEstrella,
});

// ---- Tipografía pixel 5x7 -------------------------------------------------
// Solo los glifos que necesita un índice de póker. "1" y "0" existen por el 10,
// único valor de dos cifras. Cada glifo es una matriz de cadenas: "#" = píxel.

const GLIFOS = Object.freeze({
  A: ["..#..", ".#.#.", "#...#", "#...#", "#####", "#...#", "#...#"],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  0: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  1: ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  2: [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  3: [".###.", "#...#", "....#", "..##.", "....#", "#...#", ".###."],
  4: ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  5: ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  6: [".###.", "#....", "####.", "#...#", "#...#", "#...#", ".###."],
  7: ["#####", "....#", "...#.", "..#..", "..#..", "..#..", "..#.."],
  8: [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  9: [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
});

// ---- Palos 7x7 ------------------------------------------------------------

const PALOS_PIXEL = Object.freeze({
  s: ["...#...", "..###..", ".#####.", "#######", "###.###", "...#...", "..###.."],
  h: [".##.##.", "#######", "#######", "#######", ".#####.", "..###..", "...#..."],
  d: ["...#...", "..###..", ".#####.", "#######", ".#####.", "..###..", "...#..."],
  c: ["..###..", "..###..", "##.#.##", "#######", "##.#.##", "...#...", "..###.."],
});

// Versión ampliada (x2) del palo para el centro de la carta.
function paloGrande(palo) {
  const base = PALOS_PIXEL[palo];
  const grande = [];
  for (const fila of base) {
    const doble = fila.split("").map((c) => c + c).join("");
    grande.push(doble, doble);
  }
  return grande;
}

// ---- Composición ----------------------------------------------------------

export function etiquetaValor(valor) {
  if (valor === 14) return "A";
  if (valor === 13) return "K";
  if (valor === 12) return "Q";
  if (valor === 11) return "J";
  return String(valor);
}

export function colorDePalo(palo) {
  return palo === "h" || palo === "d" ? PALETA.rojo : PALETA.negro;
}

// Vuelca una matriz de píxeles en la lista `rects` con origen (x, y).
function estampar(rects, matriz, x, y, color) {
  matriz.forEach((fila, dy) => {
    fila.split("").forEach((celda, dx) => {
      if (celda === "#") rects.push({ x: x + dx, y: y + dy, color });
    });
  });
}

// Igual que `estampar` pero rotado 180º, para el índice inferior-derecho.
function estamparInvertido(rects, matriz, x, y, color) {
  const alto = matriz.length;
  const ancho = matriz[0].length;
  matriz.forEach((fila, dy) => {
    fila.split("").forEach((celda, dx) => {
      if (celda === "#") {
        rects.push({ x: x + (ancho - 1 - dx), y: y + (alto - 1 - dy), color });
      }
    });
  });
}

// Índice completo (valor encima, palo debajo) en una esquina.
function estamparIndice(rects, valor, palo, invertido) {
  const color = colorDePalo(palo);
  const glifos = etiquetaValor(valor).split("").map((c) => GLIFOS[c]);
  // Ancho total del valor: glifos de 5 con 1 de separación.
  const anchoValor = glifos.length * 5 + (glifos.length - 1);
  if (!invertido) {
    let x = 2;
    for (const g of glifos) {
      estampar(rects, g, x, 2, color);
      x += 6;
    }
    estampar(rects, PALOS_PIXEL[palo], 2, 10, color);
  } else {
    // Glifos en orden inverso: al girar la carta 180º deben leerse "10", no "01".
    let x = ANCHO - 2 - anchoValor;
    for (const g of [...glifos].reverse()) {
      estamparInvertido(rects, g, x, ALTO - 9, color);
      x += 6;
    }
    estamparInvertido(rects, PALOS_PIXEL[palo], ANCHO - 9, ALTO - 17, color);
  }
}

function rectsDeCarta(codigo) {
  let valor;
  let palo;
  try {
    ({ valor, palo } = interpretarCodigo(codigo));
  } catch (causa) {
    throw new RangeError(
      `cartaSvg: código de carta desconocido (${codigo}); se espera el código ` +
        'estable de naipes.mjs ("As", "Td", "2c"), no el par valor+palo en crudo',
      { cause: causa },
    );
  }
  const rects = [];
  const color = colorDePalo(palo);
  estamparIndice(rects, valor, palo, false);
  estamparIndice(rects, valor, palo, true);
  // Palo central a doble tamaño, centrado.
  const grande = paloGrande(palo);
  estampar(rects, grande, Math.floor((ANCHO - 14) / 2), Math.floor((ALTO - 14) / 2), color);
  return rects;
}

// Dorso: d20 pixel dorado sobre campo estrellado.
const D20 = Object.freeze([
  ".....#####.....",
  "....#.....#....",
  "...#..#.#..#...",
  "..#...#.#...#..",
  ".#....#.#....#.",
  "#..###...###..#",
  "#.#....#....#.#",
  "##.....#.....##",
  "#.#....#....#.#",
  "#..#...#...#..#",
  "#...#..#..#...#",
  ".#...#.#.#...#.",
  "..#...###...#..",
  "...#...#...#...",
  "....#######....",
]);

const ESTRELLAS = Object.freeze([
  [4, 5], [24, 4], [7, 33], [22, 36], [3, 20], [26, 22], [14, 3], [15, 38],
]);

function rectsDeDorso() {
  const rects = [];
  for (const [x, y] of ESTRELLAS) rects.push({ x, y, color: PALETA.dorsoEstrella });
  estampar(rects, D20, Math.floor((ANCHO - 15) / 2), Math.floor((ALTO - 15) / 2), PALETA.dorsoMotivo);
  return rects;
}

// ---- SVG ------------------------------------------------------------------

function svg(rects, fondo) {
  const cuerpo = rects
    .map((r) => `<rect x="${r.x}" y="${r.y}" width="1" height="1" fill="${r.color}"/>`)
    .join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ANCHO} ${ALTO}" ` +
    `shape-rendering="crispEdges" role="img">` +
    // Marco de 1px con esquinas recortadas (recorte pixel de 2px).
    `<rect x="0" y="0" width="${ANCHO}" height="${ALTO}" fill="${PALETA.borde}"/>` +
    `<rect x="1" y="1" width="${ANCHO - 2}" height="${ALTO - 2}" fill="${fondo}"/>` +
    cuerpo +
    `</svg>`
  );
}

// SVG de la cara de una carta a partir de su código estable ("As", "Td", "2c"…).
export function cartaSvg(codigo) {
  return svg(rectsDeCarta(codigo), PALETA.cara);
}

// SVG del dorso común de la baraja.
export function dorsoSvg() {
  return svg(rectsDeDorso(), PALETA.dorsoFondo);
}

// data: URI listo para un <img> de Foundry sin tocar disco.
export function cartaDataUri(codigo) {
  return `data:image/svg+xml,${encodeURIComponent(cartaSvg(codigo))}`;
}

export function dorsoDataUri() {
  return `data:image/svg+xml,${encodeURIComponent(dorsoSvg())}`;
}
