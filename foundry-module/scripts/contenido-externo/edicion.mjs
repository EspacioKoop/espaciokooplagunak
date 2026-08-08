// Clasificación de edición del contenido de dnd5e ya presente en el mundo (#332).
//
// El módulo NO distribuye contenido de WotC ni lo importa: si el usuario ha
// traído statblocks, objetos o hechizos por su cuenta (plutonium/5etools u otra
// vía), esto decide cuáles puede mirar el módulo. La regla de mesa es dura y no
// se negocia: **solo material de la edición 2014**. Nada de 2024.
//
// ## Por qué hace falta un clasificador y no un `if`
//
// Las fuentes de 2014 y de 2024 llegan MEZCLADAS en el mismo mundo y con la
// misma forma. Un `if (actor.system)` no distingue un orco del Monster Manual
// de 2014 de uno del de 2024; los dos son actores de dnd5e con la misma pinta.
// La distinción está en los METADATOS de procedencia, y solo ahí: nombres,
// carpetas y convenciones de la comunidad no son evidencia (comentario 4 del
// issue). Un mundo con la carpeta «2014» llena de material de 2024 es un mundo
// perfectamente normal.
//
// ## Falla cerrado
//
// Lo que no se pueda clasificar con CERTEZA se descarta. No se asume 2014 por
// defecto, ni «total, casi todo lo importado es viejo». El coste de descartar de
// más es que el GM escriba a mano un statblock; el coste de aceptar de más es
// meter reglas de 2024 en la mesa sin avisar, que es exactamente lo que el
// issue prohíbe.
//
// ## Cada rechazo dice por qué
//
// Todo veredicto lleva un `motivo` estable (comentario 2 del issue). Sin él,
// depurar «no me sale ninguna criatura» obliga a relajar el criterio a ciegas.
// Los motivos son códigos, no frases: quien los enseñe que los traduzca.
//
// Puro: ni Foundry, ni DOM, ni red. Recibe objetos llanos.

/** Ediciones que sabemos nombrar. `DESCONOCIDA` no es un valor aceptable. */
export const EDICIONES = Object.freeze({
  D2014: "2014",
  D2024: "2024",
  DESCONOCIDA: "desconocida",
});

/** Motivos de veredicto. Estables: viajan a diagnósticos y a tests. */
export const MOTIVOS = Object.freeze({
  /** Un campo de reglas explícito dice 2014. Es la evidencia más fuerte. */
  REGLAS_EXPLICITAS: "reglas-explicitas",
  /** Sin campo explícito, pero la fuente está en la lista blanca de 2014. */
  FUENTE_EN_LISTA: "fuente-en-lista",
  /** Un campo de reglas explícito dice 2024. Rechazado por diseño. */
  REGLAS_2024: "reglas-2024",
  /** La fuente es un libro de la revisión de 2024. Rechazado por diseño. */
  FUENTE_2024: "fuente-2024",
  /** Hay fuente, pero no está clasificada. Falla cerrado. */
  FUENTE_DESCONOCIDA: "fuente-desconocida",
  /**
   * Hay un campo de reglas explícito y no dice ni 2014 ni 2024. Falla cerrado
   * SIN mirar la fuente: quien declara reglas manda, y una declaración que no
   * sabemos leer («2024-revised», una etiqueta nueva) no puede degradarse a
   * «pues mira el libro», porque el libro puede ser blanco y colar 2024.
   */
  REGLAS_DESCONOCIDAS: "reglas-desconocidas",
  /** No hay metadatos de procedencia utilizables. Falla cerrado. */
  SIN_METADATOS: "sin-metadatos",
  /** Lo que se pasó no es un documento con forma reconocible. */
  ENTRADA_INVALIDA: "entrada-invalida",
});

/**
 * Fuentes de la edición de 2014 aceptadas por defecto.
 *
 * Son abreviaturas de libro tal y como las escriben dnd5e y 5etools. La lista es
 * BLANCA a propósito: crece cuando alguien comprueba una fuente contra datos
 * reales, no cuando alguien supone. Ampliarla es una decisión de mesa, y por eso
 * `crearClasificador` acepta añadidos sin tocar este archivo.
 *
 * Todo lo de aquí es material publicado bajo el ruleset de 2014; que un libro
 * sea de 2022 (MPMM, SCC) no lo hace «2024»: la edición es el ruleset, no el año
 * de imprenta.
 */
export const FUENTES_2014 = Object.freeze([
  // Núcleo 2014.
  "PHB", "MM", "DMG",
  // Suplementos de reglas.
  "XGE", "TCE", "MTF", "VGM", "MPMM", "SCAG", "ERLW", "EGW", "MOT", "VRGR",
  "FTD", "SCC", "AAG", "BAM", "SAIS", "GGR", "AI", "TTP", "BGDIA", "IDRotF",
  // Básico y SRD del ruleset de 2014.
  "SRD", "BASIC", "DD",
]);

