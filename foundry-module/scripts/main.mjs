/**
 * Espaciokoop Lagunak — módulo de Foundry VTT (esqueleto, issue #8).
 *
 * Muestra al director de juego el estado en vivo de la nave simulada,
 * consultando el puente de integración (contrato v0) por polling. Sin
 * órdenes de vuelta en esta iteración.
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

/* Botón en los controles de escena (grupo de fichas), solo GM. */
Hooks.on("getSceneControlButtons", (controls) => {
  if (!game.user?.isGM) return;
  const tokenControls = controls.find?.((c) => c.name === "token");
  if (!tokenControls) return;
  tokenControls.tools.push({
    name: "lagunak-estado",
    title: "LAGUNAK.Controles.AbrirEstado",
    icon: "fa-solid fa-shuttle-space",
    button: true,
    onClick: () => abrirEstadoNave(),
  });
});

function abrirEstadoNave() {
  // Candado explícito, no solo el del botón: la vista agregada de la nave es
  // del GM. Mostrarla a un jugador rompería la asimetría de puestos que el
  // reparto de pantallas del juego fragmenta a propósito.
  if (!game.user?.isGM) return;
  estadoApp ??= new EstadoNaveApp();
  estadoApp.render({ force: true });
}

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class EstadoNaveApp extends HandlebarsApplicationMixin(ApplicationV2) {
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
}
