// La ventana del parlamento (#810): por fin hay dónde leer al interlocutor.
//
// El encuentro ya está completo de extremo a extremo en `parlamento.mjs` —semilla
// del contacto, enfoques con CD visible, rango de éxito, banda— y solo faltaba
// una superficie para usarlo. Esto no añade mecánica: solo conecta la que ya
// está, y lo hace sin romper standalone-first (ADR-0008): si el módulo no está
// cargado, abrir canal sigue siendo el diálogo nativo de comms (`scripts/comms_*.lua`),
// que es contenido del núcleo.
//
// ## Qué NO hace, y es deliberado
//
// No recuerda nada (ADR-0012). No escribe en `User.flags` ni en `Actor.flags`:
// el fruto de la banda lo adjudica el GM en la mesa, y esta ventana solo lo
// muestra. Sin reputación, sin «ya hablaste con este», sin estado de facción.
//
// ## La máquina de estados vive aquí y el dibujo en la vista pura
//
// Este archivo tiene lo que Foundry impone: hooks y ventana. Lo que se puede
// razonar sin Foundry —qué se pinta en cada fase, y que la semilla deriva del
// contacto y no del User— está en `parlamento.mjs`, es puro y tiene pruebas.
// `contextoParlamento()` es la frontera: la ventana solo pinta lo que ese
// objeto devuelve, y se puede testear sin Foundry.

import {
  BANDAS,
  interlocutorDelContacto,
  opcionesVisibles,
  resolverParlamento,
  escaparParaDom,
} from "./parlamento.mjs";
import { anadirHerramienta } from "./control-escena.mjs";

let moduloConfigurado = null;
let ventana = null;

/**
 * Todo el estado de la ventana, en un sitio. Se reinicia entero al volver al
 * menú: arrastrar medio encuentro del contacto anterior es cómo se acaba
 * mostrando la ficha de otro NPC.
 */
const estado = {
  fase: "menu",
  contacto: null,
  npc: null,
  semilla: null,
  opciones: null,
  enfoqueId: null,
  banda: null,
};

function reiniciar() {
  Object.assign(estado, {
    fase: "menu",
    contacto: null,
    npc: null,
    semilla: null,
    opciones: null,
    enfoqueId: null,
    banda: null,
  });
}

/** Clave i18n de la banda resultante, para pintar en la fase resuelta. */
const BANDA_CLAVE = Object.freeze({
  [BANDAS.PIFIA]: "LAGUNAK.Parlamento.Banda.Pifia",
  [BANDAS.FALLO]: "LAGUNAK.Parlamento.Banda.Fallo",
  [BANDAS.EXITO]: "LAGUNAK.Parlamento.Banda.Exito",
  [BANDAS.CRITICO]: "LAGUNAK.Parlamento.Banda.Critico",
});

/** Contexto de la ventana. Separado del render para poder probarlo sin Foundry. */
export function contextoParlamento({ contacto = estado.contacto, ficha = null } = {}) {
  if (estado.fase === "menu" || !contacto) {
    return { fase: "menu", enMenu: true };
  }
  const inter = interlocutorDelContacto(contacto, contacto.desafio ?? 1);
  // Las opciones YA calculadas al abrir el encuentro mandan: el hook leyó la
  // ficha del hablante y este contexto no la tiene (se renderiza más tarde, y
  // `ficha` llega null salvo en pruebas). Recalcularlas aquí devolvía siempre
  // modificador 0 y la probabilidad de alguien sin ficha, que es justo lo que
  // la ventana promete no hacer: enseñar CD y rango REALES antes de elegir.
  const base = ficha ? opcionesVisibles({ ficha }) : (estado.opciones ?? opcionesVisibles({ ficha }));
  const opciones = base.map((o) => ({
    ...o,
    // Porcentaje de probabilidad favorable para pintar en texto (no solo barra).
    favorable: Math.round((o.favorable ?? 0) * 100),
    claveNombre: `LAGUNAK.Parlamento.Enfoque.${o.id}`,
  }));
  return {
    fase: estado.fase,
    enMenu: estado.fase === "menu",
    abierto: estado.fase === "abierto",
    resuelto: estado.fase === "resuelto",
    contacto: {
      callsign: escaparParaDom(contacto.callsign ?? ""),
      faction: escaparParaDom(contacto.faction ?? ""),
    },
    npc: {
      nombre: escaparParaDom(inter.npc.nombre),
      arquetipo: inter.npc.arquetipo,
      desafio: inter.npc.desafio,
    },
    opciones,
    enfoqueId: estado.enfoqueId,
    banda: estado.banda,
    bandaClave: estado.banda ? BANDA_CLAVE[estado.banda] : null,
  };
}

