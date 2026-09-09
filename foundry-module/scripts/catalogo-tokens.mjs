// Catálogo de TOKENS 2D: una ficha de procedencia que apunta a un dato de
// imagen indexada, la mitad de #891 que no necesita traer ningún binario.
//
// MISMA UNIÓN QUE `catalogo-piezas.mjs` (#598), en 2D. `procedencia-catalogo.mjs`
// ya sabe validar licencias; lo que faltaba era decir «esta ficha describe ESTE
// dato de imagen». No revalida la licencia a su manera: usa el mismo camino.
//
// LA `naturaleza` ES OBLIGATORIA, y aquí distingue qué produjo el píxel, no qué
// produjo el polígono: una ilustración vectorizada a mano no es lo mismo que un
// escaneo de una miniatura física, y la cartela/crédito de un token debe poder
// decir cuál de las dos es.
//
// EL CRÉDITO SE DERIVA, igual que en `catalogo-piezas.mjs`: `creditoDe` compone
// la línea a partir de `provenance`, nunca se escribe a mano en
// `ASSET_CREDITS.md` — ese archivo lo escribe `asset-credits-gen.mjs` a partir
// de este catálogo.
//
// LO QUE ESTE CATÁLOGO NO HACE: no guarda el token en sí. `dato` es un ID
// portable que apunta a `foundry-module/data/tokens/<id>.mjs`, producido por
// `tools/convertir-token.mjs` — el mismo reparto que `malla` tiene en
// `catalogo-piezas.mjs` frente a `data/mallas/`. Ninguna imagen de terceros vive
// en este fichero ni en el árbol todavía (#891-A/#891-B); traer el primer dato
// real es #891-C.
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

const FORMATO = "espaciokoop-tokens";
const VERSION = 1;
const MAX_TOKENS = 500;
const MAX_BYTES_SERIALIZADO = 512 * 1024;

/**
 * Qué produjo el fichero de imagen, no qué representa el token.
 *
 * `ilustracion-original` y `pixelart-original` cubren el arte hecho a mano o a
 * ordenador (el caso típico de un pack CC0 de itch.io); `escaneo` y
 * `reconstruccion` quedan abiertos por si algún día entra una miniatura física
 * fotografiada o una reconstrucción de algo perdido, con la misma honestidad
 * que exige `NATURALEZAS` en `catalogo-piezas.mjs`.
 */
export const NATURALEZAS_TOKEN = Object.freeze([
  "ilustracion-original",
  "pixelart-original",
  "escaneo",
  "reconstruccion",
]);
const NATURALEZAS_VALIDAS = new Set(NATURALEZAS_TOKEN);

/** Categorías de uso en Foundry, para poder filtrar el catálogo por tipo. */
export const CATEGORIAS_TOKEN = Object.freeze([
  "personaje",
  "monstruo",
  "arquitectura",
  "arma-armadura",
  "prop",
  "npc",
]);
const CATEGORIAS_VALIDAS = new Set(CATEGORIAS_TOKEN);

const CLAVES_TOKEN = new Set(["id", "categoria", "nombre", "naturaleza", "dato", "provenance"]);
const CLAVES_TOKEN_OBLIGATORIAS = CLAVES_TOKEN;

export const FORMATO_TOKENS = FORMATO;
export const VERSION_TOKENS = VERSION;

