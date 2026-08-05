import { normalizeStation } from "./station-assignment.mjs";

// Matriz de autoridad por puesto. Declara qué órdenes —y SOLO cuáles— del
// whitelist del puente (bridge/app.py) puede emitir cada puesto de tripulación.
// Es un contrato deliberadamente cerrado: añadir una acción exige que el puente
// ya la autorice y que el puesto la necesite. Un puesto ausente aquí no puede
// emitir ninguna orden operativa.
export const STATION_ACTIONS = Object.freeze({
  navigation: Object.freeze(["set_target_heading", "set_impulse", "set_warp"]),
  engineering: Object.freeze(["set_system_power", "set_system_coolant"]),
  // #465: fijar objetivo habilita el fuego automático de haces ya cargados;
  // disparar un tubo es una orden aparte porque un tubo puede no estar
  // cargado o no tener arco de tiro — el juego decide, el puente solo pide.
  weapons: Object.freeze(["set_shields", "set_weapon_target", "fire_tube"]),
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
