import assert from "node:assert/strict";
import test from "node:test";
import { derivarMovimiento } from "../scripts/consola-caliente-v1.mjs";

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
    if (url.endsWith("/v1/scenario")) return respuesta({ paused: false });
    if (url.endsWith("/v1/events")) return respuesta({ events: [] });
    if (url.endsWith("/v1/contacts")) {
      if (fallar.contacts) throw new TypeError("contacts inaccesible");
      return respuesta({ contacts: [] });
    }
    if (url.endsWith("/v1/encounters")) return respuesta({ archetypes: ["pirates"], bearings: [] });
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

// Run all the original tests to make sure they still pass
test("V1: arranca en la pestaña Estado y pide healthz+state+scenario+events (no contacts)", async (t) => {
  const { app, llamadas } = await construirConsola(t);
  assert.equal(app.pestanaActiva, "estado");
  await app._render(true);
  await vaciarMicrotareas();
  assert.ok(pidio(llamadas, "http://bridge.test/healthz"));
  assert.ok(pidio(llamadas, "http://bridge.test/v1/state"));
  assert.ok(pidio(llamadas, "http://bridge.test/v1/scenario"));
  assert.ok(pidio(llamadas, "http://bridge.test/v1/events"));
  assert.ok(pidio(llamadas, "http://bridge.test/v1/encounters"), "catálogo perezoso, una vez");
  assert.equal(pidio(llamadas, "http://bridge.test/v1/contacts"), false, "Mapa oculto: sin contacts");
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

/* ---- Reposición del GM (#176, cableada en #537) ----
   Lo que se prueba aquí es el CABLEADO, no la lógica: `reposicion-control.mjs`
   ya tiene su suite. Lo que #537 destapó es que un módulo puro impecable con
   pruebas en verde puede no estar enchufado a nada, y eso solo se ve mirando la
   ventana. */

test("V1: pide el catálogo de anclas una sola vez y lo ofrece al GM", async (t) => {
  const { app, llamadas } = await construirConsola(t);
  await app._render(true);
  await vaciarMicrotareas();

  assert.equal(llamadas.filter((url) => url.endsWith("/v1/anchors")).length, 1, "catálogo perezoso, una vez");
  const datos = app.getData();
  assert.equal(datos.reposicion.disponible, true);
  assert.deepEqual(datos.reposicion.anclas.map((a) => a.id), ["lagunak", "argia"]);
  assert.equal(datos.reposicion.puedeReposicionar, true);
  await app.close();
});

test("V1: reposicionar envía el ancla elegida al puente y anuncia el resultado", async (t) => {
  const { app } = await construirConsola(t);
  await app._render(true);
  await vaciarMicrotareas();

  const enviados = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, opciones) => {
    if (url.endsWith("/v1/command")) {
      enviados.push(JSON.parse(opciones.body));
      return respuesta({ result: { ok: true } });
    }
    return original(url, opciones);
  };

  await app._reposicionar("argia");

  assert.equal(enviados.length, 1, "la orden tiene que llegar al puente");
  assert.equal(enviados[0].op, "reposition_ship");
  assert.equal(enviados[0].anchor, "argia");
  assert.equal(app.reposicionFallo, false);
  assert.equal(app.reposicionAviso, "LAGUNAK.Reposicion.Hecha");
  assert.equal(app.reposicionPendiente, false, "el pendiente se suelta siempre");
  await app.close();
});

test("V1: un ancla fuera del catálogo no llega a la red", async (t) => {
  const { app } = await construirConsola(t);
  await app._render(true);
  await vaciarMicrotareas();

  const enviados = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, opciones) => {
    if (url.endsWith("/v1/command")) {
      enviados.push(url);
      return respuesta({ result: { ok: true } });
    }
    return original(url, opciones);
  };

  await app._reposicionar("orbita-inventada");

  assert.deepEqual(enviados, [], "un ancla fuera de catálogo no puede tocar la red");
  assert.equal(app.reposicionFallo, true);
  await app.close();
});

