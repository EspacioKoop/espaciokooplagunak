import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

    // No-op: el `render()` público de este stub no reconstruye el árbol real
    // de Foundry, así que nunca invoca `_render`. Las subclases V1 (Application
    // clásica) sobrescriben `_render` para arrancar el sondeo tras el primer
    // render real; los tests que necesitan ejercitar ese arranque llaman a
    // `_render` directamente en vez de pasar por `render()`.
    async _render(_force, _options) {
      this.rendered = true;
    }

    async close() {
      this.rendered = false;
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
    // El arnés no desregistra nada, pero varios cableados llaman a `off` al
    // reregistrarse: sin esto, `ready` revienta a mitad y deja el módulo a
    // medio arrancar.
    off() {},
  };
  const ajustes = new Map();
  globalThis.game = {
    user: { id: "local-user", isGM },
    settings: {
      // Se apuntan las opciones de registro para poder disparar sus `onChange`
      // desde las pruebas: hay cableado que solo existe ahí, y sin esto no se
      // puede ejercitar sin levantar Foundry.
      register(_module, key, opciones = {}) {
        ajustes.set(key, { ...opciones, valor: opciones.default });
      },
      async set(_module, key, valor) {
        const ajuste = ajustes.get(key) ?? {};
        ajustes.set(key, { ...ajuste, valor });
        await ajuste.onChange?.(valor);
      },
      get(_module, key) {
        if (ajustes.has(key) && ajustes.get(key).valor !== undefined) {
          return ajustes.get(key).valor;
        }
        if (key === "bridgeUrl") return "http://bridge.test";
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
      // Ids de sesión: basta con que no se repitan dentro de una prueba.
      randomID: (() => {
        let n = 0;
        return () => `id-${++n}`;
      })(),
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

  const tokenSession = await import("../scripts/bridge-token-session.mjs");
  tokenSession.clearBridgeToken();
  if (isGM) tokenSession.setBridgeToken("test-token");
  await import(`../scripts/main.mjs?compat-test=${importNonce++}`);
  return { hooks, instances, notifications, fetchCalls, journalPages, tokenSession, ajustes };
}

function pauseValues(fetchCalls) {
  return fetchCalls.map(([, options]) => JSON.parse(options.body).paused);
}

// `ready` toca cosas que este arnés no simula (DOM de la alerta de escena,
// audio). Lo que interesa de él es que registre los hooks del módulo, así que se
// ejecuta con los mínimos globales para que llegue hasta el final.
async function arrancarReady(hooks) {
  const listaClases = Object.assign([], {
    add() {},
    remove() {},
    toggle() {},
    contains: () => false,
  });
  globalThis.document = globalThis.document ?? {
    body: { classList: listaClases },
    documentElement: { style: { setProperty() {} } },
    querySelector: () => null,
    createElement: () => ({ style: {}, classList: { add() {} }, appendChild() {} }),
  };
  await hooks.ready();
}

function toolByName(controls, name) {
  return controls.flatMap((control) => control.tools ?? []).find((tool) => tool.name === name);
}

// Panel de GM (#448): estado/mapa/token/diagnóstico/música/decorado/ficha ya
// no son botones sueltos, sino entradas del panel. Abre el panel y elige la
// entrada `id`, devolviendo la ventana real que abre (última instancia
// creada) — igual patrón que `abrirMesaPorCantina` hace para la cantina.
function panelGmTool(controls) {
  return Array.isArray(controls) ? toolByName(controls, "lagunak-panel-gm") : controls.lagunak?.tools?.["lagunak-panel-gm"];
}

async function abrirDesdePanelGM(controls, instances, id) {
  panelGmTool(controls).onClick();
  const panel = instances.at(-1);
  const antes = instances.length;
  panel.seleccionarEntrada(id);
  // Algunas acciones (token) hacen trabajo async antes de construir su
  // ventana; el propio panel no espera a `alSeleccionar` (igual que
  // `main.mjs`), así que aquí se deja drenar la cola de microtareas.
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  // Reabrir una entrada con ventana perezosa (mapa, estado) no crea instancia
  // nueva: solo se sumó el panel. Devolver `instances.at(-1)` ahí devolvería
  // el panel, no la ventana reutilizada — el llamador debe comparar con la
  // referencia que ya tenía.
  return instances.length > antes ? instances.at(-1) : null;
}

test("v11 abre la configuración efímera del token sin tocar red", async () => {
  const { hooks, instances, fetchCalls } = await loadModule();
  const controls = [{ name: "token", tools: [] }];
  hooks.getSceneControlButtons(controls);

  const app = await abrirDesdePanelGM(controls, instances, "token");
  assert.equal(instances.length, 2);
  assert.deepEqual(app.renderCalls, [true]);
  assert.deepEqual(fetchCalls, []);
  await app.close();
});

test("updateUser revoca el token y cierra la ventana si el usuario local deja de ser GM", async () => {
  const { hooks, tokenSession, instances } = await loadModule();
  const controls = [{ name: "token", tools: [] }];
  hooks.getSceneControlButtons(controls);
  const app = await abrirDesdePanelGM(controls, instances, "token");
  assert.equal(app.rendered, true);
  assert.equal(tokenSession.getBridgeToken(), "test-token");

  game.user.isGM = false;
  hooks.updateUser({ id: "local-user", isGM: false }, { role: 1 });
  await Promise.resolve();

  assert.equal(tokenSession.getBridgeToken(), "");
  assert.equal(app.rendered, false);
  game.user.isGM = true;
  assert.equal(tokenSession.getBridgeToken(), "");
});

test("un updateUser sin cambio de rol no revoca la consola del jugador", async () => {
  // El bug vivía SOLO en el no-GM: a él se le revocaba y cerraba la consola al
  // cambiar de puesto. Con un GM local el hook ni siquiera llega a revocar, así
  // que el fixture debe ser un jugador para que esta regresión valga de algo.
  const { hooks, instances } = await loadModule({ isGM: false });
  const controls = [{ name: "token", tools: [] }];
  hooks.getSceneControlButtons(controls);
  const grupo = controls.find((control) => control.name === "lagunak");
  grupo.tools.find((tool) => tool.name === "lagunak-espacio-puesto").onClick();

  const consola = instances[0];
  assert.equal(consola.rendered, true);

  // Cambiar de puesto escribe un flag: updateUser SIN "role" en el diff. El
  // código anterior revocaba aquí y dejaba al jugador con la ventana vacía
  // hasta recargar.
  hooks.updateUser({ id: "local-user", isGM: false }, { flags: { puesto: "navigation" } });
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(consola.closed, false, "la consola del jugador no debe cerrarse");
  assert.equal(consola.rendered, true);
});

test("perder el rol GM sí revoca, con el mismo hook", async () => {
  const { hooks, tokenSession, instances } = await loadModule();
  const controls = [{ name: "token", tools: [] }];
  hooks.getSceneControlButtons(controls);
  const app = await abrirDesdePanelGM(controls, instances, "token");

  game.user.isGM = false;
  hooks.updateUser({ id: "local-user", isGM: false }, { role: 1 });
  await Promise.resolve();

  assert.equal(tokenSession.getBridgeToken(), "");
  assert.equal(app.rendered, false);
  game.user.isGM = true;
});

test("degradar durante healthz cierra la vista y no inicia peticiones autenticadas", async () => {
  let finishHealth;
  const fetchImpl = (url) => {
    if (url.endsWith("/healthz")) {
      return new Promise((resolve) => { finishHealth = resolve; });
    }
    return Promise.resolve({ ok: true, status: 200, async json() { return { ok: true }; } });
  };
  const { hooks, tokenSession, instances, fetchCalls } = await loadModule({ modern: true, fetchImpl });
  const controls = {};
  hooks.getSceneControlButtons(controls);
  const app = await abrirDesdePanelGM(controls, instances, "consola");
  let wipes = 0;
  app.element = { replaceChildren() { wipes += 1; } };
  app._onFirstRender();
  await Promise.resolve();
  assert.equal(fetchCalls.length, 1);
  assert.match(fetchCalls[0][0], /\/healthz$/);

  game.user.isGM = false;
  hooks.updateUser({ id: "local-user", isGM: false }, { role: 1 });
  await Promise.resolve();
  finishHealth({ ok: true, status: 200, async json() { return { ok: true }; } });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(tokenSession.getBridgeToken(), "");
  assert.equal(app.bridgeAccessRevoked, true);
  assert.equal(app.rendered, false);
  assert.equal(wipes, 1);
  assert.equal(fetchCalls.length, 1);
});

test("degradar cierra y vacía la consola caliente y el workspace abiertos", async () => {
  // #276 fusionó estado+mapa en una sola ventana (la consola caliente), así
  // que aquí solo hay DOS ventanas privilegiadas que revocar, no tres.
  const { hooks, instances } = await loadModule({ modern: true });
  const controls = { tokens: { tools: {} } };
  hooks.getSceneControlButtons(controls);
  const consolaApp = await abrirDesdePanelGM(controls, instances, "consola");
  controls.lagunak.tools["lagunak-espacio-puesto"].onClick();
  const workspaceApp = instances.at(-1);
  const apps = [consolaApp, workspaceApp];
  const wipes = [0, 0];
  apps.forEach((app, index) => {
    app.element = { replaceChildren() { wipes[index] += 1; } };
  });
  consolaApp.ultimoEstado = { ship: { callsign: "Agregado" } };
  consolaApp.contactos = [{ callsign: "Contacto" }];
  workspaceApp.statePayload = { ship: { callsign: "Workspace" } };

  game.user.isGM = false;
  hooks.updateUser({ id: "local-user", isGM: false }, { role: 1 });
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(apps.map((app) => app.rendered), [false, false]);
  assert.deepEqual(wipes, [1, 1]);
  assert.equal(consolaApp.ultimoEstado, null);
  assert.deepEqual(consolaApp.contactos, []);
  assert.equal(workspaceApp.statePayload, null);
  assert.equal(workspaceApp.closed, true);
});

test("v11 conecta los listeners de pausa y reanudación con el puente", async () => {
  const { hooks, instances, notifications, fetchCalls } = await loadModule();
  const controls = [{ name: "token", tools: [] }];

  hooks.getSceneControlButtons(controls);
  // Issue #125: TODAS las herramientas del módulo viven en el grupo propio;
  // nada se cuelga de Token Controls. El GM ve consola/token/diagnóstico más
  // los botones de puesto. #276 fusionó estado+mapa en la consola caliente:
  // ya no hay botones sueltos de estado o mapa.
  assert.deepEqual(controls[0].tools.map(({ name }) => name), []);
  const grupo = controls.find((control) => control.name === "lagunak");
  assert.ok(grupo);
  assert.equal(grupo.icon, "fa-solid fa-shuttle-space");
  assert.deepEqual(grupo.tools.map(({ name }) => name), [
    // Panel de GM (#448): sustituye los botones sueltos anteriores (consola
    // caliente, token, diagnóstico, música, decorado, ficha) por una única
    // puerta con catálogo interno — ver `panel-gm.test.mjs` para ese catálogo.
    "lagunak-panel-gm",
    // La playa (#587) es lo segundo que ve el GM y nadie más: no es contenido
    // sino un banco de pruebas del motor de exteriores, y ofrecérselo a la
    // tripulación en la misma barra que su puesto diría que forma parte del juego.
    "lagunak-playa",
    "lagunak-museo",
    // La cantina (#423) la ven todos: es la capa social, y un minijuego al que
    // solo pudiera entrar el GM no sería un minijuego. Es la única puerta: los
    // dos verticales (#308 póker, #413 dados) entran por ella, no por un botón
    // suelto cada uno.
    "lagunak-cantina",
    // Y la sección (#427) por la misma regla: saber qué forma tiene la nave en
    // la que vives no es información privilegiada. Lo que sí lo es —la lectura
    // de daño— viaja aparte, y a quien no la tiene el plano le sale sin lectura.
    "lagunak-seccion",
    // Prototipo de #427, misma visibilidad: no toca autoridad ni datos.
    "lagunak-andar-nave",
    "lagunak-musica-audio",
    "lagunak-puestos",
    "lagunak-avatar",
    "lagunak-espacio-puesto",
    // Diagnóstico del contenido dnd5e importado (#332): solo-GM, y no por
    // secretismo. Lo que enseña es el estado del MUNDO del anfitrión —qué
    // compendios importó, qué se filtró—, no información de partida: a un
    // jugador no le dice nada y le invitaría a pedir cambios en la instalación
    // de otro.
    "lagunak-contenido-externo",
    // Echar una mano (#309) la ve TODA la tripulación, GM incluido: ayudar es
    // cruzar de puesto por definición, y un botón solo-GM no sería cooperación.
    "lagunak-asistencia",
    // Parlamento de comunicaciones (#810): primer consumidor real de
    // npc-generador (#676). Reconstruye el interlocutor por semilla del contacto
    // y enseña los enfoques con su CD y rango de éxito visibles. Sin estado.
    "lagunak-parlamento",
    // Convocar a estancia (#832) solo la ve el GM: `convocar` exige rol GM.
    "lagunak-convocar",
  ]);
  const app = await abrirDesdePanelGM(controls, instances, "consola");

  assert.equal(instances.length, 2);
  assert.deepEqual(app.renderCalls, [true]);

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
  app.activateListeners(html);

  assert.equal(bindings.get('[data-action="pausar"]').event, "click");
  assert.equal(bindings.get('[data-action="reanudar"]').event, "click");

  // El ACK del comando NO confirma: sin lectura de /v1/scenario no hay
  // estado confirmado ni notificación (autoridad del simulador).
  await bindings.get('[data-action="pausar"]').callback();
  assert.equal(app.pausaConfirmada, null);
  assert.deepEqual(notifications.info, []);

  // La confirmación llega únicamente de una lectura real de /v1/scenario.
  app._registrarLecturaPausa({ paused: true });
  assert.equal(app.pausaConfirmada, true);
  assert.deepEqual(notifications.info, ["LAGUNAK.Tempo.Pausado"]);

  await bindings.get('[data-action="reanudar"]').callback();
  assert.equal(app.pausaConfirmada, true);
  app._registrarLecturaPausa({ paused: false });
  assert.equal(app.pausaConfirmada, false);

  assert.deepEqual(pauseValues(fetchCalls), [true, false]);
  assert.deepEqual(notifications.info, ["LAGUNAK.Tempo.Pausado", "LAGUNAK.Tempo.Reanudado"]);
  assert.deepEqual(notifications.error, []);
});

test("la bitácora normaliza la telemetría y no inserta HTML del puente", async () => {
  const { hooks, instances, journalPages } = await loadModule();
  const controls = [{ name: "token", tools: [] }];
  hooks.getSceneControlButtons(controls);
  const app = await abrirDesdePanelGM(controls, instances, "consola");

  app.ultimoEstado = {
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
  app.activateListeners({
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
  const controls = {};

  hooks.getSceneControlButtons(controls);
  // Grupo propio con icono de nave (issue #125), record de tools en v13.
  assert.ok(controls.lagunak);
  assert.equal(controls.lagunak.icon, "fa-solid fa-shuttle-space");
  assert.ok(controls.lagunak.tools["lagunak-panel-gm"]);
  const app = await abrirDesdePanelGM(controls, instances, "consola");

  assert.equal(instances.length, 2);
  assert.deepEqual(app.renderCalls, [{ force: true }]);
  const actions = app.constructor.DEFAULT_OPTIONS.actions;
  assert.equal(typeof actions.pausar, "function");
  assert.equal(typeof actions.reanudar, "function");

  // ACK sin confirmación: sin lectura de /v1/scenario no hay estado.
  await actions.pausar.call(app);
  assert.equal(app.pausaConfirmada, null);
  assert.deepEqual(notifications.info, []);

  app._registrarLecturaPausa({ paused: true });
  assert.equal(app.pausaConfirmada, true);

  await actions.reanudar.call(app);
  app._registrarLecturaPausa({ paused: false });
  assert.equal(app.pausaConfirmada, false);

  assert.deepEqual(pauseValues(fetchCalls), [true, false]);
  assert.deepEqual(notifications.info, ["LAGUNAK.Tempo.Pausado", "LAGUNAK.Tempo.Reanudado"]);
  assert.deepEqual(notifications.error, []);
});

test("v11 conecta el listener de encuentro y envía la selección exacta una sola vez", async () => {
  const { hooks, instances, fetchCalls } = await loadModule();
  const controls = [{ name: "token", tools: [] }];
  hooks.getSceneControlButtons(controls);
  const app = await abrirDesdePanelGM(controls, instances, "consola");
  app.catalogoEncuentros = { archetypes: ["derelict"], bearings: ["starboard"] };
  app.element = [{
    querySelector(selector) {
      if (selector === "[data-lagunak-encuentro-arquetipo]") return { value: "derelict" };
      if (selector === "[data-lagunak-encuentro-rumbo]") return { value: "starboard" };
      return null;
    },
  }];
  const bindings = new Map();
  app.activateListeners({
    find(selector) {
      return { on(event, callback) { bindings.set(selector, { event, callback }); } };
    },
  });

  const binding = bindings.get('[data-action="encuentro"]');
  assert.equal(binding.event, "click");
  await binding.callback();

  assert.equal(fetchCalls.length, 1);
  assert.match(fetchCalls[0][0], /\/v1\/command$/);
  assert.equal(fetchCalls[0][1].method, "POST");
  assert.equal(fetchCalls[0][1].headers.Authorization, "Bearer test-token");
  assert.deepEqual(JSON.parse(fetchCalls[0][1].body), {
    op: "spawn_encounter",
    archetype: "derelict",
    bearing: "starboard",
  });
});

test("ApplicationV2 conecta la acción de encuentro y envía la selección exacta una sola vez", async () => {
  const { hooks, instances, fetchCalls } = await loadModule({ modern: true });
  const controls = {};
  hooks.getSceneControlButtons(controls);
  const app = await abrirDesdePanelGM(controls, instances, "consola");
  app.catalogoEncuentros = { archetypes: ["derelict"], bearings: ["ahead"] };
  app.element = {
    querySelector(selector) {
      if (selector === "[data-lagunak-encuentro-arquetipo]") return { value: "derelict" };
      if (selector === "[data-lagunak-encuentro-rumbo]") return { value: "ahead" };
      return null;
    },
  };
  const actions = app.constructor.DEFAULT_OPTIONS.actions;
  assert.equal(typeof actions.encuentro, "function");
  await actions.encuentro.call(app);

  assert.equal(fetchCalls.length, 1);
  assert.match(fetchCalls[0][0], /\/v1\/command$/);
  assert.equal(fetchCalls[0][1].method, "POST");
  assert.equal(fetchCalls[0][1].headers.Authorization, "Bearer test-token");
  assert.deepEqual(JSON.parse(fetchCalls[0][1].body), {
    op: "spawn_encounter",
    archetype: "derelict",
    bearing: "ahead",
  });
});

// Fail-closed ante ACK/errores tardíos de spawn_encounter: si el rol GM se
// revoca mientras la orden viaja, la respuesta privilegiada tardía no debe
// notificar ni repoblar la ventana (misma garantía que el sondeo y el token).
function comandoRetenido() {
  let finish;
  const fetchImpl = (url) => {
    if (String(url).endsWith("/v1/command")) {
      return new Promise((resolve) => { finish = resolve; });
    }
    return Promise.resolve({ ok: true, status: 200, async json() { return { ok: true }; } });
  };
  return { fetchImpl, resolver: (body) => finish({ ok: true, status: 200, async json() { return body; } }) };
}

const raizEncuentroSel = { archetypes: ["derelict"], bearings: ["ahead"] };
function raizEncuentro() {
  return {
    querySelector(selector) {
      if (selector.includes("arquetipo")) return { value: "derelict" };
      if (selector.includes("rumbo")) return { value: "ahead" };
      return null;
    },
  };
}

test("v11: un ACK tardío de encuentro tras revocar el rol GM no notifica ni repuebla", async () => {
  const { fetchImpl, resolver } = comandoRetenido();
  const { hooks, instances, notifications } = await loadModule({ fetchImpl });
  const controls = [{ name: "token", tools: [] }];
  hooks.getSceneControlButtons(controls);
  const app = await abrirDesdePanelGM(controls, instances, "consola");
  app.catalogoEncuentros = raizEncuentroSel;
  app.element = [raizEncuentro()];
  const bindings = new Map();
  app.activateListeners({ find(selector) { return { on(event, callback) { bindings.set(selector, { event, callback }); } }; } });

  const enVuelo = bindings.get('[data-action="encuentro"]').callback();
  const rendersPrevios = app.renderCalls.length;

  // El rol se pierde con la orden en vuelo.
  game.user.isGM = false;
  hooks.updateUser({ id: "local-user", isGM: false }, { role: 1 });
  await Promise.resolve();

  // El ACK privilegiado llega tarde.
  resolver({ op: "spawn_encounter", result: { ok: true } });
  await enVuelo;

  assert.equal(app.bridgeAccessRevoked, true);
  assert.deepEqual(notifications.info, []);
  assert.deepEqual(notifications.warn, []);
  // No repuebla la ventana ya revocada tras el ACK tardío.
  assert.equal(app.renderCalls.length, rendersPrevios);
});

test("ApplicationV2: un ACK tardío de encuentro tras revocar el rol GM no notifica ni repuebla", async () => {
  const { fetchImpl, resolver } = comandoRetenido();
  const { hooks, instances, notifications } = await loadModule({ modern: true, fetchImpl });
  const controls = {};
  hooks.getSceneControlButtons(controls);
  const app = await abrirDesdePanelGM(controls, instances, "consola");
  app.catalogoEncuentros = raizEncuentroSel;
  app.element = raizEncuentro();
  const enVuelo = app.constructor.DEFAULT_OPTIONS.actions.encuentro.call(app);
  const rendersPrevios = app.renderCalls.length;

  game.user.isGM = false;
  hooks.updateUser({ id: "local-user", isGM: false }, { role: 1 });
  await Promise.resolve();

  resolver({ op: "spawn_encounter", result: { ok: true } });
  await enVuelo;

  assert.equal(app.bridgeAccessRevoked, true);
  assert.deepEqual(notifications.info, []);
  assert.deepEqual(notifications.warn, []);
  assert.equal(app.renderCalls.length, rendersPrevios);
});

test("v11: lectura discordante tras el ACK avisa y pasa a estado de error", async () => {
  const { hooks, instances, notifications } = await loadModule();
  const controls = [];
  hooks.getSceneControlButtons(controls);
  const app = await abrirDesdePanelGM(controls, instances, "consola");

  const bindings = new Map();
  app.activateListeners({
    find(selector) {
      return { on(_event, callback) { bindings.set(selector, callback); } };
    },
  });
  await bindings.get('[data-action="pausar"]')();

  // Mientras espera confirmación, una segunda orden queda bloqueada.
  await bindings.get('[data-action="reanudar"]')();
  assert.equal(app.confirmacionPendiente, true);

  // El simulador responde lo contrario de lo ordenado.
  app._registrarLecturaPausa({ paused: false });
  assert.equal(app.pausaConfirmada, false);
  assert.equal(app.falloOrden, true);
  assert.deepEqual(notifications.info, []);
  assert.deepEqual(notifications.warn, ["LAGUNAK.Tempo.Discordante"]);
});

test("ApplicationV2: lectura discordante tras el ACK avisa y pasa a estado de error", async () => {
  const { hooks, instances, notifications } = await loadModule({ modern: true });
  const controls = {};
  hooks.getSceneControlButtons(controls);
  const app = await abrirDesdePanelGM(controls, instances, "consola");

  const actions = app.constructor.DEFAULT_OPTIONS.actions;
  await actions.pausar.call(app);
  await actions.reanudar.call(app); // bloqueada: confirmación pendiente
  assert.equal(app.confirmacionPendiente, true);

  app._registrarLecturaPausa({ paused: false });
  assert.equal(app.pausaConfirmada, false);
  assert.equal(app.falloOrden, true);
  assert.deepEqual(notifications.info, []);
  assert.deepEqual(notifications.warn, ["LAGUNAK.Tempo.Discordante"]);
});

test("v11 muestra el error del puente sin emitir una confirmación falsa", async () => {
  const { hooks, instances, notifications, fetchCalls } = await loadModule({
    fetchImpl: async () => ({ ok: false, status: 503, async json() { return {}; } }),
  });
  const controls = [{ name: "token", tools: [] }];
  hooks.getSceneControlButtons(controls);
  const app = await abrirDesdePanelGM(controls, instances, "consola");

  const bindings = new Map();
  app.activateListeners({
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
  const controls = {};
  hooks.getSceneControlButtons(controls);
  const app = await abrirDesdePanelGM(controls, instances, "consola");

  const actions = app.constructor.DEFAULT_OPTIONS.actions;
  await actions.reanudar.call(app);

  assert.deepEqual(pauseValues(fetchCalls), [false]);
  assert.deepEqual(notifications.info, []);
  assert.deepEqual(notifications.error, ["El puente respondió 503 en /v1/command"]);
});

test("v11 bloquea la orden si el usuario deja de ser GM", async () => {
  const { hooks, instances, notifications, fetchCalls } = await loadModule();
  const controls = [{ name: "token", tools: [] }];
  hooks.getSceneControlButtons(controls);
  const app = await abrirDesdePanelGM(controls, instances, "consola");

  const bindings = new Map();
  app.activateListeners({
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
  const controls = {};
  hooks.getSceneControlButtons(controls);
  const app = await abrirDesdePanelGM(controls, instances, "consola");
  game.user.isGM = false;

  const actions = app.constructor.DEFAULT_OPTIONS.actions;
  await actions.pausar.call(app);
  await actions.reanudar.call(app);

  assert.deepEqual(fetchCalls, []);
  assert.deepEqual(notifications.info, []);
  assert.deepEqual(notifications.error, []);
});

test("un jugador no GM recibe asignación y espacio de puesto, sin controles GM", async () => {
  const { hooks } = await loadModule({ isGM: false });
  const controls = [{ name: "token", tools: [] }];

  hooks.getSceneControlButtons(controls);
  // El grupo propio es visible para el jugador con SOLO sus botones de puesto;
  // sin estado/mapa/token/diagnóstico (solo-GM) y nada en Token Controls.
  assert.deepEqual(controls[0].tools.map(({ name }) => name), []);
  const grupo = controls.find((control) => control.name === "lagunak");
  assert.ok(grupo);
  assert.deepEqual(grupo.tools.map(({ name }) => name), [
    // La cantina también, por lo mismo que el audio: es de la mesa, no del GM.
    "lagunak-cantina",
    // Y la sección de la nave, igual: es un plano de dónde vives, no una
    // consola. Un jugador la abre y la ve sin lectura de daño.
    "lagunak-seccion",
    // Prototipo de #427, misma visibilidad.
    "lagunak-andar-nave",
    // El audio lo habilita cada cliente con su propio gesto, que el navegador
    // exige y que no se puede delegar en el GM: por eso este botón sí lo ve un
    // jugador. El MANDO de la música sigue siendo solo del GM.
    "lagunak-musica-audio",
    "lagunak-puestos",
    "lagunak-avatar",
    "lagunak-espacio-puesto",
    // Y echar una mano: es la mecánica cooperativa, así que el jugador la ve.
    // El diagnóstico de contenido importado NO, que es lo de abajo.
    "lagunak-asistencia",
    // Parlamento de comunicaciones (#810): visible para toda la tripulación,
    // como la asistencia.
    "lagunak-parlamento",
  ]);
  assert.equal(grupo.tools.find(({ name }) => name === "lagunak-contenido-externo"), undefined);
  assert.equal(grupo.tools.find(({ name }) => name === "lagunak-musica"), undefined);
});

// #276 fusionó estado+mapa+encuentros+previsualización en una sola ventana
// (la consola caliente): ya no hay un botón ni una clase separada para el
// mapa vivo. `abrirConsolaCaliente` elige V1 (Application clásica, v11) o V2
// (ApplicationV2, v12+) según lo que ofrezca el anfitrión, con instancia
// perezosa compartida (reabrir no crea una segunda).
test("v11 abre la consola caliente con Application clásica (rAF ausente: sin bucle)", async () => {
  const { hooks, instances } = await loadModule();
  const controls = [];

  hooks.getSceneControlButtons(controls);
  // Abrir no debe romper aunque el arnés no tenga requestAnimationFrame:
  // la animación se auto-inhibe y la ventana sigue funcionando por sondeo.
  const consola = await abrirDesdePanelGM(controls, instances, "consola");

  assert.ok(consola);
  assert.deepEqual(consola.renderCalls, [true]);
  assert.equal(consola.constructor.defaultOptions.id, "lagunak-consola-caliente");

  // Reabrir no crea una segunda instancia de la consola (instancia perezosa
  // compartida, #276): solo se suma el panel que hace falta para llegar
  // hasta ella.
  const totalPrevio = instances.length;
  const reabierta = await abrirDesdePanelGM(controls, instances, "consola");
  assert.equal(reabierta, null, "una consola ya abierta no crea instancia nueva");
  assert.equal(instances.length, totalPrevio + 1, "solo se sumó el panel");
  assert.equal(instances.filter((i) => i === consola).length, 1);
});

test("host moderno registra el panel de GM con onChange (v13) y abre la consola caliente", async () => {
  const { hooks, instances } = await loadModule({ modern: true });
  const controls = {};

  hooks.getSceneControlButtons(controls);
  const panelTool = controls.lagunak.tools["lagunak-panel-gm"];
  assert.ok(panelTool);
  assert.equal(typeof panelTool.onClick, "function");
  assert.equal(typeof panelTool.onChange, "function"); // v13 dispara onChange

  const consola = await abrirDesdePanelGM(controls, instances, "consola");

  assert.deepEqual(consola.renderCalls, [{ force: true }]);
  assert.equal(consola.constructor.DEFAULT_OPTIONS.id, "lagunak-consola-caliente");

  const totalPrevio = instances.length;
  const reabierta = await abrirDesdePanelGM(controls, instances, "consola");
  assert.equal(reabierta, null, "una consola ya abierta no crea instancia nueva");
  assert.equal(instances.length, totalPrevio + 1, "solo se sumó el panel");
  assert.equal(instances.filter((i) => i === consola).length, 1);
});

test("v11 conserva la ayuda abierta entre re-renderizados hasta que se cierra", async () => {
  const { hooks, instances } = await loadModule();
  const controls = [];
  hooks.getSceneControlButtons(controls);
  const app = await abrirDesdePanelGM(controls, instances, "consola");

  const bindings = new Map();
  app.activateListeners({
    find(selector) {
      return { on(event, callback) { bindings.set(selector, { event, callback }); } };
    },
  });

  const toggle = bindings.get(".lagunak-ayuda");
  assert.equal(toggle.event, "toggle");
  assert.equal(app.getData().ayudaAbierta, false);
  toggle.callback({ currentTarget: { open: true } });
  app.render(false); // reemplazo de DOM equivalente al del sondeo
  assert.equal(app.getData().ayudaAbierta, true);
  toggle.callback({ currentTarget: { open: false } });
  assert.equal(app.getData().ayudaAbierta, false);
});

test("ApplicationV2 conserva la ayuda abierta entre re-renderizados hasta que se cierra", async () => {
  const { hooks, instances } = await loadModule({ modern: true });
  const controls = {};
  hooks.getSceneControlButtons(controls);
  const app = await abrirDesdePanelGM(controls, instances, "consola");

  let onToggle = null;
  const details = {
    open: false,
    addEventListener(event, callback) {
      if (event === "toggle") onToggle = callback;
    },
  };
  app.element = { querySelector: () => details };
  app._onRender({}, {});

  assert.equal((await app._prepareContext()).ayudaAbierta, false);
  details.open = true;
  onToggle({ currentTarget: details });
  app.render({ force: true });
  assert.equal((await app._prepareContext()).ayudaAbierta, true);
  details.open = false;
  onToggle({ currentTarget: details });
  assert.equal((await app._prepareContext()).ayudaAbierta, false);

  const template = await readFile(new URL("../templates/consola-caliente.hbs", import.meta.url), "utf8");
  assert.match(template, /\{\{#if ayudaAbierta\}\}open\{\{\/if\}\}/);
});

// Regresión de review (#279): #actualizarTelemetriaDom() patcheaba el DOM con
// sistema.salud/calor/potencia, pero prepareSystemRows() (ship-view.mjs)
// devuelve health/heat/power. Sin re-render (guard de aria-live de #227), el
// segundo sondeo estable escribía "undefined%" en las tres celdas de cada
// sistema. La prueba fuerza dos sondeos con la misma nave (sin cambio
// estructural) y comprueba el DOM tras el segundo, que es el que toma la vía
// del patch en vez de render().
test("ApplicationV2: el patch de telemetría usa los campos reales (health/heat/power) tras un sondeo estable", async (t) => {
  const nave = () => ({
    callsign: "Argia",
    position: { x: 10, y: 20 },
    heading: 90,
    hull: 100,
    hull_max: 100,
    energy: 100,
    energy_max: 100,
    shields_active: true,
    systems: {
      reactor: { health: 0.8, heat: 0.3, power: 1.0, coolant: 0 },
    },
  });
  const okJson = (payload) => ({ ok: true, status: 200, async json() { return payload; } });
  const fetchImpl = async (url) => {
    if (url.endsWith("/healthz")) return okJson({ ok: true });
    if (url.endsWith("/v1/state")) return okJson({ ship: nave() });
    if (url.endsWith("/v1/scenario")) return okJson({ scenario_time: 0, paused: false });
    if (url.endsWith("/v1/events")) return okJson({ events: [] });
    return okJson({});
  };

  const { hooks, instances } = await loadModule({ modern: true, fetchImpl });
  const controls = {};
  hooks.getSceneControlButtons(controls);
  const app = await abrirDesdePanelGM(controls, instances, "consola");

  const nodos = {
    salud: { textContent: "" },
    calor: { textContent: "" },
    potencia: { textContent: "" },
  };
  app.element = {
    querySelector(selector) {
      const match = selector.match(/data-campo="(\w+)"/);
      return match ? nodos[match[1]] ?? null : null;
    },
  };

  t.mock.timers.enable({ apis: ["setTimeout"] });
  app._onFirstRender({}, {});
  // Primer sondeo: fija #firmaVisibleAnterior (dispara render(), no el patch).
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  t.mock.timers.tick(2000);
  // Segundo sondeo, sin cambio estructural: toma la vía del patch directo.
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(nodos.salud.textContent, "80%");
  assert.equal(nodos.calor.textContent, "30%");
  assert.equal(nodos.potencia.textContent, "100%");
});

// Regresión de review (#280): réplica AISLADA para v11 del mismo bloqueo de
// #279 — #actualizarTelemetriaDom() de EstadoNaveAppV1 leía
// sistema.salud/calor/potencia en vez de health/heat/power. Mismo criterio
// que el test V2 equivalente, pero disparando el sondeo a través de
// `_render` (la vía real de arranque en v11, nunca ejercitada por los tests
// existentes porque el stub de `render()` no invocaba `_render`).
test("v11: el patch de telemetría usa los campos reales (health/heat/power) tras un sondeo estable", async (t) => {
  const nave = () => ({
    callsign: "Argia",
    position: { x: 10, y: 20 },
    heading: 90,
    hull: 100,
    hull_max: 100,
    energy: 100,
    energy_max: 100,
    shields_active: true,
    systems: {
      reactor: { health: 0.8, heat: 0.3, power: 1.0, coolant: 0 },
    },
  });
  const okJson = (payload) => ({ ok: true, status: 200, async json() { return payload; } });
  const fetchImpl = async (url) => {
    if (url.endsWith("/healthz")) return okJson({ ok: true });
    if (url.endsWith("/v1/state")) return okJson({ ship: nave() });
    if (url.endsWith("/v1/scenario")) return okJson({ scenario_time: 0, paused: false });
    if (url.endsWith("/v1/events")) return okJson({ events: [] });
    return okJson({});
  };

  const { hooks, instances } = await loadModule({ fetchImpl });
  const controls = [];
  hooks.getSceneControlButtons(controls);
  const app = await abrirDesdePanelGM(controls, instances, "consola");

  const nodos = {
    salud: { textContent: "" },
    calor: { textContent: "" },
    potencia: { textContent: "" },
  };
  app.element = [{
    querySelector(selector) {
      const match = selector.match(/data-campo="(\w+)"/);
      return match ? nodos[match[1]] ?? null : null;
    },
  }];

  t.mock.timers.enable({ apis: ["setTimeout"] });
  await app._render(true);
  // Primer sondeo: fija #firmaVisibleAnterior (dispara render(), no el patch).
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  t.mock.timers.tick(2000);
  // Segundo sondeo, sin cambio estructural: toma la vía del patch directo.
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(nodos.salud.textContent, "80%");
  assert.equal(nodos.calor.textContent, "30%");
  assert.equal(nodos.potencia.textContent, "100%");
});

test("REGRESIÓN: la ventana de puestos sigue los cambios del ajuste de requisitos", async () => {
  // Los requisitos se releen en cada render y también al guardar, así que una
  // ventana abierta con el ajuste cambiado enseñaba el estado ANTERIOR y mentía
  // en las dos direcciones: opciones que parecían permitidas y el guardado
  // rechazaba, u opciones deshabilitadas que ya no tendrían por qué estarlo y
  // que ni siquiera podían emitir el cambio.
  const { hooks, instances, ajustes } = await loadModule();
  hooks.init?.();
  const controls = [{ name: "token", tools: [] }];
  hooks.getSceneControlButtons(controls);
  await toolByName(controls, "lagunak-puestos").onClick();

  const ventana = instances.at(-1);
  assert.ok(ventana, "la ventana de puestos se abre");

  const activar = ajustes.get("requisitosPuesto");
  const minimo = ajustes.get("requisitosPuestoMinimo");
  assert.ok(activar?.onChange, "el ajuste de requisitos avisa de sus cambios");
  assert.ok(minimo?.onChange, "y el del mínimo también");
  assert.equal(activar.default, false, "apagado de serie: quien no lo active no nota nada");

  // Activar, subir el mínimo y desactivar: los tres tienen que repintar.
  for (const [ajuste, valor] of [
    [activar, true],
    [minimo, 14],
    [activar, false],
  ]) {
    ventana.renderCalls.length = 0;
    await ajuste.onChange(valor);
    assert.equal(ventana.renderCalls.length, 1, "la ventana abierta se repinta");
  }

  // Con la ventana cerrada, un cambio de ajuste no la resucita ni revienta.
  await ventana.close();
  ventana.renderCalls.length = 0;
  await assert.doesNotReject(async () => activar.onChange(true));
  assert.deepEqual(ventana.renderCalls, [], "una ventana cerrada no se repinta");
});

// Abre la cantina desde su botón de escena y elige la puerta del póker: es el
// camino equivalente al botón de mesa directo que existía antes de #423.
async function abrirMesaPorCantina(controls, instances) {
  const boton = toolByName(controls, "lagunak-cantina");
  assert.ok(boton, "la cantina tiene su botón de escena");
  await boton.onClick();
  const cantina = instances.at(-1);
  cantina.seleccionarPuerta("poker");
  return instances.at(-1);
}

// Una puerta que no está en el catálogo no abre una mesa cualquiera. Caer al
// póker por defecto convertiría "he añadido una puerta y me he olvidado de su
// mesa" en "el póker se abre solo", que es un fallo mucho más caro de ver.
test("una puerta desconocida no abre ninguna mesa", async () => {
  const { hooks, instances } = await loadModule();
  await arrancarReady(hooks);
  const controls = [{ name: "token", tools: [] }];
  hooks.getSceneControlButtons(controls);

  const boton = toolByName(controls, "lagunak-cantina");
  await boton.onClick();
  const cantina = instances.at(-1);
  cantina.seleccionarPuerta("mesa-que-no-existe");
  assert.equal(instances.at(-1), cantina, "no se ha construido ninguna mesa");
});

// La sección de la nave (#427). Lo que hay que poder afirmar del cableado es
// que el botón abre el plano y que entrar en una sala lleva al sitio que ya
// existe — la sección no estrena ninguna vista propia, y ese es el punto.
test("la sección abre desde su botón y la cantina se entra desde el plano", async () => {
  const { hooks, instances } = await loadModule();
  await arrancarReady(hooks);
  const controls = [{ name: "token", tools: [] }];
  hooks.getSceneControlButtons(controls);

  const boton = toolByName(controls, "lagunak-seccion");
  assert.ok(boton, "la sección tiene su botón de escena");
  await boton.onClick();
  const seccion = instances.at(-1);
  assert.ok(seccion, "no se ha construido la ventana de la sección");

  // Entrar a la cantina desde el plano abre la MISMA cantina de siempre.
  seccion.entrarEnSala("cantina");
  assert.notEqual(instances.at(-1), seccion, "entrar en la cantina no abrió nada");
});

// Una sala de mirar no puede llevar a ningún sitio. Si la bodega abriera algo
// «por defecto», añadir una sala y olvidarse de su vista se convertiría en «se
// abre la cantina sola», que es un fallo mucho más caro de ver.
test("una sala sin vista propia no abre nada, y una sala inventada tampoco", async () => {
  const { hooks, instances } = await loadModule();
  await arrancarReady(hooks);
  const controls = [{ name: "token", tools: [] }];
  hooks.getSceneControlButtons(controls);

  await toolByName(controls, "lagunak-seccion").onClick();
  const seccion = instances.at(-1);
  seccion.entrarEnSala("bodega");
  assert.equal(instances.at(-1), seccion, "la bodega abrió una ventana que no tiene");
  seccion.entrarEnSala("sala-que-no-existe");
  assert.equal(instances.at(-1), seccion, "una sala inventada abrió algo");
});

// Regresión de smoke (v11.302, 31-jul): se entraba por la cantina y salía la
// mesa CERRADA de la sesión anterior, sin una sola acción que pulsar y sin
// forma de arrancar otra. El guardián miraba solo si había estado publicado, y
// una mano terminada se queda publicada para siempre.
test("una mesa terminada no bloquea la apertura: la cantina abre una nueva", async () => {
  const { hooks, instances } = await loadModule();
  await arrancarReady(hooks);
  const controls = [{ name: "token", tools: [] }];
  hooks.getSceneControlButtons(controls);
  // Solo el coordinador crea mesas, y el coordinador es el GM activo.
  game.users = { activeGM: game.user };

  // Cadáver de la partida de ayer, publicado en el ajuste de mundo.
  await game.settings.set("espaciokoop-lagunak", "minijuegoSesionPublica", {
    id: "sesion-vieja",
    juego: "poker",
    fase: "terminada",
    jugadores: [],
  });

  await abrirMesaPorCantina(controls, instances);

  const publicado = game.settings.get("espaciokoop-lagunak", "minijuegoSesionPublica");
  assert.notEqual(publicado.id, "sesion-vieja", "la mesa muerta sigue publicada");
  assert.notEqual(publicado.fase, "terminada", "la mesa nueva nace ya terminada");
});

test("una mesa viva NO se reemplaza al volver a entrar por la cantina", async () => {
  // La otra mitad de la regla: reabrir la puerta con una partida en marcha no
  // puede barrer la mesa y las fichas de quienes están jugando.
  const { hooks, instances } = await loadModule();
  await arrancarReady(hooks);
  const controls = [{ name: "token", tools: [] }];
  hooks.getSceneControlButtons(controls);
  game.users = { activeGM: game.user };

  await game.settings.set("espaciokoop-lagunak", "minijuegoSesionPublica", {
    id: "sesion-viva",
    juego: "poker",
    fase: "en_curso",
    jugadores: [],
  });

  await abrirMesaPorCantina(controls, instances);

  const publicado = game.settings.get("espaciokoop-lagunak", "minijuegoSesionPublica");
  assert.equal(publicado.id, "sesion-viva", "la partida en curso se ha perdido");
});

// #418 se mergeó contra su rama base y no contra `main`, así que la mesa de
// dados existía y no había forma de llegar a ella. Ahora se llega por la
// cantina, y esto lo fija: no basta con que la puerta esté en el catálogo, hay
// que abrir LA VENTANA DE DADOS y no la de póker con otro nombre.
test("la puerta de dados abre la mesa de dados, no la de póker", async () => {
  const { hooks, instances } = await loadModule();
  await arrancarReady(hooks);
  const controls = [{ name: "token", tools: [] }];
  hooks.getSceneControlButtons(controls);
  game.users = { activeGM: game.user };
  // Sin mesa puesta. Explícito: el ajuste sin valor devuelve el relleno del
  // arnés, y una mesa que en realidad es un `2` no prueba nada.
  await game.settings.set("espaciokoop-lagunak", "minijuegoSesionPublica", null);

  const boton = toolByName(controls, "lagunak-cantina");
  await boton.onClick();
  instances.at(-1).seleccionarPuerta("dados");
  const mesa = instances.at(-1);

  assert.equal(mesa.juegoMesa, "dados");
  const publicado = game.settings.get("espaciokoop-lagunak", "minijuegoSesionPublica");
  assert.equal(publicado.juego, "dados", "la mesa creada no es de dados");
});

// La publicación del ajuste es ASÍNCRONA en Foundry: leerlo justo después de
// crear la mesa devuelve la partida anterior, y la ventana se abría con el juego
// viejo encima de la mesa nueva. Se reproduce con un `set` que tarda.
test("la mesa recién puesta manda aunque el ajuste aún no se haya publicado", async () => {
  const { hooks, instances } = await loadModule();
  await arrancarReady(hooks);
  const controls = [{ name: "token", tools: [] }];
  hooks.getSceneControlButtons(controls);
  game.users = { activeGM: game.user };

  // Mesa de póker terminada: cruzar la puerta de dados debe poner una de dados.
  await game.settings.set("espaciokoop-lagunak", "minijuegoSesionPublica", {
    id: "poker-de-ayer",
    juego: "poker",
    fase: "terminada",
    jugadores: [],
  });

  // A partir de aquí, publicar no tiene efecto inmediato sobre la lectura: es
  // exactamente lo que hace Foundry, y lo que el arnés síncrono escondía.
  const setReal = game.settings.set;
  game.settings.set = async (...args) => {
    await Promise.resolve();
    return setReal.apply(game.settings, args);
  };
  try {
    const boton = toolByName(controls, "lagunak-cantina");
    await boton.onClick();
    instances.at(-1).seleccionarPuerta("dados");
    assert.equal(instances.at(-1).juegoMesa, "dados", "se abrió la ventana del juego viejo");
  } finally {
    game.settings.set = setReal;
  }
});

test("con una mesa de póker VIVA, la puerta de dados no la barre", async () => {
  // Manda la mesa puesta, no la puerta que se cruzó: abrir dados sobre una
  // partida de póker en curso enseñaría una mesa que no existe.
  const { hooks, instances } = await loadModule();
  await arrancarReady(hooks);
  const controls = [{ name: "token", tools: [] }];
  hooks.getSceneControlButtons(controls);
  game.users = { activeGM: game.user };

  await game.settings.set("espaciokoop-lagunak", "minijuegoSesionPublica", {
    id: "partida-de-poker",
    juego: "poker",
    fase: "en_curso",
    jugadores: [],
  });

  const boton = toolByName(controls, "lagunak-cantina");
  await boton.onClick();
  instances.at(-1).seleccionarPuerta("dados");

  const publicado = game.settings.get("espaciokoop-lagunak", "minijuegoSesionPublica");
  assert.equal(publicado.id, "partida-de-poker", "la partida en curso se ha perdido");
  assert.equal(instances.at(-1).juegoMesa, "poker", "manda la mesa, no la puerta");
});

test("v11: la mesa se puede cerrar y volver a abrir, con instancia nueva", async () => {
  // El singleton `mesaApp` solo se creaba cuando era null y ninguna ventana lo
  // soltaba al cerrarse: la segunda apertura reutilizaba una instancia cerrada.
  // En ApplicationV2 eso ni siquiera se puede renderizar; en v11 es una
  // diferencia invisible entre rutas, que es como se cuelan los fallos.
  const { hooks, instances } = await loadModule();
  // El hook que reparte vistas a la ventana se registra en `ready`.
  await arrancarReady(hooks);
  const controls = [{ name: "token", tools: [] }];
  hooks.getSceneControlButtons(controls);

  const primera = await abrirMesaPorCantina(controls, instances);
  assert.equal(primera.rendered, true);

  await primera.close();
  const segunda = await abrirMesaPorCantina(controls, instances);
  assert.notEqual(segunda, primera, "la reapertura construye otra ventana");
  assert.equal(segunda.rendered, true);

  // Y la vista que llegue después refresca la NUEVA, no el cadáver de la vieja.
  primera.renderCalls.length = 0;
  segunda.renderCalls.length = 0;
  hooks.lagunakMinijuegoVistaPrivada({ id: "s", jugadores: [] }, ["join"]);
  assert.equal(segunda.renderCalls.length, 1);
  assert.deepEqual(primera.renderCalls, [], "la instancia cerrada no se toca");
  await segunda.close();
});

test("host moderno: misma regla de descarte para la mesa (ApplicationV2)", async () => {
  const { hooks, instances } = await loadModule({ modern: true });
  await arrancarReady(hooks);
  const controls = [{ name: "token", tools: [] }];
  hooks.getSceneControlButtons(controls);

  const primera = await abrirMesaPorCantina(controls, instances);
  // En V2 el descarte llega por `_onClose`, que es lo que invoca el marco.
  primera._onClose({});
  const segunda = await abrirMesaPorCantina(controls, instances);
  assert.notEqual(segunda, primera);

  primera.renderCalls.length = 0;
  segunda.renderCalls.length = 0;
  hooks.lagunakMinijuegoVistaPrivada({ id: "s", jugadores: [] }, ["join"]);
  assert.equal(segunda.renderCalls.length, 1);
  assert.deepEqual(primera.renderCalls, []);
});

test("cerrar una ventana que ya no es la vigente no deja huérfana a la nueva", async () => {
  // Entre cerrar una y abrir la siguiente puede haberse creado ya otra: soltar
  // la referencia a ciegas dejaría sin refresco a la que está en pantalla.
  const { hooks, instances } = await loadModule();
  await arrancarReady(hooks);
  const controls = [{ name: "token", tools: [] }];
  hooks.getSceneControlButtons(controls);

  const primera = await abrirMesaPorCantina(controls, instances);
  await primera.close();
  const segunda = await abrirMesaPorCantina(controls, instances);

  await primera.close(); // cierre tardío de la vieja
  segunda.renderCalls.length = 0;
  hooks.lagunakMinijuegoVistaPrivada({ id: "s", jugadores: [] }, ["join"]);
  assert.equal(segunda.renderCalls.length, 1, "la vigente sigue viva");
  await segunda.close();
});
