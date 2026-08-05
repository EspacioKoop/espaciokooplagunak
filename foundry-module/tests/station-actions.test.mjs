import assert from "node:assert/strict";
import test from "node:test";

import {
  STATION_ACTIONS,
  STATION_ACTION_ERRORS,
  StationActionError,
  isActionAllowed,
  resolveStationOrder,
} from "../scripts/station-actions.mjs";

test("navegación controla el movimiento: rumbo, impulso y warp", () => {
  assert.equal(isActionAllowed("navigation", "set_target_heading"), true);
  assert.equal(isActionAllowed("navigation", "set_impulse"), true);
  assert.equal(isActionAllowed("navigation", "set_warp"), true);
  assert.deepEqual(STATION_ACTIONS.navigation, ["set_target_heading", "set_impulse", "set_warp"]);
});

test("las órdenes de movimiento encaminan al método correcto de BridgeClient", () => {
  assert.deepEqual(
    resolveStationOrder({ station: "navigation", action: "set_impulse", params: { value: -0.5 } }),
    { method: "setImpulse", args: [-0.5] },
  );
  assert.deepEqual(
    resolveStationOrder({ station: "navigation", action: "set_warp", params: { level: 3 } }),
    { method: "setWarp", args: [3] },
  );
});

test("ingeniería reparte energía por sistema y solo ella", () => {
  assert.equal(isActionAllowed("engineering", "set_system_power"), true);
  assert.equal(isActionAllowed("navigation", "set_system_power"), false);
  assert.deepEqual(
    resolveStationOrder({
      station: "engineering",
      action: "set_system_power",
      params: { system: "reactor", level: 1.5 },
    }),
    { method: "setSystemPower", args: ["reactor", 1.5] },
  );
});

test("ingeniería también reparte refrigerante por sistema y solo ella (#301)", () => {
  assert.equal(isActionAllowed("engineering", "set_system_coolant"), true);
  assert.equal(isActionAllowed("navigation", "set_system_coolant"), false);
  assert.equal(isActionAllowed("weapons", "set_system_coolant"), false);
  assert.deepEqual(STATION_ACTIONS.engineering, ["set_system_power", "set_system_coolant"]);
  assert.deepEqual(
    resolveStationOrder({
      station: "engineering",
      action: "set_system_coolant",
      params: { system: "impulse", level: 7 },
    }),
    { method: "setSystemCoolant", args: ["impulse", 7] },
  );
});

test("armas sube y baja escudos, y solo ella", () => {
  assert.equal(isActionAllowed("weapons", "set_shields"), true);
  assert.equal(isActionAllowed("navigation", "set_shields"), false);
  assert.deepEqual(
    resolveStationOrder({ station: "weapons", action: "set_shields", params: { active: true } }),
    { method: "setShields", args: [true] },
  );
  assert.deepEqual(
    resolveStationOrder({ station: "weapons", action: "set_shields", params: { active: false } }),
    { method: "setShields", args: [false] },
  );
});

test("comunicaciones contesta/cierra/dialoga/chatea, y solo ella (#463)", () => {
  assert.deepEqual(STATION_ACTIONS.communications, [
    "answer_comm_hail",
    "close_comm",
    "send_comm_reply",
    "send_comm_message",
  ]);
  for (const action of ["answer_comm_hail", "close_comm", "send_comm_reply", "send_comm_message"]) {
    assert.equal(isActionAllowed("communications", action), true);
    assert.equal(isActionAllowed("weapons", action), false);
  }
  assert.deepEqual(
    resolveStationOrder({
      station: "communications",
      action: "answer_comm_hail",
      params: { accept: true },
    }),
    { method: "answerCommHail", args: [true] },
  );
  assert.deepEqual(
    resolveStationOrder({ station: "communications", action: "close_comm", params: {} }),
    { method: "closeComm", args: [] },
  );
  assert.deepEqual(
    resolveStationOrder({
      station: "communications",
      action: "send_comm_reply",
      params: { index: 2 },
    }),
    { method: "sendCommReply", args: [2] },
  );
  assert.deepEqual(
    resolveStationOrder({
      station: "communications",
      action: "send_comm_message",
      params: { message: "Solicito atraque." },
    }),
    { method: "sendCommMessage", args: ["Solicito atraque."] },
  );
});

test("isActionAllowed no lanza ante entradas inválidas", () => {
  assert.equal(isActionAllowed("desconocido", "set_target_heading"), false);
  assert.equal(isActionAllowed(null, "set_target_heading"), false);
  assert.equal(isActionAllowed("navigation", "set_system_power"), false);
  assert.equal(isActionAllowed("engineering", "set_target_heading"), false);
});

test("resolveStationOrder encamina la orden autorizada a BridgeClient", () => {
  const orden = resolveStationOrder({
    station: "navigation",
    action: "set_target_heading",
    params: { heading: 123.4 },
  });
  assert.equal(orden.method, "setTargetHeading");
  assert.deepEqual(orden.args, [123.4]);
});

test("resolveStationOrder rechaza un puesto desconocido", () => {
  assert.throws(
    () => resolveStationOrder({ station: "piloto", action: "set_target_heading" }),
    (error) => {
      assert.ok(error instanceof StationActionError);
      assert.equal(error.code, STATION_ACTION_ERRORS.UNKNOWN_STATION);
      return true;
    },
  );
});

test("resolveStationOrder rechaza una acción fuera del permiso del puesto", () => {
  for (const station of ["engineering", "weapons", "captain"]) {
    assert.throws(
      () => resolveStationOrder({ station, action: "set_target_heading" }),
      (error) => {
        assert.equal(error.code, STATION_ACTION_ERRORS.ACTION_NOT_ALLOWED);
        return true;
      },
      `${station} no debería poder fijar rumbo en esta rebanada`,
    );
  }
});

test("resolveStationOrder no inventa acciones fuera del whitelist", () => {
  assert.throws(
    () => resolveStationOrder({ station: "navigation", action: "self_destruct" }),
    (error) => error.code === STATION_ACTION_ERRORS.ACTION_NOT_ALLOWED,
  );
});
