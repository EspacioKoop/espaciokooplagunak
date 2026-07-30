// SONDA TEMPORAL de #361: una prueba que falla a propósito, para demostrar que
// «Puerta del módulo Foundry» falla de verdad y no aprueba por dejadez.
// Esta rama y su PR se cierran en cuanto quede el enlace en el issue.
import assert from "node:assert/strict";
import test from "node:test";

test("sonda #361: la puerta debe ponerse en rojo", () => {
  assert.equal(1, 2, "fallo deliberado");
});
