// Filtro de edición 2014 para contenido plutonium/5etools (#332).
//
// plutonium/5etools sirve contenido 2014 y 2024 mezclado en las mismas
// fuentes ya importadas al mundo. Aceptar sin distinguir traería reglas 2024
// sin avisar, justo lo que el issue pide evitar. Falla CERRADO: lo que no se
// pueda clasificar con certeza se descarta, nunca se asume 2014.
//
// Dos señales, verificadas contra datos reales antes de escribir esto (no
// supuestas, como pide el issue):
//
//  1. `system.source.rules` — el propio sistema dnd5e de Foundry (v3+) marca
//     cada actor/item con "2014" o "2024" al crearlo (foundryvtt/dnd5e#5922
//     documenta el campo). Es la señal más directa: no depende de plutonium
//     ni de convenciones de abreviatura de la comunidad (comentario 4 del
//     issue pide justo esto, metadatos verificables).
//  2. La abreviatura de fuente (`system.source.book`, o el string legado
//     `system.source` en documentos más antiguos) sigue el patrón
//     documentado en el código fuente de 5etools (js/parser.js): el prefijo
//     "X" marca la revisión 2024 (XPHB, XDMG, XMM, XSRD…) frente a su
//     equivalente 2014 sin prefijo (PHB, DMG, MM, SRD…). Como respaldo
//     cuando no hay `rules`, solo se acepta una lista blanca CERRADA de
//     fuentes 2014 ya verificadas contra esas constantes; una abreviatura
//     nueva no verificada se rechaza, no se asume 2014.
//
// Puro: ni Foundry, ni DOM, ni red.

export const EDICION = Object.freeze({
  CLASICA_2014: "2014",
  MODERNA_2024: "2024",
});

export const MOTIVO_RECHAZO = Object.freeze({
  SIN_METADATOS: "sin-metadatos-de-fuente",
  FUENTE_2024: "fuente-2024",
  FUENTE_DESCONOCIDA: "fuente-desconocida",
});

// Verificadas en #332 contra Parser.SRC_PHB / SRC_DMG / SRC_MM / SRC_SRD de
// 5etools (js/parser.js). Ampliar esta lista exige la misma verificación
// contra datos reales, no añadir por convención de la comunidad.
const FUENTES_2014_VERIFICADAS = new Set(["PHB", "DMG", "MM", "SRD"]);

function comienzaPorX(abreviatura) {
  return /^X/i.test(abreviatura);
}

function extraerFuente(documento) {
  const source = documento?.system?.source;
  if (source == null) return { rules: null, book: null };
  if (typeof source === "string") return { rules: null, book: source };
  const book =
    typeof source.book === "string"
      ? source.book
      : typeof source.custom === "string"
        ? source.custom
        : null;
  return {
    rules: typeof source.rules === "string" ? source.rules : null,
    book,
  };
}

/**
 * Clasifica un documento importado. Devuelve siempre un veredicto con
 * motivo explícito de rechazo: aceptar sin decir por qué impediría depurar
 * integraciones (comentario 2 del issue) sin relajar el criterio conservador.
 */
export function clasificarDocumento(documento) {
  const { rules, book } = extraerFuente(documento);

  if (rules === EDICION.CLASICA_2014) {
    return { aceptado: true, edicion: EDICION.CLASICA_2014, motivo: null };
  }
  if (rules === EDICION.MODERNA_2024) {
    return {
      aceptado: false,
      edicion: EDICION.MODERNA_2024,
      motivo: MOTIVO_RECHAZO.FUENTE_2024,
    };
  }

  if (!book) {
    return { aceptado: false, edicion: null, motivo: MOTIVO_RECHAZO.SIN_METADATOS };
  }

  const abreviatura = book.trim().toUpperCase();
  if (comienzaPorX(abreviatura)) {
    return {
      aceptado: false,
      edicion: EDICION.MODERNA_2024,
      motivo: MOTIVO_RECHAZO.FUENTE_2024,
    };
  }
  if (FUENTES_2014_VERIFICADAS.has(abreviatura)) {
    return { aceptado: true, edicion: EDICION.CLASICA_2014, motivo: null };
  }
  return { aceptado: false, edicion: null, motivo: MOTIVO_RECHAZO.FUENTE_DESCONOCIDA };
}
