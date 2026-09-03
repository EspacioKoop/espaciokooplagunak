// Simple test to see if our import override is working
import test from "node:test";
import assert from "node:assert/strict";

test("simple import test", async () => {
  // Save the original import
  const originalImport = globalThis.import;
  // Mock the global import function
  globalThis.import = async (specifier) => {
    console.error(`[SIMPLE TEST] Import called with: ${specifier}`);
    return originalImport(specifier);
  };

  // Import a module to see if our override works
  await import("../scripts/main.mjs");

  // Restore
  globalThis.import = originalImport;
});