export function registrarParlamentoUI(moduleId) {
  moduloConfigurado = moduleId;

  // Abrir canal con un contacto: reconstruye el interlocutor por semilla y
  // enseña los enfoques con su CD y rango de éxito visibles. El titular del
  // puesto de comunicaciones es quien abre; la autoridad de la orden de canal
  // sigue saliendo por `station-order-relay.mjs` (#237), esta ventana no emite
  // nada de red por sí misma. La ficha del hablante (para el modificador real)
  // se lee igual que en la asistencia: `game.users.get(id).character.system`.
  Hooks.on("lagunakAbrirParlamento", (carga) => {
    const contacto = carga?.contacto;
    if (!contacto) return;
    const ficha = carga?.ficha
      ?? game?.users?.get(carga?.hablanteId)?.character?.system
      ?? null;
    abrirParlamento();
    establecerEstadoParlamento(contacto, contacto.desafio ?? 1, ficha);
  });

  // Quien tiene el total de la tirada (el GM o el sistema de comunicaciones,
  // #237) lo devuelve aquí; la ventana cierra en banda. Sin esto, el botón de
  // enfoque solo pidió la tirada y la ventana sigue en abierto: no se inventa
  // una salida.
  Hooks.on("lagunakParlamentoResuelve", ({ enfoqueId, total } = {}) => {
    if (estado.fase !== "abierto" || !enfoqueId) return;
    elegirEnfoque(enfoqueId, Number(total));
  });
}

/**
 * Abrir la ventana desde el botón de la barra. Construye una instancia nueva si
 * la anterior se cerró (misma regla que la asistencia: una ApplicationV2
 * cerrada no se reutiliza). La ventana arranca en menú; el encuentro real se
 * abre con el hook `lagunakAbrirParlamento` cuando comunicaciones recibe un
 * canal.
 */
export function abrirParlamento() {
  if (!moduloConfigurado) return;
  if (!ventana?.rendered) ventana = new (claseVentana())();
  reiniciar();
  estado.fase = "menu";
  if (foundry?.applications?.api?.ApplicationV2) ventana.render({ force: true });
  else ventana.render(true);
}

/**
 * Establece el estado de la ventana de parlamento para un contacto dado.
 * Asume que la ventana ya está abierta (llamar a `abrirParlamento` primero si es necesario).
 * @param {{id?: string, callsign?: string, faction?: string}} contacto
 * @param {number} [dificultad=1]
 * @param {object|null} ficha
 */
export function establecerEstadoParlamento(contacto, dificultad = 1, ficha = null) {
  const estable = contacto?.id ?? contacto?.callsign;
  if (estable === undefined || estable === null || estable === "") {
    throw new TypeError("establecerEstadoParlamento: el contacto no tiene id ni callsign estables");
  }
  const inter = interlocutorDelContacto(contacto, dificultad);
  Object.assign(estado, {
    fase: "abierto",
    contacto,
    npc: inter.npc,
    semilla: inter.semilla,
    opciones: opcionesVisibles({ ficha }),
    enfoqueId: null,
    banda: null,
  });
  if (ventana?.rendered) ventana.render({ force: true });
}

