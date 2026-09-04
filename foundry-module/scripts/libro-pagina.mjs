// Página del libro 3D interactuable (#853, vertical 1): el dibujo de una hoja
// con el mismo primitivo que la piel de los muros (`chapasDeRejilla`), a su
// propia celda, con un tope validado al importar.
//
// ES MANCHA TIPOGRÁFICA Y COMPOSICIÓN, NO TEXTO LEGIBLE. Regla dura de
// #526/#838: un libro es la superficie donde más fácil sería saltarse esa
// regla, porque el instinto es «poner un párrafo». Aquí no hay párrafo: lo que
// se ve es una página impresa a lo lejos —bloques de texto sugeridos, márgenes,
// una cabecera—, pero ninguna letra que se lea como dato de partida. Ni mapas,
// ni tablas, ni coordenadas, ni cartas de navegación: si la mancha se puede leer
// como instrumento, no se cuelga (y este módulo no la cuelga; solo la dibuja).
//
// CELDA MÁS FINA QUE EL CUADRO (#836/#838): una página se mira más de cerca que
// un lienzo colgado a 1,2 m. El cuadro usa 2,5 cm porque a esa distancia una
// rejilla más fina ya no se distingue; una hoja a un palmo de la cara sí. Pero
// una hoja de libro es pequeña (A5 ~ 0,15 x 0,21 m), así que la rejilla no puede
// dispararse: 1 cm da 15 x 21 celdas, suficiente para la mancha y pocas caras.
//
// TOPE DURO AL IMPORTAR, como `TOPE_CUADRO`: la página se repite en las dos
// caras de la hoja que gira (libro-geometria.mjs) y, a lo sumo, un par de libros
// por estancia. El tope corta en seco si alguna vez se desboca la fusión de
// rectángulos, y se prefiere quedarse corta a hundir el fotograma: una página es
// adorno de un libro que ya es adorno de una sala.
//
// SIN COLOR PROPIO (frontera #351): todo de `PAGINA` en `paleta.mjs`, como el
// cuadro toma `CUADRO` y la piel toma `MURAL`.
//
// Puro: ni Foundry, ni DOM, ni red, ni reloj. Se prueba desde Node.

import { chapasDeRejilla } from "./nave-mural-pixel.mjs";
import { PAGINA } from "./paleta.mjs";

/** La celda de la página es el mando de escala y va en UN solo sitio. */
export const CELDA_PAGINA = 0.01; // 1 cm: cien celdas por metro.
export const ANCHO_PAGINA = 0.15; // m (A5 de altura a lo ancho de la hoja).
export const ALTO_PAGINA = 0.21; // m
export const COLUMNAS_PAGINA = Math.round(ANCHO_PAGINA / CELDA_PAGINA); // 15
export const FILAS_PAGINA = Math.round(ALTO_PAGINA / CELDA_PAGINA); // 21

/** Grosor del bloque de texto sugerido, en celdas (la mancha, no una línea). */
const BLOQUE = 2;
/** Margen de la página, en celdas. */
const MARCO = 1;

/**
 * Tope duro de rectángulos por página. Muy por debajo del muro (420) y del
 * suelo (260): la página es pequeña y se repite pocas veces. Se valida al
 * importar, no al usar —igual que `TOPE_OBJETO`— para que un regreso de la
 * fusión no pase desapercibido.
 */
export const TOPE_PAGINA = 60;

/** PRNG determinista y sin dependencias: la misma semilla da la misma página. */
function lcg(semilla) {
  let estado = (semilla >>> 0) || 1;
  return () => {
    estado = (estado * 1664525 + 1013904223) >>> 0;
    return estado / 4294967296;
  };
}

/**
 * La página en coordenadas de rejilla, sin geometría: para cada celda `(u, v)`
 * qué color le toca, o `null` si ahí se ve el muro pelado (el papel es la
 * propia página, así que casi todo se rellena). Fila 0 = la del borde inferior.
 *
 * MANCHA, NO LETRA. Lo que se dibuja es composición: un bloque de texto sugerido
 * (bandas horizontales contiguas del mismo color, que `fundirRectangulos` funde
 * en muy pocos rectángulos), una cabecera más clara arriba y un margen. Ninguna
 * celda forma una palabra: a la distancia de lectura de una hoja lo que hay es
 * «una página impresa», no «un párrafo que dice X».
 *
 * @param {number} semilla
 * @returns {(string|null)[][]} `[fila][columna]`
 */
