import assert from "node:assert/strict";
import test from "node:test";

import {
  activarLibro,
  cerrarLibro,
  estadoLibroAhora,
  reiniciarLibroParaPruebas,
} from "../scripts/libro-sesion.mjs";
import { FASE_ABIERTO, FASE_CERRADO } from "../scripts/libro-estado.mjs";

test.beforeEach(() => reiniciarLibroParaPruebas());

test("la sesión arranca cerrada", () => {
  assert.equal(estadoLibroAhora(0).fase, FASE_CERRADO);
});

test("activarLibro abre, y estadoLibroAhora refleja el paso del tiempo", () => {
  activarLibro({ totalPaginas: 5, reducirMovimiento: true, ahoraMs: 1000 });
  const estado = estadoLibroAhora(1000);
  assert.equal(estado.fase, FASE_ABIERTO, "con reducirMovimiento la transición es instantánea");
});

test("cerrarLibro resetea sin animar, aunque estuviera abierto", () => {
  activarLibro({ totalPaginas: 5, reducirMovimiento: true, ahoraMs: 0 });
  assert.equal(estadoLibroAhora(0).fase, FASE_ABIERTO);
  cerrarLibro();
  assert.equal(estadoLibroAhora(0).fase, FASE_CERRADO);
});

test("la sesión es efímera: reiniciarLibroParaPruebas la deja como recién cargada", () => {
  activarLibro({ totalPaginas: 5, reducirMovimiento: true, ahoraMs: 0 });
  reiniciarLibroParaPruebas();
  assert.equal(estadoLibroAhora(0).fase, FASE_CERRADO);
});
