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

test("dar de baja al último combatiente activo avanza la ronda igual que NEXT_TURN", () => {
  const dosCombatientes = [
    { id: "a", iniciativa: 20 },
    { id: "b", iniciativa: 10 },
  ];

  // Avanzando normalmente desde b (el último) se vuelve a a y la ronda sube.
  let viaAvance = crearMotorTurnos(dosCombatientes);
  viaAvance = avanzarTurno(viaAvance); // activo: b, ronda 1
  assert.equal(viaAvance.activo, "b");
  assert.equal(viaAvance.ronda, 1);
  viaAvance = avanzarTurno(viaAvance); // vuelta a a, ronda 2
  assert.equal(viaAvance.activo, "a");
  assert.equal(viaAvance.ronda, 2);

  // Dar de baja a b mientras es el activo debe producir el MISMO resultado:
  // vuelve a a y la ronda avanza, en vez de quedarse anclada en la ronda 1.
  let viaBaja = crearMotorTurnos(dosCombatientes);
  viaBaja = avanzarTurno(viaBaja); // activo: b, ronda 1
  assert.equal(viaBaja.activo, "b");
  assert.equal(viaBaja.ronda, 1);
  viaBaja = retirarCombatiente(viaBaja, "b");
  assert.equal(viaBaja.activo, "a");
  assert.equal(viaBaja.ronda, 2);
  assert.deepEqual(viaBaja.orden, ["a"]);
});

test("retirar al único combatiente deja un combate vacío sin romper", () => {
  let state = crearMotorTurnos([{ id: "solo", iniciativa: 10 }]);
  state = retirarCombatiente(state, "solo");

  assert.deepEqual(state.orden, []);
  assert.equal(state.activo, null);
  assert.deepEqual(estadoTurnos(state).orden, []);
});
