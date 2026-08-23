// Importador del atlas: detecta CSV de HYG o JSON de atlas ya hecho,
// lo convierte cuando toca y lo devuelve VALIDADO por el validador cosmográfico.
// Puro: ni Foundry, ni DOM, ni red. Entra texto, sale catálogo validado o error tipado.

import { atlasDesdeHyg } from "./atlas-hyg.mjs";
import { validateCosmography, CosmographyValidationError } from "./catalogo-cosmografico.mjs";

/**
 * Error de importación: detecta formato, convierte y valida.
 * @extends {CosmographyValidationError}
 */
export class ImportadorAtlasError extends CosmographyValidationError {
  constructor(code, path, message) {
    super(code, path, message);
    this.name = "ImportadorAtlasError";
  }
}

/**
 * Detecta si el contenido es CSV de HYG (cabecera con columnas conocidas).
 * HYG siempre trae 'proper' como una de sus columnas.
 * @param {string} contenido
 * @returns {boolean}
 */
function esCSV_HYG(contenido) {
  if (typeof contenido !== "string") return false;
  const primeraLinea = contenido.split(/\r?\n/u)[0]?.trim();
  if (!primeraLinea) return false;
  const columnas = primeraLinea.split(",").map((c) => c.trim().toLowerCase());
  // HYG mínimo: proper, dist, mag, spect (por nombre, no por posición)
  return columnas.includes("proper");
}

/**
 * Detecta si el contenido es JSON del formato cosmográfico.
 * @param {string} contenido
 * @returns {boolean}
 */
function esJSON_Cosmografico(contenido) {
  if (typeof contenido !== "string") return false;
  const recortado = contenido.trim();
  if (!recortado.startsWith("{") || !recortado.endsWith("}")) return false;
  try {
    const objeto = JSON.parse(recortado);
    return (
      objeto.format === "espaciokoop-cosmography" &&
      typeof objeto.version === "number" &&
      Array.isArray(objeto.entries)
    );
  } catch {
    return false;
  }
}

/**
 * Importa un atlas desde contenido de archivo.
 *
 * @param {string} contenido - Contenido del fichero (CSV de HYG o JSON de atlas).
 * @param {object} [opciones] - Opciones de conversión (solo para CSV).
 * @param {number} [opciones.maximo] - Máximo de estrellas a importar (CSV).
 * @param {string} [opciones.versionHyg] - Versión de HYG para procedencia (CSV).
 * @returns {Promise<{format: string, version: number, entries: object[]}>}
 * @throws {ImportadorAtlasError} - Si el formato no se reconoce o la validación falla.
 */
export async function importarAtlas(contenido, opciones = {}) {
  let catalogo;

  if (esCSV_HYG(contenido)) {
    // CSV de HYG → convertir a formato cosmográfico
    catalogo = atlasDesdeHyg(contenido, {
      maximo: opciones.maximo,
      versionHyg: opciones.versionHyg,
    });
  } else if (esJSON_Cosmografico(contenido)) {
    // JSON ya en formato cosmográfico → parsear
    try {
      catalogo = JSON.parse(contenido);
    } catch (e) {
      throw new ImportadorAtlasError(
        "invalid_json",
        "$",
        "el contenido declara ser JSON cosmográfico pero no se puede parsear"
      );
    }
  } else {
    throw new ImportadorAtlasError(
      "unknown_format",
      "$",
      "formato no reconocido: se esperaba CSV de HYG (con columna 'proper') o JSON cosmográfico v1"
    );
  }

  // Validar SIEMPRE, venga de donde venga
  try {
    validateCosmography(catalogo);
  } catch (e) {
    if (e instanceof CosmographyValidationError) {
      // Re-lanzar como error de importador preservando código y ruta
      throw new ImportadorAtlasError(e.code, e.path, e.message);
    }
    throw e;
  }

  return catalogo;
}

// Re-exportar el error del validador para que el consumidor lo use igual
export { CosmographyValidationError } from "./catalogo-cosmografico.mjs";