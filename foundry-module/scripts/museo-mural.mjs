// La piel de los muros del museo (#838): una pared de GALERÍA, no un mamparo.
//
// POR QUÉ NO VALE LA DE SERIE. `nave-mural-pixel.mjs` dibuja chapa de casco:
// planchas remachadas, escotillas, rejillas de ventilación, tendidos de cable.
// Es lo correcto en las trece salas del Phobos y es el material equivocado aquí,
// exactamente por el motivo que la sala ya escribió al apagar la piel de sus
// objetos (#550): un pedestal de museo remachado no es un detalle de más, es
// otro material. El argumento vale MÁS en los muros, porque un muro es la
// superficie contra la que se lee todo lo que cuelga de él.
//
// UNA PARED DE GALERÍA ES DELIBERADAMENTE POBRE, y esa es toda la idea. El
// mural de la nave presume de tres capas de lectura y de premiar que te
// acerques; aquí eso sería un error de diseño, no una virtud: cada greeble
// compite con la obra que tiene delante. Una sala de exposición se hace al
// revés — se quita hasta que solo queda la arquitectura, y lo único que reclama
// la mirada es lo colgado. De ahí que esto sea, medido, unas seis veces más
// barato que la piel de casco: no está simplificado por presupuesto, está
// vacío a propósito y el presupuesto es la consecuencia.
//
// LO QUE HAY, DE ABAJO ARRIBA. Cuatro piezas de arquitectura y ni una más:
//
//   - **rodapié**: donde se roza la pared al pasar. Es lo que impide que el
//     muro toque el suelo a pelo, el mismo papel que `zocalo` juega en el color
//     de la sala.
//   - **paño de yeso**: liso. Su única interrupción son las juntas verticales
//     entre paños, de UNA celda y un punto más oscuras — sombra, no línea
//     negra: una junta marcada convierte la pared en una rejilla.
//   - **riel de cuelgue**: la única pieza clara, a una sola altura en toda la
//     sala. No es adorno, es la explicación de por qué los cuadros cuelgan
//     donde cuelgan — un museo tiene riel, y sin él la altura de un cuadro es
//     una decisión sin causa visible.
//   - **cornisa**: dos celdas arriba, que cierran el paño contra el techo.
//
// LO QUE NO HAY: remaches, escotillas, rejillas, cables, tuberías, manchas
// sorteadas. Y NADA QUE SE PUEDA LEER, igual que en la nave (#526): aquí sería
// todavía peor, porque en una galería cualquier marca sobre la pared se lee
// como parte de la exposición.
//
// LA CELDA ES LA DE LA NAVE (`CELDA`, 10 cm) Y NO UNA PROPIA. Es la excepción
// que confirma la regla del cuadro: un lienzo baja a 1,25 cm porque es lo que
// más de cerca se mira y su detalle no cabía; una pared de galería no quiere
// MÁS detalle, quiere menos. Bajarle la celda sería pagar resolución para no
// dibujar nada, y romper de paso la regla de que dos superficies de la misma
// sala compartan tamaño de píxel — con tamaños distintos, la sala se lee como
// montada con piezas de tres maquetas.
//
// DETERMINISTA Y SIN SEMILLA. Al revés que el mural de la nave, que sortea sus
// greebles: aquí no hay nada que sortear. Una galería es obra de albañilería
// repetida, y una pared con las juntas en sitios aleatorios no parecería más
// natural, parecería mal construida.
//
// Puro: ni Foundry, ni DOM. Sin color propio (#351): todo sale de `MUSEO`.

import { MUSEO } from "./paleta.mjs";
import { CELDA, caraInterior, chapasDeRejilla, crearLienzo } from "./nave-mural-pixel.mjs";

/** Alto del rodapié, en celdas. 12 cm: un listón bajo, no un zócalo de medio metro. */
const RODAPIE_ALTO = 2;

/** A qué altura va el riel, en metros desde el suelo. 2,10 m es la altura de
 *  riel de una sala de exposición real: por encima de la cabeza y por encima
 *  del borde superior de un cuadro de 90 cm colgado a la altura de los ojos. */
const RIEL_ALTURA = 2.1;

/** Cuántas celdas mide el riel de alto. Dos, 20 cm: se ve desde el fondo de la
 *  sala sin convertirse en una viga. */
