/**
 * Espaciokoop Lagunak — módulo de integración Foundry VTT (issue #8).
 *
 * Muestra al director de juego el estado en vivo de la nave simulada,
 * consultando el puente de integración (contrato v0) por polling. El GM
 * dispone además de órdenes cerradas y tipadas como pausa/reanudación.
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
 * El token Bearer es la autoridad del puente; `game.user.isGM` protege la UI,
 * pero el navegador no puede acreditar por sí solo un rol ante el servidor.
 */

import { BridgeClient, BridgeError } from "./bridge-client.mjs";
import { processBridgeEvents } from "./event-journal.mjs";
import { dibujarFrame } from "./mapa-render.mjs";
import { prepararVistaPausa } from "./pausa-control.mjs";
import { prepareRoute } from "./ship-view.mjs";
import { setSimulationPaused } from "./tempo-control.mjs";
import {
  colorFaccion,
  componerFrame,
  crearCampoEstrellas,
  debeDibujar,
  leyendaContactos,
  prepararDetalleContacto,
  rotarMuestras,
} from "./ventana-nave.mjs";

const MODULE_ID = "espaciokoop-lagunak";
const POLL_MIN_S = 1;
const POLL_MAX_S = 30;
const BACKOFF_MAX_MS = 60000;
// Mapa vivo: mismo radio que el Lua fijo de /v1/contacts en el puente, fps del
// pintor y semilla fija del campo de estrellas ("LAG" — mismo cielo siempre).
const MAPA_RADIO_MUNDO = 30000;
const MAPA_FPS = 30;
const MAPA_SEMILLA = 0x4c4147;

let estadoApp = null;
let mapaApp = null;

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

/* Grupo PROPIO en los controles de escena, con icono de nave, solo GM
 * (issue #125: las herramientas del módulo no se mezclan con Token Controls).
 * Rama v11/v12: array de grupos con `tools` array; rama v13: record de grupos
 * con `tools` record. En ambas, el grupo usa la capa "controls" (existe en
 * todas las versiones soportadas) porque sus herramientas son botones puros:
 * activar el grupo no debe tocar ninguna capa de fichas. */
Hooks.on("getSceneControlButtons", (controls) => {
  if (!game.user?.isGM) return;

  if (Array.isArray(controls)) {
    controls.push({
      name: "lagunak",
      title: "LAGUNAK.Controles.Grupo",
      icon: "fa-solid fa-shuttle-space",
      layer: "controls",
      visible: true,
      activeTool: "lagunak-estado",
      tools: [
        {
          name: "lagunak-estado",
          title: "LAGUNAK.Controles.AbrirEstado",
          icon: "fa-solid fa-gauge-high",
          button: true,
          onClick: () => abrirEstadoNave(),
        },
        {
          name: "lagunak-mapa",
          title: "LAGUNAK.Controles.AbrirMapa",
          icon: "fa-solid fa-satellite-dish",
          button: true,
          onClick: () => abrirMapaVivo(),
        },
      ],
    });
    return;
  }

  if (controls && typeof controls === "object") {
    controls.lagunak = {
      name: "lagunak",
      title: "LAGUNAK.Controles.Grupo",
      icon: "fa-solid fa-shuttle-space",
      layer: "controls",
      visible: true,
      activeTool: "lagunak-estado",
      order: Object.keys(controls).length,
      onChange: () => {},
      onToolChange: () => {},
      tools: {
        "lagunak-estado": {
          name: "lagunak-estado",
          title: "LAGUNAK.Controles.AbrirEstado",
          icon: "fa-solid fa-gauge-high",
          order: 0,
          button: true,
          onClick: () => abrirEstadoNave(),
          onChange: () => abrirEstadoNave(),
        },
        "lagunak-mapa": {
          name: "lagunak-mapa",
          title: "LAGUNAK.Controles.AbrirMapa",
          icon: "fa-solid fa-satellite-dish",
          order: 1,
          button: true,
          onClick: () => abrirMapaVivo(),
          onChange: () => abrirMapaVivo(),
        },
      },
    };
  }
});

