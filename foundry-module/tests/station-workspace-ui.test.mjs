import assert from "node:assert/strict";
import test from "node:test";

let nonce = 0;

function makeUser({ id, isGM = false, station = null }) {
  return {
    id,
    name: id,
    isGM,
    active: true,
    getFlag(_module, key) { return key === "station" ? station : null; },
  };
}

async function setup({ isGM = false, modern = false, fetchImpl = null } = {}) {
  const hooks = {};
  const instances = [];
  const settingsReads = [];

  class BaseApplication {
    static get defaultOptions() { return {}; }
    constructor() {
      instances.push(this);
      this.rendered = false;
      this.renderCalls = [];
    }
    render(options) {
      this.rendered = true;
      this.renderCalls.push(options);
      return this;
    }
    async _render() { this.rendered = true; }
    activateListeners() {}
    async close() { this.rendered = false; }
  }

  const current = makeUser({
    id: isGM ? "gm" : "p1",
    isGM,
    station: isGM ? null : "navigation",
  });
  const other = makeUser({ id: "p2", station: "engineering" });
  const users = [current, other];
  users.get = (id) => users.find((entry) => entry.id === id);

  globalThis.Application = BaseApplication;
  globalThis.Hooks = { on(name, callback) { hooks[name] = callback; } };
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
    user: current,
    users,
    i18n: { localize: (key) => key },
    settings: {
      get(_module, key) {
        settingsReads.push(key);
        if (!isGM) throw new Error("un jugador no debe leer ajustes del puente");
        if (key === "bridgeUrl") return "http://bridge.invalid";
        return null;
      },
    },
  };
  globalThis.fetch = fetchImpl ?? (() => { throw new Error("fetch inesperado"); });

  const tokenSession = await import("../scripts/bridge-token-session.mjs");
  tokenSession.clearBridgeToken();
  if (isGM) tokenSession.setBridgeToken("secret-for-test");
  const module = await import(`../scripts/station-workspace-ui.mjs?workspace-ui=${nonce++}`);
  module.registerWorkspaceFeature("espaciokoop-lagunak");
  return { module, hooks, instances, settingsReads };
}

test("v11: un jugador abre su consola sin leer token ni ejecutar fetch", async () => {
  const { module, instances, settingsReads } = await setup();
  const controls = [{ name: "token", tools: [] }];
  module.addWorkspaceControl(controls);
  assert.equal(controls[0].tools[0].name, "lagunak-espacio-puesto");

  controls[0].tools[0].onClick();
  assert.equal(instances.length, 1);
  assert.deepEqual(instances[0].renderCalls, [true]);
  const model = instances[0].getData();
  assert.equal(model.station, "navigation");
  assert.equal(model.connectionRestricted, true);
  assert.equal(model.hasTelemetry, false);
  assert.deepEqual(settingsReads, []);
});

test("ApplicationV2: el GM recibe estado y contactos y previsualiza puestos", async () => {
  const fetchImpl = async (url, options) => {
    assert.equal(options.headers.Authorization, "Bearer secret-for-test");
    const payload = url.endsWith("/v1/state")
      ? { ship: { callsign: "Lagunak", hull: 75, hull_max: 100, energy: 80, energy_max: 100, systems: {} } }
      : { contacts: [], total: 0, truncated: false };
    return { ok: true, async json() { return payload; } };
  };
  const { module, instances, settingsReads } = await setup({ isGM: true, modern: true, fetchImpl });
  const controls = { tokens: { tools: {} } };
  module.addWorkspaceControl(controls);
  assert.equal(typeof controls.tokens.tools["lagunak-espacio-puesto"].onChange, "function");

  controls.tokens.tools["lagunak-espacio-puesto"].onClick();
  const app = instances[0];
  assert.deepEqual(app.renderCalls, [{ force: true }]);
  assert.equal(await app.refreshTelemetry(), true);
  app.setPreviewStation("engineering");

  const model = await app._prepareContext();
  assert.equal(model.station, "engineering");
  assert.equal(model.hasTelemetry, true);
  assert.equal(model.connectionOk, true);
  assert.equal(JSON.stringify(model).includes("secret-for-test"), false);
  assert.deepEqual(settingsReads, ["bridgeUrl"]);
});

test("una respuesta tardía tras cerrar no repuebla la consola", async () => {
  let resolveState;
  let resolveContacts;
  const fetchImpl = (url) => new Promise((resolve) => {
    if (url.endsWith("/v1/state")) resolveState = resolve;
    else resolveContacts = resolve;
  });
  const { module, instances } = await setup({ isGM: true, modern: true, fetchImpl });
  module.openWorkspaceApp();
  const app = instances[0];
  const pending = app.refreshTelemetry();
  app._onClose();
  resolveState({ ok: true, async json() { return { ship: { callsign: "Tardía" } }; } });
  resolveContacts({ ok: true, async json() { return { contacts: [] }; } });

  assert.equal(await pending, false);
  assert.equal(app.statePayload, null);
  assert.equal(app.contactsPayload, null);
});

test("revocar el workspace vacía DOM y descarta telemetría tardía", async () => {
  let resolveState;
  let resolveContacts;
  const fetchImpl = (url) => new Promise((resolve) => {
    if (url.endsWith("/v1/state")) resolveState = resolve;
    else resolveContacts = resolve;
  });
  const { module, instances } = await setup({ isGM: true, modern: true, fetchImpl });
  module.openWorkspaceApp();
  const app = instances[0];
  app.statePayload = { ship: { callsign: "Agregado GM" } };
  let wipes = 0;
  app.element = { replaceChildren() { wipes += 1; } };
  const pending = app.refreshTelemetry();

  game.user.isGM = false;
  await module.revokeWorkspaceAccess();
  resolveState({ ok: true, async json() { return { ship: { callsign: "Tardía" } }; } });
  resolveContacts({ ok: true, async json() { return { contacts: [] }; } });

  assert.equal(await pending, false);
  assert.equal(app.closed, true);
  assert.equal(app.rendered, false);
  assert.equal(app.statePayload, null);
  assert.equal(app.contactsPayload, null);
  assert.equal(wipes, 1);
});

for (const modern of [false, true]) {
  const version = modern ? "ApplicationV2" : "v11";

  test(`${version}: cerrar y reabrir crea una instancia capaz de actualizar telemetría`, async () => {
    let fetchCalls = 0;
    const fetchImpl = async (url) => {
      fetchCalls += 1;
      const payload = url.endsWith("/v1/state")
        ? { ship: { callsign: "Lagunak", systems: {} } }
        : { contacts: [] };
      return { ok: true, async json() { return payload; } };
    };
    const { module, instances } = await setup({ isGM: true, modern, fetchImpl });

    module.openWorkspaceApp();
    const first = instances[0];
    if (modern) first._onClose();
    else await first.close();

    module.openWorkspaceApp();
    const reopened = instances[1];
    assert.notEqual(reopened, first);
    assert.equal(reopened.closed, false);
    assert.equal(await reopened.refreshTelemetry(), true);
    assert.equal(reopened.statePayload.ship.callsign, "Lagunak");
    assert.equal(fetchCalls, 2);
  });
}
