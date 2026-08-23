// Importador de atlas: pruebas de que une CSV de HYG y JSON de atlas validado.

import assert from "node:assert/strict";
import test from "node:test";

import { importarAtlas, CosmographyValidationError } from "../scripts/atlas-importar.mjs";
import { validateCosmography } from "../scripts/catalogo-cosmografico.mjs";
import { atlasDesdeHyg } from "../scripts/atlas-hyg.mjs";

const CSV_HYG = [
  "id,hip,proper,ra,dec,dist,mag,absmag,spect,ci",
  "0,,Sol,0,0,0.0000,-26.7,4.85,G2V,0.656",
  "70666,71683,Rigil Kentaurus,14.66,-60.83,1.3248,-0.01,4.38,G2V,0.71",
  "32263,32349,Sirius,6.75,-16.71,2.6371,-1.44,1.45,A1Vm,0.009",
  "24378,24436,Rigel,5.24,-8.20,236.9668,0.18,-6.69,B8Ia,-0.03",
].join("\n");

const ATLAS_JSON_VALIDO = JSON.stringify(atlasDesdeHyg(CSV_HYG));

test("detecta CSV de HYG por la columna 'proper' y lo convierte", () => {
  const catalogo = importarAtlas(CSV_HYG);
  const sistemas = catalogo.entries.filter((e) => e.type === "star_system");
  assert.equal(sistemas.length, 4);
  assert.deepEqual(sistemas.map((e) => e.name.es), ["Sol", "Sirius", "Rigil Kentaurus", "Rigel"]);
  assert.equal(catalogo.format, "espaciokoop-cosmography");
  assert.equal(catalogo.version, 1);
});

test("acepta JSON de atlas ya hecho y lo valida", () => {
  const catalogo = importarAtlas(ATLAS_JSON_VALIDO);
  assert.equal(catalogo.entries.length, 5); // 1 plano + 4 estrellas
  assert.ok(catalogo.entries.some((e) => e.type === "plane"));
});

test("rechaza contenido vacío", () => {
  assert.throws(
    () => importarAtlas(""),
    (e) => e instanceof CosmographyValidationError && e.code === "invalid_input",
  );
  assert.throws(
    () => importarAtlas("   "),
    (e) => e instanceof CosmographyValidationError && e.code === "invalid_input",
  );
});

test("rechaza CSV sin columna 'proper'", () => {
  const sinProper = ["id,hip,ra,dec,dist,mag", "1,2,0,0,1.0,5.0"].join("\n");
  assert.throws(
    () => importarAtlas(sinProper),
    (e) => e instanceof CosmographyValidationError && e.code === "invalid_json",
  );
});

test("rechaza JSON inválido", () => {
  assert.throws(
    () => importarAtlas("{no es json}"),
    (e) => e instanceof CosmographyValidationError && e.code === "invalid_json",
  );
});

test("rechaza JSON que no pasa la validación cosmográfica", () => {
  const jsonInvalido = JSON.stringify({
    format: "espaciokoop-cosmography",
    version: 1,
    entries: [
      {
        id: "malo",
        type: "portal",
        name: { es: "Malo", en: "Bad" },
        summary: { es: "Resumen", en: "Summary" },
        continuity: "original",
        provenance: { kind: "original", source: "Test", license: "GPL-2.0" },
      },
    ],
  });
  assert.throws(
    () => importarAtlas(jsonInvalido),
    (e) => e instanceof CosmographyValidationError && e.code === "invalid_type",
  );
});

test("pasa opciones maximo y versionHyg al adaptador HYG", () => {
  const catalogo = importarAtlas(CSV_HYG, { maximo: 2, versionHyg: "4.1" });
  const sistemas = catalogo.entries.filter((e) => e.type === "star_system");
  assert.equal(sistemas.length, 2);
  assert.deepEqual(sistemas.map((e) => e.name.es), ["Sol", "Sirius"]);
  for (const s of sistemas) {
    assert.equal(s.provenance.source, "HYG Database 4.1 (AstroNexus)");
  }
});

test("el catálogo devuelto pasa validateCosmography", () => {
  const catalogo = importarAtlas(CSV_HYG);
  assert.equal(validateCosmography(catalogo), true);
});

test("exporta CosmographyValidationError para que quien llama pueda atraparlo tipado", () => {
  assert.ok(CosmographyValidationError);
  const error = new CosmographyValidationError("test", "$.test", "mensaje");
  assert.equal(error.code, "test");
  assert.equal(error.path, "$.test");
});