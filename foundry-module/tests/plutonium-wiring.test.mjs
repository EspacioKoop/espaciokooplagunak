import { test } from "node:test";
import assert from "node:assert/strict";

import { plutoniumDisponible, contenidoDelMundo } from "../scripts/plutonium-wiring.mjs";

test("plutoniumDisponible es false sin gameGlobal", () => {
  assert.equal(plutoniumDisponible(undefined), false);
  assert.equal(plutoniumDisponible({}), false);
});

test("plutoniumDisponible es false si el módulo existe pero no está activo", () => {
  const gameGlobal = { modules: new Map([["plutonium", { active: false }]]) };
  assert.equal(plutoniumDisponible(gameGlobal), false);
});

test("plutoniumDisponible es true solo si el módulo está activo", () => {
  const gameGlobal = { modules: new Map([["plutonium", { active: true }]]) };
  assert.equal(plutoniumDisponible(gameGlobal), true);
});

test("contenidoDelMundo se degrada a colecciones vacías sin plutonium activo", () => {
  assert.deepEqual(contenidoDelMundo(undefined), { actores: [], items: [] });
  assert.deepEqual(contenidoDelMundo({}), { actores: [], items: [] });
});

test("contenidoDelMundo lee actors/items del mundo cuando plutonium está activo", () => {
  const gameGlobal = {
    modules: new Map([["plutonium", { active: true }]]),
    actors: { contents: [{ id: "a1" }] },
    items: { contents: [{ id: "i1" }] },
  };
  assert.deepEqual(contenidoDelMundo(gameGlobal), {
    actores: [{ id: "a1" }],
    items: [{ id: "i1" }],
  });
});
