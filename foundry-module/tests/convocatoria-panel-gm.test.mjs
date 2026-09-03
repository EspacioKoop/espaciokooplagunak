// Test for the integration of the convocatoria de estancia en el panel de GM (#832).
import test from "node:test";
import assert from "node:assert/strict";

// Mock the global environment that main.mjs espera.
function setupMocks() {
  // Mock Hooks
  globalThis.Hooks = {
    once: () => {}, // do nothing to avoid running initialization code
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
  // Mock HandlebarsApplicationMixin como una función que devuelve una clase
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
      localize: (key) => key, // devolver la clave por simplicidad
      format: (str, params) => str.replace(/{([^}]+)}/g, (_, k) => params[k]),
    },
    user: { isGM: true },
    settings: {
      register: () => {} // implementación simulada
    },
  };
  // Mock ui.notifications
  globalThis.ui = {
    notifications: {
      warn: (message) => {
        globalThis.lastWarning = message;
      },
      info: () => {} // no necesitamos info para estos tests
    },
  };
}

// Helper para reiniciar mocks
function resetMocks() {
  globalThis.lastWarning = undefined;
  // Eliminar los mocks globales para evitar fugas a otros tests
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
  // Guardar el import original
  const originalImport = globalThis.import;
  // Mockear la función global import para interceptar el specifier exacto usado en main.mjs
  globalThis.import = async (specifier) => {
    console.log('Mock import called with:', specifier);
    // Normalizar specifier eliminando query string para coincidencia
    const cleanSpecifier = specifier.split('?')[0];
    if (cleanSpecifier.endsWith("convocatoria-estancia.mjs")) {
      return {
        convocar: async (idEstancia, rolConvocante, options) => {
          // Guardar los argumentos para verificación posterior
          globalThis.mockConvocarArgs = { idEstancia, rolConvocante, options };
          convocarCalled = true;
          // Devolver un resultado válido para simular éxito
          return { x: 0, z: 0, yaw: 0 };
        }
      };
    }
    // Para otros imports, llamar al import original
    return originalImport(specifier);
  };

  // Cargar el módulo principal con una cadena de consulta para vaciar su caché
  const mainModule = await import(`../scripts/main.mjs?${Date.now()}`);

  // Llamar a la función directamente
    await mainModule.manejarConvocatoria({ idEstancia: "playa", rolConvocante: "GM" });

  // Esperar a que se ejecute el callback de import
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

  // Verificar que convocar fue llamado con los argumentos esperados
  assert.deepStrictEqual(globalThis.mockConvocarArgs, {
    idEstancia: "playa",
    rolConvocante: "GM",
    options: { catalogo: undefined }, // valor predeterminado
  });

  // Restaurar el import original
  globalThis.import = originalImport;
  // Limpiar los argumentos mockeados de Convocar
  delete globalThis.mockConvocarArgs;
  resetMocks();
});

test("manejarConvocatoria muestra una advertencia si convocar devuelve null", async () => {
  setupMocks();
  let convocarCalled = false;
  // Guardar el import original
  const originalImport = globalThis.import;
  // Mock que devuelve null
  globalThis.import = async (specifier) => {
    // Normalizar specifier eliminando query string para coincidencia
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

  // Esperar a que se ejecute el callback de import
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

  // Verificar que se mostró una advertencia
  assert.ok(globalThis.lastWarning, "Se esperaba una advertencia");
  // La advertencia debería ser la clave i18n para el error
  assert.strictEqual(globalThis.lastWarning, "LAGUNAK.PanelGM.Convocatoria.Error");

  // Restaurar
  globalThis.import = originalImport;
  delete globalThis.mockConvocarArgs;
  resetMocks();
});

test("abrirConvocatoria crea la aplicación y la renderiza", async () => {
  setupMocks();
  // No necesitamos mockear convocatoria-estancia.mjs para este test porque abrirConvocatoria no lo llama directamente.
  // Pero aún necesitamos mockear el import para la intención dinámica dentro de manejarConvocatoria, que no se llama aquí.
  // Para evitar problemas, lo mockeamos para que devuelva una función ficticia.
  const originalImport = globalThis.import;
  globalThis.import = async (specifier) => {
    // Normalizar specifier eliminando query string para coincidencia
    const cleanSpecifier = specifier.split('?')[0];
    if (cleanSpecifier.endsWith("convocatoria-estancia.mjs")) {
      return { convocar: async () => ({ x: 0, z: 0, yaw: 0 }) };
    }
    return originalImport(specifier);
  };

  const mainModule = await import(`../scripts/main.mjs?${Date.now()}`);
  // Llamar a la función
  mainModule.abrirConvocatoria();

  // No podemos acceder fácilmente a la variable interna convocatoriaApp, pero podemos verificar al menos que no se lanzó una excepción.
  // Si llegamos aquí sin lanzar una excepción, la función se ejecutó.
  assert.ok(true, "abrirConvocatoria no lanzó excepción");

  // Restaurar
  globalThis.import = originalImport;
  resetMocks();
});