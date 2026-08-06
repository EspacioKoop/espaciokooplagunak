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
  assert.deepEqual(STATION_ACTIONS.navigation, [
    "set_target_heading",
    "set_impulse",
    "set_warp",
    "combat_maneuver_boost",
    "combat_maneuver_strafe",
    "dock",
    "undock",
    "abort_dock",
  ]);
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
  assert.deepEqual(STATION_ACTIONS.engineering, [
    "set_system_power",
    "set_system_coolant",
    "set_auto_repair",
    // #518: autodestrucción y frecuencia de escudos, las dos decisiones de la
    // pantalla nativa que faltaban.
    "activate_self_destruct",
    "cancel_self_destruct",
    "confirm_self_destruct_code",
    "set_shield_frequency",
  ]);
  assert.deepEqual(
    resolveStationOrder({
      station: "engineering",
      action: "set_system_coolant",
      params: { system: "impulse", level: 7 },
    }),
    { method: "setSystemCoolant", args: ["impulse", 7] },
  );
});

test("ingeniería activa/desactiva la reparación automática, y solo ella (#464)", () => {
  assert.equal(isActionAllowed("engineering", "set_auto_repair"), true);
  assert.equal(isActionAllowed("navigation", "set_auto_repair"), false);
  assert.equal(isActionAllowed("weapons", "set_auto_repair"), false);
  assert.deepEqual(
    resolveStationOrder({ station: "engineering", action: "set_auto_repair", params: { enabled: true } }),
    { method: "setAutoRepair", args: [true] },
  );
  assert.deepEqual(
    resolveStationOrder({ station: "engineering", action: "set_auto_repair", params: { enabled: false } }),
    { method: "setAutoRepair", args: [false] },
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

test("armas también fija objetivo y dispara tubos, y solo ella (#465)", () => {
  assert.equal(isActionAllowed("weapons", "set_weapon_target"), true);
  assert.equal(isActionAllowed("weapons", "fire_tube"), true);
  assert.equal(isActionAllowed("navigation", "set_weapon_target"), false);
  assert.equal(isActionAllowed("sensors", "fire_tube"), false);
  assert.deepEqual(STATION_ACTIONS.weapons, [
    "set_shields",
    "set_weapon_target",
    "fire_tube",
    // #518: una de las tres sillas que pueden confirmar un código.
    "confirm_self_destruct_code",
  ]);
  assert.deepEqual(
    resolveStationOrder({ station: "weapons", action: "set_weapon_target", params: { callsign: "Lapur 1" } }),
    { method: "setWeaponTarget", args: ["Lapur 1"] },
  );
  assert.deepEqual(
    resolveStationOrder({
      station: "weapons",
      action: "fire_tube",
      params: { callsign: "Lapur 1", index: 2 },
    }),
    { method: "fireTube", args: ["Lapur 1", 2] },
  );
});

test("sensores ordena el escaneo por indicativo, y solo ella (#462)", () => {
  assert.equal(isActionAllowed("sensors", "scan_object"), true);
  assert.equal(isActionAllowed("weapons", "scan_object"), false);
  assert.equal(isActionAllowed("navigation", "scan_object"), false);
  assert.deepEqual(STATION_ACTIONS.sensors, ["scan_object"]);
  assert.deepEqual(
    resolveStationOrder({
      station: "sensors",
      action: "scan_object",
      params: { callsign: "Lapur 1" },
    }),
    { method: "scanObject", args: ["Lapur 1"] },
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

// --- Navegación: maniobra de combate y atraque (#519) -------------------------

test("la maniobra de combate encamina a su método, con los dos ejes separados", () => {
  assert.deepEqual(
    resolveStationOrder({
      station: "navigation",
      action: "combat_maneuver_boost",
      params: { amount: 1 },
    }),
    { method: "combatManeuverBoost", args: [1] },
  );
  assert.deepEqual(
    resolveStationOrder({
      station: "navigation",
      action: "combat_maneuver_strafe",
      params: { amount: -0.5 },
    }),
    { method: "combatManeuverStrafe", args: [-0.5] },
  );
});

test("atracar, soltar amarras y cancelar el acercamiento son tres órdenes distintas", () => {
  // El motor las trata por separado: abortar un acercamiento no suelta un
  // atraque hecho, y confundirlas dejaría a la nave amarrada creyendo que no.
  assert.deepEqual(
    resolveStationOrder({ station: "navigation", action: "dock", params: { callsign: "Argia" } }),
    { method: "dock", args: ["Argia"] },
  );
  assert.deepEqual(
    resolveStationOrder({ station: "navigation", action: "undock" }),
    { method: "undock", args: [] },
  );
  assert.deepEqual(
    resolveStationOrder({ station: "navigation", action: "abort_dock" }),
    { method: "abortDock", args: [] },
  );
});

test("ningún otro puesto puede maniobrar ni atracar", () => {
  // La matriz es cerrada: exponer agencia nativa no relaja la autoridad (#237).
  for (const puesto of ["engineering", "weapons", "sensors", "communications", "relay"]) {
    for (const accion of ["combat_maneuver_boost", "combat_maneuver_strafe", "dock", "undock", "abort_dock"]) {
      assert.equal(isActionAllowed(puesto, accion), false, `${puesto} no puede ${accion}`);
      assert.throws(() => resolveStationOrder({ station: puesto, action: accion }), {
        code: STATION_ACTION_ERRORS.ACTION_NOT_ALLOWED,
      });
    }
  }
});

// --- Relay (#517) -------------------------------------------------------------

test("relay tiene las siete órdenes nativas, y el hackeo NO está entre ellas", () => {
  assert.deepEqual(STATION_ACTIONS.relay, [
    "add_waypoint",
    "move_waypoint",
    "remove_waypoint",
    "launch_probe",
    "set_science_link",
    "clear_science_link",
    "set_alert_level",
  ]);
  // El motor no expone el hackeo a Lua: prometerlo aquí sería una acción que
  // el puente no puede cumplir (#521).
  assert.equal(isActionAllowed("relay", "hack_target"), false);
});

test("las órdenes de relay encaminan a su método de BridgeClient", () => {
  assert.deepEqual(
    resolveStationOrder({ station: "relay", action: "add_waypoint", params: { x: 10, y: -20 } }),
    { method: "addWaypoint", args: [10, -20] },
  );
  assert.deepEqual(
    resolveStationOrder({
      station: "relay",
      action: "move_waypoint",
      params: { index: 2, x: 10, y: -20 },
    }),
    { method: "moveWaypoint", args: [2, 10, -20] },
  );
  assert.deepEqual(
    resolveStationOrder({ station: "relay", action: "set_alert_level", params: { level: "red" } }),
    { method: "setAlertLevel", args: ["red"] },
  );
  assert.deepEqual(
    resolveStationOrder({ station: "relay", action: "clear_science_link" }),
    { method: "clearScienceLink", args: [] },
  );
});

test("ningún otro puesto puede fijar la condición de alerta ni gastar sondas", () => {
  // La condición de alerta es autoridad sobre la nave ENTERA ejercida desde un
  // solo puesto: si se filtrara a otro, dejaría de ser una decisión de nadie.
  for (const puesto of ["captain", "navigation", "engineering", "weapons", "sensors", "communications"]) {
    for (const accion of STATION_ACTIONS.relay) {
      assert.equal(isActionAllowed(puesto, accion), false, `${puesto} no puede ${accion}`);
      assert.throws(() => resolveStationOrder({ station: puesto, action: accion }), {
        code: STATION_ACTION_ERRORS.ACTION_NOT_ALLOWED,
      });
    }
  }
});
// --- Autodestrucción y frecuencia de escudos (#518) ---------------------------

test("el capitán tiene exactamente UNA acción, y es asumir la autodestrucción", () => {
  // El capitán no accionaba nada por decisión (#268). #518 le da una sola cosa,
  // la más pesada. Esta prueba existe para que esa excepción siga siendo una
  // excepción y no la primera grieta de una lista que crece.
  assert.deepEqual(STATION_ACTIONS.captain, ["confirm_self_destruct_code"]);
  for (const accion of ["set_impulse", "set_system_power", "fire_tube", "set_shields", "scan_object"]) {
    assert.equal(isActionAllowed("captain", accion), false, `el capitán no puede ${accion}`);
  }
});

test("tres códigos, tres sillas distintas: mando, ingeniería y armas", () => {
  // La cooperación la impone el motor (SelfDestruct::max_codes), no el fork:
  // aquí solo se reparten las sillas para que no sea una persona sola.
  for (const puesto of ["captain", "engineering", "weapons"]) {
    assert.equal(isActionAllowed(puesto, "confirm_self_destruct_code"), true, puesto);
  }
  for (const puesto of ["navigation", "sensors", "communications"]) {
    assert.equal(isActionAllowed(puesto, "confirm_self_destruct_code"), false, puesto);
  }
});

test("armar y desarmar la secuencia son solo de ingeniería", () => {
  // Confirmar un código lo reparte la mesa; armar el ritual es del puesto que
  // conoce la nave. Si armar estuviera en tres sitios, el ritual empezaría por
  // accidente con más facilidad.
  for (const accion of ["activate_self_destruct", "cancel_self_destruct"]) {
    assert.equal(isActionAllowed("engineering", accion), true);
    for (const puesto of ["captain", "weapons", "navigation", "sensors", "communications"]) {
      assert.equal(isActionAllowed(puesto, accion), false, `${puesto} / ${accion}`);
    }
  }
});

test("las órdenes de #518 encaminan a su método de BridgeClient", () => {
  assert.deepEqual(
    resolveStationOrder({ station: "engineering", action: "activate_self_destruct" }),
    { method: "activateSelfDestruct", args: [] },
  );
  assert.deepEqual(
    resolveStationOrder({
      station: "captain",
      action: "confirm_self_destruct_code",
      params: { index: 1, code: 4321 },
    }),
    { method: "confirmSelfDestructCode", args: [1, 4321] },
  );
  assert.deepEqual(
    resolveStationOrder({
      station: "engineering",
      action: "set_shield_frequency",
      params: { frequency: 12 },
    }),
    { method: "setShieldFrequency", args: [12] },
  );
});

test("la frecuencia de escudos es de ingeniería y de nadie más", () => {
  // Aunque los escudos on/off sean de armas: subirlos es táctico, recalibrarlos
  // es tocar el sistema, y mientras dura la nave se queda sin escudos.
  assert.equal(isActionAllowed("engineering", "set_shield_frequency"), true);
  assert.equal(isActionAllowed("weapons", "set_shield_frequency"), false);
});

test("relay tampoco puede pilotar ni disparar", () => {
  // El puesto nuevo no es una llave maestra: entra con lo suyo y nada más.
  for (const accion of ["set_impulse", "set_warp", "fire_tube", "set_system_power", "scan_object"]) {
    assert.equal(isActionAllowed("relay", accion), false);
  }
});
