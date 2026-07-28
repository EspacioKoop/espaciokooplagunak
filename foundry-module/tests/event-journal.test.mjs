import assert from "node:assert/strict";
import test from "node:test";

import {
  DESCRIPTORES,
  processBridgeEvents,
  registrarDescriptor,
} from "../scripts/event-journal.mjs";

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
    journal,
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

const reposition = {
  id: "ship-repositioned-s90-123456-000007-argia-0000000425",
  type: "ship_repositioned",
  scenario: "scenario_90_lagunak_primera_guardia",
  anchor: "argia",
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

test("una reposición aceptada crea una página localizada y deduplicada", async () => {
  const context = harness();
  const args = { ...context, payload: { events: [reposition] } };

  assert.equal(await processBridgeEvents(args), 1);
  assert.equal(await processBridgeEvents(args), 0);
  assert.equal(context.created.length, 1);
  assert.equal(
    context.created[0].flags["espaciokoop-lagunak"].eventId,
    reposition.id,
  );
  assert.match(context.created[0].name, /LAGUNAK\.Eventos\.Reposicion\.Titulo/);
  assert.match(context.created[0].text.content, /LAGUNAK\.Reposicion\.Ancla\.argia/);
  assert.doesNotMatch(context.created[0].text.content, /Authorization|Bearer|https?:\/\//i);
});

test("ignora eventos desconocidos o IDs fuera del contrato", async () => {
  const context = harness();
  const payload = {
    events: [
      { ...arrival, type: "arbitrary" },
      { ...arrival, id: "<script>alert(1)</script>" },
      { ...arrival, scenario_time: Number.NaN },
      { ...reposition, anchor: "mordor" },
      { ...reposition, id: reposition.id.replace("argia", "lagunak") },
      { ...reposition, scenario_time: 43.5 },
      { ...reposition, id: `${reposition.id}-extra` },
    ],
  };

  assert.equal(await processBridgeEvents({ ...context, payload }), 0);
  assert.equal(context.created.length, 0);
});

test("no escribe Journal para un jugador no GM", async () => {
  const context = harness();
  context.game.user.isGM = false;
  assert.equal(
    await processBridgeEvents({ ...context, payload: { events: [arrival, reposition] } }),
    0,
  );
  assert.equal(context.created.length, 0);
});

test("revocar el rol mientras se crea el diario impide escribir la página", async () => {
  const context = harness();
  let resolver;
  context.game.journal.getName = () => null;
  context.JournalEntry.create = () => new Promise((resolve) => {
    resolver = resolve;
  });

  const pendiente = processBridgeEvents({
    ...context,
    payload: { events: [reposition] },
    sigueVigente: () => context.game.user.isGM,
  });
  context.game.user.isGM = false;
  resolver({
    pages: [],
    createEmbeddedDocuments: async () => assert.fail("no debe escribir"),
  });

  assert.equal(await pendiente, 0);
  assert.equal(context.created.length, 0);
  assert.equal(context.notifications.length, 0);
});

// ---- Registro modular de tipos de evento -----------------------------------

const encuentro = {
  id: "encounter-started-s90-123456-000002",
  type: "encounter_started",
  scenario: "scenario_90_lagunak_primera_guardia",
  archetype: "derelict",
  encounter_callsign: "Hondar 2",
  scenario_time: 61.0,
};

test("el encuentro que el puente emite ya no se descarta en silencio", async () => {
  const context = harness();
  const escritos = await processBridgeEvents({
    ...context,
    payload: { events: [encuentro] },
  });
  assert.equal(escritos, 1);
  assert.match(context.created[0].name, /LAGUNAK\.Eventos\.Encuentro\.Titulo/);
  assert.match(context.created[0].text.content, /Hondar 2/);
  assert.match(context.created[0].text.content, /LAGUNAK\.Encuentros\.Arquetipo\.derelict/);
});

test("un encuentro malformado no llega al diario", async () => {
  const malos = [
    { ...encuentro, archetype: "inventado" },
    { ...encuentro, id: "encounter-started-s90-123456-2" },
    { ...encuentro, encounter_callsign: "" },
    { ...encuentro, encounter_callsign: "x".repeat(65) },
    { ...encuentro, scenario: "otro_escenario" },
    { ...encuentro, scenario_time: -1 },
  ];
  for (const evento of malos) {
    const context = harness();
    assert.equal(
      await processBridgeEvents({ ...context, payload: { events: [evento] } }),
      0,
      `debería descartarse: ${JSON.stringify(evento)}`,
    );
  }
});

test("un tipo sin descriptor se ignora en vez de anotarse", async () => {
  const context = harness();
  const escritos = await processBridgeEvents({
    ...context,
    payload: {
      events: [{ ...encuentro, type: "tipo_que_no_conocemos" }],
    },
  });
  assert.equal(escritos, 0);
});

test("registrarDescriptor exige tipo, validar y pagina", () => {
  assert.throws(() => registrarDescriptor({}), TypeError);
  assert.throws(() => registrarDescriptor({ tipo: "x" }), TypeError);
  assert.throws(() => registrarDescriptor({ tipo: "x", validar: () => true }), TypeError);
});

test("un descriptor nuevo se anota sin tocar el bucle de escritura", async () => {
  registrarDescriptor({
    tipo: "prueba_temporal",
    validar: (event) => event.id === "prueba-1",
    pagina: () => ({ title: "Prueba", content: "<p>Prueba</p>" }),
  });
  try {
    const context = harness();
    const escritos = await processBridgeEvents({
      ...context,
      payload: {
        events: [
          {
            id: "prueba-1",
            type: "prueba_temporal",
            scenario: "scenario_90_lagunak_primera_guardia",
            scenario_time: 1,
          },
        ],
      },
    });
    assert.equal(escritos, 1);
    assert.equal(context.created[0].name, "Prueba");
  } finally {
    DESCRIPTORES.delete("prueba_temporal");
  }
});

test("los tres tipos conocidos están registrados", () => {
  assert.deepEqual(
    [...DESCRIPTORES.keys()].sort(),
    ["arrival", "encounter_started", "ship_repositioned"],
  );
});
