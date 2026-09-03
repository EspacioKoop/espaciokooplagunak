import assert from "node:assert/strict";
import test from "node:test";

// Mock the global environment that convocatoria-app.mjs expects.
function setupMocks() {
  // Mock HandlebarsApplicationMixin as a function that returns a class
  globalThis.HandlebarsApplicationMixin = (Base) => {
    return class extends Base {};
  };
  // Mock foundry applications
  class MockApplicationV2 {
    constructor(options) {
      this.options = options;
      this.rendered = false;
      this.closed = false;
    }
    render(options) {
      this.rendered = true;
      this.renderOptions = options;
    }
    close() {
      this.closed = true;
    }
  }
  globalThis.foundry = {
    applications: {
      api: {
        ApplicationV2: MockApplicationV2,
        HandlebarsApplicationMixin: globalThis.HandlebarsApplicationMixin,
      },
    },
    utils: { mergeObject: (base, extra) => ({ ...base, ...extra }) },
  };
  // Mock Application class (v11)
  class MockApplication {
    constructor(options) {
      this.options = options;
      this.rendered = false;
      this.closed = false;
    }
    render(options) {
      this.rendered = true;
      this.renderOptions = options;
    }
    close() {
      this.closed = true;
    }
    activateListeners() {}
  }
  globalThis.Application = MockApplication;
  // Mock game
  globalThis.game = {
    i18n: {
      localize: (key) => key, // return the key for simplicity
      format: (str, params) => str.replace(/{([^}]+)}/g, (_, k) => params[k]),
    },
    user: { isGM: true },
  };
  // Mock ui.notifications (not used in these tests)
  globalThis.ui = {
    notifications: {
      warn: () => {},
      info: () => {},
    },
  };
}

// Helper to reset mocks
function resetMocks() {
  delete globalThis.HandlebarsApplicationMixin;
  delete globalThis.foundry;
  delete globalThis.Application;
  delete globalThis.game;
  delete globalThis.ui;
}

// Test v12+: al renderizar, el foco cae en el primer campo
test("v12+: al renderizar, el foco cae en el primer campo", async () => {
  setupMocks();
  try {
    // Import the module after setting up mocks
    const mod = await import("../scripts/convocatoria-app.mjs");
    const Clase = mod.crearClaseConvocatoriaV2({ onSubmit: () => {} });
    const app = new Clase();
    // Create a mock element that mimics the DOM structure
    const inputEstancia = { focused: false, focus: () => { inputEstancia.focused = true; } };
    const inputRol = { focused: false, focus: () => { inputRol.focused = true; } };
    const form = {
      querySelector: (selector) => {
        if (selector === '[name="idEstancia"]') return inputEstancia;
        if (selector === '[name="rolConvocante"]') return inputRol;
        if (selector === "form") return form; // form matches itself
        return null;
      },
      addEventListener: (event, listener) => {
        if (event === "submit") form.submitListener = listener;
      },
    };
    app.element = {
      querySelector: (selector) => form.querySelector(selector),
    };
    app._onRender({}, {});
    assert.equal(inputEstancia.focused, true);
  } finally {
    resetMocks();
  }
});

// Test v11: al activar los escuchas, el foco cae en el primer campo
test("v11: al activar los escuchas, el foco cae en el primer campo", async () => {
  setupMocks();
  try {
    const mod = await import("../scripts/convocatoria-app.mjs");
    const Clase = mod.crearClaseConvocatoriaV1({ onSubmit: () => {} });
    const app = new Clase();
    // Create a mock html object that mimics jQuery
    const inputEstancia = { focused: false, focus: () => { inputEstancia.focused = true; }, val: () => "" };
    const inputRol = { focused: false, focus: () => { inputRol.focused = true; }, val: () => "" };
    const button = { manejadores: [], on: (evento, manejador) => { if (evento === "click") button.manejadores.push(manejador); } };
    const formMock = {
      on: (evento, manejador) => {
        if (evento === "submit") formMock.submitListener = manejador;
      },
      find: (selector) => {
        if (selector === '[name="idEstancia"]') return inputEstancia;
        if (selector === '[name="rolConvocante"]') return inputRol;
        if (selector === "form") return formMock;
        return null;
      },
    };
    const html = {
      find: (selector) => {
        if (selector === "form") return formMock;
        if (selector === '[type="submit"]') return button;
        if (selector === '[name="idEstancia"]') return inputEstancia;
        if (selector === '[name="rolConvocante"]') return inputRol;
        return null;
      },
    };
    app.activateListeners(html);
    assert.equal(inputEstancia.focused, true);
  } finally {
    resetMocks();
  }
});

