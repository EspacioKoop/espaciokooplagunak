// Importador de atlas: une el adaptador HYG y el validador cosmográfico.
// Puro: ni Foundry, ni DOM, ni red. Recibe CONTENIDO, devuelve catálogo validado.

import { atlasDesdeHyg } from "./atlas-hyg.mjs";
import { validateCosmography, CosmographyValidationError } from "./catalogo-cosmografico.mjs";

/** Detecta si el contenido parece CSV de HYG (tiene cabecera con columna 'proper'). */
function pareceHyg(csv) {
  const primera = String(csv ?? "").split(/\r?\n/u)[0]?.trim?.() ?? "";
  if (!primera) return false;
  const campos = primera.split(",").map((c) => c.trim().toLowerCase());
  return campos.includes("proper");
}

/**
 * Importa un atlas a partir del contenido de un fichero.
 *
 * @param {string} contenido Contenido del fichero (CSV de HYG o JSON de atlas).
 * @param {{ maximo?: number, versionHyg?: string }} opciones Opciones para el adaptador HYG.
 * @returns {{format: string, version: number, entries: object[]}} Catálogo validado.
 * @throws {CosmographyValidationError} Si el contenido no es válido o la validación falla.
 */
export function importarAtlas(contenido, { maximo, versionHyg } = {}) {
  if (typeof contenido !== "string" || contenido.trim() === "") {
    throw new CosmographyValidationError(
      "invalid_input",
      "$",
      "el contenido debe ser un texto no vacío",
    );
  }

  let catalogo;
  if (pareceHyg(contenido)) {
    catalogo = atlasDesdeHyg(contenido, { maximo, versionHyg });
  } else {
    // Intentar parsear como JSON
    let parseado;
    try {
      parseado = JSON.parse(contenido);
    } catch (e) {
      throw new CosmographyValidationError(
        "invalid_json",
        "$",
        "el contenido no es CSV de HYG (falta columna 'proper') ni JSON válido",
      );
    }
    catalogo = parseado;
  }

  // Validar el catálogo resultante
  validateCosmography(catalogo);
  return catalogo;
}

export { CosmographyValidationError };