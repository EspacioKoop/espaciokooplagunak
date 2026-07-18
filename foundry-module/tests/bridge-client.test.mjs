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

test("contacts consulta /v1/contacts con Bearer", async () => {
  const calls = [];
  const client = new BridgeClient({
    url: "http://bridge.test/",
    token: "secreto-operativo",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response({ contacts: [] });
    },
  });

  assert.deepEqual(await client.contacts(), { contacts: [] });
  assert.equal(calls[0].url, "http://bridge.test/v1/contacts");
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

test("setPause envía únicamente la orden cerrada con Bearer", async () => {
  const calls = [];
  const client = new BridgeClient({
    url: "http://bridge.test",
    token: "secreto-operativo",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response({ op: "set_pause", result: { ok: true } });
    },
  });

  await client.setPause(true);
  assert.equal(calls[0].url, "http://bridge.test/v1/command");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers.Authorization, "Bearer secreto-operativo");
  assert.equal(calls[0].options.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    op: "set_pause",
    paused: true,
  });
});

test("spawnEncounter envía la orden cerrada, omitiendo el rumbo nulo", async () => {
  const calls = [];
  const client = new BridgeClient({
    url: "http://bridge.test",
    token: "secreto-operativo",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response({ op: "spawn_encounter", result: { ok: true } });
    },
  });

  await client.spawnEncounter("derelict", "port");
  await client.spawnEncounter("derelict");
  assert.equal(calls[0].url, "http://bridge.test/v1/command");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers.Authorization, "Bearer secreto-operativo");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    op: "spawn_encounter",
    archetype: "derelict",
    bearing: "port",
  });
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    op: "spawn_encounter",
    archetype: "derelict",
  });
});

test("spawnEncounter valida arquetipo y rumbo antes de tocar red", async () => {
  let calls = 0;
  const client = new BridgeClient({
    url: "http://bridge.test",
    token: "x",
    fetchImpl: async () => {
      calls += 1;
      return response({});
    },
  });

  await assert.rejects(client.spawnEncounter(""), BridgeError);
  await assert.rejects(client.spawnEncounter(7), BridgeError);
  await assert.rejects(client.spawnEncounter("derelict", ""), BridgeError);
  assert.equal(calls, 0);
});

test("encounters consulta el catálogo con Bearer", async () => {
  const calls = [];
  const client = new BridgeClient({
    url: "http://bridge.test",
    token: "secreto-operativo",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response({ archetypes: ["derelict"], bearings: ["port"] });
    },
  });

  const catalogo = await client.encounters();
  assert.equal(calls[0].url, "http://bridge.test/v1/encounters");
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[0].options.headers.Authorization, "Bearer secreto-operativo");
  assert.deepEqual(catalogo.archetypes, ["derelict"]);
});

test("setPause rechaza valores no booleanos antes de tocar red", async () => {
  let calls = 0;
  const client = new BridgeClient({
    url: "http://bridge.test",
    token: "x",
    fetchImpl: async () => {
      calls += 1;
      return response({});
    },
  });

  await assert.rejects(client.setPause("true"), BridgeError);
  assert.equal(calls, 0);
});
