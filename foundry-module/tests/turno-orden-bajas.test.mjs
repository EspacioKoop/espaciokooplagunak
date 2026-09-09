import test from "node:test";
import assert from "node:assert/strict";
import { crearEstado, reducir, select } from "../scripts/turno-orden-reductor.mjs";

function estado(index = 0, active = true) {
  let s = crearEstado();
  for (const [id, initiativeMod] of [["A", 30], ["B", 20], ["C", 10]]) {
    s = reducir(s, { type: "ADD_COMBATANT", payload: { id, name: id, initiativeMod } });
  }
  s = reducir(s, { type: "SET_ACTIVE", payload: { active } });
  s = reducir(s, { type: "SET_CURRENT_INDEX", payload: { currentIndex: index } });
  return reducir(s, { type: "SET_ROUND", payload: { round: 4 } });
}
for (const index of [0, 1, 2]) {
  test(`la baja activa ${index} coincide con NEXT_TURN y conserva su ronda`, () => {
    const s = estado(index);
    const next = reducir(s, { type: "NEXT_TURN" });
    const removed = reducir(s, { type: "REMOVE_COMBATANT", payload: { id: s.combatants[index].id } });
    assert.equal(select.combatantActual(removed).id, select.combatantActual(next).id);
    assert.equal(removed.round, next.round);
    assert.equal(s.combatants.length, 3);
  });
}
test("una baja anterior o posterior no roba el turno ni avanza la ronda", () => {
  for (const id of ["A", "C"]) {
    const s = reducir(estado(1), { type: "REMOVE_COMBATANT", payload: { id } });
    assert.equal(select.combatantActual(s).id, "B");
    assert.equal(s.round, 4);
  }
});
test("la baja del último combatiente deja un estado vacío consultable", () => {
  let s = estado();
  for (const id of ["B", "C", "A"]) s = reducir(s, { type: "REMOVE_COMBATANT", payload: { id } });
  assert.equal(select.combatantActual(s), null);
  assert.equal(s.currentIndex, 0);
  assert.equal(s.round, 5);
});
test("sin combate activo la baja no avanza ronda", () => {
  const s = reducir(estado(2, false), { type: "REMOVE_COMBATANT", payload: { id: "C" } });
  assert.equal(s.round, 4);
});