/* La pausa de Foundry (game.paused) se muestra como dato informativo en la
 * ventana de estado; este hook solo refresca la vista abierta. NO se propaga
 * en ninguna dirección (decisión de #125, ver docs/FOUNDRY.md). */
Hooks.on("pauseGame", () => {
  if (estadoApp?.rendered) {
    estadoApp.render(foundry.applications?.api?.ApplicationV2 ? {} : false);
  }
});

function abrirEstadoNave() {
  // Candado explícito, no solo el del botón: la vista agregada de la nave es
  // del GM. Mostrarla a un jugador rompería la asimetría de puestos que el
  // reparto de pantallas del juego fragmenta a propósito.
  if (!game.user?.isGM) return;
  estadoApp ??= new (claseEstadoNave())();
  if (foundry.applications?.api?.ApplicationV2) {
    estadoApp.render({ force: true });
  } else {
    estadoApp.render(true);
  }
}

function abrirMapaVivo() {
  // Mismo candado que el estado de nave: el mapa agrega los contactos de los
  // sensores sin filtrar por puesto — es una vista de GM.
  if (!game.user?.isGM) return;
  mapaApp ??= new (claseMapaVivo())();
  if (foundry.applications?.api?.ApplicationV2) {
    mapaApp.render({ force: true });
  } else {
    mapaApp.render(true);
  }
}

/**
 * Elige la ventana según lo que ofrezca el ANFITRIÓN: `ApplicationV2`
 * moderna (v12+) o la clásica `Application` (v11). Se construye al primer
 * uso, no al importar, para no tocar `foundry.applications.api` en v11.
 */
function claseEstadoNave() {
  return foundry.applications?.api?.ApplicationV2 ? crearClaseV2() : crearClaseV1();
}

