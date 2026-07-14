import assert from "node:assert/strict";
import test from "node:test";

let importNonce = 0;

async function loadModule({ modern = false, isGM = true } = {}) {
  const hooks = {};
  const instances = [];

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
    journal: { getName: () => null },
  };
  globalThis.JournalEntry = { create: async () => null };
  globalThis.ui = {
    notifications: {
      info() {},
      warn() {},
      error() {},
    },
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
  return { hooks, instances };
}

test("v11 abre Application clásica y registra listeners de tempo", async () => {
  const { hooks, instances } = await loadModule();
  const controls = [{ name: "token", tools: [] }];

  hooks.getSceneControlButtons(controls);
  // Dos herramientas: estado de la nave y mapa vivo.
  assert.equal(controls[0].tools.length, 2);
  assert.equal(controls[0].tools[0].name, "lagunak-estado");
  assert.equal(controls[0].tools[1].name, "lagunak-mapa");
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
  assert.equal(typeof bindings.get('[data-action="pausar"]').callback, "function");
  assert.equal(typeof bindings.get('[data-action="reanudar"]').callback, "function");
});

test("host moderno abre ApplicationV2 y registra acciones de tempo", async () => {
  const { hooks, instances } = await loadModule({ modern: true });
  const controls = { tokens: { tools: {} } };

  hooks.getSceneControlButtons(controls);
  assert.ok(controls.tokens.tools["lagunak-estado"]);
  controls.tokens.tools["lagunak-estado"].onClick();

  assert.equal(instances.length, 1);
  assert.deepEqual(instances[0].renderCalls, [{ force: true }]);
  const actions = instances[0].constructor.DEFAULT_OPTIONS.actions;
  assert.equal(typeof actions.pausar, "function");
  assert.equal(typeof actions.reanudar, "function");
});

test("un jugador no GM no recibe ningún control", async () => {
  const { hooks } = await loadModule({ isGM: false });
  const controls = [{ name: "token", tools: [] }];

  hooks.getSceneControlButtons(controls);
  assert.deepEqual(controls[0].tools, []);
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
