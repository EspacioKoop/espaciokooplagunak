/**
 * Constantes compartidas entre main.mjs y las factorías de ventana
 * (estado de nave y mapa vivo, V1/V2). Extraído de main.mjs para que las
 * cuatro factorías no dependan de un módulo de 1700+ líneas solo por estas
 * constantes.
 */

export const MODULE_ID = "espaciokoop-lagunak";
export const POLL_MIN_S = 1;
export const POLL_MAX_S = 30;
export const BACKOFF_MAX_MS = 60000;

// Mapa vivo: mismo radio que el Lua fijo de /v1/contacts en el puente, fps del
// pintor y semilla por defecto del campo de estrellas y del decorado de fondo
// ("LAG" — mismo cielo y mismo decorado siempre, salvo que el GM la cambie).
export const MAPA_RADIO_MUNDO = 30000;
export const MAPA_FPS = 60;
export const MAPA_SEMILLA_DEFECTO = 0x4c4147;

/**
 * Semilla vigente del decorado (issue #215, mejora pedida en review): ajuste
 * de mundo (`scope: "world"`) para que el GM y todos los jugadores vean el
 * mismo cielo/decorado. Con `game.settings` aún sin registrar (tests fuera de
 * Foundry) cae al valor por defecto.
 */
export function semillaDecoradoActual() {
  const valor = Number(game.settings?.get?.(MODULE_ID, "decoradoSemilla"));
  return Number.isFinite(valor) ? valor : MAPA_SEMILLA_DEFECTO;
}

// Nonce de alertas por sesión del navegador (como el id de llegada del
// escenario): mantiene únicos los eventId de alerta entre sesiones y deja que un
// umbral se anote una sola vez por sesión aunque oscile.
export const ALERTAS_NONCE = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
