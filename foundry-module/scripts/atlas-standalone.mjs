import { validateCosmography } from "./catalogo-cosmografico.mjs";

export function cargarAtlasStandalone(source) {
  const catalog = typeof source === "string" ? JSON.parse(source) : structuredClone(source);
  validateCosmography(catalog);
  return catalog;
}

export function consultarEntrada(catalog, id) {
  if (!catalog || !Array.isArray(catalog.entries) || typeof id !== "string") return null;
  return catalog.entries.find((entry) => entry.id === id) ?? null;
}

export function consultarHijos(catalog, parentId) {
  if (!catalog || !Array.isArray(catalog.entries) || typeof parentId !== "string") return [];
  return catalog.entries.filter((entry) => entry.parent_id === parentId);
}
