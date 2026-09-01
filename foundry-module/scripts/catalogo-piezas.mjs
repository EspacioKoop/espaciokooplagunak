// Catálogo de PIEZAS: una entrada de texto que apunta a una malla (#598).
//
// LO QUE FALTABA, y era una sola cosa. `catalogo-cosmografico.mjs` (#525) sabía
// validar texto con procedencia; el tubo de #590 sabía meter geometría con
// procedencia. Nada unía las dos mitades: no había forma de decir «esta ficha
// describe ESTA malla». Este módulo es esa unión, y por eso no revalida la
// licencia a su manera — usa `procedencia-catalogo.mjs`, el mismo camino.
//
// LA `naturaleza` ES OBLIGATORIA, Y NO ES METADATO. Es el campo que impide la
// mentira que #598 señala: el León de Al-Lāt no es un escaneo, es una
// RECONSTRUCCIÓN hecha después de que lo destruyeran, y las piezas del SMK son
// escaneos de VACIADOS EN YESO, no del mármol. En una ficha de asset eso es un
// detalle; en la cartela de un museo es lo que se lee. Lo honesto no es «así
// era» sino «así la reconstruyeron», y para poder escribir eso el dato tiene que
// existir en el catálogo y no en la cabeza de quien redacta.
//
// EL CRÉDITO SE DERIVA, NUNCA SE ESCRIBE AL LADO. `cartelaDe` compone la línea
// de crédito a partir de `provenance`, con la misma regla que el cartel de
// reglas del blackjack (#553): un crédito escrito a mano no falla, se
// desincroniza, y sigue atribuyendo la pieza a quien ya no la licencia así.
//
// LO QUE ESTE CATÁLOGO NO HACE, y es la regla de `docs/FOUNDRY.md`: no lleva la
// cuenta de nada. No hay «visto», ni «descubierto», ni orden de visita. Una
// entrada es una ficha y una malla; un bestiario que RECUERDE qué ha encontrado
// la tripulación es estado de partida y pertenece al núcleo, no aquí.
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

const FORMATO = "espaciokoop-piezas";
const VERSION = 1;
const MAX_PIEZAS = 500;
const MAX_BYTES_SERIALIZADO = 512 * 1024;

/**
 * Qué es el FICHERO, que no es lo mismo que qué es la obra.
 *
 * Los cuatro valores salen de lo que ya hay en `docs/PROCEDENCIA_ASSETS.md`, no
 * de imaginar categorías: hay escaneos de vaciados en yeso (todo el lote del
 * SMK), hay una reconstrucción digital (el León de Al-Lāt) y quedan abiertas la
 * fotogrametría de un original y la obra propia del módulo.
 */
export const NATURALEZAS = Object.freeze([
  "escaneo",
  "escaneo-de-vaciado",
  "fotogrametria",
  "reconstruccion",
  "obra-propia",
]);
const NATURALEZAS_VALIDAS = new Set(NATURALEZAS);

const CLAVES_PIEZA = new Set(["id", "nombre", "cartela", "naturaleza", "malla", "provenance"]);
const CLAVES_PIEZA_OBLIGATORIAS = new Set(["id", "nombre", "cartela", "naturaleza", "malla", "provenance"]);

export const FORMATO_PIEZAS = FORMATO;
export const VERSION_PIEZAS = VERSION;

function validarPieza(pieza, indice, mallasDisponibles) {
  const path = `piezas[${indice}]`;
  clavesExactas(pieza, CLAVES_PIEZA, CLAVES_PIEZA_OBLIGATORIAS, path);
  if (typeof pieza.id !== "string" || !PATRON_ID.test(pieza.id)) {
    fallo("invalid_id", `${path}.id`, "ID portable no válido");
  }
  textoLocalizado(pieza.nombre, `${path}.nombre`, 120);
  // La cartela es prosa, no un resumen de dos líneas: es donde cabe decir que
  // esto es un vaciado, o que alguien esculpió cómo creía que era. 900 es lo que
  // se lee de pie delante de una pieza sin que la ventana se convierta en un
  // artículo.
  textoLocalizado(pieza.cartela, `${path}.cartela`, 900);
  if (!NATURALEZAS_VALIDAS.has(pieza.naturaleza)) {
    fallo("invalid_naturaleza", `${path}.naturaleza`, "naturaleza del fichero no admitida");
  }
  textoPlano(pieza.malla, `${path}.malla`, 64);
  if (!PATRON_ID.test(pieza.malla)) {
    fallo("invalid_id", `${path}.malla`, "ID de malla no válido");
  }
  // LA UNIÓN, y por eso es un error tipado y no un `if` en la escena: una ficha
  // que apunta a una malla que no está en el árbol es un hueco en la sala del
  // museo, y se descubre montándola. Aquí se descubre validando.
  if (mallasDisponibles && !mallasDisponibles.has(pieza.malla)) {
    fallo("missing_reference", `${path}.malla`, "la malla referenciada no existe");
  }
  validarProcedencia(pieza.provenance, `${path}.provenance`);
}

/**
 * Valida un catálogo de piezas completo.
 *
 * @param {object} catalogo `{formato, version, piezas: []}`.
 * @param {object} [opciones]
 * @param {Set<string>|null} [opciones.mallasDisponibles] IDs de malla que
 *   existen de verdad. Se pasa desde fuera —este módulo no lee el disco ni
 *   importa `data/mallas/`— para que la comprobación de la unión sea real sin
 *   que el validador deje de ser puro.
 * @returns {true}
 */
