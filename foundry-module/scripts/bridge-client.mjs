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

// Validaciones compartidas por las órdenes de Relay (#517). Duplican a
// propósito las cotas del puente: aquí evitan un viaje de red inútil y dan un
// mensaje legible, allí son la autoridad. Si divergen, gana el puente.
const COORDENADA_MAXIMA = 500_000;
const NIVELES_ALERTA = new Set(["normal", "yellow", "red"]);

function esCoordenada(valor) {
  return (
    typeof valor === "number"
    && Number.isFinite(valor)
    && valor >= -COORDENADA_MAXIMA
    && valor <= COORDENADA_MAXIMA
  );
}

function esIndiceWaypoint(valor) {
  return typeof valor === "number" && Number.isInteger(valor) && valor >= 0 && valor <= 63;
}

// Casilla del interior de la nave (#522). Enteros y acotados: duplica la cota
// del puente para evitar un viaje de red inútil y dar un mensaje legible. Si
// divergen, gana el puente.
function esCasilla(punto) {
  if (!punto || typeof punto !== "object") return false;
  return [punto.x, punto.y].every(
    (v) => typeof v === "number" && Number.isInteger(v) && v >= -128 && v <= 128,
  );
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

  /**
   * GET /v1/database — base de datos científica del escenario (#520, Bearer).
   *
   * CONSULTA, no orden: no hay nada que ordenar aquí. Recurso aparte de
   * `/v1/state` porque es contenido de referencia casi inmóvil, y meterlo en el
   * sondeo haría que cada ciclo reenviara siempre lo mismo — por eso el
   * consumidor lo pide UNA vez y no en el bucle.
   */
  async database() {
    return this.#get("/v1/database", { auth: true });
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

  /**
   * POST /v1/command — activa/desactiva el reparto automático de tripulación
   * de reparación (#464). Con auto-reparación desactivada, los sistemas
   * dañados no se reparan solos.
   */
  async setAutoRepair(enabled) {
    if (typeof enabled !== "boolean") {
      throw new BridgeError("El estado de auto-reparación debe ser booleano", { kind: "parse" });
    }
    return this.#command({ op: "set_auto_repair", enabled });
  }

  /**
   * POST /v1/command — ordena el escaneo nativo de un objetivo (#462, Bearer).
   * `callsign` es el mismo indicativo que ya expone `/v1/contacts`; el puente
   * resuelve la entidad y llama a `ship:commandScan(target)` (misma orden que
   * el botón "Scan" nativo de Science). Sin objetivo con ese indicativo entre
   * los contactos cercanos, el puente responde `target_not_found` — puede
   * pasar si el objeto salió de rango entre que se listó y se pulsó escanear.
   */
  async scanObject(callsign) {
    if (typeof callsign !== "string" || callsign === "") {
      throw new BridgeError("El indicativo del objetivo debe ser una cadena", { kind: "parse" });
    }
    return this.#command({ op: "scan_object", callsign });
  }

  /**
   * POST /v1/command — fija el objetivo de armas (#465, Bearer). Habilita el
   * fuego automático de haces ya cargados; no dispara tubos de misiles por
   * sí sola. Mismo indicativo y misma resolución que `scanObject`.
   */
  async setWeaponTarget(callsign) {
    if (typeof callsign !== "string" || callsign === "") {
      throw new BridgeError("El indicativo del objetivo debe ser una cadena", { kind: "parse" });
    }
    return this.#command({ op: "set_weapon_target", callsign });
  }

  /**
   * POST /v1/command — dispara el tubo `index` contra `callsign` (#465,
   * Bearer). Sin comprobar aquí si el tubo existe o está cargado: el juego
   * ya lo valida server-side y no tiene efecto si no procede.
   */
  async fireTube(callsign, index) {
    if (typeof callsign !== "string" || callsign === "") {
      throw new BridgeError("El indicativo del objetivo debe ser una cadena", { kind: "parse" });
    }
    if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index > 15) {
      throw new BridgeError("El índice de tubo debe ser un entero entre 0 y 15", { kind: "parse" });
    }
    return this.#command({ op: "fire_tube", callsign, index });
  }

  /**
   * POST /v1/command — empujón de maniobra de combate, 0..1 (#519, Bearer).
   * Solo hacia adelante: es el rango del eje de empuje del control nativo, no
   * un recorte nuestro. Gasta carga (`combat_maneuver.charge` de `/v1/state`);
   * pedirlo sin carga no tiene efecto, lo decide el juego.
   */
  async combatManeuverBoost(amount) {
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0 || amount > 1) {
      throw new BridgeError("El empuje de maniobra debe estar entre 0 y 1", { kind: "parse" });
    }
    return this.#command({ op: "combat_maneuver_boost", amount });
  }

  /**
   * POST /v1/command — desplazamiento lateral de maniobra de combate, −1..1
   * (#519, Bearer). El signo es información: babor (negativo) o estribor.
   */
  async combatManeuverStrafe(amount) {
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < -1 || amount > 1) {
      throw new BridgeError("El desplazamiento lateral debe estar entre -1 y 1", { kind: "parse" });
    }
    return this.#command({ op: "combat_maneuver_strafe", amount });
  }

  /**
   * POST /v1/command — atraca con el objeto de este indicativo (#519, Bearer).
   * Mismo indicativo y misma resolución que `scanObject`. Que el objeto admita
   * atraque, esté en rango y lo permita su facción lo decide el juego.
   */
  async dock(callsign) {
    if (typeof callsign !== "string" || callsign === "") {
      throw new BridgeError("El indicativo del objetivo debe ser una cadena", { kind: "parse" });
    }
    return this.#command({ op: "dock", callsign });
  }

  /** POST /v1/command — suelta amarras de un atraque consumado (#519, Bearer). */
  async undock() {
    return this.#command({ op: "undock" });
  }

  /**
   * POST /v1/command — cancela un acercamiento de atraque en curso (#519,
   * Bearer). NO es sinónimo de `undock`: esto aborta el estado `docking`,
   * aquello suelta el estado `docked`. `/v1/state` publica cuál hay.
   */
  async abortDock() {
    return this.#command({ op: "abort_dock" });
  }

  // --- Autodestrucción y escudos (#518) --------------------------------------

  /**
   * POST /v1/command — arma la secuencia de autodestrucción (Bearer). Armarla
   * no destruye la nave: genera los códigos y arranca el ritual. Hacen falta
   * los tres confirmados, cada uno desde una silla distinta.
   */
  async activateSelfDestruct() {
    return this.#command({ op: "activate_self_destruct" });
  }

  /**
   * POST /v1/command — desarma la secuencia (Bearer). El motor solo deja
   * cancelar mientras la cuenta atrás no ha empezado; pasado ese punto no hay
   * marcha atrás, y eso es parte del peso de la decisión.
   */
  async cancelSelfDestruct() {
    return this.#command({ op: "cancel_self_destruct" });
  }

  /**
   * POST /v1/command — confirma uno de los tres códigos (Bearer).
   *
   * El código NO sale de aquí ni del puente: el componente del juego no lo
   * expone a Lua, así que quien lo teclea tiene que haberlo leído en la
   * pantalla nativa que se lo mostró, o habérselo oído a quien lo leyó. Es lo
   * que mantiene el puzle en pie en vez de convertirlo en un botón.
   */
  async confirmSelfDestructCode(index, code) {
    if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index > 2) {
      throw new BridgeError("El índice del código debe ser 0, 1 o 2", { kind: "parse" });
    }
    if (typeof code !== "number" || !Number.isInteger(code) || code < 0 || code > 4294967295) {
      throw new BridgeError("El código debe ser un entero sin signo", { kind: "parse" });
    }
    return this.#command({ op: "confirm_self_destruct_code", index, code });
  }

  /**
   * POST /v1/command — recalibra los escudos a una frecuencia 0..20 (Bearer).
   * Deja los escudos CAÍDOS mientras dura la calibración: elegir el momento es
   * la decisión, el número solo es la mitad.
   */
  async setShieldFrequency(frequency) {
    if (typeof frequency !== "number" || !Number.isInteger(frequency) || frequency < 0 || frequency > 20) {
      throw new BridgeError("La frecuencia de escudos debe ser un entero entre 0 y 20", { kind: "parse" });
    }
    return this.#command({ op: "set_shield_frequency", frequency });
  }

  // --- Relay (#517) ---------------------------------------------------------
  //
  // Las coordenadas que llegan aquí YA vienen resueltas por el relé del GM
  // (`station-order-wiring.mjs`) a partir del rumbo y la distancia que el
  // tripulante señaló: nadie teclea coordenadas del mundo, que no se pueden
  // conocer desde una consola de puesto.

  /** POST /v1/command — coloca un punto de ruta en el mapa de la nave (Bearer). */
  async addWaypoint(x, y) {
    if (!esCoordenada(x) || !esCoordenada(y)) {
      throw new BridgeError("Las coordenadas del punto de ruta no son válidas", { kind: "parse" });
    }
    return this.#command({ op: "add_waypoint", x, y });
  }

  /** POST /v1/command — mueve el punto de ruta `index` (Bearer). */
  async moveWaypoint(index, x, y) {
    if (!esIndiceWaypoint(index)) {
      throw new BridgeError("El índice del punto de ruta debe ser un entero 0..63", { kind: "parse" });
    }
    if (!esCoordenada(x) || !esCoordenada(y)) {
      throw new BridgeError("Las coordenadas del punto de ruta no son válidas", { kind: "parse" });
    }
    return this.#command({ op: "move_waypoint", index, x, y });
  }

  /** POST /v1/command — borra el punto de ruta `index` (Bearer). */
  async removeWaypoint(index) {
    if (!esIndiceWaypoint(index)) {
      throw new BridgeError("El índice del punto de ruta debe ser un entero 0..63", { kind: "parse" });
    }
    return this.#command({ op: "remove_waypoint", index });
  }

  /**
   * POST /v1/command — lanza una sonda hacia una coordenada (Bearer). Gasta
   * stock: `/v1/state` publica cuánto queda (`probes`), y el juego valida.
   */
  async launchProbe(x, y) {
    if (!esCoordenada(x) || !esCoordenada(y)) {
      throw new BridgeError("Las coordenadas de la sonda no son válidas", { kind: "parse" });
    }
    return this.#command({ op: "launch_probe", x, y });
  }

  /**
   * POST /v1/command — enlaza una sonda ya lanzada al radar de ciencia
   * (Bearer). Cooperación entre puestos incorporada al motor: Relay la lanza y
   * la enlaza, Sensores mira por ella.
   */
  async setScienceLink(callsign) {
    if (typeof callsign !== "string" || callsign === "") {
      throw new BridgeError("El indicativo de la sonda debe ser una cadena", { kind: "parse" });
    }
    return this.#command({ op: "set_science_link", callsign });
  }

  /** POST /v1/command — deshace el enlace sonda→ciencia (Bearer). */
  async clearScienceLink() {
    return this.#command({ op: "clear_science_link" });
  }

  /**
   * POST /v1/command — fija la condición de alerta de toda la nave (Bearer).
   * Catálogo cerrado `normal`/`yellow`/`red`, el mismo vocabulario que
   * `/v1/state` devuelve en `alert_level`.
   */
  async setAlertLevel(level) {
    if (!NIVELES_ALERTA.has(level)) {
      throw new BridgeError("La condición de alerta debe ser normal, yellow o red", { kind: "parse" });
    }
    return this.#command({ op: "set_alert_level", level });
  }

  /**
   * POST /v1/command — manda un equipo de reparación de una sala a otra (#522,
   * Bearer).
   *
   * El equipo se identifica por DÓNDE ESTÁ (`origin`), no por un índice: el
   * orden en que el motor devuelve las entidades no está garantizado. Si echó a
   * andar entre el sondeo y el clic, el puente responde `crew_not_found` en vez
   * de acertarle a otro.
   */
  async moveRepairCrew(origin, destination) {
    if (!esCasilla(origin) || !esCasilla(destination)) {
      throw new BridgeError("Las casillas de sala no son válidas", { kind: "parse" });
    }
    return this.#command({ op: "move_repair_crew", origin, destination });
  }

  /** POST /v1/command — contesta (true) o ignora (false) una llamada entrante (Bearer). */
  async answerCommHail(accept) {
    if (typeof accept !== "boolean") {
      throw new BridgeError("La respuesta al hail debe ser booleana", { kind: "parse" });
    }
    return this.#command({ op: "answer_comm_hail", accept });
  }

  /** POST /v1/command — cierra/cancela/reconoce el canal de comms activo (Bearer). */
  async closeComm() {
    return this.#command({ op: "close_comm" });
  }

  /**
   * POST /v1/command — elige una opción de diálogo scripteado por su índice,
   * 0..15 (Bearer). El índice corresponde al orden en que el escenario las
   * añadió con `addCommsReply()`; el puente no conoce la lista de opciones.
   */
  async sendCommReply(index) {
    if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index > 15) {
      throw new BridgeError("El índice de respuesta debe ser un entero entre 0 y 15", { kind: "parse" });
    }
    return this.#command({ op: "send_comm_reply", index });
  }

  /** POST /v1/command — mensaje de chat libre por el canal ya abierto, 1..256 caracteres (Bearer). */
  async sendCommMessage(message) {
    if (typeof message !== "string" || message.length === 0 || message.length > 256) {
      throw new BridgeError("El mensaje debe tener entre 1 y 256 caracteres", { kind: "parse" });
    }
    return this.#command({ op: "send_comm_message", message });
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
    // fetch resuelve al recibir las cabeceras: el cuerpo puede seguir llegando
    // indefinidamente. El mismo plazo debe cubrir también response.json() para
    // que diagnóstico, sondeo y órdenes no queden pendientes para siempre.
    let leyendoCuerpo = false;
    try {
      const response = await this.fetchImpl(`${this.url}${path}`, {
        method,
        headers,
        body,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new BridgeError(`El puente respondió ${response.status} en ${path}`, {
          kind: "http",
          status: response.status,
        });
      }
      leyendoCuerpo = true;
      return await response.json();
    } catch (err) {
      if (err instanceof BridgeError) throw err;
      if (controller.signal.aborted || err?.name === "AbortError") {
        throw new BridgeError(`Tiempo de espera agotado en ${path}`, { kind: "timeout" });
      }
      if (leyendoCuerpo) {
        throw new BridgeError(`Respuesta no válida del puente en ${path}`, { kind: "parse" });
      }
      throw new BridgeError(`No se pudo contactar con el puente en ${path}`, { kind: "network" });
    } finally {
      clearTimeout(timer);
    }
  }
}