/** Cerrar la ventana de parlamento. Sin estado que guardar (ADR-0012). */
export function cerrarParlamento() {
  reiniciar();
  if (ventana?.rendered) ventana.close();
}

/**
 * Elegir enfoque y resolver. La tirada (`total`) la hace el dnd5e del hablante
 * en mesa; aquí solo se convierte en banda, que es lo que la ventana muestra.
 * El GM adjudica el fruto; esto no escribe nada.
 */
export function elegirEnfoque(enfoqueId, total) {
  if (estado.fase !== "abierto") return;
  const resultado = resolverParlamento({ id: enfoqueId, total });
  estado.enfoqueId = enfoqueId;
  estado.banda = resultado.banda;
  estado.fase = "resuelto";
  if (ventana?.rendered) ventana.render({ force: true });
}

/** Solo para pruebas: deja la máquina de estados en el arranque. */
export function _reiniciarParaPruebas() {
  reiniciar();
  ventana = null;
}

function repintar() {
  if (!ventana?.rendered) return;
  if (foundry?.applications?.api?.ApplicationV2) ventana.render({ force: true });
}

// --- Ventana y control -------------------------------------------------------

export function addParlamentoControl(controls) {
  anadirHerramienta(controls, {
    name: "lagunak-parlamento",
    title: "LAGUNAK.Parlamento.Titulo",
    icon: "fa-solid fa-comments",
    button: true,
    onClick: () => abrirParlamento(),
  });
}

function claseVentana() {
  return foundry?.applications?.api?.ApplicationV2 ? crearClaseV2() : crearClaseV1();
}

function crearClaseV2() {
  const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
  return class ParlamentoV2 extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "lagunak-parlamento",
      classes: ["lagunak-parlamento"],
      window: { title: "LAGUNAK.Parlamento.Titulo", icon: "fa-solid fa-comments" },
      position: { width: 420, height: "auto" },
    };

    static PARTS = { main: { template: `modules/${moduloConfigurado}/templates/parlamento.hbs` } };

    async _prepareContext() {
      return contextoParlamento();
    }

    _onRender(_contextData, _options) {
      super._onRender?.(_contextData, _options);
      conectar(this.element);
    }
  };
}

function crearClaseV1() {
  return class ParlamentoV1 extends Application {
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "lagunak-parlamento",
        classes: ["lagunak-parlamento"],
        template: `modules/${moduloConfigurado}/templates/parlamento.hbs`,
        width: 420,
        height: "auto",
        resizable: true,
      });
    }

    get title() {
      return game.i18n.localize("LAGUNAK.Parlamento.Titulo");
    }

    getData() {
      return contextoParlamento();
    }

    activateListeners(html) {
      super.activateListeners(html);
      conectar(html);
    }
  };
}

function conectar(raiz) {
  const nodo = raizReal(raiz);
  nodo?.querySelectorAll?.("[data-parlamento-enfoque]").forEach((boton) => {
    boton.addEventListener("click", () => {
      // La tirada real la hace el dnd5e del hablante en mesa; la ventana NO la
      // inventa. Pide la tirada por el canal que el puente de comunicaciones
      // (#237) ya usa, y quien la tenga (el GM o el sistema) responde con el
      // total vía `lagunakParlamentoResuelve`, que cierra en banda. Sin
      // respuesta, la ventana se queda en abierto: no miente sobre la salida.
      const enfoqueId = boton.dataset.parlamentoEnfoque;
      estado.enfoqueId = enfoqueId;
      Hooks.callAll("lagunakParlamentoSolicitaTirada", {
        enfoqueId,
        hablanteId: game?.user?.id ?? null,
      });
      repintar();
    });
  });
  nodo?.querySelector?.("[data-parlamento-volver]")?.addEventListener("click", () => {
    reiniciar();
    repintar();
  });
}

// `element` es un HTMLElement en ApplicationV2 y un jQuery en la V1 clásica.
function raizReal(raiz) {
  if (!raiz) return null;
  return typeof raiz.querySelector === "function" ? raiz : (raiz[0] ?? null);
}
