// El catálogo de estancias que usa la ventana de andar (#427): la nave real
// que se puede recorrer hoy — cantina, vestíbulo, ingeniería, el pasillo del
// puente y sus cinco salas de estación (#508).
//
// SIN "a" NI "b". Esas dos siguen existiendo (`nave-movimiento-sala-prueba.
// mjs`) como banco de pruebas del motor de andar, pero ya no forman parte de
// la geografía de la nave: hicieron ese papel mientras se demostraba que la
// costura entre estancias (`nave-estancias.mjs`) aguantaba con una sala real
// además de las de prueba, y en cuanto existió un nudo real —el vestíbulo,
// `nave-vestibulo.mjs`— dejaron de hacer falta aquí. `CATALOGO_PRUEBA`, en su
// propio archivo, sigue sirviendo para probar el motor sin arrastrar la
// geografía real a esos tests.
//
// Vive en su propio archivo y no dentro de `cantina-planta.mjs`/
// `cantina-andar.mjs`/`nave-sala-ingenieria.mjs`/`nave-vestibulo.mjs`/
// `nave-pasillo-puente.mjs`/`nave-salas-puente.mjs` a propósito: cada uno de
// esos módulos se queda hablando solo de lo suyo (la colisión de la cantina,
// su render, cada sala), y coser QUÉ PUERTA LLEVA A DÓNDE es la única
// responsabilidad de este archivo — la misma separación que ya seguía el
// resto del módulo entre "aporta la estancia" y "decide qué estancia toca
// ahora" (`nave-estancias.mjs`).
//
// Puro: solo compone objetos y funciones que ya son puras.

import { crearCatalogoEstancias } from "./nave-estancias.mjs";
import { PLANTA_CANTINA } from "./cantina-planta.mjs";
import { componerCantinaAndar } from "./cantina-andar.mjs";
import {
  PLANTA_VESTIBULO,
  componerVestibulo,
  PUERTA_VESTIBULO_HACIA_CANTINA,
  PUERTA_VESTIBULO_HACIA_INGENIERIA,
  PUERTA_VESTIBULO_HACIA_PASILLO,
} from "./nave-vestibulo.mjs";
import { PLANTA_INGENIERIA, componerIngenieria, PUERTA_INGENIERIA_HACIA_VESTIBULO } from "./nave-sala-ingenieria.mjs";
import {
  PLANTA_PASILLO_PUENTE,
  componerPasilloPuente,
  ESTACIONES,
  PUERTA_PASILLO_HACIA_VESTIBULO,
  LLEGADA_DESDE_VESTIBULO,
  puertaHaciaEstacion,
  llegadaDesdeEstacion,
} from "./nave-pasillo-puente.mjs";
import { salaEstacion, entradaEstacion, PUERTA_ESTACION_HACIA_PASILLO } from "./nave-salas-puente.mjs";

export const CATALOGO_ANDAR = crearCatalogoEstancias({
  cantina: {
    planta: PLANTA_CANTINA,
    componer: componerCantinaAndar,
    entrada: { x: 1.5, z: 4, yaw: 0 },
    puertas: [
      // En el muro oeste de la cantina (coordenada nativa x≈−4.8, la cara
      // interior de `paredIzq`).
      {
        rect: { x: 0, z: 4, ancho: 1.2, profundidad: 2 },
        destino: { estancia: "vestibulo", x: 2, z: 3, yaw: Math.PI / 2 },
      },
    ],
  },
  vestibulo: {
    planta: PLANTA_VESTIBULO,
    componer: componerVestibulo,
    entrada: { x: 3, z: 3, yaw: 0 },
    puertas: [
      {
        rect: PUERTA_VESTIBULO_HACIA_CANTINA,
        // Dentro (x=3) de la propia puerta de vuelta de la cantina (que
        // ocupa x:0..1.2 en su sistema de coordenadas) para no reactivarla.
        destino: { estancia: "cantina", x: 3, z: 5, yaw: Math.PI / 2 },
      },
      {
        rect: PUERTA_VESTIBULO_HACIA_INGENIERIA,
        destino: { estancia: "ingenieria", x: 4, z: 2, yaw: 0 },
      },
      {
        rect: PUERTA_VESTIBULO_HACIA_PASILLO,
        destino: { estancia: "pasillo-puente", ...LLEGADA_DESDE_VESTIBULO },
      },
    ],
  },
  ingenieria: {
    planta: PLANTA_INGENIERIA,
    componer: componerIngenieria,
    entrada: { x: 4, z: 2, yaw: 0 },
    puertas: [
      // Simétrica a la del vestíbulo hacia aquí, en el muro sur (z=0).
      {
        rect: PUERTA_INGENIERIA_HACIA_VESTIBULO,
        destino: { estancia: "vestibulo", x: 3, z: 2, yaw: 0 },
      },
    ],
  },
  "pasillo-puente": {
    planta: PLANTA_PASILLO_PUENTE,
    componer: componerPasilloPuente,
    entrada: LLEGADA_DESDE_VESTIBULO,
    puertas: [
      // Simétrica a la del vestíbulo hacia aquí, en el muro oeste (x=0).
      {
        rect: PUERTA_PASILLO_HACIA_VESTIBULO,
        destino: { estancia: "vestibulo", x: 3, z: 4.5, yaw: -Math.PI / 2 },
      },
      // Una puerta por estación, en el muro este del pasillo — la MISMA
      // lista `ESTACIONES` que ya usa `nave-salas-puente.mjs`, así que una
      // estación nueva es una entrada más de esa lista, no un cambio aquí.
      ...ESTACIONES.map((estacion) => ({
        rect: puertaHaciaEstacion(estacion),
        destino: { estancia: estacion.id, ...entradaEstacion() },
      })),
    ],
  },
  ...Object.fromEntries(
    ESTACIONES.map((estacion) => [
      estacion.id,
      {
        planta: salaEstacion(estacion.id).planta,
        componer: salaEstacion(estacion.id).componer,
        entrada: entradaEstacion(),
        puertas: [
          {
            rect: PUERTA_ESTACION_HACIA_PASILLO,
            destino: { estancia: "pasillo-puente", ...llegadaDesdeEstacion(estacion) },
          },
        ],
      },
    ]),
  ),
});
