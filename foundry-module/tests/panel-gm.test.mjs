import assert from "node:assert/strict";
import test from "node:test";

import { ENTRADAS, entradaPorId, entradasPanelGM } from "../scripts/panel-gm.mjs";

test("el catálogo tiene las seis entradas consolidadas de #448 más el sonido de #604", () => {
  const entradas = entradasPanelGM();
  assert.deepEqual(entradas.map((e) => e.id), [
    "consola",
    "token",
    "diagnostico",
    "musica",
    "decorado",
    "ficha",
    "sonido",
  ]);
  for (const entrada of entradas) {
    assert.ok(entrada.tituloClave.startsWith("LAGUNAK."));
    assert.ok(entrada.icono.startsWith("fa-"));
  }
});

test("entradasPanelGM() devuelve el mismo catálogo congelado, no una copia mutable", () => {
  assert.equal(entradasPanelGM(), ENTRADAS);
  assert.throws(() => {
    ENTRADAS.push({ id: "intruso" });
  });
});

test("entradaPorId encuentra la entrada existente y no inventa una para ids ajenos", () => {
  assert.equal(entradaPorId("consola")?.id, "consola");
  assert.equal(entradaPorId("ficha")?.id, "ficha");
  assert.equal(entradaPorId("tragaperras"), undefined);
  assert.equal(entradaPorId(""), undefined);
  assert.equal(entradaPorId(undefined), undefined);
});
