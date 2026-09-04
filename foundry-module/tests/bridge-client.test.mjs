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

test("anchors consulta /v1/anchors con Bearer", async () => {
  const calls = [];
  const client = new BridgeClient({
    url: "http://bridge.test/",
    token: "secreto-operativo",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response({ anchors: ["lagunak", "argia"] });
    },
  });

  assert.deepEqual(await client.anchors(), { anchors: ["lagunak", "argia"] });
  assert.equal(calls[0].url, "http://bridge.test/v1/anchors");
  assert.equal(calls[0].options.headers.Authorization, "Bearer secreto-operativo");
});

test("repositionShip envía únicamente la orden cerrada con Bearer", async () => {
  const calls = [];
  const client = new BridgeClient({
    url: "http://bridge.test",
    token: "secreto-operativo",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response({ op: "reposition_ship", result: { ok: true } });
    },
  });

  await client.repositionShip("argia");
  assert.equal(calls[0].url, "http://bridge.test/v1/command");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers.Authorization, "Bearer secreto-operativo");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    op: "reposition_ship",
    anchor: "argia",
  });
});

test("repositionShip rechaza anclas no-cadena antes de tocar red", async () => {
  let calls = 0;
  const client = new BridgeClient({
    url: "http://bridge.test",
    token: "x",
    fetchImpl: async () => {
      calls += 1;
      return response({});
    },
  });

  await assert.rejects(client.repositionShip(""), BridgeError);
  await assert.rejects(client.repositionShip(42), BridgeError);
  assert.equal(calls, 0);
});

test("órdenes directas envían solo la orden cerrada con Bearer", async () => {
  const casos = [
    { call: (c) => c.setImpulse(0.5), body: { op: "set_impulse", value: 0.5 } },
    { call: (c) => c.setWarp(3), body: { op: "set_warp", level: 3 } },
    { call: (c) => c.setTargetHeading(90), body: { op: "set_target_heading", heading: 90 } },
    { call: (c) => c.setShields(true), body: { op: "set_shields", active: true } },
    { call: (c) => c.setAutoRepair(true), body: { op: "set_auto_repair", enabled: true } },
    { call: (c) => c.scanObject("Lapur 1"), body: { op: "scan_object", callsign: "Lapur 1" } },
    { call: (c) => c.setWeaponTarget("Lapur 1"), body: { op: "set_weapon_target", callsign: "Lapur 1" } },
    { call: (c) => c.fireTube("Lapur 1", 2), body: { op: "fire_tube", callsign: "Lapur 1", index: 2 } },
    { call: (c) => c.answerCommHail(true), body: { op: "answer_comm_hail", accept: true } },
    { call: (c) => c.closeComm(), body: { op: "close_comm" } },
    { call: (c) => c.sendCommReply(2), body: { op: "send_comm_reply", index: 2 } },
    {
      call: (c) => c.sendCommMessage("Solicito atraque."),
      body: { op: "send_comm_message", message: "Solicito atraque." },
    },
  ];
  for (const caso of casos) {
    const calls = [];
    const client = new BridgeClient({
      url: "http://bridge.test",
      token: "secreto-operativo",
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return response({ result: { ok: true } });
      },
    });
    await caso.call(client);
    assert.equal(calls[0].url, "http://bridge.test/v1/command");
    assert.equal(calls[0].options.method, "POST");
    assert.equal(calls[0].options.headers.Authorization, "Bearer secreto-operativo");
    assert.deepEqual(JSON.parse(calls[0].options.body), caso.body);
  }
});

test("órdenes directas rechazan valores fuera de rango antes de tocar red", async () => {
  let calls = 0;
  const client = new BridgeClient({
    url: "http://bridge.test",
    token: "x",
    fetchImpl: async () => { calls += 1; return response({}); },
  });
  await assert.rejects(client.setImpulse(2), BridgeError);
  await assert.rejects(client.setImpulse("0.5"), BridgeError);
  await assert.rejects(client.setWarp(5), BridgeError);
  await assert.rejects(client.setWarp(2.5), BridgeError);
  await assert.rejects(client.setTargetHeading(-1), BridgeError);
  await assert.rejects(client.setTargetHeading(361), BridgeError);
  await assert.rejects(client.setShields("up"), BridgeError);
  await assert.rejects(client.setAutoRepair("on"), BridgeError);
  await assert.rejects(client.scanObject(""), BridgeError);
  await assert.rejects(client.scanObject(42), BridgeError);
  await assert.rejects(client.setWeaponTarget(""), BridgeError);
  await assert.rejects(client.setWeaponTarget(42), BridgeError);
  await assert.rejects(client.fireTube("", 0), BridgeError);
  await assert.rejects(client.fireTube("Lapur 1", -1), BridgeError);
  await assert.rejects(client.fireTube("Lapur 1", 16), BridgeError);
  await assert.rejects(client.fireTube("Lapur 1", 1.5), BridgeError);
  await assert.rejects(client.fireTube("Lapur 1", "2"), BridgeError);
  await assert.rejects(client.answerCommHail("yes"), BridgeError);
  await assert.rejects(client.sendCommReply(-1), BridgeError);
  await assert.rejects(client.sendCommReply(16), BridgeError);
  await assert.rejects(client.sendCommReply(1.5), BridgeError);
  await assert.rejects(client.sendCommMessage(""), BridgeError);
  await assert.rejects(client.sendCommMessage("x".repeat(257)), BridgeError);
  assert.equal(calls, 0);
});

