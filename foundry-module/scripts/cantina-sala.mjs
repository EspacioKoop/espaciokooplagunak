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
import { CANTINA } from "./paleta.mjs";

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
 * La puerta oeste, la misma que ya declaraba la escena. Ahora es un hueco de
 * verdad en el muro, con su hoja corredera, porque la abre quien pinta el muro.
 */
export const PUERTA_OESTE = (() => {
  const local = aLocal(PUERTA_CANTINA_HACIA_VESTIBULO.base);
  // La hoja vive en el GROSOR del muro (x local negativo), que es justo donde el
  // jugador no puede estar: un rect que solo la cubriera no se dispararía nunca.
  // Se ancla al muro y se ensancha hacia dentro, como en las salas de la rejilla.
  return { x: 0, z: local.z, ancho: 1.2, profundidad: local.profundidad };
})();

/**
 * Ventanales al espacio.
 *
 * En el muro ESTE, el largo y sin puerta, y en el del fondo. Es lo que faltaba:
 * la cantina de una nave que nunca enseñaba el espacio era la sala menos
 * espacial de la nave. Dos huecos anchos en vez de uno estrecho porque este muro
 * mide casi doce metros y una tronera se pierde.
 */
const ANCHO_VENTANAL = 3.6;
export const VENTANAS = Object.freeze([
  { rect: { x: ANCHO - 0.4, z: 2.2, ancho: 0.4, profundidad: ANCHO_VENTANAL } },
  { rect: { x: ANCHO - 0.4, z: 7.2, ancho: 0.4, profundidad: ANCHO_VENTANAL } },
]);

const SALA = crearSalaCaja({
  ancho: ANCHO,
  profundidad: PROFUNDIDAD,
  puertas: [{ rect: PUERTA_OESTE }],
  ventanas: VENTANAS,
  mobiliario: mobiliario(),
  // Los muros y el marco salen de la paleta de la cantina y no de la del casco:
  // la sala sigue siendo ella, no una sala de máquinas con sillas.
  colorMuro: CANTINA.casco ?? undefined,
  colorColumna: CANTINA.mamparo ?? undefined,
  semillaCielo: 20260808,
});

export const PLANTA_CANTINA_SALA = SALA.planta;
export const componerCantinaSala = SALA.componer;
