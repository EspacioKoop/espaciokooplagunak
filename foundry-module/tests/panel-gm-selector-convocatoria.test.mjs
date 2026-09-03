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

/**
 * Test double for convocar that records the arguments it was called with.
 */
class TestConvocar {
  constructor() {
    this.lastCall = null;
  }
  convocar(idEstancia, rolConvocante, opciones) {
    this.lastCall = { idEstancia, rolConvocante, opciones };
    // Return a dummy value so the app doesn't break
    return { x: 0, z: 0, yaw: 0 };
  }
}

test("panel-gm app passes correct arguments to convocar for playa estancia", async () => {
  prepararEntorno({ moderno: true });
  const testConvocar = new TestConvocar();
  // Mock acciones that call our test convocar for playa and museo
  const mockAcciones = {
    playa: () => testConvocar.convocar("playa", "GM"),
    museo: () => testConvocar.convocar("museo", "GM"),
  };
  const Clase = crearClasePanelGMV2({ alSeleccionar: (id) => mockAcciones[id]?.() });
  const app = new Clase();
  const raiz = raizFalsa("playa", "museo"); // We only need the entries we are testing
  app.element = raiz;

  app._onRender({}, {});
  // Click on the playa entry
  raiz.botones[0].manejadores.forEach((manejador) => manejador());

  assert.deepEqual(testConvocar.lastCall, {
    idEstancia: "playa",
    rolConvocante: "GM",
    opciones: undefined,
  });
});

test("panel-gm app passes correct arguments to convocar for museo estancia", async () => {
  prepararEntorno({ moderno: true });
  const testConvocar = new TestConvocar();
  const mockAcciones = {
    playa: () => testConvocar.convocar("playa", "GM"),
    museo: () => testConvocar.convocar("museo", "GM"),
  };
  const Clase = crearClasePanelGMV2({ alSeleccionar: (id) => mockAcciones[id]?.() });
  const app = new Clase();
  const raiz = raizFalsa("playa", "museo");
  app.element = raiz;

  app._onRender({}, {});
  // Click on the museo entry
  raiz.botones[1].manejadores.forEach((manejador) => manejador());

  assert.deepEqual(testConvocar.lastCall, {
    idEstancia: "museo",
    rolConvocante: "GM",
    opciones: undefined,
  });
});

// Also test v1 for completeness
test("panel-gm v1 app passes correct arguments to convocar for playa estancia", async () => {
  prepararEntorno({ moderno: false });
  const testConvocar = new TestConvocar();
  const mockAcciones = {
    playa: () => testConvocar.convocar("playa", "GM"),
    museo: () => testConvocar.convocar("museo", "GM"),
  };
  const Clase = crearClasePanelGMV1({ alSeleccionar: (id) => mockAcciones[id]?.() });
  const app = new Clase();
  const raiz = raizFalsa("playa", "museo");
  let manejadorClick = null;
  const html = {
    0: raiz,
    find: () => ({
      on: (_evento, manejador) => {
        manejadorClick = manejador;
      }
    })
  };

  app.activateListeners(html);
  // Click on the playa entry
  manejadorClick({ currentTarget: raiz.botones[0] });

  assert.deepEqual(testConvocar.lastCall, {
    idEstancia: "playa",
    rolConvocante: "GM",
    opciones: undefined,
  });
});

test("panel-gm v1 app passes correct arguments to convocar for museo estancia", async () => {
  prepararEntorno({ moderno: false });
  const testConvocar = new TestConvocar();
  const mockAcciones = {
    playa: () => testConvocar.convocar("playa", "GM"),
    museo: () => testConvocar.convocar("museo", "GM"),
  };
  const Clase = crearClasePanelGMV1({ alSeleccionar: (id) => mockAcciones[id]?.() });
  const app = new Clase();
  const raiz = raizFalsa("playa", "museo");
  let manejadorClick = null;
  const html = {
    0: raiz,
    find: () => ({
      on: (_evento, manejador) => {
        manejadorClick = manejador;
      }
    })
  };

  app.activateListeners(html);
  // Click on the museo entry
  manejadorClick({ currentTarget: raiz.botones[1] });

  assert.deepEqual(testConvocar.lastCall, {
    idEstancia: "museo",
    rolConvocante: "GM",
    opciones: undefined,
  });
});