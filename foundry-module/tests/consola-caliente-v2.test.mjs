import assert from "node:assert/strict";
import test from "node:test";

// Smoke test de ConsolaCalienteV2 (#276): construye la clase directamente
// (sin pasar por main.mjs, cuyo cableado de botones de escena ya cubren
// main-compat.test.mjs para las ventanas sueltas) y ejercita un par de
// ciclos de sondeo para fijar el plan de peticiones y el aislamiento por
// pestaña que exige docs/CONSOLA_CALIENTE_GM.md.

function respuesta(json) {
  return { ok: true, status: 200, async json() { return json; } };
}

// `llamadas` guarda URLs completas. Comparamos por igualdad exacta en lugar de
// dejar que la aserción parezca una comprobación por subcadena sobre una URL
// (patrón que el análisis estático marca como sanitización incompleta).
function pidio(llamadas, url) {
  return llamadas.some((llamada) => llamada === url);
}

async function vaciarMicrotareas() {
  for (let i = 0; i < 24; i += 1) await Promise.resolve();
}

async function construirConsola(t, { fallar = {} } = {}) {
  const originales = {
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

  class BaseAppV2 {
    constructor() {
      this.rendered = false;
      this.renderCalls = [];
      this.element = {
        querySelector: () => null,
        querySelectorAll: () => [],
        contains: () => false,
      };
    }

    render(options) {
      this.renderCalls.push(options);
      this.rendered = true;
      return this;
    }
  }
  globalThis.foundry = {
    applications: { api: { ApplicationV2: BaseAppV2, HandlebarsApplicationMixin: (Base) => Base } },
  };

  const tokenSession = await import("../scripts/bridge-token-session.mjs");
  tokenSession.clearBridgeToken();
  tokenSession.setBridgeToken("test-token");

  const { crearClaseConsolaCalienteV2 } = await import(
    `../scripts/consola-caliente-v2.mjs?consola-test=${Math.random()}`
  );
  const Clase = crearClaseConsolaCalienteV2();
  const app = new Clase();
  return { app, llamadas, timers };
}

test("arranca en la pestaña Estado y pide healthz+state+scenario+events (no contacts)", async (t) => {
  const { app, llamadas } = await construirConsola(t);
  assert.equal(app.pestanaActiva, "estado");
  app._onFirstRender();
  await vaciarMicrotareas();
  assert.ok(pidio(llamadas, "http://bridge.test/healthz"));
  assert.ok(pidio(llamadas, "http://bridge.test/v1/state"));
  assert.ok(pidio(llamadas, "http://bridge.test/v1/scenario"));
  assert.ok(pidio(llamadas, "http://bridge.test/v1/events"));
  assert.ok(pidio(llamadas, "http://bridge.test/v1/encounters"), "catálogo perezoso, una vez");
  assert.equal(pidio(llamadas, "http://bridge.test/v1/contacts"), false, "Mapa oculto: sin contacts");
  assert.equal(app.conexion, "ok");
  assert.equal(app.estadoStatus, "ok");
  app._onClose();
});

test("cambiar a la pestaña Mapa hace que el siguiente ciclo pida contacts", async (t) => {
  const { app, llamadas, timers } = await construirConsola(t);
  app._onFirstRender();
  await vaciarMicrotareas();
  app.pestanaActiva = "mapa";
  const timer = timers.find((tm) => tm.activo);
  timer.activo = false;
  timer.callback(...timer.args);
  await vaciarMicrotareas();
  assert.ok(llamadas.filter((u) => u.endsWith("/v1/contacts")).length >= 1);
  app._onClose();
});

test("un fallo de `contacts` con Mapa activo no toca la pestaña Estado ni la conexión global", async (t) => {
  const { app, timers } = await construirConsola(t, { fallar: { contacts: true } });
  app.pestanaActiva = "mapa";
  app._onFirstRender();
  await vaciarMicrotareas();
  assert.equal(app.conexion, "ok");
  assert.equal(app.mapaStatus, "ok", "state llegó bien: el mapa sigue operativo");
  assert.equal(app.contactosCaidos, true);
  // `state` es compartido y SIEMPRE se pide (spec: "una vez, compartido por
  // Estado y Mapa"), así que Estado sigue teniendo nave aunque no sea la
  // pestaña activa; lo que NO se pide fuera de Estado es `scenario`/`events`.
  assert.equal(app.estadoStatus, "ok");
  assert.equal(app.ultimoEstado?.ship?.hull, 90);
  app._onClose();
});

test("healthz caído: única señal global de error, ninguna pestaña inventa datos", async (t) => {
  const { app } = await construirConsola(t, { fallar: { healthz: true } });
  app._onFirstRender();
  await vaciarMicrotareas();
  assert.equal(app.conexion, "error");
  assert.equal(app.estadoStatus, "sin-datos");
  assert.equal(app.mapaStatus, "sin-datos");
  app._onClose();
});

test("cerrar invalida el sondeo en vuelo: no queda ningún timer vivo", async (t) => {
  const { app, timers } = await construirConsola(t);
  app._onFirstRender();
  await vaciarMicrotareas();
  app._onClose();
  assert.equal(timers.some((tm) => tm.activo), false);
});

/* ---- Reposición del GM (#176, cableada en #537) ----
   Réplica AISLADA de los casos de consola-caliente-v1.test.mjs, como el resto de
   este archivo: mismas garantías sobre el cascarón ApplicationV2. Lo que se
   prueba es el CABLEADO, no la lógica —`reposicion-control.mjs` ya tiene su
   suite—, porque lo que #537 destapó es que un módulo puro impecable con
   pruebas en verde puede no estar enchufado a nada. */

test("pide el catálogo de anclas una sola vez y lo ofrece al GM", async (t) => {
  const { app, llamadas } = await construirConsola(t);
  app._onFirstRender();
  await vaciarMicrotareas();

  assert.equal(llamadas.filter((url) => url.endsWith("/v1/anchors")).length, 1, "catálogo perezoso, una vez");
  const contexto = await app._prepareContext({});
  assert.equal(contexto.reposicion.disponible, true);
  assert.deepEqual(contexto.reposicion.anclas.map((a) => a.id), ["lagunak", "argia"]);
  assert.equal(contexto.reposicion.puedeReposicionar, true);
  app._onClose();
});

test("reposicionar envía el ancla elegida al puente y anuncia el resultado", async (t) => {
  const { app } = await construirConsola(t);
  app._onFirstRender();
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
  app._onClose();
});

test("un ancla fuera del catálogo no llega a la red", async (t) => {
  const { app } = await construirConsola(t);
  app._onFirstRender();
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
  app._onClose();
});

test("quien no es GM no reposiciona, ni con el ancla correcta", async (t) => {
  const { app } = await construirConsola(t);
  app._onFirstRender();
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
  app._onClose();
});

test("un catálogo de anclas caído se reintenta, no apaga el bloque para siempre", async (t) => {
  const { app, llamadas } = await construirConsola(t, { fallar: { anchors: true } });
  app._onFirstRender();
  await vaciarMicrotareas();

  assert.equal(app.catalogoAnclas, null, "un fallo no debe guardar un catálogo vacío");
  const contexto = await app._prepareContext({});
  assert.equal(contexto.reposicion.disponible, false, "sin catálogo no se ofrece el bloque");
  // Y la conexión global no se contagia: /v1/anchors no es healthz ni state.
  assert.equal(app.conexion, "ok");
  assert.ok(llamadas.some((url) => url.endsWith("/v1/anchors")));
  app._onClose();
});

test("V2: la consola declara el acceso al mando en su mapa de acciones", async (t) => {
  const { app } = await construirConsola(t);
  assert.equal(typeof app.constructor.DEFAULT_OPTIONS.actions.abrirMando, "function");
  app._onClose();
});
