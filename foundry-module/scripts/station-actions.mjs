import { normalizeStation } from "./station-assignment.mjs";

// Matriz de autoridad por puesto. Declara qué órdenes —y SOLO cuáles— del
// whitelist del puente (bridge/app.py) puede emitir cada puesto de tripulación.
// Es un contrato deliberadamente cerrado: añadir una acción exige que el puente
// ya la autorice y que el puesto la necesite. Un puesto ausente aquí no puede
// emitir ninguna orden operativa.
export const STATION_ACTIONS = Object.freeze({
  // #519: la maniobra de combate y el atraque son decisiones nativas del timón
  // que Foundry no exponía. La maniobra gasta una carga que se recarga sola
  // (se lee de `/v1/state`, no se estima); atracar y cancelar el acercamiento
  // son órdenes distintas del motor, no dos nombres de lo mismo.
  navigation: Object.freeze([
    "set_target_heading",
    "set_impulse",
    "set_warp",
    "combat_maneuver_boost",
    "combat_maneuver_strafe",
    "dock",
    "undock",
    "abort_dock",
  ]),
  // El capitán no tenía ninguna acción, y era deliberado (#268): coordina, no
  // acciona. #518 le da exactamente UNA, y por un motivo que no vale para
  // ninguna otra: confirmar un código de autodestrucción no es operar la nave,
  // es asumir la decisión. Tres códigos exigen tres personas distintas
  // (`SelfDestruct::max_codes`), y las tres sillas naturales son quien manda,
  // quien conoce la nave y quien está en las armas.
  //
  // Ojo con leer esto como una grieta: el capitán sigue sin poder pilotar,
  // repartir energía ni disparar. Una sola acción, la más pesada de todas.
  captain: Object.freeze(["confirm_self_destruct_code"]),
  // #518 añade la autodestrucción y la frecuencia de escudos, las dos
  // decisiones de la pantalla nativa de Ingeniería que faltaban aquí.
  // Recalibrar NO es un ajuste: deja los escudos caídos mientras dura.
  engineering: Object.freeze([
    "set_system_power",
    "set_system_coolant",
    "set_auto_repair",
    "activate_self_destruct",
    "cancel_self_destruct",
    "confirm_self_destruct_code",
    "set_shield_frequency",
  ]),
  // #465: fijar objetivo habilita el fuego automático de haces ya cargados;
  // disparar un tubo es una orden aparte porque un tubo puede no estar
  // cargado o no tener arco de tiro — el juego decide, el puente solo pide.
  weapons: Object.freeze(["set_shields", "set_weapon_target", "fire_tube", "confirm_self_destruct_code"]),
  // #462: traduce a orden de puente el escaneo nativo (ship:commandScan) que
  // ya existe en Science — ver docs/SESION-PANTALLAS-NATIVAS.md.
  sensors: Object.freeze(["scan_object"]),
  communications: Object.freeze([
    "answer_comm_hail",
    "close_comm",
    "send_comm_reply",
    "send_comm_message",
  ]),
});

// Correspondencia acción del contrato → método de BridgeClient. La validación
// fina de rangos vive en BridgeClient (separación de responsabilidades): aquí
// solo autorizamos por puesto y encaminamos; el puente valida el dato.
const ACTION_DISPATCH = Object.freeze({
  set_target_heading: Object.freeze({
    method: "setTargetHeading",
    args: (params) => [params?.heading],
  }),
  set_impulse: Object.freeze({
    method: "setImpulse",
    args: (params) => [params?.value],
  }),
  set_warp: Object.freeze({
    method: "setWarp",
    args: (params) => [params?.level],
  }),
  combat_maneuver_boost: Object.freeze({
    method: "combatManeuverBoost",
    args: (params) => [params?.amount],
  }),
  combat_maneuver_strafe: Object.freeze({
    method: "combatManeuverStrafe",
    args: (params) => [params?.amount],
  }),
  dock: Object.freeze({
    method: "dock",
    args: (params) => [params?.callsign],
  }),
  undock: Object.freeze({
    method: "undock",
    args: () => [],
  }),
  abort_dock: Object.freeze({
    method: "abortDock",
    args: () => [],
  }),
  activate_self_destruct: Object.freeze({
    method: "activateSelfDestruct",
    args: () => [],
  }),
  cancel_self_destruct: Object.freeze({
    method: "cancelSelfDestruct",
    args: () => [],
  }),
  confirm_self_destruct_code: Object.freeze({
    method: "confirmSelfDestructCode",
    args: (params) => [params?.index, params?.code],
  }),
  set_shield_frequency: Object.freeze({
    method: "setShieldFrequency",
    args: (params) => [params?.frequency],
  }),
  set_system_power: Object.freeze({
    method: "setSystemPower",
    args: (params) => [params?.system, params?.level],
  }),
  set_system_coolant: Object.freeze({
    method: "setSystemCoolant",
    args: (params) => [params?.system, params?.level],
  }),
  set_shields: Object.freeze({
    method: "setShields",
    args: (params) => [params?.active],
  }),
  set_auto_repair: Object.freeze({
    method: "setAutoRepair",
    args: (params) => [params?.enabled],
  }),
  scan_object: Object.freeze({
    method: "scanObject",
    args: (params) => [params?.callsign],
  }),
  set_weapon_target: Object.freeze({
    method: "setWeaponTarget",
    args: (params) => [params?.callsign],
  }),
  fire_tube: Object.freeze({
    method: "fireTube",
    args: (params) => [params?.callsign, params?.index],
  }),
  answer_comm_hail: Object.freeze({
    method: "answerCommHail",
    args: (params) => [params?.accept],
  }),
  close_comm: Object.freeze({
    method: "closeComm",
    args: () => [],
  }),
  send_comm_reply: Object.freeze({
    method: "sendCommReply",
    args: (params) => [params?.index],
  }),
  send_comm_message: Object.freeze({
    method: "sendCommMessage",
    args: (params) => [params?.message],
  }),
});

export const STATION_ACTION_ERRORS = Object.freeze({
  UNKNOWN_STATION: "unknown-station",
  ACTION_NOT_ALLOWED: "action-not-allowed",
});

export class StationActionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "StationActionError";
    this.code = code;
  }
}

// ¿Puede este puesto emitir esta acción? Puro y sin efectos: no lanza, para
// poder consultarlo desde la UI (mostrar/ocultar controles) sin try/catch.
export function isActionAllowed(station, action) {
  let normalized;
  try {
    normalized = normalizeStation(station);
  } catch {
    return false;
  }
  if (normalized === null) return false;
  return (STATION_ACTIONS[normalized] ?? []).includes(action);
}

// Resuelve una orden autorizada a su despacho contra BridgeClient. Lanza
// StationActionError si el puesto es desconocido o la acción no está permitida
// para ese puesto. Devuelve `{ method, args }` listos para `bridge[method](...args)`.
export function resolveStationOrder({ station, action, params = {} } = {}) {
  let normalized;
  try {
    normalized = normalizeStation(station);
  } catch {
    normalized = null;
  }
  if (normalized === null) {
    throw new StationActionError(
      STATION_ACTION_ERRORS.UNKNOWN_STATION,
      `Puesto desconocido: ${String(station)}`,
    );
  }
  if (!isActionAllowed(normalized, action)) {
    throw new StationActionError(
      STATION_ACTION_ERRORS.ACTION_NOT_ALLOWED,
      `El puesto ${normalized} no puede emitir ${String(action)}`,
    );
  }
  const dispatch = ACTION_DISPATCH[action];
  return { method: dispatch.method, args: dispatch.args(params) };
}
