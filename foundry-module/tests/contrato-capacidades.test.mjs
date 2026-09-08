import assert from "node:assert/strict";
import test from "node:test";

import {
  consumidoresDeEvento,
  validarManifiesto,
  validarManifiestos,
} from "../scripts/contrato-capacidades.mjs";
import { atlas, chronicle, foundryBridge, manifiestosPiloto } from "../scripts/manifiestos-piloto.mjs";

test("valida manifiestos piloto con eventos y capacidades declarativas", () => {
  assert.equal(validarManifiesto(atlas), true);
  assert.equal(validarManifiestos(manifiestosPiloto), true);
  assert.deepEqual(consumidoresDeEvento(manifiestosPiloto, "discovery.recorded"), ["chronicle"]);
  assert.deepEqual(consumidoresDeEvento(manifiestosPiloto, "chronicle.entry.created"), ["foundry-bridge"]);
});

test("un módulo integrado (standalone: false) puede declarar dependencias opcionales sin required", () => {
  assert.equal(validarManifiesto(foundryBridge), true);
});

test("detecta una dependencia obligatoria incompatible con standalone", () => {
  assert.throws(
    () => validarManifiesto({ ...atlas, required: ["foundry"] }),
    /standalone.*required/i,
  );
});

test("rechaza eventos, capacidades y módulos duplicados o mal formados", () => {
  assert.throws(() => validarManifiesto({ ...atlas, produces: ["Bad Event"] }), /invalid name/i);
  assert.throws(() => validarManifiesto({ ...atlas, capabilities: ["record discovery"] }), /invalid name/i);
  assert.throws(() => validarManifiestos([atlas, atlas]), /module names must be unique/i);
});