/** Misma regla de selección perezosa para la ventana del mapa vivo. */
function claseMapaVivo() {
  return foundry.applications?.api?.ApplicationV2 ? crearClaseMapaV2() : crearClaseMapaV1();
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
        pausar: EstadoNaveApp.onPausar,
        reanudar: EstadoNaveApp.onReanudar,
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
    pausaConfirmada = null; // último `paused` de /v1/scenario (null = sin lectura)
    ordenPendiente = null; // orden de pausa en vuelo (true/false) o null
    falloOrden = false; // la última orden de pausa terminó en error

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
        const escenario = await cliente.scenario();
        this.pausaConfirmada = typeof escenario?.paused === "boolean" ? escenario.paused : null;
        await processBridgeEvents({
          payload: await cliente.events(),
          game,
          JournalEntry,
          ui,
        });
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
      this.pausaConfirmada = null;
      this.ordenPendiente = null;
      this.falloOrden = false;
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
        esGM: Boolean(game.user?.isGM),
        nave,
        ruta: prepareRoute(nave, game.i18n),
        pausa: prepararVistaPausa({
          conexion: this.conexion,
          paused: this.pausaConfirmada,
          pendiente: this.ordenPendiente,
          falloOrden: this.falloOrden,
          foundryPausado: Boolean(game.paused),
          i18n: game.i18n,
        }),
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

    async _cambiarPausa(paused) {
      // Una orden cada vez: mientras una viaja, la UI deshabilita ambas.
      if (this.ordenPendiente !== null) return;
      this.ordenPendiente = paused;
      this.falloOrden = false;
      if (this.rendered) this.render();
      try {
        const changed = await setSimulationPaused({
          paused,
          isGM: Boolean(game.user?.isGM),
          client: this.#cliente(),
        });
        if (changed) {
          // Confirmación optimista hasta la siguiente lectura de /v1/scenario.
          this.pausaConfirmada = paused;
          const key = paused ? "LAGUNAK.Tempo.Pausado" : "LAGUNAK.Tempo.Reanudado";
          ui.notifications.info(game.i18n.localize(key));
        }
      } catch (err) {
        this.falloOrden = true;
        const message = err instanceof BridgeError
          ? err.message
          : game.i18n.localize("LAGUNAK.Errores.Desconocido");
        ui.notifications.error(message);
      } finally {
        this.ordenPendiente = null;
        if (this.rendered) this.render();
      }
    }

    static async onPausar() {
      return this._cambiarPausa(true);
    }

    static async onReanudar() {
      return this._cambiarPausa(false);
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
    pausaConfirmada = null;
    ordenPendiente = null;
    falloOrden = false;

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
        const escenario = await cliente.scenario();
        this.pausaConfirmada = typeof escenario?.paused === "boolean" ? escenario.paused : null;
        await processBridgeEvents({
          payload: await cliente.events(),
          game,
          JournalEntry,
          ui,
        });
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
      this.pausaConfirmada = null;
      this.ordenPendiente = null;
      this.falloOrden = false;
      return super.close(options);
    }

    activateListeners(html) {
      super.activateListeners(html);
      html.find('[data-action="anotar"]').on("click", () => this.#anotar());
      html.find('[data-action="pausar"]').on("click", () => this.#cambiarPausa(true));
      html.find('[data-action="reanudar"]').on("click", () => this.#cambiarPausa(false));
    }

    getData(_options) {
      const nave = this.ultimoEstado?.ship ?? null;
      return {
        conexion: this.conexion,
        conexionOk: this.conexion === "ok",
        conexionError: this.conexion === "error",
        conexionConectando: this.conexion === "conectando",
        detalleError: this.detalleError,
        esGM: Boolean(game.user?.isGM),
        nave,
        ruta: prepareRoute(nave, game.i18n),
        pausa: prepararVistaPausa({
          conexion: this.conexion,
          paused: this.pausaConfirmada,
          pendiente: this.ordenPendiente,
          falloOrden: this.falloOrden,
          foundryPausado: Boolean(game.paused),
          i18n: game.i18n,
        }),
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

    async #cambiarPausa(paused) {
      // Una orden cada vez: mientras una viaja, la UI deshabilita ambas.
      if (this.ordenPendiente !== null) return;
      this.ordenPendiente = paused;
      this.falloOrden = false;
      if (this.rendered) this.render(false);
      try {
        const changed = await setSimulationPaused({
          paused,
          isGM: Boolean(game.user?.isGM),
          client: this.#cliente(),
        });
        if (changed) {
          // Confirmación optimista hasta la siguiente lectura de /v1/scenario.
          this.pausaConfirmada = paused;
          const key = paused ? "LAGUNAK.Tempo.Pausado" : "LAGUNAK.Tempo.Reanudado";
          ui.notifications.info(game.i18n.localize(key));
        }
      } catch (err) {
        this.falloOrden = true;
        const message = err instanceof BridgeError
          ? err.message
          : game.i18n.localize("LAGUNAK.Errores.Desconocido");
        ui.notifications.error(message);
      } finally {
        this.ordenPendiente = null;
        if (this.rendered) this.render(false);
      }
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

/* ================================================================== */
/* Mapa vivo (ApplicationV2, v12+). Ventana solo-vista: starfield en   */
/* parallax + blips de contactos de /v1/contacts, con el movimiento    */
/* propio tweeneado entre las dos últimas muestras confirmadas del     */
/* puente (nunca extrapola: el mapa es una vista, no un simulador).    */
/* Sondeo de datos cada pollSeconds con backoff; dibujo por rAF a      */
/* MAPA_FPS. NO llama a processBridgeEvents: el diario es asunto de la */
/* ventana de estado (evita anotaciones duplicadas). Misma disciplina  */
/* de aislamiento V2/V1 que el estado de nave.                         */
/* ================================================================== */
function crearClaseMapaV2() {
  const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

  return class MapaVivoApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "lagunak-mapa-vivo",
      classes: ["lagunak-mapa"],
      window: {
        title: "LAGUNAK.MapaVivo.Titulo",
        icon: "fa-solid fa-satellite-dish",
      },
      position: { width: 480, height: "auto" },
    };

    static PARTS = {
      main: { template: `modules/${MODULE_ID}/templates/mapa-vivo.hbs` },
    };

    /** Estado interno: sondeo + animación. */
    #timer = null;
    #fallosSeguidos = 0;
    #generacion = 0;
    #rafId = null;
    #ultimoDibujoMs = null;
    #campo = crearCampoEstrellas(MAPA_SEMILLA);
    #muestraPrev = null;
    #muestraActual = null;
    contactos = [];
    seleccion = null; // callsign del contacto seleccionado en la lista
    conexion = "conectando";
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
      return Math.min(base * 2 ** this.#fallosSeguidos, BACKOFF_MAX_MS);
    }

    async #sondear() {
      // La generación se captura al entrar: si la ventana se cierra (o se
      // reabre) con esta petición en vuelo, la respuesta tardía no puede
      // tocar estado, renderizar ni rearmar el polling.
      const generacion = this.#generacion;
      let rotadas = null;
      let contactos = null;
      let fallo = null;
      try {
        const cliente = this.#cliente();
        await cliente.healthz();
        const estado = await cliente.state();
        const nave = estado?.ship ?? null;
        if (nave) {
          // Ventana de reproducción: rotarMuestras ancla el tween hacia
          // delante (los frames van DETRÁS de la recepción — sin esto, t
          // quedaría clavado en 1 y no habría frames intermedios).
          rotadas = rotarMuestras(this.#muestraActual, {
            centro: { x: nave.position?.x ?? 0, y: nave.position?.y ?? 0 },
            rumboDeg: nave.heading ?? 0,
          }, Date.now());
        }
        contactos = (await cliente.contacts())?.contacts ?? [];
      } catch (err) {
        fallo = err;
      }
      if (generacion !== this.#generacion) return;
      if (fallo === null) {
        if (rotadas) {
          this.#muestraPrev = rotadas.prev;
          this.#muestraActual = rotadas.actual;
        }
        this.contactos = contactos;
        this.conexion = "ok";
        this.detalleError = "";
        this.#fallosSeguidos = 0;
      } else {
        this.conexion = "error";
        this.detalleError = fallo instanceof BridgeError ? fallo.message : game.i18n.localize("LAGUNAK.Errores.Desconocido");
        this.#fallosSeguidos = Math.min(this.#fallosSeguidos + 1, 10);
      }
      if (this.rendered) this.render();
      this.#programar();
    }

    #programar() {
      clearTimeout(this.#timer);
      this.#timer = setTimeout(() => this.#sondear(), this.#intervaloMs());
    }

    #animar() {
      // Sin rAF global (p. ej. arnés de pruebas) la animación se auto-inhibe;
      // el mapa sigue funcionando a golpe de re-render del sondeo.
      if (!this.rendered || typeof requestAnimationFrame !== "function") {
        this.#rafId = null;
        return;
      }
      this.#rafId = requestAnimationFrame(() => this.#animar());
      const ahora = Date.now();
      if (!debeDibujar(this.#ultimoDibujoMs, ahora, MAPA_FPS)) return;
      // El re-render del sondeo reemplaza el DOM del part (canvas incluido):
      // el lienzo se busca en cada tick, nunca se cachea.
      const canvas = this.element?.querySelector?.(".lagunak-mapa-canvas");
      const ctx = canvas?.getContext?.("2d");
      if (!ctx) return;
      this.#ultimoDibujoMs = ahora;
      const frame = componerFrame({
        muestraPrev: this.#muestraPrev,
        muestraActual: this.#muestraActual,
        contactos: this.contactos,
        campo: this.#campo,
        tMs: ahora,
        ancho: canvas.width,
        alto: canvas.height,
        radioMundo: MAPA_RADIO_MUNDO,
      });
      dibujarFrame(ctx, frame, { ancho: canvas.width, alto: canvas.height });
    }

    _onFirstRender(context, options) {
      super._onFirstRender?.(context, options);
      this.#sondear();
      this.#animar();
    }

    /* Selección de contacto (issue #126): la lista re-renderiza en cada
     * sondeo, así que los listeners se re-atan tras cada render. Clic en el
     * contacto ya seleccionado lo deselecciona. */
    _onRender(context, options) {
      super._onRender?.(context, options);
      this.element?.querySelectorAll?.("[data-contacto]")?.forEach((el) => {
        el.addEventListener("click", () => {
          const callsign = el.dataset.contacto ?? null;
          this.seleccion = callsign === this.seleccion ? null : callsign;
          this.render();
        });
      });
    }

    _onClose(options) {
      // Invalida cualquier #sondear en vuelo: su respuesta tardía morirá en
      // la comparación de generación sin rearmar el polling.
      this.#generacion += 1;
      clearTimeout(this.#timer);
      this.#timer = null;
      if (this.#rafId != null && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(this.#rafId);
      }
      this.#rafId = null;
      this.#ultimoDibujoMs = null;
      this.#fallosSeguidos = 0;
      this.conexion = "conectando";
      super._onClose?.(options);
    }

    async _prepareContext(_options) {
      const centro = this.#muestraActual?.centro ?? null;
      const desconocido = game.i18n.localize("LAGUNAK.MapaVivo.Desconocido");
      const propia = game.i18n.localize("LAGUNAK.MapaVivo.LeyendaPropia");
      const contactoSeleccionado =
        this.contactos.find((c) => (c.callsign ?? "?") === this.seleccion) ?? null;
      let detalle = null;
      if (contactoSeleccionado) {
        const d = prepararDetalleContacto(contactoSeleccionado, centro);
        detalle = {
          callsign: d.callsign,
          color: d.color,
          tipo: d.tipo ?? desconocido,
          faccion: d.esJugador ? propia : d.faccion ?? desconocido,
          distanciaLabel: game.i18n.format("LAGUNAK.EstadoNave.DistanciaUnidades", {
            distance: Math.round(d.distancia),
          }),
          rumboLabel: game.i18n.format("LAGUNAK.MapaVivo.RumboGrados", {
            rumbo: Math.round(d.rumboDeg),
          }),
        };
      }
      return {
        conexion: this.conexion,
        conexionOk: this.conexion === "ok",
        conexionError: this.conexion === "error",
        conexionConectando: this.conexion === "conectando",
        detalleError: this.detalleError,
        esGM: Boolean(game.user?.isGM),
        sinDatos: !this.#muestraActual,
        alcanceLabel: game.i18n.format("LAGUNAK.MapaVivo.Alcance", { radio: MAPA_RADIO_MUNDO }),
        detalle,
        leyenda: leyendaContactos(this.contactos).map((e) => ({
          color: e.color,
          etiqueta: e.esJugador
            ? propia
            : e.faccion ?? game.i18n.localize("LAGUNAK.MapaVivo.LeyendaNeutro"),
        })),
        contactos: this.contactos.map((c) => {
          const dx = (c.position?.x ?? 0) - (centro?.x ?? 0);
          const dy = (c.position?.y ?? 0) - (centro?.y ?? 0);
          const distancia = Math.hypot(dx, dy);
          return {
            callsign: c.callsign ?? "?",
            color: colorFaccion(c.faction ?? null, Boolean(c.is_player)),
            esJugador: Boolean(c.is_player),
            seleccionado: (c.callsign ?? "?") === this.seleccion,
            distanciaLabel: game.i18n.format("LAGUNAK.EstadoNave.DistanciaUnidades", {
              distance: Math.round(distancia),
            }),
            fuera: distancia > MAPA_RADIO_MUNDO,
          };
        }),
      };
    }
  };
}

/* ================================================================== */
/* Mapa vivo clásico (Application v1, solo v11): réplica equivalente y */
/* AISLADA de la ventana anterior, sin código compartido — mismo       */
/* criterio que EstadoNaveAppV1. `this.element` es jQuery en v1: el    */
/* canvas se busca vía `this.element?.[0]`.                            */
/* ================================================================== */
function crearClaseMapaV1() {
  return class MapaVivoAppV1 extends Application {
    #timer = null;
    #fallosSeguidos = 0;
    #sondeando = false;
    #generacion = 0;
    #rafId = null;
    #ultimoDibujoMs = null;
    #campo = crearCampoEstrellas(MAPA_SEMILLA);
    #muestraPrev = null;
    #muestraActual = null;
    contactos = [];
    seleccion = null; // callsign del contacto seleccionado en la lista
    conexion = "conectando";
    detalleError = "";

    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "lagunak-mapa-vivo",
        classes: ["lagunak-mapa"],
        template: `modules/${MODULE_ID}/templates/mapa-vivo.hbs`,
        width: 480,
        height: "auto",
        resizable: true,
      });
    }

    get title() {
      return game.i18n.localize("LAGUNAK.MapaVivo.Titulo");
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
      // Misma disciplina que la ruta V2 (réplica aislada): la generación se
      // captura al entrar y una respuesta tardía tras cerrar muere sin tocar
      // estado, renderizar ni rearmar el polling.
      const generacion = this.#generacion;
      let rotadas = null;
      let contactos = null;
      let fallo = null;
      try {
        const cliente = this.#cliente();
        await cliente.healthz();
        const estado = await cliente.state();
        const nave = estado?.ship ?? null;
        if (nave) {
          // Ventana de reproducción (ver rotarMuestras): el tween se ancla
          // hacia delante para que existan frames intermedios reales.
          rotadas = rotarMuestras(this.#muestraActual, {
            centro: { x: nave.position?.x ?? 0, y: nave.position?.y ?? 0 },
            rumboDeg: nave.heading ?? 0,
          }, Date.now());
        }
        contactos = (await cliente.contacts())?.contacts ?? [];
      } catch (err) {
        fallo = err;
      }
      if (generacion !== this.#generacion) return;
      if (fallo === null) {
        if (rotadas) {
          this.#muestraPrev = rotadas.prev;
          this.#muestraActual = rotadas.actual;
        }
        this.contactos = contactos;
        this.conexion = "ok";
        this.detalleError = "";
        this.#fallosSeguidos = 0;
      } else {
        this.conexion = "error";
        this.detalleError = fallo instanceof BridgeError ? fallo.message : game.i18n.localize("LAGUNAK.Errores.Desconocido");
        this.#fallosSeguidos = Math.min(this.#fallosSeguidos + 1, 10);
      }
      if (this.rendered) this.render(false);
      clearTimeout(this.#timer);
      this.#timer = setTimeout(() => this.#sondear(), this.#intervaloMs());
    }

    #animar() {
      if (!this.rendered || typeof requestAnimationFrame !== "function") {
        this.#rafId = null;
        return;
      }
      this.#rafId = requestAnimationFrame(() => this.#animar());
      const ahora = Date.now();
      if (!debeDibujar(this.#ultimoDibujoMs, ahora, MAPA_FPS)) return;
      const canvas = this.element?.[0]?.querySelector?.(".lagunak-mapa-canvas");
      const ctx = canvas?.getContext?.("2d");
      if (!ctx) return;
      this.#ultimoDibujoMs = ahora;
      const frame = componerFrame({
        muestraPrev: this.#muestraPrev,
        muestraActual: this.#muestraActual,
        contactos: this.contactos,
        campo: this.#campo,
        tMs: ahora,
        ancho: canvas.width,
        alto: canvas.height,
        radioMundo: MAPA_RADIO_MUNDO,
      });
      dibujarFrame(ctx, frame, { ancho: canvas.width, alto: canvas.height });
    }

    /* Selección de contacto (issue #126), réplica aislada de la ruta V2:
     * clic selecciona, clic en el seleccionado deselecciona. */
    activateListeners(html) {
      super.activateListeners(html);
      html.find("[data-contacto]").on("click", (ev) => {
        const callsign = ev.currentTarget?.dataset?.contacto ?? null;
        this.seleccion = callsign === this.seleccion ? null : callsign;
        this.render(false);
      });
    }

    async _render(force, options) {
      await super._render(force, options);
      if (!this.#sondeando) {
        this.#sondeando = true;
        this.#sondear();
        this.#animar();
      }
    }

    async close(options) {
      // Invalida cualquier #sondear en vuelo (ver comentario en #sondear).
      this.#generacion += 1;
      clearTimeout(this.#timer);
      this.#timer = null;
      this.#sondeando = false;
      if (this.#rafId != null && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(this.#rafId);
      }
      this.#rafId = null;
      this.#ultimoDibujoMs = null;
      this.#fallosSeguidos = 0;
      this.conexion = "conectando";
      return super.close(options);
    }

    getData(_options) {
      const centro = this.#muestraActual?.centro ?? null;
      const desconocido = game.i18n.localize("LAGUNAK.MapaVivo.Desconocido");
      const propia = game.i18n.localize("LAGUNAK.MapaVivo.LeyendaPropia");
      const contactoSeleccionado =
        this.contactos.find((c) => (c.callsign ?? "?") === this.seleccion) ?? null;
      let detalle = null;
      if (contactoSeleccionado) {
        const d = prepararDetalleContacto(contactoSeleccionado, centro);
        detalle = {
          callsign: d.callsign,
          color: d.color,
          tipo: d.tipo ?? desconocido,
          faccion: d.esJugador ? propia : d.faccion ?? desconocido,
          distanciaLabel: game.i18n.format("LAGUNAK.EstadoNave.DistanciaUnidades", {
            distance: Math.round(d.distancia),
          }),
          rumboLabel: game.i18n.format("LAGUNAK.MapaVivo.RumboGrados", {
            rumbo: Math.round(d.rumboDeg),
          }),
        };
      }
      return {
        conexion: this.conexion,
        conexionOk: this.conexion === "ok",
        conexionError: this.conexion === "error",
        conexionConectando: this.conexion === "conectando",
        detalleError: this.detalleError,
        esGM: Boolean(game.user?.isGM),
        sinDatos: !this.#muestraActual,
        alcanceLabel: game.i18n.format("LAGUNAK.MapaVivo.Alcance", { radio: MAPA_RADIO_MUNDO }),
        detalle,
        leyenda: leyendaContactos(this.contactos).map((e) => ({
          color: e.color,
          etiqueta: e.esJugador
            ? propia
            : e.faccion ?? game.i18n.localize("LAGUNAK.MapaVivo.LeyendaNeutro"),
        })),
        contactos: this.contactos.map((c) => {
          const dx = (c.position?.x ?? 0) - (centro?.x ?? 0);
          const dy = (c.position?.y ?? 0) - (centro?.y ?? 0);
          const distancia = Math.hypot(dx, dy);
          return {
            callsign: c.callsign ?? "?",
            color: colorFaccion(c.faction ?? null, Boolean(c.is_player)),
            esJugador: Boolean(c.is_player),
            seleccionado: (c.callsign ?? "?") === this.seleccion,
            distanciaLabel: game.i18n.format("LAGUNAK.EstadoNave.DistanciaUnidades", {
              distance: Math.round(distancia),
            }),
            fuera: distancia > MAPA_RADIO_MUNDO,
          };
        }),
      };
    }
  };
}
