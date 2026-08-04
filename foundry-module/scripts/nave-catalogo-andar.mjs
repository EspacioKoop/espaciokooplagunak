// El catálogo de estancias que usa la ventana de andar (#427): las dos salas
// de pruebas del motor MÁS la primera sala REAL, la cantina.
//
// LA PUERTA ENTRE "a" Y "cantina" ES LA PRUEBA, no la geografía definitiva de
// la nave. Demuestra que el mecanismo de #427 (cambiar de estancia sin
// reiniciar el bucle) funciona exactamente igual con una sala real —con su
// propio módulo, su propia geometría, sus propios cien muebles— que con una
// sala de pruebas inventada. Qué sala lleva a qué otra en la nave de verdad,
// y quién tiene autoridad para declarar una estancia nueva, siguen siendo
// decisiones sin tomar (ver la discusión del PR): esto es la comprobación
// técnica de que la costura aguanta, no la respuesta a esas preguntas.
//
// Vive en su propio archivo y no dentro de `nave-movimiento-sala-prueba.mjs`
// ni de `cantina-planta.mjs`/`cantina-andar.mjs` a propósito: cada uno de
// esos tres se queda hablando solo de lo suyo (el banco de pruebas, la
// colisión de la cantina, su render), y coserlos es la única responsabilidad
// de este archivo — la misma separación que ya seguía el resto del módulo
// entre "aporta la estancia" y "decide qué estancia toca ahora"
// (`nave-estancias.mjs`).
//
// Puro: solo compone objetos y funciones que ya son puras.

import { crearCatalogoEstancias } from "./nave-estancias.mjs";
import {
  PLANTA_PRUEBA,
  PLANTA_PRUEBA_B,
  componerSalaPrueba,
  componerSalaPruebaB,
} from "./nave-movimiento-sala-prueba.mjs";
import { PLANTA_CANTINA } from "./cantina-planta.mjs";
import { componerCantinaAndar } from "./cantina-andar.mjs";

export const CATALOGO_ANDAR = crearCatalogoEstancias({
  a: {
    planta: PLANTA_PRUEBA,
    componer: componerSalaPrueba,
    entrada: { x: 1.5, z: 1.5, yaw: 0 },
    puertas: [
      // La puerta original de la costura de pruebas (a <-> b): ver
      // `nave-movimiento-sala-prueba.mjs` para el porqué de estos números.
      {
        rect: { x: 4, z: 8.8, ancho: 2, profundidad: 1.2 },
        destino: { estancia: "b", x: 3, z: 2, yaw: 0 },
      },
      // La puerta nueva hacia la cantina real, en el muro oeste (x=0) de la
      // sala de pruebas: un lado que hasta ahora no tenía ninguna puerta.
      {
        rect: { x: 0, z: 4, ancho: 1.2, profundidad: 2 },
        // Bastante dentro (x=2.5) de la propia puerta de vuelta de la
        // cantina (que ocupa x:0..1.2) para no reactivarla al llegar.
        destino: { estancia: "cantina", x: 2.5, z: 4.5, yaw: 0 },
      },
    ],
  },
  b: {
    planta: PLANTA_PRUEBA_B,
    componer: componerSalaPruebaB,
    puertas: [
      {
        rect: { x: 2, z: 0, ancho: 2, profundidad: 1.2 },
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
});
