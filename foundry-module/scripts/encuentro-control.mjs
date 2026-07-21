/**
 * Lógica pura de los encuentros inyectados por el GM (issue #117). ESM sin
 * dependencias de Foundry ni del DOM, probada desde Node.
 *
 * El catálogo lo publica el puente en /v1/encounters — la misma fuente de
 * verdad que valida /v1/command — y aquí solo se normaliza y se hace cumplir
 * antes de tocar la red: el módulo nunca hardcodea arquetipos ni puede enviar
 * uno que el puente rechazaría. Foundry decide el *qué* (arquetipo) y como
 * mucho sugiere un rumbo grueso; el escenario es dueño del *cómo*.
 */

import { BridgeError } from "./bridge-client.mjs";

/** Deja solo cadenas no vacías y únicas: el catálogo llega por red. */
function soloCadenas(values) {
  const vistos = new Set();
  const limpio = [];
  for (const value of Array.isArray(values) ? values : []) {
    if (typeof value !== "string" || value === "" || vistos.has(value)) continue;
    vistos.add(value);
    limpio.push(value);
  }
  return limpio;
}

/**
 * Normaliza la respuesta de /v1/encounters a un catálogo seguro.
 *
 * @param {object|null} payload respuesta cruda del puente
 * @returns {{archetypes: string[], bearings: string[]}}
 */
export function normalizarCatalogoEncuentros(payload) {
  return {
    archetypes: soloCadenas(payload?.archetypes),
    bearings: soloCadenas(payload?.bearings),
  };
}

/**
 * Ordena un encuentro del catálogo, solo para GM y solo con valores que el
 * catálogo anuncia. Devuelve la respuesta del puente, o null si el usuario
 * no es GM (sin tocar la red).
 *
 * @param {object} entrada
 * @param {string} entrada.archetype arquetipo elegido
 * @param {string|null} [entrada.bearing] rumbo grueso opcional
 * @param {boolean} entrada.isGM
 * @param {{archetypes: string[], bearings: string[]}} entrada.catalogo
 * @param {{spawnEncounter: Function}} entrada.client
 */
export async function introducirEncuentro({ archetype, bearing = null, isGM, catalogo, client }) {
  if (!isGM) return null;
  const { archetypes, bearings } = normalizarCatalogoEncuentros(catalogo);
  if (!archetypes.includes(archetype)) {
    throw new BridgeError("Arquetipo de encuentro fuera de catálogo", { kind: "parse" });
  }
  if (bearing !== null && !bearings.includes(bearing)) {
    throw new BridgeError("Rumbo de encuentro fuera de catálogo", { kind: "parse" });
  }
  return client.spawnEncounter(archetype, bearing);
}

/**
 * Traduce la respuesta de /v1/command a la clave i18n del resultado. El ACK
 * del puente envuelve el resultado del Lua fijo en `result`.
 */
export function claveResultadoEncuentro(respuesta) {
  const result = respuesta?.result;
  if (result?.ok === true) return { ok: true, clave: "LAGUNAK.Encuentros.Introducido" };
  if (result?.reason === "no_ship") return { ok: false, clave: "LAGUNAK.Encuentros.SinNave" };
  if (result?.reason === "not_supported") return { ok: false, clave: "LAGUNAK.Encuentros.NoSoportado" };
  return { ok: false, clave: "LAGUNAK.Encuentros.Fallo" };
}

/**
 * Modelo de vista para Handlebars: opciones con etiqueta localizada (si hay
 * clave i18n para el identificador; si no, el identificador crudo — el
 * catálogo puede crecer en el puente antes que las traducciones) y bandera
 * de habilitación del botón.
 */
export function prepararVistaEncuentros({ conexion, catalogo, pendiente = false, seleccionArquetipo = null, seleccionRumbo = null, i18n }) {
  const { archetypes, bearings } = normalizarCatalogoEncuentros(catalogo);
  // La clave se compone por segmentos (no como literal completo) para que el
  // test de localización no exija el prefijo sin identificador en el catálogo.
  const etiqueta = (grupo, id) => {
    const clave = ["LAGUNAK", "Encuentros", grupo, id].join(".");
    return i18n.has?.(clave) ? i18n.localize(clave) : id;
  };
  return {
    disponible: archetypes.length > 0,
    puedeIntroducir: conexion === "ok" && archetypes.length > 0 && !pendiente,
    pendiente: Boolean(pendiente),
    arquetipos: archetypes.map((id) => ({
      id,
      etiqueta: etiqueta("Arquetipo", id),
      seleccionado: id === (seleccionArquetipo ?? archetypes[0]),
    })),
    rumbos: bearings.map((id) => ({
      id,
      etiqueta: etiqueta("Rumbo", id),
      seleccionado: id === seleccionRumbo,
    })),
  };
}
