import { test } from "node:test";
import assert from "node:assert/strict";

import {
  clasificarDocumento,
  EDICION,
  MOTIVO_RECHAZO,
} from "../scripts/plutonium-filtro-edicion.mjs";

// Datos inventados para este test, no copiados de ningún sourcebook real.

test("acepta cuando system.source.rules es 2014", () => {
  const doc = { name: "Bicho de prueba", system: { source: { rules: "2014", book: "MM" } } };
  assert.deepEqual(clasificarDocumento(doc), {
    aceptado: true,
    edicion: EDICION.CLASICA_2014,
    motivo: null,
  });
});

test("rechaza cuando system.source.rules es 2024, aunque el book parezca 2014", () => {
  const doc = { name: "Bicho remasterizado", system: { source: { rules: "2024", book: "MM" } } };
  const veredicto = clasificarDocumento(doc);
  assert.equal(veredicto.aceptado, false);
  assert.equal(veredicto.motivo, MOTIVO_RECHAZO.FUENTE_2024);
});

test("sin rules, acepta por abreviatura en la lista blanca 2014", () => {
  const doc = { name: "Objeto legado", system: { source: { book: "phb" } } };
  const veredicto = clasificarDocumento(doc);
  assert.equal(veredicto.aceptado, true);
  assert.equal(veredicto.edicion, EDICION.CLASICA_2014);
});

test("sin rules, acepta con system.source como string legado", () => {
  const doc = { name: "Objeto muy legado", system: { source: "DMG" } };
  const veredicto = clasificarDocumento(doc);
  assert.equal(veredicto.aceptado, true);
});

test("sin rules, rechaza abreviatura con prefijo X (2024)", () => {
  const doc = { name: "Hechizo remasterizado", system: { source: { book: "XPHB" } } };
  const veredicto = clasificarDocumento(doc);
  assert.equal(veredicto.aceptado, false);
  assert.equal(veredicto.motivo, MOTIVO_RECHAZO.FUENTE_2024);
});

test("rechaza abreviatura desconocida — falla cerrado, no asume 2014", () => {
  const doc = { name: "Homebrew sin marcar", system: { source: { book: "ZZZ-NO-EXISTE" } } };
  const veredicto = clasificarDocumento(doc);
  assert.equal(veredicto.aceptado, false);
  assert.equal(veredicto.motivo, MOTIVO_RECHAZO.FUENTE_DESCONOCIDA);
});

test("rechaza sin ningún metadato de fuente", () => {
  assert.deepEqual(clasificarDocumento({ name: "Sin fuente", system: {} }), {
    aceptado: false,
    edicion: null,
    motivo: MOTIVO_RECHAZO.SIN_METADATOS,
  });
});

test("rechaza documento vacío o sin system, sin lanzar", () => {
  assert.equal(clasificarDocumento({}).aceptado, false);
  assert.equal(clasificarDocumento(null).aceptado, false);
  assert.equal(clasificarDocumento(undefined).aceptado, false);
});
