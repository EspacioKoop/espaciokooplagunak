import assert from "node:assert/strict";
import test from "node:test";

import { parseHeadingValue } from "../scripts/station-workspace-ui.mjs";

test("parseHeadingValue rechaza el campo vacío (regresión: no emitir rumbo 0)", () => {
  // Number("") es 0, pasa isFinite y el rango 0–359; sin este guard, pulsar
  // «Fijar rumbo» con el campo vacío emitiría una orden real a rumbo 0.
  assert.equal(parseHeadingValue(""), null);
  assert.equal(parseHeadingValue("   "), null);
  assert.equal(parseHeadingValue(undefined), null);
  assert.equal(parseHeadingValue(null), null);
});

test("parseHeadingValue conserva el cero explícito como válido", () => {
  assert.equal(parseHeadingValue("0"), 0);
  assert.equal(parseHeadingValue(" 0 "), 0);
});

test("parseHeadingValue acepta rumbos válidos y recorta espacios", () => {
  assert.equal(parseHeadingValue("90"), 90);
  assert.equal(parseHeadingValue(" 359 "), 359);
  assert.equal(parseHeadingValue("180.5"), 180.5);
});

test("parseHeadingValue rechaza fuera de rango y no numéricos", () => {
  assert.equal(parseHeadingValue("360"), null);
  assert.equal(parseHeadingValue("-1"), null);
  assert.equal(parseHeadingValue("abc"), null);
  assert.equal(parseHeadingValue("NaN"), null);
});
