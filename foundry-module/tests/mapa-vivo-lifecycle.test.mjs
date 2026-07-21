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

async function cargarMapa({
  modern,
  t,
  estadoPendienteSegunda = null,
  fallarEstadoLecturas = [],
  fallarContactosLecturas = [],
  contactosDuplicados = false,
}) {
  const hooks = {};
  const instancias = [];
  const timers = [];
  const healthzVista = diferida();
  const contactosVistos = diferida();
  const liberarHealthz = diferida();
  const llamadasFetch = [];
  let lecturasEstado = 0;
  let lecturasContactos = 0;
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
      this.distanciaNodes = [{ textContent: "" }, { textContent: "" }];
      this.fueraNodes = [{ hidden: true }, { hidden: true }];
      this.distanciaNode = this.distanciaNodes[0];
      this.fueraNode = this.fueraNodes[0];
      this.detalleDistanciaNode = { textContent: "" };
      this.detalleRumboNode = { textContent: "" };
      const botonesContacto = Array.from({ length: contactosDuplicados ? 2 : 1 }, (_, indice) => ({
        dataset: { contacto: contactosDuplicados ? "?" : "K-7", contactoIndice: String(indice) },
        querySelector: (selector) => {
          if (selector === ".lagunak-mapa-distancia") return this.distanciaNodes[indice];
          if (selector === "[data-lagunak-fuera]") return this.fueraNodes[indice];
          return null;
        },
      }));
      const raiz = {
        querySelectorAll: (selector) => selector === "[data-contacto]" ? botonesContacto : [],
        querySelector: (selector) => {
          if (selector === "[data-lagunak-detalle-distancia]") return this.detalleDistanciaNode;
          if (selector === "[data-lagunak-detalle-rumbo]") return this.detalleRumboNode;
          return null;
        },
      };
      this.element = modern ? raiz : [raiz];
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
        if (key === "pollSeconds") return 2;
      },
    },
    i18n: {
      localize: (key) => key,
      format: (key, data = {}) => String(data.distance ?? data.rumbo ?? key),
    },
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
      lecturasEstado += 1;
      if (lecturasEstado === 2 && estadoPendienteSegunda) await estadoPendienteSegunda.promise;
      if (fallarEstadoLecturas.includes(lecturasEstado)) throw new TypeError("state inaccesible");
      return respuesta({
        ship: {
          position: { x: lecturasEstado * 10, y: 20 },
          heading: 30,
          destination: { name: "Argia", position: { x: 5000, y: -2000 } },
        },
      });
    }
    if (url.endsWith("/v1/contacts")) {
      lecturasContactos += 1;
      if (fallarContactosLecturas.includes(lecturasContactos)) throw new TypeError("contacts inaccesible");
      contactosVistos.resolve();
      const contacts = [{
        callsign: "K-7",
        faction: "Kraylor",
        type: "CpuShip",
        is_player: false,
        position: { x: lecturasContactos === 1 ? 100 : 40000, y: 20 },
      }];
      if (contactosDuplicados) {
        contacts[0].callsign = "?";
        contacts.push({
          ...contacts[0],
          position: { x: lecturasContactos === 1 ? 200 : 20000, y: 20 },
        });
      }
      return respuesta({ contacts });
    }
    throw new Error(`Ruta inesperada: ${url}`);
  };

  const tokenSession = await import("../scripts/bridge-token-session.mjs");
  tokenSession.clearBridgeToken();
  tokenSession.setBridgeToken("test-token");
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
  for (let i = 0; i < 24; i += 1) await Promise.resolve();
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

  test(`${version}: un segundo sondeo solo posicional no reconstruye la ventana`, async (t) => {
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
    entorno.liberarHealthz.resolve();
    await entorno.contactosVistos.promise;
    await vaciarMicrotareas();

    const rendersTrasPrimeraMuestra = app.renderCalls.length;
    const timer = entorno.timers.find((candidato) => candidato.activo && candidato.delay === 2000);
    assert.ok(timer, "el primer sondeo correcto debe programar el siguiente");
    timer.activo = false;
    timer.callback(...timer.args);
    await vaciarMicrotareas();

    assert.equal(
      entorno.llamadasFetch.filter((url) => url.endsWith("/v1/contacts")).length,
      2,
      "debe haberse completado un segundo sondeo",
    );
    assert.equal(
      app.renderCalls.length,
      rendersTrasPrimeraMuestra,
      "una muestra con la misma estructura no debe sustituir el canvas",
    );
    assert.equal(
      app.distanciaNode.textContent,
      "39980",
      "la distancia confirmada debe actualizarse sobre el DOM estable",
    );
    assert.equal(app.fueraNode.hidden, false, "el aviso fuera del visor debe aparecer sin re-render");

    if (modern) app._onClose();
    else await app.close();
  });

  test(`${version}: filas duplicadas actualizan distancias por índice sin identidad inventada`, async (t) => {
    const entorno = await cargarMapa({ modern, t, contactosDuplicados: true });
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
    entorno.liberarHealthz.resolve();
    await entorno.contactosVistos.promise;
    await vaciarMicrotareas();

    app.seleccion = 1;
    const contextoSeleccionado = modern ? await app._prepareContext({}) : app.getData({});
    assert.equal(
      contextoSeleccionado.detalle.distanciaLabel,
      "190",
      "el panel debe resolver la segunda fila homónima por índice",
    );

    const rendersIniciales = app.renderCalls.length;
    const timer = entorno.timers.find((candidato) => candidato.activo && candidato.delay === 2000);
    timer.activo = false;
    timer.callback(...timer.args);
    await vaciarMicrotareas();
    assert.equal(app.renderCalls.length, rendersIniciales);
    assert.equal(app.seleccion, 1, "el sondeo conserva la segunda identidad homónima");
    assert.deepEqual(app.distanciaNodes.map((nodo) => nodo.textContent), ["39980", "19980"]);
    assert.equal(app.detalleDistanciaNode.textContent, "19980");
    assert.deepEqual(app.fueraNodes.map((nodo) => nodo.hidden), [false, true]);
    if (modern) app._onClose();
    else await app.close();
  });

  test(`${version}: no rearma mientras una rama del lote sigue pendiente`, async (t) => {
    const estadoPendienteSegunda = diferida();
    const entorno = await cargarMapa({
      modern,
      t,
      estadoPendienteSegunda,
      fallarContactosLecturas: [2],
    });
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
    entorno.liberarHealthz.resolve();
    await entorno.contactosVistos.promise;
    await vaciarMicrotareas();

    const timer = entorno.timers.find((candidato) => candidato.activo && candidato.delay === 2000);
    assert.ok(timer);
    timer.activo = false;
    timer.callback(...timer.args);
    await vaciarMicrotareas();
    assert.equal(entorno.llamadasFetch.filter((url) => url.endsWith("/v1/state")).length, 2);
    assert.equal(entorno.llamadasFetch.filter((url) => url.endsWith("/v1/contacts")).length, 2);
    assert.equal(
      entorno.timers.some((candidato) => candidato.activo && candidato.delay === 4000),
      false,
      "no debe arrancar backoff mientras /v1/state sigue pendiente",
    );

    estadoPendienteSegunda.resolve();
    await vaciarMicrotareas();
    assert.equal(
      entorno.timers.some((candidato) => candidato.activo && candidato.delay === 4000),
      true,
      "el backoff se arma al asentarse las dos ramas",
    );
    if (modern) app._onClose();
    else await app.close();
  });

  test(`${version}: un segundo error distinto actualiza el mensaje visible`, async (t) => {
    const entorno = await cargarMapa({
      modern,
      t,
      fallarContactosLecturas: [2],
      fallarEstadoLecturas: [3],
    });
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
    entorno.liberarHealthz.resolve();
    await entorno.contactosVistos.promise;
    await vaciarMicrotareas();

    const segundo = entorno.timers.find((candidato) => candidato.activo && candidato.delay === 2000);
    segundo.activo = false;
    segundo.callback(...segundo.args);
    await vaciarMicrotareas();
    const primerError = app.detalleError;
    const rendersPrimerError = app.renderCalls.length;
    const tercero = entorno.timers.find((candidato) => candidato.activo && candidato.delay === 4000);
    assert.ok(tercero);
    tercero.activo = false;
    tercero.callback(...tercero.args);
    await vaciarMicrotareas();

    assert.notEqual(app.detalleError, primerError);
    assert.ok(app.renderCalls.length > rendersPrimerError, "el nuevo detalle de error debe renderizarse");
    if (modern) app._onClose();
    else await app.close();
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
