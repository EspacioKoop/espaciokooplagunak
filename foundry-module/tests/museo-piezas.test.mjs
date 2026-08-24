import assert from "node:assert/strict";
import test from "node:test";

import { MALLAS_MUSEO, CATALOGO_MUSEO } from "../scripts/museo-piezas.mjs";
import {
  NATURALEZAS,
  cartelaDe,
  piezaPorId,
  validarCatalogoPiezas,
} from "../scripts/catalogo-piezas.mjs";

const mallasDisponibles = new Set(Object.keys(MALLAS_MUSEO));

test("CATALOGO_MUSEO passes validarCatalogoPiezas with correct mallas", () => {
  assert.equal(validarCatalogoPiezas(CATALOGO_MUSEO, { mallasDisponibles }), true);
});

test("each piece has non-empty provenance fields and HTTPS source_url", () => {
  for (const pieza of CATALOGO_MUSEO.piezas) {
    assert.ok(pieza.provenance.kind, `${pieza.id} provenance.kind`);
    assert.ok(pieza.provenance.source, `${pieza.id} provenance.source`);
    assert.ok(pieza.provenance.license, `${pieza.id} provenance.license`);
    assert.ok(pieza.provenance.source_url, `${pieza.id} provenance.source_url`);
    assert.match(
      pieza.provenance.source_url,
      /^https:/,
      `${pieza.id} provenance.source_url must start with https`
    );
  }
});

test("each piece has non-empty name and cartela in both languages", () => {
  for (const pieza of CATALOGO_MUSEO.piezas) {
    assert.ok(pieza.nombre.es, `${pieza.id} nombre.es`);
    assert.ok(pieza.nombre.en, `${pieza.id} nombre.en`);
    assert.ok(pieza.cartela.es, `${pieza.id} cartela.es`);
    assert.ok(pieza.cartela.en, `${pieza.id} cartela.en`);
  }
});

test("cartelaDe returns correct text for each language", () => {
  for (const pieza of CATALOGO_MUSEO.piezas) {
    const cartelaEs = cartelaDe(pieza, "es");
    const cartelaEn = cartelaDe(pieza, "en");
    assert.equal(cartelaEs.titulo, pieza.nombre.es);
    assert.equal(cartelaEs.texto, pieza.cartela.es);
    assert.equal(cartelaEn.titulo, pieza.nombre.en);
    assert.equal(cartelaEn.texto, pieza.cartela.en);
  }
});

test("honesty invariant: reconstruccion mentions reconstruction; escaneo-de-vaciado mentions cast/plaster", () => {
  for (const pieza of CATALOGO_MUSEO.piezas) {
    const { naturaleza, cartela } = pieza;
    const esLower = cartela.es.toLowerCase();
    const enLower = cartela.en.toLowerCase();
    if (naturaleza === "reconstruccion") {
      assert.ok(
        esLower.includes("reconstru") && enLower.includes("reconstruct"),
        `${pieza.id} cartela must mention reconstruction in both languages`
      );
    } else if (naturaleza === "escaneo-de-vaciado") {
      const esOk = esLower.includes("vaciado") || esLower.includes("yeso");
      const enOk = enLower.includes("cast") || enLower.includes("plaster");
      assert.ok(
        esOk && enOk,
        `${pieza.id} cartela must indicate it's not original (vaciado/yeso or cast/plaster) in both languages`
      );
    }
  }
});

test("each piece.malla exists in MALLAS_MUSEO", () => {
  for (const pieza of CATALOGO_MUSEO.piezas) {
    assert.ok(
      MALLAS_MUSEO.hasOwnProperty(pieza.malla),
      `${pieza.id} malla ${pieza.malla} not found in MALLAS_MUSEO`
    );
  }
});