const RIEL_ALTO = 2;

/** Cada cuántas celdas cae una junta vertical. 24 x 0.1 = 2,4 m, que es el ancho
 *  de un tablero de yeso de verdad. No es un número decorativo: es la medida que
 *  hace que la pared se lea como construida y no como pintada. */
const JUNTA_CADA = 24;

/** Cuántas celdas ocupa la cornisa. */
const CORNISA_ALTO = 2;

/**
 * La pared de galería en coordenadas de rejilla.
 *
 * Se expone aparte de la geometría por el mismo motivo que `rejillaMural` y
 * `rejillaCuadro`: es LA decisión de dibujo, y es lo que se puede leer en una
 * prueba sin montar una escena.
 *
 * @param {number} columnas @param {number} filas
 * @returns {(string|null)[][]} `[fila][columna]`, fila 0 = la de abajo.
 */
export function rejillaMuroMuseo(columnas, filas) {
  const lienzo = crearLienzo(columnas, filas);
  const { rect, linea, columna } = lienzo;

  // El paño, entero. Todo lo demás se dibuja encima.
  rect(0, 0, columnas, filas, MUSEO.pano);

  // Las juntas entre tableros. Se saltan la primera columna a propósito: una
  // junta pegada a la esquina parece un fallo de encaje, no una junta.
  for (let u = JUNTA_CADA; u < columnas - 1; u += JUNTA_CADA) {
    columna(u, RODAPIE_ALTO, filas - RODAPIE_ALTO - CORNISA_ALTO, MUSEO.panoJunta);
  }

  // El rodapié, y su sombra justo encima: sin esa línea el rodapié es un cambio
  // de color y no un listón que sobresale.
  rect(0, 0, columnas, RODAPIE_ALTO, MUSEO.rodapie);
  linea(RODAPIE_ALTO, 0, columnas, MUSEO.panoJunta);

  // El riel de cuelgue. Va en `Math.round` de metros a celdas y no escrito como
  // número de fila: es la lección de #551 —lo que se mide en metros se convierte
  // aquí, o el día que cambie la celda el riel se va a la rodilla en silencio—.
  const vRiel = Math.round(RIEL_ALTURA / CELDA);
  if (vRiel + RIEL_ALTO < filas - CORNISA_ALTO) {
    rect(vRiel, 0, columnas, RIEL_ALTO, MUSEO.riel);
    // Su sombra por debajo, una sola celda. El riel coge la luz de arriba, así
    // que lo que tiene debajo es lo que queda a oscuras — mismo sentido que el
    // bisel de `panelBiselado`, sin copiar su vocabulario de chapa.
    linea(vRiel - 1, 0, columnas, MUSEO.panoJunta);
  }

  // La cornisa: el paño no muere contra el techo, se remata.
  rect(filas - CORNISA_ALTO, 0, columnas, CORNISA_ALTO, MUSEO.rodapie);
  linea(filas - CORNISA_ALTO - 1, 0, columnas, MUSEO.panoJunta);

  return lienzo.rejilla;
}

/**
 * La piel de un tramo de muro del museo, con la firma que `crearSalaCaja`
 * espera de una piel: la MISMA que `piezasMuralPixel`, para que la sala pueda
 * recibir una u otra sin saber cuál le han dado.
 *
 * `semilla` se acepta y se ignora, y eso es a propósito: la firma la fija quien
 * llama y aquí no hay nada que sortear. Quitarla del parámetro obligaría a la
 * sala a saber que esta piel es distinta, que es justo lo que no debe saber.
 *
 * @param {{rect:object, sala:{ancho:number, profundidad:number}, altura:number}} opciones
 * @returns {{malla:object, color:string}[]} vacío si el rectángulo no es un muro
 *   perimetral o si no cabe ni una celda.
 */
export function piezasMuroMuseo({ rect, sala, altura }) {
  const cara = caraInterior(rect, sala);
  if (!cara) return [];
  const columnas = Math.floor(cara.largo / CELDA);
  const filas = Math.floor(altura / CELDA);
  if (columnas < 1 || filas < 1) return [];
  return chapasDeRejilla(cara, rejillaMuroMuseo(columnas, filas));
}
