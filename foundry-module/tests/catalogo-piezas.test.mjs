import assert from "node:assert/strict";
import test from "node:test";

import {
  NATURALEZAS,
  cartelaDe,
  getPiezaCatalogada,
  piezaPorId,
  registrarCatalogoPiezas,
  validarCatalogoPiezas,
} from "../scripts/catalogo-piezas.mjs";
import { CosmographyValidationError } from "../scripts/catalogo-cosmografico.mjs";

/** Una pieza mínima válida, para deformarla en cada caso. */
function piezaValida() {
  return {
    id: "pieza-uno",
    malla: "pieza-uno",
    naturaleza: "escaneo-de-vaciado",
    nombre: { es: "Pieza uno", en: "Piece one" },
    cartela: { es: "Un vaciado en yeso.", en: "A plaster cast." },
    provenance: {
      kind: "cc",
      source: "Un museo",
      license: "CC0 1.0",
      source_url: "https://commons.wikimedia.org/wiki/Category:Algo",
    },
  };
}

function catalogoValido() {
  return { formato: "espaciokoop-piezas", version: 1, piezas: [piezaValida()] };
}

const MALLAS = new Set(["pieza-uno", "pieza-dos"]);

function esperarCodigo(catalogo, code, path, opciones = {}) {
  assert.throws(
    () => validarCatalogoPiezas(catalogo, opciones),
    (error) => {
      assert.equal(error.code, code);
      assert.equal(error.path, path);
      return true;
    },
  );
}

test("un catálogo bien formado pasa, con y sin comprobación de mallas", () => {
  assert.equal(validarCatalogoPiezas(catalogoValido()), true);
  assert.equal(validarCatalogoPiezas(catalogoValido(), { mallasDisponibles: MALLAS }), true);
});

test("LA UNIÓN: una ficha que apunta a una malla inexistente es un error tipado (#598)", () => {
  const roto = catalogoValido();
  roto.piezas[0].malla = "estatua-que-no-esta";
  esperarCodigo(roto, "missing_reference", "piezas[0].malla", { mallasDisponibles: MALLAS });
});

test("la naturaleza del fichero es obligatoria y cerrada: es lo que impide la cartela mentirosa", () => {
  const sin = catalogoValido();
  delete sin.piezas[0].naturaleza;
  esperarCodigo(sin, "missing_field", "piezas[0].naturaleza");

  const inventada = catalogoValido();
  inventada.piezas[0].naturaleza = "escaneo-mas-o-menos";
  esperarCodigo(inventada, "invalid_naturaleza", "piezas[0].naturaleza");

  for (const naturaleza of NATURALEZAS) {
    const catalogo = catalogoValido();
    catalogo.piezas[0].naturaleza = naturaleza;
    assert.equal(validarCatalogoPiezas(catalogo), true, naturaleza);
  }
});

test("no se puede declarar una pieza sin licencia, ni con fuente que no sea HTTPS", () => {
  const sinLicencia = catalogoValido();
  delete sinLicencia.piezas[0].provenance.license;
  esperarCodigo(sinLicencia, "missing_field", "piezas[0].provenance.license");

  const ccSinUrl = catalogoValido();
  delete ccSinUrl.piezas[0].provenance.source_url;
  esperarCodigo(ccSinUrl, "missing_field", "piezas[0].provenance.source_url");

  const insegura = catalogoValido();
  insegura.piezas[0].provenance.source_url = "http://ejemplo.test/algo";
  esperarCodigo(insegura, "invalid_url", "piezas[0].provenance.source_url");
});

test("los dos idiomas son obligatorios: una cartela a medias no llega a la mesa", () => {
  const sinIngles = catalogoValido();
  delete sinIngles.piezas[0].cartela.en;
  esperarCodigo(sinIngles, "missing_field", "piezas[0].cartela.en");
});

test("ni etiquetas ni controles en el texto: la cartela se pinta como texto plano", () => {
  const conEtiqueta = catalogoValido();
  conEtiqueta.piezas[0].cartela.es = "Un <b>vaciado</b>";
  esperarCodigo(conEtiqueta, "unsafe_text", "piezas[0].cartela.es");
});

