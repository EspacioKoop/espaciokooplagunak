/* Ventana del selector de encuentros del parlamento: permite al GM elegir un encuentro del catálogo.
 * No decide qué hace cada entrada — eso lo sigue haciendo el llamador.
 */

/* globals game Hooks foundry */

import { MODULE_ID } from "./lagunak-constantes.mjs";
import { CATALOGO_ENCUENTROS_BASE } from "./catalogo-encuentros.mjs";

const PLANTILLA = `modules/${MODULE_ID}/templates/parlamento-selector.hbs`;

function contexto() {
  return {
    encuentros: CATALOGO_ENCUENTROS_BASE.encuentros.map((e) => ({
      id: e.id,
      tono: e.tono,
    })),
  };
}

/* Al abrir el selector, el foco va a la primera entrada. */
function enfocarPrimeraEntrada(raiz) {
  raiz?.querySelector?.("[data-encuentro]")?.focus?.();
}

/* ---- v12+ --------------------------------------------------------------- */
export function crearClaseParlamentoSelectorV2({ alSeleccionarEncuentro }) {
  const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

  return class ParlamentoSelectorAppV2 extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "lagunak-parlamento-selector",
      classes: ["lagunak-parlamento-selector"],
      window: { title: "LAGUNAK.SelectorParlamento.Titulo", icon: "fa-solid fa-comments" },
      position: { width: 420, height: "auto" },
    };

    static PARTS = { main: { template: PLANTILLA } };

    async _prepareContext(_options) {
      return contexto();
    }

    seleccionarEncuentro(id) {
      if (!id) return;
      const encuentro = CATALOGO_ENCUENTROS_BASE.buscar(id);
      if (encuentro) {
        alSeleccionarEncuentro(encuentro);
      }
      this.close();
    }

    _onRender(context, options) {
      super._onRender?.(context, options);
      this.element?.querySelectorAll?.("[data-encuentro]")?.forEach((boton) => {
        boton.addEventListener("click", () => this.seleccionarEncuentro(boton.dataset.encuentro));
      });
      enfocarPrimeraEntrada(this.element);
    }
  };
}

/* ---- v11 ---------------------------------------------------------------- */
export function crearClaseParlamentoSelectorV1({ alSeleccionarEncuentro }) {
  return class ParlamentoSelectorAppV1 extends Application {
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "lagunak-parlamento-selector",
        classes: ["lagunak-parlamento-selector"],
        title: game.i18n.localize("LAGUNAK.SelectorParlamento.Titulo"),
        template: PLANTILLA,
        width: 420,
        height: "auto",
      });
    }

    getData(_options) {
      return contexto();
    }

    seleccionarEncuentro(id) {
      if (!id) return;
      const encuentro = CATALOGO_ENCUENTROS_BASE.buscar(id);
      if (encuentro) {
        alSeleccionarEncuentro(encuentro);
      }
      this.close();
    }

    activateListeners(html) {
      super.activateListeners(html);
      html.find("[data-encuentro]").on("click", (ev) => {
        this.seleccionarEncuentro(ev.currentTarget?.dataset?.encuentro);
      });
      enfocarPrimeraEntrada(html?.[0]);
    }
  };
}
