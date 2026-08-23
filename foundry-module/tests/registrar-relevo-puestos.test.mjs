import assert from "node:assert/strict";
import test from "node:test";

// Test that registrarRelevoPuestos registers a listener and returns a remover function.

test("registrarRelevoPuestos registers a listener and returns a remover", async () => {
  // Mock Foundry Hooks
  const hookCalls = [];
  const Hooks = {
    on: (event, fn) => {
      hookCalls.push({ event, fn });
    },
    off: () => {},
  };
  globalThis.Hooks = Hooks;
  globalThis.foundry = { utils: { randomID: () => "abc"} };

  const { registrarRelevoPuestos } = await import("../scripts/station-handover.mjs");
  const remover = registrarRelevoPuestos("espaciokoop-lagunak");
  assert.equal(typeof remover, "function");
  assert.strictEqual(hookCalls.length, 1, "expected one hook registration");
  assert.strictEqual(hookCalls[0].event, "updateUser", "listener attached to updateUser");
});