/**
 * Fuentes de la revisión de 2024, rechazadas EXPLÍCITAMENTE.
 *
 * No basta con que no estén en la lista blanca —eso ya las rechazaría—, pero
 * nombrarlas da un motivo honesto («es de 2024») en vez de uno vago («no la
 * conozco»), que es la diferencia entre un diagnóstico útil y uno que invita a
 * ampliar la lista blanca a lo bruto.
 */
export const FUENTES_2024 = Object.freeze(["XPHB", "XMM", "XDMG"]);

/**
 * Prefijo con que 5etools nombra la revisión de 2024 (`js/parser.js`): "X" más
 * la abreviatura de 2014 — XPHB frente a PHB, XMM frente a MM.
 *
 * Se usa SOLO como último recurso, después de la lista blanca, y solo para
 * mejorar el `motivo`: un XSRD acaba rechazado igual por no estar en la lista,
 * pero decir «es de 2024» en vez de «no la conozco» es la diferencia entre un
 * diagnóstico útil y uno que invita a ampliar la lista blanca a lo bruto.
 *
 * El orden NO es cosmético: hay fuentes de 2014 que empiezan por X —XGE, la
 * guía de Xanathar— y aplicar esto antes de la lista blanca las rechazaría por
 * la forma de su nombre. Es exactamente el fallo que tenía el filtro anterior
 * (`plutonium-filtro-edicion.mjs`, retirado en #524), cuya lista blanca era tan
 * corta —PHB/DMG/MM/SRD— que el choque no se veía.
 */
const PREFIJO_2024 = /^X./;

/**
 * Campos donde puede venir la procedencia, en orden de preferencia.
 *
 * OJO: esto es lo ÚNICO que este archivo sabe de la forma ajena, y está aquí
 * arriba y aislado para que un cambio de plutonium o de dnd5e se arregle en una
 * lista y no repartido por el módulo (comentario 1 del issue).
 *
 * Estado de verificación: los caminos de dnd5e (`system.source.*`) están
 * comprobados contra la hoja de un actor y un objeto del sistema; los de
 * plutonium (`flags.plutonium.*`) se aceptan como pista de fuente pero **no**
 * como declaración de reglas mientras nadie los contraste contra un mundo real.
 * Mientras esa comprobación no exista, el clasificador sigue fallando cerrado,
 * que es la postura segura: como mucho, descarta material válido.
 */
const CAMPOS_REGLAS = Object.freeze([
  ["system", "source", "rules"],
  ["system", "source", "edition"],
]);

const CAMPOS_FUENTE = Object.freeze([
  ["system", "source", "book"],
  ["system", "source", "custom"],
  ["system", "source"],
  ["flags", "plutonium", "source"],
  ["flags", "srd5e", "source"],
]);

/** Lee una ruta de campos sin explotar si falta un tramo. */
function leerRuta(documento, ruta) {
  let actual = documento;
  for (const tramo of ruta) {
    if (actual === null || typeof actual !== "object") return undefined;
    actual = actual[tramo];
  }
  return actual;
}

/** Normaliza para comparar: mayúsculas, sin espacios ni puntuación de adorno. */
function normalizar(valor) {
  if (typeof valor !== "string") return "";
  return valor.trim().toUpperCase().replace(/[\s._-]+/g, "");
}

/**
 * Extrae la fuente declarada. Devuelve `""` si no hay nada usable.
 *
 * `system.source` puede ser objeto (dnd5e moderno) o cadena suelta (mundos
 * viejos e importaciones a mano); ambos casos se contemplan porque los dos
 * aparecen en mundos reales.
 */
function fuenteDeclarada(documento) {
  for (const ruta of CAMPOS_FUENTE) {
    const bruto = leerRuta(documento, ruta);
    if (typeof bruto === "string" && bruto.trim() !== "") return bruto;
  }
  return "";
}

/** Extrae la declaración de reglas (`"2014"` / `"2024"`), si la hay. */
function reglasDeclaradas(documento) {
  for (const ruta of CAMPOS_REGLAS) {
    const bruto = leerRuta(documento, ruta);
    if (typeof bruto === "string" && bruto.trim() !== "") return bruto.trim();
  }
  return "";
}

function veredicto(edicion, aceptado, motivo, detalle) {
  return Object.freeze({ edicion, aceptado, motivo, detalle: detalle ?? "" });
}

