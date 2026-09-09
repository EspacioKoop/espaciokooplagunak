// Catálogo de MUEBLES: entradas que apuntan a mallas con procedencia.
//
// Puro: ni Foundry, ni DOM, ni red. Se prueba desde Node.

import {
  PATRON_ID,
  clavesExactas,
  esObjetoSimple,
  fallo,
  tamanoSerializado,
  textoLocalizado,
  textoPlano,
  validarProcedencia,
} from "./procedencia-catalogo.mjs";

const FORMATO = "espaciokoop-muebles";
const VERSION = 1;
const MAX_MUEBLES = 500;
const MAX_BYTES_SERIALIZADO = 512 * 1024;

/**
 * Naturaleza del fichero (qué es el archivo, no la obra). Los primeros cinco
 * valores son los mismos de `catalogo-piezas.mjs` (#598: la naturaleza no es
 * metadato, es lo que impide llamar "obra propia" a algo que no lo es).
 * `modelo-cc` se añade aquí porque el mobiliario, a diferencia de las piezas
 * de museo, puede venir de un pack de assets modelado a mano por un tercero y
 * publicado en abierto — no es un escaneo, no es una reconstrucción de una
 * obra física, y desde luego no es autoría de este módulo.
 */
const NATURALEZAS = Object.freeze([
  "escaneo",
  "escaneo-de-vaciado",
  "fotogrametria",
  "reconstruccion",
  "obra-propia",
  "modelo-cc",
]);
const NATURALEZAS_VALIDAS = new Set(NATURALEZAS);

/** Claves que debe tener cada entrada de mueble. */
const CLAVES_MUEBLE = new Set(["id", "nombre", "cartela", "naturaleza", "malla", "provenance"]);
const CLAVES_MUEBLE_OBLIGATORIAS = new Set(["id", "nombre", "cartela", "naturaleza", "malla", "provenance"]);

export const FORMATO_MUEBLES = FORMATO;
export const VERSION_MUEBLES = VERSION;

/**
 * Valida una entrada de mueble.
 * @param {object} mueble la entrada a validar.
 * @param {number} indice índice en el array para mensajes de error.
 * @param {Set<string>|null} [mallasDisponibles] IDs de malla que existen de verdad.
 */
function validarMueble(mueble, indice, mallasDisponibles) {
  const path = `muebles[${indice}]`;
  clavesExactas(mueble, CLAVES_MUEBLE, CLAVES_MUEBLE_OBLIGATORIAS, path);
  if (typeof mueble.id !== "string" || !PATRON_ID.test(mueble.id)) {
    fallo("invalid_id", `${path}.id`, "ID portable no válido");
  }
  textoLocalizado(mueble.nombre, `${path}.nombre`, 120);
  textoLocalizado(mueble.cartela, `${path}.cartela`, 900);
  if (!NATURALEZAS_VALIDAS.has(mueble.naturaleza)) {
    fallo("invalid_naturaleza", `${path}.naturaleza`, "naturaleza del fichero no admitida");
  }
  textoPlano(mueble.malla, `${path}.malla`, 64);
  if (!PATRON_ID.test(mueble.malla)) {
    fallo("invalid_id", `${path}.malla`, "ID de malla no válido");
  }
  if (mallasDisponibles && !mallasDisponibles.has(mueble.malla)) {
    fallo("missing_reference", `${path}.malla`, "la malla referenciada no existe");
  }
  validarProcedencia(mueble.provenance, `${path}.provenance`);
}

/**
 * Valida un catálogo de muebles completo.
 * @param {object} catalogo `{formato, version, muebles: []}`.
 * @param {object} [opciones]
 * @param {Set<string>|null} [opciones.mallasDisponibles] IDs de malla que existen de verdad.
 * @returns {true}
 */
export function validarCatalogoMuebles(catalogo, { mallasDisponibles = null } = {}) {
  if (!esObjetoSimple(catalogo)) fallo("invalid_object", "$", "debe ser un objeto simple");
  if (tamanoSerializado(catalogo) > MAX_BYTES_SERIALIZADO) {
    fallo("too_large", "$", "el catálogo supera 512 KiB serializado");
  }
  const claves = new Set(["formato", "version", "muebles"]);
  clavesExactas(catalogo, claves, claves, "$");
  if (catalogo.formato !== FORMATO) fallo("invalid_format", "$.formato", "formato desconocido");
  if (catalogo.version !== VERSION) fallo("invalid_version", "$.version", "versión no compatible");
  if (!Array.isArray(catalogo.muebles)) fallo("invalid_entries", "$.muebles", "debe ser una lista");
  if (catalogo.muebles.length > MAX_MUEBLES) fallo("too_many_entries", "$.muebles", "demasiadas entradas");

  const vistos = new Set();
  catalogo.muebles.forEach((mueble, indice) => {
    validarMueble(mueble, indice, mallasDisponibles);
    if (vistos.has(mueble.id)) fallo("duplicate_id", `muebles[${indice}].id`, "ID duplicado");
    vistos.add(mueble.id);
  });
  return true;
}

/**
 * El mueble de ese id, o `null`. No lanza: buscar algo que no está es una
 *  respuesta, no un error de formato.
 */
export function mueblePorId(catalogo, id) {
  return catalogo?.muebles?.find((mueble) => mueble.id === id) ?? null;
}

/**
 * Catálogo de muebles de ejemplo (por ahora solo el balcon de ladrillo).
 */
export const CATALOGO_MUEBLES = Object.freeze({
  formato: FORMATO,
  version: VERSION,
  muebles: Object.freeze([
    Object.freeze({
      id: "balcony-ladder-bottom",
      nombre: Object.freeze({
        es: "Escalera de balcon de ladrillo",
        en: "Balcony ladder bottom"
      }),
      cartela: Object.freeze({
        es: "Escalera de baldosa para acceder a un balcon urbano, estilo bajo polígono.",
        en: "Low-poly brick balcony ladder for urban access."
      }),
      naturaleza: "modelo-cc",
      malla: "balcony-ladder-bottom",
      provenance: Object.freeze({
        kind: "cc",
        source: "Kenney.nl",
        license: "CC0 1.0",
        source_url: "https://kenney.nl/assets/retro-urban-kit"
      })
    })
  ])
});
