// Cuadros del museo (#836): pixelart `obra-propia` que cuelga de los muros
// laterales de la sala, con su cartela.
//
// No es un escaneo ni una copia: el módulo lo pinta. Por eso la naturaleza en el
// catálogo es `obra-propia` y la procedencia es `original` (sin fuente externa).
// El contenido es un paisaje abstracto —cielo, suelo, un disco, una montaña—
// que no se lee como instrumento: nada de mapas estelares, diagramas ni cartas
// de navegación. Está ahí para que el muro lateral no quede desnudo.
//
// SE PINTA CON EL MISMO PRIMITIVO QUE LA PIEL DE LOS MUROS: `chapasDeRejilla`
// sobre la `caraInterior` del muro, solo que con su propia celda. Un cuadro es,
// pues, una malla más (marco + plano del lienzo) que entra en `MALLAS_MUSEO` y
// deja el validador del catálogo intacto, igual que las estatuas.

import { chapasDeRejilla, SALIENTE } from "./nave-mural-pixel.mjs";
import { CUADRO } from "./paleta.mjs";

/** La celda del lienzo es el mando de escala del cuadro y va en UN solo sitio. */
export const CELDA_LIENZO = 0.025; // 2,5 cm: veinte celdas por metro.
export const ANCHO_LIENZO = 1.2; // m
export const ALTO_LIENZO = 0.8; // m
export const COLUMNAS_LIENZO = Math.round(ANCHO_LIENZO / CELDA_LIENZO); // 48
export const FILAS_LIENZO = Math.round(ALTO_LIENZO / CELDA_LIENZO); // 32

/** Grosor del bastidor en celdas. */
const MARCO = 1;

/** Cuánto se adelanta el cuadro respecto a la piel del muro (evita solaparse). */
const SALIENTE_CUADRO = 0.02;

/**
 * PRNG determinista y sin dependencias: el cuadro de una semilla siempre es el
 * mismo, para que el museo no cambie de cuadro al recargar.
 * @param {number} semilla
 * @returns {() => number} real en [0, 1)
 */
function lcg(semilla) {
  let estado = (semilla >>> 0) || 1;
  return () => {
    estado = (estado * 1664525 + 1013904223) >>> 0;
    return estado / 4294967296;
  };
}

/**
 * El cuadro en coordenadas de rejilla, sin geometría: para cada celda `(u, v)`
 * qué color le toca, o `null` si ahí se ve el muro pelado. Fila 0 = la del suelo.
 *
 * Baja entropía a propósito: pocas regiones de color contiguas para que
 * `fundirRectangulos` entregue pocos rectángulos y el cuadro cueste pocos
 * polígonos, sin tocar la celda de 2,5 cm.
 *
 * @param {number} semilla
 * @returns {(string|null)[][]} `[fila][columna]`
 */
