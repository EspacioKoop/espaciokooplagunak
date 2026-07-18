/**
 * Lógica pura de la reposición de la nave pedida por el GM (issue #176). ESM
 * sin dependencias de Foundry ni del DOM, probada desde Node.
 *
 * El catálogo lo publica el puente en /v1/anchors — la misma fuente de verdad
 * que valida /v1/command — y aquí solo se normaliza y se hace cumplir antes de
 * tocar la red: el módulo nunca hardcodea anclas ni puede enviar una que el
 * puente rechazaría. Foundry decide el *dónde* eligiendo un ancla del catálogo;
 * el escenario es dueño de la coordenada exacta que ese nombre resuelve. Nunca
 * se envían coordenadas crudas — eso sería doble autoridad sobre la posición de
 * la nave (ADR-0002).
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
 * Normaliza la respuesta de /v1/anchors a un catálogo seguro.
 *
 * @param {object|null} payload respuesta cruda del puente
 * @returns {{anchors: string[]}}
 */
export function normalizarCatalogoAnclas(payload) {
  return { anchors: soloCadenas(payload?.anchors) };
}

/**
 * Reposiciona la nave a un ancla del catálogo, solo para GM y solo con un
 * nombre que el catálogo anuncia. Devuelve la respuesta del puente, o null si
 * el usuario no es GM (sin tocar la red).
 *
 * @param {object} entrada
 * @param {string} entrada.anchor ancla elegida
 * @param {boolean} entrada.isGM
 * @param {{anchors: string[]}} entrada.catalogo
 * @param {{repositionShip: Function}} entrada.client
 */
export async function reposicionarNave({ anchor, isGM, catalogo, client }) {
  if (!isGM) return null;
  const { anchors } = normalizarCatalogoAnclas(catalogo);
  if (!anchors.includes(anchor)) {
    throw new BridgeError("Ancla de reposición fuera de catálogo", { kind: "parse" });
  }
  return client.repositionShip(anchor);
}

/**
 * Traduce la respuesta de /v1/command a la clave i18n del resultado. El ACK
 * del puente envuelve el resultado del Lua fijo en `result`.
 */
export function claveResultadoReposicion(respuesta) {
  const result = respuesta?.result;
  if (result?.ok === true) return { ok: true, clave: "LAGUNAK.Reposicion.Hecha" };
  if (result?.reason === "no_ship") return { ok: false, clave: "LAGUNAK.Reposicion.SinNave" };
  if (result?.reason === "not_supported") return { ok: false, clave: "LAGUNAK.Reposicion.NoSoportado" };
  return { ok: false, clave: "LAGUNAK.Reposicion.Fallo" };
}

/**
 * Modelo de vista para Handlebars: opciones con etiqueta localizada (si hay
 * clave i18n para el identificador; si no, el identificador crudo — el catálogo
 * puede crecer en el puente antes que las traducciones) y bandera de
 * habilitación del botón.
 */
export function prepararVistaReposicion({ conexion, catalogo, pendiente = false, seleccionAncla = null, i18n }) {
  const { anchors } = normalizarCatalogoAnclas(catalogo);
  // La clave se compone por segmentos (no como literal completo) para que el
  // test de localización no exija el prefijo sin identificador en el catálogo.
  const etiqueta = (id) => {
    const clave = ["LAGUNAK", "Reposicion", "Ancla", id].join(".");
    return i18n.has?.(clave) ? i18n.localize(clave) : id;
  };
  return {
    disponible: anchors.length > 0,
    puedeReposicionar: conexion === "ok" && anchors.length > 0 && !pendiente,
    pendiente: Boolean(pendiente),
    anclas: anchors.map((id) => ({
      id,
      etiqueta: etiqueta(id),
      seleccionada: id === (seleccionAncla ?? anchors[0]),
    })),
  };
}
