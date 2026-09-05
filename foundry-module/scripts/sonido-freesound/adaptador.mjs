// SoundSearchAdapter (#604): la UI del panel nunca habla con Freesound
// directamente, habla con esto. El contrato es intencionadamente pequeño —
// id, title, author, duration, license, previewUrl, sourceUrl— para que
// mañana pueda entrar otra fuente (Internet Archive, NASA...) sin rehacer el
// panel, como propuso la revisión del issue.
//
// EL FILTRO DE LICENCIA SE APLICA AQUÍ, EN EL CLIENTE, aunque la API permita
// filtrar en el servidor: la revisión del issue es explícita en que la
// licencia declarada hay que volver a comprobarla antes de presentar un
// resultado como utilizable, porque `licencia del sonido` y `términos de uso
// de la API` son cosas distintas y ninguna de las dos autoriza a confiar en
// el filtro remoto a ciegas.
//
// Puro: recibe el proveedor por parámetro (mismo patrón que
// `contenido-externo/adaptador.mjs`) y no toca Foundry ni DOM.

import { clasificarLicencia } from "./filtro-licencia.mjs";

function texto(valor) {
  return typeof valor === "string" ? valor.trim() : "";
}

function urlPreview(previews) {
  if (!previews || typeof previews !== "object") return "";
  return texto(previews["preview-hq-mp3"]) || texto(previews["preview-lq-mp3"]) || "";
}

/** Normaliza un resultado crudo de la API al contrato del adaptador, o
 *  `null` si la licencia no pasa el filtro fail-closed o falta algo
 *  esencial para poder audicionarlo (sin preview no hay nada que escuchar). */
function normalizar(bruto) {
  const licencia = clasificarLicencia(bruto?.license);
  if (!licencia.mostrable) return null;

  const previewUrl = urlPreview(bruto?.previews);
  const sourceUrl = texto(bruto?.url);
  const id = bruto?.id;
  if (!previewUrl || !sourceUrl || !Number.isFinite(id)) return null;

  return Object.freeze({
    id,
    title: texto(bruto?.name) || `#${id}`,
    author: texto(bruto?.username),
    duration: Number.isFinite(bruto?.duration) ? bruto.duration : null,
    license: licencia,
    previewUrl,
    sourceUrl,
  });
}

/**
 * Crea el adaptador de búsqueda.
 *
 * @param {object} opts
 * @param {{buscar: Function}} opts.proveedor  P. ej. `crearProveedorFreesound(...)`.
 */
export function crearAdaptadorBusquedaSonido({ proveedor } = {}) {
  return {
    /**
     * Busca y devuelve SOLO resultados utilizables (licencia libre, con
     * preview). Nunca lanza: un fallo del proveedor —red, clave, timeout—
     * se convierte en `{ resultados: [], error }` para que el panel lo
     * enseñe sin romperse, la misma promesa que #332 hace con "sin
     * proveedor".
     */
    async buscar(consulta, opciones) {
      if (!proveedor || typeof proveedor.buscar !== "function") {
        return Object.freeze({ resultados: Object.freeze([]), total: 0, error: "sin-proveedor" });
      }
      let bruto;
      try {
        bruto = await proveedor.buscar(consulta, opciones);
      } catch (err) {
        return Object.freeze({
          resultados: Object.freeze([]),
          total: 0,
          error: err?.kind ?? "network",
        });
      }
      const resultados = (bruto?.resultados ?? [])
        .map(normalizar)
        .filter((r) => r !== null);
      return Object.freeze({ resultados: Object.freeze(resultados), total: bruto?.total ?? 0, error: null });
    },
  };
}

/**
 * Borrador de ficha de procedencia (#604, #590 como precedente): NO
 * incorpora nada, solo escribe lo que una revisión humana necesitaría para
 * dar de alta el sonido por la puerta de `docs/ASSETS_LIBRES.md` —
 * exactamente el punto en el que el issue exige parar. `sha256` queda
 * marcado como pendiente porque solo se puede calcular sobre el fichero
 * original, y ese fichero no ha entrado al repositorio.
 */
export function borradorProcedencia(resultado) {
  const lineas = [
    "source: Freesound",
    `source_id: ${resultado.id}`,
    `source_url: ${resultado.sourceUrl}`,
    `title: ${resultado.title}`,
    `author: ${resultado.author || "(sin autor declarado)"}`,
    `license: ${resultado.license.codigo}`,
    "sha256: PENDIENTE (calcular tras descargar el original)",
  ];
  return lineas.join("\n");
}
