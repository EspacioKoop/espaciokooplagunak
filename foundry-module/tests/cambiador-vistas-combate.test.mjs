import assert from "node:assert/strict";
import test from "node:test";

import {
  VISTAS_COMBATE,
  atajoVista,
  siguienteVista,
  normalizarVista,
} from "../scripts/cambiador-vistas-combate.mjs";

test("normalizarVista y siguienteVista usan el ciclo táctico completo", () => {
  assert.deepEqual(VISTAS_COMBATE, ["tactica", "pov", "tercera", "libre"]);
  assert.equal(normalizarVista("inexistente"), "tactica");
  assert.equal(siguienteVista("tactica"), "pov");
  assert.equal(siguienteVista("libre"), "tactica");
});

test("atajoVista traduce teclas de combate y deja pasar teclas ajenas", () => {
  assert.equal(atajoVista("1"), "tactica");
  assert.equal(atajoVista("2"), "pov");
  assert.equal(atajoVista("3"), "tercera");
  assert.equal(atajoVista("4"), "libre");
  assert.equal(atajoVista("v"), "pov");
  assert.equal(atajoVista("x"), null);
});

test("el ciclo no muta la vista recibida", () => {
  const view = "tercera";
  assert.equal(siguienteVista(view), "libre");
  assert.equal(view, "tercera");
});

test("atajoVista rechaza claves heredadas del prototipo (prototype pollution)", () => {
  assert.equal(atajoVista("constructor"), null);
  assert.equal(atajoVista("__proto__"), null);
  assert.equal(atajoVista("toString"), null);
});
