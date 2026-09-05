// El suelo del pasillo de los recuerdos: mármol blanco con una alfombra negra
// bordada de cuervos por el centro.
//
// POR QUÉ NO ES `nave-piel-suelo.mjs` TAL CUAL. Esa piel es la de una cubierta
// de nave —planchas de tránsito, sin ninguna marca que pueda leerse como una
// indicación (#526)— y esto es al revés en un punto concreto: una alfombra de
// pasillo SÍ señala por dónde se anda, y eso no rompe la regla porque no MIENTE
// — el centro del pasillo es, de verdad, el único sitio por el que se puede
// caminar. Reutiliza de todos modos el primitivo de #552
// (`piezasHorizontales`, exportado desde `nave-piel-suelo.mjs`): una superficie
// horizontal se traduce a malla igual aquí que en la cubierta de la nave, y
// escribir una segunda función para eso sería la misma duplicación que
// `escena-primitivas.mjs` existe para evitar.
//
// EL CUERVO ES UN MOTIVO BORDADO, no una cartela ni un diagrama: se repite sin
// variación cada `PASO_CUERVO`, como el estampado de una alfombra de verdad, y
// no cuenta nada que no fuera ya cierto (que esto es un pasillo y hay que
// seguirlo). Sigue sin haber ninguna flecha ni línea guía añadida encima.
//
// Puro y sin color propio (#351): todo sale de `PASILLO` en `paleta.mjs`.

import { PASILLO } from "./paleta.mjs";
import { CELDA, crearLienzo } from "./nave-mural-pixel.mjs";
import { piezasHorizontales } from "./nave-piel-suelo.mjs";

/** Lado de una losa de mármol, en celdas. Más grande que la plancha de cubierta
 *  de la nave (24): un suelo de mármol se corta en losas grandes, no en chapa
 *  de tránsito. */
const LOSA = 32;

/** Ancho de la alfombra, en celdas. 2 m: pasan dos personas de frente sin pisar
 *  el mármol, y sobra medio metro de mármol visible a cada lado incluso en el
 *  pasillo más estrecho que se hace con esta función. */
const ANCHO_ALFOMBRA = 20;

/** Cada cuántas celdas se borda un cuervo por el centro de la alfombra. 3,2 m:
 *  se ve el siguiente antes de dejar atrás el anterior, pero no se amontonan. */
const PASO_CUERVO = 32;

/**
 * Un cuervo de perfil, alas plegadas, en `[fila][columna]` con fila 0 abajo —
 * la misma convención que `rejillaMuroMuseo`. Nueve celdas de ancho por cinco
 * de alto: cabe de sobra en los veinte de la alfombra y deja margen a los
 * lados en la propia alfombra más estrecha posible.
 */
const CUERVO = Object.freeze([
  [0, 1, 0, 0, 0, 0, 1, 0, 0],
  [0, 1, 1, 0, 0, 1, 1, 0, 0],
  [1, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 0, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 0, 1, 0, 0, 1, 0],
]);

/**
 * El dibujo del suelo, en celdas: `[fila][columna]`, fila 0 = la de la
 * entrada. `columnas` recorre `x` (el ancho del pasillo) y `filas` recorre `z`
 * (su largo) — la misma convención que `rejillaSuelo`.
 */
export function rejillaPasillo(columnas, filas) {
  const lienzo = crearLienzo(columnas, filas);
  const { rect, linea, columna, poner } = lienzo;

  rect(0, 0, columnas, filas, PASILLO.marmol);

  // Las losas de mármol, en las dos direcciones — un suelo de mármol se corta
  // en piezas grandes y se nota el corte, no es una lámina continua.
  for (let v = LOSA; v < filas; v += LOSA) linea(v, 0, columnas, PASILLO.marmolJunta);
  for (let u = LOSA; u < columnas; u += LOSA) columna(u, 0, filas, PASILLO.marmolJunta);

  // La alfombra, centrada en el ancho y de punta a punta del pasillo. Su orla
  // es un perfil de una celda a cada lado — sin ella la alfombra es un bloque
  // de color y no una pieza con borde tejido.
  const u0 = Math.floor((columnas - ANCHO_ALFOMBRA) / 2);
  if (u0 >= 0 && u0 + ANCHO_ALFOMBRA <= columnas) {
    columna(u0 - 1, 0, filas, PASILLO.alfombraOrla);
    columna(u0 + ANCHO_ALFOMBRA, 0, filas, PASILLO.alfombraOrla);
    rect(0, u0, ANCHO_ALFOMBRA, filas, PASILLO.alfombra);

    // El cuervo bordado, repetido sin variación por el centro de la alfombra.
    const uCuervo = u0 + Math.floor((ANCHO_ALFOMBRA - CUERVO[0].length) / 2);
    for (let v0 = Math.floor(PASO_CUERVO / 2); v0 + CUERVO.length <= filas; v0 += PASO_CUERVO) {
      for (let fila = 0; fila < CUERVO.length; fila += 1) {
        for (let col = 0; col < CUERVO[fila].length; col += 1) {
          if (CUERVO[fila][col]) poner(v0 + fila, uCuervo + col, PASILLO.cuervo);
        }
      }
    }
  }

  return lienzo.rejilla;
}

/**
 * La piel de suelo del pasillo, con la misma firma que `piezasPielSuelo`
 * (`{ancho, profundidad}` → piezas): así `crearSalaCaja` podría recibirla como
 * `piezasPielMuro` recibe `museo-mural.mjs`, el día que exponga el mismo punto
 * de extensión para el suelo.
 *
 * @returns {{malla:object, color:string}[]}
 */
export function piezasSueloPasillo({ ancho, profundidad }) {
  const columnas = Math.floor(ancho / CELDA);
  const filas = Math.floor(profundidad / CELDA);
  if (columnas < LOSA || filas < LOSA) return [];
  return piezasHorizontales(rejillaPasillo(columnas, filas), { y: 0, sentido: 1, tope: 4000 });
}
