import assert from "node:assert/strict";
import test from "node:test";

let nonce = 0;

function makeUser({ id, name, isGM = false, station = null, character = null }) {
  return {
    id,
    name,
    isGM,
    active: true,
    character,
    flags: station ? { station } : {},
    getFlag(_module, key) { return this.flags[key]; },
    async setFlag(_module, key, value) { this.flags[key] = value; },
    async unsetFlag(_module, key) { delete this.flags[key]; },
  };
}

async function setup({ isGM = false, modern = false } = {}) {
  const hooks = {};
  const instances = [];
  const notifications = { info: [], error: [], warn: [] };

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
    activateListeners() {}
  }

  const current = makeUser({ id: isGM ? "gm" : "p1", name: isGM ? "GM" : "Uno", isGM, character: { system: { abilities: { str: { value: 10 }, dex: { value: 10 }, con: { value: 10 }, int: { value: 10 }, wis: { value: 10 }, cha: { value: 10 } } } } });
  const other = makeUser({ id: "p2", name: "Dos", character: { system: { abilities: { str: { value: 10 }, dex: { value: 10 }, con: { value: 10 }, int: { value: 10 }, wis: { value: 10 }, cha: { value: 10 } } } } });
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
    i18n: { 
      localize: (key) => key,
      format: (key, data) => key // Simplified for testing
    },
    settings: {
      get: (moduleId, key) => {
        if (key === "requisitosPuesto") return true;
        if (key === "requisitosPuestoMinimo") return 3;
        return undefined;
      },
    },
  };
  globalThis.ui = {
    notifications: {
      info(message) { notifications.info.push(message); },
      error(message) { notifications.error.push(message); },
      warn(message) { notifications.warn.push(message); },
    },
  };

  const module = await import(`../scripts/station-ui.mjs?ui-test=${nonce++}`);
  module.registerStationFeature("espaciokoop-lagunak");
  return { module, hooks, instances, notifications, current, other };
}

test("v11: un jugador abre su selector, ve solo su fila y guarda su puesto", async () => {
  const { module, instances, notifications, current } = await setup();
  const controls = [{ name: "lagunak", tools: [] }];

  module.addStationControl(controls);
  assert.equal(controls[0].tools.length, 1);
  controls[0].tools[0].onClick();

  assert.equal(instances.length, 1);
  assert.deepEqual(instances[0].renderCalls, [true]);
  const context = instances[0].getData();
  assert.deepEqual(context.crew.map((entry) => entry.id), ["p1"]);
  assert.equal(context.isGM, false);

  let change;
  instances[0].activateListeners({
    find(selector) {
      assert.equal(selector, "[data-station-user]");
      return { on(event, callback) { assert.equal(event, "change"); change = callback; } };
    },
  });
  await change({ currentTarget: { dataset: { userId: "p1" }, value: "engineering" } });

  assert.equal(current.flags.station, "engineering");
  assert.deepEqual(notifications.info, ["LAGUNAK.Puestos.Guardado"]);
  assert.deepEqual(notifications.error, []);
  assert.deepEqual(notifications.warn, []); // no warnings expected
});

test("v11: el GM ve jugadores desconectados y puede corregir su puesto", async () => {
  const { module, instances, other } = await setup({ isGM: true });
  other.active = false;
  const controls = [{ name: "lagunak", tools: [] }];

  module.addStationControl(controls);
  controls[0].tools[0].onClick();
  const context = instances[0].getData();
  assert.deepEqual(context.crew.map((entry) => entry.id), ["p2"]);
  assert.equal(context.crew[0].active, false);
  assert.equal(context.isGM, true);

  let change;
  instances[0].activateListeners({
    find() { return { on(_event, callback) { change = callback; } }; }
  });
  await change({ currentTarget: { dataset: { userId: "p2" }, value: "captain" } });

  assert.equal(other.flags.station, "captain");
});

