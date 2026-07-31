/* Ventana de la cantina (#423): accesibilidad de teclado y ruta de selección.
 *
 * Las dos clases son hermanas y aisladas a propósito (v11 clásica, v12+
 * ApplicationV2), así que se ejercitan las dos por separado: un arreglo que
 * solo llegue a una de ellas debe fallar aquí, no en la mesa de juego.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { crearClaseCantinaV1, crearClaseCantinaV2 } from "../scripts/cantina-app.mjs";

/** Botón de mentira: registra los focos y los clics que recibe. */
function botonFalso(id) {
  const boton = {
    dataset: { puerta: id },
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

/** Raíz de mentira con las puertas dadas, en orden. */
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

test("v12+: al renderizar, el foco cae en la primera puerta", () => {
  prepararEntorno({ moderno: true });
  const Clase = crearClaseCantinaV2({ alSeleccionar: () => {} });
  const app = new Clase();
  const raiz = raizFalsa("poker", "dados");
  app.element = raiz;

  app._onRender({}, {});

  assert.equal(raiz.botones[0].enfocado, 1);
  assert.equal(raiz.botones[1].enfocado, 0);
});

test("v11: al activar los escuchas, el foco cae en la primera puerta", () => {
  prepararEntorno({ moderno: false });
  const Clase = crearClaseCantinaV1({ alSeleccionar: () => {} });
  const app = new Clase();
  const raiz = raizFalsa("poker", "dados");
  // jQuery de mentira: `find(...).on(...)` y el elemento real en [0].
  const html = { 0: raiz, find: () => ({ on: () => {} }) };

  app.activateListeners(html);

  assert.equal(raiz.botones[0].enfocado, 1);
});

// El clic y el teclado entran por el mismo sitio: los botones son `<button>`
// nativos, así que Enter y Espacio disparan el mismo evento "click". Si esto se
// convirtiera algún día en un `<div>` con manejador, este test seguiría pasando
// pero la sala dejaría de ser navegable — por eso el test de la plantilla.
test("v12+: pulsar una puerta la selecciona y cierra la sala", () => {
  prepararEntorno({ moderno: true });
  const elegidas = [];
  const Clase = crearClaseCantinaV2({ alSeleccionar: (id) => elegidas.push(id) });
  const app = new Clase();
  const raiz = raizFalsa("poker", "dados");
  app.element = raiz;

  app._onRender({}, {});
  raiz.botones[1].manejadores.forEach((manejador) => manejador());

  assert.deepEqual(elegidas, ["dados"]);
  assert.equal(app.cerrada, true);
});

test("sin DOM, renderizar no revienta: no hay nada que enfocar", () => {
  prepararEntorno({ moderno: true });
  const Clase = crearClaseCantinaV2({ alSeleccionar: () => {} });
  const app = new Clase();

  assert.doesNotThrow(() => app._onRender({}, {}));
});
