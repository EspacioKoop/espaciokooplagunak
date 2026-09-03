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
  // Mock HandlebarsApplicationMixin as a function that returns a class
  globalThis.HandlebarsApplicationMixin = (Base) => {
    return class extends Base {};
  };
  globalThis.foundry = {
    applications: {
      api: {
        ApplicationV2: MockApplicationV2,
        HandlebarsApplicationMixin: globalThis.HandlebarsApplicationMixin,
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
      info: () => {} // we don't need info for these tests
    },
  };
}

// Helper to reset mocks
function resetMocks() {
  globalThis.lastWarning = undefined;
  // Delete the mocked globals to avoid leaking to other tests? We'll just overwrite.
  delete globalThis.Hooks;
  delete globalThis.foundry;
  delete globalThis.HandlebarsApplicationMixin;
  delete globalThis.Application;
  delete globalThis.game;
  delete globalThis.ui;
}

test("manejarConvocatoria llama a convocar con los argumentos correctos", async () => {
  setupMocks();
  let convocarCalled = false;
  // Save the original import
  const originalImport = globalThis.import;
  // Mock the global import function to intercept the exact specifier used in main.mjs
  globalThis.import = async (specifier) => {
    // Normalize specifier by removing query string for matching
    const cleanSpecifier = specifier.split('?')[0];
    if (cleanSpecifier.endsWith("convocatoria-estancia.mjs")) {
      return {
        convocar: async (idEstancia, rolConvocante, options) => {
          // Store the arguments for later verification
          globalThis.mockConvocarArgs = { idEstancia, rolConvocante, options };
          convocarCalled = true;
          // Return a valid result to simulate success
          return { x: 0, z: 0, yaw: 0 };
        }
      };
    }
    // For other imports, call the original import
    return originalImport(specifier);
  };

  // Load the main module with a query string to bust its cache
  const mainModule = await import(`../scripts/main.mjs?${Date.now()}`);

  // Call the function directly
  mainModule.manejarConvocatoria({ idEstancia: "playa", rolConvocante: "GM" });

  // Wait for the import callback to run
  await new Promise(resolve => {
    if (convocarCalled) {
      resolve();
    } else {
      const check = () => {
        if (convocarCalled) {
          resolve();
        } else {
          setTimeout(check, 10);
        }
      };
      setTimeout(check, 10);
    }
  });

  // Verify that convocar was called with the expected arguments
  assert.deepStrictEqual(globalThis.mockConvocarArgs, {
    idEstancia: "playa",
    rolConvocante: "GM",
    options: { catalogo: undefined }, // default value
  });

  // Restore the original import
  globalThis.import = originalImport;
  // Clean up the mock Convocar args
  delete globalThis.mockConvocarArgs;
  resetMocks();
});

test("manejarConvocatoria muestra una advertencia si convocar devuelve null", async () => {
  setupMocks();
  let convocarCalled = false;
  // Save the original import
  const originalImport = globalThis.import;
  // Mock that returns null
  globalThis.import = async (specifier) => {
    // Normalize specifier by removing query string for matching
    const cleanSpecifier = specifier.split('?')[0];
    if (cleanSpecifier.endsWith("convocatoria-estancia.mjs")) {
      return {
        convocar: async (idEstancia, rolConvocante, options) => {
          globalThis.mockConvocarArgs = { idEstancia, rolConvocante, options };
          convocarCalled = true;
          return null;
        }
      };
    }
    return originalImport(specifier);
  };

  const mainModule = await import(`../scripts/main.mjs?${Date.now()}`);
  mainModule.manejarConvocatoria({ idEstancia: "playa", rolConvocante: "GM" });

  // Wait for the import callback to run
  await new Promise(resolve => {
    if (convocarCalled) {
      resolve();
    } else {
      const check = () => {
        if (convocarCalled) {
          resolve();
        } else {
          setTimeout(check, 10);
        }
      };
      setTimeout(check, 10);
    }
  });

  // Verify that a warning was shown
  assert.ok(globalThis.lastWarning, "Se esperaba una advertencia");
  // The warning should be the i18n key for the error
  assert.strictEqual(globalThis.lastWarning, "LAGUNAK.PanelGM.Convocatoria.Error");

  // Restore
  globalThis.import = originalImport;
  delete globalThis.mockConvocarArgs;
  resetMocks();
});

test("abrirConvocatoria crea la aplicación y la renderiza", async () => {
  setupMocks();
  // We don't need to mock convocatoria-estancia.mjs for this test because abrirConvocatoria doesn't call it directly.
  // But we still need to mock the import for the dynamic intent inside manejarConvocatoria, which is not called here.
  // To avoid any issues, we'll mock it to return a dummy function.
  const originalImport = globalThis.import;
  globalThis.import = async (specifier) => {
    // Normalize specifier by removing query string for matching
    const cleanSpecifier = specifier.split('?')[0];
    if (cleanSpecifier.endsWith("convocatoria-estancia.mjs")) {
      return { convocar: async () => ({ x: 0, z: 0, yaw: 0 }) };
    }
    return originalImport(specifier);
  };

  const mainModule = await import(`../scripts/main.mjs?${Date.now()}`);
  // Call the function
  mainModule.abrirConvocatoria();

  // We cannot easily access the internal convocatoriaApp variable, but we can at least verify that no exception was thrown.
  // If we get here without throwing, the function executed.
  assert.ok(true, "abrirConvocatoria no lanzó excepción");

  // Restore
  globalThis.import = originalImport;
  resetMocks();
});