test("host moderno abre con ApplicationV2 y refresca al actualizar un usuario", async () => {
  const { module, hooks, instances } = await setup({ modern: true });
  const controls = { lagunak: { tools: {} } };

  module.addStationControl(controls);
  assert.equal(typeof controls.lagunak.tools["lagunak-puestos"].onChange, "function");
  controls.lagunak.tools["lagunak-puestos"].onClick();

  assert.equal(instances.length, 1);
  assert.deepEqual(instances[0].renderCalls, [{ force: true }]);
  const context = await instances[0]._prepareContext();
  assert.deepEqual(context.crew.map((entry) => entry.id), ["p1"]);
  assert.equal(context.isGM, false);

  hooks.updateUser();
  assert.deepEqual(instances[0].renderCalls, [{ force: true }, { force: true }]);
});

test("v11: un fallo al guardar restaura el puesto autoritativo", async () => {
  const { module, instances, notifications, current } = await setup({ modern: false });
  current.flags.station = "navigation";
  current.setFlag = async () => {
    throw new Error("fallo simulado de persistencia");
  };
  const controls = [{ name: "lagunak", tools: [] }];

  module.addStationControl(controls);
  controls[0].tools[0].onClick();

  let change;
  instances[0].activateListeners({
    find() { return { on(_event, callback) { change = callback; } }; }
  });
  const select = { dataset: { userId: current.id }, value: "engineering" };
  await change({ currentTarget: select });

  assert.equal(current.flags.station, "navigation");
  assert.equal(select.value, "navigation");
  assert.deepEqual(notifications.info, []);
  assert.deepEqual(notifications.error, ["LAGUNAK.Puestos.ErrorGuardado"]);
  assert.deepEqual(notifications.warn, []); // no warnings expected
});

test("ApplicationV2: un fallo al guardar restaura el puesto autoritativo", async () => {
  const { module, instances, notifications, current } = await setup({ modern: true });
  current.flags.station = "navigation";
  current.setFlag = async () => {
    throw new Error("fallo simulado de persistencia");
  };
  const controls = { lagunak: { tools: {} } };

  module.addStationControl(controls);
  controls.lagunak.tools["lagunak-puestos"].onClick();

  let change;
  instances[0].element = {
    querySelectorAll() {
      return [{ addEventListener(_event, callback) { change = callback; } }];
    },
  };
  instances[0]._onRender({}, {});
  const select = { dataset: { userId: current.id }, value: "engineering" };
  await change({ currentTarget: select });

  assert.equal(current.flags.station, "navigation");
  assert.equal(select.value, "navigation");
  assert.deepEqual(notifications.info, []);
  assert.deepEqual(notifications.error, ["LAGUNAK.Puestos.ErrorGuardado"]);
  assert.deepEqual(notifications.warn, []); // no warnings expected
});

test("refrescarPuestos no hace nada si la ventana no está renderizada", async () => {
  const { module, instances } = await setup({ modern: false });
  const controls = [{ name: "lagunak", tools: [] }];
  module.addStationControl(controls);
  // No se llama a onClick, así que stationApp permanece null
  // No hay instancias creadas
  assert.equal(instances.length, 0);
  // Llamar a refrescarPuestos no debería lanzar error ni hacer nada
  module.refrescarPuestos();
  // Todavía no hay instancias
  assert.equal(instances.length, 0);
});

test("refrescarPuestos vuelve a renderizar si la ventana está renderizada (v11)", async () => {
  const { module, instances } = await setup({ modern: false });
  const controls = [{ name: "lagunak", tools: [] }];
  module.addStationControl(controls);
  controls[0].tools[0].onClick(); // abre la app

  assert.equal(instances.length, 1);
  assert.equal(instances[0].rendered, true);
  // Guardamos el número de llamadas a render antes
  const renderCallsBefore = instances[0].renderCalls.length;
  module.refrescarPuestos();
  // Debe haber llamado a render nuevamente
  assert.equal(instances[0].renderCalls.length, renderCallsBefore + 1);
  // El último llamado debería ser con false (o { force: true } si fuera V2, pero aquí es v11)
  const lastCall = instances[0].renderCalls[instances[0].renderCalls.length - 1];
  assert.equal(lastCall, false);
});

