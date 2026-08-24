import assert from "node:assert/strict";
import test from "node:test";
import { derivarRelevo } from "../scripts/station-handover.mjs";

test("derivarRelevo returns null when both stations null", () => {
  assert.equal(derivarRelevo({ userId: "u1", estacionAnterior: null, estacionNueva: null }), null);
});
