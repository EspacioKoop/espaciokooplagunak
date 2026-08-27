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
//
// ## Por qué el reto se repinta a mano y no re-renderizando
//
// Igual que la asistencia: el cursor de un minijuego de destreza se mueve a 60
// Hz; un `render()` de Foundry por fotograma tira el foco. Aquí el parlamento
// no tiene minijuego de destreza (la resolución es una tirada de habilidad del
// dnd5e del hablante), así que la ventana es estática entre gestos: un solo
// `render()` por cambio de fase basta.

import { interlocutorDelContacto, opcionesVisibles, resolverParlamento, escaparParaDom } from "./parlamento.mjs";
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

/** Contexto de la ventana. Separado del render para poder probarlo sin Foundry. */
export function contextoParlamento({ contacto = estado.contacto, ficha = null } = {}) {
  if (estado.fase === "menu" || !contacto) {
    return { fase: "menu", enMenu: true };
  }
  const inter = interlocutorDelContacto(contacto, contacto.desafio ?? 1);
  const opciones = opcionesVisibles({ ficha });
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
  };
}

export function registrarParlamentoUI(moduleId) {
  moduloConfigurado = moduleId;

  // Abrir canal con un contacto: reconstruye el interlocutor por semilla y
  // enseña los enfoques con su CD y rango de éxito visibles. El titular del
  // puesto de comunicaciones es quien abre; la autoridad de la orden de canal
  // sigue saliendo por `station-order-relay.mjs` (#237), esta ventana no emite
  // nada de red por sí misma.
  Hooks.on("lagunakAbrirParlamento", (carga) => {
    const contacto = carga?.contacto;
    if (!contacto) return;
    const inter = interlocutorDelContacto(contacto, contacto.desafio ?? 1);
    Object.assign(estado, {
      fase: "abierto",
      contacto,
      npc: inter.npc,
      semilla: inter.semilla,
      opciones: opcionesVisibles({ ficha: carga?.ficha ?? null }),
      enfoqueId: null,
      banda: null,
    });
    repintar();
  });
}

/** Abrir la ventana de parlamento. Sin estado que guardar (ADR-0012). */
export function abrirParlamento() {
  if (!moduloConfigurado) return;
  // La ventana se construye bajo demanda; aquí solo se marca el arranque. El
  // encuentro real se abre con el hook `lagunakAbrirParlamento` cuando
  // comunicaciones recibe un canal.
  reiniciar();
  estado.fase = "menu";
  repintar();
}

/** Cerrar la ventana de parlamento. Sin estado que guardar (ADR-0012). */
export function cerrarParlamento() {
  reiniciar();
  repintar();
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
  repintar();
}

function repintar() {
  if (!ventana?.rendered) return;
  if (foundry?.applications?.api?.ApplicationV2) ventana.render({ force: true });
}

// Punto de registro para `main.mjs`: la ventana se enchufa como una herramienta
// más del grupo propio del módulo, dentro del hook `getSceneControlButtons`
// (mismo contrato que `addAsistenciaControl`, `addStationControl`, ...). Así no
// pisa el hook de main ni el stub de `Hooks.on` de los tests.
export function addParlamentoControl(controls) {
  anadirHerramienta(controls, {
    name: "lagunak-parlamento",
    title: "LAGUNAK.Parlamento.Titulo",
    icon: "fa-solid fa-comments",
    button: true,
    onClick: () => abrirParlamento(),
  });
}
