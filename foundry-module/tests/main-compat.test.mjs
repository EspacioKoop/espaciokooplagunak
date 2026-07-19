import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

let importNonce = 0;

async function loadModule({ modern = false, isGM = true, fetchImpl } = {}) {
  const hooks = {};
  const instances = [];
  const notifications = { info: [], warn: [], error: [] };
  const fetchCalls = [];
  const journalPages = [];
  const journal = {
    async createEmbeddedDocuments(type, pages) {
      assert.equal(type, "JournalEntryPage");
      journalPages.push(...pages);
      return pages;
    },
  };

  class BaseApplication {
    static get defaultOptions() {
      return {};
    }

    constructor() {
      instances.push(this);
      this.rendered = false;
      this.renderCalls = [];
    }

    render(options) {
      this.renderCalls.push(options);
      this.rendered = true;
      return this;
    }

    async close() {
      this.rendered = false;
    }

    activateListeners() {}
  }

  globalThis.Application = BaseApplication;
  globalThis.Hooks = {
    once(name, callback) {
      hooks[name] = callback;
    },
    on(name, callback) {
      hooks[name] = callback;
    },
  };
  globalThis.game = {
    user: { id: "local-user", isGM },
    settings: {
      register() {},
      async set() {},
      get(_module, key) {
        if (key === "bridgeUrl") return "http://bridge.test";
        return 2;
      },
    },
    i18n: { localize: (key) => key, format: (key) => key },
    journal: { getName: () => journal },
  };
  globalThis.JournalEntry = { create: async () => journal };
  globalThis.ui = {
    notifications: {
      info(message) { notifications.info.push(message); },
      warn(message) { notifications.warn.push(message); },
      error(message) { notifications.error.push(message); },
    },
  };
  globalThis.fetch = async (...args) => {
    fetchCalls.push(args);
    if (fetchImpl) return fetchImpl(...args);
    return { ok: true, status: 200, async json() { return { ok: true }; } };
  };
  globalThis.foundry = {
    utils: {
      mergeObject(base, extra) {
        return { ...base, ...extra };
      },
    },
  };

  if (modern) {
    class ApplicationV2 extends BaseApplication {}
    globalThis.foundry.applications = {
      api: {
        ApplicationV2,
        HandlebarsApplicationMixin: (Base) => Base,
      },
    };
  }

  const tokenSession = await import("../scripts/bridge-token-session.mjs");
  tokenSession.clearBridgeToken();
  if (isGM) tokenSession.setBridgeToken("test-token");
  await import(`../scripts/main.mjs?compat-test=${importNonce++}`);
  return { hooks, instances, notifications, fetchCalls, journalPages, tokenSession };
}

function pauseValues(fetchCalls) {
  return fetchCalls.map(([, options]) => JSON.parse(options.body).paused);
}

function toolByName(controls, name) {
  return controls.flatMap((control) => control.tools ?? []).find((tool) => tool.name === name);
}

test("v11 abre la configuración efímera del token sin tocar red", async () => {
  const { hooks, instances, fetchCalls } = await loadModule();
  const controls = [{ name: "token", tools: [] }];
  hooks.getSceneControlButtons(controls);

  await toolByName(controls, "lagunak-token").onClick();
  assert.equal(instances.length, 1);
  assert.deepEqual(instances[0].renderCalls, [true]);
  assert.deepEqual(fetchCalls, []);
  await instances[0].close();
});

test("updateUser revoca el token y cierra la ventana si el usuario local deja de ser GM", async () => {
  const { hooks, tokenSession, instances } = await loadModule();
  const controls = [{ name: "token", tools: [] }];
  hooks.getSceneControlButtons(controls);
  await toolByName(controls, "lagunak-token").onClick();
  const app = instances[0];
  assert.equal(app.rendered, true);
  assert.equal(tokenSession.getBridgeToken(), "test-token");

  game.user.isGM = false;
  hooks.updateUser({ id: "local-user", isGM: false });
  await Promise.resolve();

  assert.equal(tokenSession.getBridgeToken(), "");
  assert.equal(app.rendered, false);
  game.user.isGM = true;
  assert.equal(tokenSession.getBridgeToken(), "");
});

