// Parseo de URL con host verificado (#604).
//
// Existe porque el módulo tenía la comprobación hecha en un sitio y no en el
// otro. `filtro-licencia.mjs` verificaba con el parser real el host de la URL
// que solo CLASIFICA —y su cabecera explica muy bien por qué una regex de
// subcadena no cerraba nada—, mientras que las dos URLs que el adaptador de
// verdad DEREFERENCIA (el preview que suena en `new Audio(...)` y el enlace a
// la ficha de origen) llegaban del cuerpo de la respuesta con solo un `trim()`.
//
// La asimetría no era explotable el día que se escribió: ninguna de las dos
// llegaba al DOM, así que no había vía de `javascript:`. Lo que la hacía cara
// era el siguiente paso obvio del panel —un enlace «abrir en Freesound» con
// `sourceUrl` en un `<a href>`—, escrito por alguien que ve el filtro riguroso
// al lado y da por hecho que las URLs ya vienen comprobadas. Con una sola
// implementación esa suposición pasa a ser cierta.
//
// Puro: sin red, sin Foundry.

/**
 * Devuelve la URL parseada si su protocolo y su host están permitidos, o
 * `null` en cualquier otro caso — incluida una cadena que no sea una URL.
 *
 * El host se compara por IGUALDAD o por sufijo de punto (`cdn.freesound.org`
 * vale para `freesound.org`), nunca con `endsWith` a secas sobre la cadena:
 * eso aceptaría `evilfreesound.org`, que es la misma clase de agujero que
 * `filtro-licencia.mjs` ya cerró en su lado.
 *
 * @param {unknown} cruda
 * @param {readonly string[]} hosts  Dominios base admitidos.
 * @param {object} [opts]
 * @param {readonly string[]} [opts.protocolos=["https:"]]
 * @returns {URL|null}
 */
export function urlConHost(cruda, hosts, { protocolos = ["https:"] } = {}) {
  const texto = typeof cruda === "string" ? cruda.trim() : "";
  if (!texto) return null;

  let url;
  try {
    url = new URL(texto);
  } catch {
    return null;
  }

  if (!protocolos.includes(url.protocol)) return null;
  // Credenciales embebidas fuera, igual que en `procedencia-catalogo.mjs`:
  // una URL con usuario y contraseña no es la fuente que dice ser.
  if (url.username || url.password) return null;

  const host = url.hostname.toLowerCase();
  const admitido = hosts.some(
    (base) => host === base || host.endsWith(`.${base}`),
  );
  return admitido ? url : null;
}