test("IDs duplicados y campos desconocidos se rechazan con su ruta", () => {
  const duplicado = catalogoValido();
  duplicado.piezas.push(piezaValida());
  esperarCodigo(duplicado, "duplicate_id", "piezas[1].id");

  const errata = catalogoValido();
  errata.piezas[0].provenance.licence = "CC0";
  esperarCodigo(errata, "unknown_field", "piezas[0].provenance.licence");
});

test("el error es EL MISMO tipo que el del atlas: una sola regla de procedencia (#598)", () => {
  assert.throws(
    () => validarCatalogoPiezas({ formato: "otra-cosa", version: 1, piezas: [] }),
    (error) => error instanceof CosmographyValidationError,
  );
});

test("la cartela deriva el crédito de la procedencia, nunca se escribe al lado", () => {
  const catalogo = catalogoValido();
  const cartela = cartelaDe(catalogo.piezas[0], "es");
  assert.equal(cartela.titulo, "Pieza uno");
  assert.equal(cartela.texto, "Un vaciado en yeso.");
  assert.equal(cartela.credito, "Un museo — CC0 1.0");
  assert.equal(cartela.claveNaturaleza, "LAGUNAK.Museo.Naturaleza.escaneo-de-vaciado");

  const ingles = cartelaDe(catalogo.piezas[0], "en");
  assert.equal(ingles.titulo, "Piece one");
  // Cualquier idioma que no sea uno de los dos cae al español, que es en el que
  // se escribe el contenido: mejor una cartela en español que ninguna.
  assert.equal(cartelaDe(catalogo.piezas[0], "eu").titulo, "Pieza uno");
  // Un anfitrión en `en-GB` no se queda sin cartela inglesa por dos caracteres.
  assert.equal(cartelaDe(catalogo.piezas[0], "en-GB").titulo, "Piece one");
  assert.equal(cartelaDe(catalogo.piezas[0], undefined).titulo, "Pieza uno");
});

test("buscar una pieza que no está responde null, no revienta", () => {
  const catalogo = catalogoValido();
  assert.equal(piezaPorId(catalogo, "pieza-uno").id, "pieza-uno");
  assert.equal(piezaPorId(catalogo, "no-existe"), null);
  assert.equal(piezaPorId(null, "pieza-uno"), null);
});

/** Como `catalogoValido()`, pero con un id que ningún otro test de este
 *  fichero usa: el registro es un Map a nivel de módulo y persiste entre
 *  tests, así que reusar "pieza-uno" aquí colisionaría con otro test. */
function catalogoConId(id) {
  const catalogo = catalogoValido();
  catalogo.piezas[0].id = id;
  catalogo.piezas[0].malla = id;
  return catalogo;
}

test("getPiezaCatalogada resuelve una pieza registrada sin conocer su catálogo (#598)", () => {
  const catalogo = catalogoConId("registro-uno");
  registrarCatalogoPiezas(catalogo);
  assert.equal(getPiezaCatalogada("registro-uno"), catalogo.piezas[0]);
  assert.equal(getPiezaCatalogada("no-existe-en-ningun-catalogo"), null);
});

test("registrar el mismo catálogo dos veces no revienta (misma pieza, no duplicado)", () => {
  const catalogo = catalogoConId("registro-dos");
  registrarCatalogoPiezas(catalogo);
  // Segunda vez: es el MISMO objeto de catálogo, así que sus piezas son el
  // mismo objeto por identidad y no cuentan como duplicado entre catálogos.
  registrarCatalogoPiezas(catalogo);
  assert.equal(getPiezaCatalogada("registro-dos"), catalogo.piezas[0]);
});

test("dos catálogos distintos con el mismo id de pieza es un error, no un silencio", () => {
  const uno = catalogoConId("registro-tres");
  const otro = catalogoConId("registro-tres");
  registrarCatalogoPiezas(uno);
  assert.throws(() => registrarCatalogoPiezas(otro), /Pieza duplicada/);
});