test("degradar durante healthz cierra la vista y no inicia peticiones autenticadas", async () => {
  let finishHealth;
  const fetchImpl = (url) => {
    if (url.endsWith("/healthz")) {
      return new Promise((resolve) => { finishHealth = resolve; });
    }
    return Promise.resolve({ ok: true, status: 200, async json() { return { ok: true }; } });
  };
  const { hooks, tokenSession, instances, fetchCalls } = await loadModule({ modern: true, fetchImpl });
  const controls = {};
  hooks.getSceneControlButtons(controls);
  controls.lagunak.tools["lagunak-estado"].onClick();
  const app = instances[0];
  let wipes = 0;
  app.element = { replaceChildren() { wipes += 1; } };
  app._onFirstRender();
  await Promise.resolve();
  assert.equal(fetchCalls.length, 1);
  assert.match(fetchCalls[0][0], /\/healthz$/);

  game.user.isGM = false;
  hooks.updateUser({ id: "local-user", isGM: false });
  await Promise.resolve();
  finishHealth({ ok: true, status: 200, async json() { return { ok: true }; } });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(tokenSession.getBridgeToken(), "");
  assert.equal(app.bridgeAccessRevoked, true);
  assert.equal(app.rendered, false);
  assert.equal(wipes, 1);
  assert.equal(fetchCalls.length, 1);
});

test("degradar cierra y vacía estado, mapa y workspace abiertos", async () => {
  const { hooks, instances } = await loadModule({ modern: true });
  const controls = { tokens: { tools: {} } };
  hooks.getSceneControlButtons(controls);
  controls.lagunak.tools["lagunak-estado"].onClick();
  controls.lagunak.tools["lagunak-mapa"].onClick();
  controls.lagunak.tools["lagunak-espacio-puesto"].onClick();
  assert.equal(instances.length, 3);
  const wipes = [0, 0, 0];
  instances.forEach((app, index) => {
    app.element = { replaceChildren() { wipes[index] += 1; } };
  });
  instances[0].ultimoEstado = { ship: { callsign: "Agregado" } };
  instances[1].contactos = [{ callsign: "Contacto" }];
  instances[2].statePayload = { ship: { callsign: "Workspace" } };

  game.user.isGM = false;
  hooks.updateUser({ id: "local-user", isGM: false });
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(instances.map((app) => app.rendered), [false, false, false]);
  assert.deepEqual(wipes, [1, 1, 1]);
  assert.equal(instances[0].ultimoEstado, null);
  assert.deepEqual(instances[1].contactos, []);
  assert.equal(instances[2].statePayload, null);
  assert.equal(instances[2].closed, true);
});

test("v11 conecta los listeners de pausa y reanudación con el puente", async () => {
  const { hooks, instances, notifications, fetchCalls } = await loadModule();
  const controls = [{ name: "token", tools: [] }];

  hooks.getSceneControlButtons(controls);
  // Issue #125: TODAS las herramientas del módulo viven en el grupo propio;
  // nada se cuelga de Token Controls. El GM ve estado/mapa/token/diagnóstico
  // más los botones de puesto.
  assert.deepEqual(controls[0].tools.map(({ name }) => name), []);
  const grupo = controls.find((control) => control.name === "lagunak");
  assert.ok(grupo);
  assert.equal(grupo.icon, "fa-solid fa-shuttle-space");
  assert.deepEqual(grupo.tools.map(({ name }) => name), [
    "lagunak-estado",
    "lagunak-mapa",
    "lagunak-token",
    "lagunak-diagnostico",
    "lagunak-puestos",
    "lagunak-espacio-puesto",
  ]);
  toolByName(controls, "lagunak-estado").onClick();

  assert.equal(instances.length, 1);
  assert.deepEqual(instances[0].renderCalls, [true]);

  const bindings = new Map();
  const html = {
    find(selector) {
      return {
        on(event, callback) {
          bindings.set(selector, { event, callback });
        },
      };
    },
  };
  instances[0].activateListeners(html);

  assert.equal(bindings.get('[data-action="pausar"]').event, "click");
  assert.equal(bindings.get('[data-action="reanudar"]').event, "click");

  // El ACK del comando NO confirma: sin lectura de /v1/scenario no hay
  // estado confirmado ni notificación (autoridad del simulador).
  await bindings.get('[data-action="pausar"]').callback();
  assert.equal(instances[0].pausaConfirmada, null);
  assert.deepEqual(notifications.info, []);

  // La confirmación llega únicamente de una lectura real de /v1/scenario.
  instances[0]._registrarLecturaPausa({ paused: true });
  assert.equal(instances[0].pausaConfirmada, true);
  assert.deepEqual(notifications.info, ["LAGUNAK.Tempo.Pausado"]);

  await bindings.get('[data-action="reanudar"]').callback();
  assert.equal(instances[0].pausaConfirmada, true);
  instances[0]._registrarLecturaPausa({ paused: false });
  assert.equal(instances[0].pausaConfirmada, false);

  assert.deepEqual(pauseValues(fetchCalls), [true, false]);
  assert.deepEqual(notifications.info, ["LAGUNAK.Tempo.Pausado", "LAGUNAK.Tempo.Reanudado"]);
  assert.deepEqual(notifications.error, []);
});

