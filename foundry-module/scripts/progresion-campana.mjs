const SHINY_BY_LEVEL = Object.freeze({
  0: Object.freeze({ tier: "plain", accent: "#8a918f" }),
  1: Object.freeze({ tier: "bronze", accent: "#d28b45" }),
  2: Object.freeze({ tier: "silver", accent: "#c4ccd1" }),
  3: Object.freeze({ tier: "gold", accent: "#f2c14e" }),
});

export const HITOS = Object.freeze({
  "first-voyage": Object.freeze({ nivel: 1, shiny: SHINY_BY_LEVEL[1] }),
  veteran: Object.freeze({ nivel: 3, shiny: SHINY_BY_LEVEL[3] }),
});

function clone(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(clone);
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, clone(entry)]));
}

function normalizeId(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError("progression id must be a non-empty string");
  }
  return value;
}

function deriveLevel(hitos) {
  return hitos.reduce((level, hito) => Math.max(level, HITOS[hito].nivel), 0);
}

function deriveShiny(nivel) {
  return clone(SHINY_BY_LEVEL[Math.min(nivel, 3)]);
}

export function normalizarProgresion(input = {}) {
  const source = input ?? {};
  const hitos = Array.isArray(source.hitos)
    ? [...new Set(source.hitos.filter((hito) => typeof hito === "string" && HITOS[hito]))]
    : [];
  const nivel = deriveLevel(hitos);

  return {
    id: normalizeId(source.id),
    nivel,
    hitos,
    shiny: deriveShiny(nivel),
  };
}

export function aplicarHito(progresion, hito) {
  if (!HITOS[hito]) throw new TypeError(`unknown campaign milestone: ${hito}`);
  const current = normalizarProgresion(progresion);
  if (current.hitos.includes(hito)) return current;
  return normalizarProgresion({
    id: current.id,
    hitos: [...current.hitos, hito],
  });
}

export function serializarProgresion(progresion) {
  return JSON.stringify(normalizarProgresion(progresion), null, 2);
}
