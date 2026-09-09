import assert from "node:assert/strict";
import test from "node:test";

import {
  APERTURA_ABIERTO,
  DURACION_ABRIR_MS,
  DURACION_PASAR_MS,
  FASE_ABIERTO,
  FASE_ABRIENDO,
  FASE_CERRADO,
  FASE_CERRANDO,
  FASE_PASANDO,
  activar,
  actualizar,
  estadoInicial,
} from "../scripts/libro-estado.mjs";

test("el estado inicial es un libro cerrado en la página 0", () => {
  const e = estadoInicial();
  assert.equal(e.fase, FASE_CERRADO);
  assert.equal(e.apertura, 0);
  assert.equal(e.hojaVuelo, 0);
  assert.equal(e.paginaActual, 0);
  assert.equal(e.transicion, null);
});

test("activar sobre cerrado empieza a abrirse", () => {
  const e = activar(estadoInicial(), { ahoraMs: 0, totalPaginas: 5 });
  assert.equal(e.fase, FASE_ABRIENDO);
  assert.ok(e.transicion);
  assert.equal(e.transicion.desde, 0);
  assert.equal(e.transicion.duracion, DURACION_ABRIR_MS);
});

test("actualizar interpola la apertura hasta llegar a abierto", () => {
  let e = activar(estadoInicial(), { ahoraMs: 0, totalPaginas: 5 });
  e = actualizar(e, DURACION_ABRIR_MS / 2);
  assert.equal(e.fase, FASE_ABRIENDO);
  assert.ok(e.apertura > 0 && e.apertura < APERTURA_ABIERTO, `apertura a medio camino: ${e.apertura}`);

  e = actualizar(e, DURACION_ABRIR_MS);
  assert.equal(e.fase, FASE_ABIERTO);
  assert.equal(e.apertura, APERTURA_ABIERTO);
  assert.equal(e.transicion, null);
});

test("una sola hoja en vuelo: activar durante una transición no hace nada", () => {
  const abriendo = activar(estadoInicial(), { ahoraMs: 0, totalPaginas: 5 });
  const otraVez = activar(abriendo, { ahoraMs: 10, totalPaginas: 5 });
  assert.deepEqual(otraVez, abriendo, "activar en medio de una transición debe ser un no-op");
});

test("activar sobre abierto pasa a la siguiente página", () => {
  let e = activar(estadoInicial(), { ahoraMs: 0, totalPaginas: 3 });
  e = actualizar(e, DURACION_ABRIR_MS);
  assert.equal(e.fase, FASE_ABIERTO);
  assert.equal(e.paginaActual, 0);

  e = activar(e, { ahoraMs: 1000, totalPaginas: 3 });
  assert.equal(e.fase, FASE_PASANDO);
  assert.equal(e.transicion.duracion, DURACION_PASAR_MS);

  e = actualizar(e, 1000 + DURACION_PASAR_MS / 2);
  assert.ok(e.hojaVuelo > 0 && e.hojaVuelo < APERTURA_ABIERTO);
  assert.equal(e.apertura, APERTURA_ABIERTO, "la tapa se queda abierta mientras la hoja vuela");

  e = actualizar(e, 1000 + DURACION_PASAR_MS);
  assert.equal(e.fase, FASE_ABIERTO);
  assert.equal(e.paginaActual, 1);
  assert.equal(e.hojaVuelo, 0);
});

test("pasar la última página cierra el libro y resetea todo, página incluida", () => {
  let e = activar(estadoInicial(), { ahoraMs: 0, totalPaginas: 2 });
  e = actualizar(e, DURACION_ABRIR_MS); // abierto, página 0
  e = activar(e, { ahoraMs: 1000, totalPaginas: 2 });
  e = actualizar(e, 1000 + DURACION_PASAR_MS); // abierto, página 1 (la última de 2)
  assert.equal(e.paginaActual, 1);

  e = activar(e, { ahoraMs: 2000, totalPaginas: 2 });
  assert.equal(e.fase, FASE_CERRANDO, "en la última página, activar cierra en vez de pasar");

  e = actualizar(e, 2000 + DURACION_ABRIR_MS);
  assert.deepEqual(e, estadoInicial(), "cerrado del todo: efímero, nada de la lectura sobrevive");
});

test("reducirMovimiento colapsa la transición a duración cero, sin dejar de ser interactuable", () => {
  const e = activar(estadoInicial(), { ahoraMs: 500, totalPaginas: 5, reducirMovimiento: true });
  assert.equal(e.transicion.duracion, 0);
  const acabado = actualizar(e, 500); // mismo instante: sin animación, salta directo
  assert.equal(acabado.fase, FASE_ABIERTO);
  assert.equal(acabado.apertura, APERTURA_ABIERTO);
});

test("actualizar sin transición no cambia nada (misma referencia)", () => {
  const e = estadoInicial();
  assert.equal(actualizar(e, 12345), e);
});

test("activar exige ahoraMs finito y totalPaginas >= 1", () => {
  assert.throws(() => activar(estadoInicial(), { ahoraMs: NaN, totalPaginas: 3 }), TypeError);
  assert.throws(() => activar(estadoInicial(), { ahoraMs: 0, totalPaginas: 0 }), RangeError);
  assert.throws(() => activar(estadoInicial(), { ahoraMs: 0, totalPaginas: -1 }), RangeError);
});

test("actualizar exige ahoraMs finito", () => {
  assert.throws(() => actualizar(estadoInicial(), NaN), TypeError);
});

test("con una sola página, activar sobre abierto cierra en vez de pasar", () => {
  let e = activar(estadoInicial(), { ahoraMs: 0, totalPaginas: 1 });
  e = actualizar(e, DURACION_ABRIR_MS);
  assert.equal(e.fase, FASE_ABIERTO);
  e = activar(e, { ahoraMs: 1000, totalPaginas: 1 });
  assert.equal(e.fase, FASE_CERRANDO);
});
