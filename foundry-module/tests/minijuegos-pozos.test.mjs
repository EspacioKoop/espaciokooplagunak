import assert from "node:assert/strict";
import test from "node:test";
import { repartirBotes } from "../scripts/minijuegos/pozos.mjs";

// 1. Simple pot: winner gets whole pot

test("Simple pot: winner gets whole pot", () => {
  const jugadores = [
    { userId: "a", apostadoTotal: 100, retirado: false },
    { userId: "b", apostadoTotal: 100, retirado: false },
  ];
  const evaluaciones = new Map([
    ["a", 1],
    ["b", 0],
  ]);

  const { ganancias } = repartirBotes(jugadores, evaluaciones);
  assert.equal(ganancias.get("a"), 200);
  assert.equal(ganancias.get("b"), 0);
});

// 2. Side pot: all-in player can only win from own stake

test("Side pot: all-in player can only win from own stake", () => {
  const jugadores = [
    { userId: "a", apostadoTotal: 100, retirado: false },
    { userId: "b", apostadoTotal: 200, retirado: false },
    { userId: "c", apostadoTotal: 50, retirado: false },
  ];
  const evaluaciones = new Map([
    ["a", 0],
    ["b", 2],
    ["c", 1],
  ]);

  const { ganancias } = repartirBotes(jugadores, evaluaciones);
  const totalBet = jugadores.reduce((s, j) => s + j.apostadoTotal, 0);
  const totalWinnings = Array.from(ganancias.values()).reduce((s, v) => s + v, 0);
  assert.equal(totalWinnings, totalBet);
  // No player should win more than their contribution
  for (const j of jugadores) {
    assert(ganancias.get(j.userId) <= j.apostadoTotal);
  }
});

// 3. Tie: remainder goes to earlier seat

test("Tie: remainder goes to earlier seat", () => {
  const jugadores = [
    { userId: "a", apostadoTotal: 100, retirado: false },
    { userId: "b", apostadoTotal: 100, retirado: false },
  ];
  const evaluaciones = new Map([ ["a", 2], ["b", 2] ]); // equal

  const { ganancias } = repartirBotes(jugadores, evaluaciones);
  assert.equal(ganancias.get("a"), 100);
  assert.equal(ganancias.get("b"), 100);
});

// 4. Fold: folded player gets nothing

test("Fold: folded player gets nothing", () => {
  const jugadores = [
    { userId: "a", apostadoTotal: 100, retirado: false },
    { userId: "b", apostadoTotal: 100, retirado: false },
    { userId: "c", apostadoTotal: 100, retirado: true },
  ];
  const evaluaciones = new Map([ ["a", 1], ["b", 0] ]);

  const { ganancias } = repartirBotes(jugadores, evaluaciones);
  assert.equal(ganancias.get("a"), 200);
  assert.equal(ganancias.get("b"), 0);
  assert.equal(ganancias.get("c"), 0);
});

// 5. Sum invariant: total winnings equal total bets

test("Sum invariant: total winnings equal total bets", () => {
  const jugadores = [
    { userId: "a", apostadoTotal: 30, retirado: false },
    { userId: "b", apostadoTotal: 40, retirado: false },
    { userId: "c", apostadoTotal: 50, retirado: false },
  ];
  const evaluaciones = new Map([
    ["a", 1],
    ["b", 2],
    ["c", 0],
  ]);

  const { ganancias } = repartirBotes(jugadores, evaluaciones);
  const totalBet = jugadores.reduce((s, j) => s + j.apostadoTotal, 0);
  const totalWin = Array.from(ganancias.values()).reduce((s, v) => s + v, 0);
  assert.equal(totalWin, totalBet);
});
