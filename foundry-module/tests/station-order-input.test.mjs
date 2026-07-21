import assert from "node:assert/strict";
import test from "node:test";

import { ORDER_FORMS, parseOrderValue, evaluateOrder } from "../scripts/station-workspace-ui.mjs";

// Regresión del input vacío: Number("") === 0 hacía que un envío sin dato pasara
// como orden válida a cero (rumbo/impulso/warp). parseOrderValue comprueba la
// presencia ANTES de convertir.

test("parseOrderValue rechaza ausencia y vacío (nunca lo trata como 0)", () => {
  assert.equal(parseOrderValue(null), null);
  assert.equal(parseOrderValue(undefined), null);
  assert.equal(parseOrderValue(""), null);
  assert.equal(parseOrderValue("   "), null);
  assert.equal(parseOrderValue("abc"), null);
});

test("parseOrderValue convierte texto numérico válido, incluido el cero explícito", () => {
  assert.equal(parseOrderValue("0"), 0);
  assert.equal(parseOrderValue("270"), 270);
  assert.equal(parseOrderValue(" -1 "), -1);
  assert.equal(parseOrderValue("3.5"), 3.5);
});

test("evaluateOrder rechaza el input vacío en las tres órdenes (no emitiría)", () => {
  for (const key of Object.keys(ORDER_FORMS)) {
    const spec = ORDER_FORMS[key];
    assert.deepEqual(evaluateOrder("", spec), { ok: false }, `${key} vacío no debe emitir`);
    assert.deepEqual(evaluateOrder("   ", spec), { ok: false }, `${key} espacios no debe emitir`);
    assert.deepEqual(evaluateOrder(undefined, spec), { ok: false }, `${key} sin input no debe emitir`);
  }
});

test("evaluateOrder admite el cero explícito solo donde el spec lo permite", () => {
  // rumbo 0, impulso 0 y warp 0 son válidos SI se teclearon; el bug era aceptar
  // el vacío como 0, no rechazar el 0 tecleado.
  assert.deepEqual(evaluateOrder("0", ORDER_FORMS["orden-rumbo"]), { ok: true, value: 0 });
  assert.deepEqual(evaluateOrder("0", ORDER_FORMS["orden-impulso"]), { ok: true, value: 0 });
  assert.deepEqual(evaluateOrder("0", ORDER_FORMS["orden-warp"]), { ok: true, value: 0 });
});

test("evaluateOrder rechaza valores fuera de rango de cada spec", () => {
  assert.deepEqual(evaluateOrder("360", ORDER_FORMS["orden-rumbo"]), { ok: false });
  assert.deepEqual(evaluateOrder("2", ORDER_FORMS["orden-impulso"]), { ok: false });
  assert.deepEqual(evaluateOrder("5", ORDER_FORMS["orden-warp"]), { ok: false });
  assert.deepEqual(evaluateOrder("1.5", ORDER_FORMS["orden-warp"]), { ok: false });
});
