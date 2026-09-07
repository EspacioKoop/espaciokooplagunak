import assert from "node:assert/strict";
import test from "node:test";

import {
  avanzarTurno,
  anadirCombatiente,
  crearMotorTurnos,
  estadoTurnos,
  retirarCombatiente,
} from "../scripts/motor-turnos.mjs";

const combatientes = [
  { id: "b", iniciativa: 12 },
  { id: "a", iniciativa: 12 },
  { id: "c", iniciativa: 18 },
];

test("crearMotorTurnos ordena iniciativa y desempata por id", () => {
  const state = crearMotorTurnos(combatientes);

  assert.deepEqual(state.orden, ["c", "a", "b"]);
  assert.equal(state.activo, "c");
  assert.equal(state.ronda, 1);
  assert.deepEqual(combatientes, [
    { id: "b", iniciativa: 12 },
    { id: "a", iniciativa: 12 },
    { id: "c", iniciativa: 18 },
  ]);
});

test("avanzarTurno recorre la ronda y aumenta ronda al volver al primero", () => {
  let state = crearMotorTurnos(combatientes);

  state = avanzarTurno(state);
  assert.equal(state.activo, "a");
  assert.equal(state.ronda, 1);
  state = avanzarTurno(state);
  state = avanzarTurno(state);
  assert.equal(state.activo, "c");
  assert.equal(state.ronda, 2);
});

test("altas y bajas conservan un activo válido durante el combate", () => {
  let state = crearMotorTurnos(combatientes);
  state = retirarCombatiente(state, "c");
  assert.equal(state.activo, "a");
  assert.deepEqual(state.orden, ["a", "b"]);

  state = anadirCombatiente(state, { id: "d", iniciativa: 20 });
  assert.deepEqual(state.orden, ["d", "a", "b"]);
  assert.equal(state.activo, "a");

  assert.deepEqual(estadoTurnos(state), {
    activo: "a",
    ronda: 1,
    orden: ["d", "a", "b"],
  });
});
