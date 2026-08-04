import assert from "node:assert/strict";
import test from "node:test";

// Smoke test de ConsolaCalienteV1 (#276): réplica AISLADA en v11 del smoke
// test de consola-caliente-v2.test.mjs — misma cobertura de plan de sondeo
// y aislamiento por pestaña, pero construyendo la clase directamente sobre
// `Application` clásica (sin pasar por main.mjs, cuyo cableado de botones de
// escena ya cubre main-compat.test.mjs).

function respuesta(json) {
  return { ok: true, status: 200, async json() { return json; } };
}

async function vaciarMicrotareas() {
  for (let i = 0; i < 24; i += 1) await Promise.resolve();
}

async function construirConsola(t, { fallar = {} } = {}) {
  const originales = {
    Application: globalThis.Application,
    foundry: globalThis.foundry,
    game: globalThis.game,
    ui: globalThis.ui,
    JournalEntry: globalThis.JournalEntry,
    fetch: globalThis.fetch,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    document: globalThis.document,
    requestAnimationFrame: globalThis.requestAnimationFrame,
  };
  t.after(() => Object.assign(globalThis, originales));

  const timers = [];
  globalThis.setTimeout = (callback, delay, ...args) => {
    const timer = { callback, delay, args, activo: true };
    timers.push(timer);
    return timer;
  };
  globalThis.clearTimeout = (timer) => { if (timer) timer.activo = false; };
  globalThis.requestAnimationFrame = undefined;
  globalThis.document = undefined;

  const llamadas = [];
  globalThis.fetch = async (url) => {
    llamadas.push(url);
    if (url.endsWith("/healthz")) {
      if (fallar.healthz) throw new TypeError("sin puente");
      return respuesta({ bridge: "ok" });
    }
    if (url.endsWith("/v1/state")) {
      if (fallar.state) throw new TypeError("state inaccesible");
      return respuesta({ ship: { position: { x: 1, y: 2 }, heading: 10, hull: 90, hull_max: 100 } });
    }
    if (url.endsWith("/v1/scenario")) return respuesta({ paused: false });
    if (url.endsWith("/v1/events")) return respuesta({ events: [] });
    if (url.endsWith("/v1/contacts")) {
      if (fallar.contacts) throw new TypeError("contacts inaccesible");
      return respuesta({ contacts: [] });
    }
    if (url.endsWith("/v1/encounters")) return respuesta({ archetypes: ["pirates"], bearings: [] });
    throw new Error(`Ruta inesperada: ${url}`);
  };

  globalThis.game = {
    user: { isGM: true },
    settings: { get: (_m, key) => (key === "bridgeUrl" ? "http://bridge.test" : key === "pollSeconds" ? 2 : undefined) },
    i18n: {
      localize: (key) => key,
      has: () => false,
      format: (key, data = {}) => String(data.distance ?? data.rumbo ?? data.radio ?? key),
    },
    paused: false,
    journal: { getName: () => null },
  };
  globalThis.ui = { notifications: { info() {}, warn() {}, error() {} } };
  globalThis.JournalEntry = { create: async () => null };

  class BaseApplication {
    static get defaultOptions() {
      return {};
    }

    constructor() {
      this.rendered = false;
      this.renderCalls = [];
      this.element = [{
        querySelector: () => null,
        querySelectorAll: () => [],
      }];
    }

    render(force) {
      this.renderCalls.push(force);
      this.rendered = true;
      return this;
    }

    async _render(_force, _options) {
      this.rendered = true;
    }

    async close() {
      this.rendered = false;
    }
  }
  globalThis.Application = BaseApplication;
  globalThis.foundry = {
    utils: { mergeObject: (base, extra) => ({ ...base, ...extra }) },
  };

  const tokenSession = await import("../scripts/bridge-token-session.mjs");
  tokenSession.clearBridgeToken();
  tokenSession.setBridgeToken("test-token");

  const { crearClaseConsolaCalienteV1 } = await import(
    `../scripts/consola-caliente-v1.mjs?consola-test=${Math.random()}`
  );
  const Clase = crearClaseConsolaCalienteV1();
  const app = new Clase();
  return { app, llamadas, timers };
}

test("V1: arranca en la pestaña Estado y pide healthz+state+scenario+events (no contacts)", async (t) => {
  const { app, llamadas } = await construirConsola(t);
  assert.equal(app.pestanaActiva, "estado");
  await app._render(true);
  await vaciarMicrotareas();
  assert.ok(llamadas.includes("http://bridge.test/healthz"));
  assert.ok(llamadas.includes("http://bridge.test/v1/state"));
  assert.ok(llamadas.includes("http://bridge.test/v1/scenario"));
  assert.ok(llamadas.includes("http://bridge.test/v1/events"));
  assert.ok(llamadas.includes("http://bridge.test/v1/encounters"), "catálogo perezoso, una vez");
  assert.equal(llamadas.includes("http://bridge.test/v1/contacts"), false, "Mapa oculto: sin contacts");
  assert.equal(app.conexion, "ok");
  assert.equal(app.estadoStatus, "ok");
  await app.close();
});

test("V1: cambiar a la pestaña Mapa hace que el siguiente ciclo pida contacts", async (t) => {
  const { app, llamadas, timers } = await construirConsola(t);
  await app._render(true);
  await vaciarMicrotareas();
  app.pestanaActiva = "mapa";
  const timer = timers.find((tm) => tm.activo);
  timer.activo = false;
  timer.callback(...timer.args);
  await vaciarMicrotareas();
  assert.ok(llamadas.filter((u) => u.endsWith("/v1/contacts")).length >= 1);
  await app.close();
});

test("V1: un fallo de `contacts` con Mapa activo no toca la pestaña Estado ni la conexión global", async (t) => {
  const { app } = await construirConsola(t, { fallar: { contacts: true } });
  app.pestanaActiva = "mapa";
  await app._render(true);
  await vaciarMicrotareas();
  assert.equal(app.conexion, "ok");
  assert.equal(app.mapaStatus, "ok", "state llegó bien: el mapa sigue operativo");
  assert.equal(app.contactosCaidos, true);
  assert.equal(app.estadoStatus, "ok");
  assert.equal(app.ultimoEstado?.ship?.hull, 90);
  await app.close();
});

test("V1: healthz caído: única señal global de error, ninguna pestaña inventa datos", async (t) => {
  const { app } = await construirConsola(t, { fallar: { healthz: true } });
  await app._render(true);
  await vaciarMicrotareas();
  assert.equal(app.conexion, "error");
  assert.equal(app.estadoStatus, "sin-datos");
  assert.equal(app.mapaStatus, "sin-datos");
  await app.close();
});

test("V1: cerrar invalida el sondeo en vuelo: no queda ningún timer vivo", async (t) => {
  const { app, timers } = await construirConsola(t);
  await app._render(true);
  await vaciarMicrotareas();
  await app.close();
  assert.equal(timers.some((tm) => tm.activo), false);
});
