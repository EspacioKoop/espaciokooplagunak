import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

let importNonce = 0;

async function loadSession({
  isGM = true,
  modern = false,
  settingsFail = false,
  settingsSet = null,
  renderFail = false,
  renderFailAfter = null,
  closeFail = false,
} = {}) {
  const notifications = { info: [], warn: [], error: [] };
  const settingsWrites = [];
  const instances = [];

  class BaseApplication {
    static get defaultOptions() { return {}; }
    constructor() {
      instances.push(this);
      this.rendered = false;
      this.closed = false;
      this.renderCount = 0;
    }
    render() {
      this.rendered = true;
      this.renderCount += 1;
      if (renderFail || (renderFailAfter !== null && this.renderCount > renderFailAfter)) {
        return Promise.reject(new Error("render failed"));
      }
      return this;
    }
    activateListeners() {}
    async close() {
      if (closeFail) throw new Error("close failed");
      this.closed = true;
      this.rendered = false;
    }
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
    user: { id: "local-user", isGM },
    settings: {
      async set(moduleId, key, value) {
        if (settingsSet) return settingsSet(moduleId, key, value);
        if (settingsFail) throw new Error("storage unavailable");
        settingsWrites.push([moduleId, key, value]);
      },
    },
    i18n: { localize: (key) => key },
  };
  globalThis.ui = {
    notifications: {
      info: (message) => notifications.info.push(message),
      warn: (message) => notifications.warn.push(message),
      error: (message) => notifications.error.push(message),
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
  assert.equal(await module.openBridgeTokenApp(), null);
});

test("una migración fallida bloquea la ventana", async () => {
  const { module, instances, notifications } = await loadSession({ settingsFail: true });
  assert.equal(await module.openBridgeTokenApp(), null);
  assert.equal(instances.length, 0);
  assert.deepEqual(notifications.warn, ["LAGUNAK.Token.ErrorMigracion"]);
});

test("la migración concurrente comparte intento y permite reintentar", async () => {
  let rejectFirst;
  let calls = 0;
  const settingsSet = async () => {
    calls += 1;
    if (calls === 1) {
      await new Promise((_resolve, reject) => { rejectFirst = reject; });
    }
  };
  const { module, instances } = await loadSession({ settingsSet });
  const first = module.clearLegacyBridgeToken();
  const concurrent = module.openBridgeTokenApp();
  await Promise.resolve();
  assert.equal(calls, 1);
  rejectFirst(new Error("first attempt failed"));
  assert.equal(await first, false);
  assert.equal(await concurrent, null);

  const app = await module.openBridgeTokenApp();
  assert.ok(app);
  assert.equal(calls, 2);
  assert.equal(instances.length, 1);
});

test("ApplicationV2 captura un rechazo de render", async () => {
  const { module, notifications } = await loadSession({ modern: true, renderFail: true });
  assert.equal(await module.openBridgeTokenApp(), null);
  assert.deepEqual(notifications.error, ["LAGUNAK.Token.ErrorVentana"]);
});

test("un rechazo de re-render revoca memoria, vacía DOM e inutiliza la instancia", async () => {
  const { module, notifications } = await loadSession({ modern: true, renderFailAfter: 1 });
  const app = await module.openBridgeTokenApp();
  const input = { value: "SECRETO-SIN-GUARDAR" };
  app.element = { querySelector: () => input };
  module.setBridgeToken("token-anterior");

  assert.equal(await module.openBridgeTokenApp(), null);
  assert.equal(input.value, "");
  assert.equal(module.getBridgeToken(), "");
  assert.equal(app.bridgeAccessRevoked, true);
  assert.equal(app.closed, true);
  assert.deepEqual(notifications.error, ["LAGUNAK.Token.ErrorVentana"]);

  await app.constructor.DEFAULT_OPTIONS.actions.saveToken.call(app);
  assert.equal(module.getBridgeToken(), "");
});

test("revocar captura un fallo de cierre y vacía el campo sensible", async () => {
  const { module, notifications } = await loadSession({ modern: true, closeFail: true });
  const app = await module.openBridgeTokenApp();
  const input = { value: "secreto-en-edicion" };
  app.element = { querySelector: () => input };
  module.setBridgeToken("token-revocable");

  await module.revokeBridgeTokenAccess();

  assert.equal(module.getBridgeToken(), "");
  assert.equal(input.value, "");
  assert.deepEqual(notifications.warn, ["LAGUNAK.Token.ErrorCierre"]);
});

test("ApplicationV2 revierte Guardar si el cierre falla", async () => {
  const { module, notifications } = await loadSession({ modern: true, closeFail: true });
  const app = await module.openBridgeTokenApp();
  const input = { value: "token-no-confirmado" };
  app.element = { querySelector: () => input };

  await app.constructor.DEFAULT_OPTIONS.actions.saveToken.call(app);

  assert.equal(module.getBridgeToken(), "");
  assert.equal(input.value, "");
  assert.deepEqual(notifications.info, []);
  assert.deepEqual(notifications.warn, ["LAGUNAK.Token.ErrorCierre"]);
});

test("ApplicationV2 Borrar vacía DOM y memoria aunque el cierre falle", async () => {
  const { module, notifications } = await loadSession({ modern: true, closeFail: true });
  const app = await module.openBridgeTokenApp();
  const input = { value: "secreto-en-edicion" };
  app.element = { querySelector: () => input };
  module.setBridgeToken("token-revocable");

  await app.constructor.DEFAULT_OPTIONS.actions.clearToken.call(app);

  assert.equal(module.getBridgeToken(), "");
  assert.equal(input.value, "");
  assert.deepEqual(notifications.info, []);
  assert.deepEqual(notifications.warn, ["LAGUNAK.Token.ErrorCierre"]);
});

test("degradar al usuario oculta y revoca definitivamente el token", async () => {
  const { module } = await loadSession();
  module.setBridgeToken("token-revocable");
  game.user.isGM = false;
  assert.equal(module.getBridgeToken(), "");
  await module.revokeBridgeTokenAccess();
  game.user.isGM = true;
  assert.equal(module.getBridgeToken(), "");
});

test("v11 guarda el campo en memoria, lo cierra y permite reabrir", async () => {
  const { module, instances, notifications } = await loadSession();
  const app = await module.openBridgeTokenApp();
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
  const reopened = await module.openBridgeTokenApp();
  assert.notEqual(reopened, app);
  assert.equal(instances.length, 2);
});

test("ApplicationV2 conecta guardar y borrar sin persistencia", async () => {
  const { module, notifications } = await loadSession({ modern: true });
  const app = await module.openBridgeTokenApp();
  app.element = { querySelector: () => ({ value: "token-v13" }) };
  const actions = app.constructor.DEFAULT_OPTIONS.actions;
  await actions.saveToken.call(app);
  assert.equal(module.getBridgeToken(), "token-v13");
  app._onClose();

  const reopened = await module.openBridgeTokenApp();
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
