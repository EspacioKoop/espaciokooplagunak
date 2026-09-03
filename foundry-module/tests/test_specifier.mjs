import test from "node:test";
import assert from "node:assert/strict";

test("log specifier for convocatoria-estancia.mjs", async () => {
  const original = globalThis.import;
  globalThis.import = async (s) => {
    console.error('SPECIFIER:', s);
    return original(s);
  };
  await import('../scripts/main.mjs');
});