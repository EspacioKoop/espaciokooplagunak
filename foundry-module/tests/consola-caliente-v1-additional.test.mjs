import assert from "node:assert/strict";
import test from "node:test";
import { derivarMovimiento } from "../scripts/consola-caliente-v1.mjs";

// Helper similar to existing test
function respuesta(json) {
  return { ok: true, status: 200, async json() { return json; } };
}

function pidio(llamadas, url) {
  return llamadas.some((llamada) => llamada === url);
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
    if (url.endsWith("/v1/scenario")) {
      if (fallar.scenario) throw new TypeError("scenario inaccesible");
      return respuesta({ paused: false });
    }
    if (url.endsWith("/v1/events")) {
      if (fallar.events) throw new TypeError("events inaccesible");
      return respuesta({ events: [] });
    }
    if (url.endsWith("/v1/contacts")) {
      if (fallar.contacts) throw new TypeError("contacts inaccesible");
      return respuesta({ contacts: [] });
    }
    if (url.endsWith("/v1/encounters")) {
      if (fallar.encounters) throw new TypeError("encounters inaccesible");
      return respuesta({ archetypes: ["pirates"], bearings: [] });
    }
    // #537: catálogo de anclas de reposición, también perezoso y una sola vez.
    if (url.endsWith("/v1/anchors")) {
      if (fallar.anchors) throw new TypeError("anchors inaccesible");
      return respuesta({ anchors: ["lagunak", "argia"] });
    }
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
      this.element = [{ querySelector: () => null, querySelectorAll: () => [] }];
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

// Existing tests for derivarMovimiento (to keep the file self-contained)
test("V1: derivarMovimiento returns correct values", async (t) => {
  const app = { _centroAnterior: { x: 0, y: 0 } };
  const centro = { x: 1, y: 0 };
  const tMs = 0;
  const result = derivarMovimiento(app, centro, tMs);
  assert.strictEqual(result.moviendo, true);
  // When moviendo is true, ambiente should be null
  assert.strictEqual(result.ambiente, null);
  // update _centroAnterior
  assert.strictEqual(app._centroAnterior.x, 1);
  assert.strictEqual(app._centroAnterior.y, 0);
});

test("V1: derivarMovimiento with no movement", async (t) => {
  const app = { _centroAnterior: { x: 0, y: 0 } };
  const centro = { x: 0, y: 0 };
  const tMs = 0;
  const result = derivarMovimiento(app, centro, tMs);
  assert.strictEqual(result.moviendo, false);
  // When moviendo is false, ambiente should be an object
  assert.strictEqual(typeof result.ambiente, "object");
  assert.strictEqual(result.ambiente.dx, 0);
  assert.strictEqual(result.ambiente.dy, 5);
  assert.strictEqual(app._centroAnterior.x, 0);
  assert.strictEqual(app._centroAnterior.y, 0);
});

// New tests to increase coverage - testing public behavior

test("V1: state error leads to estadoStatus error", async (t) => {
  const { app } = await construirConsola(t, { fallar: { state: true } });
  await app._render(true);
  await vaciarMicrotareas();
  // The actual error message we observed is "No se pudo contactar con el puente en /v1/state"
  assert.equal(app.estadoStatus, "error");
  assert.equal(app.estadoDetalleError, "No se pudo contactar con el puente en /v1/state");
  await app.close();
});

test("V1: scenario error does not crash and leaves estadoStatus ok", async (t) => {
  const { app } = await construirConsola(t, { fallar: { scenario: true } });
  await app._render(true);
  await vaciarMicrotareas();
  assert.equal(app.estadoStatus, "ok"); // state ok
  await app.close();
});

test("V1: events error does not crash and leaves estadoStatus ok", async (t) => {
  const { app } = await construirConsola(t, { fallar: { events: true } });
  await app._render(true);
  await vaciarMicrotareas();
  assert.equal(app.estadoStatus, "ok"); // state ok
  await app.close();
});

test("V1: encounters error does not crash and leaves estadoStatus ok", async (t) => {
  const { app } = await construirConsola(t, { fallar: { encounters: true } });
  await app._render(true);
  await vaciarMicrotareas();
  assert.equal(app.estadoStatus, "ok"); // state ok
  await app.close();
});

test("V1: bridgeAccessRevoked prevents any fetch calls", async (t) => {
  const { app, llamadas } = await construirConsola(t);
  app.bridgeAccessRevoked = true;
  await app._render(true);
  await vaciarMicrotareas();
  assert.equal(llamadas.length, 0);
  await app.close();
});

test("V1: non-GM user prevents any fetch calls", async (t) => {
  const { app, llamadas } = await construirConsola(t);
  globalThis.game.user.isGM = false;
  await app._render(true);
  await vaciarMicrotareas();
  assert.equal(llamadas.length, 0);
  await app.close();
});

test("V1: switching to mapa tab requests contacts", async (t) => {
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

test("V1: switching to previsualizacion tab requests contacts", async (t) => {
  const { app, llamadas, timers } = await construirConsola(t);
  await app._render(true);
  await vaciarMicrotareas();
  app.pestanaActiva = "previsualizacion";
  const timer = timers.find((tm) => tm.activo);
  timer.activo = false;
  timer.callback(...timer.args);
  await vaciarMicrotareas();
  assert.ok(llamadas.filter((u) => u.endsWith("/v1/contacts")).length >= 1);
  await app.close();
});

test("V1: regenerarDecorado does not throw", async (t) => {
  const { app } = await construirConsola(t);
  // Just call the method; we cannot inspect private fields directly.
  app.regenerarDecorado(12345);
  // If we get here, no error was thrown.
  await app.close();
});

test("V1: #intervaloMs uses pollSeconds and fallosSeguidos - checking timer delay is a number", async (t) => {
  const { app, llamadas, timers } = await construirConsola(t);
  await app._render(true);
  await vaciarMicrotareas();
  // We expect at least one timer to have been set
  assert.ok(timers.length > 0);
  // Take the last timer (the one that would be set last)
  const intervalo = timers[timers.length - 1].delay;
  assert.strictEqual(typeof intervalo, "number");
  assert.ok(intervalo > 0);
  await app.close();
});

// Test that saludz error leads to connection error and sin-datos
test("V1: saludz error leads to connection error and sin-datos", async (t) => {
  const { app, llamadas } = await construirConsola(t, { fallar: { healthz: true } });
  await app._render(true);
  await vaciarMicrotareas();
  assert.equal(app.conexion, "error");
  assert.equal(app.estadoStatus, "sin-datos");
  assert.equal(app.mapaStatus, "sin-datos");
  await app.close();
});

// Test that contacts error when mapa active sets contactosCaidos
test("V1: contacts error when mapa active sets contactosCaidos", async (t) => {
  const { app } = await construirConsola(t, { fallar: { contacts: true } });
  app.pestanaActiva = "mapa";
  await app._render(true);
  await vaciarMicrotareas();
  assert.equal(app.contactosCaidos, true);
  assert.equal(app.mapaStatus, "ok"); // state ok
  await app.close();
});

// Test that anchors error leaves catalogoAnclas null
test("V1: anchors error leaves catalogoAnclas null", async (t) => {
  const { app, llamadas } = await construirConsola(t, { fallar: { anchors: true } });
  await app._render(true);
  await vaciarMicrotareas();
  assert.equal(app.catalogoAnclas, null);
  assert.ok(llamadas.some((u) => u.endsWith("/v1/anchors")));
  await app.close();
});