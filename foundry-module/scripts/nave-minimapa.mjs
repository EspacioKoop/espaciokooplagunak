// Minimapa de la nave para la ventana de andar (QA 2026-08-08: «habría que poner
// un minimapa de la nave para saber en qué sala estás»).
//
// ## Por qué no reusa `seccion-nave.mjs` tal cual
//
// La idea aprobada era reusar la sección marcando tu sala, y es la buena — pero
// la sección declara SEIS salas inventadas (puente, enfermería, bodega…) y la
// nave que se recorre tiene CATORCE, las del interior real del Phobos M3P (#540).
// Son dos naves distintas: un minimapa sacado de la sección te situaría en un
// plano que no es por el que andas, que es peor que no tener minimapa.
//
// Así que se reusa el PINTOR de la sección (`seccion-lienzo.mjs`, que ya sabe
// dibujar cajas sobre una rejilla) con la planta REAL. Lo que queda fuera es la
// lista de salas inventada, no el trabajo de dibujo.
//
// Que la sección siga enseñando otra nave es el último resto del problema que
// #540 vino a resolver, y tiene su propio issue.
//
// ## Qué muestra y qué no
//
// Dónde estás y cómo se conecta la nave. NADA más: ni salud de sistemas, ni
// quién está en cada sala. El minimapa de una ventana de paseo es orientación,
// no un panel de estado — y salud por sala ya la da el Control de daños, con
// autoridad y degradación propias que aquí no tocaría duplicar.
//
// Puro: devuelve datos de rejilla. Ni Foundry, ni DOM, ni <canvas>.

import { SALAS_PHOBOS, celdasConCantina, rejillaDelPlano } from "./nave-planta-phobos.mjs";

/** El plano lo declara `nave-planta-phobos.mjs`: una sola nave, un solo sitio. */
export const celdasMinimapa = celdasConCantina;

/**
 * Modelo del minimapa con una sala marcada como la actual.
 *
 * @param {string|null} estanciaActual id de la estancia donde está el jugador.
 * @returns {{columnas:number, filas:number, salas:Array}}
 */
export function modeloMinimapa(estanciaActual = null, salas = SALAS_PHOBOS) {
  const celdas = celdasConCantina(salas);
  return {
    ...rejillaDelPlano(salas),
    salas: celdas.map((c) => ({
      id: c.id,
      caja: { x: c.x, y: c.y, ancho: c.w, alto: c.h },
      // `actual` es lo único que cambia entre fotogramas: el resto del modelo es
      // constante y quien pinte puede cachearlo.
      actual: c.id === estanciaActual,
      // Una sala con sistema se distingue de un tránsito, que es lo que hace
      // legible el plano de un vistazo. No dice CUÁL: eso sería otra lectura.
      conSistema: Boolean(c.sistema),
    })),
  };
}

/** ¿Está esta estancia en el plano? La cantina sí; las salas de prueba no. */
export function estaEnElPlano(estanciaId, salas = SALAS_PHOBOS) {
  return celdasConCantina(salas).some((celda) => celda.id === estanciaId);
}
