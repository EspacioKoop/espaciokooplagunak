/**
 * Espaciokoop Lagunak — módulo de Foundry VTT (esqueleto, issue #8).
 *
 * Muestra al director de juego el estado en vivo de la nave simulada,
 * consultando el puente de integración (contrato v0) por polling. Sin
 * órdenes de vuelta en esta iteración.
 *
 * Compatibilidad v11–v13 (issue #7: la mesa hostea con versiones mixtas —
 * v11.302 en un lado, más moderna en otro; en Foundry solo cuenta la
 * versión del ANFITRIÓN, los jugadores entran por navegador). La ventana
 * moderna `ApplicationV2` (v12+) se conserva EXACTAMENTE como estaba —
 * misma clase, mismas opciones, mismo ciclo de vida y misma salida — y es
 * la que se usa cuando el host la ofrece; para v11, donde
 * `foundry.applications.api` no existe, se usa una ventana `Application`
 * clásica equivalente y AISLADA (sin código compartido con la ruta v12+,
 * para no poder afectarla). La única diferencia frente al esqueleto
 * original es que la clase V2 se construye de forma perezosa (dentro de una
 * factoría), para que importar el módulo no rompa en v11 al desestructurar
 * una API ausente en el nivel superior.
 *
 * Seguridad: la URL y el token del puente son ajustes de ámbito "client"
 * (localStorage del navegador del GM) — nunca entran en la base de datos
 * del mundo ni se sincronizan con los jugadores, y no se escriben en logs.
 */

import { BridgeClient, BridgeError } from "./bridge-client.mjs";

const MODULE_ID = "espaciokoop-lagunak";
const POLL_MIN_S = 1;
const POLL_MAX_S = 30;
const BACKOFF_MAX_MS = 60000;

let estadoApp = null;

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "bridgeUrl", {
    name: "LAGUNAK.Ajustes.Url.Nombre",
    hint: "LAGUNAK.Ajustes.Url.Pista",
    scope: "client",
    config: true,
    type: String,
    default: "http://localhost:8090",
  });

  game.settings.register(MODULE_ID, "bridgeToken", {
    name: "LAGUNAK.Ajustes.Token.Nombre",
    hint: "LAGUNAK.Ajustes.Token.Pista",
    scope: "client",
    config: true,
    type: String,
    default: "",
  });

  game.settings.register(MODULE_ID, "pollSeconds", {
    name: "LAGUNAK.Ajustes.Intervalo.Nombre",
    hint: "LAGUNAK.Ajustes.Intervalo.Pista",
    scope: "client",
    config: true,
    type: Number,
    range: { min: POLL_MIN_S, max: POLL_MAX_S, step: 1 },
    default: 2,
  });
});

/* Botón en los controles de escena (grupo de fichas), solo GM.
 * Rama v11/v12 (array de grupos con `tools` array): IDÉNTICA al esqueleto
 * original. Rama v13 (record de grupos con `tools` record): añadida, pura-
 * mente aditiva — el `if (Array.isArray)` deja el camino v11/v12 intacto. */
Hooks.on("getSceneControlButtons", (controls) => {
  if (!game.user?.isGM) return;

  if (Array.isArray(controls)) {
    const tokenControls = controls.find?.((c) => c.name === "token");
    if (!tokenControls) return;
    tokenControls.tools.push({
      name: "lagunak-estado",
      title: "LAGUNAK.Controles.AbrirEstado",
      icon: "fa-solid fa-shuttle-space",
      button: true,
      onClick: () => abrirEstadoNave(),
    });
    return;
  }

  const grupo = controls?.tokens ?? controls?.token;
  if (grupo?.tools && !Array.isArray(grupo.tools)) {
    grupo.tools["lagunak-estado"] = {
      name: "lagunak-estado",
      title: "LAGUNAK.Controles.AbrirEstado",
      icon: "fa-solid fa-shuttle-space",
      button: true,
      onClick: () => abrirEstadoNave(),
      onChange: () => abrirEstadoNave(),
    };
  }
});

function abrirEstadoNave() {
  // Candado explícito, no solo el del botón: la vista agregada de la nave es
  // del GM. Mostrarla a un jugador rompería la asimetría de puestos que el
  // reparto de pantallas del juego fragmenta a propósito.
  if (!game.user?.isGM) return;
  estadoApp ??= new (claseEstadoNave())();
  estadoApp.render(true); // ApplicationV2 acepta el booleano `force` por compatibilidad
}

/**
 * Elige la ventana según lo que ofrezca el ANFITRIÓN: `ApplicationV2`
 * moderna (v12+) o la clásica `Application` (v11). Se construye al primer
 * uso, no al importar, para no tocar `foundry.applications.api` en v11.
 */
function claseEstadoNave() {
  return foundry.applications?.api?.ApplicationV2 ? crearClaseV2() : crearClaseV1();
}

