import assert from "node:assert/strict";
import test from "node:test";

import {
  HABILIDADES_INVESTIGACION,
  PROCEDENCIA_SRD,
  marcadorInvestigacion,
  resolverInvestigacion,
} from "../scripts/libro-srd-investigacion.mjs";

test("las tres habilidades del vertical son explícitas", () => {
  assert.deepEqual(HABILIDADES_INVESTIGACION, ["investigacion", "historia", "arcana"]);
});

test("una investigación devuelve éxito y procedencia SRD", () => {
  const resultado = resolverInvestigacion({ habilidad: "arcana", dc: 13, modificador: 4, tiradas: [9] });
  assert.equal(resultado.total, 13);
  assert.equal(resultado.exito, true);
  assert.equal(resultado.procedencia, PROCEDENCIA_SRD);
});

test("la ficha de procedencia SRD trae autor, fuente y licencia verificables (#1038)", () => {
  // Atiende el bloqueo de OTACON Astra en #1038: "completar la ficha SRD con
  // autor/fuente/enlace CC-BY". Mismo formato {kind, source, license,
  // source_url} que procedencia-catalogo.mjs (ADR-0013).
  assert.equal(PROCEDENCIA_SRD.kind, "cc");
  assert.match(PROCEDENCIA_SRD.source, /Wizards of the Coast/);
  assert.match(PROCEDENCIA_SRD.source, /Systems Reference Document 5\.1/);
  assert.equal(PROCEDENCIA_SRD.license, "CC-BY-4.0");
  assert.match(PROCEDENCIA_SRD.source_url, /^https:\/\//);
});

test("ventaja usa la mejor de dos tiradas y el fallo sigue siendo visible", () => {
  const resultado = resolverInvestigacion({ habilidad: "historia", dc: 18, modificador: 0, tiradas: [2, 17] });
  assert.equal(resultado.tirada, 17);
  assert.equal(resultado.exito, false);
  const marcador = marcadorInvestigacion(resultado, [1, 2, 3]);
  assert.equal(marcador.estado, "fallo");
  assert.equal(marcador.posicion[1], 2);
  assert.ok(marcador.malla.vertices.length > 0);
});

test("rechaza habilidades ajenas y tiradas fuera de d20", () => {
  assert.throws(() => resolverInvestigacion({ habilidad: "persuasion", dc: 10 }), RangeError);
  assert.throws(() => resolverInvestigacion({ habilidad: "arcana", dc: 10, tiradas: [21] }), RangeError);
});
