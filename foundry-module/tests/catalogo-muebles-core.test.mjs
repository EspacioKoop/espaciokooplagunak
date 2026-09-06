import assert from "node:assert/strict";
import test from "node:test";

import { validarCatalogoMuebles, CATALOGO_MUEBLES } from "../scripts/catalogo-muebles.mjs";

test("catalogo de muebles pasa validacion", () => {
  assert.doesNotThrow(() => validarCatalogoMuebles(CATALOGO_MUEBLES));
});

test("cada entrada tiene nombre y cartela localizados", () => {
  for (const mueble of CATALOGO_MUEBLES.muebles) {
    assert.ok(mueble.nombre && typeof mueble.nombre === "object");
    assert.ok(mueble.nombre.es && typeof mueble.nombre.es === "string");
    assert.ok(mueble.nombre.en && typeof mueble.nombre.en === "string");
    assert.ok(mueble.cartela && typeof mueble.cartela === "object");
    assert.ok(mueble.cartela.es && typeof mueble.cartela.es === "string");
    assert.ok(mueble.cartela.en && typeof mueble.cartela.en === "string");
    assert.ok(typeof mueble.naturaleza === "string");
    assert.ok(typeof mueble.malla === "string");
    // malla should be a valid ID (no extension, no slashes)
    assert.ok(/^[a-z0-9][a-z0-9_-]*$/.test(mueble.malla));
  }
});