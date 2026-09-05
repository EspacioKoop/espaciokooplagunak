// Cliente de `freesound.org/apiv2` (#604). ESM puro sin dependencias de
// Foundry, mismo espíritu que `bridge-client.mjs`: el `fetch` se inyecta para
// poder probarlo desde Node sin red ni navegador.
//
// USA `/apiv2/search/` y no `/apiv2/search/text/` (deprecado desde noviembre
// de 2025, señalado en la revisión del issue).
//
// LA CLAVE SOLO SIRVE PARA BUSCAR Y ESCUCHAR PREVIEWS. Descargar el fichero
// original exige OAuth2, que este módulo no implementa a propósito (issue
// #604: la primera entrega se para en audición). Si `buscar` devuelve 401,
// es la clave la que falta o es inválida — nunca un permiso de descarga.

export class FreesoundError extends Error {
  /**
   * @param {string} message  Descripción sin la clave de API.
   * @param {object} [opts]
   * @param {number} [opts.status]
   * @param {string} [opts.kind}  "http" | "timeout" | "network" | "parse" | "sin-clave".
   */
  constructor(message, { status = 0, kind = "network" } = {}) {
    super(message);
    this.name = "FreesoundError";
    this.status = status;
    this.kind = kind;
  }
}

const BASE = "https://freesound.org/apiv2";

// Solo los campos que el adaptador necesita: nombre, autor, duración,
// licencia y las dos formas de referenciar el sonido (preview y página).
// Pedirlos explícitos evita que la API cambie sus valores por defecto por
// debajo nuestro sin que se note.
const CAMPOS = "id,name,username,duration,license,previews,url";

/**
 * Crea el proveedor.
 *
 * @param {object} opts
 * @param {() => string} opts.apiKey  Función y no cadena: la clave vive en
 *   memoria de sesión (`session.mjs`) y puede cambiar entre una llamada y la
 *   siguiente; leerla en el momento de la petición evita capturar una copia
 *   caducada.
 * @param {typeof fetch} [opts.fetchImpl]
 * @param {number} [opts.timeoutMs=8000]
 */
export function crearProveedorFreesound({ apiKey, fetchImpl, timeoutMs = 8000 } = {}) {
  if (typeof apiKey !== "function") {
    throw new FreesoundError("apiKey debe ser una función", { kind: "parse" });
  }
  const fetchFn = fetchImpl ?? ((...args) => fetch(...args));

  return {
    /**
     * Busca por texto libre. `pagina` es 1-indexado, como la propia API.
     * Devuelve los resultados CRUDOS de la API — la normalización y el
     * filtro de licencia son responsabilidad de `adaptador.mjs`, no de este
     * cliente.
     */
    async buscar(consulta, { pagina = 1, tamanoPagina = 15 } = {}) {
      const clave = apiKey();
      if (!clave) throw new FreesoundError("Sin clave de API configurada", { kind: "sin-clave" });
      const texto = typeof consulta === "string" ? consulta.trim() : "";
      if (!texto) return { total: 0, resultados: [] };

      const url = new URL(`${BASE}/search/`);
      url.searchParams.set("query", texto);
      url.searchParams.set("fields", CAMPOS);
      url.searchParams.set("page", String(Math.max(1, pagina)));
      url.searchParams.set("page_size", String(Math.min(30, Math.max(1, tamanoPagina))));

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response;
      try {
        response = await fetchFn(url.toString(), {
          headers: { Authorization: `Token ${clave}`, Accept: "application/json" },
          signal: controller.signal,
        });
      } catch (err) {
        if (err?.name === "AbortError") {
          throw new FreesoundError("Tiempo de espera agotado buscando en Freesound", { kind: "timeout" });
        }
        throw new FreesoundError("No se pudo contactar con Freesound", { kind: "network" });
      } finally {
        clearTimeout(timer);
      }

      if (response.status === 401) {
        throw new FreesoundError("Freesound rechazó la clave de API", { kind: "http", status: 401 });
      }
      if (!response.ok) {
        throw new FreesoundError(`Freesound respondió ${response.status}`, {
          kind: "http",
          status: response.status,
        });
      }

      let cuerpo;
      try {
        cuerpo = await response.json();
      } catch {
        throw new FreesoundError("Respuesta no válida de Freesound", { kind: "parse" });
      }

      return {
        total: Number.isFinite(cuerpo?.count) ? cuerpo.count : 0,
        resultados: Array.isArray(cuerpo?.results) ? cuerpo.results : [],
      };
    },
  };
}
