/* Ventana del panel de GM (#448): accesibilidad de teclado y ruta de
 * selección. Mismo arnés que `cantina-app.test.mjs`: las dos clases son
 * hermanas y aisladas a propósito (v11 clásica, v12+ ApplicationV2). */

import assert from "node:assert/strict";
import test from "node:test";

import { crearClasePanelGMV1, crearClasePanelGMV2 } from "../scripts/panel-gm-app.mjs";
import { entradasPanelGM } from "../scripts/panel-gm.mjs";

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

/** Raíz de mentira con las entradas dadas, en orden. */
function raizFalsa(...ids) {
  const botones = ids.map(botonFalso);
  return {
    botones,
    querySelector: (_sel) => botones[0],
    querySelectorAll: (_sel) => botones,
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

test("v12+: al renderizar, el foco cae en la primera entrada", () => {
  prepararEntorno({ moderno: true });
  const Clase = crearClasePanelGMV2({ alSeleccionar: () => {} });
  const app = new Clase();
  const raiz = raizFalsa("estado", "mapa");
  app.element = raiz;

  app._onRender({}, {});

  assert.equal(raiz.botones[0].enfocado, 1);
  assert.equal(raiz.botones[1].enfocado, 0);
});

test("v11: al activar los escuchas, el foco cae en la primera entrada", () => {
  prepararEntorno({ moderno: false });
  const Clase = crearClasePanelGMV1({ alSeleccionar: () => {} });
  const app = new Clase();
  const raiz = raizFalsa("estado", "mapa");
  const html = { 0: raiz, find: () => ({ on: () => {} }) };

  app.activateListeners(html);

  assert.equal(raiz.botones[0].enfocado, 1);
});

test("v12+: pulsar una entrada la selecciona y cierra el panel", () => {
  prepararEntorno({ moderno: true });
  const elegidas = [];
  const Clase = crearClasePanelGMV2({ alSeleccionar: (id) => elegidas.push(id) });
  const app = new Clase();
  const raiz = raizFalsa("estado", "ficha");
  app.element = raiz;

  app._onRender({}, {});
  raiz.botones[1].manejadores.forEach((manejador) => manejador());

  assert.deepEqual(elegidas, ["ficha"]);
  assert.equal(app.cerrada, true);
});

test("v11: pulsar una entrada la selecciona y cierra el panel", () => {
  prepararEntorno({ moderno: false });
  const elegidas = [];
  const Clase = crearClasePanelGMV1({ alSeleccionar: (id) => elegidas.push(id) });
  const app = new Clase();
  const raiz = raizFalsa("estado", "ficha");
  let manejadorClick = null;
  const html = {
    0: raiz,
    find: () => ({
      on: (_evento, manejador) => {
        manejadorClick = manejador;
      },
    }),
  };

  app.activateListeners(html);
  manejadorClick({ currentTarget: raiz.botones[1] });

  assert.deepEqual(elegidas, ["ficha"]);
  assert.equal(app.cerrada, true);
});

test("sin DOM, renderizar no revienta: no hay nada que enfocar", () => {
  prepararEntorno({ moderno: true });
  const Clase = crearClasePanelGMV2({ alSeleccionar: () => {} });
  const app = new Clase();

  assert.doesNotThrow(() => app._onRender({}, {}));
});

// Test defaultOptions minimal properties for v11 class
test("v11: defaultOptions returns minimal options", () => {
  prepararEntorno({ moderno: false });
  const Clase = crearClasePanelGMV1({ alSeleccionar: () => {} });
  const opts = Clase.defaultOptions;
  assert.equal(opts.id, "lagunak-panel-gm");
  assert.deepEqual(opts.classes, ["lagunak-panel-gm"]);
  assert.equal(opts.title, game.i18n.localize("LAGUNAK.PanelGM.Titulo"));
  assert.equal(opts.width, 420);
  assert.equal(opts.height, "auto");
});

// Verify that _prepareContext returns same context as generic contexto
test("v12: _prepareContext returns context same as generic", async () => {
  prepararEntorno({ moderno: true });
  const Clase = crearClasePanelGMV2({ alSeleccionar: () => {} });
  const instancia = new Clase();
  const ctxActual = await instancia._prepareContext();
  const ctxEsperado = {
    entradas: entradasPanelGM().map((entrada) => ({
      id: entrada.id,
      icono: entrada.icono,
      titulo: game.i18n.localize(entrada.tituloClave),
    })),
  };
  assert.deepEqual(ctxActual, ctxEsperado);
});
