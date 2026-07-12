import assert from "node:assert/strict";
import test from "node:test";

import { BridgeClient, BridgeError } from "../scripts/bridge-client.mjs";

function response(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async json() {
      return body;
    },
  };
}

test("events consulta /v1/events con Bearer sin filtrar el token", async () => {
  const calls = [];
  const client = new BridgeClient({
    url: "http://bridge.test/",
    token: "secreto-operativo",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response({ events: [] });
    },
  });

  assert.deepEqual(await client.events(), { events: [] });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://bridge.test/v1/events");
  assert.equal(calls[0].options.headers.Authorization, "Bearer secreto-operativo");
});

test("events falla cerrado sin token", async () => {
  const client = new BridgeClient({
    url: "http://bridge.test",
    fetchImpl: async () => {
      throw new Error("no debe llegar a red");
    },
  });

  await assert.rejects(
    client.events(),
    (error) => error instanceof BridgeError && error.status === 401,
  );
});
