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
// Solo-GM por diseño, y el rol se lee del `User` autenticado EN EL MOMENTO DE
// CONVOCAR, no al construir la barra. Ocultar el botón es presentación; la
// autorización es lo que pasa al ejecutar (#237). Pasar el literal "GM" a
// `convocar` convertía su guarda en un adorno: valía una llamada directa desde
// consola, o simplemente perder el rol con la ventana ya abierta.

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
  // El rol sale del usuario actual, nunca de un literal: es la misma regla que
  // el relé de puestos (#237), donde la orden tampoco dice quién la manda.
  const rol = game?.user?.isGM ? "GM" : "JUGADOR";
  const posicion = convocar(idEstancia, rol);
  if (!posicion) {
    // Nada de hook operativo cuando la convocatoria NO procede: quien lo
    // consuma (el área de andar) no tiene por qué distinguir un `posicion:
    // null` de una convocatoria de verdad, y un hook emitido es una orden.
    if (typeof ui !== "undefined" && ui?.notifications) {
      ui.notifications.info("LAGUNAK.Convocatoria.NoSePuede");
    }
    return null;
  }
  Hooks.callAll("lagunakConvocarResuelve", { id: idEstancia, posicion });
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
      // `estanciasDisponibles()` es async (importa el catálogo en diferido):
      // sin `await`, `{{#each estancias}}` recibía una Promise y la ventana
      // abría vacía.
      return { estancias: await estanciasDisponibles() };
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

    async getData() {
      // Igual que en V2: la lista se resuelve antes de devolver el contexto.
      // Application (v11) admite un `getData` asíncrono.
      return { estancias: await estanciasDisponibles() };
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