test("la bitácora normaliza la telemetría y no inserta HTML del puente", async () => {
  const { hooks, instances, journalPages } = await loadModule();
  const controls = [{ name: "token", tools: [] }];
  hooks.getSceneControlButtons(controls);
  toolByName(controls, "lagunak-estado").onClick();

  instances[0].ultimoEstado = {
    ship: {
      callsign: '<img src=x onerror="alert(1)">',
      position: { x: "<svg onload=alert(1)>", y: 25.4 },
      heading: "90deg",
      hull: "<img src=x>",
      hull_max: 100,
      energy: Number.POSITIVE_INFINITY,
      energy_max: 200,
      shields_active: false,
    },
  };

  const bindings = new Map();
  instances[0].activateListeners({
    find(selector) {
      return { on(_event, callback) { bindings.set(selector, callback); } };
    },
  });
  await bindings.get('[data-action="anotar"]')();

  assert.equal(journalPages.length, 1);
  const content = journalPages[0].text.content;
  assert.doesNotMatch(content, /<img|<svg/);
  assert.match(content, /LAGUNAK\.Diario\.Campo\.Posicion: 0, 25/);
  assert.match(content, /LAGUNAK\.Diario\.Campo\.Rumbo: 0°/);
  assert.match(content, /LAGUNAK\.Diario\.Campo\.Casco: 0 \/ 100/);
  assert.match(content, /LAGUNAK\.Diario\.Campo\.Energia: 0 \/ 200/);
});

test("host moderno conecta las acciones de pausa y reanudación con el puente", async () => {
  const { hooks, instances, notifications, fetchCalls } = await loadModule({ modern: true });
  const controls = {};

  hooks.getSceneControlButtons(controls);
  // Grupo propio con icono de nave (issue #125), record de tools en v13.
  assert.ok(controls.lagunak);
  assert.equal(controls.lagunak.icon, "fa-solid fa-shuttle-space");
  assert.ok(controls.lagunak.tools["lagunak-estado"]);
  controls.lagunak.tools["lagunak-estado"].onClick();

  assert.equal(instances.length, 1);
  assert.deepEqual(instances[0].renderCalls, [{ force: true }]);
  const actions = instances[0].constructor.DEFAULT_OPTIONS.actions;
  assert.equal(typeof actions.pausar, "function");
  assert.equal(typeof actions.reanudar, "function");

  // ACK sin confirmación: sin lectura de /v1/scenario no hay estado.
  await actions.pausar.call(instances[0]);
  assert.equal(instances[0].pausaConfirmada, null);
  assert.deepEqual(notifications.info, []);

  instances[0]._registrarLecturaPausa({ paused: true });
  assert.equal(instances[0].pausaConfirmada, true);

  await actions.reanudar.call(instances[0]);
  instances[0]._registrarLecturaPausa({ paused: false });
  assert.equal(instances[0].pausaConfirmada, false);

  assert.deepEqual(pauseValues(fetchCalls), [true, false]);
  assert.deepEqual(notifications.info, ["LAGUNAK.Tempo.Pausado", "LAGUNAK.Tempo.Reanudado"]);
  assert.deepEqual(notifications.error, []);
});

