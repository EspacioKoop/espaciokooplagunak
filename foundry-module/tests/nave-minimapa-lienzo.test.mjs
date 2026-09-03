// Test del pintor del minimapa de la nave (#945).
//
// Se sigue el mismo patrón que seccion-lienzo.test.mjs: un ctx falso que
// registra las llamadas en lugar de dibujar en un lienzo real.

import assert from "node:assert/strict";
import test from "node:test";

import { pintarMinimapa } from "../scripts/nave-minimapa-lienzo.mjs";
import { SECCION } from "../scripts/paleta.mjs";
import { medidas, cajaEnPixeles } from "../scripts/seccion-lienzo.mjs";

/** Contexto 2D de mentira que registra llamadas y estilos. */
function ctxFalso() {
  return {
    fillStyle: null,
    strokeStyle: null,
    lineWidth: 0,
    clearRectCalls: [],
    fillRectCalls: [],
    strokeRectCalls: [],
    fillRect(x, y, w, h) {
      this.fillRectCalls.push({ x, y, w, h, estilo: this.fillStyle });
    },
    strokeRect(x, y, w, h) {
      this.strokeRectCalls.push({ x, y, w, h, estilo: this.strokeStyle, lineWidth: this.lineWidth });
    },
    clearRect(x, y, w, h) {
      this.clearRectCalls.push({ x, y, w, h });
    }
  };
}

/** Modelo básico de nave con una sala en (0,0) de 1x1 celda. */
function modeloUnaSala(conSistema = true, actual = false) {
  return {
    columnas: 1,
    filas: 1,
    salas: [{
      caja: { x: 0, y: 0, ancho: 1, alto: 1 },
      conSistema,
      actual
    }]
  };
}

/** Modelo con dos salas: una actual y otra no. */
function modeloDosSalas() {
  return {
    columnas: 2,
    filas: 1,
    salas: [
      {
        caja: { x: 0, y: 0, ancho: 1, alto: 1 },
        conSistema: true,
        actual: true   // primera sala es la actual
      },
      {
        caja: { x: 1, y: 0, ancho: 1, alto: 1 },
        conSistema: false,
        actual: false  // segunda sala no es actual
      }
    ]
  };
}

test("clearRect se llama una vez cubriendo todo el canvas", () => {
  const ctx = ctxFalso();
  const modelo = modeloUnaSala();
  // canvas ancho 100, alto 50 (valores arbitrarios)
  const canvas = { width: 100, height: 50 };
  pintarMinimapa({ ...ctx, canvas }, modelo);
  assert.equal(ctx.clearRectCalls.length, 1);
  const { x, y, w, h } = ctx.clearRectCalls[0];
  assert.equal(x, 0);
  assert.equal(y, 0);
  assert.equal(w, 100);
  assert.equal(h, 50);
});

test("sala con conSistema: true se pinta con SECCION.mamparo", () => {
  const ctx = ctxFalso();
  const modelo = modeloUnaSala(true, false);
  const canvas = { width: 20, height: 20 };
  pintarMinimapa({ ...ctx, canvas }, modelo);
  assert.equal(ctx.fillRectCalls.length, 1);
  const { estilo } = ctx.fillRectCalls[0];
  assert.equal(estilo, SECCION.mamparo);
});

test("sala con conSistema: false (o ausente) se pinta con SECCION.casco", () => {
  const ctx = ctxFalso();
  const modelo = modeloUnaSala(false, false);
  const canvas = { width: 20, height: 20 };
  pintarMinimapa({ ...ctx, canvas }, modelo);
  assert.equal(ctx.fillRectCalls.length, 1);
  const { estilo } = ctx.fillRectCalls[0];
  assert.equal(estilo, SECCION.casco);
});

test("sala actual recibe DOS fillRect (base + SECCION.entrable) y un strokeRect", () => {
  const ctx = ctxFalso();
  const modelo = modeloUnaSala(true, true); // con sistema y actual
  const canvas = { width: 40, height: 40 };
  pintarMinimapa({ ...ctx, canvas }, modelo);
  // Esperamos dos fillRect: primero el color de fondo, segundo el entrable
  assert.equal(ctx.fillRectCalls.length, 2);
  // primero fondo (conSistema true -> mamparo)
  assert.equal(ctx.fillRectCalls[0].estilo, SECCION.mamparo);
  // segundo entrable
  assert.equal(ctx.fillRectCalls[1].estilo, SECCION.entrable);
  // un strokeRect
  assert.equal(ctx.strokeRectCalls.length, 1);
  const { estilo, lineWidth } = ctx.strokeRectCalls[0];
  assert.equal(estilo, "#ffffff");
  assert.equal(lineWidth, 1);
});

test("sala que no es actual no genera strokeRect", () => {
  const ctx = ctxFalso();
  const modelo = modeloUnaSala(true, false); // con sistema pero no actual
  const canvas = { width: 40, height: 40 };
  pintarMinimapa({ ...ctx, canvas }, modelo);
  assert.equal(ctx.strokeRectCalls.length, 0);
});

test("el margen JUNTA se refleja en las dimensiones pasadas a fillRect", () => {
  const columnas = 10;
  const filas = 10;
  const anchoCanvas = 500;
  const altoCanvas = 500;
  const sala = { caja: { x: 0, y: 0, ancho: 1, alto: 1 }, conSistema: true, actual: false };
  const modelo = {
    columnas,
    filas,
    salas: [sala]
  };
  const m = medidas({ ancho: anchoCanvas, alto: altoCanvas, rejilla: { columnas, filas } });
  const cajaEsperada = cajaEnPixeles(sala.caja, m);
  const ctx = ctxFalso();
  const canvas = { width: anchoCanvas, height: altoCanvas };
  pintarMinimapa({ ...ctx, canvas }, modelo);
  assert.equal(ctx.fillRectCalls.length, 1);
  const { x, y, w, h } = ctx.fillRectCalls[0];
  // Esperamos que el fillRect esté desplazado por JUNTA respecto a la caja de píxeles
  const JUNTA = 1;
  assert.equal(x, cajaEsperada.x + JUNTA);
  assert.equal(y, cajaEsperada.y + JUNTA);
  // ancho y alto deben ser el tamaño de la caja menos 2*JUNTA (mínimo 1)
  const anchoEsperado = Math.max(1, cajaEsperada.ancho - JUNTA * 2);
  const altoEsperado = Math.max(1, cajaEsperada.alto - JUNTA * 2);
  assert.equal(w, anchoEsperado);
  assert.equal(h, altoEsperado);
});
