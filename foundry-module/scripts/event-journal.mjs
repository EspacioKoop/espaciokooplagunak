const MODULE_ID = "espaciokoop-lagunak";
const ARRIVAL_ID = /^arrival-s90-\d{6}$/;
const REPOSITION_ID = /^ship-repositioned-s90-(\d{6})-(\d{6})-(lagunak|argia)-(\d{10})$/;
const REPOSITION_ANCHORS = new Set(["lagunak", "argia"]);

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

function validArrival(event) {
  return (
    event?.type === "arrival" &&
    typeof event.id === "string" &&
    ARRIVAL_ID.test(event.id) &&
    event.scenario === "scenario_90_lagunak_primera_guardia" &&
    typeof event.destination === "string" &&
    Number.isFinite(event.scenario_time)
  );
}

function validReposition(event) {
  if (
    event?.type !== "ship_repositioned" ||
    typeof event.id !== "string" ||
    event.scenario !== "scenario_90_lagunak_primera_guardia" ||
    !REPOSITION_ANCHORS.has(event.anchor) ||
    !Number.isFinite(event.scenario_time) ||
    event.scenario_time < 0
  ) {
    return false;
  }
  const match = REPOSITION_ID.exec(event.id);
  if (!match || match[3] !== event.anchor) return false;
  return Number(match[4]) === Math.round(event.scenario_time * 10);
}

function validEvent(event) {
  return validArrival(event) || validReposition(event);
}

function pageForEvent(event, game) {
  const elapsed = Math.max(0, Math.round(event.scenario_time));
  if (event.type === "ship_repositioned") {
    const anchorLabel = game.i18n.localize(`LAGUNAK.Reposicion.Ancla.${event.anchor}`);
    return {
      title: game.i18n.format("LAGUNAK.Eventos.Reposicion.Titulo", { anchor: anchorLabel }),
      content: `<p>${game.i18n.format("LAGUNAK.Eventos.Reposicion.Resumen", {
        anchor: escapeHtml(anchorLabel),
        elapsed,
      })}</p>`,
    };
  }

  const destination = escapeHtml(event.destination);
  return {
    title: game.i18n.format("LAGUNAK.Eventos.Llegada.Titulo", {
      destination: event.destination,
    }),
    content: `<p>${game.i18n.format("LAGUNAK.Eventos.Llegada.Resumen", {
      destination,
      elapsed,
    })}</p>`,
  };
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
  if (!puedeEscribir()) return 0;
  const events = Array.isArray(payload?.events) ? payload.events.filter(validEvent) : [];
  if (events.length === 0) return 0;

  const journalName = game.i18n.localize("LAGUNAK.Diario.Nombre");
  const journal =
    game.journal.getName(journalName) ??
    (await JournalEntry.create({ name: journalName }));
  if (!puedeEscribir()) return 0;
  let created = 0;

  for (const event of events) {
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
  return created;
}
