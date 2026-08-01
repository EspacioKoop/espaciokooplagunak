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
      entorno.timers.some(
        (candidato) => candidato.activo && (candidato.delay === 2000 || candidato.delay === 4000),
      ),
      false,
      "no debe rearmar el sondeo mientras /v1/state sigue pendiente",
    );

    estadoPendienteSegunda.resolve();
    await vaciarMicrotareas();
    // Se rearma al asentarse las dos ramas, y a la cadencia NORMAL: el que
    // falló fue `contacts`, y eso ya no frena el ciclo (#276, paso 0). Antes
    // aquí se esperaba 4000 —el backoff— porque un contacto caído castigaba
    // también a la lectura de posición y rumbo, que es la que más se mira.
    assert.equal(
      entorno.timers.some((candidato) => candidato.activo && candidato.delay === 2000),
      true,
      "el sondeo se rearma al asentarse las dos ramas",
    );
    assert.equal(
      entorno.timers.some((candidato) => candidato.activo && candidato.delay === 4000),
      false,
      "un /v1/contacts caído no debe arrancar el backoff del ciclo",
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

    // Sondeo 2: cae `contacts`. Es un aviso de superficie, no de conexión.
    const segundo = entorno.timers.find((candidato) => candidato.activo && candidato.delay === 2000);
    const rendersAntesDelAviso = app.renderCalls.length;
    segundo.activo = false;
    segundo.callback(...segundo.args);
    await vaciarMicrotareas();
    assert.equal(app.contactosCaidos, true, "el aviso de contactos debe encenderse");
    assert.equal(app.conexion, "ok", "el puente contesta: la conexión no está caída");
    assert.ok(
      app.renderCalls.length > rendersAntesDelAviso,
      "encender el aviso de contactos es un cambio visible y debe renderizarse",
    );

    // Sondeo 3: cae `state`. Ahora sí es la ventana entera.
    const rendersPrimerError = app.renderCalls.length;
    const tercero = entorno.timers.find((candidato) => candidato.activo && candidato.delay === 2000);
    assert.ok(tercero, "sin backoff tras un fallo de contactos, la cadencia sigue siendo la normal");
    tercero.activo = false;
    tercero.callback(...tercero.args);
    await vaciarMicrotareas();

    assert.equal(app.conexion, "error");
    assert.notEqual(app.detalleError, "");
    assert.equal(app.contactosCaidos, false, "con la conexión caída sobra el segundo mensaje");
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

// --- #276, paso 0: aislamiento de fallo por superficie -----------------------
//
// La ventana del mapa tiene DOS superficies —la nave propia y lo que la rodea—
// y hasta ahora compartían un único destino: si `contacts` fallaba, el
// `Promise.allSettled` relanzaba ese rechazo y se tiraba también un `state` que
// había llegado bien. Estas pruebas fijan que ya no.

for (const modern of [false, true]) {
  const version = modern ? "V2" : "V1";

  test(`${version}: un /v1/contacts caído no apaga la lectura de la nave propia`, async (t) => {
    const entorno = await cargarMapa({ modern, t, fallarContactosLecturas: [1] });
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
    await vaciarMicrotareas();

    // El puente contesta: la conexión NO está caída.
    assert.equal(app.conexion, "ok");
    assert.equal(app.detalleError, "");
    // Y lo que llegó bien se usa: posición, rumbo y destino de la nave propia,
    // más `naveVigente`, de la que cuelgan las vistas por puesto de #331.
    assert.ok(app.naveVigente, "la nave propia debe sobrevivir al fallo de contactos");
    assert.equal(app.naveVigente.heading, 30);
    assert.deepEqual(app.destino, { name: "Argia", position: { x: 5000, y: -2000 } });
    // Lo que no llegó se dice, y no se rellena con lo anterior.
    assert.equal(app.contactosCaidos, true);
    assert.deepEqual(app.contactos, []);
    if (modern) app._onClose();
    else await app.close();
  });

  test(`${version}: los contactos vuelven y el aviso se apaga solo`, async (t) => {
    const entorno = await cargarMapa({ modern, t, fallarContactosLecturas: [1] });
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
    await vaciarMicrotareas();
    assert.equal(app.contactosCaidos, true);

    // Segundo sondeo, a cadencia normal porque el fallo no era del ciclo.
    const siguiente = entorno.timers.find((c) => c.activo && c.delay === 2000);
    assert.ok(siguiente, "un fallo de contactos no debe meter backoff");
    siguiente.activo = false;
    siguiente.callback(...siguiente.args);
    await entorno.contactosVistos.promise;
    await vaciarMicrotareas();

    assert.equal(app.contactosCaidos, false, "el aviso no puede quedarse pegado");
    assert.equal(app.contactos.length, 1);
    if (modern) app._onClose();
    else await app.close();
  });
}
