// Parlamento (#810): el emisor real de la tirada cierra el bucle sin que la
// ventana invente el total. Puro: globals planos (convención del repo).
import assert from "node:assert/strict";
import test from "node:test";

const listeners = {};
globalThis.Hooks = {
  on: (ev, cb) => { (listeners[ev] ??= []).push(cb); },
  callAll: (ev, carga) => (listeners[ev] ?? []).forEach((cb) => cb(carga)),
};
globalThis.game = { users: { get: () => null } };
globalThis.foundry = {};

const { totalParlamento, registrarParlamentoTirada } = await import("../scripts/parlamento-tirada.mjs");

// Ficha dnd5e mínima: Persuasión +3, Engaño +1, el resto 0.
const ficha = {
  skills: { prc: { total: 3 }, dec: { total: 1 } },
  abilities: {},
  tools: {},
};

test("la tirada suma el d20 y el modificador del enfoque del hablante", () => {
  // dado inyectado = 10, mod Persuasión = 3 → total 13.
  const total = totalParlamento({ enfoqueId: "persuasion", ficha, dado: () => 10 });
  assert.equal(total, 13);
  // Engaño = 1 → 10 + 1 = 11.
  assert.equal(totalParlamento({ enfoqueId: "engano", ficha, dado: () => 10 }), 11);
  // Intimidación sin habilidad en la ficha → mod 0 → 10.
  assert.equal(totalParlamento({ enfoqueId: "intimidacion", ficha, dado: () => 10 }), 10);
});

test("un enfoque desconocido no produce tirada", () => {
  assert.throws(() => totalParlamento({ enfoqueId: "nope", ficha, dado: () => 10 }));
});

test("el emisor lee la ficha del hablante y emite el total resuelto", () => {
  registrarParlamentoTirada({
    leerFicha: (id) => (id === "u1" ? ficha : null),
    dado: () => 17,
  });
  let resuelto = null;
  Hooks.on("lagunakParlamentoResuelve", (carga) => { resuelto = carga; });
  Hooks.callAll("lagunakParlamentoSolicitaTirada", { enfoqueId: "persuasion", hablanteId: "u1" });
  // 17 (dado) + 3 (Persuasión) = 20.
  assert.ok(resuelto);
  assert.equal(resuelto.enfoqueId, "persuasion");
  assert.equal(resuelto.total, 20);
});

test("sin hablante no se rompe: tira con mod 0 y sigue emitiendo", () => {
  registrarParlamentoTirada({ leerFicha: () => null, dado: () => 5 });
  let resuelto = null;
  Hooks.on("lagunakParlamentoResuelve", (carga) => { resuelto = carga; });
  Hooks.callAll("lagunakParlamentoSolicitaTirada", { enfoqueId: "perspicacia", hablanteId: null });
  assert.equal(resuelto.total, 5); // mod 0 (sin ficha)
});
