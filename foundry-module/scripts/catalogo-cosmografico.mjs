const FORMAT = "espaciokoop-cosmography";
const VERSION = 1;
const MAX_ENTRIES = 2000;
const MAX_SERIALIZED_BYTES = 1024 * 1024;
const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const ENTRY_TYPES = new Set(["plane", "star_system", "planet"]);
const PROVENANCE_KINDS = new Set(["original", "cc", "user_supplied"]);
const CONTINUITIES = new Set(["original", "homebrew", "spelljammer-5e", "spelljammer-legacy"]);
const ENTRY_KEYS = new Set([
  "id", "type", "parent_id", "name", "summary", "continuity", "provenance",
]);
const PROVENANCE_KEYS = new Set(["kind", "source", "license", "source_url"]);
const LOCALIZED_KEYS = new Set(["es", "en"]);

export const COSMOGRAPHY_FORMAT = FORMAT;
export const COSMOGRAPHY_VERSION = VERSION;
export const COSMOGRAPHY_ENTRY_TYPES = Object.freeze(["plane", "star_system", "planet"]);

export class CosmographyValidationError extends Error {
  constructor(code, path, message) {
    super(`${path}: ${message}`);
    this.name = "CosmographyValidationError";
    this.code = code;
    this.path = path;
  }
}

function fail(code, path, message) {
  throw new CosmographyValidationError(code, path, message);
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, allowed, required, path) {
  if (!isPlainObject(value)) fail("invalid_object", path, "debe ser un objeto simple");
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail("unknown_field", `${path}.${key}`, "campo no permitido");
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) fail("missing_field", `${path}.${key}`, "campo obligatorio ausente");
  }
}

function plainText(value, path, maxLength) {
  if (
    typeof value !== "string"
    || value.length === 0
    || value.length > maxLength
    || value.trim() !== value
  ) {
    fail("invalid_text", path, `debe contener entre 1 y ${maxLength} caracteres sin espacios exteriores`);
  }
  if (/[\u0000-\u001f\u007f<>]/u.test(value)) {
    fail("unsafe_text", path, "solo admite texto plano sin controles ni etiquetas");
  }
}

function localizedText(value, path, maxLength) {
  exactKeys(value, LOCALIZED_KEYS, LOCALIZED_KEYS, path);
  plainText(value.es, `${path}.es`, maxLength);
  plainText(value.en, `${path}.en`, maxLength);
}

function validateProvenance(value, path) {
  exactKeys(value, PROVENANCE_KEYS, new Set(["kind", "source", "license"]), path);
  if (!PROVENANCE_KINDS.has(value.kind)) {
    fail("invalid_provenance", `${path}.kind`, "procedencia no admitida");
  }
  plainText(value.source, `${path}.source`, 160);
  plainText(value.license, `${path}.license`, 80);
  if (Object.hasOwn(value, "source_url")) {
    plainText(value.source_url, `${path}.source_url`, 500);
    let parsed;
    try {
      parsed = new URL(value.source_url);
    } catch {
      fail("invalid_url", `${path}.source_url`, "URL inválida");
    }
    if (parsed.protocol !== "https:") {
      fail("invalid_url", `${path}.source_url`, "la fuente debe usar HTTPS");
    }
  }
  if (value.kind === "cc" && !Object.hasOwn(value, "source_url")) {
    fail("missing_field", `${path}.source_url`, "el contenido CC necesita una fuente HTTPS");
  }
}

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

function serializedSize(value) {
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch {
    fail("not_serializable", "$", "el catálogo no se puede serializar como JSON");
  }
  if (serialized === undefined) fail("not_serializable", "$", "el catálogo no se puede serializar como JSON");
  return new TextEncoder().encode(serialized).byteLength;
}

export function validateCosmography(catalog) {
  if (!isPlainObject(catalog)) fail("invalid_object", "$", "debe ser un objeto simple");
  if (serializedSize(catalog) > MAX_SERIALIZED_BYTES) {
    fail("too_large", "$", "el catálogo supera 1 MiB serializado");
  }
  exactKeys(catalog, new Set(["format", "version", "entries"]), new Set(["format", "version", "entries"]), "$" );
  if (catalog.format !== FORMAT) fail("invalid_format", "$.format", "formato desconocido");
  if (catalog.version !== VERSION) fail("invalid_version", "$.version", "versión no compatible");
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