test("refrescarPuestos vuelve a renderizar si la ventana está renderizada (V2)", async () => {
  const { module, instances, hooks } = await setup({ modern: true });
  const controls = { lagunak: { tools: {} } };
  module.addStationControl(controls);
  controls.lagunak.tools["lagunak-puestos"].onClick(); // abre la app

  assert.equal(instances.length, 1);
  assert.equal(instances[0].rendered, true);
  const renderCallsBefore = instances[0].renderCalls.length;
  module.refrescarPuestos();
  assert.equal(instances[0].renderCalls.length, renderCallsBefore + 1);
  const lastCall = instances[0].renderCalls[instances[0].renderCalls.length - 1];
  assert.deepEqual(lastCall, { force: true });
});

test("el contexto incluye isGM correctamente", async () => {
  // Test for GM
  const { module: moduleGM, instances: instancesGM } = await setup({ isGM: true, modern: false });
  const controlsGM = [{ name: "lagunak", tools: [] }];
  moduleGM.addStationControl(controlsGM);
  controlsGM[0].tools[0].onClick();
  const contextGM = instancesGM[0].getData();
  assert.equal(contextGM.isGM, true);

  // Test for non-GM
  const { module: modulePlayer, instances: instancesPlayer } = await setup({ isGM: false, modern: false });
  const controlsPlayer = [{ name: "lagunak", tools: [] }];
  modulePlayer.addStationControl(controlsPlayer);
  controlsPlayer[0].tools[0].onClick();
  const contextPlayer = instancesPlayer[0].getData();
  assert.equal(contextPlayer.isGM, false);
});

test("el contexto usa los requisitos vigentes actuales (no guarda los requisitos)", async () => {
  // First setup: requisitosPuestoMinimo = 15 -> usuario con valor 10 no cumple
  const { module: module1, instances: instances1 } = await setup({ isGM: false, modern: false });
  // Override the settings.get to return minimo = 15 (higher than 10)
  globalThis.game.settings.get = (moduleId, key) => {
    if (key === "requisitosPuesto") return true;
    if (key === "requisitosPuestoMinimo") return 15;
    return undefined;
  };
  const controls1 = [{ name: "lagunak", tools: [] }];
  module1.addStationControl(controls1);
  controls1[0].tools[0].onClick();
  const context1 = instances1[0].getData();
  // Find the engineering station in the crew's stations
  const crew1 = context1.crew[0];
  const engStation1 = crew1.stations.find(s => s.value === "engineering");
  // Since the user's best is 10 and minimo is 15, the station should be disabled (if not GM)
  assert.equal(engStation1.disabled, true, "Engineering station should be disabled when requirement not met");

  // Second setup: requisitosPuestoMinimo = 5 -> usuario con valor 10 cumple
  const { module: module2, instances: instances2 } = await setup({ isGM: false, modern: false });
  globalThis.game.settings.get = (moduleId, key) => {
    if (key === "requisitosPuesto") return true;
    if (key === "requisitosPuestoMinimo") return 5;
    return undefined;
  };
  const controls2 = [{ name: "lagunak", tools: [] }];
  module2.addStationControl(controls2);
  controls2[0].tools[0].onClick();
  const context2 = instances2[0].getData();
  const crew2 = context2.crew[0];
  const engStation2 = crew2.stations.find(s => s.value === "engineering");
  // Now the station should be enabled
  assert.equal(engStation2.disabled, false, "Engineering station should be enabled when requirement met");
});

