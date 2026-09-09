// Piel pixelart del suelo y del techo (#552, sobre #548/#550/#551).
//
// Las dos superficies que quedaban lisas, y no eran menores: al mirar las
// capturas de #551 con los muros ya trabajados, el suelo se comía un tercio del
// cuadro como un plano de un solo color. Es la superficie que dice que estás DE
// PIE en algún sitio, y estaba diciendo que estabas sobre una placa.
//
// UN PLANO HORIZONTAL NO ES UN MURO GIRADO, y por eso este módulo existe en vez
// de reusar `piezasMuralPixel`:
//
//   1. La rejilla es 2D de verdad. Un muro se recorre a lo largo y a lo alto,
//      pero un suelo tiene fondo: sus planchas son cuadradas y sus juntas van en
//      los dos sentidos.
//   2. El PRESUPUESTO es otro. Un muro puede quedar a la espalda; el suelo está
//      entero en cuadro en TODOS los fotogramas, así que cada polígono suyo se
//      paga siempre. Por eso su dibujo es deliberadamente más pobre que el de un
//      muro: planchas grandes, pocas juntas y un registro suelto. Que se vea
//      menos trabajado de cerca es el precio correcto.
//   3. La LUZ le da casi de frente (`LUZ` en `retro3d.mjs` apunta hacia abajo),
//      así que un bisel marcado no se leería como relieve sino como suciedad. El
//      suelo lleva juntas y apenas relieve; el techo, que recibe la luz de canto,
//      va casi todo en sombra y con menos cosas todavía.
//
// SIN NINGUNA SEÑAL EN EL SUELO. Ni líneas guía, ni flechas, ni bandas de
// dirección: es la regla de #526 en el sitio donde más fácil sería saltársela. Una
// marca en el suelo que parezca indicar por dónde ir afirma algo sobre la nave
// que nadie ha decidido, y quien la siga estará leyendo un dato inventado.
// Planchas, juntas y rejillas — cosas que son, no cosas que dicen.
//
// Puro, determinista y sin color propio (#351), como el resto de la piel.

import { MURAL } from "./paleta.mjs";
import { CELDA, SALIENTE, crearLienzo, fundirRectangulos, hundir } from "./nave-mural-pixel.mjs";
import { rngSemilla } from "./ventana-nave.mjs";

/**
 * Lado de una plancha de cubierta, en celdas: 24 x 0.1 = 2,4 m. Cuadrada, al
 * revés que las del muro (1,6 x 1,0): una plancha de tránsito se pisa desde
 * cualquier dirección y no tiene arriba ni abajo.
 *
 * Grande a propósito. Las salas de esta nave llegan a 22x22 m, y con planchas de
 * 1,2 m eso son trescientas: en el suelo, que está entero en cuadro siempre, la
 * cuenta de piezas la fija el tamaño de la sala más grande, no el gusto.
 */
const PLANCHA = 24;

/**
 * Tope de piezas del suelo y del techo. Más bajo que el de un muro (420) porque
 * estas dos superficies se pagan en todos los fotogramas.
 *
 * OJO con cómo se aplica: en un muro, pasarse del tope recorta los rasgos
 * anecdóticos y el muro sigue siendo un muro. En un SUELO, recortar por el final
 * de la lista deja media sala con juntas y la otra media lisa, que no es «menos
 * detalle» sino un fallo de dibujo — pasó, y se veía en la primera captura. Por
 * eso `piezasHorizontales` prefiere no pintar NADA a pintar la mitad.
 */
export const TOPE_HORIZONTAL = 260;

/**
 * El dibujo del suelo, en celdas. `[fila][columna]` con la fila recorriendo `z` y
 * la columna `x` — o sea, la planta vista desde arriba.
 */
export function rejillaSuelo(columnas, filas, semilla = 1) {
  const azar = rngSemilla(semilla >>> 0);
  const lienzo = crearLienzo(columnas, filas);
  const { linea, columna } = lienzo;

  // 1. Solo las JUNTAS, y en sombra. Es todo el dibujo del suelo, y las dos
  //    decisiones que hay aquí costaron sendos intentos fallidos:
  //
  //    - La junta va en `junta`, UN paso por encima de la losa y ni uno más. La
  //      losa de suelo (`SECCION.sala`) es el tono más oscuro de la sala, y el
  //      motor la deja casi tal cual —una cara que mira hacia arriba recibe la
  //      luz de lleno y `sombrear` no la toca—, así que por debajo de ella no
  //      hay dónde ir: una junta de suelo NO puede ser una sombra por mucho que
  //      lo sea en la realidad, tiene que ser una línea un punto más clara. Y
  //      solo un punto: con `sombra` o `medio` las juntas longitudinales
  //      convergen en perspectiva y el suelo se lee como el carril de una
  //      autopista. Se probaron los dos extremos antes de dar con este.
  //    - Se pintan las juntas y no las planchas. Rellenar cada plancha cuesta un
  //      rectángulo por plancha, y una sala grande de verdad —el reactor mide
  //      22x22 m— tiene trescientas: se comía el presupuesto entero y el tope la
  //      cortaba por la mitad, dejando el suelo pintado solo por un lado. Las
  //      juntas son una veintena de rectángulos largos, midan lo que midan.
  //    - UNA línea por junta, no dos. La segunda —el filo claro de la plancha
  //      siguiente— parecía barata y no lo es: cada línea horizontal la parten
  //      todas las verticales que la cruzan, así que el coste de una rejilla no
  //      crece con las líneas sino con su PRODUCTO. En la sala del reactor,
  //      pasar de dos líneas por junta a una baja de unos setecientos
  //      rectángulos a menos de doscientos. En un plano siempre visible, eso es
  //      la diferencia entre poder dibujarlo y no.
  for (let v = PLANCHA; v < filas; v += PLANCHA) linea(v, 0, columnas, MURAL.junta);
  for (let u = PLANCHA; u < columnas; u += PLANCHA) columna(u, 0, filas, MURAL.junta);

  // 3. Un registro de suelo por sala, si cabe: una rejilla de desagüe. UNO, no
  //    uno por plancha — en el suelo, repetir un motivo llamativo es lo que
  //    convierte una sala en un tablero de ajedrez.
  if (columnas > PLANCHA * 2 && filas > PLANCHA * 2) {
    const u0 = PLANCHA + Math.floor(azar() * (columnas - PLANCHA * 2 - 8));
    const v0 = PLANCHA + Math.floor(azar() * (filas - PLANCHA * 2 - 8));
    const dentro = hundir(lienzo, u0, v0, 8, 8);
    for (let k = 0; k + 1 < dentro.alto; k += 2) {
      linea(dentro.v0 + k, dentro.u0, dentro.ancho, MURAL.ventilacion);
    }
  }

  return lienzo.rejilla;
}

