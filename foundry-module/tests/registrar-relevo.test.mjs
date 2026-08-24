import assert from "node:assert/strict";
import test from "node:test";

// Coverage test for registrarRelevoPuestos helper.
// The Foundry hooks are not available in this test environment, so we provide
// a minimal stub of the global Hooks object that records how many times
// on/off are called. Importing the module will register the listener when
// registrarRelevoPuestos is called.

let onCalled = 0;
let offCalled = 0;

global.Hooks = {
  on: (_event, _fn) => { onCalled++; },
  off: (_event, _fn) => { offCalled++; },
};

// Dynamically import the module so the stub is in place.
import("../scripts/station-handover.mjs").then(mod => {
  const cleanup = mod.registrarRelevoPuestos("test-module-id");
  if (onCalled !== 1) throw new Error(`Hooks.on expected once, got ${onCalled}`);
  if (typeof cleanup !== "function") throw new Error("Expected a cleanup function");
  cleanup();
  if (offCalled !== 1) throw new Error(`Hooks.off expected once, got ${offCalled}`);
});

// Since the import happens asynchronously, we need to suspend the test until
// the promises are resolved.  node:test does not support async fixtures, so
// we just wait for a short amount of time; the test will fail if the cleanup
// logic had errors.
await new Promise(resolve => setTimeout(resolve, 50));

