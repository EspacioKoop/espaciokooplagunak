import assert from "node:assert/strict";
import test from "node:test";

import { setSimulationPaused } from "../scripts/tempo-control.mjs";

test("un usuario no GM no emite órdenes de tempo", async () => {
  let calls = 0;
  const changed = await setSimulationPaused({
    paused: true,
    isGM: false,
    client: { async setPause() { calls += 1; } },
  });
  assert.equal(changed, false);
  assert.equal(calls, 0);
});

test("un GM puede pausar y reanudar con booleanos", async () => {
  const values = [];
  const client = { async setPause(value) { values.push(value); } };
  assert.equal(await setSimulationPaused({ paused: true, isGM: true, client }), true);
  assert.equal(await setSimulationPaused({ paused: false, isGM: true, client }), true);
  assert.deepEqual(values, [true, false]);
});

test("rechaza un estado de pausa no booleano", async () => {
  await assert.rejects(
    setSimulationPaused({ paused: "true", isGM: true, client: { setPause() {} } }),
    /booleano/,
  );
});
