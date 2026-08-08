// Pintor del minimapa de la nave (QA 2026-08-08).
//
// Reusa `medidas` y `cajaEnPixeles` de `seccion-lienzo.mjs`: la sección ya sabía
// dibujar cajas sobre una rejilla y no hay razón para escribir esa aritmética dos
// veces. Lo que NO se reusa es su lista de salas, que es la nave inventada — ver
// la cabecera de `nave-minimapa.mjs`.
//
// Separado del modelo por la misma regla que el resto del módulo: `nave-minimapa`
// decide qué salas hay y cuál es la tuya, y esto solo lo pone en píxeles.

import { cajaEnPixeles, medidas } from "./seccion-lienzo.mjs";
import { SECCION } from "./paleta.mjs";

/** Cuánto se separa una sala de la siguiente, para que se vean los tabiques. */
const JUNTA = 1;

/**
 * Pinta el minimapa.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{columnas:number, filas:number, salas:Array}} modelo
 */
export function pintarMinimapa(ctx, modelo) {
  const { canvas } = ctx;
  const m = medidas({ ancho: canvas.width, alto: canvas.height, rejilla: modelo });

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const sala of modelo.salas) {
    const caja = cajaEnPixeles(sala.caja, m);
    const x = caja.x + JUNTA;
    const y = caja.y + JUNTA;
    const ancho = Math.max(1, caja.ancho - JUNTA * 2);
    const alto = Math.max(1, caja.alto - JUNTA * 2);

    // Una sala con sistema se distingue de un tránsito: es lo que hace legible el
    // plano de un vistazo, sin decir CUÁL sistema —eso sería otra lectura—.
    ctx.fillStyle = sala.conSistema ? SECCION.mamparo : SECCION.casco;
    ctx.fillRect(x, y, ancho, alto);

    if (!sala.actual) continue;
    // La sala actual se marca con relleno Y borde, no solo con color: sobre un
    // minimapa de veinte píxeles por sala, un cambio de tono se pierde y quien no
    // distinga bien los colores se queda sin la única información que da esto.
    ctx.fillStyle = SECCION.entrable;
    ctx.fillRect(x, y, ancho, alto);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, ancho - 1, alto - 1);
  }
}