test("setSystemCoolant envía la orden cerrada con Bearer (#301)", async () => {
  const calls = [];
  const client = new BridgeClient({
    url: "http://bridge.test",
    token: "secreto-operativo",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response({ op: "set_system_coolant", result: { ok: true } });
    },
  });

  await client.setSystemCoolant("impulse", 7);
  assert.equal(calls[0].url, "http://bridge.test/v1/command");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers.Authorization, "Bearer secreto-operativo");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    op: "set_system_coolant",
    system: "impulse",
    level: 7,
  });
});

test("setSystemCoolant rechaza sistema/nivel inválidos antes de tocar red (#301)", async () => {
  let calls = 0;
  const client = new BridgeClient({
    url: "http://bridge.test",
    token: "x",
    fetchImpl: async () => { calls += 1; return response({}); },
  });
  await assert.rejects(client.setSystemCoolant("", 5), BridgeError);
  await assert.rejects(client.setSystemCoolant("impulse", -1), BridgeError);
  await assert.rejects(client.setSystemCoolant("impulse", 11), BridgeError);
  await assert.rejects(client.setSystemCoolant("impulse", "5"), BridgeError);
  assert.equal(calls, 0);
});

// OTACON Astra: el plazo incluye el cuerpo, no solo las cabeceras.
// HTTP real en loopback con salida de seguridad acotada, sin bridge/Foundry.
async function conPuenteLento(ejecutar) {
  const { createServer } = await import("node:http");
  const temporizadores = new Set();
  const peticiones = [];
  let lento = true;
  const servidor = createServer((req, res) => {
    peticiones.push({ method: req.method, path: req.url, authenticated: Boolean(req.headers.authorization) });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.write('{"ok":');
    const id = setTimeout(() => {
      temporizadores.delete(id);
      res.end("true}");
    }, lento ? 1000 : 0);
    temporizadores.add(id);
  });
  await new Promise((resolve) => servidor.listen(0, "127.0.0.1", resolve));
  try {
    await ejecutar({
      url: `http://127.0.0.1:${servidor.address().port}`,
      peticiones,
      recuperar: () => { lento = false; },
    });
  } finally {
    for (const id of temporizadores) clearTimeout(id);
    servidor.closeAllConnections();
    await new Promise((resolve) => servidor.close(resolve));
  }
}

for (const metodo of ["state", "setPause"]) {
  test(`${metodo}: aborta cuerpo incompleto y permite la siguiente petición sin reintentar`, async () => {
    await conPuenteLento(async ({ url, peticiones, recuperar }) => {
      const client = new BridgeClient({ url, token: "fixture-token", timeoutMs: 400 });
      const llamar = () => metodo === "state" ? client.state() : client.setPause(true);
      await assert.rejects(llamar(), (error) => {
        assert.equal(error instanceof BridgeError, true);
        assert.equal(error.kind, "timeout");
        assert.equal(error.message.includes("fixture-token"), false);
        assert.equal(error.message.includes(url), false);
        return true;
      });
      assert.equal(peticiones.length, 1, "una orden ambigua no se reintenta automáticamente");
      recuperar();
      assert.deepEqual(await llamar(), { ok: true });
      assert.equal(peticiones.length, 2);
    });
  });
}

test("diagnóstico real sale de healthz con cuerpo bloqueado sin enviar Bearer", async () => {
  const { probarConexion } = await import("../scripts/diagnostico-conexion.mjs");
  await conPuenteLento(async ({ url, peticiones }) => {
    const resultado = await probarConexion({ url, token: "fixture-token", timeoutMs: 400 });
    assert.equal(resultado.codigo, "inaccesible");
    assert.deepEqual(peticiones, [{ method: "GET", path: "/healthz", authenticated: false }]);
  });
});

test("conserva clasificación HTTP, JSON inválido y fallo de transporte", async () => {
  for (const [fetchImpl, kind, status] of [
    [async () => response({}, { ok: false, status: 403 }), "http", 403],
    [async () => ({ ok: true, json: async () => { throw new SyntaxError("fixture"); } }), "parse", 0],
    [async () => { throw new TypeError("fixture"); }, "network", 0],
  ]) {
    const client = new BridgeClient({ url: "http://bridge.test", fetchImpl });
    await assert.rejects(client.healthz(), (error) => error.kind === kind && error.status === status);
  }
});
