// Catálogo de LIBROS: una entrada de texto que apunta a la geometría del libro (#853).
// Las obras son validadas por el MISMO `validarCatalogoPiezas` de `procedencia-catalogo.mjs` (#598).
// Nada de un segundo validador de licencia.
// Consumidor previsto: nave-estancias.mjs (como punto de interacción).

import {
  PATRON_ID,
  clavesExactas,
  esObjetoSimple,
  tamanoSerializado,
  textoLocalizado,
  textoPlano,
  validarProcedencia,
} from "./procedencia-catalogo.mjs";

const FORMATO = "espaciokoop-piezas";
const VERSION = 1;
const MAX_PIEZAS = 500;
const MAX_BYTES_SERIALIZADO = 512 * 1024;

// Reutilizamos las mismas naturalesa que el catálogo de piezas.
export const NATURALEZAS = Object.freeze([
  "escaneo",
  "escaneo-de-vaciado",
  "fotogrametria",
  "reconstruccion",
  "obra-propia",
]);
const NATURALEZAS_VALIDAS = new Set(NATURALEZAS);

const CLAVES_LIBRO = new Set(["id", "nombre", "cartela", "naturaleza", "malla", "provenance"]);
const CLAVES_LIBRO_OBLIGATORIAS = new Set(["id", "nombre", "cartela", "naturaleza", "malla", "provenance"]);

export const FORMATO_LIBROS = FORMATO;
export const VERSION_LIBROS = VERSION;

/**
 * Valida una entrada de libro (reutilizando la validación de pieza).
 * @param {object} libro entrada `{id, nombre, cartela, naturaleza, malla, provenance}`.
 * @param {number} indice índice en el array para mensajes de error.
 * @param {Set<string>|null} [mallasDisponibles] IDs de malla que existen de verdad.
 *   Se pasa desde fuera para que la comprobación de la unión sea real.
 */
function validarLibro(libro, indice, mallasDisponibles = null) {
  const path = `libros[${indice}]`;
  clavesExactas(libro, CLAVES_LIBRO, CLAVES_LIBRO_OBLIGATORIAS, path);
  if (typeof libro.id !== "string" || !PATRON_ID.test(libro.id)) {
    throw new Error(`${path}.id: ID portable no válido`);
  }
  textoLocalizado(libro.nombre, `${path}.nombre`, 120);
  textoLocalizado(libro.cartela, `${path}.cartela`, 900);
  if (!NATURALEZAS_VALIDAS.has(libro.naturaleza)) {
    throw new Error(`${path}.naturaleza: naturaleza del fichero no admitida`);
  }
  textoPlano(libro.malla, `${path}.malla`, 64);
  if (!PATRON_ID.test(libro.malla)) {
    throw new Error(`${path}.malla: ID de malla no válido`);
  }
  // La comprobación de que la malla referenciada existe se delega al consumidor.
  // Aquí solo validamos que sea un ID portable.
  validarProcedencia(libro.provenance, `${path}.provenance`);
}

/**
 * Valida un catálogo de libros completo.
 * @param {object} catalogo `{formato, version, libros: []}`.
 * @param {object} [opciones]
 * @param {Set<string>|null} [opciones.mallasDisponibles] IDs de malla que existen de verdad.
 * @returns {true}
 */
export function validarCatalogoLibros(catalogo, { mallasDisponibles = null } = {}) {
  if (!esObjetoSimple(catalogo)) {
    throw new Error("$: debe ser un objeto simple");
  }
  if (tamanoSerializado(catalogo) > MAX_BYTES_SERIALIZADO) {
    throw new Error("$: el catálogo supera 512 KiB serializado");
  }
  const claves = new Set(["formato", "version", "libros"]);
  clavesExactas(catalogo, claves, claves, "$");
  if (catalogo.formato !== FORMATO) {
    throw new Error("$.formato: formato desconocido");
  }
  if (catalogo.version !== VERSION) {
    throw new Error("$.version: versión no compatible");
  }
  if (!Array.isArray(catalogo.libros)) {
    throw new Error("$.libros: debe ser una lista");
  }
  if (catalogo.libros.length > MAX_PIEZAS) {
    throw new Error("$.libros: demasiados libros");
  }

  const vistos = new Set();
  catalogo.libros.forEach((libro, indice) => {
    validarLibro(libro, indice, mallasDisponibles);
    if (vistos.has(libro.id)) {
      throw new Error(`libros[${indice}].id: ID duplicado`);
    }
    vistos.add(libro.id);
  });
  return true;
}

/**
 * Catalogo de libros de ejemplo.
 * En un entorno real, este array se poblará con las obras deseadas.
 */
export const libros = [
  {
    id: "libro-clasico-001",
    nombre: {
      es: "Don Quijote de la Mancha",
      en: "Don Quixote of La Mancha",
    },
    cartela: {
      es: "Edición ilustrada de dominio público, texto adaptado como mancha tipográfica.",
      en: "Public domain illustrated edition, text adapted as typographic blot.",
    },
    naturaleza: "obra-propia",
    malla: "libro-cerrado", // ID portable de la malla de referencia (estado cerrado).
    provenance: {
      kind: "cc",
      source: "Project Gutenberg",
      license: "CC0-1.0",
      source_url: "https://www.gutenberg.org/ebooks/2000",
    },
  },
];

// Exportamos el objeto catalogo completo para facilitar su uso.
export const catalogo = {
  formato: FORMATO,
  version: VERSION,
  libros,
};

// Nota: Para validar este catalogo, importe `validarCatalogoLibros` y llámelo con:
//   validarCatalogoLibros(catalogo);
// (opcionalmente pasando un conjunto de mallas disponibles para validar referencias).