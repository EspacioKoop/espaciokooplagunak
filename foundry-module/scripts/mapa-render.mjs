/**
 * Pintor del mapa vivo sobre un contexto 2D de <canvas>. Recibe el «frame»
 * calculado por `componerFrame` (ventana-nave.mjs) y solo dibuja: no consulta
 * la red, no conoce Foundry ni mantiene estado propio.
 *
 * ACOPLADO AL CANVAS: este archivo no se prueba en Node (no hay contexto 2D
 * real); su verificación es humana, en un Foundry de verdad, como el resto del
 * render del módulo (ver README del módulo, «Estado de verificación»).
 *
 * Estética Neo Geo: resolución interna baja (320×320 escalado con
 * image-rendering: pixelated), fillRect sin antialias para los blips, colores
 * saturados de PALETA_FACCIONES y parpadeo de fase fija.
 */

import { COLOR_JUGADOR } from "./ventana-nave.mjs";

const FONDO = "#03071e"; // azul-negro profundo
const RETICULA = "rgba(125, 133, 151, 0.25)"; // gris azulado tenue
const TAM_BLIP = 5; // cuadrado pixelado, en píxeles internos
const TAM_ESTRELLA_MIN = 1;

/**
 * Pinta un frame completo. `frame` es la salida de componerFrame; con
 * `sinDatos` se pinta solo el fondo y la retícula (pantalla «en espera»).
 */
export function dibujarFrame(ctx, frame, { ancho = 320, alto = 320 } = {}) {
  ctx.imageSmoothingEnabled = false;

  // Fondo.
  ctx.fillStyle = FONDO;
  ctx.fillRect(0, 0, ancho, alto);

  // Estrellas por capa, teseladas: cada estrella se pinta desplazada por el
  // offset de su capa y envuelta al lienzo; las que quedan a caballo del borde
  // se duplican al otro lado para que no haya costura al hacer parallax.
  for (const capa of frame.capas ?? []) {
    for (const e of capa.estrellas) {
      const x = (e.x + capa.dx) % ancho;
      const y = (e.y + capa.dy) % alto;
      const tam = Math.max(TAM_ESTRELLA_MIN, Math.round(e.r));
      ctx.fillStyle = `rgba(253, 255, 252, ${e.brillo})`;
      ctx.fillRect(Math.round(x), Math.round(y), tam, tam);
      // Duplicados de borde (solo cuando hace falta).
      if (x + tam > ancho) ctx.fillRect(Math.round(x - ancho), Math.round(y), tam, tam);
      if (y + tam > alto) ctx.fillRect(Math.round(x), Math.round(y - alto), tam, tam);
    }
  }

  // Retícula: anillo de alcance y cruz del centro.
  const cx = ancho / 2;
  const cy = alto / 2;
  const radio = Math.min(ancho, alto) / 2 - 2;
  ctx.strokeStyle = RETICULA;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, radio, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy);
  ctx.lineTo(cx + 6, cy);
  ctx.moveTo(cx, cy - 6);
  ctx.lineTo(cx, cy + 6);
  ctx.stroke();

  if (frame.sinDatos) return;

  // Blips de contactos. La rotación de cabina (morro arriba) ya viene aplicada
  // en las coordenadas del frame; aquí solo se pintan cuadrados.
  for (const blip of frame.blips ?? []) {
    if (blip.esJugador) continue; // la nave propia se pinta al final, encima
    if (!blip.parpadeo) continue; // fase apagada del parpadeo retro
    if (blip.dentro) {
      ctx.fillStyle = blip.color;
      ctx.fillRect(
        Math.round(blip.x - TAM_BLIP / 2),
        Math.round(blip.y - TAM_BLIP / 2),
        TAM_BLIP,
        TAM_BLIP,
      );
    } else {
      // Fuera de alcance: marca en el borde del anillo, hacia el contacto.
      const a = Math.atan2(blip.y - cy, blip.x - cx);
      const bx = cx + Math.cos(a) * radio;
      const by = cy + Math.sin(a) * radio;
      ctx.fillStyle = blip.color;
      ctx.fillRect(Math.round(bx - 2), Math.round(by - 2), 4, 4);
    }
  }

  // Nave propia: triángulo blanco con el morro hacia arriba (la rotación del
  // mundo ya la hizo la proyección; en cabina el morro siempre apunta arriba).
  ctx.fillStyle = COLOR_JUGADOR;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 6);
  ctx.lineTo(cx - 5, cy + 5);
  ctx.lineTo(cx + 5, cy + 5);
  ctx.closePath();
  ctx.fill();
}