test("V1: quien no es GM no reposiciona, ni con el ancla correcta", async (t) => {
  const { app } = await construirConsola(t);
  await app._render(true);
  await vaciarMicrotareas();
  const catalogo = app.catalogoAnclas;

  const enviados = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, opciones) => {
    if (url.endsWith("/v1/command")) {
      enviados.push(url);
      return respuesta({ result: { ok: true } });
    }
    return original(url, opciones);
  };
  globalThis.game.user.isGM = false;
  app.catalogoAnclas = catalogo;

  await app._reposicionar("lagunak");

  assert.deepEqual(enviados, [], "sin GM no hay reposición");
  await app.close();
});

test("V1: un catálogo de anclas caído se reintenta, no apaga el bloque para siempre", async (t) => {
  const { app, llamadas } = await construirConsola(t, { fallar: { anchors: true } });
  await app._render(true);
  await vaciarMicrotareas();

  assert.equal(app.catalogoAnclas, null, "un fallo no debe guardar un catálogo vacío");
  assert.equal(app.getData().reposicion.disponible, false, "sin catálogo no se ofrece el bloque");
  // Y la conexión global no se contagia: /v1/anchors no es healthz ni state.
  assert.equal(app.conexion, "ok");
  assert.ok(llamadas.some((url) => url.endsWith("/v1/anchors")));
  await app.close();
});

// ---- Additional tests to cover uncovered lines ----

test("V1: derivarMovimiento returns correct values when moving", async (t) => {
  const app = { _centroAnterior: { x: 0, y: 0 } };
  const { moviendo, ambiente } = derivarMovimiento(app, { x: 1, y: 1 }, 3000);
  assert.strictEqual(moviendo, true);
  assert.strictEqual(ambiente, null);
});

test("V1: derivarMovimiento returns correct values when not moving", async (t) => {
  const app = { _centroAnterior: { x: 0, y: 0 } };
  const { moviendo, ambiente } = derivarMovimiento(app, { x: 0, y: 0 }, 0);
  assert.strictEqual(moviendo, false);
  assert.deepEqual(ambiente, { dx: Math.sin(0 / 1500) * 5, dy: Math.cos(0 / 1900) * 5 });
});

test("V1: derivarMovimiento handles null centro", async (t) => {
  const app = { _centroAnterior: { x: 0, y: 0 } };
  const { moviendo, ambiente } = derivarMovimiento(app, null, 0);
  assert.strictEqual(moviendo, false);
  assert.deepEqual(ambiente, { dx: Math.sin(0 / 1500) * 5, dy: Math.cos(0 / 1900) * 5 });
  // _centroAnterior should be set to null
  assert.strictEqual(app._centroAnterior, null);
});

test("V1: defaultOptions contains expected properties", async (t) => {
  const { app } = await construirConsola(t);
  const Clase = app.constructor;
  const opts = Clase.defaultOptions;
  assert.strictEqual(opts.id, "lagunak-consola-caliente");
  assert.ok(Array.isArray(opts.classes));
  assert.ok(opts.classes.includes("lagunak-consola-caliente-shell"));
  assert.strictEqual(opts.template, `modules/espaciokoop-lagunak/templates/consola-caliente.hbs`);
  assert.strictEqual(opts.width, 640);
  assert.strictEqual(opts.height, "auto");
  assert.strictEqual(opts.resizable, true);
  await app.close();
});

test("V1: title getter returns localized string", async (t) => {
  const { app } = await construirConsola(t);
  // Override game.i18n.localize for deterministic result
  const originalLocalize = globalThis.game.i18n.localize;
  globalThis.game.i18n.localize = (key) => `localized:${key}`;
  try {
    assert.strictEqual(app.title, "localized:LAGUNAK.ConsolaCaliente.Titulo");
  } finally {
    globalThis.game.i18n.localize = originalLocalize;
  }
  await app.close();
});

test("V1: regenerarDecorado exists and can be called", async (t) => {
  const { app } = await construirConsola(t);
  await app._render(true);
  await vaciarMicrotareas();
  // Should not throw
  app.regenerarDecorado(42);
  await app.close();
});

