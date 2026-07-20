import assert from "node:assert/strict";
import test from "node:test";

import {
  STATION_ACTIONS,
  STATION_ACTION_ERRORS,
  StationActionError,
  isActionAllowed,
  resolveStationOrder,
} from "../scripts/station-actions.mjs";

test("navegación puede fijar rumbo", () => {
  assert.equal(isActionAllowed("navigation", "set_target_heading"), true);
  assert.deepEqual(STATION_ACTIONS.navigation, ["set_target_heading"]);
});

test("isActionAllowed no lanza ante entradas inválidas", () => {
  assert.equal(isActionAllowed("desconocido", "set_target_heading"), false);
  assert.equal(isActionAllowed(null, "set_target_heading"), false);
  assert.equal(isActionAllowed("navigation", "set_impulse"), false);
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
