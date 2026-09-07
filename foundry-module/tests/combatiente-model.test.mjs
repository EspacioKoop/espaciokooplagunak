import assert from "node:assert/strict";
import test from "node:test";

import {
  ALINEACIONES,
  OVERLAYS,
  aplicarOverlays,
  normalizarCombatiente,
  serializarCombatiente,
} from "../scripts/combatiente-model.mjs";

test("normalizarCombatiente separa presentación del estado de combate y conserva identidad estable", () => {
  const input = {
    id: "npc-42",
    nombre: "Nereida",
    alineacion: "aliado",
    base: {
      nombre: "Nereida",
      icono: "fas fa-shield",
      avatar: "avatar-nereida.png",
    },
    shiny: {
      color: "azul",
      brillo: 0.7,
    },
    estado: {
      iniciativa: 14,
      vida: 12,
      maxVida: 20,
    },
  };

  const result = normalizarCombatiente(input);

  assert.deepEqual(result.id, "npc-42");
  assert.equal(result.alineacion, "aliado");
  assert.deepEqual(result.base, input.base);
  assert.deepEqual(result.shiny, input.shiny);
  assert.deepEqual(result.estado, input.estado);
  assert.deepEqual(result.overlays, {
    herido: false,
    ventaja: false,
    concentracionRota: false,
    muerto: false,
  });
  assert.notStrictEqual(result, input);
});

test("aplicarOverlays conserva shiny/base y no muta la entrada", () => {
  const input = {
    id: "pc-99",
    nombre: "Toma",
    alineacion: "enemigo",
    base: { nombre: "Toma", icono: "fas fa-sword" },
    shiny: { color: "verde", brillo: 0.9 },
    estado: { iniciativa: 9 },
    overlays: { herido: false },
  };
  const original = structuredClone(input);

  const result = aplicarOverlays(input, {
    herido: true,
    ventaja: true,
    muerto: false,
  });

  assert.deepEqual(input, original);
  assert.deepEqual(result.base, input.base);
  assert.deepEqual(result.shiny, input.shiny);
  assert.equal(result.overlays.herido, true);
  assert.equal(result.overlays.ventaja, true);
  assert.equal(result.overlays.muerto, false);
});

test("normalizarCombatiente acepta estados combinados y deja valores desconocidos sin inventar alineación", () => {
  const result = normalizarCombatiente({
    id: "npc-3",
    alineacion: "neutral",
    overlays: {
      herido: true,
      ventaja: "no-es-booleano",
      concentracionRota: false,
      muerto: undefined,
    },
    base: { nombre: "Ari" },
    shiny: { textura: "madera" },
  });

  assert.equal(result.alineacion, "neutral");
  assert.equal(result.overlays.herido, true);
  assert.equal(result.overlays.concentracionRota, false);
  // Un valor desconocido (ni true ni false) se conserva como null/ausente,
  // distinto de un false explícito.
  assert.equal(result.overlays.ventaja, null);
  assert.equal(result.overlays.muerto, null);

  const invalid = normalizarCombatiente({ id: "npc-4", alineacion: "desconocida", base: { nombre: "X" } });
  assert.equal(invalid.alineacion, null);
  assert.equal(invalid.nombre, "X");
  assert.deepEqual(ALINEACIONES, ["aliado", "enemigo", "neutral"]);
  assert.deepEqual(OVERLAYS, ["herido", "ventaja", "concentracionRota", "muerto"]);
});

test("un overlay null o desconocido se conserva como null, distinto de false explícito", () => {
  const result = normalizarCombatiente({
    id: "a",
    overlays: { herido: null, ventaja: "unknown" },
  });

  assert.equal(result.overlays.herido, null);
  assert.equal(result.overlays.ventaja, null);
  // Las claves ausentes de la entrada siguen usando el default false.
  assert.equal(result.overlays.concentracionRota, false);
  assert.equal(result.overlays.muerto, false);

  for (const overlay of OVERLAYS) {
    assert.equal(
      normalizarCombatiente({ id: "x", overlays: { [overlay]: true } }).overlays[overlay],
      true,
    );
    assert.equal(
      normalizarCombatiente({ id: "x", overlays: { [overlay]: false } }).overlays[overlay],
      false,
    );
    assert.equal(
      normalizarCombatiente({ id: "x", overlays: { [overlay]: "unknown" } }).overlays[overlay],
      null,
    );
  }
});

test("aplicarOverlays actualiza solo las claves aportadas y conserva las demás", () => {
  const combatiente = { id: "a", overlays: { herido: true } };
  const result = aplicarOverlays(combatiente, { ventaja: true });

  assert.equal(result.overlays.herido, true, "herido no debe borrarse al aplicar otra capa");
  assert.equal(result.overlays.ventaja, true);
});

test("serializarCombatiente produce una copia segura para JSON y maneja entrada incompleta", () => {
  const result = normalizarCombatiente({
    id: "npc-5",
    base: { nombre: "Zafiro" },
    shimmery: { color: "rojo" },
  });

  const serialized = serializarCombatiente(result);
  const parsed = JSON.parse(serialized);

  assert.equal(parsed.id, "npc-5");
  assert.equal(parsed.alineacion, null);
  assert.equal(parsed.base.nombre, "Zafiro");
  assert.deepEqual(parsed.overlays, {
    herido: false,
    ventaja: false,
    concentracionRota: false,
    muerto: false,
  });
  assert.deepEqual(JSON.parse(serialized), parsed);
});