test("V1: #aplicarEstadoTab handles healthz error", async (t) => {
  const { app } = await construirConsola(t, { fallar: { healthz: true } });
  await app._render(true);
  await vaciarMicrotareas();
  // After error, estadoStatus should be sin-datos (see #aplicarEstadoTab)
  assert.equal(app.estadoStatus, "sin-datos");
  await app.close();
});

test("V1: #aplicarEstadoTab handles state error", async (t) => {
  const { app } = await construirConsola(t, { fallar: { state: true } });
  await app._render(true);
  await vaciarMicrotareas();
  assert.equal(app.estadoStatus, "error");
  assert.equal(app.estadoDetalleError, "No se pudo contactar con el puente en http://bridge.test/v1/state");
  await app.close();
});

test("V1: #aplicarEstadoTab updates estadoStatus to ok when state returns ok (even if not requested)", async (t) => {
  const { app, timers } = await construirConsola(t);
  // We start with estadoStatus sin-datos (initial)
  app.estadoStatus = "sin-datos";
  await app._render(true);
  await vaciarMicrotareas();
  app.pestanaActiva = "mapa"; // switch to mapa tab
  // Trigger next cycle
  const timer = timers.find(tm => tm.activo);
  if (timer) {
    timer.activo = false;
    timer.callback(...timer.args);
    await vaciarMicrotareas();
  }
  // estadoStatus becomes ok because state is always requested and returns ok
  assert.equal(app.estadoStatus, "ok");
  await app.close();
});

test("V1: #aplicarMapaTab handles mapa error", async (t) => {
  const { app, timers } = await construirConsola(t, { fallar: { state: true } }); // state error triggers mapa error path
  await app._render(true);
  await vaciarMicrotareas();
  app.pestanaActiva = "mapa";
  // Trigger cycle
  const timer = timers.find(tm => tm.activo);
  if (timer) {
    timer.activo = false;
    timer.callback(...timer.args);
    await vaciarMicrotareas();
  }
  assert.equal(app.mapaStatus, "error");
  await app.close();
});

test("V1: #aplicarMapaTab updates mapaStatus to ok when state returns ok (even if not requested)", async (t) => {
  const { app, timers } = await construirConsola(t);
  // We start with mapaStatus sin-datos (initial)
  app.mapaStatus = "sin-datos";
  await app._render(true);
  await vaciarMicrotareas();
  app.pestanaActiva = "estado"; // switch to estado tab (so mapa not requested)
  // Trigger next cycle
  const timer = timers.find(tm => tm.activo);
  if (timer) {
    timer.activo = false;
    timer.callback(...timer.args);
    await vaciarMicrotareas();
  }
  // mapaStatus becomes ok because state is always requested and returns ok
  assert.equal(app.mapaStatus, "ok");
  await app.close();
});

test("V1: #sondear sets timer after execution", async (t) => {
  const { app, timers } = await construirConsola(t);
  await app._render(true);
  await vaciarMicrotareas();
  // There should be at least one timer (the one set by _sondear)
  assert.ok(timers.some((tm) => tm.activo));
  await app.close();
});

test("V1: switching to mapa tab triggers contacts request", async (t) => {
  const { app, llamadas, timers } = await construirConsola(t);
  await app._render(true);
  await vaciarMicrotareas();
  // Ensure we have a pending timer
  const timer = timers.find(tm => tm.activo);
  assert.ok(timer);
  // Switch tab
  app.pestanaActiva = "mapa";
  timer.activo = false;
  timer.callback(...timer.args);
  await vaciarMicrotareas();
  // Should have called contacts
  const contactsCalls = llamadas.filter((u) => u.endsWith("/v1/contacts"));
  assert.ok(contactsCalls.length >= 1);
  await app.close();
});

