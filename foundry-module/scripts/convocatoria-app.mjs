/* Ventana de convocatoria (#832): a qué estancia se llama a la tripulación.
 *
 * Lista plana de destinos, exactamente igual que el panel de GM: un clic elige
 * y la ventana se cierra. No decide nada —ni quién puede convocar, ni dónde se
 * aterriza— porque eso ya está decidido en `convocatoria-estancia.mjs` y el
 * transporte en `convocatoria-escena.mjs`.
 *
 * Los destinos NO se escriben aquí: se derivan del catálogo por
 * `destinosConvocables`. Una ventana que declarase su propia lista sería el
 * segundo sitio donde mantener la misma verdad.
 *
 * Dos clases hermanas y sin código compartido, como `panel-gm-app.mjs`:
 * `Application` clásica en v11 y `ApplicationV2` en v12+.
 */

import { MODULE_ID } from "./lagunak-constantes.mjs";
import { destinosConvocables } from "./convocatoria-escena.mjs";

const PLANTILLA = `modules/${MODULE_ID}/templates/convocatoria.hbs`;

/* El rótulo de un destino sale del catálogo de idioma; si un destino nuevo
 * llega antes que su traducción, sale su id y no una cadena vacía: un botón sin
 * texto no se puede pulsar a ciegas. */
function rotulo(id) {
  const clave = `LAGUNAK.Convocatoria.Destino.${id}`;
  const texto = game.i18n?.localize?.(clave);
  return !texto || texto === clave ? id : texto;
}

function contexto() {
  return { destinos: destinosConvocables().map((id) => ({ id, titulo: rotulo(id) })) };
}

/* Al abrir, el foco va al primer destino: quien navega con teclado no tiene por
 * qué recorrer el marco para llegar a lo único que la ventana ofrece. */
function enfocarPrimerDestino(raiz) {
  raiz?.querySelector?.("[data-destino]")?.focus?.();
}

/* ---- v12+ --------------------------------------------------------------- */

export function crearClaseConvocatoriaV2({ alElegir }) {
  const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

  return class ConvocatoriaAppV2 extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "lagunak-convocatoria",
      classes: ["lagunak-convocatoria"],
      window: { title: "LAGUNAK.Convocatoria.Titulo", icon: "fa-solid fa-bullhorn" },
      position: { width: 420, height: "auto" },
    };

    static PARTS = { main: { template: PLANTILLA } };

    async _prepareContext(_options) {
      return contexto();
    }

    elegirDestino(id) {
      if (!id) return;
      alElegir(id);
      this.close();
    }

    _onRender(context, options) {
      super._onRender?.(context, options);
      this.element?.querySelectorAll?.("[data-destino]")?.forEach((boton) => {
        boton.addEventListener("click", () => this.elegirDestino(boton.dataset.destino));
      });
      enfocarPrimerDestino(this.element);
    }
  };
}

/* ---- v11 ---------------------------------------------------------------- */

export function crearClaseConvocatoriaV1({ alElegir }) {
  return class ConvocatoriaAppV1 extends Application {
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "lagunak-convocatoria",
        classes: ["lagunak-convocatoria"],
        title: game.i18n.localize("LAGUNAK.Convocatoria.Titulo"),
        template: PLANTILLA,
        width: 420,
        height: "auto",
      });
    }

    getData(_options) {
      return contexto();
    }

    elegirDestino(id) {
      if (!id) return;
      alElegir(id);
      this.close();
    }

    activateListeners(html) {
      super.activateListeners(html);
      html.find("[data-destino]").on("click", (ev) => {
        this.elegirDestino(ev.currentTarget?.dataset?.destino);
      });
      enfocarPrimerDestino(html?.[0]);
    }
  };
}
