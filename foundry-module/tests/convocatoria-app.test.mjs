import assert from "node:assert/strict";
import test from "node:test";
import { crearClaseConvocatoriaV1, crearClaseConvocatoriaV2 } from "../scripts/convocatoria-app.mjs";

/** Botón de mentira: registra los focos y los clics que recibe. */
function botonFalso(id) {
  const boton = {
    dataset: { entrada: id },
    enfocado: 0,
    manejadores: [],
    focus() {
      this.enfocado += 1;
    },
    addEventListener(_evento, manejador) {
      this.manejadores.push(manejador);
    },
  };
  return boton;
}

/** Select de mentira: tiene un valor y un método focus. */
function selectFalso(name, valorInicial = "") {
  let valor = valorInicial;
  let enfocado = false;
  return {
    name,
    focus() {
      enfocado = true;
    },
    // Simulamos el método val de jQuery: si no se pasa argumento, devuelve el valor; si se pasa, lo establece.
    val(nuevoValor) {
      if (nuevoValor === undefined) {
        return valor;
      }
      valor = nuevoValor;
      return this; // para encadenamiento, aunque no lo usamos
    },
  };
}

/** Formulario de mentira: contiene selects y un botón, y maneja el evento submit mediante un manejador de click en el botón. */
function formFalso() {
  const selectEstancia = selectFalso("idEstancia");
  const selectRol = selectFalso("rolConvocante");
  const boton = botonFalso("submit");
  const form = {
    // Simulamos el método find de jQuery: devuelve el elemento con el name dado.
    find(selector) {
      if (selector === '[name="idEstancia"]') return selectEstancia;
      if (selector === '[name="rolConvocante"]') return selectRol;
      if (selector === '[type="submit"]') return boton;
      return null;
    },
    // Para que el test pueda disparar el evento de submit mediante el botón.
    // En la aplicación real, el botón tiene un event listener de click.
    // Vamos a exponer el botón para que el test pueda llamar a su manejador de click.
    boton,
  };
  return { form, selectEstancia, selectRol, boton };
}

/** Raíz de mentira con el formulario dado. */
function raizFalsaConFormulario() {
  const { form } = formFalso();
  return {
    // Simulamos el método querySelector: devuelve el form si se busca "form", o el elemento dentro del form si se busca un selector específico.
    querySelector(selector) {
      if (selector === "form") return form;
      return form.find(selector);
    },
    // Simulamos el método querySelectorAll: devuelve un array con el form si se busca "form", o los elementos dentro del form si se busca un selector específico.
    querySelectorAll(selector) {
      if (selector === "form") return [form];
      const elem = form.find(selector);
      return elem ? [elem] : [];
    },
  };
}

function prepararEntorno({ moderno }) {
  class BaseApplication {
    constructor() {
      this.cerrada = false;
    }
    close() {
      this.cerrada = true;
    }
    static get defaultOptions() {
      return {};
    }
    activateListeners() {}
  }

  globalThis.Application = BaseApplication;
  globalThis.foundry = {
    utils: { mergeObject: (base, extra) => ({ ...base, ...extra }) },
  };
  if (moderno) {
    class ApplicationV2 extends BaseApplication {}
    globalThis.foundry.applications = {
      api: { ApplicationV2, HandlebarsApplicationMixin: (Base) => Base },
    };
  }
  globalThis.game = { i18n: { localize: (clave) => clave } };
}

test("v12+: al renderizar, el foco cae en el primer campo", () => {
  prepararEntorno({ moderno: true });
  const Clase = crearClaseConvocatoriaV2({ onSubmit: () => {} });
  const app = new Clase();
  const raiz = raizFalsaConFormulario();
  app.element = raiz;
  app._onRender({}, {});
  // El primer campo es el select de idEstancia
  assert.equal(raiz.querySelector('[name="idEstancia"]').enfocado, true);
});

test("v11: al activar los escuchas, el foco cae en el primer campo", () => {
  prepararEntorno({ moderno: false });
  const Clase = crearClaseConvocatoriaV1({ onSubmit: () => {} });
  const app = new Clase();
  const raiz = raizFalsaConFormulario();
  const html = {
    0: raiz,
    // Simulamos el método find de jQuery: devuelve un objeto con un método on para escuchar eventos.
    find(selector) {
      const elem = raiz.querySelector(selector);
      if (!elem) {
        // Devolvemos un objeto vacío que no hace nada al llamar a on.
        return { on() {} };
      }
      // Para los selects, necesitamos que tengan un método val y focus.
      // Pero nuestro raiz.querySelector ya devuelve el select falso que tiene esos métodos.
      // Sin embargo, en la aplicación real, el find devuelve un objeto jQuery que tiene métodos como val y focus.
      // Vamos a envolver el elem en un objeto que tenga los métodos que necesita la aplicación.
      if (elem.name) {
        // Es un select
        return {
          val(nuevoValor) {
            if (nuevoValor === undefined) {
              return elem.val();
            }
            elem.val(nuevoValor);
            return this; // para encadenamiento
          },
          focus() {
            elem.focus();
            return this;
          },
        };
      }
      // Para el botón, necesitamos que tenga un método on para escuchar el click.
      if (elem === botonFalso) {
        // En nuestro caso, el botonFalso ya tiene un método on? No, tiene addEventListener.
        // La aplicación real usa html.find(...).on("click", ...).
        // Vamos a devolver un objeto que tenga un método on que registre el manejador.
        return {
          on(evento, manejador) {
            if (evento === "click") {
              elem.manejadores.push(manejador);
            }
            return this;
          },
        };
      }
      // Para cualquier otro elemento, devolvemos el elem mismo (que debería ser el form).
      return elem;
    },
  };
  const boton = html.find('[type="submit"]');
  app.activateListeners(html);
  assert.equal(raiz.querySelector('[name="idEstancia"]').enfocado, true);
});

