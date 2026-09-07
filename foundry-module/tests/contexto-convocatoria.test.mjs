import assert from "node:assert/strict";
import test from "node:test";

import {
  CONTEXTOS_CONVOCATORIA,
  contextoConvocatoria,
  destinosConvocables,
} from "../scripts/contexto-convocatoria.mjs";

test("declara playa como descanso y museo como briefing", () => {
  assert.deepEqual(destinosConvocables(), ["playa", "museo"]);
  assert.deepEqual(contextoConvocatoria("playa"), CONTEXTOS_CONVOCATORIA.playa);
  assert.equal(contextoConvocatoria("playa").actividad, "descanso");
  assert.equal(contextoConvocatoria("museo").actividad, "briefing");
});

test("el catálogo es inmutable y rechaza destinos desconocidos", () => {
  const context = contextoConvocatoria("museo");
  assert.throws(() => {
    context.actividad = "orden";
  }, TypeError);
  assert.throws(() => contextoConvocatoria("playa-real"), /destino/i);
  assert.deepEqual(destinosConvocables(), ["playa", "museo"]);
});
