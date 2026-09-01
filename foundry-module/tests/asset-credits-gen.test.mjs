// El generador de créditos (#891): el crédito se deriva de la procedencia, y el
// script solo lo vuelca a markdown. No hay catálogo de ejemplo escrito a mano
// aquí: los datos de prueba pasan por `validarCatalogoPiezas`/
// `validarCatalogoTokens` primero, igual que tendría que hacerlo cualquier
// catálogo real antes de generar créditos.

import assert from "node:assert/strict";
import test from "node:test";

import { generarCreditos } from "../../tools/asset-credits-gen.mjs";
import { validarCatalogoPiezas } from "../scripts/catalogo-piezas.mjs";
import { validarCatalogoTokens } from "../scripts/catalogo-tokens.mjs";

function catalogoPiezasDePrueba() {
  const catalogo = {
    formato: "espaciokoop-piezas",
    version: 1,
    piezas: [
      {
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
      },
    ],
  };
  validarCatalogoPiezas(catalogo);
  return catalogo.piezas;
}

function catalogoTokensDePrueba() {
  const catalogo = {
    formato: "espaciokoop-tokens",
    version: 1,
    tokens: [
      {
        id: "campesino-01",
        categoria: "npc",
        dato: "campesino-01",
        naturaleza: "pixelart-original",
        nombre: { es: "Campesino", en: "Peasant" },
        provenance: { kind: "cc", source: "Gordy Higgins", license: "CC0", source_url: "https://gordyh.itch.io/" },
      },
    ],
  };
  validarCatalogoTokens(catalogo);
  return catalogo.tokens;
}

test("sin ninguna entrada, el markdown lo dice en vez de mentir con datos de ejemplo", () => {
  const markdown = generarCreditos({});
  assert.match(markdown, /Sin assets curados todavía/);
});

test("una pieza produce su línea de crédito, derivada de la procedencia", () => {
  const markdown = generarCreditos({ piezas: catalogoPiezasDePrueba() });
  assert.match(markdown, /## Piezas 3D/);
  assert.match(markdown, /\*\*Pieza uno\*\* — Un museo — CC0 1\.0/);
  assert.match(markdown, /commons\.wikimedia\.org/);
});

test("un token produce su línea de crédito con su categoría", () => {
  const markdown = generarCreditos({ tokens: catalogoTokensDePrueba() });
  assert.match(markdown, /## Tokens 2D/);
  assert.match(markdown, /\*\*Campesino\*\* \(npc\) — Gordy Higgins — CC0/);
});

test("el markdown es determinista: la misma entrada produce el mismo texto", () => {
  const piezas = catalogoPiezasDePrueba();
  const tokens = catalogoTokensDePrueba();
  assert.equal(generarCreditos({ piezas, tokens }), generarCreditos({ piezas, tokens }));
});

test("cabecera de aviso: no editar a mano", () => {
  assert.match(generarCreditos({}), /No editar a mano/);
});
