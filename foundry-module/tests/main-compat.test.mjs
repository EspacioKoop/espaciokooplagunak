import assert from "node:assert/strict";
import test from "node:test";

let importNonce = 0;

async function loadModule({ modern = false, isGM = true, fetchImpl } = {}) {
  const hooks = {};
  const instances = [];
  const notifications = { info: [], warn: [], error: [] };
  const fetchCalls = [];

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
    user: { isGM },
    settings: {
      register() {},
      get(_module, key) {
        if (key === "bridgeUrl") return "http://bridge.test";
        if (key === "bridgeToken") return "test-token";
        return 2;
      },
    },
    i18n: { localize: (key) => key },
    journal: { getName: () => null },
  };
  globalThis.JournalEntry = { create: async () => null };
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

  await import(`../scripts/main.mjs?compat-test=${importNonce++}`);
  return { hooks, instances, notifications, fetchCalls };
}

function pauseValues(fetchCalls) {
  return fetchCalls.map(([, options]) => JSON.parse(options.body).paused);
}

test("v11 conecta los listeners de pausa y reanudación con el puente", async () => {
  const { hooks, instances, notifications, fetchCalls } = await loadModule();
  const controls = [{ name: "token", tools: [] }];

  hooks.getSceneControlButtons(controls);
  assert.equal(controls[0].tools.length, 1);
  controls[0].tools[0].onClick();

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
  await bindings.get('[data-action="pausar"]').callback();
  await bindings.get('[data-action="reanudar"]').callback();

  assert.deepEqual(pauseValues(fetchCalls), [true, false]);
  assert.deepEqual(notifications.info, ["LAGUNAK.Tempo.Pausado", "LAGUNAK.Tempo.Reanudado"]);
  assert.deepEqual(notifications.error, []);
});

test("host moderno conecta las acciones de pausa y reanudación con el puente", async () => {
  const { hooks, instances, notifications, fetchCalls } = await loadModule({ modern: true });
  const controls = { tokens: { tools: {} } };

  hooks.getSceneControlButtons(controls);
  assert.ok(controls.tokens.tools["lagunak-estado"]);
  controls.tokens.tools["lagunak-estado"].onClick();

  assert.equal(instances.length, 1);
  assert.deepEqual(instances[0].renderCalls, [{ force: true }]);
  const actions = instances[0].constructor.DEFAULT_OPTIONS.actions;
  assert.equal(typeof actions.pausar, "function");
  assert.equal(typeof actions.reanudar, "function");
  await actions.pausar.call(instances[0]);
  await actions.reanudar.call(instances[0]);

  assert.deepEqual(pauseValues(fetchCalls), [true, false]);
  assert.deepEqual(notifications.info, ["LAGUNAK.Tempo.Pausado", "LAGUNAK.Tempo.Reanudado"]);
  assert.deepEqual(notifications.error, []);
});

test("v11 muestra el error del puente sin emitir una confirmación falsa", async () => {
  const { hooks, instances, notifications, fetchCalls } = await loadModule({
    fetchImpl: async () => ({ ok: false, status: 503, async json() { return {}; } }),
  });
  const controls = [{ name: "token", tools: [] }];
  hooks.getSceneControlButtons(controls);
  controls[0].tools[0].onClick();

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
  const controls = { tokens: { tools: {} } };
  hooks.getSceneControlButtons(controls);
  controls.tokens.tools["lagunak-estado"].onClick();

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
  controls[0].tools[0].onClick();

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
  const controls = { tokens: { tools: {} } };
  hooks.getSceneControlButtons(controls);
  controls.tokens.tools["lagunak-estado"].onClick();
  game.user.isGM = false;

  const actions = instances[0].constructor.DEFAULT_OPTIONS.actions;
  await actions.pausar.call(instances[0]);
  await actions.reanudar.call(instances[0]);

  assert.deepEqual(fetchCalls, []);
  assert.deepEqual(notifications.info, []);
  assert.deepEqual(notifications.error, []);
});

test("un jugador no GM no recibe el control de estado", async () => {
  const { hooks } = await loadModule({ isGM: false });
  const controls = [{ name: "token", tools: [] }];

  hooks.getSceneControlButtons(controls);
  assert.deepEqual(controls[0].tools, []);
});
