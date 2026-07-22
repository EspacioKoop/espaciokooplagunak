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

  /** GET /v1/events — eventos normalizados presentes (Bearer). */
  async events() {
    return this.#get("/v1/events", { auth: true });
  }

  /** GET /v1/contacts — objetos cercanos a la nave para el mapa vivo (Bearer). */
  async contacts() {
    return this.#get("/v1/contacts", { auth: true });
  }

  /** GET /v1/encounters — catálogo cerrado de encuentros del GM (Bearer). */
  async encounters() {
    return this.#get("/v1/encounters", { auth: true });
  }

  /** POST /v1/command — encuentro del catálogo cerrado, con rumbo grueso opcional (Bearer). */
  async spawnEncounter(archetype, bearing = null) {
    if (typeof archetype !== "string" || archetype === "") {
      throw new BridgeError("El arquetipo de encuentro debe ser una cadena", { kind: "parse" });
    }
    if (bearing !== null && (typeof bearing !== "string" || bearing === "")) {
      throw new BridgeError("El rumbo del encuentro debe ser una cadena o null", { kind: "parse" });
    }
    const body = { op: "spawn_encounter", archetype };
    if (bearing !== null) body.bearing = bearing;
    return this.#request("/v1/command", {
      auth: true,
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  /** GET /v1/anchors — catálogo cerrado de anclas de reposición del GM (Bearer). */
  async anchors() {
    return this.#get("/v1/anchors", { auth: true });
  }

  /** POST /v1/command — reposiciona la nave a un ancla del catálogo cerrado (Bearer). */
  async repositionShip(anchor) {
    if (typeof anchor !== "string" || anchor === "") {
      throw new BridgeError("El ancla de reposición debe ser una cadena", { kind: "parse" });
    }
    return this.#request("/v1/command", {
      auth: true,
      method: "POST",
      body: JSON.stringify({ op: "reposition_ship", anchor }),
    });
  }

  /**
   * POST /v1/command — reparte energía a un sistema de la nave (Bearer).
   * Panel de ingeniería del GM: `system` es un identificador cerrado que el
   * puente valida (enum SystemName) y `level` el rango 0..3 que acepta.
   */
  async setSystemPower(system, level) {
    if (typeof system !== "string" || system === "") {
      throw new BridgeError("El sistema debe ser una cadena", { kind: "parse" });
    }
    if (typeof level !== "number" || !Number.isFinite(level) || level < 0 || level > 3) {
      throw new BridgeError("El nivel de energía debe estar entre 0 y 3", { kind: "parse" });
    }
    return this.#command({ op: "set_system_power", system, level });
  }

  /**
   * POST /v1/command — orden de refrigerante por sistema (Bearer). `system` es
   * el mismo enum cerrado SystemName que valida el puente; `level` el rango
   * 0..10 que acepta (el juego recorta a la cota real del sistema).
   */
  async setSystemCoolant(system, level) {
    if (typeof system !== "string" || system === "") {
      throw new BridgeError("El sistema debe ser una cadena", { kind: "parse" });
    }
    if (typeof level !== "number" || !Number.isFinite(level) || level < 0 || level > 10) {
      throw new BridgeError("El nivel de refrigerante debe estar entre 0 y 10", { kind: "parse" });
    }
    return this.#command({ op: "set_system_coolant", system, level });
  }

  /** POST /v1/command — orden directa de impulso, −1..1 (Bearer). */
  async setImpulse(value) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < -1 || value > 1) {
      throw new BridgeError("El impulso debe estar entre -1 y 1", { kind: "parse" });
    }
    return this.#command({ op: "set_impulse", value });
  }

  /** POST /v1/command — orden directa de warp, entero 0..4 (Bearer). */
  async setWarp(level) {
    if (typeof level !== "number" || !Number.isInteger(level) || level < 0 || level > 4) {
      throw new BridgeError("El nivel de warp debe ser un entero entre 0 y 4", { kind: "parse" });
    }
    return this.#command({ op: "set_warp", level });
  }

  /** POST /v1/command — orden directa de rumbo, 0..360 grados (Bearer). */
  async setTargetHeading(heading) {
    if (typeof heading !== "number" || !Number.isFinite(heading) || heading < 0 || heading > 360) {
      throw new BridgeError("El rumbo debe estar entre 0 y 360", { kind: "parse" });
    }
    return this.#command({ op: "set_target_heading", heading });
  }

  /** POST /v1/command — sube o baja los escudos (Bearer). */
  async setShields(active) {
    if (typeof active !== "boolean") {
      throw new BridgeError("El estado de escudos debe ser booleano", { kind: "parse" });
    }
    return this.#command({ op: "set_shields", active });
  }

  /** POST /v1/command — pausa o reanuda la simulación (Bearer). */
  async setPause(paused) {
    if (typeof paused !== "boolean") {
      throw new BridgeError("El estado de pausa debe ser booleano", { kind: "parse" });
    }
    return this.#request("/v1/command", {
      auth: true,
      method: "POST",
      body: JSON.stringify({ op: "set_pause", paused }),
    });
  }

  async #get(path, { auth }) {
    return this.#request(path, { auth, method: "GET" });
  }

  /** POST /v1/command con un cuerpo de orden ya tipado. */
  async #command(body) {
    return this.#request("/v1/command", {
      auth: true,
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async #request(path, { auth, method, body = undefined }) {
    const headers = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (auth) {
      if (!this.token) throw new BridgeError("Token del puente no configurado", { kind: "http", status: 401 });
      headers.Authorization = `Bearer ${this.token}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response;
    try {
      response = await this.fetchImpl(`${this.url}${path}`, {
        method,
        headers,
        body,
        signal: controller.signal,
      });
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