/**
 * El dibujo del techo. Vigas y poco más: se mira poco, recibe la luz de canto y
 * cada polígono suyo se paga igual que el del suelo.
 */
export function rejillaTecho(columnas, filas) {
  const lienzo = crearLienzo(columnas, filas);
  const { linea } = lienzo;
  // Vigas transversales cada 1,6 m — la misma cadencia que las planchas del muro,
  // porque son la misma estructura vista por arriba. Tres celdas: cuerpo en
  // sombra con un filo que coge algo de luz por un lado.
  for (let v = 8; v + 2 < filas; v += 16) {
    linea(v, 0, columnas, MURAL.sombra);
    linea(v + 1, 0, columnas, MURAL.junta);
    linea(v + 2, 0, columnas, MURAL.sombra);
  }
  return lienzo.rejilla;
}

/**
 * Una chapa sobre un plano HORIZONTAL. El equivalente de `chapaEnCara` para
 * suelo y techo: `u` recorre `x`, `w` recorre `z`, y la altura es constante.
 *
 * El sentido de giro sale de las caras «techo» y «suelo» de `caja` en
 * `nave-sala-caja.mjs`, igual que el de las verticales — y también aquí están
 * invertidas la una respecto a la otra.
 */
function chapaHorizontal(y, sentido, x0, x1, z0, z1) {
  const p = y + SALIENTE * sentido;
  const vertices =
    sentido > 0
      ? [
          [x0, p, z0],
          [x0, p, z1],
          [x1, p, z1],
          [x1, p, z0],
        ]
      : [
          [x0, p, z0],
          [x1, p, z0],
          [x1, p, z1],
          [x0, p, z1],
        ];
  return { vertices, caras: [[0, 1, 2, 3]] };
}

/**
 * Traduce una rejilla horizontal a piezas, agrupando por color en una malla
 * cada una — por lo mismo que `chapasDeRejilla` (el peaje de `componerEscena`
 * se paga por llamada, no por polígono).
 *
 * Exportado (a diferencia de `chapaHorizontal`, que sigue privado): es el
 * primitivo de "rejilla de color → piezas sobre un plano horizontal", y una
 * escena que quiera OTRO dibujo de suelo —mármol, una alfombra— no tiene que
 * reescribirlo, solo traer su propia función de rejilla. La misma razón por la
 * que `chapasDeRejilla` es público para los muros.
 */
export function piezasHorizontales(rejilla, { y, sentido, tope = TOPE_HORIZONTAL }) {
  const rectangulos = fundirRectangulos(rejilla);
  // Todo o nada: media sala con juntas y media lisa se lee como un fallo, no
  // como menos detalle. Si un día una sala no cabe, se sube el lado de la
  // plancha —que sigue siendo una medida honesta— y no se corta la lista.
  if (rectangulos.length > tope) return [];
  const porColor = new Map();
  for (const { v, u0, ancho, alto, color } of rectangulos) {
    const quad = chapaHorizontal(
      y,
      sentido,
      u0 * CELDA,
      (u0 + ancho) * CELDA,
      v * CELDA,
      (v + alto) * CELDA,
    );
    let malla = porColor.get(color);
    if (!malla) {
      malla = { vertices: [], caras: [] };
      porColor.set(color, malla);
    }
    const desde = malla.vertices.length;
    malla.vertices.push(...quad.vertices);
    malla.caras.push(quad.caras[0].map((i) => desde + i));
  }
  return [...porColor].map(([color, malla]) => ({ malla, color }));
}

/**
 * La piel del suelo de una sala de `ancho` x `profundidad` metros.
 *
 * @returns {{malla:object, color:string}[]}
 */
export function piezasPielSuelo({ ancho, profundidad, semilla = 1 }) {
  const columnas = Math.floor(ancho / CELDA);
  const filas = Math.floor(profundidad / CELDA);
  if (columnas < PLANCHA || filas < PLANCHA) return [];
  return piezasHorizontales(rejillaSuelo(columnas, filas, semilla), { y: 0, sentido: 1 });
}

/** La piel del techo, a `altura` metros. Mira hacia abajo. */
export function piezasPielTecho({ ancho, profundidad, altura }) {
  const columnas = Math.floor(ancho / CELDA);
  const filas = Math.floor(profundidad / CELDA);
  if (columnas < PLANCHA || filas < PLANCHA) return [];
  return piezasHorizontales(rejillaTecho(columnas, filas), { y: altura, sentido: -1 });
}
