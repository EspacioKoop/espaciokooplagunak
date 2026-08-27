// Convocar a la tripulación a una estancia, desde la barra (#832).
//
// `convocatoria-estancia.mjs` ya sabe TRANSPORTAR a quien convoca (uno de los
// tres verbos de escena de FOUNDRY.md), pero nadie en el módulo lo llamaba: era
// una conexión muerta. Esto la enchufa al UI. No añade mecánica: solo da a quién
// tiene rol GM un botón que lista las estancias del catálogo de andar y llama a
// `convocar`.
//
// LO QUE NO HACE. No transporta de verdad: `convocar` devuelve la posición de
// llegada y este módulo la entrega por hook (`lagunakConvocarResuelve`). El
// verbo de mover el token vive en el área de andar (#427) y es quien debe
// consumir ese hook —aquí no se pisa. Sin estado, sin conceder, sin recordar.
//
// Solo-GM por diseño: `convocar` devuelve `null` si quien llama no es GM, así
// que un jugador que pulse el botón simplemente se entera de que no puede.

import { anadirHerramienta } from "./control-escena.mjs";

let moduloConfigurado = null;
let ventana = null;

/** Lista de estancias del catálogo, para pintar en la ventana. */
export async function estanciasDisponibles() {
  const { CATALOGO_ANDAR } = await import("./nave-catalogo-andar.mjs");
  return CATALOGO_ANDAR.ids.map((id) => ({
    id,
    nombre: CATALOGO_ANDAR.obtener(id)?.nombre ?? id,
  }));
}

/** Convierte la elección del UI en la llamada real a `convocar`. */
export async function convocarDesdeVentana(idEstancia) {
  if (!moduloConfigurado) return null;
  const { convocar } = await import("./convocatoria-estancia.mjs");
  const posicion = convocar(idEstancia, "GM");
  Hooks.callAll("lagunakConvocarResuelve", { id: idEstancia, posicion });
  if (!posicion && typeof ui !== "undefined" && ui?.notifications) {
    ui.notifications.info("LAGUNAK.Convocatoria.NoSePuede");
  }
  return posicion;
}

export function abrirConvocatoria() {
  if (!moduloConfigurado) return;
  if (!ventana?.rendered) ventana = new (claseVentana())();
  if (foundry?.applications?.api?.ApplicationV2) ventana.render({ force: true });
  else ventana.render(true);
}

export function cerrarConvocatoria() {
  if (ventana?.rendered) ventana.close();
}

// --- Ventana y control -------------------------------------------------------

function claseVentana() {
  return foundry?.applications?.api?.ApplicationV2 ? crearClaseV2() : crearClaseV1();
}

function crearClaseV2() {
  const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
  return class ConvocatoriaV2 extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "lagunak-convocar",
      classes: ["lagunak-convocar"],
      window: { title: "LAGUNAK.Convocatoria.Titulo", icon: "fa-solid fa-person-walking" },
      position: { width: 360, height: "auto" },
    };

    static PARTS = { main: { template: `modules/${moduloConfigurado}/templates/convocatoria.hbs` } };

    async _prepareContext() {
      return { estancias: estanciasDisponibles() };
    }

    _onRender(_contextData, _options) {
      super._onRender?.(_contextData, _options);
      const root = this.element;
      root?.querySelectorAll?.("[data-convocar]").forEach((boton) => {
        boton.addEventListener("click", () => {
          convocarDesdeVentana(boton.getAttribute("data-convocar"));
          this.close();
        });
      });
    }
  };
}

function crearClaseV1() {
  return class ConvocatoriaV1 extends Application {
    static get defaultOptions() {
      const o = super.defaultOptions;
      return {
        ...o,
        id: "lagunak-convocar",
        classes: ["lagunak-convocar"],
        title: "LAGUNAK.Convocatoria.Titulo",
        width: 360,
        template: `modules/${moduloConfigurado}/templates/convocatoria.hbs`,
      };
    }

    getData() {
      return { estancias: estanciasDisponibles() };
    }

    activateListeners(html) {
      super.activateListeners?.(html);
      html.find?.("[data-convocar]").each((_i, nodo) => {
        nodo.addEventListener("click", () => {
          convocarDesdeVentana(nodo.getAttribute("data-convocar"));
          this.close();
        });
      });
    }
  };
}

/** Control en la barra de escena: solo-GM, porque `convocar` exige rol GM. */
export function addConvocarControl(controls) {
  if (!game?.user?.isGM) return false;
  return anadirHerramienta(controls, {
    name: "lagunak-convocar",
    title: "LAGUNAK.Convocatoria.Titulo",
    icon: "fa-solid fa-person-walking",
    button: true,
    onClick: () => abrirConvocatoria(),
  });
}

/** Registra el UI de convocatoria. El botón se añade desde el hook de la barra
 * de `main.mjs` (igual que asistencia), no con un hook propio: así no se
 * duplica el callback de `getSceneControlButtons`. */
export function registrarConvocatoriaUI(moduleId) {
  moduloConfigurado = moduleId;
}
