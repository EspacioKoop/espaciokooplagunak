/* Ventana de la cantina (#423): la puerta única de la que cuelgan las mesas
 * sociales. No decide autoridad ni estado — eso lo sigue haciendo cada mesa
 * por su cuenta cuando se abre. Esta ventana solo traduce un clic en "abre
 * esa mesa" y se cierra: la sala pinta, no decide.
 *
 * Dos clases hermanas, como el resto del módulo (`mesa-poker-app.mjs`):
 * `Application` clásica en v11 y `ApplicationV2` en v12+, sin código
 * compartido entre ellas a propósito.
 */

import { MODULE_ID } from "./lagunak-constantes.mjs";
import { puertasCantina } from "./cantina.mjs";

const PLANTILLA = `modules/${MODULE_ID}/templates/cantina.hbs`;

function contexto() {
  return {
    puertas: puertasCantina().map((puerta) => ({
      id: puerta.id,
      icono: puerta.icono,
      titulo: game.i18n.localize(puerta.tituloClave),
    })),
  };
}

/* Al abrir la sala, el foco va a la primera puerta. Quien navega con teclado no
 * tiene por qué recorrer el marco de la ventana para llegar a lo único que la
 * cantina ofrece; y quien usa ratón no nota nada, porque `:focus-visible` solo
 * pinta el anillo cuando el foco llegó por teclado. Sin DOM (arnés de pruebas)
 * no hay nada que enfocar y la función calla. */
function enfocarPrimeraPuerta(raiz) {
  raiz?.querySelector?.("[data-puerta]")?.focus?.();
}

/* ---- v12+ --------------------------------------------------------------- */

export function crearClaseCantinaV2({ alSeleccionar }) {
  const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

  return class CantinaAppV2 extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "lagunak-cantina",
      classes: ["lagunak-cantina"],
      window: { title: "LAGUNAK.Cantina.Titulo", icon: "fa-solid fa-mug-saucer" },
      position: { width: 360, height: "auto" },
    };

    static PARTS = { main: { template: PLANTILLA } };

    async _prepareContext(_options) {
      return contexto();
    }

    // Método propio y no un manejador anónimo: así el clic real y el test que
    // ejercita la decisión sin DOM (el arnés de `main-compat.test.mjs` no
    // simula clics dentro de una ventana) llaman a la misma ruta.
    seleccionarPuerta(id) {
      if (!id) return;
      alSeleccionar(id);
      this.close();
    }

    _onRender(context, options) {
      super._onRender?.(context, options);
      this.element?.querySelectorAll?.("[data-puerta]")?.forEach((boton) => {
        boton.addEventListener("click", () => this.seleccionarPuerta(boton.dataset.puerta));
      });
      enfocarPrimeraPuerta(this.element);
    }
  };
}

/* ---- v11 ---------------------------------------------------------------- */

export function crearClaseCantinaV1({ alSeleccionar }) {
  return class CantinaAppV1 extends Application {
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "lagunak-cantina",
        classes: ["lagunak-cantina"],
        title: game.i18n.localize("LAGUNAK.Cantina.Titulo"),
        template: PLANTILLA,
        width: 360,
        height: "auto",
      });
    }

    getData(_options) {
      return contexto();
    }

    seleccionarPuerta(id) {
      if (!id) return;
      alSeleccionar(id);
      this.close();
    }

    activateListeners(html) {
      super.activateListeners(html);
      html.find("[data-puerta]").on("click", (ev) => {
        this.seleccionarPuerta(ev.currentTarget?.dataset?.puerta);
      });
      // En v11 `html` es jQuery: el elemento real está en [0].
      enfocarPrimeraPuerta(html?.[0]);
    }
  };
}
