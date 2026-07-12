import assert from "node:assert/strict";
import test from "node:test";

import { processBridgeEvents } from "../scripts/event-journal.mjs";

function harness() {
  const pages = [];
  const created = [];
  const journal = {
    pages,
    async createEmbeddedDocuments(type, documents) {
      assert.equal(type, "JournalEntryPage");
      created.push(...documents);
      for (const document of documents) {
        pages.push({
          getFlag(namespace, key) {
            return document.flags?.[namespace]?.[key];
          },
        });
      }
    },
  };
  const notifications = [];
  return {
    created,
    notifications,
    game: {
      user: { isGM: true },
      journal: { getName: () => journal },
      i18n: {
        localize: (key) => key,
        format: (key, data) => `${key}:${JSON.stringify(data)}`,
      },
    },
    JournalEntry: { create: async () => journal },
    ui: { notifications: { info: (message) => notifications.push(message) } },
  };
}

const arrival = {
  id: "arrival-s90-123456",
  type: "arrival",
  scenario: "scenario_90_lagunak_primera_guardia",
  destination: "Argia",
  scenario_time: 42.5,
};

test("el mismo evento solo crea una página tras dos sondeos", async () => {
  const context = harness();
  const args = { ...context, payload: { events: [arrival] } };

  assert.equal(await processBridgeEvents(args), 1);
  assert.equal(await processBridgeEvents(args), 0);
  assert.equal(context.created.length, 1);
  assert.equal(
    context.created[0].flags["espaciokoop-lagunak"].eventId,
    arrival.id,
  );
  assert.equal(context.notifications.length, 1);
});

test("ignora eventos desconocidos o IDs fuera del contrato", async () => {
  const context = harness();
  const payload = {
    events: [
      { ...arrival, type: "arbitrary" },
      { ...arrival, id: "<script>alert(1)</script>" },
      { ...arrival, scenario_time: Number.NaN },
    ],
  };

  assert.equal(await processBridgeEvents({ ...context, payload }), 0);
  assert.equal(context.created.length, 0);
});

test("no escribe Journal para un jugador no GM", async () => {
  const context = harness();
  context.game.user.isGM = false;
  assert.equal(
    await processBridgeEvents({ ...context, payload: { events: [arrival] } }),
    0,
  );
  assert.equal(context.created.length, 0);
});
