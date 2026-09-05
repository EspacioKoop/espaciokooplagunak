#!/usr/bin/env node
/**
 * Banco de pruebas del motor 3D (#976): ver lo que `retro3d` dibuja DE VERDAD,
 * sin Foundry y sin navegador.
 *
 * La idea es no tener un segundo pintor. La escena la compone el mismo módulo
 * que la compone en producción y la pinta el mismo `pintarEscena`; lo único
 * que aporta este banco es un `ctx` de mentira que, en vez de mandar los
 * polígonos a un `<canvas>`, los rasteriza en un búfer y los saca por
 * `png-indexado.mjs`, que ya está en el árbol. Si el banco pintara por su
 * cuenta, la imagen probaría el banco y no el motor.
 */
import { writeFileSync } from "node:fs";
import { pintarEscena } from "../foundry-module/scripts/retro3d-lienzo.mjs";
import { codificarPngIndexado, hexARgb } from "../foundry-module/scripts/png-indexado.mjs";

/** Búfer RGB con relleno de polígonos por barrido y mezcla por alfa. */
function crearLienzo(ancho, alto) {
  const pixeles = new Uint8Array(ancho * alto * 3);
  let estilo = [0, 0, 0];
  let alfa = 1;
  let camino = [];

  const color = (css) => {
    if (Array.isArray(css)) return css;
    try {
      return hexARgb(String(css));
    } catch {
      // rgb()/rgba() y cualquier otra notación que el motor pueda emitir.
      const n = String(css).match(/-?\d+(\.\d+)?/g);
      return n && n.length >= 3 ? n.slice(0, 3).map((v) => Math.round(Number(v))) : [255, 0, 255];
    }
  };

  const punto = (x, y, [r, g, b], a) => {
    if (x < 0 || y < 0 || x >= ancho || y >= alto) return;
    const i = (y * ancho + x) * 3;
    if (a >= 1) {
      pixeles[i] = r; pixeles[i + 1] = g; pixeles[i + 2] = b;
      return;
    }
    pixeles[i] = Math.round(pixeles[i] * (1 - a) + r * a);
    pixeles[i + 1] = Math.round(pixeles[i + 1] * (1 - a) + g * a);
    pixeles[i + 2] = Math.round(pixeles[i + 2] * (1 - a) + b * a);
  };

  /** Relleno por regla par-impar: basta para caras convexas y cóncavas. */
  const rellenar = (puntos, rgb, a) => {
    if (puntos.length < 3) return;
    let yMin = Infinity, yMax = -Infinity;
    for (const p of puntos) {
      if (p.y < yMin) yMin = p.y;
      if (p.y > yMax) yMax = p.y;
    }
    const y0 = Math.max(0, Math.ceil(yMin));
    const y1 = Math.min(alto - 1, Math.floor(yMax));
    for (let y = y0; y <= y1; y += 1) {
      const cortes = [];
      for (let i = 0; i < puntos.length; i += 1) {
        const a1 = puntos[i];
        const b1 = puntos[(i + 1) % puntos.length];
        if (a1.y === b1.y) continue;
        const dentro = (a1.y <= y && b1.y > y) || (b1.y <= y && a1.y > y);
        if (!dentro) continue;
        cortes.push(a1.x + ((y - a1.y) / (b1.y - a1.y)) * (b1.x - a1.x));
      }
      cortes.sort((p, q) => p - q);
      for (let i = 0; i + 1 < cortes.length; i += 2) {
        const x0 = Math.max(0, Math.ceil(cortes[i]));
        const x1 = Math.min(ancho - 1, Math.floor(cortes[i + 1]));
        for (let x = x0; x <= x1; x += 1) punto(x, y, rgb, a);
      }
    }
  };

  const ctx = {
    set fillStyle(v) { estilo = color(v); },
    get fillStyle() { return estilo; },
    set strokeStyle(v) { estilo = color(v); },
    set globalAlpha(v) { alfa = Number.isFinite(v) ? v : 1; },
    get globalAlpha() { return alfa; },
    lineWidth: 1,
    beginPath() { camino = []; },
    moveTo(x, y) { camino.push({ x, y }); },
    lineTo(x, y) { camino.push({ x, y }); },
    closePath() {},
    fill() { rellenar(camino, estilo, alfa); },
    // El contorno del pintor solo tapa costuras de un píxel; a esta resolución
    // el relleno ya las cubre, así que no se emula: dibujarlo mal ensuciaría
    // más de lo que arregla.
    stroke() {},
    fillRect(x, y, w, h) {
      for (let j = Math.max(0, Math.round(y)); j < Math.min(alto, Math.round(y + h)); j += 1) {
        for (let i = Math.max(0, Math.round(x)); i < Math.min(ancho, Math.round(x + w)); i += 1) {
          punto(i, j, estilo, alfa);
        }
      }
    },
    clearRect(x, y, w, h) { const e = estilo; estilo = [0, 0, 0]; ctx.fillRect(x, y, w, h); estilo = e; },
    save() {}, restore() {},
  };
  return { ctx, pixeles };
}