export function rejillaCuadro(semilla) {
  const azar = lcg(semilla);
  const rejilla = Array.from({ length: FILAS_LIENZO }, () => new Array(COLUMNAS_LIENZO).fill(null));

  // Parámetros deterministas del paisaje: misma semilla, mismo cuadro.
  const horizonte = Math.round(FILAS_LIENZO * 0.52);
  const solCol = Math.round(COLUMNAS_LIENZO * (0.55 + azar() * 0.2));
  const solFila = Math.round(horizonte + FILAS_LIENZO * 0.28);
  const radioSol = 3;
  const picoCol = Math.round(COLUMNAS_LIENZO * (0.35 + azar() * 0.2));
  const altoMonte = Math.round(FILAS_LIENZO * 0.3);
  const anchoMonte = Math.round(COLUMNAS_LIENZO * 0.3);

  for (let v = 0; v < FILAS_LIENZO; v++) {
    for (let u = 0; u < COLUMNAS_LIENZO; u++) {
      let color;
      if (v < horizonte) {
        // Cielo: banda alta más clara que la baja, para que el cielo no sea un
        // bloque plano.
        color = v > Math.round(horizonte * 0.6) ? CUADRO.cieloAlto : CUADRO.cielo;
      } else {
        color = CUADRO.suelo;
      }

      // Montaña: triángulo simétrico, ancho en la base (horizonte) y afilado en
      // la cima. Mitad iluminada y mitad en sombra para que se lea como volumen.
      const alturaMax = horizonte + altoMonte;
      if (v >= horizonte && v <= alturaMax) {
        const t = (v - horizonte) / altoMonte; // 0 en la base, 1 en la cima
        const anchoEnFila = Math.round(anchoMonte * (1 - t));
        if (Math.abs(u - picoCol) <= anchoEnFila) {
          color = u <= picoCol ? CUADRO.montanaClaro : CUADRO.montana;
        }
      }

      // Disco solar en el cielo.
      const du = u - solCol;
      const dv = v - solFila;
      if (du * du + dv * dv <= radioSol * radioSol) color = CUADRO.sol;

      rejilla[v][u] = color;
    }
  }

  // Bastidor: borde de `MARCO` celdas que enmarca el lienzo.
  for (let v = 0; v < FILAS_LIENZO; v++) {
    for (let u = 0; u < COLUMNAS_LIENZO; u++) {
      if (u < MARCO || u >= COLUMNAS_LIENZO - MARCO || v < MARCO || v >= FILAS_LIENZO - MARCO) {
        rejilla[v][u] = CUADRO.marco;
      }
    }
  }

  return rejilla;
}

/**
 * Une las mallas de `chapasDeRejilla` en una sola, para que el cuadro sea una
 * malla registrable en `MALLAS_MUSEO`.
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
 * Malla local del cuadro (centrada en el origen, sobre el plano x = 0, mirando a
 * +x): es lo que se registra en `MALLAS_MUSEO` para que el validador del
 * catálogo compruebe que la pieza tiene geometría. La colocación real la hace
 * `colocarCuadro`, que pinta el cuadro ya orientado sobre el muro.
 *
 * @param {number} semilla
 * @returns {{vertices:number[][], caras:number[][]}}
 */
export function mallaCuadro(semilla) {
  const rejilla = rejillaCuadro(semilla);
  const caraLocal = { eje: "z", plano: 0, sentido: 1, u0: -ANCHO_LIENZO / 2, largo: ANCHO_LIENZO };
  const piezas = chapasDeRejilla(caraLocal, rejilla, {
    celda: CELDA_LIENZO,
    base: -ALTO_LIENZO / 2,
    saliente: 0,
  });
  return fusionarMallas(piezas);
}

/**
 * Pinta el cuadro ya colocado sobre un muro: reusa `chapasDeRejilla` sobre la
 * cara del muro (el mismo primitivo que la piel), adelantado `SALIENTE_CUADRO`
 * para quedar por delante de aquella. Devuelve una pieza por color de material,
 * lista para entrar en el `mobiliario` de `crearSalaCaja`.
 *
 * @param {number} semilla
 * @param {{eje:"x"|"z", plano:number, sentido:1|-1, u0:number, largo:number}} cara
 *   cara interior del muro lateral (de `caraInterior` o construida a mano).
 * @param {number} uCentro coordenada central del cuadro a lo largo del muro (z en
 *   un muro lateral).
 * @param {number} base altura del borde inferior del cuadro.
 * @returns {{malla:{vertices:number[][],caras:number[][]}, color:string}[]}
 */
export function colocarCuadro(semilla, cara, uCentro, base) {
  const rejilla = rejillaCuadro(semilla);
  // Desplaza la rejilla para que quede centrada en `uCentro` a lo largo del muro.
  const caraPintura = { ...cara, u0: uCentro - ANCHO_LIENZO / 2 };
  return chapasDeRejilla(caraPintura, rejilla, {
    celda: CELDA_LIENZO,
    base,
    saliente: SALIENTE + SALIENTE_CUADRO,
  });
}
