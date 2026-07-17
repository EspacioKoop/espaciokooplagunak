import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

let importNonce = 0;

async function loadSession({ isGM = true, modern = false } = {}) {
  const notifications = { info: [], warn: [] };
  const settingsWrites = [];
  const instances = [];

  class BaseApplication {
    static get defaultOptions() { return {}; }
    constructor() {
      instances.push(this);
      this.rendered = false;
      this.closed = false;
    }
    render() { this.rendered = true; return this; }
    activateListeners() {}
    async close() { this.closed = true; this.rendered = false; }
  }

  globalThis.Application = BaseApplication;
  globalThis.foundry = {
    utils: { mergeObject: (base, extra) => ({ ...base, ...extra }) },
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
  globalThis.game = {
    user: { isGM },
    settings: {
      async set(moduleId, key, value) {
        settingsWrites.push([moduleId, key, value]);
      },
    },
    i18n: { localize: (key) => key },
  };
  globalThis.ui = {
    notifications: {
      info: (message) => notifications.info.push(message),
      warn: (message) => notifications.warn.push(message),
    },
  };
  const module = await import(`../scripts/bridge-token-session.mjs?test=${importNonce++}`);
  module.registerBridgeTokenFeature("espaciokoop-lagunak");
  return { module, notifications, settingsWrites, instances };
}

test("el token vive solo en memoria y se puede borrar", async () => {
  const { module } = await loadSession();
  assert.equal(module.getBridgeToken(), "");
  assert.equal(module.setBridgeToken("  secreto-de-sesion  "), true);
  assert.equal(module.getBridgeToken(), "secreto-de-sesion");
  module.clearBridgeToken();
  assert.equal(module.getBridgeToken(), "");
});

test("la migración sobrescribe el ajuste legado sin leerlo", async () => {
  const { module, settingsWrites } = await loadSession();
  assert.equal(await module.clearLegacyBridgeToken(), true);
  assert.deepEqual(settingsWrites, [["espaciokoop-lagunak", "bridgeToken", ""]]);
});

test("un jugador no puede abrir la ventana del token", async () => {
  const { module } = await loadSession({ isGM: false });
  assert.equal(module.openBridgeTokenApp(), null);
});

test("v11 guarda el campo en memoria, lo cierra y permite reabrir", async () => {
  const { module, instances, notifications } = await loadSession();
  const app = module.openBridgeTokenApp();
  const bindings = new Map();
  const html = {
    find(selector) {
      return {
        val: () => selector === '[name="bridge-token"]' ? "token-v11" : "",
        on: (_event, callback) => bindings.set(selector, callback),
      };
    },
  };
  app.activateListeners(html);
  await bindings.get('[data-action="saveToken"]')();

  assert.equal(module.getBridgeToken(), "token-v11");
  assert.equal(app.closed, true);
  assert.deepEqual(notifications.info, ["LAGUNAK.Token.Configurado"]);
  const reopened = module.openBridgeTokenApp();
  assert.notEqual(reopened, app);
  assert.equal(instances.length, 2);
});

test("ApplicationV2 conecta guardar y borrar sin persistencia", async () => {
  const { module, notifications } = await loadSession({ modern: true });
  const app = module.openBridgeTokenApp();
  app.element = { querySelector: () => ({ value: "token-v13" }) };
  const actions = app.constructor.DEFAULT_OPTIONS.actions;
  await actions.saveToken.call(app);
  assert.equal(module.getBridgeToken(), "token-v13");
  app._onClose();

  const reopened = module.openBridgeTokenApp();
  await reopened.constructor.DEFAULT_OPTIONS.actions.clearToken.call(reopened);
  assert.equal(module.getBridgeToken(), "");
  assert.deepEqual(notifications.info, [
    "LAGUNAK.Token.Configurado",
    "LAGUNAK.Token.Borrado",
  ]);
});

test("el contrato no vuelve a persistir ni prerrellenar el secreto", async () => {
  const [main, workspace, template] = await Promise.all([
    readFile(new URL("../scripts/main.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/station-workspace-ui.mjs", import.meta.url), "utf8"),
    readFile(new URL("../templates/token-puente.hbs", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(main, /settings\.get\(MODULE_ID,\s*["']bridgeToken["']/);
  assert.doesNotMatch(workspace, /settings\.get\([^)]*["']bridgeToken["']/);
  assert.match(main, /config:\s*false/);
  assert.match(template, /type="password"/);
  assert.match(template, /autocomplete="new-password"/);
  assert.match(template, /value=""/);
});
