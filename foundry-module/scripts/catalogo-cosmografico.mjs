// Validador del formato de atlas: planos, sistemas estelares y planetas, con
// procedencia y licencia por entrada, continuidad declarada y errores tipados.
// Puro: ni Foundry, ni DOM, ni red.
//
// ## CIMIENTO SIN CONSUMIDOR, A PROPÓSITO (#525)
//
// Ningún módulo importa esto, y es una decisión tomada, no un descuido. Es la
// base de datos del atlas de #213, que sigue siendo **investigación a validar**
// a la espera de que Varo y Eloy cierren la decisión en su issue. Cablearlo por
// iniciativa propia promovería a hecho una decisión que no está tomada, que es
// justo lo que prohíbe la sección de mantenimiento de documentación de
// `CLAUDE.md`.
//
// La alternativa que se descartó fue retirarlo y recuperarlo de git cuando #213
// se decida: el formato ya está pensado y probado, y borrarlo solo garantiza que
// el siguiente que lo necesite lo escriba otra vez peor.
//
// Está declarado en `HUERFANOS_DECLARADOS` (`tests/modulos-alcanzables.test.mjs`)
// con `cimiento: true`, así que la guarda de alcanzabilidad de #523 no se queja
// de él — pero fallará el día que se cablee y nadie actualice esa lista.

import {
  ErrorDeCatalogo,
  PATRON_ID as ID_PATTERN,
  clavesExactas as exactKeys,
  esObjetoSimple as isPlainObject,
  fallo as fail,
  tamanoSerializado as serializedSize,
  textoLocalizado as localizedText,
  validarProcedencia as validateProvenance,
} from "./procedencia-catalogo.mjs";

const FORMAT = "espaciokoop-cosmography";
const VERSION = 1;
const MAX_ENTRIES = 2000;
const MAX_SERIALIZED_BYTES = 1024 * 1024;
const ENTRY_TYPES = new Set(["plane", "star_system", "planet"]);
const CONTINUITIES = new Set(["original", "homebrew", "spelljammer-5e", "spelljammer-legacy"]);
const ENTRY_KEYS = new Set([
  "id", "type", "parent_id", "name", "summary", "continuity", "provenance",
]);

export const COSMOGRAPHY_FORMAT = FORMAT;
export const COSMOGRAPHY_VERSION = VERSION;
export const COSMOGRAPHY_ENTRY_TYPES = Object.freeze(["plane", "star_system", "planet"]);

/**
 * El error de este catálogo ES el de cualquier catálogo con procedencia (#598).
 *
 * Se conserva el nombre exportado porque es el contrato que ya usan sus pruebas
 * y quien lo importe: lo que cambió es que la clase la define
 * `procedencia-catalogo.mjs`, para que un `instanceof` valga igual atrapando un
 * error del atlas que uno del museo.
 */
export { ErrorDeCatalogo as CosmographyValidationError };

function validateEntryShape(entry, index) {
  const path = `entries[${index}]`;
  exactKeys(
    entry,
    ENTRY_KEYS,
    new Set(["id", "type", "name", "summary", "continuity", "provenance"]),
    path,
  );
  if (typeof entry.id !== "string" || !ID_PATTERN.test(entry.id)) {
    fail("invalid_id", `${path}.id`, "ID portable no válido");
  }
  if (!ENTRY_TYPES.has(entry.type)) {
    fail("invalid_type", `${path}.type`, "tipo cosmográfico no admitido");
  }
  const hasParent = Object.hasOwn(entry, "parent_id");
  if (entry.type === "plane" && hasParent) {
    fail("invalid_parent", `${path}.parent_id`, "un plano no admite padre en v1");
  }
  if (entry.type !== "plane" && !hasParent) {
    fail("missing_parent", `${path}.parent_id`, "la entrada necesita un padre");
  }
  if (hasParent && (typeof entry.parent_id !== "string" || !ID_PATTERN.test(entry.parent_id))) {
    fail("invalid_parent", `${path}.parent_id`, "ID de padre no válido");
  }
  localizedText(entry.name, `${path}.name`, 120);
  localizedText(entry.summary, `${path}.summary`, 600);
  if (!CONTINUITIES.has(entry.continuity)) {
    fail("invalid_continuity", `${path}.continuity`, "continuidad no admitida");
  }
  validateProvenance(entry.provenance, `${path}.provenance`);
}

export function validateCosmography(catalog) {
  if (!isPlainObject(catalog)) fail("invalid_object", "$", "debe ser un objeto simple");
  if (serializedSize(catalog) > MAX_SERIALIZED_BYTES) {
    fail("too_large", "$", "el catálogo supera 1 MiB serializado");
  }
  exactKeys(catalog, new Set(["format", "version", "entries"]), new Set(["format", "entries"]), "$" );
  if (!Object.hasOwn(catalog, "version")) {
    fail("missing_version", "$.version", "versión obligatoria ausente");
  }
  if (catalog.format !== FORMAT) fail("invalid_format", "$.format", "formato desconocido");
  if (catalog.version !== VERSION) {
    fail("invalid_version", "$.version", "versión no compatible");
  }
  if (!Array.isArray(catalog.entries)) fail("invalid_entries", "$.entries", "debe ser una lista");
  if (catalog.entries.length > MAX_ENTRIES) fail("too_many_entries", "$.entries", "demasiadas entradas");

  const byId = new Map();
  catalog.entries.forEach((entry, index) => {
    validateEntryShape(entry, index);
    if (byId.has(entry.id)) fail("duplicate_id", `entries[${index}].id`, "ID duplicado");
    byId.set(entry.id, { entry, index });
  });

  for (const { entry, index } of byId.values()) {
    if (entry.type === "plane") continue;
    const parent = byId.get(entry.parent_id);
    if (!parent) fail("missing_reference", `entries[${index}].parent_id`, "el padre no existe");
    const expected = entry.type === "star_system" ? "plane" : "star_system";
    if (parent.entry.type !== expected) {
      fail("invalid_hierarchy", `entries[${index}].parent_id`, `el padre debe ser ${expected}`);
    }
  }
  return true;
}
