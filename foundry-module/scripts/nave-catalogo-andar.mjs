// El catálogo de estancias que usa la ventana de andar (#427): las dos salas
// de pruebas del motor, la primera sala REAL (la cantina) y la primera sala
// de PUESTO real, ingeniería (#508).
//
// LA PUERTA ENTRE "a" Y "cantina" ES LA PRUEBA, no la geografía definitiva de
// la nave. Demuestra que el mecanismo de #427 (cambiar de estancia sin
// reiniciar el bucle) funciona exactamente igual con una sala real —con su
// propio módulo, su propia geometría, sus propios cien muebles— que con una
// sala de pruebas inventada. La puerta a "ingenieria" sigue la misma idea: un
// lado de "a" que hasta ahora no tenía puerta se abre hacia la sala nueva. Qué
// sala lleva a qué otra en la nave de verdad, y quién tiene autoridad para
// declarar una estancia nueva, siguen siendo decisiones sin tomar (ver la
// discusión del PR de #427): esto es la comprobación técnica de que la
// costura aguanta y el primer trazo real de planta, no la respuesta final a
// esas preguntas.
//
// Vive en su propio archivo y no dentro de `nave-movimiento-sala-prueba.mjs`
// ni de `cantina-planta.mjs`/`cantina-andar.mjs`/`nave-sala-ingenieria.mjs` a
// propósito: cada uno de esos módulos se queda hablando solo de lo suyo (el
// banco de pruebas, la colisión de la cantina, su render, la sala de
// ingeniería), y coserlos es la única responsabilidad de este archivo — la
// misma separación que ya seguía el resto del módulo entre "aporta la
// estancia" y "decide qué estancia toca ahora" (`nave-estancias.mjs`).
//
// Puro: solo compone objetos y funciones que ya son puras.

import { crearCatalogoEstancias } from "./nave-estancias.mjs";
import {
  PLANTA_PRUEBA,
  PLANTA_PRUEBA_B,
  componerSalaPrueba,
  componerSalaPruebaB,
  PUERTA_A_HACIA_B,
  PUERTA_B_HACIA_A,
  PUERTA_A_HACIA_CANTINA,
  PUERTA_A_HACIA_INGENIERIA,
} from "./nave-movimiento-sala-prueba.mjs";
import { PLANTA_CANTINA } from "./cantina-planta.mjs";
import { componerCantinaAndar } from "./cantina-andar.mjs";
import { PLANTA_INGENIERIA, componerIngenieria, PUERTA_INGENIERIA_HACIA_A } from "./nave-sala-ingenieria.mjs";

export const CATALOGO_ANDAR = crearCatalogoEstancias({
  a: {
    planta: PLANTA_PRUEBA,
    componer: componerSalaPrueba,
    entrada: { x: 1.5, z: 1.5, yaw: 0 },
    puertas: [
      // La puerta original de la costura de pruebas (a <-> b): ver
      // `nave-movimiento-sala-prueba.mjs` para el porqué de estos números.
      {
        rect: PUERTA_A_HACIA_B,
        destino: { estancia: "b", x: 3, z: 2, yaw: 0 },
      },
      // La puerta nueva hacia la cantina real, en el muro oeste (x=0) de la
      // sala de pruebas: un lado que hasta ahora no tenía ninguna puerta.
      {
        rect: PUERTA_A_HACIA_CANTINA,
        // Bastante dentro (x=2.5) de la propia puerta de vuelta de la
        // cantina (que ocupa x:0..1.2) para no reactivarla al llegar.
        destino: { estancia: "cantina", x: 2.5, z: 4.5, yaw: 0 },
      },
      // La puerta hacia ingeniería (#508), en el muro norte (z=0) de la sala
      // de pruebas: el tercer lado que se abre desde "a", cada uno hacia una
      // sala distinta.
      {
        rect: PUERTA_A_HACIA_INGENIERIA,
        // Dentro (z=2) de la propia puerta de vuelta de ingeniería (que
        // ocupa z:0..1.2 en SU sistema de coordenadas) para no reactivarla.
        destino: { estancia: "ingenieria", x: 4, z: 2, yaw: 0 },
      },
    ],
  },
  b: {
    planta: PLANTA_PRUEBA_B,
    componer: componerSalaPruebaB,
    puertas: [
      {
        rect: PUERTA_B_HACIA_A,
        destino: { estancia: "a", x: 5, z: 8.3, yaw: Math.PI },
      },
    ],
  },
  cantina: {
    planta: PLANTA_CANTINA,
    componer: componerCantinaAndar,
    entrada: { x: 1.5, z: 4, yaw: 0 },
    puertas: [
      // Simétrica a la de "a" hacia aquí, en el mismo muro oeste de la
      // cantina (coordenada nativa x≈−4.8, la cara interior de `paredIzq`).
      {
        rect: { x: 0, z: 4, ancho: 1.2, profundidad: 2 },
        destino: { estancia: "a", x: 3, z: 5, yaw: Math.PI / 2 },
      },
    ],
  },
  ingenieria: {
    planta: PLANTA_INGENIERIA,
    componer: componerIngenieria,
    entrada: { x: 4, z: 2, yaw: 0 },
    puertas: [
      // Simétrica a la de "a" hacia aquí, en el muro sur (z=0) de esta sala.
      {
        rect: PUERTA_INGENIERIA_HACIA_A,
        // Dentro (z=2) de la zona de la propia puerta de "a" hacia aquí para
        // no reactivarla al llegar, y mirando hacia el interior de "a"
        // (yaw=0, la misma orientación de entrada por la que se llegó).
        destino: { estancia: "a", x: 4, z: 2, yaw: 0 },
      },
    ],
  },
});
