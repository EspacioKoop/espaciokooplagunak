const MODULE_ID = "espaciokoop-lagunak";
const ESCENARIO = "scenario_90_lagunak_primera_guardia";

const ARRIVAL_ID = /^arrival-s90-\d{6}$/;
const ENCOUNTER_ID = /^encounter-started-s90-(\d{6})-(\d{6})$/;
const REPOSITION_ID = /^ship-repositioned-s90-(\d{6})-(\d{6})-(lagunak|argia)-(\d{10})$/;
const REPOSITION_ANCHORS = new Set(["lagunak", "argia"]);
const ENCOUNTER_ARCHETYPES = new Set(["derelict", "patrol", "freighter", "sentry"]);

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

// Comprobaciones que todo evento del puente debe superar antes de mirar su
// tipo. El puente publica lo que encuentra en el escenario; el módulo no se fía
// de la forma, porque una página de diario es persistente y visible en la mesa.
function formaComun(event) {
  return (
    typeof event?.id === "string" &&
    event.scenario === ESCENARIO &&
    Number.isFinite(event.scenario_time) &&
    event.scenario_time >= 0
  );
}

// ---- Registro de tipos de evento -------------------------------------------
//
// Cada tipo que la bitácora sabe anotar es un descriptor con `validar` y
// `pagina`. Añadir un evento nuevo es añadir una entrada aquí: ni el validador
// general ni el bucle de escritura cambian. Antes esto era una cadena de `if`
// que había que tocar entera para cada tipo, y por eso `encounter_started` —que
// el puente lleva emitiendo desde el principio— se descartaba en silencio.
//
// Un tipo sin descriptor se ignora, que es el comportamiento seguro: mejor no
// anotar un evento que escribir en el diario algo cuya forma no se ha validado.

export const DESCRIPTORES = new Map();

export function registrarDescriptor(descriptor) {
  if (typeof descriptor?.tipo !== "string") {
    throw new TypeError("registrarDescriptor requiere un tipo");
  }
  if (typeof descriptor.validar !== "function" || typeof descriptor.pagina !== "function") {
    throw new TypeError(`descriptor ${descriptor.tipo}: faltan validar/pagina`);
  }
  DESCRIPTORES.set(descriptor.tipo, descriptor);
  return descriptor;
}

registrarDescriptor({
  tipo: "arrival",
  validar: (event) => ARRIVAL_ID.test(event.id) && typeof event.destination === "string",
  pagina: (event, game, elapsed) => ({
    title: game.i18n.format("LAGUNAK.Eventos.Llegada.Titulo", {
      destination: event.destination,
    }),
    content: `<p>${game.i18n.format("LAGUNAK.Eventos.Llegada.Resumen", {
      destination: escapeHtml(event.destination),
      elapsed,
    })}</p>`,
  }),
});

registrarDescriptor({
  tipo: "ship_repositioned",
  // El id repite ancla y tiempo; que coincidan con los campos es la prueba de
  // que el evento viene del marcador del escenario y no de un payload cosido.
  validar: (event) => {
    if (!REPOSITION_ANCHORS.has(event.anchor)) return false;
    const match = REPOSITION_ID.exec(event.id);
    if (!match || match[3] !== event.anchor) return false;
    return Number(match[4]) === Math.round(event.scenario_time * 10);
  },
  pagina: (event, game, elapsed) => {
    const anchorLabel = game.i18n.localize(`LAGUNAK.Reposicion.Ancla.${event.anchor}`);
    return {
      title: game.i18n.format("LAGUNAK.Eventos.Reposicion.Titulo", { anchor: anchorLabel }),
      content: `<p>${game.i18n.format("LAGUNAK.Eventos.Reposicion.Resumen", {
        anchor: escapeHtml(anchorLabel),
        elapsed,
      })}</p>`,
    };
  },
});

registrarDescriptor({
  tipo: "encounter_started",
  validar: (event) =>
    ENCOUNTER_ID.test(event.id) &&
    ENCOUNTER_ARCHETYPES.has(event.archetype) &&
    typeof event.encounter_callsign === "string" &&
    event.encounter_callsign.length > 0 &&
    event.encounter_callsign.length <= 64,
  pagina: (event, game, elapsed) => {
    const archetypeLabel = game.i18n.localize(
      `LAGUNAK.Encuentros.Arquetipo.${event.archetype}`,
    );
    return {
      title: game.i18n.format("LAGUNAK.Eventos.Encuentro.Titulo", {
        callsign: event.encounter_callsign,
      }),
      content: `<p>${game.i18n.format("LAGUNAK.Eventos.Encuentro.Resumen", {
        callsign: escapeHtml(event.encounter_callsign),
        archetype: escapeHtml(archetypeLabel),
        elapsed,
      })}</p>`,
    };
  },
});