export function validarCatalogoPiezas(catalogo, { mallasDisponibles = null } = {}) {
  if (!esObjetoSimple(catalogo)) fallo("invalid_object", "$", "debe ser un objeto simple");
  if (tamanoSerializado(catalogo) > MAX_BYTES_SERIALIZADO) {
    fallo("too_large", "$", "el catálogo supera 512 KiB serializado");
  }
  const claves = new Set(["formato", "version", "piezas"]);
  clavesExactas(catalogo, claves, claves, "$");
  if (catalogo.formato !== FORMATO) fallo("invalid_format", "$.formato", "formato desconocido");
  if (catalogo.version !== VERSION) fallo("invalid_version", "$.version", "versión no compatible");
  if (!Array.isArray(catalogo.piezas)) fallo("invalid_entries", "$.piezas", "debe ser una lista");
  if (catalogo.piezas.length > MAX_PIEZAS) fallo("too_many_entries", "$.piezas", "demasiadas piezas");

  const vistos = new Set();
  catalogo.piezas.forEach((pieza, indice) => {
    validarPieza(pieza, indice, mallasDisponibles);
    if (vistos.has(pieza.id)) fallo("duplicate_id", `piezas[${indice}].id`, "ID duplicado");
    vistos.add(pieza.id);
  });
  return true;
}

/** La pieza de ese id, o `null`. No lanza: buscar algo que no está es una
 *  respuesta, no un error de formato. */
export function piezaPorId(catalogo, id) {
  return catalogo?.piezas?.find((pieza) => pieza.id === id) ?? null;
}

/**
 * EL PUNTO ÚNICO DE RESOLUCIÓN (revisión externa de #598, Odiseo).
 *
 * Antes de esto, resolver una pieza obligaba a saber en qué sala vive: el
 * único consumidor —`andar-nave-app.mjs`— importaba `CATALOGO_MUSEO` de
 * `museo-piezas.mjs` a mano para poder llamar a `piezaPorId`. Eso ataba la
 * identidad de la pieza a la sala que hoy la enseña, y una futura
 * enciclopedia que quisiera la MISMA pieza habría tenido que repetir ese
 * import. La pieza debe poder responder por sí misma qué es y de dónde
 * procede sin que quien pregunta sepa en qué catálogo está.
 *
 * Cada módulo de contenido (`museo-piezas.mjs`, y mañana el que traiga la
 * enciclopedia) se registra una vez al cargarse con `registrarCatalogoPiezas`;
 * `getPiezaCatalogada(id)` resuelve contra todos los registrados. Es un
 * registro y no una fusión de catálogos: `catálogo cosmográfico` (mundos) y
 * `catálogo de piezas` (assets) siguen siendo dominios separados, comparten
 * solo el contrato de procedencia (`procedencia-catalogo.mjs`) — la
 * distinción que la misma revisión pide mantener.
 */
const REGISTRO_PIEZAS = new Map();

/**
 * Registra las piezas de un catálogo ya validado para que `getPiezaCatalogada`
 * pueda resolverlas. Un id repetido entre catálogos es un error de quien
 * registra, no un caso a silenciar: dos piezas con el mismo id son
 * indistinguibles para cualquier consumidor futuro.
 */
export function registrarCatalogoPiezas(catalogo) {
  for (const pieza of catalogo?.piezas ?? []) {
    if (REGISTRO_PIEZAS.has(pieza.id) && REGISTRO_PIEZAS.get(pieza.id) !== pieza) {
      throw new Error(`Pieza duplicada entre catálogos: "${pieza.id}"`);
    }
    REGISTRO_PIEZAS.set(pieza.id, pieza);
  }
}

/** La pieza de ese id, resuelta entre todos los catálogos registrados, o
 *  `null`. Es la única función que un consumidor de contenido —sala, ficha,
 *  futura enciclopedia— necesita conocer para llegar a una pieza. */
export function getPiezaCatalogada(id) {
  return REGISTRO_PIEZAS.get(id) ?? null;
}

/**
 * La cartela lista para pintar, en un idioma.
 *
 * Devuelve la CLAVE de traducción de la naturaleza y no su texto: cómo se dice
 * «escaneo de un vaciado en yeso» es cosa de `lang/`, igual que el resto de la
 * interfaz. El nombre y el texto de la cartela sí vienen del catálogo, porque
 * son el dato y no la interfaz.
 *
 * @param {object} pieza entrada ya validada.
 * @param {string} [idioma] `"es"` o `"en"`; cualquier otro cae a español, que es
 *   el idioma en el que se escribe el contenido de este módulo. Se mira solo el
 *   prefijo, porque un anfitrión puede venir con `en-GB` y quedarse sin cartela
 *   inglesa por dos caracteres.
 */
export function cartelaDe(pieza, idioma = "es") {
  const lengua = String(idioma ?? "").slice(0, 2).toLowerCase() === "en" ? "en" : "es";
  const { provenance } = pieza;
  return Object.freeze({
    id: pieza.id,
    titulo: pieza.nombre[lengua],
    texto: pieza.cartela[lengua],
    claveNaturaleza: `LAGUNAK.Museo.Naturaleza.${pieza.naturaleza}`,
    // Autoría del ARCHIVO y su licencia, en una línea. Es lo mínimo que exige
    // `docs/PROCEDENCIA_ASSETS.md` y lo que hace publicable la sala.
    credito: `${provenance.source} — ${provenance.license}`,
    fuente: provenance.source_url ?? null,
  });
}
