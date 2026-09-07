export const VISTAS_COMBATE = Object.freeze(["tactica", "pov", "tercera", "libre"]);

const ATAJOS = Object.freeze({
  "1": "tactica",
  "2": "pov",
  "3": "tercera",
  "4": "libre",
  v: "pov",
});

export function normalizarVista(view) {
  return VISTAS_COMBATE.includes(view) ? view : VISTAS_COMBATE[0];
}

export function siguienteVista(view) {
  const current = normalizarVista(view);
  const index = VISTAS_COMBATE.indexOf(current);
  return VISTAS_COMBATE[(index + 1) % VISTAS_COMBATE.length];
}

export function atajoVista(key) {
  if (typeof key !== "string") return null;
  return ATAJOS[key.toLowerCase()] ?? null;
}
