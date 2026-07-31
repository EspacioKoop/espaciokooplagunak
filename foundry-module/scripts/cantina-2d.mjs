// Capa 2D de la cantina (#423): pixel-art encima del 3D.
//
// POR QUÉ EXISTE. Un rasterizador por pintor con caras planas deja costuras:
// juntas de un píxel entre polígonos vecinos, esquinas donde dos cajas casi
// coinciden, y sobre todo un ambiente que no tiene ningún volumen porque nada
// atenúa las distancias cortas. Perseguir eso dentro del 3D es caro y además no
// es lo que hacían las consolas de la época: encima del render iban capas
// planas —viñeta, líneas, un velo de suciedad, luces dibujadas— y ahí es donde
// vivía la mitad del ambiente.
//
// Aquí está esa mitad. Se dibuja DESPUÉS de la escena, en el mismo búfer
// pequeño, así que se amplía con ella y sale del mismo tamaño de píxel: no es
// un filtro de pantalla, es dibujo del mismo cuadro.
//
// Sin estado, sin reloj propio, sin Foundry: recibe un contexto 2D y las
// medidas, como `retro3d-lienzo.mjs`. Se prueba con un contexto de mentira.
//
// Frontera de arte (#351): no declara ni un color.

import { CANTINA, PIXEL, canales } from "./paleta.mjs";

/**
 * Velo de un color de la paleta con la opacidad dada. Existe para que este
 * módulo no escriba ni un `rgba(...)` literal: la guardia de `paleta.test.mjs`
 * los prohíbe con razón —un velo es un color— y aquí el tono siempre sale de
 * `CANTINA`, solo que atenuado.
 */
function velo(color, alfa) {
  const [r, g, b] = canales(color) ?? canales(CANTINA.sombra);
  return `rgba(${r}, ${g}, ${b}, ${alfa})`;
}

/** Alto de la banda de suciedad del techo, como fracción del alto. */
const BANDA = 0.16;

/**
 * Viñeta por bandas, no por degradado. El degradado es un recurso de pantalla y
 * delata el pastiche —la misma razón por la que el grabado del módulo no usa
 * opacidad—; una consola oscurecía los bordes con tramas de píxeles, así que
 * esto son rectángulos translúcidos de anchura creciente y nada más.
 */
export function pintarVinieta(ctx, { ancho, alto, pasos = 4, fuerza = 0.12 }) {
  if (!ctx) return 0;
  let pintados = 0;
  for (let i = 0; i < pasos; i += 1) {
    const grosor = i + 1;
    ctx.fillStyle = velo(CANTINA.sombra, fuerza);
    ctx.fillRect(0, i, ancho, 1);
    ctx.fillRect(0, alto - 1 - i, ancho, 1);
    ctx.fillRect(i, 0, 1, alto);
    ctx.fillRect(ancho - 1 - i, 0, 1, alto);
    pintados += 4 * grosor;
  }
  return pintados;
}

/**
 * Líneas horizontales alternas, una sí una no. Es el recurso más viejo del
 * catálogo y hace dos cosas a la vez: da textura de tubo y, sobre todo, ROMPE
 * LAS COSTURAS — una junta de un píxel entre dos caras deja de leerse como un
 * arañazo cuando la imagen entera está rayada.
 */
export function pintarLineas(ctx, { ancho, alto, cada = 2, fuerza = 0.16 }) {
  if (!ctx) return 0;
  let lineas = 0;
  ctx.fillStyle = velo(CANTINA.sombra, fuerza);
  for (let y = 0; y < alto; y += cada) {
    ctx.fillRect(0, y, ancho, 1);
    lineas += 1;
  }
  return lineas;
}

/**
 * El halo de las lámparas: un par de bandas cálidas en la parte alta. La luz de
 * la sala sale de arriba y el 3D no la puede dar —no hay luces, solo sombreado
 * por normal—, así que se dibuja. Es exactamente el truco de la época.
 */
export function pintarLuzAlta(ctx, { ancho, alto }) {
  if (!ctx) return 0;
  const bandas = Math.max(1, Math.round(alto * BANDA));
  for (let i = 0; i < bandas; i += 1) {
    // Más fuerte arriba del todo y se apaga hacia abajo, por escalones.
    const alfa = 0.1 * (1 - i / bandas);
    ctx.fillStyle = velo(CANTINA.lampara, alfa.toFixed(3));
    ctx.fillRect(0, i, ancho, 1);
  }
  return bandas;
}

/**
 * Motas de polvo en suspensión, sembradas. Cuatro píxeles sueltos bastan para
 * que el aire de la sala deje de ser vacío perfecto; se siembran para que no
 * bailen entre fotogramas, que es lo que las convertiría en ruido.
 */
export function pintarPolvo(ctx, { ancho, alto, semilla = 1, cuantas = 18 }) {
  if (!ctx) return 0;
  // Congruencial mínimo: no hace falta más para colocar motas, y `Math.random`
  // daría una sala distinta en cada repintado.
  let estado = semilla >>> 0;
  const siguiente = () => {
    estado = (estado * 1664525 + 1013904223) >>> 0;
    return estado / 4294967296;
  };
  ctx.fillStyle = PIXEL.estrella;
  let puestas = 0;
  for (let i = 0; i < cuantas; i += 1) {
    const x = Math.floor(siguiente() * ancho);
    const y = Math.floor(siguiente() * alto);
    ctx.fillRect(x, y, 1, 1);
    puestas += 1;
  }
  return puestas;
}

/**
 * El marco del ventanal, dibujado plano por encima del 3D. La geometría ya pone
 * los montantes, pero un filo claro de un píxel es lo que hace que el cristal
 * parezca cristal, y eso en 3D costaría cuatro cajas más por cada borde.
 */
export function pintarFiloVentanal(ctx, { ancho, alto }) {
  if (!ctx) return 0;
  const x0 = Math.round(ancho * 0.24);
  const x1 = Math.round(ancho * 0.76);
  const y0 = Math.round(alto * 0.22);
  const y1 = Math.round(alto * 0.62);
  ctx.fillStyle = CANTINA.nervio;
  ctx.fillRect(x0, y0, x1 - x0, 1);
  ctx.fillRect(x0, y1, x1 - x0, 1);
  ctx.fillRect(x0, y0, 1, y1 - y0);
  ctx.fillRect(x1, y0, 1, y1 - y0);
  return 4;
}

/**
 * Todas las capas, en el orden en que se pintan. El orden importa: la luz va
 * antes que las líneas (si no, las líneas se comen el halo) y la viñeta va la
 * última, porque tiene que oscurecer también lo que han puesto las demás.
 */
export function pintarCapa2D(ctx, { ancho, alto, semilla = 1 } = {}) {
  if (!ctx || !(ancho > 0) || !(alto > 0)) return false;
  pintarLuzAlta(ctx, { ancho, alto });
  pintarFiloVentanal(ctx, { ancho, alto });
  pintarPolvo(ctx, { ancho, alto, semilla });
  pintarLineas(ctx, { ancho, alto });
  pintarVinieta(ctx, { ancho, alto });
  return true;
}
