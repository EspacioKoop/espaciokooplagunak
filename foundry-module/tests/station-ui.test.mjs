import assert from "node:assert/strict";
import test from "node:test";

let nonce = 0;

function makeUser({ id, name, isGM = false, station = null }) {
  return {
    id,
    name,
    isGM,
    active: true,
    flags: station ? { station } : {},
    getFlag(_module, key) { return this.flags[key]; },
    async setFlag(_module, key, value) { this.flags[key] = value; },
    async unsetFlag(_module, key) { delete this.flags[key]; },
  };
}

async function setup({ isGM = false, modern = false } = {}) {
  const hooks = {};
  const instances = [];
  const notifications = { info: [], error: [] };

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

  const current = makeUser({ id: isGM ? "gm" : "p1", name: isGM ? "GM" : "Uno", isGM });
  const other = makeUser({ id: "p2", name: "Dos" });
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
  };
  globalThis.ui = {
    notifications: {
      info(message) { notifications.info.push(message); },
      error(message) { notifications.error.push(message); },
    },
  };

  const module = await import(`../scripts/station-ui.mjs?ui-test=${nonce++}`);
  module.registerStationFeature("espaciokoop-lagunak");
  return { module, hooks, instances, notifications, current, other };
}

test("v11: un jugador abre su selector, ve solo su fila y guarda su puesto", async () => {
  const { module, instances, notifications, current } = await setup();
  const controls = [{ name: "token", tools: [] }];

  module.addStationControl(controls);
  assert.equal(controls[0].tools.length, 1);
  controls[0].tools[0].onClick();

  assert.equal(instances.length, 1);
  assert.deepEqual(instances[0].renderCalls, [true]);
  const context = instances[0].getData();
  assert.deepEqual(context.crew.map((entry) => entry.id), ["p1"]);

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
});

test("v11: el GM ve jugadores desconectados y puede corregir su puesto", async () => {
  const { module, instances, other } = await setup({ isGM: true });
  other.active = false;
  const controls = [{ name: "token", tools: [] }];

  module.addStationControl(controls);
  controls[0].tools[0].onClick();
  const context = instances[0].getData();
  assert.deepEqual(context.crew.map((entry) => entry.id), ["p2"]);
  assert.equal(context.crew[0].active, false);

  let change;
  instances[0].activateListeners({
    find() { return { on(_event, callback) { change = callback; } }; },
  });
  await change({ currentTarget: { dataset: { userId: "p2" }, value: "captain" } });
  assert.equal(other.flags.station, "captain");
});

test("host moderno abre con ApplicationV2 y refresca al actualizar un usuario", async () => {
  const { module, hooks, instances } = await setup({ modern: true });
  const controls = { tokens: { tools: {} } };

  module.addStationControl(controls);
  assert.equal(typeof controls.tokens.tools["lagunak-puestos"].onChange, "function");
  controls.tokens.tools["lagunak-puestos"].onClick();

  assert.equal(instances.length, 1);
  assert.deepEqual(instances[0].renderCalls, [{ force: true }]);
  const context = await instances[0]._prepareContext();
  assert.deepEqual(context.crew.map((entry) => entry.id), ["p1"]);

  hooks.updateUser();
  assert.deepEqual(instances[0].renderCalls, [{ force: true }, { force: true }]);
});

for (const modern of [false, true]) {
  const version = modern ? "ApplicationV2" : "v11";
  test(`${version}: un fallo al guardar restaura el puesto autoritativo`, async () => {
    const { module, instances, notifications, current } = await setup({ modern });
    current.flags.station = "navigation";
    current.setFlag = async () => {
      throw new Error("fallo simulado de persistencia");
    };
    const controls = modern ? { tokens: { tools: {} } } : [{ name: "token", tools: [] }];

    module.addStationControl(controls);
    if (modern) controls.tokens.tools["lagunak-puestos"].onClick();
    else controls[0].tools[0].onClick();

    let change;
    if (modern) {
      instances[0].element = {
        querySelectorAll() {
          return [{ addEventListener(_event, callback) { change = callback; } }];
        },
      };
      instances[0]._onRender({}, {});
    } else {
      instances[0].activateListeners({
        find() { return { on(_event, callback) { change = callback; } }; },
      });
    }

    const select = { dataset: { userId: current.id }, value: "engineering" };
    await change({ currentTarget: select });

    assert.equal(current.flags.station, "navigation");
    assert.equal(select.value, "navigation");
    assert.deepEqual(notifications.info, []);
    assert.deepEqual(notifications.error, ["LAGUNAK.Puestos.ErrorGuardado"]);
  });
}
