import assert from "node:assert/strict";
import test from "node:test";

import { libroGeometria } from "../scripts/libro-geometria.mjs";

// Layout de vértices por pieza (ver libroGeometria): 0-7 tapa izq, 8-15 tapa der,
// 16-23 lomo, 24-31 hoja.
const TAPA_IZQ = [0, 8];
const TAPA_DER = [8, 16];
const LOMO = [16, 24];
const HOJA = [24, 32];

function rangoX(malla) {
  const xs = malla.vertices.map((v) => v[0]);
  return [Math.min(...xs), Math.max(...xs)];
}

function maxY(malla, [desde, hasta]) {
  return Math.max(...malla.vertices.slice(desde, hasta).map((v) => v[1]));
}

test("la malla tiene la cuenta de presupuesto (32 vértices, 24 caras)", () => {
  const m = libroGeometria(Math.PI / 2, Math.PI / 4);
  assert.equal(m.vertices.length, 32);
  assert.equal(m.caras.length, 24);
  for (const cara of m.caras) {
    assert.equal(cara.length, 4);
    for (const i of cara) {
      assert.ok(Number.isInteger(i) && i >= 0 && i < m.vertices.length);
    }
  }
});

test("libro cerrado (0) deja las tapas verticales y coincidentes en el lomo", () => {
  const m = libroGeometria(0, 0);
  const [minX, maxX] = rangoX(m);
  // Todas las piezas cuelgan de la bisagra (x=0) y quedan verticales: |x| ≤ grosor/2.
  assert.ok(minX >= -0.01 - 1e-9, `x mínima inesperada: ${minX}`);
  assert.ok(maxX <= 0.01 + 1e-9, `x máxima inesperada: ${maxX}`);
});

test("abierto plano (π) separa las tapas a ambos lados del lomo", () => {
  const m = libroGeometria(Math.PI, Math.PI / 2);
  const [minX, maxX] = rangoX(m);
  assert.ok(minX < -0.18, `la tapa izquierda no se abre: minX=${minX}`);
  assert.ok(maxX > 0.18, `la tapa derecha no se abre: maxX=${maxX}`);
});

test("la hoja gira de vertical (0) a tumbada (apertura)", () => {
  const vertical = libroGeometria(Math.PI / 2, 0);
  const tumbada = libroGeometria(Math.PI / 2, Math.PI / 2);
  const span = (m) => {
    const ys = m.vertices.slice(...HOJA).map((v) => v[1]);
    return Math.max(...ys) - Math.min(...ys);
  };
  // Vertical (hojaVuelo=0): la hoja se levanta y queda de pie, recorre alto en y.
  // Tumbada (hojaVuelo=apertura): yace plana sobre las tapas, recorre poco en y.
  const spanVertical = span(vertical);
  const spanTumbada = span(tumbada);
  assert.ok(
    spanVertical > spanTumbada + 0.1,
    `la hoja no recorre: span vertical ${spanVertical} vs tumbada ${spanTumbada}`,
  );
});

test("parámetros no finitos o no positivos lanzan", () => {
  assert.throws(() => libroGeometria(NaN, 0), TypeError);
  assert.throws(() => libroGeometria(0, NaN), TypeError);
  assert.throws(() => libroGeometria(0, 0, -0.1), RangeError);
  assert.throws(() => libroGeometria(0, 0, 0.2, 0), RangeError);
});

test("la malla es determinista para el mismo estado", () => {
  const a = libroGeometria(1.2, 0.6, 0.2, 0.15, 0.02);
  const b = libroGeometria(1.2, 0.6, 0.2, 0.15, 0.02);
  assert.deepEqual(a.vertices, b.vertices);
  assert.deepEqual(a.caras, b.caras);
});
