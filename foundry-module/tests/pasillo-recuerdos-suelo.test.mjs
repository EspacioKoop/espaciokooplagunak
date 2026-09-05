import assert from "node:assert/strict";
import test from "node:test";

import { PASILLO } from "../scripts/paleta.mjs";
import { rejillaPasillo, piezasSueloPasillo } from "../scripts/pasillo-recuerdos-suelo.mjs";

const COLUMNAS = 60; // 6 m, el ancho del pasillo
const FILAS = 200; // 20 m, un tramo largo para que quepan varios cuervos

test("el suelo no usa ni un tono que no sea suyo", () => {
  const permitidos = new Set([
    PASILLO.marmol,
    PASILLO.marmolJunta,
    PASILLO.alfombra,
    PASILLO.alfombraOrla,
    PASILLO.cuervo,
  ]);
  for (const fila of rejillaPasillo(COLUMNAS, FILAS)) {
    for (const color of fila) assert.ok(permitidos.has(color), `tono ajeno: ${color}`);
  }
});

test("no queda ni una celda sin pintar", () => {
  for (const fila of rejillaPasillo(COLUMNAS, FILAS)) {
    assert.ok(fila.every((color) => color !== null));
  }
});

test("la alfombra queda centrada y de punta a punta", () => {
  const rejilla = rejillaPasillo(COLUMNAS, FILAS);
  for (const fila of rejilla) {
    assert.ok(fila.includes(PASILLO.alfombra), "falta alfombra en alguna fila");
  }
  // Simétrica respecto al centro: la columna más a la izquierda con alfombra y
  // la más a la derecha están a la misma distancia del centro del pasillo.
  const fila = rejilla[10];
  const primera = fila.indexOf(PASILLO.alfombra);
  const ultima = fila.lastIndexOf(PASILLO.alfombra);
  const centro = (COLUMNAS - 1) / 2;
  assert.ok(Math.abs((primera - centro) + (ultima - centro)) < 1, "la alfombra no está centrada");
});

test("el cuervo aparece repetido y siempre igual, sin semilla", () => {
  const rejilla = rejillaPasillo(COLUMNAS, FILAS);
  const filasConCuervo = rejilla
    .map((fila, v) => (fila.includes(PASILLO.cuervo) ? v : -1))
    .filter((v) => v >= 0);
  assert.ok(filasConCuervo.length > 5, "no se repite lo bastante en 20 m de pasillo");

  const otraLlamada = rejillaPasillo(COLUMNAS, FILAS);
  assert.deepEqual(rejilla, otraLlamada, "el dibujo tiene que ser determinista");
});

test("una piel demasiado estrecha para la alfombra no revienta, se queda sin ella", () => {
  const rejilla = rejillaPasillo(15, FILAS); // menos que ANCHO_ALFOMBRA (20)
  for (const fila of rejilla) {
    assert.ok(!fila.includes(PASILLO.alfombra), "no debería caber alfombra en un pasillo tan estrecho");
    assert.ok(!fila.includes(PASILLO.cuervo), "no debería caber ningún cuervo sin alfombra");
  }
});

test("piezasSueloPasillo devuelve piezas usables", () => {
  const piezas = piezasSueloPasillo({ ancho: 6, profundidad: 20 });
  assert.ok(piezas.length > 0);
  for (const { malla, color } of piezas) {
    assert.ok(Array.isArray(malla.vertices) && malla.vertices.length > 0);
    assert.ok(Array.isArray(malla.caras) && malla.caras.length > 0);
    assert.equal(typeof color, "string");
  }
});

test("una sala demasiado pequeña para una losa no produce piezas", () => {
  assert.deepEqual(piezasSueloPasillo({ ancho: 1, profundidad: 1 }), []);
});
