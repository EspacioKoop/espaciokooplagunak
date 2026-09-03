// La cantina, construida con la MISMA fábrica que el resto de la nave (#540 QA).
//
// Era la única de las catorce estancias que no usaba `crearSalaCaja`, y de ahí
// salían todos los fallos que el QA repitió tres veces:
//
//   - **«una puerta extraña que no da a ninguna parte»**: la puerta era una hoja
//     pintada a mano sobre un muro macizo, sin hueco real, y su rect disparador
//     estaba escrito aparte y desalineado casi un metro.
//   - **«nada que ver tras la ventana»**: literal, no había ventana. La cantina
//     no pintaba cielo, así que lo que parecía una era un marco de televisión o
//     un panel oscuro.
//   - **«un vacío absurdo frente a la pared»**: la colisión y el dibujo salían de
//     dos sitios distintos y no coincidían, así que había suelo visible por el
//     que no se podía andar.
//   - la **escala**: el suelo está en y=−1.90 y la cámara se ponía a 1.45
//     ABSOLUTO, o sea los ojos a 3.35 m del suelo — más del doble que en
//     cualquier otra sala. Una sala vista desde tres metros y medio de altura se
//     lee enorme y vacía por muchos muebles que tenga.
//
// Los cuatro tienen la misma causa: ser un caso especial. Al pasar por la
// fábrica, la colisión y el dibujo salen de la MISMA declaración, los huecos de
// puerta y ventana los abre quien pinta los muros, y la altura de los ojos es la
// de la nave. Nada de esto se puede volver a desalinear a mano.
//
// Lo que la cantina conserva es lo que la hace ella: sus 126 muebles hechos a
// mano (#423), que entran como `mobiliario` — la fábrica ya acepta piezas con la
// misma forma `{centro, medidas, color, colision}` que ya tenían.
//
// Sustituye a `cantina-andar.mjs` y `cantina-planta.mjs`, retirados con él: el
// primero era el render a mano y el segundo la traducción de coordenadas que solo
// existía para mantener a raya esos dos sistemas. Con una única declaración ya no
// hay dos sistemas que traducir.
//
// Puro: compone datos y devuelve `{planta, componer}`.

import { crearSalaCaja } from "./nave-sala-caja.mjs";
import { MUEBLES, PUERTA_CANTINA_HACIA_VESTIBULO } from "./cantina-escena.mjs";
import { CANTINA, SECCION } from "./paleta.mjs";

/**
 * Medidas de la sala, tomadas de las caras interiores REALES de los muros que
 * declara `cantina-escena.mjs` (`paredIzq`/`paredDer` en ±5.0, `paredEntrada` en
 * z=−2.35, y los tramos laterales hasta z=9.5).
 */
export const ANCHO = 10.0;
export const PROFUNDIDAD = 11.85;

/**
 * Traslación de coordenadas nativas de la cantina a locales de la fábrica, que
 * mide desde (0,0) con el suelo en y=0.
 *
 * `DY` es la corrección de escala: el suelo nativo está en −1.90 (donde apoyan la
 * barra y los taburetes), así que subirlo a 0 pone los ojos a 1.45 DEL SUELO,
 * como en el resto de la nave, en vez de a 3.35.
 */
const DX = 5.0;
const DY = 1.9;
const DZ = 2.35;

/**
 * Altura, en locales de la fábrica (suelo = 0), a partir de la cual una pieza se
 * pasa por DEBAJO en vez de estorbar.
 *
 * La fábrica deriva la colisión de la huella X/Z de cada pieza sin mirar su
 * altura, así que sin esto las botellas de los estantes altos bloquean el paso
 * desde el techo: la cantina bajaba al 44% andable. Altura de pecho, no de ojos:
 * se agacha la cabeza, no el tronco.
 */
const UMBRAL_AGACHARSE = 1.15;
/** Por debajo de esto se pisa: una tarima o un rodapié no son un obstáculo. */
const UMBRAL_TROPIEZO = 0.35;

/** ¿Estorba de verdad esta pieza, o se pasa por encima o por debajo? */
function estorba(pieza) {
  if (pieza.colision === false) return false;
  const base = pieza.centro[1] + DY - pieza.medidas[1] / 2;
  const alto = pieza.centro[1] + DY + pieza.medidas[1] / 2;
  if (alto < UMBRAL_TROPIEZO) return false;
  if (base > UMBRAL_AGACHARSE) return false;
  return true;
}

/** Piezas que la fábrica ya dibuja: el límite de la sala es suyo, no del mobiliario. */
function esFrontera(nombre) {
  return /^(pared|dintel|muro|suelo|techo|hoja)/i.test(nombre ?? "");
}

/** Los muebles, trasladados al sistema de la fábrica. */
function mobiliario() {
  return MUEBLES.filter((pieza) => !esFrontera(pieza.nombre)).map((pieza) => ({
    centro: [pieza.centro[0] + DX, pieza.centro[1] + DY, pieza.centro[2] + DZ],
    medidas: pieza.medidas,
    color: pieza.color,
    // La fábrica no mira la altura al derivar colisión, así que la decisión se
    // toma aquí: se DIBUJA todo, pero solo estorba lo que ocupa el tramo por el
    // que pasa un cuerpo.
    colision: estorba(pieza),
  }));
}

/** Rect de un rect nativo trasladado al sistema de la fábrica. */
function aLocal(rect) {
  return { x: rect.x + DX, z: rect.z + DZ, ancho: rect.ancho, profundidad: rect.profundidad };
}

