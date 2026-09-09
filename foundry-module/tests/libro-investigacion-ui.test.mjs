import assert from "node:assert/strict";
import test from "node:test";
import { crearClaseAndarV1, crearClaseAndarV2 } from "../scripts/andar-nave-app.mjs";

// Adaptadores mínimos del host/DOM; el movimiento, catálogo y listeners son reales.
// La imagen Canvas se verifica aparte; aquí se reproduce libro → cartela vecina.
for (const version of [1, 2]) test(`V${version}: cambiar del libro a otra interacción retira su resultado`, async () => {
  const keys = ["Application", "foundry", "game", "Hooks", "requestAnimationFrame", "cancelAnimationFrame"];
  const previous = new Map(keys.map(k => [k, globalThis[k]]));
  const oldRandom = Math.random;
  const frames = new Map(), listeners = new Map(); let id = 0, time = performance.now();
  const result = { textContent: "" }, credit = { textContent: "" }, cartela = { hidden: true, querySelector: () => credit };
  const button = { dataset: { investigacionHabilidad: "arcana" } };
  const panel = { hidden: true, querySelector: () => result, querySelectorAll: () => [button] };
  const canvas = { getContext: () => null, focus() {}, addEventListener: (k, f) => listeners.set(k, f), removeEventListener: k => listeners.delete(k) };
  const root = { querySelector: selector => ({ ".lagunak-andar-lienzo": canvas, "[data-andar-investigacion]": panel, "[data-andar-cartela]": cartela, "[data-cartela-credito]": credit })[selector] ?? null };
  let app;
  try {
    globalThis.Application = class { activateListeners() {} async close() {} };
    globalThis.foundry = { applications: { api: { ApplicationV2: class {}, HandlebarsApplicationMixin: C => C } } };
    globalThis.Hooks = { on() {}, off() {} };
    globalThis.game = { user: { id: "test", getFlag: () => ({ estancia: "museo", x: 1.25, z: 2.5, yaw: Math.PI }), setFlag: async () => {} }, users: new Map(), settings: { get: () => null }, i18n: { localize: k => k } };
    globalThis.requestAnimationFrame = cb => { frames.set(++id, cb); return id; };
    globalThis.cancelAnimationFrame = id => frames.delete(id);
    const step = () => { time = Math.max(time + 50, performance.now() + 50); const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(cb => cb(time)); };
    app = new (version === 1 ? crearClaseAndarV1() : crearClaseAndarV2())();
    if (version === 1) app.activateListeners([root]); else { app.element = root; app._onRender({}, {}); }
    step(); assert.equal(panel.hidden, false);
    Math.random = () => 0.875; button.onclick(); assert.match(result.textContent, /18\/12/);
    const event = { key: "s", preventDefault() {}, stopPropagation() {} };
    listeners.get("keydown")(event);
    for (let i = 0; i < 8; i++) step();
    listeners.get("keyup")(event);
    assert.equal(panel.hidden, true, "la cartela vecina no debe conservar las acciones del libro");
  } finally {
    if (version === 1) await app?.close(); else app?._onClose({});
    Math.random = oldRandom;
    for (const [key, value] of previous) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
  assert.equal(frames.size, 0);
});
