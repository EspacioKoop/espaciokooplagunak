/**
 * Diagnóstico de conexión con el puente (issue #183): comprueba en dos pasos
 * que la configuración del GM funciona ANTES de una sesión — primero /healthz
 * (sin auth, ¿hay puente?) y después /v1/state (Bearer, ¿vale el token?).
 *
 * ESM puro sin dependencias de Foundry, como bridge-client.mjs: la misma
 * lógica se importa desde el módulo (navegador) y desde Node para las
 * pruebas. Nunca incluye el token en los resultados ni en los mensajes.
 */

import { BridgeClient, BridgeError } from "./bridge-client.mjs";

/**
 * Resultados posibles, con su clave i18n y si son un éxito.
 * - "ok":             puente accesible y token autorizado.
 * - "sin-url":        falta la URL del puente en los ajustes.
 * - "sin-token":      el puente responde pero no hay token configurado.
 * - "token-invalido": el puente responde pero rechaza el token (401/403).
 * - "inaccesible":    /healthz no responde (puente caído, URL o CORS).
 * - "error-puente":   /healthz responde pero /v1/state falla por otra causa.
 */
export const RESULTADOS_DIAGNOSTICO = Object.freeze({
  ok: { exito: true, claveI18n: "LAGUNAK.Diagnostico.Ok" },
  "sin-url": { exito: false, claveI18n: "LAGUNAK.Diagnostico.SinUrl" },
  "sin-token": { exito: false, claveI18n: "LAGUNAK.Diagnostico.SinToken" },
  "token-invalido": { exito: false, claveI18n: "LAGUNAK.Diagnostico.TokenInvalido" },
  inaccesible: { exito: false, claveI18n: "LAGUNAK.Diagnostico.Inaccesible" },
  "error-puente": { exito: false, claveI18n: "LAGUNAK.Diagnostico.ErrorPuente" },
});

function resultado(codigo) {
  const info = RESULTADOS_DIAGNOSTICO[codigo];
  return { codigo, exito: info.exito, claveI18n: info.claveI18n };
}

/**
 * Ejecuta el diagnóstico completo contra el puente.
 *
 * @param {object} opts
 * @param {string} opts.url    URL del puente configurada por el GM.
 * @param {string} opts.token  Token Bearer configurado (puede estar vacío).
 * @param {typeof fetch} [opts.fetchImpl]  Inyectable para pruebas.
 * @param {number} [opts.timeoutMs]
 * @param {() => boolean} [opts.canUseToken] Guardia viva antes/después de auth.
 * @returns {Promise<{codigo: string, exito: boolean, claveI18n: string}>}
 */
export async function probarConexion({
  url,
  token,
  fetchImpl,
  timeoutMs,
  canUseToken = () => true,
} = {}) {
  if (!url) return resultado("sin-url");

  const client = new BridgeClient({ url, token: token ?? "", timeoutMs, fetchImpl });
  try {
    await client.healthz();
  } catch {
    return resultado("inaccesible");
  }

  if (!token || !canUseToken()) return resultado("sin-token");
  try {
    await client.state();
    if (!canUseToken()) return resultado("sin-token");
  } catch (err) {
    if (err instanceof BridgeError && (err.status === 401 || err.status === 403)) {
      return resultado("token-invalido");
    }
    return resultado("error-puente");
  }
  return resultado("ok");
}
