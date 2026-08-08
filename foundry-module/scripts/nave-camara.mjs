// Punto de vista al andar por la nave: primera o tercera persona (QA 2026-08-08).
//
// Vive aparte de la fábrica de salas y del bucle de render porque es una decisión
// de CÁMARA, no de sala ni de fotograma: la misma regla vale para las catorce
// estancias, y así se prueba en Node sin lienzo. La fábrica la consume y el bucle
// solo transporta qué modo está activo.
//
// `yaw` 0 mira a +z, y el frente es (sen yaw, cos yaw) — la misma convención que
// `nave-movimiento.mjs`, de donde tiene que salir para que la cámara no mire a un
// sitio y el jugador ande hacia otro.
//
// Puro: solo aritmética. Ni Foundry, ni DOM, ni red.

/** Modos válidos. Un valor desconocido cae a primera persona, no explota. */
export const PRIMERA = "primera";
export const TERCERA = "tercera";

/** Altura de los ojos sobre el suelo, en primera persona. */
export const ALTURA_OJOS = 1.45;

/**
 * Cuánto se retira la cámara en tercera persona, y cuánto sube.
 *
 * La distancia es corta a propósito: las salas más pequeñas de la nave miden 11 m
 * de lado y una cámara a cuatro metros del cuerpo se mete en el muro de detrás
 * en cuanto te acercas a una pared. Con 2,2 m se ve el cuerpo entero sin que la
 * sala se convierta en un pasillo de paredes atravesadas.
 */
const RETIRO = 2.2;
const ELEVACION = 0.55;

/**
 * Posición de la cámara y si hay que dibujar el propio cuerpo.
 *
 * @param {{x:number, z:number, y?:number, yaw:number, modo?:string}} vista
 * @returns {{camara:number[], dibujarPropio:boolean}}
 *   `camara` es `[x, y, z]` en coordenadas de la sala; `dibujarPropio` es lo que
 *   distingue los dos modos de verdad — en primera persona el cuerpo no se pinta
 *   porque estarías dentro de tu propia cabeza.
 */
export function resolverCamara({ x, z, y = 0, yaw, modo = PRIMERA }) {
  const alturaOjos = ALTURA_OJOS + y;
  if (modo !== TERCERA) {
    return { camara: [x, alturaOjos, z], dibujarPropio: false };
  }
  // Detrás del jugador: el frente es (sen, cos), así que se retrocede restándolo.
  return {
    camara: [x - Math.sin(yaw) * RETIRO, alturaOjos + ELEVACION, z - Math.cos(yaw) * RETIRO],
    dibujarPropio: true,
  };
}

/** El siguiente modo al alternar. Solo hay dos, así que es un vaivén. */
export function alternarModo(modo) {
  return modo === TERCERA ? PRIMERA : TERCERA;
}