function validarToken(token, indice, datosDisponibles) {
  const path = `tokens[${indice}]`;
  clavesExactas(token, CLAVES_TOKEN, CLAVES_TOKEN_OBLIGATORIAS, path);
  if (typeof token.id !== "string" || !PATRON_ID.test(token.id)) {
    fallo("invalid_id", `${path}.id`, "ID portable no válido");
  }
  if (!CATEGORIAS_VALIDAS.has(token.categoria)) {
    fallo("invalid_categoria", `${path}.categoria`, "categoría no admitida");
  }
  textoLocalizado(token.nombre, `${path}.nombre`, 120);
  if (!NATURALEZAS_VALIDAS.has(token.naturaleza)) {
    fallo("invalid_naturaleza", `${path}.naturaleza`, "naturaleza del fichero no admitida");
  }
  textoPlano(token.dato, `${path}.dato`, 64);
  if (!PATRON_ID.test(token.dato)) {
    fallo("invalid_id", `${path}.dato`, "ID de dato no válido");
  }
  // LA UNIÓN: una ficha que apunta a un dato que no está en el árbol es un
  // token roto en el catálogo de Foundry, y se descubre validando, no jugando.
  if (datosDisponibles && !datosDisponibles.has(token.dato)) {
    fallo("missing_reference", `${path}.dato`, "el dato de imagen referenciado no existe");
  }
  validarProcedencia(token.provenance, `${path}.provenance`);
}

/**
 * Valida un catálogo de tokens completo.
 *
 * @param {object} catalogo `{formato, version, tokens: []}`.
 * @param {object} [opciones]
 * @param {Set<string>|null} [opciones.datosDisponibles] IDs de dato de imagen
 *   que existen de verdad. Se pasa desde fuera —este módulo no lee el disco ni
 *   importa `data/tokens/`— para que la comprobación de la unión sea real sin
 *   que el validador deje de ser puro.
 * @returns {true}
 */
export function validarCatalogoTokens(catalogo, { datosDisponibles = null } = {}) {
  if (!esObjetoSimple(catalogo)) fallo("invalid_object", "$", "debe ser un objeto simple");
  if (tamanoSerializado(catalogo) > MAX_BYTES_SERIALIZADO) {
    fallo("too_large", "$", "el catálogo supera 512 KiB serializado");
  }
  const claves = new Set(["formato", "version", "tokens"]);
  clavesExactas(catalogo, claves, claves, "$");
  if (catalogo.formato !== FORMATO) fallo("invalid_format", "$.formato", "formato desconocido");
  if (catalogo.version !== VERSION) fallo("invalid_version", "$.version", "versión no compatible");
  if (!Array.isArray(catalogo.tokens)) fallo("invalid_entries", "$.tokens", "debe ser una lista");
  if (catalogo.tokens.length > MAX_TOKENS) fallo("too_many_entries", "$.tokens", "demasiados tokens");

  const vistos = new Set();
  catalogo.tokens.forEach((token, indice) => {
    validarToken(token, indice, datosDisponibles);
    if (vistos.has(token.id)) fallo("duplicate_id", `tokens[${indice}].id`, "ID duplicado");
    vistos.add(token.id);
  });
  return true;
}

/** El token de ese id, o `null`. No lanza: buscar algo que no está es una
 *  respuesta, no un error de formato. */
export function tokenPorId(catalogo, id) {
  return catalogo?.tokens?.find((token) => token.id === id) ?? null;
}

/**
 * El crédito de un token, derivado de su procedencia y nunca escrito a mano.
 *
 * Misma forma que `cartelaDe` en `catalogo-piezas.mjs`: es lo que consume
 * `asset-credits-gen.mjs` para escribir `ASSET_CREDITS.md`, así que un catálogo
 * editado y un markdown desincronizado son cosas que `--check` puede detectar.
 *
 * @param {object} token entrada ya validada.
 * @param {string} [idioma] `"es"` o `"en"`; cualquier otro cae a español.
 */
export function creditoDe(token, idioma = "es") {
  const lengua = String(idioma ?? "").slice(0, 2).toLowerCase() === "en" ? "en" : "es";
  const { provenance } = token;
  return Object.freeze({
    id: token.id,
    titulo: token.nombre[lengua],
    categoria: token.categoria,
    claveNaturaleza: `LAGUNAK.Tokens.Naturaleza.${token.naturaleza}`,
    credito: `${provenance.source} — ${provenance.license}`,
    fuente: provenance.source_url ?? null,
  });
}
