// Salas de pruebas para el andar (#427): dos cajas vacías conectadas por una
// puerta, para verificar de punta a punta el motor de movimiento/colisión
// (`nave-movimiento.mjs`), el bucle de render (`nave-movimiento-lienzo.mjs`)
// y la costura entre estancias (`nave-estancias.mjs`) antes de decidir qué
// sala REAL de la nave se anda primero.
//
// A propósito NO son la cantina, ni ninguna sala de puesto (#508: esas viven
// en sus propios archivos, `nave-sala-*.mjs`, hechas con la misma fábrica que
// este archivo usa). `cantina-escena.mjs` tiene decenas de muebles sin
// colisión definida todavía, y adivinar aquí esa colisión sin que nadie la
// revise sería construir sobre una base sin verificar. Estas salas son
// honestas sobre lo que son: un banco de pruebas, con la MISMA geometría
// exacta en el render que en la colisión — la caja física ES el obstáculo
// visual, sin margen que ocultar entre las dos.
//
// La fábrica de sala-caja (muros, puertas, ventanas) vive en
// `nave-sala-caja.mjs`: este archivo solo declara las DOS salas de prueba y
// su puerta, no cómo se construye una caja.
//
// Puro: ni Foundry, ni DOM, ni <canvas>, ni reloj, ni Math.random().

import { crearCatalogoEstancias } from "./nave-estancias.mjs";
import { ALTURA_OJOS, crearSalaCaja } from "./nave-sala-caja.mjs";

export { ALTURA_OJOS };

/**
 * Rectángulos de puerta compartidos entre la malla de pared (en
 * `nave-sala-caja.mjs`) y los catálogos de estancias (abajo y en
 * `nave-catalogo-andar.mjs`, el disparador que se cruza): la misma
 * constante en los dos sitios es lo único que garantiza que el hueco
 * dibujado y la zona que de verdad teletransporta coincidan.
 */
export const PUERTA_A_HACIA_B = { x: 4, z: 8.8, ancho: 2, profundidad: 1.2 };
export const PUERTA_B_HACIA_A = { x: 2, z: 0, ancho: 2, profundidad: 1.2 };
/** En el muro oeste de la sala A: no la usa `CATALOGO_PRUEBA` (solo conecta
 *  A y B), pero sí `nave-catalogo-andar.mjs`, que añade la puerta a la
 *  cantina real sobre esta misma sala A. */
export const PUERTA_A_HACIA_CANTINA = { x: 0, z: 4, ancho: 1.2, profundidad: 2 };
/** En el muro norte de la sala A: la puerta hacia la primera sala de puesto
 *  real (#508, `nave-sala-ingenieria.mjs`), en un lado que hasta ahora no
 *  tenía ninguna puerta. */
export const PUERTA_A_HACIA_INGENIERIA = { x: 3, z: 0, ancho: 2, profundidad: 1.2 };
/** En el muro este de la sala A: la puerta hacia el pasillo del puente
 *  (#508, `nave-pasillo-puente.mjs`), el cuarto y último lado libre. */
export const PUERTA_A_HACIA_PASILLO = { x: 8.8, z: 4, ancho: 1.2, profundidad: 2 };

/** Sala A: la sala de pruebas original, con dos columnas para probar
 *  colisión y deslizamiento diagonal (ver los tests de `nave-movimiento.
 *  mjs`). Se conserva como export propio por compatibilidad con quien ya la
 *  usa fuera del catálogo. */
const SALA_A = crearSalaCaja({
  ancho: 10,
  profundidad: 10,
  columnas: [
    { x: 3, z: 3, ancho: 0.8, profundidad: 0.8 },
    { x: 6.2, z: 6.2, ancho: 0.8, profundidad: 0.8 },
  ],
  puertas: [
    { rect: PUERTA_A_HACIA_B },
    { rect: PUERTA_A_HACIA_CANTINA },
    { rect: PUERTA_A_HACIA_INGENIERIA },
    { rect: PUERTA_A_HACIA_PASILLO },
  ],
});
export const PLANTA_PRUEBA = SALA_A.planta;
export const componerSalaPrueba = SALA_A.componer;

/** Sala B: más pequeña y sin columnas — basta para demostrar que la costura
 *  entre estancias funciona con geometrías distintas de verdad, no con una
 *  copia de la misma sala. */
const SALA_B = crearSalaCaja({ ancho: 6, profundidad: 6, puertas: [{ rect: PUERTA_B_HACIA_A }] });
export const PLANTA_PRUEBA_B = SALA_B.planta;
export const componerSalaPruebaB = SALA_B.componer;

/**
 * Las dos salas de pruebas conectadas por una puerta en cada sentido, para
 * probar `nave-estancias.mjs` de punta a punta. La puerta de A hacia B está
 * en el muro de +z (el fondo de la sala, lejos de las columnas); la de B
 * hacia A, en su muro de -z, con el destino mirando HACIA la sala de la que
 * viene —cruzar una puerta y aparecer de espaldas a ella es lo que hace que
 * cruzarla otra vez de inmediato no se sienta un error.
 */
export const CATALOGO_PRUEBA = crearCatalogoEstancias({
  a: {
    planta: PLANTA_PRUEBA,
    componer: componerSalaPrueba,
    entrada: { x: 1.5, z: 1.5, yaw: 0 },
    puertas: [
      // Contra el propio muro de +z (la sala mide 10 de profundidad): el
      // rectángulo hace tope justo donde empieza el muro y se extiende hacia
      // dentro 1.2, para que el círculo de colisión lo toque bastante antes
      // de chocar con la pared — un rectángulo pegado al borde con el mismo
      // radio que el jugador dejaría una franja de un dedo donde ni se activa
      // la puerta ni se puede seguir avanzando.
      {
        rect: PUERTA_A_HACIA_B,
        destino: { estancia: "b", x: 3, z: 2, yaw: 0 },
      },
    ],
  },
  b: {
    planta: PLANTA_PRUEBA_B,
    componer: componerSalaPruebaB,
    puertas: [
      // Contra el muro de -z de esta sala (z = 0): misma lógica, hacia dentro.
      {
        rect: PUERTA_B_HACIA_A,
        // Aparece ANTES de la zona de la puerta de A (que empieza en z=8.8):
        // si cayera dentro, la propia llegada volvería a disparar el cruce.
        destino: { estancia: "a", x: 5, z: 8.3, yaw: Math.PI },
      },
    ],
  },
});