test("v11 conecta el listener de encuentro y envía la selección exacta una sola vez", async () => {
  const { hooks, instances, fetchCalls } = await loadModule();
  const controls = [{ name: "token", tools: [] }];
  hooks.getSceneControlButtons(controls);
  toolByName(controls, "lagunak-estado").onClick();

  const app = instances[0];
  app.catalogoEncuentros = { archetypes: ["derelict"], bearings: ["starboard"] };
  app.element = [{
    querySelector(selector) {
      if (selector === "[data-lagunak-encuentro-arquetipo]") return { value: "derelict" };
      if (selector === "[data-lagunak-encuentro-rumbo]") return { value: "starboard" };
      return null;
    },
  }];
  const bindings = new Map();
  app.activateListeners({
    find(selector) {
      return { on(event, callback) { bindings.set(selector, { event, callback }); } };
    },
  });

  const binding = bindings.get('[data-action="encuentro"]');
  assert.equal(binding.event, "click");
  await binding.callback();

  assert.equal(fetchCalls.length, 1);
  assert.match(fetchCalls[0][0], /\/v1\/command$/);
  assert.equal(fetchCalls[0][1].method, "POST");
  assert.equal(fetchCalls[0][1].headers.Authorization, "Bearer test-token");
  assert.deepEqual(JSON.parse(fetchCalls[0][1].body), {
    op: "spawn_encounter",
    archetype: "derelict",
    bearing: "starboard",
  });
});

test("ApplicationV2 conecta la acción de encuentro y envía la selección exacta una sola vez", async () => {
  const { hooks, instances, fetchCalls } = await loadModule({ modern: true });
  const controls = {};
  hooks.getSceneControlButtons(controls);
  controls.lagunak.tools["lagunak-estado"].onClick();

  const app = instances[0];
  app.catalogoEncuentros = { archetypes: ["derelict"], bearings: ["ahead"] };
  app.element = {
    querySelector(selector) {
      if (selector === "[data-lagunak-encuentro-arquetipo]") return { value: "derelict" };
      if (selector === "[data-lagunak-encuentro-rumbo]") return { value: "ahead" };
      return null;
    },
  };
  const actions = app.constructor.DEFAULT_OPTIONS.actions;
  assert.equal(typeof actions.encuentro, "function");
  await actions.encuentro.call(app);

  assert.equal(fetchCalls.length, 1);
  assert.match(fetchCalls[0][0], /\/v1\/command$/);
  assert.equal(fetchCalls[0][1].method, "POST");
  assert.equal(fetchCalls[0][1].headers.Authorization, "Bearer test-token");
  assert.deepEqual(JSON.parse(fetchCalls[0][1].body), {
    op: "spawn_encounter",
    archetype: "derelict",
    bearing: "ahead",
  });
});

// Fail-closed ante ACK/errores tardíos de spawn_encounter: si el rol GM se
// revoca mientras la orden viaja, la respuesta privilegiada tardía no debe
// notificar ni repoblar la ventana (misma garantía que el sondeo y el token).
function comandoRetenido() {
  let finish;
  const fetchImpl = (url) => {
    if (String(url).endsWith("/v1/command")) {
      return new Promise((resolve) => { finish = resolve; });
    }
    return Promise.resolve({ ok: true, status: 200, async json() { return { ok: true }; } });
  };
  return { fetchImpl, resolver: (body) => finish({ ok: true, status: 200, async json() { return body; } }) };
}

const raizEncuentroSel = { archetypes: ["derelict"], bearings: ["ahead"] };
function raizEncuentro() {
  return {
    querySelector(selector) {
      if (selector.includes("arquetipo")) return { value: "derelict" };
      if (selector.includes("rumbo")) return { value: "ahead" };
      return null;
    },
  };
}

