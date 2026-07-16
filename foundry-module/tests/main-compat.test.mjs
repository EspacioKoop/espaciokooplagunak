import assert from "node:assert/strict";
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

  await import(`../scripts/main.mjs?compat-test=${importNonce++}`);
  return { hooks, instances, notifications, fetchCalls, journalPages };
}

function pauseValues(fetchCalls) {
  return fetchCalls.map(([, options]) => JSON.parse(options.body).paused);
}

function toolByName(controls, name) {
  return controls[0].tools.find((tool) => tool.name === name);
}

test("v11 conecta los listeners de pausa y reanudación con el puente", async () => {
  const { hooks, instances, notifications, fetchCalls } = await loadModule();
  const controls = [{ name: "token", tools: [] }];

  hooks.getSceneControlButtons(controls);
  // Cuatro herramientas: asignación, espacio del puesto, estado y mapa vivo.
  assert.deepEqual(controls[0].tools.map(({ name }) => name), [
    "lagunak-puestos",
    "lagunak-espacio-puesto",
    "lagunak-estado",
    "lagunak-mapa",
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
  await bindings.get('[data-action="pausar"]').callback();
  await bindings.get('[data-action="reanudar"]').callback();

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

test("un jugador no GM recibe asignación y espacio de puesto, sin controles GM", async () => {
  const { hooks } = await loadModule({ isGM: false });
  const controls = [{ name: "token", tools: [] }];

  hooks.getSceneControlButtons(controls);
  assert.deepEqual(controls[0].tools.map(({ name }) => name), [
    "lagunak-puestos",
    "lagunak-espacio-puesto",
  ]);
});

test("v11 abre el mapa vivo con Application clásica (rAF ausente: sin bucle)", async () => {
  const { hooks, instances } = await loadModule();
  const controls = [{ name: "token", tools: [] }];

  hooks.getSceneControlButtons(controls);
  const mapa = controls[0].tools.find((t) => t.name === "lagunak-mapa");
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
  const controls = { tokens: { tools: {} } };

  hooks.getSceneControlButtons(controls);
  const mapa = controls.tokens.tools["lagunak-mapa"];
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
  const controls = { tokens: { tools: {} } };

  hooks.getSceneControlButtons(controls);
  controls.tokens.tools["lagunak-estado"].onClick();
  controls.tokens.tools["lagunak-mapa"].onClick();

  assert.equal(instances.length, 2);
  assert.notEqual(instances[0].constructor, instances[1].constructor);
  // Reabrir no crea instancias nuevas (instancia perezosa compartida).
  controls.tokens.tools["lagunak-mapa"].onClick();
  assert.equal(instances.length, 2);
});
