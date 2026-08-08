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

import { SALAS_PHOBOS } from "./nave-planta-phobos.mjs";

/**
 * La cantina no está en la rejilla del interior nativo: cuelga del muro norte de
 * `acceso-cantina` (#540). Para el minimapa se le da la celda inmediatamente
 * encima, que es donde está de verdad respecto al resto — no dibujarla dejaría
 * fuera del plano la única sala en la que se puede empezar.
 */
const SALA_QUE_LA_SOSTIENE = "acceso-cantina";
const ID_CANTINA = "cantina";

/** Las celdas del minimapa, ya normalizadas para que empiecen en (0,0). */
export function celdasMinimapa(salas = SALAS_PHOBOS) {
  const sostiene = salas.find((sala) => sala.id === SALA_QUE_LA_SOSTIENE);
  const celdas = salas.map((sala) => ({ id: sala.id, ...sala.celda, sistema: sala.sistema ?? null }));

  if (sostiene) {
    celdas.push({
      id: ID_CANTINA,
      x: sostiene.celda.x,
      y: sostiene.celda.y - 1,
      w: sostiene.celda.w,
      h: 1,
      sistema: null,
    });
  }

  // Normalizar: la cantina mete una fila con `y` negativa, y una rejilla que
  // empieza en negativo obliga a que el pintor sepa del caso raro.
  const minX = Math.min(...celdas.map((c) => c.x));
  const minY = Math.min(...celdas.map((c) => c.y));
  return celdas.map((c) => ({ ...c, x: c.x - minX, y: c.y - minY }));
}

/**
 * Modelo del minimapa con una sala marcada como la actual.
 *
 * @param {string|null} estanciaActual id de la estancia donde está el jugador.
 * @returns {{columnas:number, filas:number, salas:Array}}
 */
export function modeloMinimapa(estanciaActual = null, salas = SALAS_PHOBOS) {
  const celdas = celdasMinimapa(salas);
  const columnas = Math.max(...celdas.map((c) => c.x + c.w));
  const filas = Math.max(...celdas.map((c) => c.y + c.h));
  return {
    columnas,
    filas,
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
  return celdasMinimapa(salas).some((celda) => celda.id === estanciaId);
}
