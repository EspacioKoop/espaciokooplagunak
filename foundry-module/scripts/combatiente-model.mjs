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

function normalizarBooleano(valor, defecto = false) {
  if (valor === true) return true;
  if (valor === false) return false;
  return defecto;
}

function normalizarAlineacion(valor) {
  if (ALINEACIONES.includes(valor)) return valor;
  return null;
}

function normalizarOverlays(valor) {
  const base = { ...OVERLAY_DEFAULTS };
  const raw = valor && typeof valor === "object" ? valor : {};
  for (const overlay of OVERLAYS) {
    base[overlay] = normalizarBooleano(raw[overlay], false);
  }
  return base;
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
    overlays: {
      ...base.overlays,
      ...normalizarOverlays(overlaysHttp),
    },
  };
}

export function serializarCombatiente(combatiente) {
  const data = normalizarCombatiente(combatiente ?? {});
  return JSON.stringify(data);
}