/**
 * Cuantiza a 255 colores por frecuencia, con el más cercano para el resto.
 *
 * Los índices salen DESPLAZADOS EN UNO: `codificarPngIndexado` reserva la
 * entrada 0 de la paleta como hueco transparente (`tRNS`), así que el primer
 * color de verdad es el 1. Sin ese desplazamiento, el color más frecuente
 * —normalmente el fondo— se pinta como agujero y la imagen sale en blanco.
 */
function aIndexado(pixeles, ancho, alto) {
  const conteo = new Map();
  for (let i = 0; i < pixeles.length; i += 3) {
    const k = (pixeles[i] << 16) | (pixeles[i + 1] << 8) | pixeles[i + 2];
    conteo.set(k, (conteo.get(k) ?? 0) + 1);
  }
  const paletaClaves = [...conteo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 255).map((e) => e[0]);
  // `codificarPngIndexado` quiere la paleta en hexadecimal de seis dígitos,
  // no en tripletas: se guarda el RGB para medir distancias y se convierte al
  // final.
  const rgb = paletaClaves.map((k) => [(k >> 16) & 255, (k >> 8) & 255, k & 255]);
  const paleta = rgb.map(([r, g, b]) =>
    `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`);
  const cache = new Map(paletaClaves.map((k, i) => [k, i]));
  const indices = new Uint8Array(ancho * alto);
  for (let p = 0; p < ancho * alto; p += 1) {
    const i = p * 3;
    const k = (pixeles[i] << 16) | (pixeles[i + 1] << 8) | pixeles[i + 2];
    let idx = cache.get(k);
    if (idx === undefined) {
      let mejor = 0, mejorD = Infinity;
      for (let c = 0; c < rgb.length; c += 1) {
        const d = (rgb[c][0] - pixeles[i]) ** 2 + (rgb[c][1] - pixeles[i + 1]) ** 2
          + (rgb[c][2] - pixeles[i + 2]) ** 2;
        if (d < mejorD) { mejorD = d; mejor = c; }
      }
      idx = mejor;
      cache.set(k, idx);
    }
    indices[p] = idx + 1;
  }
  return { indices, paleta };
}

/** Compone una escena con el motor real y la guarda como PNG. */
export function renderizar(escena, destino) {
  const { ancho, alto } = escena;
  const { ctx, pixeles } = crearLienzo(ancho, alto);
  const dibujados = pintarEscena(ctx, escena, { fondo: "#0b0f14" });
  const { indices, paleta } = aIndexado(pixeles, ancho, alto);
  writeFileSync(destino, Buffer.from(codificarPngIndexado({ ancho, alto, indices, paleta })));
  return { dibujados, colores: paleta.length };
}
