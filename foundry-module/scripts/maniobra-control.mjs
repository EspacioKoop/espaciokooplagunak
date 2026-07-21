/**
 * Lógica pura de las órdenes directas de nave del GM desde Foundry (issue #176:
 * «dar órdenes directas… sin pasar por los puestos de tripulación»). ESM sin
 * dependencias de Foundry ni del DOM, probada desde Node.
 *
 * Alcance y autoridad (ADR-0001, lista blanca del puente): esta superficie es
 * SOLO-GM y solo emite órdenes que el puente YA autoriza — `set_impulse`,
 * `set_warp`, `set_target_heading` y `set_shields`. No añade capacidades al
 * puente ni toca `src/`. Es el vertical de «órdenes directas» de #176; la
 * reposición a un ancla nombrada ya vive en reposicion-control.mjs, y la
 * ACELERACIÓN / factor temporal queda FUERA (descartada por falta de API del
 * juego, #34/#176) hasta que exista una frontera upstream para el tiempo.
 *
 * Todos los valores ofrecidos son catálogos cerrados dentro de los rangos que
 * valida el puente (impulso −1..1, warp entero 0..4, rumbo 0..360, escudos
 * booleano): el módulo nunca envía algo que el puente rechazaría con 422.
 */

import { BridgeError } from "./bridge-client.mjs";

/** Pasos de impulso ofrecidos (dentro del rango −1..1 del puente). */
export const IMPULSOS = Object.freeze([-1, -0.5, 0, 0.5, 1]);
/** Niveles de warp enteros (0..4 en el puente). */
export const NIVELES_WARP = Object.freeze([0, 1, 2, 3, 4]);
/** Rumbos gruesos: 8 puntos de brújula (0..315), dentro de 0..360. */
export const RUMBOS = Object.freeze([0, 45, 90, 135, 180, 225, 270, 315]);

const SET_IMPULSOS = new Set(IMPULSOS);
const SET_WARP = new Set(NIVELES_WARP);
const SET_RUMBOS = new Set(RUMBOS);

/** Operaciones de maniobra que este panel sabe emitir. */
export const OPS_MANIOBRA = Object.freeze(["impulse", "warp", "heading", "shields"]);

function validarValor(op, value) {
  switch (op) {
    case "impulse":
      return typeof value === "number" && Number.isFinite(value) && SET_IMPULSOS.has(value);
    case "warp":
      return typeof value === "number" && Number.isInteger(value) && SET_WARP.has(value);
    case "heading":
      return typeof value === "number" && Number.isFinite(value) && SET_RUMBOS.has(value);
    case "shields":
      return typeof value === "boolean";
    default:
      return false;
  }
}

/**
 * Emite una orden directa, solo para GM y solo con una operación y valor del
 * catálogo cerrado. Valida antes de tocar la red. Devuelve la respuesta del
 * puente, o null si el usuario no es GM (sin tocar la red).
 *
 * @param {object} entrada
 * @param {string} entrada.op  "impulse" | "warp" | "heading" | "shields"
 * @param {number|boolean} entrada.value
 * @param {boolean} entrada.isGM
 * @param {{setImpulse,setWarp,setTargetHeading,setShields: Function}} entrada.client
 */
export async function ordenarManiobra({ op, value, isGM, client }) {
  if (!isGM) return null;
  if (!OPS_MANIOBRA.includes(op)) {
    throw new BridgeError("Orden de maniobra desconocida", { kind: "parse" });
  }
  if (!validarValor(op, value)) {
    throw new BridgeError("Valor de maniobra fuera de catálogo", { kind: "parse" });
  }
  switch (op) {
    case "impulse":
      return client.setImpulse(value);
    case "warp":
      return client.setWarp(value);
    case "heading":
      return client.setTargetHeading(value);
    case "shields":
      return client.setShields(value);
    default:
      throw new BridgeError("Orden de maniobra desconocida", { kind: "parse" });
  }
}

/**
 * Traduce la respuesta de /v1/command a la clave i18n del resultado. El ACK del
 * puente envuelve el resultado del Lua fijo en `result`.
 */
export function claveResultadoManiobra(respuesta) {
  const result = respuesta?.result;
  if (result?.ok === true) return { ok: true, clave: "LAGUNAK.Maniobra.Enviada" };
  if (result?.reason === "no_ship") return { ok: false, clave: "LAGUNAK.Maniobra.SinNave" };
  return { ok: false, clave: "LAGUNAK.Maniobra.Fallo" };
}

/** Etiqueta corta de impulso: porcentaje con signo (−100 %…100 %). */
function etiquetaImpulso(value) {
  return `${Math.round(value * 100)}%`;
}

/**
 * Modelo de vista para Handlebars: botones de impulso, niveles de warp, rumbos
 * de brújula y estado de escudos, con banderas de habilitación. Solo refleja el
 * estado actual de escudos (`shields_active`), el único que /v1/state publica a
 * nivel de nave; impulso y warp actuales no están en el DTO v0, así que no se
 * marca «activo» para no inventar. Sin nave, nada queda disponible.
 *
 * @param {object} entrada
 * @param {string} entrada.conexion  "ok" | "loading" | "error" | "restricted"
 * @param {object|null} entrada.ship  ship de /v1/state
 * @param {boolean} [entrada.pendiente]  hay una orden en vuelo
 * @param {{localize: Function}} entrada.i18n
 */
export function prepararVistaManiobra({ conexion, ship, pendiente = false, i18n }) {
  const puede = conexion === "ok" && !pendiente;
  const escudos = ship?.shields_active;
  const etiquetaRumbo = (deg) =>
    i18n?.localize?.(`LAGUNAK.Maniobra.Brujula.${deg}`) ?? `${deg}°`;

  return {
    disponible: Boolean(ship),
    puedeOrdenar: puede && Boolean(ship),
    pendiente: Boolean(pendiente),
    impulsos: IMPULSOS.map((value) => ({
      valor: value,
      etiqueta: etiquetaImpulso(value),
      neutro: value === 0,
    })),
    warps: NIVELES_WARP.map((value) => ({
      valor: value,
      etiqueta: String(value),
    })),
    rumbos: RUMBOS.map((value) => ({
      valor: value,
      etiqueta: etiquetaRumbo(value),
    })),
    escudosActivos: escudos === true,
    escudosInactivos: escudos === false,
  };
}
