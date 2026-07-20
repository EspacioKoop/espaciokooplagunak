import assert from "node:assert/strict";
import test from "node:test";

import {
  STATION_ORDER_EVENT,
  emitStationOrder,
  handleStationOrder,
  registerStationOrderHandler,
} from "../scripts/station-order-relay.mjs";
import { STATION_ACTION_ERRORS } from "../scripts/station-actions.mjs";

function fakeSocket() {
  const listeners = [];
  return {
    emitted: [],
    listeners,
    emit(event, payload) { this.emitted.push({ event, payload }); },
    on(event, fn) { listeners.push({ event, fn }); },
    off(event, fn) {
      const i = listeners.findIndex((l) => l.event === event && l.fn === fn);
      if (i >= 0) listeners.splice(i, 1);
    },
  };
}

function fakeBridge() {
  return {
    calls: [],
    async setTargetHeading(heading) { this.calls.push(["setTargetHeading", heading]); return { ok: true }; },
  };
}

test("emitStationOrder manda userId y acción, nunca el puesto", () => {
  const socket = fakeSocket();
  emitStationOrder({ socket, userId: "u1", action: "set_target_heading", params: { heading: 90 } });
  assert.equal(socket.emitted.length, 1);
  const { event, payload } = socket.emitted[0];
  assert.equal(event, STATION_ORDER_EVENT);
  assert.equal(payload.userId, "u1");
  assert.equal(payload.action, "set_target_heading");
  assert.deepEqual(payload.params, { heading: 90 });
  assert.ok(!("station" in payload), "el cliente no declara su puesto");
});

test("emitStationOrder valida socket y userId", () => {
  assert.throws(() => emitStationOrder({ socket: {}, userId: "u1", action: "x" }), TypeError);
  assert.throws(() => emitStationOrder({ socket: fakeSocket(), action: "x" }), TypeError);
});

test("handleStationOrder resuelve el puesto del emisor y despacha al puente", async () => {
  const bridge = fakeBridge();
  const result = await handleStationOrder({
    payload: { userId: "u1", action: "set_target_heading", params: { heading: 42 } },
    resolveUserStation: () => "navigation",
    bridge,
  });
  assert.deepEqual(bridge.calls, [["setTargetHeading", 42]]);
  assert.deepEqual(result, { ok: true });
});

test("handleStationOrder ignora el puesto falsificado en el payload", async () => {
  const bridge = fakeBridge();
  // El emisor está en navegación; el payload miente diciendo ser 'captain' con
  // otra acción. Debe resolverse por el emisor (navegación) y su permiso.
  await handleStationOrder({
    payload: { userId: "u1", action: "set_target_heading", station: "captain", params: { heading: 10 } },
    resolveUserStation: () => "navigation",
    bridge,
  });
  assert.deepEqual(bridge.calls, [["setTargetHeading", 10]]);
});

test("handleStationOrder rechaza a un emisor sin puesto asignado", async () => {
  const bridge = fakeBridge();
  await assert.rejects(
    () => handleStationOrder({
      payload: { userId: "u1", action: "set_target_heading", params: { heading: 10 } },
      resolveUserStation: () => null,
      bridge,
    }),
    (error) => error.code === STATION_ACTION_ERRORS.UNKNOWN_STATION,
  );
  assert.deepEqual(bridge.calls, [], "no toca el puente si no hay puesto");
});

test("handleStationOrder rechaza una acción fuera del permiso del puesto", async () => {
  const bridge = fakeBridge();
  await assert.rejects(
    () => handleStationOrder({
      payload: { userId: "u1", action: "set_system_power", params: {} },
      resolveUserStation: () => "navigation",
      bridge,
    }),
    (error) => error.code === STATION_ACTION_ERRORS.ACTION_NOT_ALLOWED,
  );
  assert.deepEqual(bridge.calls, []);
});

test("registerStationOrderHandler es no-op fuera del GM", () => {
  const socket = fakeSocket();
  const off = registerStationOrderHandler({ socket, isGM: false, resolveUserStation: () => "navigation", bridge: fakeBridge() });
  assert.equal(socket.listeners.length, 0);
  assert.equal(typeof off, "function");
});

test("registerStationOrderHandler despacha en el GM y permite darse de baja", async () => {
  const socket = fakeSocket();
  const bridge = fakeBridge();
  const resultados = [];
  const off = registerStationOrderHandler({
    socket,
    isGM: true,
    resolveUserStation: () => "navigation",
    bridge,
    onResult: (r) => resultados.push(r),
  });
  assert.equal(socket.listeners.length, 1);
  const { fn } = socket.listeners[0];
  fn({ type: STATION_ORDER_EVENT, userId: "u1", action: "set_target_heading", params: { heading: 7 } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(bridge.calls, [["setTargetHeading", 7]]);
  assert.deepEqual(resultados, [{ ok: true }]);
  off();
  assert.equal(socket.listeners.length, 0);
});

test("registerStationOrderHandler solo ejecuta si canHandle() es cierto (GM primario)", async () => {
  const socket = fakeSocket();
  const bridge = fakeBridge();
  let esPrimario = false;
  registerStationOrderHandler({
    socket,
    isGM: true,
    canHandle: () => esPrimario,
    resolveUserStation: () => "navigation",
    bridge,
  });
  const { fn } = socket.listeners[0];
  const orden = { type: STATION_ORDER_EVENT, userId: "u1", action: "set_target_heading", params: { heading: 5 } };

  fn(orden);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(bridge.calls, [], "un GM no primario no ejecuta la orden");

  esPrimario = true;
  fn(orden);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(bridge.calls, [["setTargetHeading", 5]], "el GM primario sí la ejecuta");
});

test("registerStationOrderHandler ignora mensajes de otro tipo", async () => {
  const socket = fakeSocket();
  const bridge = fakeBridge();
  registerStationOrderHandler({ socket, isGM: true, resolveUserStation: () => "navigation", bridge });
  socket.listeners[0].fn({ type: "otraCosa", userId: "u1", action: "set_target_heading" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(bridge.calls, []);
});