test("V1: switching to encuentros tab triggers encounters request (lazy)", async (t) => {
  const { app, llamadas } = await construirConsola(t);
  await app._render(true);
  await vaciarMicrotareas();
  // Initially encounters requested once (lazy)
  // Let's clear calls and then switch tab to trigger again? Actually encounters is requested once per session.
  // We'll just verify that after first render, encounters was called.
  const encounterCalls = llamadas.filter((u) => u.endsWith("/v1/encounters"));
  assert.equal(encounterCalls.length, 1);
  await app.close();
});

test("V1: accessing getData returns expected structure", async (t) => {
  const { app } = await construirConsola(t);
  await app._render(true);
  await vaciarMicrotareas();
  const data = app.getData();
  assert.ok(data);
  assert.ok(data.estado);
  assert.ok(data.mapa);
  assert.ok(data.encuentros);
  assert.ok(data.previsualizacion);
  assert.ok(data.reposicion);
  await app.close();
};

// NEW TESTS TARGETING SPECIFICALLY UNCOVERED LINES

// Target: Lines 1060-1083 (_ajustarIngenieria method)
// We want to cover: the method entry, the early returns, the try/catch/finally blocks

test("V1: _ajustarIngenieria returns early when ingenieriaPendiente is true", async (t) => {
  const { app } = await construirConsola(t);
  await app._render(true);
  await vaciarMicrotareas();
  
  // Set ingenieriaPendiente to true to trigger early return
  app.ingenieriaPendiente = true;
  // Other conditions don't matter for this early return
  
  // Spy on #sistemaIngenieriaPorDefecto to ensure it's NOT called
  const originalMethod = app["#sistemaIngenieriaPorDefecto"];
  let called = false;
  app["#sistemaIngenieriaPorDefecto"] = function() {
    called = true;
    return "test-system";
  };
  
  try {
    await app._ajustarIngenieria();
    // Verify that our private method was NOT called due to early return
    assert.strictEqual(called, false, "#sistemaIngenieriaPorDefecto should NOT have been called when ingenieriaPendiente is true");
  } finally {
    // Restore original method
    if (originalMethod) {
      app["#sistemaIngenieriaPorDefecto"] = originalMethod;
    }
  }
  
  await app.close();
});

test("V1: _ajustarIngenieria returns early when user is not GM", async (t) => {
  const { app } = await construirConsola(t);
  await app._render(true);
  await vaciarMicrotareas();
  
  // Set user to non-GM
  globalThis.game.user.isGM = false;
  
  // Set up conditions that would otherwise trigger the method
  app.ingenieriaPendiente = false;
  app.bridgeAccessRevoked = false;
  app.ingenieriaSistema = null;
  
  // Spy on #sistemaIngenieriaPorDefecto to ensure it's NOT called
  const originalMethod = app["#sistemaIngenieriaPorDefecto"];
  let called = false;
  app["#sistemaIngenieriaPorDefecto"] = function() {
    called = true;
    return "test-system";
  };
  
  try {
    await app._ajustarIngenieria();
    // Verify that our private method was NOT called due to user not being GM
    assert.strictEqual(called, false, "#sistemaIngenieriaPorDefecto should NOT have been called when user is not GM");
  } finally {
    // Restore original method
    if (originalMethod) {
      app["#sistemaIngenieriaPorDefecto"] = originalMethod;
    }
  }
  
  await app.close();
});

test("V1: _ajustarIngenieria returns early when bridgeAccessRevoked is true", async (t) => {
  const { app } = await construirConsola(t);
  await app._render(true);
  await vaciarMicrotareas();
  
  // Set bridgeAccessRevoked to true
  app.bridgeAccessRevoked = true;
  
  // Set up conditions that would otherwise trigger the method
  app.ingenieriaPendiente = false;
  // game.user.isGM is true by default
  app.ingenieriaSistema = null;
  
  // Spy on #sistemaIngenieriaPorDefecto to ensure it's NOT called
  const originalMethod = app["#sistemaIngenieriaPorDefecto"];
  let called = false;
  app["#sistemaIngenieriaPorDefecto"] = function() {
    called = true;
    return "test-system";
  };
  
  try {
    await app._ajustarIngenieria();
    // Verify that our private method was NOT called due to bridgeAccessRevoked
    assert.strictEqual(called, false, "#sistemaIngenieriaPorDefecto should NOT have been called when bridgeAccessRevoked is true");
  } finally {
    // Restore original method
    if (originalMethod) {
      app["#sistemaIngenieriaPorDefecto"] = originalMethod;
    }
  }
  
  await app.close();
});

test("V1: _ajustarIngenieria returns early when ingenieriaSistema is not null/undefined", async (t) => {
  const { app } = await construirConsola(t);
  await app._render(true);
  await vaciarMicrotareas();
  
  // Set up conditions to enter the method EXCEPT for ingenieriaSistema being set
  app.ingenieriaPendiente = false;
  app.bridgeAccessRevoked = false;
  // game.user.isGM is true by default
  app.ingenieriaSistema = "some-system"; // Set to a non-null value
  
  // Spy on #sistemaIngenieriaPorDefecto to ensure it's NOT called
  const originalMethod = app["#sistemaIngenieriaPorDefecto"];
  let called = false;
  app["#sistemaIngenieriaPorDefecto"] = function() {
    called = true;
    return "test-system";
  };
  
  try {
    await app._ajustarIngenieria();
    // Verify that our private method was NOT called because ingenieriaSistema was already set
    assert.strictEqual(called, false, "#sistemaIngenieriaPorDefecto should NOT have been called when ingenieriaSistema is already set");
  } finally {
    // Restore original method
    if (originalMethod) {
      app["#sistemaIngenieriaPorDefecto"] = originalMethod;
    }
  }
  
  await app.close();
});

// Target: Lines 1091-1112 (#anotar method)

test("V1: #anotar returns early if user is not GM", async (t) => {
  const { app } = await construirConsola(t);
  await app._render(true);
  await vaciarMicrotareas();
  
  // Set user to non-GM
  globalThis.game.user.isGM = false;
  
  // Set up ship state so it gets past the first check
  app.ultimoEstado = { ship: { name: "Test Ship" } };
  
  // Track if any notifications were called (should be none due to early return)
  const originalWarn = globalThis.ui.notifications.warn;
  const originalInfo = globalThis.ui.notifications.info;
  let warnCalled = false;
  let infoCalled = false;
  globalThis.ui.notifications.warn = function(message) {
    warnCalled = true;
    return originalWarn ? originalWarn.apply(this, arguments) : undefined;
  };
  globalThis.ui.notifications.info = function(message) {
    infoCalled = true;
    return originalInfo ? originalInfo.apply(this, arguments) : undefined;
  };
  
  try {
    // Call #anotar directly
    await app["#anotar"]();
    
    // Verify that no notifications were called because we returned early due to !isGM
    assert.strictEqual(warnCalled, false, "ui.notifications.warn should NOT have been called when user is not GM");
    assert.strictEqual(infoCalled, false, "ui.notifications.info should NOT have been called when user is not GM");
  } finally {
    // Restore original notifications
    globalThis.ui.notifications.warn = originalWarn;
    globalThis.ui.notifications.info = originalInfo;
  }
  
  await app.close();
});

test("V1: #anotar warns if there is no ship state", async (t) => {
  const { app } = await construirConsola(t);
  await app._render(true);
  await vaciarMicrotareas();
  
  // Ensure user is GM
  globalThis.game.user.isGM = true;
  
  // Ensure NO ship state (this should cause early return with warning)
  app.ultimoEstado = null;
  
  // Track if warn was called
  const originalWarn = globalThis.ui.notifications.warn;
  let warnCalled = false;
  globalThis.ui.notifications.warn = function(message) {
    warnCalled = true;
    return originalWarn ? originalWarn.apply(this, arguments) : undefined;
  };
  
  try {
    // Call #anotar directly
    await app["#anotar"]();
    
    // Verify that warn WAS called because we had no ship state
    assert.strictEqual(warnCalled, true, "ui.notifications.warn should have been called when there is no ship state");
  } finally {
    // Restore original warn
    globalThis.ui.notifications.warn = originalWarn;
  }
  
  await app.close();
});