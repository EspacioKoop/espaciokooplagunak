import assert from "node:assert/strict";
import test from "node:test";

import {
  CATEGORIAS_TOKEN,
  NATURALEZAS_TOKEN,
  creditoDe,
  tokenPorId,
  validarCatalogoTokens,
} from "../scripts/catalogo-tokens.mjs";
import { ErrorDeCatalogo } from "../scripts/procedencia-catalogo.mjs";

/** Un token mínimo válido, para deformarlo en cada caso. */
function tokenValido() {
  return {
    id: "campesino-01",
    categoria: "npc",
    dato: "campesino-01",
    naturaleza: "pixelart-original",
    nombre: { es: "Campesino", en: "Peasant" },
    provenance: {
      kind: "cc",
      source: "Gordy Higgins",
      license: "CC0 1.0",
      source_url: "https://gordyh.itch.io/",
    },
  };
}

function catalogoValido() {
  return { formato: "espaciokoop-tokens", version: 1, tokens: [tokenValido()] };
}

const DATOS = new Set(["campesino-01", "campesino-02"]);

function esperarCodigo(catalogo, code, path, opciones = {}) {
  assert.throws(
    () => validarCatalogoTokens(catalogo, opciones),
    (error) => {
      assert.equal(error.code, code);
      assert.equal(error.path, path);
      return true;
    },
  );
}

test("un catálogo bien formado pasa, con y sin comprobación de datos", () => {
  assert.equal(validarCatalogoTokens(catalogoValido()), true);
  assert.equal(validarCatalogoTokens(catalogoValido(), { datosDisponibles: DATOS }), true);
});

test("LA UNIÓN: una ficha que apunta a un dato inexistente es un error tipado (#891)", () => {
  const roto = catalogoValido();
  roto.tokens[0].dato = "token-que-no-esta";
  esperarCodigo(roto, "missing_reference", "tokens[0].dato", { datosDisponibles: DATOS });
});

test("la naturaleza del fichero es obligatoria y cerrada", () => {
  const sin = catalogoValido();
  delete sin.tokens[0].naturaleza;
  esperarCodigo(sin, "missing_field", "tokens[0].naturaleza");

  const inventada = catalogoValido();
  inventada.tokens[0].naturaleza = "dibujado-mas-o-menos";
  esperarCodigo(inventada, "invalid_naturaleza", "tokens[0].naturaleza");

  for (const naturaleza of NATURALEZAS_TOKEN) {
    const catalogo = catalogoValido();
    catalogo.tokens[0].naturaleza = naturaleza;
    assert.equal(validarCatalogoTokens(catalogo), true, naturaleza);
  }
});

test("la categoría es cerrada: cualquier valor fuera de la lista se rechaza", () => {
  const inventada = catalogoValido();
  inventada.tokens[0].categoria = "vehiculo";
  esperarCodigo(inventada, "invalid_categoria", "tokens[0].categoria");

  for (const categoria of CATEGORIAS_TOKEN) {
    const catalogo = catalogoValido();
    catalogo.tokens[0].categoria = categoria;
    assert.equal(validarCatalogoTokens(catalogo), true, categoria);
  }
});

test("no se puede declarar un token sin licencia, ni con fuente que no sea HTTPS", () => {
  const sinLicencia = catalogoValido();
  delete sinLicencia.tokens[0].provenance.license;
  esperarCodigo(sinLicencia, "missing_field", "tokens[0].provenance.license");

  const ccSinUrl = catalogoValido();
  delete ccSinUrl.tokens[0].provenance.source_url;
  esperarCodigo(ccSinUrl, "missing_field", "tokens[0].provenance.source_url");

  const insegura = catalogoValido();
  insegura.tokens[0].provenance.source_url = "http://ejemplo.test/algo";
  esperarCodigo(insegura, "invalid_url", "tokens[0].provenance.source_url");
});

test("los dos idiomas son obligatorios en el nombre", () => {
  const sinIngles = catalogoValido();
  delete sinIngles.tokens[0].nombre.en;
  esperarCodigo(sinIngles, "missing_field", "tokens[0].nombre.en");
});

test("IDs duplicados y campos desconocidos se rechazan con su ruta", () => {
  const duplicado = catalogoValido();
  duplicado.tokens.push(tokenValido());
  esperarCodigo(duplicado, "duplicate_id", "tokens[1].id");

  const errata = catalogoValido();
  errata.tokens[0].provenance.licence = "CC0";
  esperarCodigo(errata, "unknown_field", "tokens[0].provenance.licence");
});

test("el error es del mismo tipo que el de piezas: una sola regla de procedencia", () => {
  assert.throws(
    () => validarCatalogoTokens({ formato: "otra-cosa", version: 1, tokens: [] }),
    (error) => error instanceof ErrorDeCatalogo,
  );
});

test("el crédito deriva de la procedencia, nunca se escribe al lado", () => {
  const catalogo = catalogoValido();
  const credito = creditoDe(catalogo.tokens[0], "es");
  assert.equal(credito.titulo, "Campesino");
  assert.equal(credito.categoria, "npc");
  assert.equal(credito.credito, "Gordy Higgins — CC0 1.0");
  assert.equal(credito.claveNaturaleza, "LAGUNAK.Tokens.Naturaleza.pixelart-original");

  const ingles = creditoDe(catalogo.tokens[0], "en");
  assert.equal(ingles.titulo, "Peasant");
  assert.equal(creditoDe(catalogo.tokens[0], "eu").titulo, "Campesino");
  assert.equal(creditoDe(catalogo.tokens[0], "en-GB").titulo, "Peasant");
  assert.equal(creditoDe(catalogo.tokens[0], undefined).titulo, "Campesino");
});

test("buscar un token que no está responde null, no revienta", () => {
  const catalogo = catalogoValido();
  assert.equal(tokenPorId(catalogo, "campesino-01").id, "campesino-01");
  assert.equal(tokenPorId(catalogo, "no-existe"), null);
  assert.equal(tokenPorId(null, "campesino-01"), null);
});