test("v12+: enviar el formulario llama al callback con los valores seleccionados", async () => {
  setupMocks();
  try {
    const mod = await import("../scripts/convocatoria-app.mjs");
    const enviadas = [];
    const Clase = mod.crearClaseConvocatoriaV2({ onSubmit: (data) => enviadas.push(data) });
    const app = new Clase();
    // Prepare context mock
    const contextoMock = { estancias: [{ id: "playa" }, { id: "museo" }], roles: [{ id: "GM" }, { id: "Jugador" }] };
    app._prepareContext = async () => contextoMock;
    // Create a mock element that mimics the DOM structure
    const inputEstancia = { value: "" };
    const inputRol = { value: "" };
    const form = {
      querySelector: (selector) => {
        if (selector === '[name="idEstancia"]') return inputEstancia;
        if (selector === '[name="rolConvocante"]') return inputRol;
        if (selector === "form") return form; // form matches itself
        return null;
      },
      addEventListener: (event, listener) => {
        if (event === "submit") form.submitListener = listener;
      },
    };
    app.element = {
      querySelector: (selector) => form.querySelector(selector),
    };
    // Set values
    inputEstancia.value = "playa";
    inputRol.value = "Jugador";
    // Trigger submit event
    const event = { preventDefault: () => {} };
    form.submitListener(event);
    assert.deepEqual(enviadas, [{ idEstancia: "playa", rolConvocante: "Jugador" }]);
  } finally {
    resetMocks();
  }
});

test("v11: enviar el formulario llama al callback con los valores seleccionados", async () => {
  setupMocks();
  try {
    const mod = await import("../scripts/convocatoria-app.mjs");
    const enviadas = [];
    const Clase = mod.crearClaseConvocatoriaV1({ onSubmit: (data) => enviadas.push(data) });
    const app = new Clase();
    // Prepare context mock
    const contextoMock = { estancias: [{ id: "playa" }, { id: "museo" }], roles: [{ id: "GM" }, { id: "Jugador" }] };
    app.getData = async () => contextoMock;
    // Create a mock html object that mimics jQuery
    const inputEstancia = { _value: "", val: (v) => { if (v !== undefined) inputEstancia._value = v; return inputEstancia._value; } };
    const inputRol = { _value: "", val: (v) => { if (v !== undefined) inputRol._value = v; return inputRol._value; } };
    const button = { manejadores: [], on: (evento, manejador) => { if (evento === "click") button.manejadores.push(manejador); } };
    const formMock = {
      on: (evento, manejador) => {
        if (evento === "submit") formMock.submitListener = manejador;
      },
      find: (selector) => {
        if (selector === '[name="idEstancia"]') return inputEstancia;
        if (selector === '[name="rolConvocante"]') return inputRol;
        if (selector === "form") return formMock;
        return null;
      },
    };
    const html = {
      find: (selector) => {
        if (selector === "form") return formMock;
        if (selector === '[type="submit"]') return button;
        if (selector === '[name="idEstancia"]') return inputEstancia;
        if (selector === '[name="rolConvocante"]') return inputRol;
        return null;
      },
    };
    app.activateListeners(html);
    // Trigger submit event
    const event = { preventDefault: () => {} };
    formMock.submitListener(event);
    assert.deepEqual(enviadas, [{ idEstancia: "playa", rolConvocante: "Jugador" }]);
  } finally {
    resetMocks();
  }
});

test("sin DOM, renderizar no revienta: no hay nada que enfocar", async () => {
  setupMocks();
  try {
    const mod = await import("../scripts/convocatoria-app.mjs");
    const Clase = mod.crearClaseConvocatoriaV2({ onSubmit: () => {} });
    const app = new Clase();
    assert.doesNotThrow(() => app._onRender({}, {}));
  } finally {
    resetMocks();
  }
});

test("v11: defaultOptions returns minimal options", async () => {
  setupMocks();
  try {
    const mod = await import("../scripts/convocatoria-app.mjs");
    const Clase = mod.crearClaseConvocatoriaV1({ onSubmit: () => {} });
    const opts = Clase.defaultOptions;
    assert.equal(opts.id, "lagunak-convocatoria");
    assert.deepEqual(opts.classes, ["lagunak-convocatoria"]);
    assert.equal(opts.title, game.i18n.localize("LAGUNAK.PanelGM.Entrada.Convocatoria"));
    assert.equal(opts.template, "modules/lagunak/templates/convocatoria.hbs");
    assert.equal(opts.width, 300);
    assert.equal(opts.height, "auto");
  } finally {
    resetMocks();
  }
});

test("v12: _prepareContext returns context con estancias y roles", async () => {
  setupMocks();
  try {
    // Mockear el import de "./nave-catalogo-andar.mjs"
    const mockCatalog = {
      playa: {},
      museo: {},
    };
    // Sobrescribimos el import global para este módulo
    const originalImport = globalThis.import;
    globalThis.import = async (modulePath) => {
      if (modulePath.endsWith("./nave-catalogo-andar.mjs")) {
        return { CATALOGO_ANDAR: mockCatalog };
      }
      return originalImport(modulePath);
    };
    // Now import the module after setting up the mock for nave-catalogo-andar.mjs
    const mod = await import("../scripts/convocatoria-app.mjs");
    const Clase = mod.crearClaseConvocatoriaV2({ onSubmit: () => {} });
    const app = new Clase();
    const contexto = await app._prepareContext();
    assert.deepEqual(contexto.estancias, [
      { id: "playa" },
      { id: "museo" },
    ]);
    assert.deepEqual(contexto.roles, [
      { id: "GM" },
      { id: "Jugador" },
    ]);
    // Restaurar el import original
    globalThis.import = originalImport;
  } finally {
    resetMocks();
  }
});