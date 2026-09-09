// Importador del atlas: detecta CSV de HYG o JSON de atlas, convierte y valida.
// Pruebas del consumidor que une catalogo-cosmografico.mjs y atlas-hyg.mjs (#634).

import assert from "node:assert/strict";
import test from "node:test";

import { importarAtlas, ImportadorAtlasError } from "../scripts/importador-atlas.mjs";
import { validateCosmography, CosmographyValidationError } from "../scripts/catalogo-cosmografico.mjs";
import { atlasDesdeHyg } from "../scripts/atlas-hyg.mjs";

const CSV_HYG_MINIMO = [
  "id,hip,proper,ra,dec,dist,mag,absmag,spect,ci",
  "0,,Sol,0,0,0.0000,-26.7,4.85,G2V,0.656",
  "70666,71683,Rigil Kentaurus,14.66,-60.83,1.3248,-0.01,4.38,G2V,0.71",
  "32263,32349,Sirius,6.75,-16.71,2.6371,-1.44,1.45,A1Vm,0.009",
].join("\n");

const JSON_COSMOGRAFICO_VALIDO = {
  format: "espaciokoop-cosmography",
  version: 1,
  entries: [
    {
      id: "mar-de-argia",
      type: "plane",
      name: { es: "Mar de Argia", en: "Argia Sea" },
      summary: { es: "Región luminosa.", en: "Luminous region." },
      continuity: "original",
      provenance: { kind: "original", source: "Espaciokoop Lagunak", license: "GPL-2.0-only" },
    },
    {
      id: "sistema-laguna",
      type: "star_system",
      parent_id: "mar-de-argia",
      name: { es: "Sistema Laguna", en: "Laguna System" },
      summary: { es: "Sistema de prueba.", en: "Test system." },
      continuity: "original",
      provenance: { kind: "original", source: "Espaciokoop Lagunak", license: "GPL-2.0-only" },
    },
  ],
};

test("detecta CSV de HYG por sus columnas canónicas", async () => {
  const catalogo = await importarAtlas(CSV_HYG_MINIMO);
  assert.equal(catalogo.format, "espaciokoop-cosmography");
  assert.equal(catalogo.version, 1);
  const sistemas = catalogo.entries.filter((e) => e.type === "star_system");
  assert.equal(sistemas.length, 3);
});

test("detecta JSON cosmográfico válido y lo valida", async () => {
  const catalogo = await importarAtlas(JSON.stringify(JSON_COSMOGRAFICO_VALIDO));
  assert.deepEqual(catalogo, JSON_COSMOGRAFICO_VALIDO);
});

test("JSON cosmográfico inválido lanza ImportadorAtlasError con código del validador", () => {
  const jsonInvalido = JSON.stringify({
    ...JSON_COSMOGRAFICO_VALIDO,
    entries: [
      {
        ...JSON_COSMOGRAFICO_VALIDO.entries[0],
        type: "portal", // tipo no válido
      },
    ],
  });
  assert.rejects(
    () => importarAtlas(jsonInvalido),
    (err) => {
      assert.ok(err instanceof ImportadorAtlasError);
      assert.equal(err.code, "invalid_type");
      assert.equal(err.path, "entries[0].type");
      return true;
    }
  );
});

test("contenido no reconocido lanza ImportadorAtlasError", () => {
  assert.rejects(
    () => importarAtlas("no es ni csv ni json"),
    (err) => {
      assert.ok(err instanceof ImportadorAtlasError);
      assert.equal(err.code, "unknown_format");
      return true;
    }
  );
});

test("JSON que no es cosmográfico lanza unknown_format", () => {
  const jsonGenerico = JSON.stringify({ foo: "bar" });
  assert.rejects(
    () => importarAtlas(jsonGenerico),
    (err) => {
      assert.ok(err instanceof ImportadorAtlasError);
      assert.equal(err.code, "unknown_format");
      return true;
    }
  );
});

test("CSV sin columna 'proper' lanza unknown_format", () => {
  const csvSinProper = "id,name,dist\n1,Alfa,1.0\n";
  assert.rejects(
    () => importarAtlas(csvSinProper),
    (err) => {
      assert.ok(err instanceof ImportadorAtlasError);
      assert.equal(err.code, "unknown_format");
      return true;
    }
  );
});

test("opciones se pasan a atlasDesdeHyg (maximo)", async () => {
  const catalogo = await importarAtlas(CSV_HYG_MINIMO, { maximo: 1 });
  const sistemas = catalogo.entries.filter((e) => e.type === "star_system");
  assert.equal(sistemas.length, 1);
  assert.equal(sistemas[0].name.es, "Sol"); // la más brillante
});

test("opciones se pasan a atlasDesdeHyg (versionHyg)", async () => {
  const catalogo = await importarAtlas(CSV_HYG_MINIMO, { versionHyg: "4.1" });
  const sistema = catalogo.entries.find((e) => e.type === "star_system");
  assert.equal(sistema.provenance.source, "HYG Database 4.1 (AstroNexus)");
});

test("ImportadorAtlasError extiende CosmographyValidationError para instanceof", async () => {
  // El error del importador ES un error del validador
  const jsonInvalido = JSON.stringify({
    ...JSON_COSMOGRAFICO_VALIDO,
    entries: [
      {
        ...JSON_COSMOGRAFICO_VALIDO.entries[0],
        type: "portal",
      },
    ],
  });
  try {
    await importarAtlas(jsonInvalido);
    assert.fail("debería haber lanzado");
  } catch (e) {
    assert.ok(e instanceof ImportadorAtlasError);
    assert.ok(e instanceof CosmographyValidationError);
  }
});

test("CSV vacío o solo cabecera devuelve catálogo con solo plano raíz (validado)", async () => {
  const catalogo = await importarAtlas("id,proper,dist,mag,spect\n");
  assert.equal(catalogo.entries.length, 1);
  assert.equal(catalogo.entries[0].type, "plane");
  assert.equal(catalogo.entries[0].id, "espacio-real");
  assert.equal(validateCosmography(catalogo), true);
});

test("JSON que parece cosmográfico pero falla JSON.parse lanza invalid_json", () => {
  const jsonRoto = '{"format":"espaciokoop-cosmography","version":1,"entries":[}';
  assert.rejects(
    () => importarAtlas(jsonRoto),
    (err) => {
      assert.ok(err instanceof ImportadorAtlasError);
      assert.equal(err.code, "invalid_json");
      return true;
    }
  );
});

test("lo que sale del importador siempre pasa validateCosmography", async () => {
  // CSV
  const deCSV = await importarAtlas(CSV_HYG_MINIMO);
  assert.equal(validateCosmography(deCSV), true);

  // JSON
  const deJSON = await importarAtlas(JSON.stringify(JSON_COSMOGRAFICO_VALIDO));
  assert.equal(validateCosmography(deJSON), true);
});
