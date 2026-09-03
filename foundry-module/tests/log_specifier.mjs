// Test to see what specifier is used for convocatoria-estancia.mjs
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

test("log import specifier for convocatoria-estancia.mjs", async () => {
  setupMocks();
  // Save the original import
  const originalImport = globalThis.import;
  // Mock the global import function to log all imports
  globalThis.import = async (specifier) => {
    console.error(`[IMPORT LOG] specifier: ${specifier}`);
    // Normalize specifier: remove query string and hash
    const normalized = specifier.split('?')[0].split('#')[0];
    if (normalized.endsWith("convocatoria-estancia.mjs")) {
      console.error('[IMPORT LOG] This is convocatoria-estancia.mjs!');
    }
    return originalImport(specifier);
  };

  // Load the main module with a query string to bust its cache
  const mainModule = await import(`../scripts/main.mjs?${Date.now()}`);

  // We don't need to call the function, just see if the import log appears
  // But we can call it to trigger the dynamic import
  await mainModule.manejarConvocatoria({ idEstancia: "playa", rolConvocante: "GM" });

  // Restore the original import
  globalThis.import = originalImport;
  delete globalThis.__originalImport;
  resetMocks();
});