export function rejillaPagina(semilla) {
  const azar = lcg(semilla);
  const rejilla = Array.from({ length: FILAS_PAGINA }, () =>
    new Array(COLUMNAS_PAGINA).fill(PAGINA.papel),
  );

  // Margen: el borde se queda como papel, para que la mancha no llegue al canto.
  // (Ya está en PAGINA.papel; aquí solo se marca el interior dibujable.)

  // Cabecera: banda superior más clara, un título sugerido sin ser texto.
  const filaCabecera = MARCO;
  const altoCabecera = 2;
  for (let v = filaCabecera; v < filaCabecera + altoCabecera && v < FILAS_PAGINA - MARCO; v++) {
    for (let u = MARCO; u < COLUMNAS_PAGINA - MARCO; u++) rejilla[v][u] = PAGINA.cabecera;
  }

  // Cuerpo: bloques de texto sugeridos, separados por respira (papel). Cada
  // bloque es una banda contigua del color de tinta, y el número de bloques y
  // su altura salen de la semilla para que dos páginas no sean idénticas sin
  // caer en ruido (pocas bandas = pocos rectángulos fundidos = pocas caras).
  const vCuerpo0 = filaCabecera + altoCabecera + 1;
  const vCuerpo1 = FILAS_PAGINA - MARCO;
  let v = vCuerpo0;
  while (v < vCuerpo1) {
    const altoBloque = BLOQUE + Math.floor(azar() * 2); // 2 o 3 celdas
    if (v + altoBloque > vCuerpo1) break;
    // La banda no llega a los márgenes laterales: eso es el «texto no toca el
    // canto» de una página de verdad, y además deja el papel como respira.
    for (let vv = v; vv < v + altoBloque; vv++) {
      for (let u = MARCO + 1; u < COLUMNAS_PAGINA - MARCO - 1; u++) rejilla[vv][u] = PAGINA.tinta;
    }
    // Respira de una celda antes del siguiente bloque (papel, ya está).
    v += altoBloque + 1;
  }

  return rejilla;
}

/**
 * Une las mallas de `chapasDeRejilla` en una sola, para que la página sea una
 * malla registrable (igual que `fusionarMallas` en nave-cuadro.mjs).
 * @param {{malla:{vertices:number[][],caras:number[][]}, color:string}[]} piezas
 * @returns {{vertices:number[][], caras:number[][]}}
 */
function fusionarMallas(piezas) {
  const vertices = [];
  const caras = [];
  for (const { malla } of piezas) {
    const desde = vertices.length;
    for (const vertice of malla.vertices) vertices.push(vertice);
    for (const cara of malla.caras) caras.push(cara.map((i) => desde + i));
  }
  return { vertices, caras };
}

/**
 * Malla local de la página (centrada en el origen, sobre el plano x = 0,
 * mirando a +x): es lo que compondrá `libro-catalogo.mjs` con `libroGeometria`.
 *
 * Devuelve una sola malla ( una pieza por color de material, fundidas) para que
 * la página sea ligera de componer: la hoja que gira ya paga por estar en
 * sesgo (#510), y apilar llamadas a `componerEscena` por cada color empeora el
 * peaje que ya denunciaba `chapasDeRejilla`.
 *
 * @param {number} semilla
 * @returns {{vertices:number[][], caras:number[][]}}
 */
export function mallaPagina(semilla) {
  const rejilla = rejillaPagina(semilla);
  const caraLocal = { eje: "z", plano: 0, sentido: 1, u0: -ANCHO_PAGINA / 2, largo: ANCHO_PAGINA };
  const piezas = chapasDeRejilla(caraLocal, rejilla, {
    celda: CELDA_PAGINA,
    base: -ALTO_PAGINA / 2,
    saliente: 0,
    tope: TOPE_PAGINA,
  });
  return fusionarMallas(piezas);
}

/**
 * Pinta la página ya colocada sobre una cara de la hoja: reusa `chapasDeRejilla`
 * sobre la cara de la hoja que gira (de `libroGeometria`), adelantada
 * `SALIENTE_PAGINA` para quedar por delante de la hoja.
 *
 * @param {number} semilla
 * @param {{eje:"x"|"z", plano:number, sentido:1|-1, u0:number, largo:number}} cara
 * @returns {{malla:{vertices:number[][],caras:number[][]}, color:string}[]}
 */
export function colocarPagina(semilla, cara) {
  const rejilla = rejillaPagina(semilla);
  return chapasDeRejilla(cara, rejilla, {
    celda: CELDA_PAGINA,
    base: -ALTO_PAGINA / 2,
    saliente: SALIENTE_PAGINA,
    tope: TOPE_PAGINA,
  });
}

/** Cuánto se adelanta la página respecto a la hoja (evita solaparse en z). */
const SALIENTE_PAGINA = 0.005;

/** Validación del tope al importar: si la rejilla de una página típica produce
 *  más rectángulos que el tope, el módulo no debería cargar — se prefiere
 *  quedarse corto. Es la misma disciplina que `TOPE_OBJETO`. */
if (mallaPagina(1).caras.length > TOPE_PAGINA) {
  throw new Error(
    `libro-pagina.mjs: la página produce más caras (${mallaPagina(1).caras.length}) ` +
      `que TOPE_PAGINA (${TOPE_PAGINA}); bajar la densidad o subir el tope antes de usarla.`,
  );
}