// Parlamento de comunicaciones (#810): el escenario emite `parlamento_abierto`
// al abrir canal con un contacto. NO es histórico (es un encuentro efímero de la
// mesa), así que no va al diario: `ephemeral` hace que `processBridgeEvents`
// emita el hook `lagunakAbrirParlamento` (que abre la ventana) y pase de la
// página. El contacto viaja ya validado desde el puente.
registrarDescriptor({
  tipo: "parlamento_abierto",
  ephemeral: true,
  validar: (event) => {
    const c = event?.contacto;
    return (
      c != null &&
      typeof c.id === "string" && c.id.length > 0 && c.id.length <= 64 &&
      typeof c.callsign === "string" && c.callsign.length <= 64 &&
      typeof c.faction === "string" && c.faction.length <= 32
    );
  },
  pagina: (event, game) => {
    Hooks.callAll("lagunakAbrirParlamento", {
      contacto: event.contacto,
      hablanteId: game?.user?.id ?? null,
    });
    return null;
  },
});

function descriptorDe(event) {
  if (!formaComun(event)) return null;
  const descriptor = DESCRIPTORES.get(event?.type);
  if (!descriptor || !descriptor.validar(event)) return null;
  return descriptor;
}

export function validEvent(event) {
  return descriptorDe(event) !== null;
}

function pageForEvent(event, game) {
  const elapsed = Math.max(0, Math.round(event.scenario_time));
  return descriptorDe(event).pagina(event, game, elapsed);
}

/**
 * Persiste eventos conocidos del puente una sola vez en el Journal.
 * La deduplicación vive en flags de la página, no en memoria del navegador.
 */
export async function processBridgeEvents({
  payload,
  game,
  JournalEntry,
  ui,
  sigueVigente = () => true,
}) {
  const puedeEscribir = () => Boolean(game.user?.isGM) && Boolean(sigueVigente());
  const events = Array.isArray(payload?.events) ? payload.events.filter(validEvent) : [];
  if (events.length === 0) return 0;

  // Los eventos efímeros (p. ej. parlamento_abierto, #810) disparan su efecto de
  // mesa en CUALQUIER cliente que sondee /v1/events, no solo el GM: abrir la
  // ventana de parlamento es para quien sostiene el canal, no para el director.
  // Los de diario siguen exigiendo GM (escriben en el Journal del mundo).
  const { efimeros, deDiario } = particionEventos(events);
  for (const event of efimeros) {
    const descriptor = descriptorDe(event);
    if (descriptor?.ephemeral) descriptor.pagina(event, game);
  }
  if (!puedeEscribir()) return efimeros.length;
  if (deDiario.length === 0) return efimeros.length;

  const journalName = game.i18n.localize("LAGUNAK.Diario.Nombre");
  const journal =
    game.journal.getName(journalName) ??
    (await JournalEntry.create({ name: journalName }));
  if (!puedeEscribir()) return 0;
  let created = 0;

  for (const event of deDiario) {
    const pages = Array.from(journal.pages ?? []);
    if (pages.some((page) => page.getFlag?.(MODULE_ID, "eventId") === event.id)) {
      continue;
    }
    if (!puedeEscribir()) return created;

    const { title, content } = pageForEvent(event, game);
    await journal.createEmbeddedDocuments("JournalEntryPage", [
      {
        type: "text",
        name: title,
        text: { content },
        flags: { [MODULE_ID]: { eventId: event.id } },
      },
    ]);
    created += 1;
  }

  if (created > 0 && puedeEscribir()) {
    ui.notifications.info(game.i18n.localize("LAGUNAK.Eventos.Anotados"));
  }
  return created + efimeros.length;
}

/** Separa eventos efímeros (efecto de mesa, cualquier cliente) de los de diario (GM). */
function particionEventos(events) {
  const efimeros = [];
  const deDiario = [];
  for (const event of events) {
    (descriptorDe(event)?.ephemeral ? efimeros : deDiario).push(event);
  }
  return { efimeros, deDiario };
}
