import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  COSMOGRAPHY_ENTRY_TYPES,
  COSMOGRAPHY_FORMAT,
  COSMOGRAPHY_VERSION,
  CosmographyValidationError,
  validateCosmography,
} from "../scripts/catalogo-cosmografico.mjs";

const example = JSON.parse(
  await readFile(new URL("../data/cosmografia.example.json", import.meta.url), "utf8"),
);

function clone(value = example) {
  return structuredClone(value);
}

function expectCode(catalog, code, path = null) {
  assert.throws(
    () => validateCosmography(catalog),
    (error) => {
      assert.ok(error instanceof CosmographyValidationError);
      assert.equal(error.code, code);
      if (path !== null) assert.equal(error.path, path);
      return true;
    },
  );
}

test("el catálogo original de ejemplo cumple el formato cosmográfico v1", () => {
  assert.equal(example.format, COSMOGRAPHY_FORMAT);
  assert.equal(example.version, COSMOGRAPHY_VERSION);
  assert.deepEqual(COSMOGRAPHY_ENTRY_TYPES, ["plane", "star_system", "planet"]);
  assert.equal(validateCosmography(example), true);
  assert.deepEqual(example.entries.map(({ type }) => type), ["plane", "star_system", "planet"]);
});

test("el ejemplo distribuido solo contiene procedencia y continuidad originales", () => {
  for (const entry of example.entries) {
    assert.equal(entry.continuity, "original");
    assert.equal(entry.provenance.kind, "original");
    assert.equal(entry.provenance.source, "Espaciokoop Lagunak");
    assert.equal(entry.provenance.license, "GPL-2.0-only");
    assert.equal(Object.hasOwn(entry.provenance, "source_url"), false);
  }
});

test("las referencias pueden aparecer antes que sus padres, pero deben ser válidas", () => {
  const catalog = clone();
  catalog.entries.reverse();
  assert.equal(validateCosmography(catalog), true);
});

test("rechaza IDs duplicados y referencias ausentes", () => {
  const duplicate = clone();
  duplicate.entries[2].id = duplicate.entries[1].id;
  expectCode(duplicate, "duplicate_id", "entries[2].id");

  const missing = clone();
  missing.entries[2].parent_id = "sistema-ausente";
  expectCode(missing, "missing_reference", "entries[2].parent_id");
});

test("impone la jerarquía plano, sistema estelar y planeta", () => {
  const planeWithParent = clone();
  planeWithParent.entries[0].parent_id = "sistema-laguna";
  expectCode(planeWithParent, "invalid_parent", "entries[0].parent_id");

  const systemWithoutParent = clone();
  delete systemWithoutParent.entries[1].parent_id;
  expectCode(systemWithoutParent, "missing_parent", "entries[1].parent_id");

  const planetUnderPlane = clone();
  planetUnderPlane.entries[2].parent_id = "mar-de-argia";
  expectCode(planetUnderPlane, "invalid_hierarchy", "entries[2].parent_id");
});

test("rechaza tipos e IDs fuera del contrato cerrado", () => {
  const badType = clone();
  badType.entries[0].type = "portal";
  expectCode(badType, "invalid_type", "entries[0].type");

  const badId = clone();
  badId.entries[0].id = "Plano Oficial";
  expectCode(badId, "invalid_id", "entries[0].id");

  const badContinuity = clone();
  badContinuity.entries[0].continuity = "canon-supuesto";
  expectCode(badContinuity, "invalid_continuity", "entries[0].continuity");
});

test("rechaza explícitamente una versión ausente", () => {
  const missingVersion = clone();
  delete missingVersion.version;
  expectCode(missingVersion, "missing_version", "$.version");
});

test("rechaza explícitamente una versión desconocida", () => {
  const unsupportedVersion = clone();
  unsupportedVersion.version = 2;
  expectCode(unsupportedVersion, "invalid_version", "$.version");
});

test("v1 conserva semántica en round-trip con source_url opcional", () => {
  const catalog = clone();
  catalog.entries[0].provenance.source_url = "https://example.invalid/mar-de-argia";

  const roundTripped = JSON.parse(JSON.stringify(catalog));

  assert.equal(validateCosmography(roundTripped), true);
  assert.deepEqual(roundTripped, catalog);
  assert.equal(roundTripped.version, COSMOGRAPHY_VERSION);
});

test("rechaza campos desconocidos y payloads ejecutables", () => {
  const rootField = clone();
  rootField.script = "doSomething()";
  expectCode(rootField, "unknown_field", "$.script");

  const entryField = clone();
  entryField.entries[2].macro = "game.socket.emit('x')";
  expectCode(entryField, "unknown_field", "entries[2].macro");

  const provenanceField = clone();
  provenanceField.entries[0].provenance.html = "<img>";
  expectCode(provenanceField, "unknown_field", "entries[0].provenance.html");
});

test("nombres y resúmenes son bilingües y de texto plano", () => {
  const missingEnglish = clone();
  delete missingEnglish.entries[0].name.en;
  expectCode(missingEnglish, "missing_field", "entries[0].name.en");

  const html = clone();
  html.entries[0].summary.es = "<script>alert(1)</script>";
  expectCode(html, "unsafe_text", "entries[0].summary.es");

  const control = clone();
  control.entries[0].name.es = "Mar\u0000oculto";
  expectCode(control, "unsafe_text", "entries[0].name.es");

  const padded = clone();
  padded.entries[0].name.es = " Mar de Argia ";
  expectCode(padded, "invalid_text", "entries[0].name.es");
});

test("la procedencia es cerrada y las fuentes remotas exigen HTTPS", () => {
  const badKind = clone();
  badKind.entries[0].provenance.kind = "official_assumed";
  expectCode(badKind, "invalid_provenance", "entries[0].provenance.kind");

  const insecureUrl = clone();
  insecureUrl.entries[0].provenance.source_url = "http://example.invalid/source";
  expectCode(insecureUrl, "invalid_url", "entries[0].provenance.source_url");

  const credentialUrl = clone();
  credentialUrl.entries[0].provenance.source_url = "https://usuario:secreto@example.invalid/source";
  expectCode(credentialUrl, "invalid_url", "entries[0].provenance.source_url");

  const ccWithoutSource = clone();
  ccWithoutSource.entries[0].provenance.kind = "cc";
  ccWithoutSource.entries[0].provenance.license = "CC-BY-4.0";
  expectCode(ccWithoutSource, "missing_field", "entries[0].provenance.source_url");

  const cc = clone();
  cc.entries[0].provenance = {
    kind: "cc",
    source: "Fuente de ejemplo",
    license: "CC-BY-4.0",
    source_url: "https://example.invalid/source",
  };
  assert.equal(validateCosmography(cc), true);
});

test("limita el número de entradas y el tamaño serializado", () => {
  const tooMany = clone();
  tooMany.entries = Array.from({ length: 2001 }, (_, index) => ({
    ...clone().entries[0],
    id: `plano-${index}`,
  }));
  expectCode(tooMany, "too_many_entries", "$.entries");

  const tooLarge = clone();
  tooLarge.padding = "x".repeat(1024 * 1024);
  expectCode(tooLarge, "too_large", "$");
});

test("rechaza raíces no serializables o que no sean objetos simples", () => {
  expectCode(null, "invalid_object", "$");
  expectCode([], "invalid_object", "$");

  const cyclic = clone();
  cyclic.self = cyclic;
  expectCode(cyclic, "not_serializable", "$");
});
