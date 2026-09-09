import assert from "node:assert/strict";
import test from "node:test";

import {
  aplicarHito,
  normalizarProgresion,
  serializarProgresion,
} from "../scripts/progresion-campana.mjs";

test("normalizarProgresion crea una capa persistente sin estado de combate", () => {
  const input = {
    id: "hero-1",
    nivel: 1,
    hitos: ["first-voyage"],
    shiny: { tier: "bronze", accent: "#d28b45" },
    overlay: { wounded: true },
  };
  const original = structuredClone(input);

  const progression = normalizarProgresion(input);

  assert.deepEqual(input, original);
  assert.deepEqual(progression, {
    id: "hero-1",
    nivel: 1,
    hitos: ["first-voyage"],
    shiny: { tier: "bronze", accent: "#d28b45" },
  });
});

test("aplicarHito es idempotente y deriva el shiny de hitos conocidos", () => {
  let progression = normalizarProgresion({ id: "hero-1" });

  progression = aplicarHito(progression, "first-voyage");
  assert.equal(progression.nivel, 1);
  assert.deepEqual(progression.hitos, ["first-voyage"]);
  assert.equal(progression.shiny.tier, "bronze");

  const repeated = aplicarHito(progression, "first-voyage");
  assert.deepEqual(repeated, progression);

  const advanced = aplicarHito(progression, "veteran");
  assert.equal(advanced.nivel, 3);
  assert.equal(advanced.shiny.tier, "gold");
});

test("serializarProgresion conserva solo el contrato persistente", () => {
  const text = serializarProgresion({
    id: "hero-1",
    nivel: 3,
    hitos: ["first-voyage", "veteran"],
    shiny: { tier: "gold", accent: "#f2c14e" },
    estadoCombate: "dead",
  });

  const parsed = JSON.parse(text);
  assert.equal(parsed.id, "hero-1");
  assert.equal(parsed.nivel, 3);
  assert.deepEqual(parsed.hitos, ["first-voyage", "veteran"]);
  assert.equal(parsed.shiny.tier, "gold");
  assert.equal(parsed.estadoCombate, undefined);
});

test("rechaza hitos heredados del prototipo (prototype pollution)", () => {
  const progression = normalizarProgresion({ id: "hero-1", hitos: ["constructor"] });
  assert.equal(progression.nivel, 0);
  assert.deepEqual(progression.hitos, []);
  assert.equal(Number.isNaN(progression.nivel), false);

  assert.throws(() => aplicarHito({ id: "hero-1" }, "__proto__"), TypeError);
  assert.throws(() => aplicarHito({ id: "hero-1" }, "constructor"), TypeError);
});