/* ================================================================== */
/* Ventana moderna (ApplicationV2, v12+).                             */
/*                                                                    */
/* Cuerpo de clase IDÉNTICO al esqueleto original (PR #18). No se      */
/* comparte nada con la ruta v11: cualquier cambio de esta ventana     */
/* tendría que ser aquí, explícito. Lo único movido respecto al        */
/* original es la desestructuración de la API y la definición de la    */
/* clase, ahora perezosas dentro de esta factoría.                     */
/* ================================================================== */
function crearClaseV2() {
  const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

  return class EstadoNaveApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "lagunak-estado-nave",
      classes: ["lagunak-estado"],
      window: {
        title: "LAGUNAK.EstadoNave.Titulo",
        icon: "fa-solid fa-shuttle-space",
      },
      position: { width: 440, height: "auto" },
      actions: {
        anotar: EstadoNaveApp.onAnotar,
      },
    };

    static PARTS = {
      main: { template: `modules/${MODULE_ID}/templates/estado-nave.hbs` },
    };

    /** Estado interno del sondeo. */
    #timer = null;
    #fallosSeguidos = 0;
    ultimoEstado = null; // último /v1/state correcto
    conexion = "conectando"; // "ok" | "error" | "conectando"
    detalleError = "";

    #cliente() {
      return new BridgeClient({
        url: game.settings.get(MODULE_ID, "bridgeUrl"),
        token: game.settings.get(MODULE_ID, "bridgeToken"),
      });
    }

    #intervaloMs() {
      const base = game.settings.get(MODULE_ID, "pollSeconds") * 1000;
      if (this.#fallosSeguidos === 0) return base;
      // Backoff exponencial acotado en fallos consecutivos; se rearma al primer éxito.
      return Math.min(base * 2 ** this.#fallosSeguidos, BACKOFF_MAX_MS);
    }

    async #sondear() {
      try {
        const cliente = this.#cliente();
        await cliente.healthz();
        this.ultimoEstado = await cliente.state();
        this.conexion = "ok";
        this.detalleError = "";
        this.#fallosSeguidos = 0;
      } catch (err) {
        this.conexion = "error";
        this.detalleError = err instanceof BridgeError ? err.message : game.i18n.localize("LAGUNAK.Errores.Desconocido");
        this.#fallosSeguidos = Math.min(this.#fallosSeguidos + 1, 10);
      }
      if (this.rendered) this.render();
      this.#programar();
    }

    #programar() {
      clearTimeout(this.#timer);
      this.#timer = setTimeout(() => this.#sondear(), this.#intervaloMs());
    }

    _onFirstRender(context, options) {
      super._onFirstRender?.(context, options);
      this.#sondear();
    }

    _onClose(options) {
      clearTimeout(this.#timer);
      this.#timer = null;
      this.#fallosSeguidos = 0;
      this.conexion = "conectando";
      super._onClose?.(options);
    }

    async _prepareContext(_options) {
      const nave = this.ultimoEstado?.ship ?? null;
      return {
        conexion: this.conexion,
        conexionOk: this.conexion === "ok",
        conexionError: this.conexion === "error",
        conexionConectando: this.conexion === "conectando",
        detalleError: this.detalleError,
        nave,
        sistemas: nave
          ? Object.entries(nave.systems ?? {}).map(([nombre, s]) => ({
              nombre,
              salud: Math.round((s.health ?? 0) * 100),
              calor: Math.round((s.heat ?? 0) * 100),
              potencia: Math.round((s.power ?? 0) * 100),
            }))
          : [],
      };
    }

    /** Acción del botón «Anotar estado»: escribe el estado actual en el diario. */
    static async onAnotar() {
      if (!game.user?.isGM) return;
      const nave = this.ultimoEstado?.ship;
      if (!nave) {
        ui.notifications.warn(game.i18n.localize("LAGUNAK.Errores.SinEstado"));
        return;
      }

      const nombreDiario = game.i18n.localize("LAGUNAK.Diario.Nombre");
      const diario =
        game.journal.getName(nombreDiario) ??
        (await JournalEntry.create({ name: nombreDiario }));

      const esc = (s) =>
        String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
      const marca = new Date().toLocaleString();
      const contenido = `
      <p><strong>${esc(nave.callsign ?? "?")}</strong> — ${marca}</p>
      <ul>
        <li>Posición: ${Math.round(nave.position?.x ?? 0)}, ${Math.round(nave.position?.y ?? 0)}</li>
        <li>Rumbo: ${Math.round(nave.heading ?? 0)}°</li>
        <li>Casco: ${nave.hull} / ${nave.hull_max}</li>
        <li>Energía: ${nave.energy} / ${nave.energy_max}</li>
        <li>Escudos: ${nave.shields_active ? game.i18n.localize("LAGUNAK.EstadoNave.EscudosActivos") : game.i18n.localize("LAGUNAK.EstadoNave.EscudosInactivos")}</li>
      </ul>`;

      await diario.createEmbeddedDocuments("JournalEntryPage", [
        {
          type: "text",
          name: `${game.i18n.localize("LAGUNAK.Diario.PaginaPrefijo")} ${marca}`,
          text: { content: contenido },
        },
      ]);
      ui.notifications.info(game.i18n.localize("LAGUNAK.Diario.Anotado"));
    }
  };
}