test("v11: un ACK tardío de encuentro tras revocar el rol GM no notifica ni repuebla", async () => {
  const { fetchImpl, resolver } = comandoRetenido();
  const { hooks, instances, notifications } = await loadModule({ fetchImpl });
  const controls = [{ name: "token", tools: [] }];
  hooks.getSceneControlButtons(controls);
  toolByName(controls, "lagunak-estado").onClick();

  const app = instances[0];
  app.catalogoEncuentros = raizEncuentroSel;
  app.element = [raizEncuentro()];
  const bindings = new Map();
  app.activateListeners({ find(selector) { return { on(event, callback) { bindings.set(selector, { event, callback }); } }; } });

  const enVuelo = bindings.get('[data-action="encuentro"]').callback();
  const rendersPrevios = app.renderCalls.length;

  // El rol se pierde con la orden en vuelo.
  game.user.isGM = false;
  hooks.updateUser({ id: "local-user", isGM: false });
  await Promise.resolve();

  // El ACK privilegiado llega tarde.
  resolver({ op: "spawn_encounter", result: { ok: true } });
  await enVuelo;

  assert.equal(app.bridgeAccessRevoked, true);
  assert.deepEqual(notifications.info, []);
  assert.deepEqual(notifications.warn, []);
  // No repuebla la ventana ya revocada tras el ACK tardío.
  assert.equal(app.renderCalls.length, rendersPrevios);
});

test("ApplicationV2: un ACK tardío de encuentro tras revocar el rol GM no notifica ni repuebla", async () => {
  const { fetchImpl, resolver } = comandoRetenido();
  const { hooks, instances, notifications } = await loadModule({ modern: true, fetchImpl });
  const controls = {};
  hooks.getSceneControlButtons(controls);
  controls.lagunak.tools["lagunak-estado"].onClick();

  const app = instances[0];
  app.catalogoEncuentros = raizEncuentroSel;
  app.element = raizEncuentro();
  const enVuelo = app.constructor.DEFAULT_OPTIONS.actions.encuentro.call(app);
  const rendersPrevios = app.renderCalls.length;

  game.user.isGM = false;
  hooks.updateUser({ id: "local-user", isGM: false });
  await Promise.resolve();

  resolver({ op: "spawn_encounter", result: { ok: true } });
  await enVuelo;

  assert.equal(app.bridgeAccessRevoked, true);
  assert.deepEqual(notifications.info, []);
  assert.deepEqual(notifications.warn, []);
  assert.equal(app.renderCalls.length, rendersPrevios);
});

test("v11: lectura discordante tras el ACK avisa y pasa a estado de error", async () => {
  const { hooks, instances, notifications } = await loadModule();
  const controls = [];
  hooks.getSceneControlButtons(controls);
  controls.find((c) => c.name === "lagunak").tools[0].onClick();

  const bindings = new Map();
  instances[0].activateListeners({
    find(selector) {
      return { on(_event, callback) { bindings.set(selector, callback); } };
    },
  });
  await bindings.get('[data-action="pausar"]')();

  // Mientras espera confirmación, una segunda orden queda bloqueada.
  await bindings.get('[data-action="reanudar"]')();
  assert.equal(instances[0].confirmacionPendiente, true);

  // El simulador responde lo contrario de lo ordenado.
  instances[0]._registrarLecturaPausa({ paused: false });
  assert.equal(instances[0].pausaConfirmada, false);
  assert.equal(instances[0].falloOrden, true);
  assert.deepEqual(notifications.info, []);
  assert.deepEqual(notifications.warn, ["LAGUNAK.Tempo.Discordante"]);
});

test("ApplicationV2: lectura discordante tras el ACK avisa y pasa a estado de error", async () => {
  const { hooks, instances, notifications } = await loadModule({ modern: true });
  const controls = {};
  hooks.getSceneControlButtons(controls);
  controls.lagunak.tools["lagunak-estado"].onClick();

  const actions = instances[0].constructor.DEFAULT_OPTIONS.actions;
  await actions.pausar.call(instances[0]);
  await actions.reanudar.call(instances[0]); // bloqueada: confirmación pendiente
  assert.equal(instances[0].confirmacionPendiente, true);

  instances[0]._registrarLecturaPausa({ paused: false });
  assert.equal(instances[0].pausaConfirmada, false);
  assert.equal(instances[0].falloOrden, true);
  assert.deepEqual(notifications.info, []);
  assert.deepEqual(notifications.warn, ["LAGUNAK.Tempo.Discordante"]);
});

