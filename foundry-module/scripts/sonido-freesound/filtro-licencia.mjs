// Clasificación de licencias de Freesound (#604).
//
// FAIL-CLOSED: la API expone `license` como una URL de Creative Commons
// (p. ej. "https://creativecommons.org/publicdomain/zero/1.0/"), y lo único
// que este módulo hace es decidir, a partir de esa URL, si el resultado se
// puede ENSEÑAR como utilizable. Lo que no se pueda reconocer con certeza se
// descarta — la disciplina ya fijada en `contenido-externo/edicion.mjs` para
// el mismo problema (una fuente ambigua se trata como ausente, nunca como
// ×1). Aquí el precio de acertar mal es peor: enseñar una licencia
// equivocada invita a incorporar algo que el proyecto no puede usar.
//
// CC-BY-NC NO ENTRA EN NINGÚN CASO (issue #604): el filtro fail-closed ya lo
// cubre —no está en la lista blanca— pero se reconoce explícitamente para
// que el motivo del descarte sea legible y no un genérico "desconocida".
//
// Puro: sin red, sin Foundry.

/** Los únicos códigos que este módulo declara. Ampliar la lista es una
 *  decisión, no un efecto secundario de una regex más permisiva. */
export const CODIGOS = Object.freeze({
  CC0: "CC0",
  CC_BY: "CC-BY",
  CC_BY_NC: "CC-BY-NC",
  DESCONOCIDA: "desconocida",
});

// Reconocidas por el segmento de la URL de creativecommons.org. Freesound
// enlaza siempre a esa forma; otra URL no se interpreta, se descarta.
const PATRONES = [
  { patron: /\/publicdomain\/zero\//i, codigo: CODIGOS.CC0 },
  { patron: /\/licenses\/by-nc\//i, codigo: CODIGOS.CC_BY_NC },
  { patron: /\/licenses\/by\//i, codigo: CODIGOS.CC_BY },
];

/**
 * Clasifica una licencia cruda (la URL que devuelve la API).
 *
 * @returns {{codigo: string, mostrable: boolean, requiereAtribucion: boolean}}
 */
export function clasificarLicencia(licenciaCruda) {
  const url = typeof licenciaCruda === "string" ? licenciaCruda.trim() : "";
  if (!url) {
    return Object.freeze({ codigo: CODIGOS.DESCONOCIDA, mostrable: false, requiereAtribucion: false });
  }

  const encontrada = PATRONES.find(({ patron }) => patron.test(url));
  const codigo = encontrada?.codigo ?? CODIGOS.DESCONOCIDA;

  return Object.freeze({
    codigo,
    // CC-BY-NC y desconocida quedan fuera: no sirven a este proyecto la una,
    // y la otra no se puede afirmar con certeza.
    mostrable: codigo === CODIGOS.CC0 || codigo === CODIGOS.CC_BY,
    requiereAtribucion: codigo === CODIGOS.CC_BY,
  });
}
