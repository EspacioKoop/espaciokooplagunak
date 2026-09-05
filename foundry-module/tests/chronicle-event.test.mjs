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

test("la semilla es autoritativa ante una sesión explícita distinta o vacía", () => {
  const datos = {
    type: "journey", actor: "bridge", verb: "arrived", object: "Argia",
    context: { station: "navigation" }, sourceId: llegadaJournal.id,
  };
  const canonico = crearChronicleEvent(datos, { seed: "campaign-42" });

  for (const session of [canonico.context.session, "otra-sesion", ""]) {
    const evento = crearChronicleEvent({
      ...datos,
      context: { ...datos.context, session },
    }, { seed: "campaign-42" });
    assert.deepEqual(evento, canonico);
  }

  const semillaVacia = crearChronicleEvent({
    ...datos,
    context: { ...datos.context, session: "sesion-explicita" },
  }, { seed: "" });
  assert.notEqual(semillaVacia.context.session, "sesion-explicita");
  assert.deepEqual(semillaVacia, crearChronicleEvent(datos, { seed: "" }));
});

test("sin semilla la sesión explícita es autoritativa y separa identidades", () => {
  const datos = {
    type: "journey", actor: "bridge", verb: "arrived", object: "Argia",
    context: { station: "navigation" }, sourceId: llegadaJournal.id,
  };
  const a = crearChronicleEvent({
    ...datos, context: { ...datos.context, session: "session-a" },
  });
  const b = crearChronicleEvent({
    ...datos, context: { ...datos.context, session: "session-b" },
  });

  assert.equal(a.context.session, "session-a");
  assert.equal(b.context.session, "session-b");
  assert.notEqual(a.id, b.id);
  assert.throws(
    () => crearChronicleEvent({
      ...datos, context: { ...datos.context, session: "" },
    }),
    /context\.session inválido/,
  );
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

test("schema y validador aceptan exactamente las mismas parejas type/verb", () => {
  const parejas = CHRONICLE_EVENT_SCHEMA_V1.allOf.map((regla) => [
    regla.if.properties.type.const,
    regla.then.properties.verb.const,
  ]);
  assert.deepEqual(
    parejas.map(([type]) => type),
    CHRONICLE_EVENT_SCHEMA_V1.properties.type.enum,
  );
  const verbs = CHRONICLE_EVENT_SCHEMA_V1.properties.verb.enum;

  for (const [type, verbCanonico] of parejas) {
    for (const verb of verbs) {
      const evento = { ...eventoChronicleValido(), type, verb };
      assert.equal(
        validarChronicleEvent(evento).valid,
        verb === verbCanonico,
        `${type}/${verb}`,
      );
    }
  }
});

test("distingue campos raíz ausentes de propiedades no permitidas", () => {
  const { context: _context, ...sinContext } = eventoChronicleValido();
  const errors = validarChronicleEvent(sinContext).errors;

  assert.ok(errors.includes("faltan campos raíz: context"));
  assert.ok(!errors.includes("propiedades raíz no permitidas"));
});

test("mide maxLength como JSON Schema en puntos de código Unicode", () => {
  const valido = eventoChronicleValido();
  const casos = [
    [128, (value) => ({ ...valido, actor: value })],
    [256, (value) => ({ ...valido, object: value })],
    [128, (value) => ({ ...valido, context: { ...valido.context, session: value } })],
    [64, (value) => ({ ...valido, context: { ...valido.context, station: value } })],
  ];

  for (const [maxLength, crearEvento] of casos) {
    assert.equal(validarChronicleEvent(crearEvento("🚀".repeat(maxLength))).valid, true);
    assert.equal(validarChronicleEvent(crearEvento("🚀".repeat(maxLength + 1))).valid, false);
  }
});

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
