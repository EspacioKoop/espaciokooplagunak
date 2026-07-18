/**
 * Decorado de fondo del mapa vivo (issue #203): nebulosas, planetas lejanos y un
 * cinturón de asteroides que dan sensación de espacio y de movimiento sobre el
 * campo de estrellas, sin competir con la información táctica.
 *
 * Este módulo encapsula TODO el decorado —siembra determinista, parallax y
 * pintado— para no engordar `ventana-nave.mjs` (composición del frame) ni
 * `mapa-render.mjs` (pintor). Reutiliza el PRNG y el parallax de `ventana-nave`;
 * es puramente cosmético: no consulta red ni conoce Foundry.
 *
 * Contrato de dibujo: se pinta entre el fondo y las estrellas/retícula, nunca
 * sobre contactos, ruta o nave propia. Si no hay decorado, no pinta nada.
 *
 * ACOPLADO AL CANVAS: `dibujarDecorado` no se prueba en Node (no hay contexto 2D
 * real); su verificación es humana, como el resto de `mapa-render.mjs`. La
 * siembra y el parallax (`crearDecorado`, `componerDecorado`) sí son lógica pura
 * y tienen pruebas en `tests/decorado-fondo.test.mjs`.
 */

import { rngSemilla, offsetParallax } from "./ventana-nave.mjs";

// Paletas apagadas: colores frías/cálidas muy desaturados para no competir con
// PALETA_FACCIONES ni con el blanco de la nave propia.
export const PALETA_DECORADO = {
  planetas: ["#3a5a7a", "#7a5a3a", "#5a7a5a", "#6a4a6a"],
  nebulosas: ["#5a2a6a", "#2a4a6a", "#6a3a4a"],
  asteroide: "#aaa096",
};

// Factor de parallax por tipo: más pequeño = se mueve menos = se percibe más
// lejos. Ordena también las capas de lejana a cercana.
const FACTOR = { nebulosa: 0.08, planeta: 0.16, asteroide: 0.5 };

/**
 * Siembra el decorado de forma determinista (misma `seed` → mismo decorado).
 * Devuelve capas ordenadas de lejana a cercana, cada una con su `tipo`, su
 * `factor` de parallax y sus `elementos` sin desplazar.
 *
 * @returns {{tipo:string, factor:number, elementos:object[]}[]}
 */
export function crearDecorado(
  seed,
  { ancho = 320, alto = 320, planetas = 2, nebulosas = 2, asteroides = 60 } = {},
) {
  const rng = rngSemilla(seed);
  const elige = (lista) => lista[Math.floor(rng() * lista.length)];

  const elemNebulosas = [];
  for (let i = 0; i < nebulosas; i += 1) {
    elemNebulosas.push({
      x: rng() * ancho,
      y: rng() * alto,
      r: ancho * (0.18 + rng() * 0.22), // manchas grandes
      color: elige(PALETA_DECORADO.nebulosas),
      alpha: 0.05 + rng() * 0.06, // muy tenues
    });
  }

  const elemPlanetas = [];
  for (let i = 0; i < planetas; i += 1) {
    elemPlanetas.push({
      x: rng() * ancho,
      y: rng() * alto,
      r: ancho * (0.05 + rng() * 0.06),
      color: elige(PALETA_DECORADO.planetas),
      brillo: 0.22 + rng() * 0.16,
    });
  }

  const elemAsteroides = [];
  for (let i = 0; i < asteroides; i += 1) {
    elemAsteroides.push({
      x: rng() * ancho,
      y: rng() * alto,
      r: 1 + Math.floor(rng() * 2), // 1–2 px
      brillo: 0.18 + rng() * 0.25,
    });
  }

  return [
    { tipo: "nebulosa", factor: FACTOR.nebulosa, elementos: elemNebulosas },
    { tipo: "planeta", factor: FACTOR.planeta, elementos: elemPlanetas },
    { tipo: "asteroide", factor: FACTOR.asteroide, elementos: elemAsteroides },
  ];
}

/**
 * Aplica el desplazamiento en parallax a cada capa según la posición del mundo
 * (la nave), igual que hace `componerFrame` con el campo de estrellas. Lógica
 * pura: no toca el canvas.
 *
 * @returns {{tipo:string, dx:number, dy:number, elementos:object[]}[]}
 */
export function componerDecorado(
  decorado = [],
  { centro = null, escalaFondo = 0.05, ancho = 320, alto = 320 } = {},
) {
  return decorado.map((capa) => ({
    tipo: capa.tipo,
    elementos: capa.elementos,
    ...offsetParallax(capa.factor, centro, escalaFondo, ancho, alto),
  }));
}

/** Convierte "#rrggbb" + alpha en una cadena rgba() para el canvas. */
function rgba(hex, alpha) {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// Envuelve una coordenada al rango [0, tam).
const envolver = (v, tam) => ((v % tam) + tam) % tam;

function pintarNebulosa(ctx, el, x, y) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, el.r);
  g.addColorStop(0, rgba(el.color, el.alpha));
  g.addColorStop(1, rgba(el.color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, el.r, 0, Math.PI * 2);
  ctx.fill();
}

function pintarPlaneta(ctx, el, x, y) {
  ctx.fillStyle = rgba(el.color, el.brillo);
  ctx.beginPath();
  ctx.arc(x, y, el.r, 0, Math.PI * 2);
  ctx.fill();
}

// Elementos grandes (nebulosa/planeta): se replican en una rejilla 3×3 para
// envolver el lienzo sin costura; las copias fuera de vista se descartan.
function pintarGrande(ctx, tipo, el, x, y, ancho, alto) {
  for (const ox of [-ancho, 0, ancho]) {
    for (const oy of [-alto, 0, alto]) {
      const px = x + ox;
      const py = y + oy;
      if (px + el.r < 0 || px - el.r > ancho || py + el.r < 0 || py - el.r > alto) continue;
      if (tipo === "nebulosa") pintarNebulosa(ctx, el, px, py);
      else pintarPlaneta(ctx, el, px, py);
    }
  }
}

// Asteroides: motas pixeladas; basta duplicar en los bordes derecho/inferior.
function pintarAsteroide(ctx, el, x, y, ancho, alto) {
  const tam = Math.max(1, Math.round(el.r));
  ctx.fillStyle = rgba(PALETA_DECORADO.asteroide, el.brillo);
  ctx.fillRect(Math.round(x), Math.round(y), tam, tam);
  if (x + tam > ancho) ctx.fillRect(Math.round(x - ancho), Math.round(y), tam, tam);
  if (y + tam > alto) ctx.fillRect(Math.round(x), Math.round(y - alto), tam, tam);
}

/**
 * Pinta el decorado ya compuesto (salida de `componerDecorado`) sobre el
 * contexto 2D. Debe llamarse tras el fondo y antes de estrellas/retícula.
 */
export function dibujarDecorado(ctx, decoradoFrame = [], { ancho = 320, alto = 320 } = {}) {
  for (const capa of decoradoFrame) {
    for (const el of capa.elementos ?? []) {
      const x = envolver(el.x + capa.dx, ancho);
      const y = envolver(el.y + capa.dy, alto);
      if (capa.tipo === "asteroide") pintarAsteroide(ctx, el, x, y, ancho, alto);
      else pintarGrande(ctx, capa.tipo, el, x, y, ancho, alto);
    }
  }
}