/* ================================================================== */
/* Ventana clásica (Application v1): SOLO se usa en v11, donde no      */
/* existe ApplicationV2. Réplica de comportamiento equivalente, sin    */
/* compartir código con la ruta v12+: así no puede afectar a los hosts */
/* modernos. La única diferencia observable es el marco de ventana     */
/* clásico de v11 frente al de v12+.                                   */
/* ================================================================== */
function crearClaseV1() {
  return class EstadoNaveAppV1 extends Application {
    #timer = null;
    #fallosSeguidos = 0;
    #sondeando = false;
    ultimoEstado = null;
    conexion = "conectando";
    detalleError = "";

    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "lagunak-estado-nave",
        classes: ["lagunak-estado"],
        template: `modules/${MODULE_ID}/templates/estado-nave.hbs`,
        width: 440,
        height: "auto",
        resizable: true,
      });
    }

    get title() {
      return game.i18n.localize("LAGUNAK.EstadoNave.Titulo");
    }

    #cliente() {
      return new BridgeClient({
        url: game.settings.get(MODULE_ID, "bridgeUrl"),
        token: game.settings.get(MODULE_ID, "bridgeToken"),
      });
    }

    #intervaloMs() {
      const base = game.settings.get(MODULE_ID, "pollSeconds") * 1000;
      if (this.#fallosSeguidos === 0) return base;
      return Math.min(base * 2 ** this.#fallosSeguidos, BACKOFF_MAX_MS);
    }

    async #sondear() {
      try {
        const cliente = this.#cliente();
        await cliente.healthz();
        this.ultimoEstado = await cliente.state();
        this.conexion = "ok";
        this.detalleError = "";
        this.#fallosSeguidos = 0;
      } catch (err) {
        this.conexion = "error";
        this.detalleError = err instanceof BridgeError ? err.message : game.i18n.localize("LAGUNAK.Errores.Desconocido");
        this.#fallosSeguidos = Math.min(this.#fallosSeguidos + 1, 10);
      }
      if (this.rendered) this.render(false);
      clearTimeout(this.#timer);
      this.#timer = setTimeout(() => this.#sondear(), this.#intervaloMs());
    }

    async _render(force, options) {
      await super._render(force, options);
      if (!this.#sondeando) {
        this.#sondeando = true;
        this.#sondear();
      }
    }

    async close(options) {
      clearTimeout(this.#timer);
      this.#timer = null;
      this.#sondeando = false;
      this.#fallosSeguidos = 0;
      this.conexion = "conectando";
      return super.close(options);
    }

    activateListeners(html) {
      super.activateListeners(html);
      html.find('[data-action="anotar"]').on("click", () => this.#anotar());
    }

    getData(_options) {
      const nave = this.ultimoEstado?.ship ?? null;
      return {
        conexion: this.conexion,
        conexionOk: this.conexion === "ok",
        conexionError: this.conexion === "error",
        conexionConectando: this.conexion === "conectando",
        detalleError: this.detalleError,
        nave,
        sistemas: nave
          ? Object.entries(nave.systems ?? {}).map(([nombre, s]) => ({
              nombre,
              salud: Math.round((s.health ?? 0) * 100),
              calor: Math.round((s.heat ?? 0) * 100),
              potencia: Math.round((s.power ?? 0) * 100),
            }))
          : [],
      };
    }

    async #anotar() {
      if (!game.user?.isGM) return;
      const nave = this.ultimoEstado?.ship;
      if (!nave) {
        ui.notifications.warn(game.i18n.localize("LAGUNAK.Errores.SinEstado"));
        return;
      }

      const nombreDiario = game.i18n.localize("LAGUNAK.Diario.Nombre");
      const diario =
        game.journal.getName(nombreDiario) ??
        (await JournalEntry.create({ name: nombreDiario }));

      const esc = (s) =>
        String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
      const marca = new Date().toLocaleString();
      const contenido = `
      <p><strong>${esc(nave.callsign ?? "?")}</strong> — ${marca}</p>
      <ul>
        <li>Posición: ${Math.round(nave.position?.x ?? 0)}, ${Math.round(nave.position?.y ?? 0)}</li>
        <li>Rumbo: ${Math.round(nave.heading ?? 0)}°</li>
        <li>Casco: ${nave.hull} / ${nave.hull_max}</li>
        <li>Energía: ${nave.energy} / ${nave.energy_max}</li>
        <li>Escudos: ${nave.shields_active ? game.i18n.localize("LAGUNAK.EstadoNave.EscudosActivos") : game.i18n.localize("LAGUNAK.EstadoNave.EscudosInactivos")}</li>
      </ul>`;

      await diario.createEmbeddedDocuments("JournalEntryPage", [
        {
          type: "text",
          name: `${game.i18n.localize("LAGUNAK.Diario.PaginaPrefijo")} ${marca}`,
          text: { content: contenido },
        },
      ]);
      ui.notifications.info(game.i18n.localize("LAGUNAK.Diario.Anotado"));
    }
  };
}
