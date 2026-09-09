import assert from "node:assert/strict";
import test from "node:test";
import { CATALOGO_ANDAR } from "../scripts/nave-catalogo-andar.mjs";
import { crearClaseAndarV1, crearClaseAndarV2 } from "../scripts/andar-nave-app.mjs";

// Solo host y DOM son dobles: app, catálogo, movimiento, destinos y HUD reales.
// El checkpoint se mantiene antiguo para reproducir escrituras aún en vuelo.
for (const version of [1, 2]) {
  for (const destino of CATALOGO_ANDAR.ids) {
    test(`V${version}: ${destino} conserva destino y HUD al abrir, viajar y reabrir`, async () => {
      const keys = ["Application", "foundry", "game", "Hooks", "requestAnimationFrame", "cancelAnimationFrame"];
      const anteriores = new Map(keys.map(k => [k, globalThis[k]]));
      const frames = new Map(); let serial = 0, tiempo = performance.now();
      const hud = { textContent: "" };
      const listeners = new Map();
      const canvas = { getContext: () => null, focus() {}, addEventListener: (k, fn) => listeners.set(k, fn), removeEventListener: k => listeners.delete(k) };
      const root = { querySelector: s => ({ ".lagunak-andar-lienzo": canvas, "[data-andar-sala]": hud })[s] ?? null };
      let app;
      const cerrar = async () => { if (version === 1) await app?.close(); else app?._onClose({}); };
      try {
        globalThis.Application = class { activateListeners() {} async close() {} };
        globalThis.foundry = { applications: { api: { ApplicationV2: class {}, HandlebarsApplicationMixin: C => C } } };
        globalThis.Hooks = { on() {}, off() {} };
        const publicadas = [];
        globalThis.game = {
          user: { id: "test", getFlag: () => ({ estancia: "cantina", ...CATALOGO_ANDAR.obtener("cantina").entrada }), setFlag: async (_m, _k, value) => { publicadas.push(value); } },
          users: new Map(), settings: { get: () => null },
          i18n: { has: () => false, localize: k => k, format: (_k, { sala }) => sala },
        };
        globalThis.requestAnimationFrame = cb => { frames.set(++serial, cb); return serial; };
        globalThis.cancelAnimationFrame = id => frames.delete(id);
        const render = () => {
          hud.textContent = ""; // la plantilla crea un nodo de situación vacío
          if (version === 1) app.activateListeners([root]);
          else { app.element = root; app._onRender({}, {}); }
        };
        const step = () => {
          tiempo = Math.max(tiempo + 16, performance.now() + 16);
          const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(cb => cb(tiempo));
        };
        const Clase = version === 1 ? crearClaseAndarV1() : crearClaseAndarV2();
        app = new Clase(); app.estanciaPedida = destino; render();
        for (let i = 0; i < 3; i += 1) step();
        assert.equal(hud.textContent, destino, "primera apertura y fotogramas quietos");
        app.irA("cantina"); render(); step();
        assert.equal(hud.textContent, "cantina");
        app.irA(destino); render(); step();
        assert.equal(hud.textContent, destino, "irA + render no vuelve al checkpoint antiguo");
        await cerrar();
        assert.equal(publicadas.at(-1).estancia, destino, "la posición efectiva coincide con el HUD");
        app = new Clase(); app.estanciaPedida = destino; render(); step();
        assert.equal(hud.textContent, destino, "reapertura explícita");
        if (["museo", "estudio", "arena", "pasillo-recuerdos"].includes(destino)) {
          const event = { key: "s", preventDefault() {}, stopPropagation() {} };
          listeners.get("keydown")(event);
          for (let i = 0; i < 60 && hud.textContent === destino; i += 1) step();
          listeners.get("keyup")(event);
          assert.equal(hud.textContent, "cantina", "la salida sigue alcanzable con teclado y colisión reales");
        }
      } finally {
        await cerrar();
        for (const [k, v] of anteriores) { if (v === undefined) delete globalThis[k]; else globalThis[k] = v; }
      }
      assert.equal(frames.size, 0);
    });
  }
}