test("v11 muestra el error del puente sin emitir una confirmación falsa", async () => {
  const { hooks, instances, notifications, fetchCalls } = await loadModule({
    fetchImpl: async () => ({ ok: false, status: 503, async json() { return {}; } }),
  });
  const controls = [{ name: "token", tools: [] }];
  hooks.getSceneControlButtons(controls);
  toolByName(controls, "lagunak-estado").onClick();

  const bindings = new Map();
  instances[0].activateListeners({
    find(selector) {
      return { on(_event, callback) { bindings.set(selector, callback); } };
    },
  });
  await bindings.get('[data-action="pausar"]')();

  assert.deepEqual(pauseValues(fetchCalls), [true]);
  assert.deepEqual(notifications.info, []);
  assert.deepEqual(notifications.error, ["El puente respondió 503 en /v1/command"]);
});

test("ApplicationV2 muestra el error del puente sin emitir una confirmación falsa", async () => {
  const { hooks, instances, notifications, fetchCalls } = await loadModule({
    modern: true,
    fetchImpl: async () => ({ ok: false, status: 503, async json() { return {}; } }),
  });
  const controls = {};
  hooks.getSceneControlButtons(controls);
  controls.lagunak.tools["lagunak-estado"].onClick();

  const actions = instances[0].constructor.DEFAULT_OPTIONS.actions;
  await actions.reanudar.call(instances[0]);

  assert.deepEqual(pauseValues(fetchCalls), [false]);
  assert.deepEqual(notifications.info, []);
  assert.deepEqual(notifications.error, ["El puente respondió 503 en /v1/command"]);
});

test("v11 bloquea la orden si el usuario deja de ser GM", async () => {
  const { hooks, instances, notifications, fetchCalls } = await loadModule();
  const controls = [{ name: "token", tools: [] }];
  hooks.getSceneControlButtons(controls);
  toolByName(controls, "lagunak-estado").onClick();

  const bindings = new Map();
  instances[0].activateListeners({
    find(selector) {
      return { on(_event, callback) { bindings.set(selector, callback); } };
    },
  });
  game.user.isGM = false;
  await bindings.get('[data-action="pausar"]')();
  await bindings.get('[data-action="reanudar"]')();

  assert.deepEqual(fetchCalls, []);
  assert.deepEqual(notifications.info, []);
  assert.deepEqual(notifications.error, []);
});

test("ApplicationV2 bloquea la orden si el usuario deja de ser GM", async () => {
  const { hooks, instances, notifications, fetchCalls } = await loadModule({ modern: true });
  const controls = {};
  hooks.getSceneControlButtons(controls);
  controls.lagunak.tools["lagunak-estado"].onClick();
  game.user.isGM = false;

  const actions = instances[0].constructor.DEFAULT_OPTIONS.actions;
  await actions.pausar.call(instances[0]);
  await actions.reanudar.call(instances[0]);

  assert.deepEqual(fetchCalls, []);
  assert.deepEqual(notifications.info, []);
  assert.deepEqual(notifications.error, []);
});

test("un jugador no GM recibe asignación y espacio de puesto, sin controles GM", async () => {
  const { hooks } = await loadModule({ isGM: false });
  const controls = [{ name: "token", tools: [] }];

  hooks.getSceneControlButtons(controls);
  // El grupo propio es visible para el jugador con SOLO sus botones de puesto;
  // sin estado/mapa/token/diagnóstico (solo-GM) y nada en Token Controls.
  assert.deepEqual(controls[0].tools.map(({ name }) => name), []);
  const grupo = controls.find((control) => control.name === "lagunak");
  assert.ok(grupo);
  assert.deepEqual(grupo.tools.map(({ name }) => name), [
    "lagunak-puestos",
    "lagunak-espacio-puesto",
  ]);
});

