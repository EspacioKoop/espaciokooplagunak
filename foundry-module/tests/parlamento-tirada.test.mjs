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
const { ENFOQUES_PARLAMENTO, opcionesVisibles } = await import("../scripts/parlamento.mjs");

// Ficha dnd5e 2.3.1 con las CUATRO sociales a valores DISTINTOS, y además
// Percepción (`prc`) e Investigación (`inv`) puestas a propósito: son las dos
// habilidades que el mapa duplicado de este módulo usaba por error, así que si
// alguien vuelve a leerlas el total sale mal en vez de salir igual.
const ficha = {
  skills: {
    per: { total: 7 },   // Persuasión
    dec: { total: 4 },   // Engaño
    ins: { total: 6 },   // Perspicacia
    itm: { total: 5 },   // Intimidación
    prc: { total: 99 },  // Percepción — NO es de ningún enfoque
    inv: { total: 98 },  // Investigación — NO es de ningún enfoque
  },
  abilities: {},
  tools: {},
};

test("cada enfoque tira con SU habilidad dnd5e, con d20 10 y modificadores distintos", () => {
  // Los cuatro con valores distintos: si dos enfoques compartieran clave, o una
  // cayera a 0 por no existir, dos totales coincidirían o bajarían al dado.
  assert.equal(totalParlamento({ enfoqueId: "persuasion", ficha, dado: () => 10 }), 17);
  assert.equal(totalParlamento({ enfoqueId: "engano", ficha, dado: () => 10 }), 14);
  assert.equal(totalParlamento({ enfoqueId: "perspicacia", ficha, dado: () => 10 }), 16);
  assert.equal(totalParlamento({ enfoqueId: "intimidacion", ficha, dado: () => 10 }), 15);
});

test("no se leen Percepción ni Investigación por Persuasión ni Perspicacia", () => {
  // La regresión del fallo real: `prc`/`inv` valen 99/98 en la ficha, así que
  // leerlas por error sería imposible de confundir con el valor correcto.
  const persuasion = totalParlamento({ enfoqueId: "persuasion", ficha, dado: () => 10 });
  const perspicacia = totalParlamento({ enfoqueId: "perspicacia", ficha, dado: () => 10 });
  assert.notEqual(persuasion, 109);
  assert.notEqual(perspicacia, 108);
});

test("la habilidad de cada enfoque sale del catálogo, no de un mapa propio", () => {
  // Dos mapas se desincronizan; este es el que impide que vuelva a pasar.
  const porId = Object.fromEntries(ENFOQUES_PARLAMENTO.map((e) => [e.id, e.habilidad]));
  assert.deepEqual(porId, {
    persuasion: "skill:per",
    engano: "skill:dec",
    perspicacia: "skill:ins",
    intimidacion: "skill:itm",
  });
  for (const opcion of opcionesVisibles({ ficha })) {
    assert.equal(opcion.habilidad, porId[opcion.id]);
  }
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
  // 17 (dado) + 7 (Persuasión) = 24.
  assert.ok(resuelto);
  assert.equal(resuelto.enfoqueId, "persuasion");
  assert.equal(resuelto.total, 24);
});

test("sin hablante no se rompe: tira con mod 0 y sigue emitiendo", () => {
  registrarParlamentoTirada({ leerFicha: () => null, dado: () => 5 });
  let resuelto = null;
  Hooks.on("lagunakParlamentoResuelve", (carga) => { resuelto = carga; });
  Hooks.callAll("lagunakParlamentoSolicitaTirada", { enfoqueId: "perspicacia", hablanteId: null });
  assert.equal(resuelto.total, 5); // mod 0 (sin ficha)
});
