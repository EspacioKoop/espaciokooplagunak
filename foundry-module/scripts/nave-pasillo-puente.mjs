// Pasillo del puente (#508): un único pasillo largo que reparte hacia las
// cinco salas de puesto del puente (mando, navegación, sensores,
// comunicaciones, armas) — ver `nave-salas-puente.mjs` para las salas en sí.
//
// UN PASILLO, NO CINCO PUERTAS SUELTAS DESDE "a". La sala de pruebas de #427
// ya tiene sus cuatro muros ocupados (b, cantina, ingeniería) y, aunque le
// sobrara sitio, colgar cinco salas directamente de un banco de pruebas haría
// que "a" dejara de ser un banco de pruebas y pasara a ser sin querer la
// geografía real de la nave. El pasillo es la pieza que sí es geografía real:
// una sola puerta lo conecta con "a", y de él cuelgan las cinco.
//
// LA LISTA `ESTACIONES` ES LA ÚNICA FUENTE DE LAS POSICIONES DE PUERTA. La
// reutiliza tanto este módulo (para abrir el hueco en el propio muro del
// pasillo) como `nave-salas-puente.mjs` (para saber a qué altura del pasillo
// aparece quien sale de su sala) y `nave-catalogo-andar.mjs` (para tejer las
// dos puntas de cada puerta). Que viva en un solo sitio es lo que evita que
// el hueco dibujado y la puerta que de verdad teletransporta se desincronicen
// entre archivos, el mismo motivo por el que `PUERTA_A_HACIA_B` es una
// constante compartida y no un número repetido dos veces.
//
// Puro: ni Foundry, ni DOM, ni reloj, ni Math.random().

import { SECCION } from "./paleta.mjs";
import { crearSalaCaja } from "./nave-sala-caja.mjs";

/** Una entrada por sala de puesto: `id` (el de `nave-salas-puente.mjs` y del
 *  catálogo de estancias) y `puesto` (el id de puesto de tripulación que
 *  ocupa esa sala, para cuando #509 conecte "llegar a la sala" con "abrir la
 *  consola"). `z` es dónde cae su puerta en el muro este del pasillo. */
export const ESTACIONES = Object.freeze([
  Object.freeze({ id: "mando", puesto: "captain", z: 6 }),
  Object.freeze({ id: "navegacion", puesto: "navigation", z: 10 }),
  Object.freeze({ id: "sensores", puesto: "sensors", z: 14 }),
  Object.freeze({ id: "comunicaciones", puesto: "communications", z: 18 }),
  Object.freeze({ id: "armas", puesto: "weapons", z: 22 }),
]);

const ANCHO = 4;
const PROFUNDIDAD = 28;

/** Ancho/profundidad del hueco de cada puerta, en el muro que toque. */
const ANCHO_PUERTA = 1.2;
const PROFUNDIDAD_PUERTA = 2;

/** Puerta del pasillo hacia la sala de pruebas "a" (#427), en su muro oeste:
 *  el otro extremo de `PUERTA_A_HACIA_PASILLO`. */
export const PUERTA_PASILLO_HACIA_A = { x: 0, z: 1, ancho: ANCHO_PUERTA, profundidad: PROFUNDIDAD_PUERTA };

/** La puerta del pasillo hacia la sala de una estación, en su muro este. */
export function puertaHaciaEstacion(estacion) {
  return { x: ANCHO - ANCHO_PUERTA, z: estacion.z, ancho: ANCHO_PUERTA, profundidad: PROFUNDIDAD_PUERTA };
}

/** Dónde aparece quien vuelve de una sala de estación al pasillo: pasado el
 *  hueco de SU puerta (para no reactivarla al llegar) y lejos del muro este,
 *  hacia el centro del pasillo. */
export function llegadaDesdeEstacion(estacion) {
  return { x: 2, z: estacion.z + PROFUNDIDAD_PUERTA + 1, yaw: -Math.PI / 2 };
}

/** Dónde aparece quien entra al pasillo desde "a": pasado el hueco de la
 *  puerta de vuelta (z:1..3) y antes de la primera puerta de estación
 *  (z:6..8). */
export const LLEGADA_DESDE_A = { x: 2, z: 4, yaw: 0 };

const SALA = crearSalaCaja({
  ancho: ANCHO,
  profundidad: PROFUNDIDAD,
  puertas: [{ rect: PUERTA_PASILLO_HACIA_A }, ...ESTACIONES.map((estacion) => ({ rect: puertaHaciaEstacion(estacion) }))],
  colorMuro: SECCION.mamparo,
});

export const PLANTA_PASILLO_PUENTE = SALA.planta;
export const componerPasilloPuente = SALA.componer;
