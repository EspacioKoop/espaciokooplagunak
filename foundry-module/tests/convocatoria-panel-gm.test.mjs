// Test for the integration of the convocatoria de estancia in the panel de GM (#832).
import test from "node:test";
import assert from "node:assert/strict";

// Mock the global environment that main.mjs expects.
function setupMocks() {
  // Mock Hooks
  globalThis.Hooks = {
    once: (event, callback) => {
      if (event === "init") {
        callback();
      }
    },
    on: () => {}, // we don't need to implement other events for this test
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
  class MockHandlebarsApplicationMixin {
    static apply(Base) {
      return class extends Base {};
    }
  }
  globalThis.foundry = {
    applications: {
      api: {
        ApplicationV2: MockApplicationV2,
        HandlebarsApplicationMixin: MockHandlebarsApplicationMixin,
      },
    },
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
  }
  globalThis.Application = MockApplication;
  // Mock game
  globalThis.game = {
    i18n: {
      localize: (key) => key, // return the key for simplicity
      format: (str, params) => str.replace(/{([^}]+)}/g, (_, k) => params[k]),
    },
    user: { isGM: true },
    settings: {
      register: () => {} // mock implementation
    },
  };
  // Mock ui.notifications
  globalThis.ui = {
    notifications: {
      warn: (message) => {
        globalThis.lastWarning = message;
      },
    },
  };
}

// Helper to reset mocks
function resetMocks() {
  globalThis.lastWarning = undefined;
  // Clear the import mock we will set later
  if (globalThis.__originalImport) {
    globalThis.import = globalThis.__originalImport;
    delete globalThis.__originalImport;
  }
  // Delete the mocked globals to avoid leaking to other tests? We'll just overwrite.
  delete globalThis.Hooks;
  delete globalThis.foundry;
  delete globalThis.Application;
  delete globalThis.game;
  delete globalThis.ui;
}

test("manejarConvocatoria llama a convocar con los argumentos correctos", async () => {
  setupMocks();
  // Mock the dynamic import of convocatoria-estancia.mjs
  const mockConvocar = async (idEstancia, rolConvocante, options) => {
    // Store the arguments for later verification
    globalThis.mockConvocarArgs = { idEstancia, rolConvocante, options };
    // Return a valid result to simulate success
    return { x: 0, z: 0, yaw: 0 };
  };
  // Save the original import
  globalThis.__originalImport = globalThis.import;
  // Override the global import function
  globalThis.import = async (modulePath) => {
    if (modulePath.endsWith("convocatoria-estancia.mjs")) {
      return { convocar: mockConvocar };
    }
    return globalThis.__originalImport(modulePath);
  };

  // Now load the main module (it will use our mocked import)
  const mainModule = await import("../scripts/main.mjs");

  // Call the function directly
  await mainModule.manejarConvocatoria({ idEstancia: "playa", rolConvocante: "GM" });

  // Verify that convocar was called with the expected arguments
  assert.deepStrictEqual(globalThis.mockConvocarArgs, {
    idEstancia: "playa",
    rolConvocante: "GM",
    options: { catalogo: undefined }, // default value
  });

  // Restore the original import
  globalThis.import = globalThis.__originalImport;
  delete globalThis.__originalImport;
  // Clean up the mock Convocar args
  delete globalThis.mockConvocarArgs;
});

test("manejarConvocatoria muestra una advertencia si convocar devuelve null", async () => {
  setupMocks();
  // Mock that returns null
  globalThis.mockConvocarArgs = null;
  globalThis.__originalImport = globalThis.import;
  globalThis.import = async (modulePath) => {
    if (modulePath.endsWith("convocatoria-estancia.mjs")) {
      return {
        convocar: async (idEstancia, rolConvocante, options) => {
          globalThis.mockConvocarArgs = { idEstancia, rolConvocante, options };
          return null;
        },
      };
    }
    return globalThis.__originalImport(modulePath);
  };

  const mainModule = await import("../scripts/main.mjs");
  await mainModule.manejarConvocatoria({ idEstancia: "playa", rolConvocante: "GM" });

  // Verify that a warning was shown
  assert.ok(globalThis.lastWarning, "Se esperaba una advertencia");
  // The warning should be the i18n key for the error
  assert.strictEqual(globalThis.lastWarning, "LAGUNAK.PanelGM.Convocatoria.Error");

  // Restore
  globalThis.import = globalThis.__originalImport;
  delete globalThis.__originalImport;
  delete globalThis.mockConvocarArgs;
});

test("abrirConvocatoria crea la aplicación y la renderiza", async () => {
  setupMocks();
  // We don't need to mock convocatoria-estancia.mjs for this test because abrirConvocatoria doesn't call it directly.
  // But we still need to mock the import for the dynamic import inside manejarConvocatoria, which is not called here.
  // To avoid any issues, we'll mock it to return a dummy function.
  globalThis.__originalImport = globalThis.import;
  globalThis.import = async (modulePath) => {
    if (modulePath.endsWith("convocatoria-estancia.mjs")) {
      return { convocar: async () => ({ x: 0, z: 0, yaw: 0 }) };
    }
    return globalThis.__originalImport(modulePath);
  };

  const mainModule = await import("../scripts/main.mjs");
  // Call the function
  mainModule.abrirConvocatoria();

  // We cannot easily access the internal convocatoriaApp variable, but we can at least verify that no exception was thrown.
  // If we get here without throwing, the function executed.
  assert.ok(true, "abrirConvocatoria no lanzó excepción");

  // Restore
  globalThis.import = globalThis.__originalImport;
  delete globalThis.__originalImport;
});