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

// LA GARANTÍA QUE NO CAMBIA con la apertura de telemetría (#331): el cliente de
// un jugador no lee el token ni habla con el puente. Lo que cambió es que ahora
// recibe la nave por difusión del GM; lo que NO cambió es que no puede pedirla.
test("v11: un jugador abre su consola sin leer token ni ejecutar fetch", async () => {
  const { module, instances, settingsReads } = await setup();
  const controls = [{ name: "lagunak", tools: [] }];
  module.addWorkspaceControl(controls);
  assert.equal(controls[0].tools[0].name, "lagunak-espacio-puesto");

  controls[0].tools[0].onClick();
  assert.equal(instances.length, 1);
  assert.deepEqual(instances[0].renderCalls, [true]);
  const model = instances[0].getData();
  assert.equal(model.station, "navigation");
  // Ya no está «restringido» —eso decía «no tienes permiso»— sino esperando la
  // difusión del GM, que es lo que de verdad ocurre.
  assert.equal(model.connectionRestricted, false);
  assert.equal(model.connectionLoading, true);
  assert.equal(model.hasTelemetry, false, "todavía no ha llegado nada");
  // Lo importante: ni una lectura de ajustes, así que ni token ni URL del puente.
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
  const controls = { lagunak: { tools: {} } };
  module.addWorkspaceControl(controls);
  assert.equal(typeof controls.lagunak.tools["lagunak-espacio-puesto"].onChange, "function");

  controls.lagunak.tools["lagunak-espacio-puesto"].onClick();
  const app = instances[0];
  assert.deepEqual(app.renderCalls, [{ force: true }]);
  assert.equal(await app.refreshTelemetry(), true);
  app.setPreviewStation("engineering");

  const model = await app._prepareContext();
  assert.equal(model.station, "engineering");
  assert.equal(model.hasTelemetry, true);
  assert.equal(model.connectionOk, true);
  assert.equal(JSON.stringify(model).includes("secret-for-test"), false);
  // La URL del puente y el ajuste donde se publica la telemetría: el sondeo lee
  // el segundo para no reescribir una lectura idéntica. El TOKEN no sale por
  // ajustes —vive en la sesión del navegador— y por eso no aparece aquí.
  assert.deepEqual(settingsReads, ["bridgeUrl", "telemetriaNave"]);
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

test("updateUser no re-renderiza la consola cerrada (regresión #263)", async () => {
  const { module, hooks, instances } = await setup();
  module.openWorkspaceApp();
  const app = instances[0];
  assert.deepEqual(app.renderCalls, [true]);
  await app.close();
  assert.equal(app.rendered, false);
  // Cambiar de puesto dispara updateUser. Sin el guard, esto llamaría
  // render(false) sobre la app cerrada y en Foundry real reventaría en
  // _replaceHTML (element fuera del DOM).
  hooks.updateUser();
  assert.deepEqual(app.renderCalls, [true]);
});

test("updateUser sí refresca la consola abierta", async () => {
  const { module, hooks, instances } = await setup();
  module.openWorkspaceApp();
  const app = instances[0];
  hooks.updateUser();
  assert.deepEqual(app.renderCalls, [true, false]);
});

// La lámina del objetivo de atraque tiene DOS rutas de ciclo de vida (#391), y
// las pruebas de la lámina la montan directamente: no ejercitan ninguna de las
// dos. Aquí se entra por el lifecycle real de cada ruta, que es donde se colaba
// que la clásica de v11 no montara nada y que ningún cierre parara el bucle.
function raizConLaminaDeAtraque() {
  const ordenes = [];
  const ctx = new Proxy(
    { fill: () => ordenes.push("fill") },
    { get: (obj, prop) => obj[prop] ?? (() => ordenes.push(String(prop))), set: () => true },
  );
  const lienzo = { width: 112, height: 84, getContext: () => ctx };
  return {
    ordenes,
    querySelectorAll: () => [],
    querySelector: (sel) => (sel === "[data-lagunak-atraque]" ? lienzo : null),
  };
}

for (const modern of [false, true]) {
  const version = modern ? "ApplicationV2" : "v11";

  test(`${version}: la lámina de atraque se monta al renderizar y se para al cerrar`, async () => {
    const previo = {
      raf: globalThis.requestAnimationFrame,
      caf: globalThis.cancelAnimationFrame,
    };
    let siguienteId = 1;
    const pendientes = [];
    let cancelados = 0;
    // No se ejecuta ningún fotograma encolado: lo que se mide es si el bucle
    // queda vivo tras cerrar, no cuántas veces pinta.
    globalThis.requestAnimationFrame = (fn) => {
      pendientes.push(fn);
      return siguienteId++;
    };
    globalThis.cancelAnimationFrame = () => { cancelados += 1; };
    try {
      const { module, instances } = await setup({ modern });
      module.openWorkspaceApp();
      const app = instances[0];
      const raiz = raizConLaminaDeAtraque();
      app.element = modern ? raiz : { 0: raiz, find: () => ({ on() {} }) };
      app.ultimoModelo = { atraque: { estado: "docking", clase: "Station" } };

      if (modern) app._onRender({}, {});
      else app.activateListeners(app.element);
      assert.ok(
        raiz.ordenes.includes("fill"),
        "la ruta clásica tiene que pintar la lámina igual que la moderna",
      );
      assert.equal(pendientes.length, 1, "y dejar un fotograma encadenado, o no gira");

      if (modern) app._onClose({});
      else await app.close();
      assert.equal(cancelados, 1, "cerrar la consola cancela el fotograma en vuelo");
    } finally {
      globalThis.requestAnimationFrame = previo.raf;
      globalThis.cancelAnimationFrame = previo.caf;
    }
  });
}
