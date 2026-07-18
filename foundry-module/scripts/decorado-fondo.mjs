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
  asteroide: "#c0a98f",
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
  const centroCinturon = rng() * alto;
  const inclinacionCinturon = (rng() - 0.5) * 0.35;
  for (let i = 0; i < asteroides; i += 1) {
    const x = rng() * ancho;
    // Tres muestras sumadas concentran las motas alrededor de una banda sin
    // necesitar trigonometría ni estado: sigue siendo determinista y teselable.
    const dispersion = (rng() + rng() + rng() - 1.5) * alto * 0.24;
    const y = envolver(
      centroCinturon + (x - ancho / 2) * inclinacionCinturon + dispersion,
      alto,
    );
    elemAsteroides.push({
      x,
      y,
      r: 1 + Math.floor(rng() * 2), // 1–2 px
      brillo: 0.36 + rng() * 0.28,
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

function ruidoCelda(ix, iy, semilla) {
  let n = Math.imul(ix + semilla, 374761393) + Math.imul(iy - semilla, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function pintarNebulosa(ctx, el, x, y) {
  const paso = 6;
  const radio = Math.max(1, Math.round(el.r));
  const semilla = Math.round(el.x * 17 + el.y * 31);
  ctx.fillStyle = rgba(el.color, Math.min(0.22, el.alpha * 2));
  for (let dy = -radio; dy <= radio; dy += paso) {
    for (let dx = -radio; dx <= radio; dx += paso) {
      const distancia = Math.hypot(dx, dy) / radio;
      if (distancia >= 1) continue;
      const densidad = (1 - distancia) * 0.58;
      if (ruidoCelda(dx / paso, dy / paso, semilla) > densidad) continue;
      ctx.fillRect(Math.round(x + dx), Math.round(y + dy), 2, 2);
    }
  }
}

function pintarPlaneta(ctx, el, x, y) {
  const radio = Math.max(1, Math.round(el.r));
  const cx = Math.round(x);
  const cy = Math.round(y);
  for (let dy = -radio; dy <= radio; dy += 1) {
    const medioAncho = Math.floor(Math.sqrt(Math.max(0, radio * radio - dy * dy)));
    const izquierda = cx - medioAncho;
    const ancho = medioAncho * 2 + 1;
    ctx.fillStyle = rgba(el.color, el.brillo * 0.72);
    ctx.fillRect(izquierda, cy + dy, ancho, 1);

    // Hemisferio en sombra y bandas atmosféricas: píxeles enteros, sin curvas.
    const sombra = Math.floor(ancho * 0.38);
    if (sombra > 0) {
      ctx.fillStyle = "rgba(3, 7, 30, 0.42)";
      ctx.fillRect(izquierda, cy + dy, sombra, 1);
    }
    if ((dy + radio) % 5 === 0 && ancho > 6) {
      ctx.fillStyle = rgba(el.color, Math.min(0.72, el.brillo * 1.35));
      ctx.fillRect(izquierda + sombra, cy + dy, Math.max(2, ancho - sombra - 2), 1);
    }
  }
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

// Asteroides: motas pixeladas replicadas en 3×3 para conservar también la
// esquina cuando una mota cruza a la vez los bordes horizontal y vertical.
function pintarAsteroide(ctx, el, x, y, ancho, alto) {
  const tam = Math.max(1, Math.round(el.r));
  for (const ox of [-ancho, 0, ancho]) {
    for (const oy of [-alto, 0, alto]) {
      const px = Math.round(x + ox);
      const py = Math.round(y + oy);
      if (px + tam <= 0 || px >= ancho || py + tam <= 0 || py >= alto) continue;
      ctx.fillStyle = rgba(PALETA_DECORADO.asteroide, el.brillo);
      ctx.fillRect(px, py, tam, tam);
      if (tam > 1) {
        ctx.fillStyle = "rgba(60, 49, 42, 0.55)";
        ctx.fillRect(px, py + tam - 1, 1, 1);
      }
    }
  }
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
