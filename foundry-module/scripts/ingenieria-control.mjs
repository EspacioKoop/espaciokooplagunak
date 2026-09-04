/**
 * Lógica pura del panel de ingeniería del GM (roadmap Fase 3: «gestionar
 * motores, energía, temperatura, daños y reparaciones» desde Foundry). ESM sin
 * dependencias de Foundry ni del DOM, probada desde Node.
 *
 * Alcance y autoridad (ADR-0002): esta superficie es SOLO-GM. El puente publica
 * la telemetría por sistema en /v1/state (health/heat/power/coolant y el
 * repair_crew global) y autoriza `set_system_power` como orden cerrada — el GM
 * observa la nave y reparte energía por sistema, exactamente lo que el puente ya
 * permite, sin coordenadas ni Lua crudo. La REPARACIÓN normal sigue siendo
 * trabajo de la tripulación en su estación de ingeniería de EmptyEpsilon; el GM
 * no la sustituye, la observa. La avería directa (`set_system_health`) es una
 * palanca narrativa aparte y no vive en este panel.
 *
 * Una superficie de ingeniería *accionable por la tripulación* dentro de Foundry
 * queda fuera de alcance mientras no exista el modelo de permisos por puesto
 * (Pendiente v1 en bridge/README.md): el token del puente es solo-GM.
 */

import { BridgeError } from "./bridge-client.mjs";
import { prepareSystemRows } from "./ship-view/ship-view.mjs";

/**
 * Identificadores cerrados de sistema que el puente acepta en
 * `set_system_power` (enum SystemName en bridge/app.py). El módulo nunca envía
 * uno fuera de esta lista: sería una orden que el puente rechazaría con 422.
 */
export const SISTEMAS_INGENIERIA = Object.freeze([
  "reactor",
  "beamweapons",
  "missilesystem",
  "maneuver",
  "impulse",
  "warp",
  "jumpdrive",
  "frontshield",
  "rearshield",
]);

const SISTEMAS = new Set(SISTEMAS_INGENIERIA);

/**
 * Niveles de energía cerrados que ofrece el panel. El puente acepta el rango
 * continuo 0.0..3.0 (Field ge=0 le=3); aquí se exponen pasos discretos —1.0 es
 * el nominal del juego— para que el GM reparta sin manejar decimales crudos.
 */
export const NIVELES_POTENCIA = Object.freeze([0, 0.5, 1, 1.5, 2, 2.5, 3]);

const NIVELES = new Set(NIVELES_POTENCIA);

/** Un nivel válido: número finito dentro del conjunto cerrado. */
export function esNivelValido(level) {
  return typeof level === "number" && Number.isFinite(level) && NIVELES.has(level);
}

/**
 * Niveles de refrigerante cerrados que ofrece el puesto. El puente acepta el
 * rango continuo 0.0..10.0 (Field ge=0 le=10) y recorta server-side a la cota
 * real del sistema; aquí se exponen pasos enteros para ordenar sin decimales.
 */
export const NIVELES_REFRIGERANTE = Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

const NIVELES_REFRIG = new Set(NIVELES_REFRIGERANTE);

/** Un nivel de refrigerante válido: número finito dentro del conjunto cerrado. */
export function esNivelRefrigeranteValido(level) {
  return typeof level === "number" && Number.isFinite(level) && NIVELES_REFRIG.has(level);
}

/** Un sistema válido: identificador cerrado que el puente reconoce. */
export function esSistemaValido(system) {
  return typeof system === "string" && SISTEMAS.has(system);
}

/**
 * Ajusta la energía de un sistema, solo para GM y solo con un sistema y nivel
 * del catálogo cerrado. Valida antes de tocar la red — el módulo nunca envía
 * algo que el puente rechazaría. Devuelve la respuesta del puente, o null si el
 * usuario no es GM (sin tocar la red).
 *
 * @param {object} entrada
 * @param {string} entrada.system  identificador de sistema
 * @param {number} entrada.level   nivel de energía (0..3, paso cerrado)
 * @param {boolean} entrada.isGM
 * @param {{setSystemPower: Function}} entrada.client
 */
export async function ajustarPotencia({ system, level, isGM, client }) {
  if (!isGM) return null;
  if (!esSistemaValido(system)) {
    throw new BridgeError("Sistema de ingeniería fuera de catálogo", { kind: "parse" });
  }
  if (!esNivelValido(level)) {
    throw new BridgeError("Nivel de energía fuera de catálogo", { kind: "parse" });
  }
  return client.setSystemPower(system, level);
}

/**
 * Traduce la respuesta de /v1/command a la clave i18n del resultado. El ACK del
 * puente solo confirma que la orden fue aceptada y envuelve el resultado del Lua
 * fijo en `result`; no acredita todavía el nivel observado en /v1/state.
 */
export function claveResultadoIngenieria(respuesta) {
  const result = respuesta?.result;
  if (result?.ok === true) return { ok: true, clave: "LAGUNAK.Ingenieria.Aceptada" };
  if (result?.reason === "no_ship") return { ok: false, clave: "LAGUNAK.Ingenieria.SinNave" };
  return { ok: false, clave: "LAGUNAK.Ingenieria.Fallo" };
}

/** Etiqueta de nivel para la vista: entero sin decimales cuando aplica. */
function etiquetaNivel(level) {
  return Number.isInteger(level) ? String(level) : level.toFixed(1);
}

/**
 * Modelo de vista para Handlebars: matriz técnica de sistemas (reutilizando la
 * misma normalización que la ventana de estado), selector de sistema y de nivel
 * de energía, y bandera de habilitación del botón. No inventa valores: si el
 * estado no trae sistemas, la matriz queda vacía y el panel se anuncia sin
 * telemetría.
 *
 * @param {object} entrada
 * @param {string} entrada.conexion  "ok" | "loading" | "error" | "restricted"
 * @param {object|null} entrada.ship  ship de /v1/state
 * @param {boolean} [entrada.pendiente]  hay una orden en vuelo
 * @param {string|null} [entrada.seleccionSistema]
 * @param {number|null} [entrada.seleccionNivel]
 * @param {{localize: Function}} entrada.i18n
 */
export function prepararVistaIngenieria({
  conexion,
  ship,
  pendiente = false,
  seleccionSistema = null,
  seleccionNivel = null,
  i18n,
}) {
  const sistemas = prepareSystemRows(ship, i18n);
  const idsPresentes = sistemas.map((row) => row.id).filter((id) => SISTEMAS.has(id));
  const sistemaActivo = idsPresentes.includes(seleccionSistema)
    ? seleccionSistema
    : idsPresentes[0] ?? null;
  const nivelActivo = esNivelValido(seleccionNivel) ? seleccionNivel : 1;
  const repairCrew = Number(ship?.repair_crew);

  return {
    disponible: idsPresentes.length > 0,
    puedeAjustar: conexion === "ok" && idsPresentes.length > 0 && !pendiente,
    pendiente: Boolean(pendiente),
    tieneReparadores: Number.isFinite(repairCrew),
    reparadores: Number.isFinite(repairCrew) ? Math.max(0, Math.round(repairCrew)) : 0,
    sistemas,
    opcionesSistema: idsPresentes.map((id) => ({
      id,
      etiqueta: i18n?.localize?.(`LAGUNAK.Sistemas.${id}`) ?? id,
      seleccionado: id === sistemaActivo,
    })),
    niveles: NIVELES_POTENCIA.map((level) => ({
      valor: level,
      etiqueta: etiquetaNivel(level),
      seleccionado: level === nivelActivo,
      nominal: level === 1,
    })),
  };
}