/**
 * Crea un clasificador de edición.
 *
 * @param {object} [opciones]
 * @param {Iterable<string>} [opciones.fuentes2014] Fuentes 2014 adicionales que
 *   la mesa ha comprobado por su cuenta. Se SUMAN a las de serie; no las
 *   sustituyen, para que ampliar no pueda quitar sin querer.
 * @param {Iterable<string>} [opciones.fuentes2024] Fuentes de 2024 adicionales.
 *   Ganan siempre a la lista blanca: si una fuente aparece en las dos, se
 *   rechaza. Falla cerrado también aquí.
 */
export function crearClasificador(opciones = {}) {
  const blancas = new Set(FUENTES_2014.map(normalizar));
  for (const extra of opciones.fuentes2014 ?? []) {
    const limpia = normalizar(extra);
    if (limpia) blancas.add(limpia);
  }
  const negras = new Set(FUENTES_2024.map(normalizar));
  for (const extra of opciones.fuentes2024 ?? []) {
    const limpia = normalizar(extra);
    if (limpia) negras.add(limpia);
  }

  /**
   * Clasifica un documento del mundo.
   *
   * @param {object} documento Objeto llano o documento de Foundry.
   * @returns {{edicion: string, aceptado: boolean, motivo: string, detalle: string}}
   */
  function clasificar(documento) {
    if (documento === null || typeof documento !== "object") {
      return veredicto(EDICIONES.DESCONOCIDA, false, MOTIVOS.ENTRADA_INVALIDA);
    }

    // (1) Declaración explícita de reglas: la evidencia más fuerte que hay.
    // Manda sobre la fuente porque un mundo puede tener material de 2024 bajo un
    // libro que también existió en 2014.
    const reglas = normalizar(reglasDeclaradas(documento));
    if (reglas === "2024") {
      return veredicto(EDICIONES.D2024, false, MOTIVOS.REGLAS_2024, reglasDeclaradas(documento));
    }
    if (reglas === "2014") {
      // Y aun así, una fuente marcada como de 2024 rompe el empate en contra:
      // metadatos que se contradicen son metadatos en los que no se confía.
      const fuenteBruta = fuenteDeclarada(documento);
      if (negras.has(normalizar(fuenteBruta))) {
        return veredicto(EDICIONES.D2024, false, MOTIVOS.FUENTE_2024, fuenteBruta);
      }
      return veredicto(EDICIONES.D2014, true, MOTIVOS.REGLAS_EXPLICITAS, reglasDeclaradas(documento));
    }
    if (reglas !== "") {
      // Declara reglas, pero no las sabemos leer. No se cae a la fuente: eso
      // convertiría una etiqueta desconocida de 2024 en un «2014» aceptado en
      // cuanto el libro estuviera en la lista blanca. Se descarta y se dice qué
      // ponía, que es lo que permite ampliar el criterio a propósito y no a
      // ciegas.
      return veredicto(
        EDICIONES.DESCONOCIDA, false, MOTIVOS.REGLAS_DESCONOCIDAS, reglasDeclaradas(documento),
      );
    }

    // (2) Sin declaración: solo queda la fuente, contra lista blanca.
    const fuenteBruta = fuenteDeclarada(documento);
    if (fuenteBruta === "") {
      return veredicto(EDICIONES.DESCONOCIDA, false, MOTIVOS.SIN_METADATOS);
    }
    const fuente = normalizar(fuenteBruta);
    if (negras.has(fuente)) {
      return veredicto(EDICIONES.D2024, false, MOTIVOS.FUENTE_2024, fuenteBruta);
    }
    if (blancas.has(fuente)) {
      return veredicto(EDICIONES.D2014, true, MOTIVOS.FUENTE_EN_LISTA, fuenteBruta);
    }
    // (3) Ni en blanca ni en negra: si sigue el patrón de nombre de la revisión
    // de 2024, se puede decir POR QUÉ se rechaza. No cambia el veredicto —ya
    // estaba fuera— solo el motivo.
    if (PREFIJO_2024.test(fuente)) {
      return veredicto(EDICIONES.D2024, false, MOTIVOS.FUENTE_2024, fuenteBruta);
    }
    // (4) Hay fuente y no la conocemos. Fuera, y se dice cuál era.
    return veredicto(EDICIONES.DESCONOCIDA, false, MOTIVOS.FUENTE_DESCONOCIDA, fuenteBruta);
  }

  return Object.freeze({
    clasificar,
    /** Solo para diagnóstico y tests; copia, no la lista viva. */
    fuentesAceptadas: () => Object.freeze([...blancas].sort()),
  });
}

/** Clasificador de serie, sin añadidos de mesa. */
export const CLASIFICADOR = crearClasificador();

/** Atajo: ¿este documento es material de 2014 aceptable? */
export function esDe2014(documento) {
  return CLASIFICADOR.clasificar(documento).aceptado;
}
