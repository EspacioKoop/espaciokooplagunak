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

import { urlConHost } from "./url-host.mjs";

/** Los únicos códigos que este módulo declara. Ampliar la lista es una
 *  decisión, no un efecto secundario de una regex más permisiva. */
export const CODIGOS = Object.freeze({
  CC0: "CC0",
  CC_BY: "CC-BY",
  CC_BY_NC: "CC-BY-NC",
  DESCONOCIDA: "desconocida",
});

// Reconocidas por la RUTA de una URL cuyo host es exactamente
// creativecommons.org, servida por https. Antes esto era una búsqueda de
// subcadena sobre la URL entera (`/licenses\/by\//i.test(url)`), así que
// "https://example.invalid/licenses/by/4.0/" clasificaba como CC-BY aunque
// el dominio no fuera de Creative Commons — un fail-closed que en realidad
// no cerraba nada, porque bastaba con imitar el trozo de ruta. El host y el
// protocolo se comprueban con el parser real `URL`, no con más regex sobre
// la cadena completa.
const HOST_CREATIVE_COMMONS = "creativecommons.org";

const PATRONES_RUTA = [
  { patron: /^\/publicdomain\/zero\/[0-9.]+\/?$/i, codigo: CODIGOS.CC0 },
  { patron: /^\/licenses\/by-nc\/[0-9.]+\/?$/i, codigo: CODIGOS.CC_BY_NC },
  { patron: /^\/licenses\/by\/[0-9.]+\/?$/i, codigo: CODIGOS.CC_BY },
];

/**
 * Clasifica una licencia cruda (la URL que devuelve la API).
 *
 * @returns {{codigo: string, mostrable: boolean, requiereAtribucion: boolean}}
 */
export function clasificarLicencia(licenciaCruda) {
  const cruda = typeof licenciaCruda === "string" ? licenciaCruda.trim() : "";
  const codigo = codigoDeUrl(cruda);

  return Object.freeze({
    codigo,
    // CC-BY-NC y desconocida quedan fuera: no sirven a este proyecto la una,
    // y la otra no se puede afirmar con certeza.
    mostrable: codigo === CODIGOS.CC0 || codigo === CODIGOS.CC_BY,
    requiereAtribucion: codigo === CODIGOS.CC_BY,
  });
}

function codigoDeUrl(cruda) {
  if (!cruda) return CODIGOS.DESCONOCIDA;

  // Freesound sigue devolviendo algunas licencias con "http:" (no "https:"),
  // así que el protocolo se acepta en cualquiera de los dos — lo que importa
  // de verdad es el HOST, que es donde estaba el agujero real. La comprobación
  // vive en `url-host.mjs` y la comparte con el adaptador: tenerla dos veces
  // es como una de las dos se queda atrás.
  //
  // Ojo: aquí el host se exige EXACTO y no por sufijo. `creativecommons.org`
  // no delega licencias en subdominios, así que aceptar `x.creativecommons.org`
  // solo ampliaría la superficie sin cubrir ningún caso real.
  const url = urlConHost(cruda, [HOST_CREATIVE_COMMONS], {
    protocolos: ["https:", "http:"],
  });
  if (!url || url.hostname.toLowerCase() !== HOST_CREATIVE_COMMONS) {
    return CODIGOS.DESCONOCIDA;
  }

  const encontrada = PATRONES_RUTA.find(({ patron }) => patron.test(url.pathname));
  return encontrada?.codigo ?? CODIGOS.DESCONOCIDA;
}
