import assert from "node:assert/strict";
import test from "node:test";

import {
  COLORES_TARJETA,
  renderizarTarjetaCombatiente,
} from "../scripts/combatiente-pixelart.mjs";

test("renderizarTarjetaCombatiente produce un bitmap lógico determinista", () => {
  const input = {
    id: "ship-1",
    nombre: "Navegante",
    alineacion: "aliado",
    shiny: false,
    overlays: [],
  };

  const first = renderizarTarjetaCombatiente(input);
  const second = renderizarTarjetaCombatiente(input);

  assert.deepEqual(first, second);
  assert.deepEqual({ width: first.width, height: first.height }, { width: 32, height: 40 });
  assert.equal(first.pixels.length, 32 * 40);
  assert.equal(first.pixels[0], COLORES_TARJETA.aliado.marco);
  assert.equal(first.pixels[9 + 11 * 32], COLORES_TARJETA.aliado.retrato);
});

test("shiny y overlays se pintan como capas visibles sin mutar el combatiente", () => {
  const input = {
    id: "ship-2",
    nombre: "Ingeniera",
    alineacion: "neutral",
    shiny: true,
    overlays: ["herido", "concentracion-rota"],
  };
  const original = structuredClone(input);
  const image = renderizarTarjetaCombatiente(input);

  assert.deepEqual(input, original);
  assert.equal(image.layers.shiny, true);
  assert.deepEqual(image.layers.overlays, ["herido", "concentracion-rota"]);
  assert.equal(image.pixels[0], COLORES_TARJETA.shiny.marco);
  assert.ok(image.pixels.includes(COLORES_TARJETA.overlays.herido));
  assert.ok(image.pixels.includes(COLORES_TARJETA.overlays["concentracion-rota"]));
});

test("valores desconocidos caen a una tarjeta neutral y no rompen el render", () => {
  const image = renderizarTarjetaCombatiente({ alineacion: "desconocida", overlays: ["otro"] });

  assert.equal(image.alineacion, "neutral");
  assert.deepEqual(image.layers.overlays, []);
  assert.equal(image.pixels[0], COLORES_TARJETA.neutral.marco);
});
