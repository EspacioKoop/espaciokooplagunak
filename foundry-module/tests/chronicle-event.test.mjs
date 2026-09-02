import assert from "node:assert/strict";
import test from "node:test";

import {
  CHRONICLE_EVENT_SCHEMA_V1,
  adaptarEventoJournal,
  consumirEventosUnicos,
  crearChronicleEvent,
  validarChronicleEvent,
} from "../scripts/chronicle-event.mjs";
import {
  DESCRIPTORES,
  registrarDescriptor,
  validEvent,
} from "../scripts/event-journal.mjs";

const llegadaJournal = {
  id: "arrival-s90-123456",
  type: "arrival",
  scenario: "scenario_90_lagunak_primera_guardia",
  destination: "Argia",
  scenario_time: 42.5,
};

test("el esquema v1 cierra la forma y los catálogos type/verb", () => {
  assert.equal(CHRONICLE_EVENT_SCHEMA_V1.properties.schemaVersion.const, 1);
  assert.equal(CHRONICLE_EVENT_SCHEMA_V1.additionalProperties, false);
  assert.deepEqual(CHRONICLE_EVENT_SCHEMA_V1.properties.type.enum, [
    "journey", "encounter", "ship",
  ]);
  assert.deepEqual(CHRONICLE_EVENT_SCHEMA_V1.properties.verb.enum, [
    "arrived", "started", "repositioned",
  ]);
  assert.equal(CHRONICLE_EVENT_SCHEMA_V1.properties.context.additionalProperties, false);
});

test("crea el mismo evento e id con la misma semilla", () => {
  const datos = {
    type: "journey",
    actor: "bridge",
    verb: "arrived",
    object: "Argia",
    context: { station: "navigation" },
    sourceId: llegadaJournal.id,
  };
  const a = crearChronicleEvent(datos, { seed: "campaign-42" });
  const b = crearChronicleEvent(datos, { seed: "campaign-42" });

  assert.deepEqual(a, b);
  assert.match(a.id, /^chronicle-v1-[0-9a-f]{16}$/);
  assert.match(a.context.session, /^session-v1-[0-9a-f]{16}$/);
  assert.equal(validarChronicleEvent(a).valid, true);
});

test("la semilla distingue sesión e identidad sin usar azar global", () => {
  const datos = {
    type: "journey", actor: "bridge", verb: "arrived", object: "Argia",
    context: { station: "navigation" }, sourceId: llegadaJournal.id,
  };
  const a = crearChronicleEvent(datos, { seed: "session-a" });
  const b = crearChronicleEvent(datos, { seed: "session-b" });
  assert.notEqual(a.context.session, b.context.session);
  assert.notEqual(a.id, b.id);
});

test("rechaza propiedades extra, catálogos inventados y parejas incompatibles", () => {
  const valido = crearChronicleEvent({
    type: "journey", actor: "bridge", verb: "arrived", object: "Argia",
    context: { session: "session-1", station: "navigation" }, sourceId: llegadaJournal.id,
  });
  for (const evento of [
    { ...valido, extra: true },
    { ...valido, type: "achievement" },
    { ...valido, verb: "won" },
    { ...valido, verb: "started" },
    { ...valido, context: { ...valido.context, campaign: "secret" } },
  ]) {
    assert.equal(validarChronicleEvent(evento).valid, false, JSON.stringify(evento));
  }
});

function eventoChronicleValido() {
  return crearChronicleEvent({
    type: "journey", actor: "bridge", verb: "arrived", object: "Argia",
    context: { session: "session-1", station: "navigation" }, sourceId: llegadaJournal.id,
  });
}

test("rechaza un evento raíz heredado", () => {
  const valido = eventoChronicleValido();
  assert.equal(validarChronicleEvent(Object.create(valido)).valid, false);
});

test("rechaza un context heredado", () => {
  const valido = eventoChronicleValido();
  const evento = { ...valido, context: Object.create(valido.context) };
  assert.equal(validarChronicleEvent(evento).valid, false);
});

test("acepta todos los campos propios aunque haya una propiedad extra heredada", () => {
  const valido = eventoChronicleValido();
  const evento = Object.assign(Object.create({ extra: true }), valido);
  assert.equal(validarChronicleEvent(evento).valid, true);
});

test("acepta raíz y context sin prototipo", () => {
  const valido = eventoChronicleValido();
  const contextSinPrototipo = Object.assign(Object.create(null), valido.context);
  const raizSinPrototipo = Object.assign(Object.create(null), valido, {
    context: contextSinPrototipo,
  });
  assert.equal(validarChronicleEvent(raizSinPrototipo).valid, true);
});

test("expresa una llegada real de event-journal sin mutar el original", () => {
  const original = structuredClone(llegadaJournal);
  assert.equal(validEvent(llegadaJournal), true);
  const evento = adaptarEventoJournal(llegadaJournal, {
    seed: "mesa-2026-09-02",
    station: "navigation",
  });
  assert.equal(evento.type, "journey");
  assert.equal(evento.verb, "arrived");
  assert.equal(evento.object, "Argia");
  assert.equal(evento.actor, "bridge");
  assert.equal(validarChronicleEvent(evento).valid, true);
  assert.deepEqual(llegadaJournal, original);
  assert.equal(adaptarEventoJournal({ ...llegadaJournal, type: "unknown" }), null);
});

test("el adaptador delega la aceptación en event-journal", () => {
  const descriptor = DESCRIPTORES.get("arrival");
  registrarDescriptor({ ...descriptor, validar: () => false });
  try {
    assert.equal(adaptarEventoJournal(llegadaJournal, { seed: "mesa" }), null);
  } finally {
    registrarDescriptor(descriptor);
  }
});

test("un consumidor puro lee y deduplica por id", () => {
  const evento = adaptarEventoJournal(llegadaJournal, { seed: "mesa" });
  const otro = adaptarEventoJournal({ ...llegadaJournal, id: "arrival-s90-654321" }, { seed: "mesa" });
  const vistos = new Set();

  assert.deepEqual(consumirEventosUnicos([evento, evento, { ...evento }, otro], vistos), [evento, otro]);
  assert.deepEqual(consumirEventosUnicos([evento, otro], vistos), []);
  assert.deepEqual([...vistos], [evento.id, otro.id]);
});