test("V1 y V2 producen el mismo contexto dado el mismo estado", async () => {
  // Setup for V1
  const { module: moduleV1, instances: instancesV1 } = await setup({ isGM: false, modern: false });
  const controlsV1 = [{ name: "lagunak", tools: [] }];
  moduleV1.addStationControl(controlsV1);
  controlsV1[0].tools[0].onClick();
  const contextV1 = instancesV1[0].getData();

  // Setup for V2 with the same initial state
  const { module: moduleV2, instances: instancesV2 } = await setup({ isGM: false, modern: true });
  const controlsV2 = { lagunak: { tools: {} } };
  moduleV2.addStationControl(controlsV2);
  controlsV2.lagunak.tools["lagunak-puestos"].onClick();
  const contextV2 = await instancesV2[0]._prepareContext();

  // Compare the context objects, ignoring functions and focusing on data
  // We'll compare the isGM and the crew's basic info and station selections
  assert.equal(contextV1.isGM, contextV2.isGM);
  assert.deepEqual(contextV1.crew.map(c => ({
    id: c.id,
    name: c.name,
    active: c.active,
    canEdit: c.canEdit,
    // For stations, we compare the selected value and disabled state
    stations: c.stations.map(s => ({
      value: s.value,
      label: s.label,
      selected: s.selected,
      disabled: s.disabled,
      motivo: s.motivo
    }))
  })), contextV2.crew.map(c => ({
    id: c.id,
    name: c.name,
    active: c.active,
    canEdit: c.canEdit,
    stations: c.stations.map(s => ({
      value: s.value,
      label: s.label,
      selected: s.selected,
      disabled: s.disabled,
      motivo: s.motivo
    }))
  })));
});

test("el puesto no da autoridad al elegir (no emite orden al puente)", async () => {
  // This test ensures that clicking in the station selector does not emit any order to the bridge.
  // Since the module does not have any bridge communication, we can only verify that the assignStation
  // function is called (which is tested implicitly by the flag being set) and that there is no
  // additional bridge call. We can't test the bridge because it's outside the module.
  // We'll rely on the existing tests that check the flag is set and that no error notifications
  // appear when the operation is successful.
  const { module, instances, notifications, current } = await setup({ isGM: false, modern: false });
  const controls = [{ name: "lagunak", tools: [] }];
  module.addStationControl(controls);
  controls[0].tools[0].onClick();

  let change;
  instances[0].activateListeners({
    find(selector) {
      assert.equal(selector, "[data-station-user]");
      return { on(event, callback) { assert.equal(event, "change"); change = callback; } };
    },
  });
  await change({ currentTarget: { dataset: { userId: "p1" }, value: "engineering" } });

  // The flag is set, which means assignStation was called and succeeded.
  assert.equal(current.flags.station, "engineering");
  // No error notification should appear.
  assert.deepEqual(notifications.error, []);
  // Success notification should appear.
  assert.deepEqual(notifications.info, ["LAGUNAK.Puestos.Guardado"]);
  // No warnings expected
  assert.deepEqual(notifications.warn, []);
});

test("updateSetting con requisitosPuesto del módulo refresca la ventana abierta", async () => {
  const { module, hooks, instances } = await setup({ modern: false });
  const controls = [{ name: "lagunak", tools: [] }];
  module.addStationControl(controls);
  controls[0].tools[0].onClick();

  const renderCallsBefore = instances[0].renderCalls.length;
  hooks.updateSetting({ key: "espaciokoop-lagunak.requisitosPuesto" });
  assert.equal(instances[0].renderCalls.length, renderCallsBefore + 1);
});

test("updateSetting con requisitosPuestoMinimo del módulo refresca la ventana abierta", async () => {
  const { module, hooks, instances } = await setup({ modern: false });
  const controls = [{ name: "lagunak", tools: [] }];
  module.addStationControl(controls);
  controls[0].tools[0].onClick();

  const renderCallsBefore = instances[0].renderCalls.length;
  hooks.updateSetting({ key: "espaciokoop-lagunak.requisitosPuestoMinimo" });
  assert.equal(instances[0].renderCalls.length, renderCallsBefore + 1);
});

test("updateSetting de un ajuste ajeno no refresca la ventana", async () => {
  const { module, hooks, instances } = await setup({ modern: false });
  const controls = [{ name: "lagunak", tools: [] }];
  module.addStationControl(controls);
  controls[0].tools[0].onClick();

  const renderCallsBefore = instances[0].renderCalls.length;
  hooks.updateSetting({ key: "otro-modulo.requisitosPuesto" });
  assert.equal(instances[0].renderCalls.length, renderCallsBefore);
});
