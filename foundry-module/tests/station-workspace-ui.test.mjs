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
  const settingsWrites = [];
  const socketEmits = [];
  const userFlagWrites = [];

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
  current.setFlag = async (...args) => { userFlagWrites.push(args); };
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
      set(_module, key, value) {
        settingsWrites.push({ key, value });
      }
    },
    socket: {
      emit(...args) { socketEmits.push(args); },
    },
  };
  globalThis.fetch = fetchImpl ?? (() => { throw new Error("fetch inesperado"); });

  const tokenSession = await import("../scripts/bridge-token-session.mjs");
  tokenSession.clearBridgeToken();
  if (isGM) tokenSession.setBridgeToken("secret-for-test");
  const module = await import(`../scripts/station-workspace-ui.mjs?workspace-ui=${nonce++}`);
  module.registerWorkspaceFeature("espaciokoop-lagunak");
  return { module, hooks, instances, settingsReads, settingsWrites, socketEmits, userFlagWrites };
}

// LA GARANTÍA QUE NO CAMBIA con la apertura de telemetría (#331): el cliente de
// un jugador no lee el token ni habla con el puente. Lo que cambió es que ahora
// recibe la nave por difusión del GM; lo que NO cambió es que no puede pedirla.
test("v11: un jugador abre su consola sin leer token ni ejecutar fetch", async () => {
  const { module, instances, settingsReads, settingsWrites } = await setup();
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
  assert.deepEqual(settingsWrites, []);
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
        : url.endsWith("/v1/database")
          ? { entries: [], total: 0 }
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
    // Tres y no dos desde #520: estado, contactos y la base de datos científica.
    // Esta última se pide UNA vez por consola (`cargarBaseDatos` no repite si ya
    // la tiene), no en cada ciclo de sondeo — si esta cuenta creciera con los
    // refrescos, sería que ese "una vez" se ha roto.
    assert.equal(fetchCalls, 3);
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

for (const modern of [false, true]) {
  const version = modern ? "ApplicationV2" : "v11";
  test(`${version}: conexión y desconexión actualizan el aviso sin emitir órdenes automáticas`, async () => {
    const {
      module,
      hooks,
      instances,
      settingsReads,
      settingsWrites,
      socketEmits,
      userFlagWrites,
    } = await setup({ modern });
    module.openWorkspaceApp();
    const app = instances[0];
    const model = modern ? await app._prepareContext() : app.getData();

    assert.equal(model.uncrewedStations.some(({ id }) => id === "engineering"), false);
    const other = game.users.get("p2");
    other.active = false;
    hooks.userConnected(other, false);
    const disconnected = modern ? await app._prepareContext() : app.getData();
    assert.equal(disconnected.uncrewedStations.some(({ id }) => id === "engineering"), true);

    other.active = true;
    hooks.userConnected(other, true);
    const reconnected = modern ? await app._prepareContext() : app.getData();
    assert.equal(reconnected.uncrewedStations.some(({ id }) => id === "engineering"), false);
    assert.deepEqual(
      app.renderCalls,
      modern ? [{ force: true }, { force: true }, { force: true }] : [true, false, false],
    );
    assert.deepEqual(settingsReads, []);
    assert.deepEqual(settingsWrites, []);
    assert.deepEqual(socketEmits, []);
    assert.deepEqual(userFlagWrites, []);
  });
}

// La lámina del objetivo de atraque tiene DOS rutas de ciclo de vida (#391), y
// las pruebas de la lámina la montan directamente: no ejercitan ninguna de las
// dos. Aquí se entra por el lifecycle real de cada ruta, que es donde se colaba
// que la clásica de v11 no montara nada y que ningún cierre parara el bucle.
function raizConLaminaDeAtraque() {
  const ordenes = [];
  const ctx = new Proxy(
    { fill: () => ordenes.push("fill") },
    { get: (obj, prop) => obj[prop] ?? (() => ordenes.push(String(prop))), set: () => true }
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

// NUEVAS PRUEBAS PARA EL TAREA t_97ca3cca

// 1. Guardas post-`await`: respuesta que llega con la ventana ya cerrada
test("refreshTelemetry: respuesta tardía con ventana cerrada no publica", async () => {
  let resolveState;
  let resolveContacts;
  const fetchImpl = (url) => new Promise((resolve) => {
    if (url.endsWith("/v1/state")) resolveState = resolve;
    else if (url.endsWith("/v1/contacts")) resolveContacts = resolve;
    else if (url.endsWith("/v1/database")) resolve({ ok: true, async json() { return { entries: [], total: 0 }; } });
  });
  const { module, instances, settingsWrites } = await setup({ isGM: true, modern: true, fetchImpl });
  module.openWorkspaceApp();
  const app = instances[0];
  const pending = app.refreshTelemetry();
  // Simular que la ventana se cierra mientras esperamos la respuesta
  app.closed = true;
  resolveState({ ok: true, async json() { return { ship: { callsign: "Lagunak", systems: {} } }; } });
  resolveContacts({ ok: true, async json() { return { contacts: [], total: 0 }; } });
  assert.equal(await pending, false);
  // No debe haber escrito en ajustes (no publicó)
  assert.deepEqual(settingsWrites, []);
});

// 2. Guardas post-`await`: respuesta que llega cuando quien sondeaba ha dejado de ser GM
test("refreshTelemetry: respuesta tardía con usuario que dejó de ser GM no publica", async () => {
  let resolveState;
  let resolveContacts;
  const fetchImpl = (url) => new Promise((resolve) => {
    if (url.endsWith("/v1/state")) resolveState = resolve;
    else if (url.endsWith("/v1/contacts")) resolveContacts = resolve;
    else if (url.endsWith("/v1/database")) resolve({ ok: true, async json() { return { entries: [], total: 0 }; } });
  });
  const { module, instances, settingsWrites } = await setup({ isGM: true, modern: true, fetchImpl });
  module.openWorkspaceApp();
  const app = instances[0];
  const pending = app.refreshTelemetry();
  // Simular que el usuario deja de ser GM mientras esperamos la respuesta
  game.user.isGM = false;
  resolveState({ ok: true, async json() { return { ship: { callsign: "Lagunak", systems: {} } }; } });
  resolveContacts({ ok: true, async json() { return { contacts: [], total: 0 }; } });
  assert.equal(await pending, false);
  // No debe haber escrito en ajustes (no publicó)
  assert.deepEqual(settingsWrites, []);
});

// 3. La base de datos no se espera: una base de datos lenta no retrasa ni impide la publicación de telemetría
test("refreshTelemetry: base de datos lenta no bloquea publicación de telemetría", async () => {
  let resolveState;
  let resolveContacts;
  let resolveDatabase;
  const fetchImpl = (url) => new Promise((resolve) => {
    if (url.endsWith("/v1/state")) resolveState = resolve;
    else if (url.endsWith("/v1/contacts")) resolveContacts = resolve;
    else if (url.endsWith("/v1/database")) resolveDatabase = resolve;
  });
  const { module, instances, settingsWrites } = await setup({ isGM: true, modern: true, fetchImpl });
  module.openWorkspaceApp();
  const app = instances[0];
  // Iniciar el refresco
  const pending = app.refreshTelemetry();
  // No resolver la base de datos aún (simular lentitud)
  resolveState({ ok: true, async json() { return { ship: { callsign: "Lagunak", systems: {} } }; } });
  resolveContacts({ ok: true, async json() { return { contacts: [], total: 0 }; } });
  // La telemetría debería publicarse sin esperar a la base de datos
  assert.equal(await pending, true);
  // Debe haber escrito en ajustes (publicó telemetría)
  assert.equal(settingsWrites.length, 1);
  assert.equal(settingsWrites[0].key, "telemetriaNave");
  // Ahora resolver la base de datos (debería cargarla pero no afectar a la telemetría ya publicada)
  resolveDatabase({ ok: true, async json() { return { entries: [{ id: "Naves", name: "Naves" }], total: 1 }; } });
  // Esperar un poco para que se procese la base de datos (opcional)
  await new Promise(resolve => setTimeout(resolve, 0));
  // Verificar que la base de datos se pidió (el test existente #520 ya verifica que se pide una vez por consola)
  // Aquí solo verificamos que no bloqueó la telemetría
});

// 4. `cargarBaseDatos` no repite si ya la tiene (ya cubierto por el test existente #520)

// 5. El crudo entra en `difundirTelemetria` y NO sale: los contactos publicados están degradados por el alcance del radar
test("refreshTelemetry: los contactos publicados están degradados por el alcance del radar", async () => {
  const fetchImpl = async (url, options) => {
    if (url.endsWith("/v1/state")) {
      return {
        ok: true,
        async json() {
          return {
            ship: {
              callsign: "Lagunak",
              hull: 100,
              hull_max: 100,
              energy: 100,
              energy_max: 100,
              systems: {},
              position: { x: 0, y: 0, z: 0 },
              // El radar es un OBJETO con los dos alcances, no un número:
              // `alcancesDe` devuelve null ante medio radar y entonces no se
              // difunde nada (`sensores: null`), que es lo correcto — sin
              // alcances no se puede afirmar qué se ve y qué no.
              radar: { short_range: 100, long_range: 100 },
            }
          };
        }
      };
    } else if (url.endsWith("/v1/contacts")) {
      return {
        ok: true,
        async json() {
          return {
            contacts: [
              // La posición va ANIDADA: `degradarContactos` lee
              // `contacto.position.x`. Un contacto con la x suelta no tiene
              // posición legible y se descarta entero, sin aviso.
              { id: "cerca", position: { x: 50, y: 0, z: 0 } },   // dentro del alcance corto
              { id: "medio", position: { x: 100, y: 0, z: 0 } },  // justo en el borde
              { id: "lejos", position: { x: 150, y: 0, z: 0 } }   // más allá del largo: ni se publica ni se cuenta
            ],
            total: 3,
            truncated: false
          };
        }
      };
    } else if (url.endsWith("/v1/database")) {
      return {
        ok: true,
        async json() {
          return { entries: [], total: 0 };
        }
      };
    }
    throw new Error(`fetch inesperado: ${url}`);
  };
  const { module, instances, settingsWrites } = await setup({ isGM: true, modern: true, fetchImpl });
  module.openWorkspaceApp();
  const app = instances[0];
  await app.refreshTelemetry();
  // Se busca la escritura de telemetría por su clave, no por su posición: cuando
  // la base de datos responde, `cargarBaseDatos` escribe ADEMÁS su propio ajuste
  // (`baseDatosCientifica`), y son dos claves distintas a propósito — el sobre de
  // telemetría se reescribe en cada sondeo y la base de datos no.
  const escrituraTelemetria = settingsWrites.filter((w) => w.key === "telemetriaNave");
  assert.equal(escrituraTelemetria.length, 1, "la telemetría se publica una sola vez");
  const sobre = escrituraTelemetria[0].value;
  assert.ok(sobre);
  assert.equal(sobre.ship.callsign, "Lagunak");
  // Los sensores deberían tener solo los contactos dentro del radio del radar (<= 100 km)
  // Nota: La función degradarContactos filtra por rango <= radar
  // Los contactos en exactamente 100 km deberían estar incluidos (<=)
  // Se comprueba por DISTANCIA y no por id: una entrada degradada no lleva id
  // (#462). La identidad —indicativo y facción— solo aparece con escaneo, y
  // estos contactos no lo traen, así que salen como ecos anónimos. Afirmar
  // sobre `c.id` probaría que existe un campo que el diseño niega.
  const distancias = sobre.sensores.contactos.map((c) => c.distancia).sort((a, b) => a - b);
  assert.deepEqual(distancias, [50, 100], "entran el de 50 km y el del borde a 100");
  // El de 150 km no se publica NI se cuenta: un total que incluyera lo invisible
  // diría «hay tres cosas ahí fuera», que es el dato que ciencia debe ganarse.
  assert.equal(sobre.sensores.contactos.length, 2);
  // Y ninguno revela identidad sin escaneo.
  assert.deepEqual(sobre.sensores.contactos.map((c) => c.callsign), [null, null]);
});

// 6. Publicar es escribir un ajuste de mundo y solo lo hace un GM
test("refreshTelemetry: no GM no publica telemetría", async () => {
  const { module, instances, settingsWrites } = await setup({ isGM: false });
  module.openWorkspaceApp();
  const app = instances[0];
  // Incluso si forzamos un estado y contactos (que no debería obtener porque no es GM)
  app.statePayload = { ship: { callsign: "Prueba" } };
  app.contactsPayload = { contactos: [] };
  const result = await app.refreshTelemetry();
  assert.equal(result, false);
  // No debe haber escrito en ajustes
  assert.deepEqual(settingsWrites, []);
});

// 7. Sin sondeo no se inventa lectura: reentrada con app.loading no lanza una segunda petición
test("refreshTelemetry: mientras carga, llamada adicional no lanza segunda petición", async () => {
  let fetchCalls = 0;
  const fetchImpl = async (url) => {
    fetchCalls += 1;
    if (url.endsWith("/v1/state")) {
      return { ok: true, async json() { return { ship: { callsign: "Lagunak", systems: {} } }; } };
    } else if (url.endsWith("/v1/contacts")) {
      return { ok: true, async json() { return { contacts: [], total: 0 }; } };
    } else if (url.endsWith("/v1/database")) {
      return { ok: true, async json() { return { entries: [], total: 0 }; } };
    }
    throw new Error("fetch inesperado");
  };
  const { module, instances } = await setup({ isGM: true, fetchImpl });
  module.openWorkspaceApp();
  const app = instances[0];
  // Primera llamada
  await app.refreshTelemetry();
  const firstCalls = fetchCalls;
  // Establecer loading a true para simular que ya hay una petición en curso
  app.loading = true;
  // Segunda llamada mientras loading es true
  const secondResult = await app.refreshTelemetry();
  // El número de llamadas no debería haber aumentado
  assert.equal(fetchCalls, firstCalls);
  // Además, la segunda llamada debería devolver false (no hizo nada)
  assert.equal(secondResult, false);
});

// Test existente: la base de datos científica se pide una vez, no en cada sondeo (#520)
test("la base de datos científica se pide una vez, no en cada sondeo (\#520)", async () => {
  let dbCalls = 0;
  const fetchImpl = async (url) => {
    if (url.endsWith("/v1/database")) dbCalls += 1;
    const payload = url.endsWith("/v1/state")
      ? { ship: { callsign: "Lagunak", systems: {} } }
      : url.endsWith("/v1/database")
        ? { entries: [{ id: "Naves", name: "Naves" }], total: 1 }
        : { contacts: [] };
    return { ok: true, async json() { return payload; } };
  };
  const { module, instances } = await setup({ isGM: true, fetchImpl });
  module.openWorkspaceApp();
  const app = instances[0];
  await app.refreshTelemetry();
  await app.refreshTelemetry();
  await app.refreshTelemetry();
  assert.equal(dbCalls, 1);
});
