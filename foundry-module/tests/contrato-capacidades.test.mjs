import assert from "node:assert/strict";
import test from "node:test";

import {
  consumidoresDeEvento,
  validarManifiesto,
  validarManifiestos,
} from "../scripts/contrato-capacidades.mjs";

const atlas = {
  module: "atlas",
  standalone: true,
  produces: ["discovery.recorded"],
  consumes: ["station.action.completed"],
  capabilities: ["record_discovery", "query_discovery"],
};
const chronicle = {
  module: "chronicle",
  standalone: true,
  produces: ["chronicle.entry.created"],
  consumes: ["discovery.recorded"],
  capabilities: ["record_entry"],
};

test("valida manifiestos piloto con eventos y capacidades declarativas", () => {
  assert.equal(validarManifiesto(atlas), true);
  assert.equal(validarManifiestos([atlas, chronicle]), true);
  assert.deepEqual(consumidoresDeEvento([atlas, chronicle], "discovery.recorded"), ["chronicle"]);
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