test("v11 abre el mapa vivo con Application clásica (rAF ausente: sin bucle)", async () => {
  const { hooks, instances } = await loadModule();
  const controls = [];

  hooks.getSceneControlButtons(controls);
  const mapa = controls.find((c) => c.name === "lagunak").tools.find((t) => t.name === "lagunak-mapa");
  assert.ok(mapa);
  assert.equal(mapa.button, true);
  // Abrir no debe romper aunque el arnés no tenga requestAnimationFrame:
  // la animación se auto-inhibe y la ventana sigue funcionando por sondeo.
  mapa.onClick();

  assert.equal(instances.length, 1);
  assert.deepEqual(instances[0].renderCalls, [true]);
  // Ventana propia, no la de estado.
  assert.equal(instances[0].constructor.defaultOptions.id, "lagunak-mapa-vivo");
});

test("host moderno registra el mapa vivo con onChange (v13) y lo abre", async () => {
  const { hooks, instances } = await loadModule({ modern: true });
  const controls = {};

  hooks.getSceneControlButtons(controls);
  const mapa = controls.lagunak.tools["lagunak-mapa"];
  assert.ok(mapa);
  assert.equal(typeof mapa.onClick, "function");
  assert.equal(typeof mapa.onChange, "function"); // v13 dispara onChange
  mapa.onClick();

  assert.equal(instances.length, 1);
  assert.deepEqual(instances[0].renderCalls, [{ force: true }]);
  assert.equal(instances[0].constructor.DEFAULT_OPTIONS.id, "lagunak-mapa-vivo");
});

test("las ventanas de estado y mapa son instancias separadas", async () => {
  const { hooks, instances } = await loadModule({ modern: true });
  const controls = {};

  hooks.getSceneControlButtons(controls);
  controls.lagunak.tools["lagunak-estado"].onClick();
  controls.lagunak.tools["lagunak-mapa"].onClick();

  assert.equal(instances.length, 2);
  assert.notEqual(instances[0].constructor, instances[1].constructor);
  // Reabrir no crea instancias nuevas (instancia perezosa compartida).
  controls.lagunak.tools["lagunak-mapa"].onClick();
  assert.equal(instances.length, 2);
});

test("v11 conserva la ayuda abierta entre re-renderizados hasta que se cierra", async () => {
  const { hooks, instances } = await loadModule();
  const controls = [];
  hooks.getSceneControlButtons(controls);
  controls.find((group) => group.name === "lagunak").tools[0].onClick();

  const bindings = new Map();
  instances[0].activateListeners({
    find(selector) {
      return { on(event, callback) { bindings.set(selector, { event, callback }); } };
    },
  });

  const toggle = bindings.get(".lagunak-ayuda");
  assert.equal(toggle.event, "toggle");
  assert.equal(instances[0].getData().ayudaAbierta, false);
  toggle.callback({ currentTarget: { open: true } });
  instances[0].render(false); // reemplazo de DOM equivalente al del sondeo
  assert.equal(instances[0].getData().ayudaAbierta, true);
  toggle.callback({ currentTarget: { open: false } });
  assert.equal(instances[0].getData().ayudaAbierta, false);
});

test("ApplicationV2 conserva la ayuda abierta entre re-renderizados hasta que se cierra", async () => {
  const { hooks, instances } = await loadModule({ modern: true });
  const controls = {};
  hooks.getSceneControlButtons(controls);
  controls.lagunak.tools["lagunak-estado"].onClick();

  let onToggle = null;
  const details = {
    open: false,
    addEventListener(event, callback) {
      if (event === "toggle") onToggle = callback;
    },
  };
  instances[0].element = { querySelector: () => details };
  instances[0]._onRender({}, {});

  assert.equal((await instances[0]._prepareContext()).ayudaAbierta, false);
  details.open = true;
  onToggle({ currentTarget: details });
  instances[0].render({ force: true });
  assert.equal((await instances[0]._prepareContext()).ayudaAbierta, true);
  details.open = false;
  onToggle({ currentTarget: details });
  assert.equal((await instances[0]._prepareContext()).ayudaAbierta, false);

  const template = await readFile(new URL("../templates/estado-nave.hbs", import.meta.url), "utf8");
  assert.match(template, /\{\{#if ayudaAbierta\}\}open\{\{\/if\}\}/);
});
