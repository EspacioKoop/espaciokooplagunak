const MODULE_ID = "espaciokoop-lagunak";
const ARRIVAL_ID = /^arrival-s90-\d{6}$/;

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

/**
 * Persiste eventos conocidos del puente una sola vez en el Journal.
 * La deduplicación vive en flags de la página, no en memoria del navegador.
 */
export async function processBridgeEvents({ payload, game, JournalEntry, ui }) {
  if (!game.user?.isGM) return 0;
  const events = Array.isArray(payload?.events) ? payload.events.filter(validArrival) : [];
  if (events.length === 0) return 0;

  const journalName = game.i18n.localize("LAGUNAK.Diario.Nombre");
  const journal =
    game.journal.getName(journalName) ??
    (await JournalEntry.create({ name: journalName }));
  let created = 0;

  for (const event of events) {
    const pages = Array.from(journal.pages ?? []);
    if (pages.some((page) => page.getFlag?.(MODULE_ID, "eventId") === event.id)) {
      continue;
    }

    const destination = escapeHtml(event.destination);
    const elapsed = Math.max(0, Math.round(event.scenario_time));
    const title = game.i18n.format("LAGUNAK.Eventos.Llegada.Titulo", {
      destination: event.destination,
    });
    const content = `<p>${game.i18n.format("LAGUNAK.Eventos.Llegada.Resumen", {
      destination,
      elapsed,
    })}</p>`;

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

  if (created > 0) {
    ui.notifications.info(game.i18n.localize("LAGUNAK.Eventos.Anotados"));
  }
  return created;
}
