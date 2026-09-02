/**
 * Contrato canónico v1 de eventos de crónica (#866).
 *
 * Este módulo es deliberadamente puro: no conoce Foundry, Journal ni ningún
 * almacenamiento. Productores y consumidores comparten una forma cerrada y
 * pueden decidir por separado dónde obtener o guardar los eventos.
 */

import { validEvent } from "./event-journal.mjs";

const TYPES = Object.freeze(["journey", "encounter", "ship"]);
const VERBS = Object.freeze(["arrived", "started", "repositioned"]);
const TYPE_VERBS = Object.freeze({
  journey: "arrived",
  encounter: "started",
  ship: "repositioned",
});

export const CHRONICLE_EVENT_SCHEMA_V1 = Object.freeze({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://espaciokoop.eus/schemas/chronicle-event-v1.json",
  title: "ChronicleEvent v1",
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "id", "type", "actor", "verb", "object", "context"],
  properties: {
    schemaVersion: { const: 1 },
    id: { type: "string", pattern: "^chronicle-v1-[0-9a-f]{16}$" },
    type: { type: "string", enum: TYPES },
    actor: { type: "string", minLength: 1, maxLength: 128 },
    verb: { type: "string", enum: VERBS },
    object: { type: "string", minLength: 1, maxLength: 256 },
    context: {
      type: "object",
      additionalProperties: false,
      required: ["session", "station"],
      properties: {
        session: { type: "string", minLength: 1, maxLength: 128 },
        station: { type: "string", minLength: 1, maxLength: 64 },
      },
    },
  },
  allOf: TYPES.map((type) => ({
    if: { properties: { type: { const: type } }, required: ["type"] },
    then: { properties: { verb: { const: TYPE_VERBS[type] } } },
  })),
});

const ROOT_KEYS = new Set(CHRONICLE_EVENT_SCHEMA_V1.required);
const CONTEXT_KEYS = new Set(["session", "station"]);
const ID_PATTERN = /^chronicle-v1-[0-9a-f]{16}$/;

function textoAcotado(value, maxLength) {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

function soloClaves(object, permitidas) {
  if (object == null || typeof object !== "object" || Array.isArray(object)) return false;
  return Object.keys(object).every((key) => permitidas.has(key)) &&
    [...permitidas].every((key) => Object.hasOwn(object, key));
}

/** Valida sin Ajv ni globals de Foundry; devuelve errores aptos para tests/log. */
export function validarChronicleEvent(event) {
  const errors = [];
  if (!soloClaves(event, ROOT_KEYS)) errors.push("propiedades raíz no permitidas");
  if (event?.schemaVersion !== 1) errors.push("schemaVersion debe ser 1");
  if (!ID_PATTERN.test(event?.id ?? "")) errors.push("id no es ChronicleEvent v1");
  if (!TYPES.includes(event?.type)) errors.push("type fuera del catálogo");
  if (!VERBS.includes(event?.verb)) errors.push("verb fuera del catálogo");
  if (TYPE_VERBS[event?.type] !== event?.verb) errors.push("type/verb incompatibles");
  if (!textoAcotado(event?.actor, 128)) errors.push("actor inválido");
  if (!textoAcotado(event?.object, 256)) errors.push("object inválido");
  if (!soloClaves(event?.context, CONTEXT_KEYS)) errors.push("context inválido");
  if (!textoAcotado(event?.context?.session, 128)) errors.push("context.session inválido");
  if (!textoAcotado(event?.context?.station, 64)) errors.push("context.station inválido");
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

// FNV-1a de 64 bits sobre UTF-8: pequeño, síncrono y disponible igual en Node
// y navegador. No pretende ser criptográfico; fija identidad reproducible.
function hash64(value) {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(String(value))) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

function identidad(event, sourceId) {
  return JSON.stringify([
    event.schemaVersion, event.type, event.actor, event.verb, event.object,
    event.context.session, event.context.station, String(sourceId ?? ""),
  ]);
}

/**
 * Construye un evento. `seed` solo deriva la sesión cuando el productor no la
 * proporciona; con igual entrada y semilla, sesión e id son idénticos.
 */
export function crearChronicleEvent(datos, { seed } = {}) {
  const session = datos?.context?.session ??
    (seed == null ? null : `session-v1-${hash64(seed)}`);
  const base = {
    schemaVersion: 1,
    id: "",
    type: datos?.type,
    actor: datos?.actor,
    verb: datos?.verb,
    object: datos?.object,
    context: {
      session,
      station: datos?.context?.station,
    },
  };
  base.id = `chronicle-v1-${hash64(identidad(base, datos?.sourceId))}`;
  const resultado = validarChronicleEvent(base);
  if (!resultado.valid) {
    throw new TypeError(`ChronicleEvent inválido: ${resultado.errors.join(", ")}`);
  }
  return Object.freeze({ ...base, context: Object.freeze({ ...base.context }) });
}

/** Adapta el evento `arrival` real que ya acepta event-journal.mjs. */
export function adaptarEventoJournal(event, { seed, station = "navigation" } = {}) {
  if (
    event?.type !== "arrival" ||
    !validEvent(event) ||
    !textoAcotado(event.destination, 256)
  ) return null;

  return crearChronicleEvent({
    type: "journey",
    actor: "bridge",
    verb: "arrived",
    object: event.destination,
    context: { station },
    sourceId: event.id,
  }, { seed: seed ?? `${event.scenario}:${event.id}` });
}

/** Consumidor de referencia: valida, lee y entrega cada id una sola vez. */
export function consumirEventosUnicos(events, seenIds = new Set()) {
  if (!Array.isArray(events) || !(seenIds instanceof Set)) return [];
  const unique = [];
  for (const event of events) {
    if (!validarChronicleEvent(event).valid || seenIds.has(event.id)) continue;
    seenIds.add(event.id);
    unique.push(event);
  }
  return unique;
}
