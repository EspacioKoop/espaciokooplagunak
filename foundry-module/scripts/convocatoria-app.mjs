/** Convocatoria de estancia para el GM (#832): formulario para elegir estancia y rol.
 *
 * Mismo patrón que `consola-caliente-v1.mjs` y `consola-caliente-v2.mjs`: una
 * Application clásica (v11) y ApplicationV2 (v12+) aisladas a propósito.
 *
 * La ventana solo recoge los datos y llama al callback de envío.
 *
 * LAS ESTANCIAS VAN AGRUPADAS POR CATEGORÍA (#952), como carpetas: catorce
 * salas de la nave mezcladas con los dos bancos de pruebas GM-only (playa,
 * museo) en una sola lista plana no dice nada de qué es cada cosa. El agrupado
 * lo calcula `categoriasAndar()` (`nave-catalogo-andar.mjs`), derivado del
 * propio catálogo — este módulo no mantiene su propia lista.
 *
 * @typedef {Object} ConvocatoriaData
 * @property {string} idEstancia   ID de la estancia elegida (debe existir en CATALOGO_ANDAR).
 * @property {string} rolConvocante Rol de quien convoca (actualmente solo "GM").
 */

import { categoriasAndar } from "./nave-catalogo-andar.mjs";

/**
 * Crea la clase de la aplicación para v12+ (ApplicationV2).
 * @param {{ onSubmit: (data: ConvocatoriaData) => void }} callbacks
 * @returns {typeof ApplicationV2} 
 */
export function crearClaseConvocatoriaV2({ onSubmit }) {
  const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

  return class ConvocatoriaAppV2 extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "lagunak-convocatoria",
      classes: ["lagunak-convocatoria"],
      window: { title: "LAGUNAK.PanelGM.Entrada.Convocatoria", icon: "fa-solid fa-user-group" },
      position: { width: 300, height: "auto" },
    };

    /** @returns {string} Plantilla Handlebars. */
    static get template() {
      return `modules/lagunak/templates/convocatoria.hbs`;
    }

    /** Contexto para la plantilla. */
    async _prepareContext() {
      const categorias = categoriasAndar();
      // Por ahora, solo el rol GM está permitido.
      const roles = [{ id: "GM" }];
      return { categorias, roles };
    }

    /** Al hacer click en el botón, llamar al callback y cerrar. */
    _onRender(context, options) {
      super._onRender?.(context, options);
      const form = this.element?.querySelector("form");
      if (form) {
        form.addEventListener("submit", ev => {
          ev.preventDefault();
          const idEstancia = this.element?.querySelector('[name="idEstancia"]')?.value;
          const rolConvocante = this.element?.querySelector('[name="rolConvocante"]')?.value;
          if (idEstancia && rolConvocante) {
            onSubmit({ idEstancia, rolConvocante });
            this.close();
          }
        });
      }
      // Enfocar el primer campo.
      this.element?.querySelector('[name="idEstancia"]')?.focus?.();
    }
  };
}

/** 
 * Crea la clase de la aplicación para v11 (Application clásica).
 * @param {{ onSubmit: (data: ConvocatoriaData) => void }} callbacks
 * @returns {typeof Application} 
 */
export function crearClaseConvocatoriaV1({ onSubmit }) {
  return class ConvocatoriaAppV1 extends Application {
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "lagunak-convocatoria",
        classes: ["lagunak-convocatoria"],
        title: game.i18n.localize("LAGUNAK.PanelGM.Entrada.Convocatoria"),
        template: "modules/lagunak/templates/convocatoria.hbs",
        width: 300,
        height: "auto",
      });
    }

    /** Contexto para la plantilla. */
    async getData() {
      const categorias = categoriasAndar();
      // Por ahora, solo el rol GM está permitido.
      const roles = [{ id: "GM" }];
      return { categorias, roles };
    }

    /** Al hacer click en el botón, llamar al callback y cerrar. */
    activateListeners(html) {
      super.activateListeners(html);
      const form = html.find("form");
      form.on("submit", ev => {
        ev.preventDefault();
        const idEstancia = html.find('[name="idEstancia"]').val();
        const rolConvocante = html.find('[name="rolConvocante"]').val();
        if (idEstancia && rolConvocante) {
          onSubmit({ idEstancia: idEstancia, rolConvocante: rolConvocante });
          this.close();
        }
      });
      // Enfocar el primer campo.
      html.find('[name="idEstancia"]').focus();
    }
  };
}