/**
 * La salida de la cantina, en el muro SUR y centrada.
 *
 * Estaba en el muro oeste, que es donde la declaraba la escena original — y ese
 * muro está OCUPADO ENTERO por muebles a altura de puerta. Una puerta detrás de
 * una estantería no es una puerta: es lo que el QA describió como que no tiene
 * sentido que esté ahí. Barriendo los cuatro muros, el sur es el único con
 * espacio de sobra; el norte lo ocupa la entrada y el este la barra.
 *
 * Va centrada y no en una esquina porque es la ÚNICA salida de la sala: lo
 * primero que hay que encontrar al querer irse.
 */
const ANCHO_PUERTA_CANTINA = 2.4;
export const PUERTA_SALIDA = Object.freeze({
  x: (ANCHO - ANCHO_PUERTA_CANTINA) / 2,
  z: PROFUNDIDAD - 1.2,
  ancho: ANCHO_PUERTA_CANTINA,
  profundidad: 1.2,
});

/** Nombre anterior, conservado para no romper a quien lo importe. */
export const PUERTA_OESTE = PUERTA_SALIDA;

/**
 * La puerta a la terraza (#579), en el muro OESTE y al fondo.
 *
 * ELEGIDA POR DONDE SE PUEDE ANDAR, no por donde el muro está libre, y la
 * diferencia resultó ser todo. Barriendo los muebles a altura de hueco, el muro
 * oeste tiene sitio de sobra entre z=0 y z=2,5 — y ahí la puerta era inútil:
 * los 126 muebles de la sala parten su suelo en zonas incomunicadas, y desde la
 * entrada NO SE LLEGA a ese tramo. Lo cazó la prueba de alcanzabilidad, que ya
 * existía por el mismo susto de #423.
 *
 * Inundando la sala desde su entrada, lo andable es una franja a lo largo del
 * muro sur, entre z≈9,8 y z≈11,3. La puerta va en el trozo de muro oeste que da
 * a esa franja: es el único sitio donde una puerta es una puerta y no un dibujo
 * de una puerta.
 *
 * Sale al costado de la cantina, que es casco al descubierto: exactamente donde
 * puede colgar una terraza sin inventarse geografía de la nave.
 */
export const PUERTA_TERRAZA = Object.freeze({
  x: 0,
  z: 9.9,
  ancho: 1.0,
  profundidad: 1.4,
});

/**
 * Ventanales al espacio, en el muro del FONDO (sur).
 *
 * La primera versión los puso en el muro este, el más largo, y el QA no vio nada:
 * ese muro es justo el ocupado. Barriendo los 126 muebles a la altura del hueco
 * (1.14–2.4 m), `mamparoDer`, los nervios, un estante y sus botellas quedaban
 * delante — un ventanal detrás de una estantería es un ventanal que no existe.
 * De los cuatro muros, el sur es el ÚNICO con tramos despejados; el norte lo
 * ocupa la entrada y el oeste la puerta.
 *
 * Comparten muro con la puerta, que va centrada: un ventanal a cada lado. Por eso
 * miden 3.0 y no 3.6 — con la puerta en medio, tres huecos de 3.6 no caben en
 * diez metros.
 */
const ANCHO_VENTANAL = 3.0;
export const VENTANAS = Object.freeze([
  { rect: { x: 0.6, z: PROFUNDIDAD - 0.4, ancho: ANCHO_VENTANAL, profundidad: 0.4 } },
  { rect: { x: 6.9, z: PROFUNDIDAD - 0.4, ancho: ANCHO_VENTANAL, profundidad: 0.4 } },
]);

const SALA = crearSalaCaja({
  ancho: ANCHO,
  profundidad: PROFUNDIDAD,
  puertas: [
    { rect: PUERTA_SALIDA },
    // Turquesa de `SECCION.entrable` (#458 QA: «las puertas de la cantina no
    // tienen sentido»): esta es la que lleva a un destino OPCIONAL —la terraza,
    // no el resto de la nave— y ya es el mismo acento con el que la sección
    // marca «aquí SÍ se puede entrar».
    { rect: PUERTA_TERRAZA, colorMarco: SECCION.entrable },
  ],
  ventanas: VENTANAS,
  mobiliario: mobiliario(),
  // Los muros salen de la paleta de la CANTINA, no de la del casco: la sala
  // sigue siendo ella. Y el marco de ventana también, porque el de serie es
  // `SECCION.entrable` (#4ad9c4), un turquesa de señalización que sobre un muro
  // entero se lee como un error de pintado — QA: «lo del color es muy feo».
  // (`CANTINA.casco` no existe en la paleta: el `?? undefined` de antes caía al
  // valor de serie sin avisar, que es como llegó aquí el turquesa.)
  colorMuro: CANTINA.mamparo,
  colorColumna: CANTINA.nervio,
  colorMarcoVentana: CANTINA.nervio,
  semillaCielo: 20260808,
  // Sin piel de objetos (#550). La piel de serie es CHAPA REMACHADA, y aquí los
  // muebles son de madera: una barra de taberna con remaches de casco no es un
  // detalle de más, es un material equivocado. La sala se queda con la piel de
  // sus muros —que sí son casco— y sus 126 muebles siguen como estaban (#423).
  pielObjetos: false,
});

export const PLANTA_CANTINA_SALA = SALA.planta;
export const componerCantinaSala = SALA.componer;
