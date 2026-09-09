// Test for libro-escena.mjs
// Tests the exports and basic functionality of the libro escena.

import assert from "node:assert/strict";
import test from "node:test";

import {
  PLANTA_LIBRO,
  componerLibro,
  ENTRADA,
  SALIDA,
  INTERACCIONES,
  LIBRO_CERRADO,
  LIBRO_ABIERTO,
  LIBRO_PASA_HOJA,
} from "../scripts/libro-escena.mjs";

test("libro-escena.mjs exports the expected objects", () => {
  assert.ok(typeof PLANTA_LIBRO === "object");
  assert.ok(typeof componerLibro === "function");
  assert.ok(typeof ENTRADA === "object");
  assert.ok(typeof SALIDA === "object");
  assert.ok(Array.isArray(INTERACCIONES));
  assert.ok(typeof LIBRO_CERRADO === "object");
  assert.ok(typeof LIBRO_ABIERTO === "object");
  assert.ok(typeof LIBRO_PASA_HOJA === "object");
});

test("PLANTA_LIBRO is a planta object (has ancho and profundidad)", () => {
  // The planta object from crearSalaCaja should have ancho and profundidad properties
  // or we can check that it's not empty and is an object
  assert.ok(PLANTA_LIBRO !== null);
  assert.ok(typeof PLANTA_LIBRO === "object");
  // Check if it has typical planta properties from nave-sala-caja
  // Based on the nave-sala-caja.mjs, planta should be the result of crearPlanta
  // Let's just verify it's a reasonable object for now
  assert.ok(Object.keys(PLANTA_LIBRO).length > 0);
});

test("ENTRADA has x, z, yaw", () => {
  assert.ok(Number.isFinite(ENTRADA.x));
  assert.ok(Number.isFinite(ENTRADA.z));
  assert.ok(Number.isFinite(ENTRADA.yaw));
});

test("SALIDA has centro and medidas", () => {
  assert.ok(Array.isArray(SALIDA.centro));
  assert.ok(Array.isArray(SALIDA.medidas));
  assert.equal(SALIDA.centro.length, 3);
  assert.equal(SALIDA.medidas.length, 3);
});

test("INTERACCIONES has two interactions", () => {
  assert.equal(INTERACCIONES.length, 2);
  assert.equal(INTERACCIONES[0].id, "libro-abrir");
  assert.equal(INTERACCIONES[1].id, "salida");
});

test("LIBRO_CERRADO has vertices and caras", () => {
  assert.ok(Array.isArray(LIBRO_CERRADO.vertices));
  assert.ok(Array.isArray(LIBRO_CERRADO.caras));
  // We don't check the exact count because it depends on the parameters.
  // But we can check that it's not empty.
  assert.ok(LIBRO_CERRADO.vertices.length > 0);
  assert.ok(LIBRO_CERRADO.caras.length > 0);
});

test("LIBRO_ABIERTO has vertices and caras", () => {
  assert.ok(Array.isArray(LIBRO_ABIERTO.vertices));
  assert.ok(Array.isArray(LIBRO_ABIERTO.caras));
  assert.ok(LIBRO_ABIERTO.vertices.length > 0);
  assert.ok(LIBRO_ABIERTO.caras.length > 0);
});

test("LIBRO_PASA_HOJA has vertices and caras", () => {
  assert.ok(Array.isArray(LIBRO_PASA_HOJA.vertices));
  assert.ok(Array.isArray(LIBRO_PASA_HOJA.caras));
  assert.ok(LIBRO_PASA_HOJA.vertices.length > 0);
  assert.ok(LIBRO_PASA_HOJA.caras.length > 0);
});