test("v12+: enviar el formulario llama al callback con los valores seleccionados", () => {
  prepararEntorno({ moderno: true });
  const enviadas = [];
  const Clase = crearClaseConvocatoriaV2({ onSubmit: (data) => enviadas.push(data) });
  const app = new Clase();
  // Mockear el contexto para que devuelva algunas estancias y roles
  const contextoMock = {
    estancias: [{ id: "playa" }, { id: "museo" }],
    roles: [{ id: "GM" }, { id: "Jugador" }],
  };
  app._prepareContext = async () => contextoMock;
  const raiz = raizFalsaConFormulario();
  app.element = raiz;
  return app._onRender({}, {}).then(() => {
    const { selectEstancia, selectRol, boton } = formFalso();
    selectEstancia.val("playa");
    selectRol.val("Jugador");
    // Disparar el evento de click en el botón
    boton.manejadores.forEach((manejador) => manejador());
    assert.deepEqual(enviadas, [{ idEstancia: "playa", rolConvocante: "Jugador" }]);
  });
});

test("v11: enviar el formulario llama al callback con los valores seleccionados", () => {
  prepararEntorno({ moderno: false });
  const enviadas = [];
  const Clase = crearClaseConvocatoriaV1({ onSubmit: (data) => enviadas.push(data) });
  const app = new Clase();
  const contextoMock = {
    estancias: [{ id: "playa" }, { id: "museo" }],
    roles: [{ id: "GM" }, { id: "Jugador" }],
  };
  app.getData = async () => contextoMock;
  const raiz = raizFalsaConFormulario();
  const html = {
    0: raiz,
    find(selector) {
      const elem = raiz.querySelector(selector);
      if (!elem) {
        return { on() {} };
      }
      if (elem.name) {
        return {
          val(nuevoValor) {
            if (nuevoValor === undefined) {
              return elem.val();
            }
            elem.val(nuevoValor);
            return this;
          },
          focus() {
            elem.focus();
            return this;
          },
        };
      }
      if (elem === botonFalso) {
        return {
          on(evento, manejador) {
            if (evento === "click") {
              elem.manejadores.push(manejador);
            }
            return this;
          },
        };
      }
      return elem;
    },
  };
  app.activateListeners(html);
  return Promise.resolve().then(() => {
    const { selectEstancia, selectRol, boton } = formFalso();
    selectEstancia.val("playa");
    selectRol.val("Jugador");
    boton.manejadores.forEach((manejador) => manejador());
    assert.deepEqual(enviadas, [{ idEstancia: "playa", rolConvocante: "Jugador" }]);
  });
});

test("sin DOM, renderizar no revienta: no hay nada que enfocar", () => {
  prepararEntorno({ moderno: true });
  const Clase = crearClaseConvocatoriaV2({ onSubmit: () => {} });
  const app = new Clase();
  assert.doesNotThrow(() => app._onRender({}, {}));
});

test("v11: defaultOptions returns minimal options", () => {
  prepararEntorno({ moderno: false });
  const Clase = crearClaseConvocatoriaV1({ onSubmit: () => {} });
  const opts = Clase.defaultOptions;
  assert.equal(opts.id, "lagunak-convocatoria");
  assert.deepEqual(opts.classes, ["lagunak-convocatoria"]);
  assert.equal(opts.title, game.i18n.localize("LAGUNAK.PanelGM.Entrada.Convocatoria"));
  assert.equal(opts.template, "modules/lagunak/templates/convocatoria.hbs");
  assert.equal(opts.width, 300);
  assert.equal(opts.height, "auto");
});

test("v12: _prepareContext returns context with estancias and roles", async () => {
  prepararEntorno({ moderno: true });
  // Mockear el import de "./nave-catalogo-andar.mjs"
  const mockCatalog = {
    playa: {},
    museo: {},
  };
  // Sobrescribimos el import global para este módulo
  const originalImport = globalThis.import;
  globalThis.import = async (modulePath) => {
    if (modulePath.endsWith("nave-catalogo-andar.mjs")) {
      return { CATALOGO_ANDAR: mockCatalog };
    }
    return originalImport(modulePath);
  };
  // Ahora requerir el módulo (pero ya lo hemos requerido al inicio del archivo)
  // Necesitamos requerirlo de nuevo dentro del test para que use el mock.
  // Eliminamos de la caché y volvemos a requerir.
  delete require.cache[require.resolve("../scripts/convocatoria-app.mjs")];
  const { crearClaseConvocatoriaV2 } = require("../scripts/convocatoria-app.mjs");
  const Clase = crearClaseConvocatoriaV2({ onSubmit: () => {} });
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
});