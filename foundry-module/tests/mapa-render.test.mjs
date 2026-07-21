import assert from "node:assert/strict";
import test from "node:test";

import { dibujarFrame } from "../scripts/mapa-render.mjs";

/**
 * Contexto 2D falso mínimo: cuenta fillRect (la única primitiva que usan
 * tanto el pintor de estrellas/blips como el sprite de nave y los eventos de
 * fondo) y no revienta con el resto de la API de Canvas que dibujarFrame usa
 * incondicionalmente (fondo, retícula).
 */
function ctxFalso() {
  let fillRects = 0;
  return {
    get fillRects() { return fillRects; },
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    font: "",
    textAlign: "",
    textBaseline: "",
    fillRect() { fillRects += 1; },
    beginPath() {},
    closePath() {},
    arc() {},
    stroke() {},
    fill() {},
    fillText() {},
    moveTo() {},
    lineTo() {},
    setLineDash() {},
  };
}

// Regresión #215 (review de #265/#215): dibujarDecorado se llamaba con los
// eventos de fondo activos también en la pantalla "en espera" (frame.sinDatos),
// aunque el decorado en sí llegara vacío. Un evento de fondo (p. ej. una nave
// lejana cruzando el lienzo) seguía pintándose sobre la espera.
test("dibujarFrame no pinta eventos de fondo en la pantalla en espera (frame.sinDatos)", () => {
  const frameSinDatos = { sinDatos: true, capas: [], blips: [], destino: null };
  const eventosFondo = [{ tipo: "nave_lejana", inicioMs: 0, duracionMs: 60000 }];

  const ctx = ctxFalso();
  dibujarFrame(ctx, frameSinDatos, { decorado: [], eventosFondo, tMs: 100 });

  // Solo el fillRect del fondo (línea 1): ni estrellas (capas vacías), ni
  // decorado (lista vacía), ni eventos de fondo (deben omitirse en espera).
  assert.equal(ctx.fillRects, 1);
});

test("dibujarFrame sí pinta eventos de fondo fuera de la pantalla en espera", () => {
  const frameConDatos = { sinDatos: false, capas: [], blips: [], destino: null };
  const eventosFondo = [{ tipo: "nave_lejana", inicioMs: 0, duracionMs: 60000 }];

  const ctxSinEventos = ctxFalso();
  dibujarFrame(ctxSinEventos, frameConDatos, { decorado: [], eventosFondo: [], tMs: 100 });

  const ctxConEventos = ctxFalso();
  dibujarFrame(ctxConEventos, frameConDatos, { decorado: [], eventosFondo, tMs: 100 });

  // El sprite de la nave propia se pinta siempre (fondo + sprite); con el
  // evento de fondo activo debe haber fillRect adicionales.
  assert.ok(ctxConEventos.fillRects > ctxSinEventos.fillRects);
});
