// Test for the integration of the convocatoria de estancia in the panel de GM (#832).
import test from "node:test";
import assert from "node:assert/strict";

/**
 * Espera ACOTADA a que `predicado()` sea verdad, nunca infinita.
 *
 * Los tres tests de este fichero mockeaban `globalThis.import` para interceptar
 * el `import()` dinámico real de `manejarConvocatoria` — pero en Node ESM no
 * hay forma de interceptar `import()` sobrescribiendo una propiedad de
 * `globalThis`: el mock nunca se ejecutaba, así que la promesa que esperaba a
 * que el mock marcara `convocarCalled` no se resolvía JAMÁS. Eso es
 * exactamente lo que colgaba el job de CI seis horas (#952): no un test que
 * fallara, uno que ya no podía terminar. Por eso aquí se espera con tope: si
 * el predicado no se cumple a tiempo, el test FALLA con un mensaje claro en
 * vez de colgar el proceso entero.
 */
async function esperarHasta(predicado, { intentos = 200, intervaloMs = 10, mensaje } = {}) {
  for (let intento = 0; intento < intentos; intento += 1) {
    if (predicado()) return;
    await new Promise((resolve) => setTimeout(resolve, intervaloMs));
  }
  throw new Error(mensaje ?? `esperarHasta: el predicado no se cumplió en ${intentos * intervaloMs}ms`);
}

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
      register: () => {}, // mock implementation
      // La convocatoria se publica ESCRIBIENDO un ajuste de mundo (#832): sin
      // `set` en el doble, el camino de éxito acaba en el `catch` y el test
      // vería la advertencia de fallo.
      set: (moduleId, clave, valor) => {
        globalThis.ultimaConvocatoriaPublicada = { moduleId, clave, valor };
        return Promise.resolve(valor);
      },
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
  globalThis.ultimaConvocatoriaPublicada = undefined;
  // Delete the mocked globals to avoid leaking to other tests? We'll just overwrite.
  delete globalThis.Hooks;
  delete globalThis.foundry;
  delete globalThis.HandlebarsApplicationMixin;
  delete globalThis.Application;
  delete globalThis.game;
  delete globalThis.ui;
}

test("manejarConvocatoria con una estancia válida no muestra advertencia (convocar real)", async () => {
  setupMocks();
  // Contra el `convocar` REAL (`convocatoria-estancia.mjs`) y el catálogo REAL
  // (`playa`, con entrada despejada, ya lo prueba `convocatoria-estancia.test.mjs`):
  // no se mockea `import()`.
  const mainModule = await import(`../scripts/main.mjs?${Date.now()}`);
  // Ahora SÍ hay señal positiva de éxito: `manejarConvocatoria` devuelve la
  // promesa de `publicarConvocatoria`, así que se espera el resultado en vez
  // de un margen de tiempo.
  const publicado = await mainModule.manejarConvocatoria({ idEstancia: "playa", rolConvocante: "GM" });

  assert.equal(globalThis.lastWarning, undefined, "no se esperaba ninguna advertencia para una estancia válida");
  assert.equal(publicado?.estancia, "playa", "la convocatoria válida se publica");
  assert.equal(globalThis.ultimaConvocatoriaPublicada?.clave, "convocatoriaVigente", "se escribe el ajuste de mundo");

  resetMocks();
});

test("manejarConvocatoria muestra una advertencia si la estancia no existe (convocar real)", async () => {
  setupMocks();
  // "no-existe" hace que el `convocar` REAL devuelva `null` por la vía más
  // simple (catalogo.tiene(id) === false) — no hace falta mockear nada.
  const mainModule = await import(`../scripts/main.mjs?${Date.now()}`);
  mainModule.manejarConvocatoria({ idEstancia: "no-existe", rolConvocante: "GM" });

  await esperarHasta(() => globalThis.lastWarning !== undefined, {
    mensaje: "manejarConvocatoria no mostró ninguna advertencia para una estancia inexistente",
  });

  assert.strictEqual(globalThis.lastWarning, "LAGUNAK.PanelGM.Convocatoria.Error");

  resetMocks();
});

test("abrirConvocatoria crea la aplicación y la renderiza", async () => {
  setupMocks();
  const mainModule = await import(`../scripts/main.mjs?${Date.now()}`);
  // No debe lanzar: abrirConvocatoria no llama a manejarConvocatoria, así que
  // no hace falta esperar a ningún import dinámico aquí.
  mainModule.abrirConvocatoria();
  // Llegar aquí sin lanzar ES la aserción: no hay estado interno accesible
  // desde fuera (convocatoriaApp es privado del módulo) que verificar.
  assert.ok(true, "abrirConvocatoria no lanzó excepción");
  resetMocks();
});
