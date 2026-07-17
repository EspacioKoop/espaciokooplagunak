import assert from "node:assert/strict";
import test from "node:test";

let importNonce = 0;

function respuesta(json) {
  return { ok: true, status: 200, async json() { return json; } };
}

function diferida() {
  let resolve;
  const promise = new Promise((resolver) => { resolve = resolver; });
  return { promise, resolve };
}

async function cargarMapa({ modern, t }) {
  const hooks = {};
  const instancias = [];
  const timers = [];
  const healthzVista = diferida();
  const contactosVistos = diferida();
  const liberarHealthz = diferida();
  const llamadasFetch = [];
  const originales = {
    Application: globalThis.Application,
    Hooks: globalThis.Hooks,
    JournalEntry: globalThis.JournalEntry,
    fetch: globalThis.fetch,
    foundry: globalThis.foundry,
    game: globalThis.game,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    ui: globalThis.ui,
  };

  t.after(() => Object.assign(globalThis, originales));

  globalThis.setTimeout = (callback, delay, ...args) => {
    const timer = { callback, delay, args, activo: true };
    timers.push(timer);
    return timer;
  };
  globalThis.clearTimeout = (timer) => {
    if (timer) timer.activo = false;
  };

  class BaseApplication {
    constructor() {
      instancias.push(this);
      this.rendered = false;
      this.renderCalls = [];
    }

    render(options) {
      this.renderCalls.push(options);
      this.rendered = true;
      return this;
    }

    async _render() {
      this.rendered = true;
      return this;
    }

    async close() {
      this.rendered = false;
      return this;
    }
  }

  globalThis.Application = BaseApplication;
  globalThis.Hooks = {
    once(name, callback) { hooks[name] = callback; },
    on(name, callback) { hooks[name] = callback; },
  };
  globalThis.game = {
    user: { isGM: true },
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
  globalThis.ui = { notifications: { info() {}, warn() {}, error() {} } };
  globalThis.foundry = {
    utils: { mergeObject: (base, extra) => ({ ...base, ...extra }) },
  };
  if (modern) {
    class ApplicationV2 extends BaseApplication {}
    globalThis.foundry.applications = {
      api: { ApplicationV2, HandlebarsApplicationMixin: (Base) => Base },
    };
  }

  globalThis.fetch = async (url) => {
    llamadasFetch.push(url);
    if (url.endsWith("/healthz")) {
      healthzVista.resolve();
      await liberarHealthz.promise;
      return respuesta({ bridge: "ok" });
    }
    if (url.endsWith("/v1/state")) {
      return respuesta({
        ship: {
          position: { x: 10, y: 20 },
          heading: 30,
          destination: { name: "Argia", position: { x: 5000, y: -2000 } },
        },
      });
    }
    if (url.endsWith("/v1/contacts")) {
      contactosVistos.resolve();
      return respuesta({ contacts: [] });
    }
    throw new Error(`Ruta inesperada: ${url}`);
  };

  await import(`../scripts/main.mjs?mapa-lifecycle-test=${importNonce++}`);
  return {
    contactosVistos,
    healthzVista,
    hooks,
    instancias,
    liberarHealthz,
    llamadasFetch,
    timers,
  };
}

async function vaciarMicrotareas() {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
}

for (const modern of [false, true]) {
  const version = modern ? "V2" : "V1";

  test(`${version}: cerrar durante /healthz no rearma el sondeo ni renderiza tarde`, async (t) => {
    const entorno = await cargarMapa({ modern, t });
    const controles = modern ? {} : [];
    entorno.hooks.getSceneControlButtons(controles);
    const boton = modern
      ? controles.lagunak.tools["lagunak-mapa"]
      : controles.find((c) => c.name === "lagunak").tools.find((tool) => tool.name === "lagunak-mapa");
    boton.onClick();

    const app = entorno.instancias[0];
    if (modern) app._onFirstRender();
    else await app._render(true);
    await entorno.healthzVista.promise;

    const rendersAntesDeCerrar = app.renderCalls.length;
    if (modern) app._onClose();
    else await app.close();

    entorno.liberarHealthz.resolve();
    await entorno.contactosVistos.promise;
    await vaciarMicrotareas();

    assert.deepEqual(entorno.llamadasFetch, [
      "http://bridge.test/healthz",
      "http://bridge.test/v1/state",
      "http://bridge.test/v1/contacts",
    ]);
    assert.equal(app.renderCalls.length, rendersAntesDeCerrar);
    assert.equal(
      entorno.timers.some((timer) => timer.activo && timer.delay === 2000),
      false,
      "una respuesta tardía no debe programar el siguiente sondeo",
    );
  });
}

for (const modern of [false, true]) {
  const version = modern ? "V2" : "V1";

  test(`${version}: el sondeo confirma el destino de /v1/state (issue #175)`, async (t) => {
    const entorno = await cargarMapa({ modern, t });
    const controles = modern ? {} : [];
    entorno.hooks.getSceneControlButtons(controles);
    const boton = modern
      ? controles.lagunak.tools["lagunak-mapa"]
      : controles.find((c) => c.name === "lagunak").tools.find((tool) => tool.name === "lagunak-mapa");
    boton.onClick();

    const app = entorno.instancias[0];
    if (modern) app._onFirstRender();
    else await app._render(true);
    await entorno.healthzVista.promise;

    // Antes de la primera lectura confirmada no hay destino: no se inventa.
    assert.equal(app.destino, null);

    entorno.liberarHealthz.resolve();
    await entorno.contactosVistos.promise;
    await vaciarMicrotareas();

    // El destino queda tal cual lo publicó /v1/state (muestra confirmada).
    assert.deepEqual(app.destino, { name: "Argia", position: { x: 5000, y: -2000 } });
  });
}
