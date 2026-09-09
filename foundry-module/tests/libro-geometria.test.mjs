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

test("la hoja pasa por la vertical entre ambas tapas de un libro abierto plano", () => {
  const span = (vuelo) => {
    const ys = libroGeometria(Math.PI, vuelo).vertices.slice(...HOJA).map(v=>v[1]);
    return Math.max(...ys)-Math.min(...ys);
  };
  assert.ok(span(Math.PI/2)>span(0)+0.1);
  assert.ok(span(Math.PI/2)>span(Math.PI)+0.1);
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


test("las tapas cierran juntas y la hoja recorre el ángulo interior completo", () => {
  for(const apertura of [0, Math.PI/2, Math.PI]) {
    const m=libroGeometria(apertura,0);
    // Centros de los bordes libres: a izquierda y derecha de la bisagra.
    const centro=(vertices)=>[0,1,2].map(i=>vertices.reduce((n,v)=>n+v[i],0)/vertices.length);
    const left=centro([1,2,5,6].map(i=>m.vertices[i]));
    const right=centro([9,10,13,14].map(i=>m.vertices[i]));
    assert.ok(Math.abs(left[1]-right[1])<1e-9);
    assert.ok(Math.abs(left[0]+right[0])<1e-9);
    for(const [vuelo,target] of [[0,left],[apertura,right]]) {
      const hoja=libroGeometria(apertura,vuelo);
      const edge=centro([25,26,29,30].map(i=>hoja.vertices[i]));
      assert.ok(Math.abs(edge[0]-target[0])<1e-9);
      assert.ok(Math.abs(edge[1]+0.02-target[1])<1e-9);
    }
  }
});
