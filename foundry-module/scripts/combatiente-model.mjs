// Modelo puro para tarjetas de combatiente y overlays efímeros.
//
// Se mantiene sin acceso a Foundry, DOM ni red: solo serializa datos de entrada
// y normaliza estados visuales para que una futura barra de turno pueda
// consumirlo sin convertir la UI en fuente de verdad.

export const ALINEACIONES = Object.freeze(["aliado", "enemigo", "neutral"]);
export const OVERLAYS = Object.freeze(["herido", "ventaja", "concentracionRota", "muerto"]);

const OVERLAY_DEFAULTS = Object.freeze({
  herido: false,
  ventaja: false,
  concentracionRota: false,
  muerto: false,
});

function cloneValue(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((entry) => cloneValue(entry));
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneValue(entry)]));
  }
  return value;
}

function normalizarAlineacion(valor) {
  if (ALINEACIONES.includes(valor)) return valor;
  return null;
}

// El contrato de #1030 distingue tres estados por overlay: true, false, y
// "desconocido" (null/ausente) — un valor desconocido NO es lo mismo que un
// false explícito. Una clave que ni siquiera aparece en `valor` conserva la
// base que se le pase (los defaults al normalizar desde cero, o los
// overlays ya vigentes al aplicar una capa parcial); una clave presente con
// cualquier cosa que no sea `true`/`false` se marca `null`.
function normalizarOverlays(valor, base = OVERLAY_DEFAULTS) {
  const raw = valor && typeof valor === "object" ? valor : {};
  const resultado = { ...base };
  for (const overlay of OVERLAYS) {
    if (!Object.hasOwn(raw, overlay)) continue;
    const entrada = raw[overlay];
    resultado[overlay] = entrada === true ? true : entrada === false ? false : null;
  }
  return resultado;
}

export function normalizarCombatiente(input = {}) {
  const base = cloneValue(input.base ?? {});
  const shiny = cloneValue(input.shiny ?? input.shimmery ?? {});
  const estado = cloneValue(input.estado ?? {});
  const overlays = normalizarOverlays(input.overlays ?? {});
  const nombre = input.nombre ?? base.nombre ?? null;

  return {
    id: input.id ?? null,
    nombre,
    alineacion: normalizarAlineacion(input.alineacion ?? null),
    base,
    shiny,
    estado,
    overlays,
  };
}

export function aplicarOverlays(input = {}, overlaysHttp = {}) {
  const base = normalizarCombatiente(input);
  return {
    ...base,
    // Solo las claves aportadas por overlaysHttp se actualizan; el resto
    // conserva el valor de `base.overlays` intacto (antes se normalizaban
    // TODAS las claves ausentes a false antes del spread, machacando
    // cualquier overlay ya activo que la capa parcial no mencionara).
    overlays: normalizarOverlays(overlaysHttp, base.overlays),
  };
}

export function serializarCombatiente(combatiente) {
  const data = normalizarCombatiente(combatiente ?? {});
  return JSON.stringify(data);
}
