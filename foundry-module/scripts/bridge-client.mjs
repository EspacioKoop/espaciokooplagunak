/**
 * Cliente HTTP del puente de integración de Espaciokoop Lagunak (contrato v0,
 * ver bridge/README.md). ESM puro sin dependencias de Foundry: el mismo
 * archivo se importa desde el módulo (navegador) y desde Node para las
 * verificaciones sin instancia de Foundry.
 *
 * El token solo viaja en la cabecera Authorization; nunca se registra en
 * logs ni se incluye en los mensajes de error.
 */

export class BridgeError extends Error {
  /**
   * @param {string} message  Descripción sin datos sensibles.
   * @param {object} [opts]
   * @param {number} [opts.status]  Código HTTP, si hubo respuesta.
   * @param {string} [opts.kind]    "http" | "timeout" | "network" | "parse".
   */
  constructor(message, { status = 0, kind = "network" } = {}) {
    super(message);
    this.name = "BridgeError";
    this.status = status;
    this.kind = kind;
  }
}

export class BridgeClient {
  /**
   * @param {object} opts
   * @param {string} opts.url        Base del puente, p. ej. "http://localhost:8090".
   * @param {string} [opts.token]    Token Bearer (obligatorio para /v1/*).
   * @param {number} [opts.timeoutMs=5000]
   * @param {typeof fetch} [opts.fetchImpl]  Inyectable para pruebas.
   */
  constructor({ url, token = "", timeoutMs = 5000, fetchImpl } = {}) {
    if (!url) throw new BridgeError("URL del puente no configurada", { kind: "network" });
    this.url = url.replace(/\/+$/, "");
    this.token = token;
    this.timeoutMs = timeoutMs;
    this.fetchImpl = fetchImpl ?? ((...args) => fetch(...args));
  }

  /** GET /healthz — sin autenticación. */
  async healthz() {
    return this.#get("/healthz", { auth: false });
  }

  /** GET /v1/state — estado seguro de la nave (Bearer). */
  async state() {
    return this.#get("/v1/state", { auth: true });
  }

  /** GET /v1/scenario — tiempo y metadatos del escenario (Bearer). */
  async scenario() {
    return this.#get("/v1/scenario", { auth: true });
  }

  async #get(path, { auth }) {
    const headers = { Accept: "application/json" };
    if (auth) {
      if (!this.token) throw new BridgeError("Token del puente no configurado", { kind: "http", status: 401 });
      headers.Authorization = `Bearer ${this.token}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response;
    try {
      response = await this.fetchImpl(`${this.url}${path}`, { headers, signal: controller.signal });
    } catch (err) {
      if (err?.name === "AbortError") {
        throw new BridgeError(`Tiempo de espera agotado en ${path}`, { kind: "timeout" });
      }
      throw new BridgeError(`No se pudo contactar con el puente en ${path}`, { kind: "network" });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new BridgeError(`El puente respondió ${response.status} en ${path}`, {
        kind: "http",
        status: response.status,
      });
    }

    try {
      return await response.json();
    } catch {
      throw new BridgeError(`Respuesta no válida del puente en ${path}`, { kind: "parse" });
    }
  }
}
