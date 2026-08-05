/* Ventana del panel de GM (#448): la puerta única de la que cuelgan las
 * entradas solo-GM que antes eran botones sueltos en los controles de escena.
 * No decide qué hace cada entrada — eso lo sigue haciendo `main.mjs`, igual
 * que la cantina no decide las reglas de cada mesa. Esta ventana solo traduce
 * un clic en "elige esta entrada" y se cierra.
 *
 * Dos clases hermanas, como el resto del módulo (`cantina-app.mjs`):
 * `Application` clásica en v11 y `ApplicationV2` en v12+, sin código
 * compartido entre ellas a propósito.
 */

import { MODULE_ID } from "./lagunak-constantes.mjs";
import { entradasPanelGM } from "./panel-gm.mjs";

const PLANTILLA = `modules/${MODULE_ID}/templates/panel-gm.hbs`;

function contexto() {
  return {
    entradas: entradasPanelGM().map((entrada) => ({
      id: entrada.id,
      icono: entrada.icono,
      titulo: game.i18n.localize(entrada.tituloClave),
    })),
  };
}

/* Al abrir el panel, el foco va a la primera entrada. Misma razón que en la
 * cantina: quien navega con teclado no tiene por qué recorrer el marco de la
 * ventana para llegar a lo único que el panel ofrece. */
function enfocarPrimeraEntrada(raiz) {
  raiz?.querySelector?.("[data-entrada]")?.focus?.();
}

/* ---- v12+ --------------------------------------------------------------- */

export function crearClasePanelGMV2({ alSeleccionar }) {
  const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

  return class PanelGMAppV2 extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "lagunak-panel-gm",
      classes: ["lagunak-panel-gm"],
      window: { title: "LAGUNAK.PanelGM.Titulo", icon: "fa-solid fa-shuttle-space" },
      position: { width: 420, height: "auto" },
    };

    static PARTS = { main: { template: PLANTILLA } };

    async _prepareContext(_options) {
      return contexto();
    }

    seleccionarEntrada(id) {
      if (!id) return;
      alSeleccionar(id);
      this.close();
    }

    _onRender(context, options) {
      super._onRender?.(context, options);
      this.element?.querySelectorAll?.("[data-entrada]")?.forEach((boton) => {
        boton.addEventListener("click", () => this.seleccionarEntrada(boton.dataset.entrada));
      });
      enfocarPrimeraEntrada(this.element);
    }
  };
}

/* ---- v11 ---------------------------------------------------------------- */

export function crearClasePanelGMV1({ alSeleccionar }) {
  return class PanelGMAppV1 extends Application {
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "lagunak-panel-gm",
        classes: ["lagunak-panel-gm"],
        title: game.i18n.localize("LAGUNAK.PanelGM.Titulo"),
        template: PLANTILLA,
        width: 420,
        height: "auto",
      });
    }

    getData(_options) {
      return contexto();
    }

    seleccionarEntrada(id) {
      if (!id) return;
      alSeleccionar(id);
      this.close();
    }

    activateListeners(html) {
      super.activateListeners(html);
      html.find("[data-entrada]").on("click", (ev) => {
        this.seleccionarEntrada(ev.currentTarget?.dataset?.entrada);
      });
      enfocarPrimeraEntrada(html?.[0]);
    }
  };
}
