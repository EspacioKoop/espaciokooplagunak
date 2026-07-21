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
 * Seguridad: la URL es un ajuste de ámbito "client"; el token del puente vive
 * solo en memoria durante la sesión del navegador GM. Nunca entra en la base
 * de datos del mundo, localStorage, sockets, Journal o logs.
 * El token Bearer es la autoridad del puente; `game.user.isGM` protege la UI,
 * pero el navegador no puede acreditar por sí solo un rol ante el servidor.
 */

import { BridgeClient, BridgeError } from "./bridge-client.mjs";
import {
  clearLegacyBridgeToken,
  getBridgeToken,
  openBridgeTokenApp,
  registerBridgeTokenFeature,
  revokeBridgeTokenAccess,
} from "./bridge-token-session.mjs";
import { probarConexion } from "./diagnostico-conexion.mjs";
import { processBridgeEvents } from "./event-journal.mjs";
import { anotarAlertas, derivarAlertas } from "./alertas-nave.mjs";
import { dibujarFrame } from "./mapa-render.mjs";
import { prepararVistaPausa } from "./pausa-control.mjs";
import {
  ajustarPotencia,
  claveResultadoIngenieria,
  prepararVistaIngenieria,
} from "./ingenieria-control.mjs";
import {
  claveResultadoManiobra,
  ordenarManiobra,
  prepararVistaManiobra,
} from "./maniobra-control.mjs";
import { firmaEstadoNaveVisible, prepareRoute, prepareSystemRows } from "./ship-view.mjs";
import { setSimulationPaused } from "./tempo-control.mjs";
import { addStationControl, registerStationFeature } from "./station-ui.mjs";
import {
  addWorkspaceControl,
  registerWorkspaceFeature,
  revokeWorkspaceAccess,
} from "./station-workspace-ui.mjs";
import { registerStationOrders } from "./station-order-wiring.mjs";
import {
  colorFaccion,
  componerFrame,
  contactoEnPunto,
  crearCampoEstrellas,
  debeDibujar,
  firmaEstructuralContactos,
  leyendaContactos,
  normalizarContactosMapa,
  normalizarPosicionMapa,
  prepararDetalleContacto,
  rotarMuestras,
} from "./ventana-nave.mjs";
import { crearDecorado, componerDecorado } from "./decorado-fondo.mjs";

const MODULE_ID = "espaciokoop-lagunak";
const POLL_MIN_S = 1;
const POLL_MAX_S = 30;
const BACKOFF_MAX_MS = 60000;
// Mapa vivo: mismo radio que el Lua fijo de /v1/contacts en el puente, fps del
// pintor y semilla fija del campo de estrellas y del decorado de fondo
// ("LAG" — mismo cielo y mismo decorado siempre).
const MAPA_RADIO_MUNDO = 30000;
const MAPA_FPS = 60;
const MAPA_SEMILLA = 0x4c4147;
// Nonce de alertas por sesión del navegador (como el id de llegada del
// escenario): mantiene únicos los eventId de alerta entre sesiones y deja que un
// umbral se anote una sola vez por sesión aunque oscile.
const ALERTAS_NONCE = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");

registerStationFeature(MODULE_ID);
registerWorkspaceFeature(MODULE_ID);
registerBridgeTokenFeature(MODULE_ID);

let estadoApp = null;
let mapaApp = null;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

function fechaLocal() {
  const idioma = game.i18n.lang === "es" ? "es-ES" : game.i18n.lang;
  return new Date().toLocaleString(idioma);
}

function numeroBitacora(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : 0;
}

function contenidoEstadoBitacora(nave, marca) {
  const texto = (key) => escapeHtml(game.i18n.localize(key));
  return `
      <p><strong>${escapeHtml(nave.callsign ?? "?")}</strong> — ${escapeHtml(marca)}</p>
      <ul>
        <li>${texto("LAGUNAK.Diario.Campo.Posicion")}: ${numeroBitacora(nave.position?.x)}, ${numeroBitacora(nave.position?.y)}</li>
        <li>${texto("LAGUNAK.Diario.Campo.Rumbo")}: ${numeroBitacora(nave.heading)}°</li>
        <li>${texto("LAGUNAK.Diario.Campo.Casco")}: ${numeroBitacora(nave.hull)} / ${numeroBitacora(nave.hull_max)}</li>
        <li>${texto("LAGUNAK.Diario.Campo.Energia")}: ${numeroBitacora(nave.energy)} / ${numeroBitacora(nave.energy_max)}</li>
        <li>${texto("LAGUNAK.Diario.Campo.Escudos")}: ${texto(nave.shields_active ? "LAGUNAK.EstadoNave.EscudosActivos" : "LAGUNAK.EstadoNave.EscudosInactivos")}</li>
      </ul>`;
}

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
    config: false,
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

Hooks.once("ready", () => {
  // Migración de #183: no se lee el valor legado; se sobrescribe con vacío.
  // El token operativo vive exclusivamente en bridge-token-session.mjs.
  void clearLegacyBridgeToken();
  // Relé de órdenes por puesto (#236): el GM registra el manejador del socket;
  // en clientes de tripulación es no-op (solo emiten).
  registerStationOrders(MODULE_ID);
});

Hooks.on("updateUser", (user) => {
  if (user?.id === game.user?.id) {
    // Un cambio de rol del propio usuario rearma el relé: el GM entrante gana
    // el manejador, el saliente lo pierde (registerStationOrders comprueba isGM).
    registerStationOrders(MODULE_ID);
    if (!user.isGM) void revokePrivilegedBridgeAccess();
  }
});

function wipePrivilegedWindow(app) {
  const root = app?.element?.[0] ?? app?.element;
  root?.replaceChildren?.();
}

async function revokePrivilegedApp(app) {
  if (!app) return;
  app.bridgeAccessRevoked = true;
  app.ultimoEstado = null;
  app.contactos = [];
  app.destino = null;
  wipePrivilegedWindow(app);
  try {
    await app.close();
  } catch {
    // La frontera ya está revocada y el DOM vacío aunque Foundry no cierre.
  }
}

async function revokePrivilegedBridgeAccess() {
  await Promise.allSettled([
    revokeBridgeTokenAccess(),
    revokeWorkspaceAccess(),
    revokePrivilegedApp(estadoApp),
    revokePrivilegedApp(mapaApp),
  ]);
}

/* Grupo PROPIO en los controles de escena, con icono de nave, solo GM
 * (issue #125: las herramientas del módulo no se mezclan con Token Controls).
 * Rama v11/v12: array de grupos con `tools` array; rama v13: record de grupos
 * con `tools` record. En ambas, el grupo usa la capa "controls" (existe en
 * todas las versiones soportadas) porque sus herramientas son botones puros:
 * activar el grupo no debe tocar ninguna capa de fichas. */
Hooks.on("getSceneControlButtons", (controls) => {
  const isGM = Boolean(game.user?.isGM);

  // Herramientas solo-GM del grupo (estado, mapa, token, diagnóstico). Los
  // botones de puesto (asignación y consola) los añaden addStationControl y
  // addWorkspaceControl para TODOS los usuarios, más abajo.
  const gmTools = isGM
    ? [
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
        {
          name: "lagunak-token",
          title: "LAGUNAK.Controles.ConfigurarToken",
          icon: "fa-solid fa-key",
          button: true,
          onClick: () => openBridgeTokenApp(),
        },
        {
          name: "lagunak-diagnostico",
          title: "LAGUNAK.Controles.ProbarConexion",
          icon: "fa-solid fa-stethoscope",
          button: true,
          onClick: () => diagnosticarConexion(),
        },
      ]
    : [];

  // El grupo propio es visible para TODOS: los jugadores ven sus botones de
  // puesto aquí, no en Token Controls (issue #125). Solo el GM ve además
  // estado/mapa/token/diagnóstico. activeTool apunta a una herramienta que
  // exista para el rol actual.
  const activeTool = isGM ? "lagunak-estado" : "lagunak-puestos";

  if (Array.isArray(controls)) {
    controls.push({
      name: "lagunak",
      title: "LAGUNAK.Controles.Grupo",
      icon: "fa-solid fa-shuttle-space",
      layer: "controls",
      visible: true,
      activeTool,
      tools: gmTools,
    });
  } else if (controls && typeof controls === "object") {
    const tools = {};
    gmTools.forEach((tool, order) => {
      tools[tool.name] = { ...tool, order, onChange: tool.onClick };
    });
    controls.lagunak = {
      name: "lagunak",
      title: "LAGUNAK.Controles.Grupo",
      icon: "fa-solid fa-shuttle-space",
      layer: "controls",
      visible: true,
      activeTool,
      order: Object.keys(controls).length,
      onChange: () => {},
      onToolChange: () => {},
      tools,
    };
  }

  // Botones de puesto para TODOS los usuarios, dentro del grupo propio.
  addStationControl(controls);
  addWorkspaceControl(controls);
});

/* Diagnóstico de conexión (issue #183): comprueba /healthz y después
 * /v1/state con el token configurado, y comunica el resultado con una
 * notificación en el lenguaje del GM. Nunca muestra el token. */
let diagnosticoEnCurso = false;
async function diagnosticarConexion() {
  if (!game.user?.isGM || diagnosticoEnCurso) return;
  diagnosticoEnCurso = true;
  try {
    const token = getBridgeToken();
    const res = await probarConexion({
      url: game.settings.get(MODULE_ID, "bridgeUrl"),
      token,
      canUseToken: () => Boolean(game.user?.isGM) && getBridgeToken() === token,
    });
    if (!game.user?.isGM) return;
    const mensaje = game.i18n.localize(res.claveI18n);
    if (res.exito) ui.notifications.info(mensaje);
    else ui.notifications.warn(mensaje);
  } finally {
    diagnosticoEnCurso = false;
  }
}

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
  if (!estadoApp || estadoApp.bridgeAccessRevoked) estadoApp = new (claseEstadoNave())();
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
  if (!mapaApp || mapaApp.bridgeAccessRevoked) mapaApp = new (claseMapaVivo())();
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
        ajustarIngenieria: EstadoNaveApp.onAjustarIngenieria,
        ordenarImpulso: EstadoNaveApp.onOrdenarImpulso,
        ordenarWarp: EstadoNaveApp.onOrdenarWarp,
        ordenarRumbo: EstadoNaveApp.onOrdenarRumbo,
        ordenarEscudos: EstadoNaveApp.onOrdenarEscudos,
      },
    };

    static PARTS = {
      main: { template: `modules/${MODULE_ID}/templates/estado-nave.hbs` },
    };

    /** Estado interno del sondeo. */
    #timer = null;
    #fallosSeguidos = 0;
    // Última firma no-telemétrica renderizada (issue #227 punto 6): evita que
    // el sondeo reconstruya el panel —y sus regiones role="status"— cuando
    // solo cambió telemetría continua.
    #firmaVisibleAnterior = null;
    ultimoEstado = null; // último /v1/state correcto
    conexion = "conectando"; // "ok" | "error" | "conectando"
    detalleError = "";
    pausaConfirmada = null; // último `paused` de /v1/scenario (null = sin lectura)
    ordenPendiente = null; // orden de pausa en vuelo (true/false) o null
    confirmacionPendiente = null; // ACK recibido, a la espera de observarlo en /v1/scenario
    falloOrden = false; // la última orden de pausa terminó en error
    ayudaAbierta = false; // conserva <details open> entre reemplazos del DOM
    // Panel de ingeniería del GM: selección y orden en vuelo. La selección se
    // conserva entre reemplazos del DOM del sondeo (como <details open>).
    ingenieriaSistema = null;
    ingenieriaNivel = 1;
    ingenieriaPendiente = false;
    ingenieriaFallo = false;
    // Órdenes directas del GM (#176): una orden cada vez y último fallo.
    maniobraPendiente = false;
    maniobraFallo = false;
    bridgeAccessRevoked = false;

    #cliente() {
      return new BridgeClient({
        url: game.settings.get(MODULE_ID, "bridgeUrl"),
        token: getBridgeToken(),
      });
    }

    #intervaloMs() {
      const base = game.settings.get(MODULE_ID, "pollSeconds") * 1000;
      if (this.#fallosSeguidos === 0) return base;
      // Backoff exponencial acotado en fallos consecutivos; se rearma al primer éxito.
      return Math.min(base * 2 ** this.#fallosSeguidos, BACKOFF_MAX_MS);
    }

    async #sondear() {
      if (this.bridgeAccessRevoked || !game.user?.isGM) return;
      try {
        const cliente = this.#cliente();
        await cliente.healthz();
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        const estado = await cliente.state();
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        const escenario = await cliente.scenario();
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        const eventos = await cliente.events();
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        const navePrevAlertas = this.ultimoEstado?.ship ?? null;
        this.ultimoEstado = estado;
        this._registrarLecturaPausa(escenario);
        await processBridgeEvents({
          payload: eventos,
          game,
          JournalEntry,
          ui,
        });
        await anotarAlertas({
          alertas: derivarAlertas(navePrevAlertas, estado?.ship ?? null),
          nonce: ALERTAS_NONCE,
          game,
          JournalEntry,
          ui,
          sigueVigente: () => !this.bridgeAccessRevoked && Boolean(game.user?.isGM),
        });
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        this.conexion = "ok";
        this.detalleError = "";
        this.#fallosSeguidos = 0;
      } catch (err) {
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        this.conexion = "error";
        this.detalleError = err instanceof BridgeError ? err.message : game.i18n.localize("LAGUNAK.Errores.Desconocido");
        this.#fallosSeguidos = Math.min(this.#fallosSeguidos + 1, 10);
        // Salida segura: si el sondeo falla con una confirmación pendiente,
        // no se deja la UI esperando para siempre un estado inobservable.
        if (this.confirmacionPendiente !== null) {
          this.confirmacionPendiente = null;
          this.falloOrden = true;
        }
      }
      if (this.rendered) {
        const nave = this.ultimoEstado?.ship ?? null;
        const ruta = prepareRoute(nave, game.i18n);
        const sistemas = nave ? prepareSystemRows(nave, game.i18n) : [];
        const firmaActual = firmaEstadoNaveVisible({
          conexion: this.conexion,
          detalleError: this.detalleError,
          ayudaAbierta: this.ayudaAbierta,
          esGM: Boolean(game.user?.isGM),
          naveExiste: Boolean(nave),
          naveCallsign: nave?.callsign ?? null,
          ruta,
          pausa: prepararVistaPausa({
            conexion: this.conexion,
            paused: this.pausaConfirmada,
            pendiente: this.ordenPendiente ?? this.confirmacionPendiente,
            falloOrden: this.falloOrden,
            foundryPausado: Boolean(game.paused),
            i18n: game.i18n,
          }),
          maniobra: prepararVistaManiobra({
            conexion: this.conexion,
            ship: nave,
            pendiente: this.maniobraPendiente,
            i18n: game.i18n,
          }),
          maniobraFallo: this.maniobraFallo,
          ingenieria: prepararVistaIngenieria({
            conexion: this.conexion,
            ship: nave,
            pendiente: this.ingenieriaPendiente,
            seleccionSistema: this.ingenieriaSistema,
            seleccionNivel: this.ingenieriaNivel,
            i18n: game.i18n,
          }),
          ingenieriaFallo: this.ingenieriaFallo,
          sistemas,
        });
        const cambioVisible = firmaActual !== this.#firmaVisibleAnterior;
        this.#firmaVisibleAnterior = firmaActual;
        if (cambioVisible) this.render();
        else this.#actualizarTelemetriaDom(nave, ruta, sistemas);
      }
      this.#programar();
    }

    #programar() {
      clearTimeout(this.#timer);
      this.#timer = setTimeout(() => this.#sondear(), this.#intervaloMs());
    }

    /**
     * Patch directo del DOM para telemetría continua (posición, rumbo, casco,
     * energía, distancia/ETA y salud/calor/potencia de sistemas) que no
     * necesita reconstruir el panel ni sus regiones role="status" — evita el
     * ruido de aria-live del sondeo periódico (issue #227 punto 6).
     */
    #actualizarTelemetriaDom(nave, ruta, sistemas) {
      const raiz = this.element;
      if (!raiz?.querySelector || !nave) return;
      const set = (selector, texto) => {
        const nodo = raiz.querySelector(selector);
        if (nodo && nodo.textContent !== texto) nodo.textContent = texto;
      };
      set('[data-field="nave-posicion"]', `${nave.position?.x ?? "?"}, ${nave.position?.y ?? "?"}`);
      set('[data-field="nave-rumbo"]', `${nave.heading ?? "?"}°`);
      set('[data-field="nave-casco"]', `${nave.hull ?? "?"} / ${nave.hull_max ?? "?"}`);
      set('[data-field="nave-energia"]', `${nave.energy ?? "?"} / ${nave.energy_max ?? "?"}`);
      if (ruta) {
        set('[data-field="ruta-distancia"]', ruta.distanceLabel);
        set('[data-field="ruta-eta"]', ruta.etaLabel);
      }
      for (const sistema of sistemas) {
        set(`[data-sistema-id="${sistema.id}"] [data-campo="salud"]`, `${sistema.health}%`);
        set(`[data-sistema-id="${sistema.id}"] [data-campo="calor"]`, `${sistema.heat}%`);
        set(`[data-sistema-id="${sistema.id}"] [data-campo="potencia"]`, `${sistema.power}%`);
      }
    }

    /**
     * Única vía de actualización de `pausaConfirmada`: una lectura real de
     * /v1/scenario. El ACK de /v1/command solo deja `confirmacionPendiente`;
     * aquí se resuelve como confirmada (notificación) o discordante (aviso y
     * estado de error con reintento coherente).
     */
    _registrarLecturaPausa(escenario) {
      const lectura = typeof escenario?.paused === "boolean" ? escenario.paused : null;
      this.pausaConfirmada = lectura;
      if (this.confirmacionPendiente === null || lectura === null) return;
      const esperado = this.confirmacionPendiente;
      this.confirmacionPendiente = null;
      if (lectura === esperado) {
        const key = lectura ? "LAGUNAK.Tempo.Pausado" : "LAGUNAK.Tempo.Reanudado";
        ui.notifications.info(game.i18n.localize(key));
      } else {
        this.falloOrden = true;
        ui.notifications.warn(game.i18n.localize("LAGUNAK.Tempo.Discordante"));
      }
    }

    _onFirstRender(context, options) {
      super._onFirstRender?.(context, options);
      this.#sondear();
    }

    _onRender(context, options) {
      super._onRender?.(context, options);
      const ayuda = this.element?.querySelector?.(".lagunak-ayuda");
      ayuda?.addEventListener?.("toggle", (event) => {
        this.ayudaAbierta = Boolean(event.currentTarget?.open);
      });
      // La selección de ingeniería se conserva en la instancia para sobrevivir
      // a los reemplazos del DOM del sondeo (que reconstruyen los <select>).
      const sistema = this.element?.querySelector?.('[data-field="ingenieria-sistema"]');
      sistema?.addEventListener?.("change", (event) => {
        this.ingenieriaSistema = event.currentTarget?.value ?? null;
      });
      const nivel = this.element?.querySelector?.('[data-field="ingenieria-nivel"]');
      nivel?.addEventListener?.("change", (event) => {
        const parsed = Number(event.currentTarget?.value);
        if (Number.isFinite(parsed)) this.ingenieriaNivel = parsed;
      });
    }

    _onClose(options) {
      clearTimeout(this.#timer);
      this.#timer = null;
      this.#fallosSeguidos = 0;
      this.conexion = "conectando";
      this.pausaConfirmada = null;
      this.ordenPendiente = null;
      this.confirmacionPendiente = null;
      this.falloOrden = false;
      this.ayudaAbierta = false;
      this.ingenieriaSistema = null;
      this.ingenieriaNivel = 1;
      this.ingenieriaPendiente = false;
      this.ingenieriaFallo = false;
      this.maniobraPendiente = false;
      this.maniobraFallo = false;
      this.#firmaVisibleAnterior = null;
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
        ayudaAbierta: this.ayudaAbierta,
        esGM: Boolean(game.user?.isGM),
        nave,
        ruta: prepareRoute(nave, game.i18n),
        pausa: prepararVistaPausa({
          conexion: this.conexion,
          paused: this.pausaConfirmada,
          // La UI sigue en «pausando»/«reanudando» hasta observar la lectura.
          pendiente: this.ordenPendiente ?? this.confirmacionPendiente,
          falloOrden: this.falloOrden,
          foundryPausado: Boolean(game.paused),
          i18n: game.i18n,
        }),
        maniobra: prepararVistaManiobra({
          conexion: this.conexion,
          ship: nave,
          pendiente: this.maniobraPendiente,
          i18n: game.i18n,
        }),
        maniobraFallo: this.maniobraFallo,
        sistemas: nave
          ? prepareSystemRows(nave, game.i18n).map(({ id, name, health, heat, power }) => ({
              id,
              nombre: name,
              salud: health,
              calor: heat,
              potencia: power,
            }))
          : [],
        ingenieria: prepararVistaIngenieria({
          conexion: this.conexion,
          ship: nave,
          pendiente: this.ingenieriaPendiente,
          seleccionSistema: this.ingenieriaSistema,
          seleccionNivel: this.ingenieriaNivel,
          i18n: game.i18n,
        }),
        ingenieriaFallo: this.ingenieriaFallo,
      };
    }

    /**
     * Emite una orden directa (#176). Una orden cada vez; revalida revocación y
     * rol tras el await antes de notificar o repoblar (lección de #201).
     */
    async _emitirManiobra(op, value) {
      if (this.maniobraPendiente || !game.user?.isGM || this.bridgeAccessRevoked) return;
      this.maniobraPendiente = true;
      this.maniobraFallo = false;
      if (this.rendered) this.render();
      try {
        const respuesta = await ordenarManiobra({
          op,
          value,
          isGM: Boolean(game.user?.isGM),
          client: this.#cliente(),
        });
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        const { ok, clave } = claveResultadoManiobra(respuesta);
        this.maniobraFallo = !ok;
        (ok ? ui.notifications.info : ui.notifications.warn).call(
          ui.notifications,
          game.i18n.localize(clave),
        );
      } catch (err) {
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        this.maniobraFallo = true;
        const message = err instanceof BridgeError
          ? err.message
          : game.i18n.localize("LAGUNAK.Errores.Desconocido");
        ui.notifications.error(message);
      } finally {
        this.maniobraPendiente = false;
        if (!this.bridgeAccessRevoked && game.user?.isGM && this.rendered) this.render();
      }
    }

    static async onOrdenarImpulso(_event, target) {
      return this._emitirManiobra("impulse", Number(target?.dataset?.value));
    }

    static async onOrdenarWarp(_event, target) {
      return this._emitirManiobra("warp", Number(target?.dataset?.value));
    }

    static async onOrdenarRumbo() {
      const select = this.element?.querySelector?.('[data-field="maniobra-rumbo"]');
      return this._emitirManiobra("heading", Number(select?.value));
    }

    static async onOrdenarEscudos(_event, target) {
      return this._emitirManiobra("shields", target?.dataset?.value === "true");
    }

    async _cambiarPausa(paused) {
      // Una orden cada vez: mientras una viaja o espera confirmación, la UI
      // deshabilita ambas.
      if (this.ordenPendiente !== null || this.confirmacionPendiente !== null) return;
      this.ordenPendiente = paused;
      this.falloOrden = false;
      if (this.rendered) this.render();
      try {
        const changed = await setSimulationPaused({
          paused,
          isGM: Boolean(game.user?.isGM),
          client: this.#cliente(),
        });
        if (changed && !this.bridgeAccessRevoked && game.user?.isGM) {
          // El ACK solo confirma que la orden fue aceptada: el estado se
          // considera confirmado únicamente al observarlo en /v1/scenario.
          this.confirmacionPendiente = paused;
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

    static async onAjustarIngenieria() {
      return this._ajustarIngenieria();
    }

    /**
     * Reparte energía al sistema seleccionado (panel de ingeniería del GM).
     * Una orden cada vez; revalida revocación y rol tras el await antes de
     * notificar o repoblar (lección de #201: un ACK tardío no debe alterar una
     * ventana ya revocada).
     */
    async _ajustarIngenieria() {
      if (this.ingenieriaPendiente || !game.user?.isGM || this.bridgeAccessRevoked) return;
      const system = this.ingenieriaSistema ?? this.#sistemaIngenieriaPorDefecto();
      const level = this.ingenieriaNivel;
      if (system == null) return;
      this.ingenieriaSistema = system;
      this.ingenieriaPendiente = true;
      this.ingenieriaFallo = false;
      if (this.rendered) this.render();
      try {
        const respuesta = await ajustarPotencia({
          system,
          level,
          isGM: Boolean(game.user?.isGM),
          client: this.#cliente(),
        });
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        const { ok, clave } = claveResultadoIngenieria(respuesta);
        this.ingenieriaFallo = !ok;
        (ok ? ui.notifications.info : ui.notifications.warn).call(
          ui.notifications,
          game.i18n.localize(clave),
        );
      } catch (err) {
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        this.ingenieriaFallo = true;
        const message = err instanceof BridgeError
          ? err.message
          : game.i18n.localize("LAGUNAK.Errores.Desconocido");
        ui.notifications.error(message);
      } finally {
        this.ingenieriaPendiente = false;
        if (!this.bridgeAccessRevoked && game.user?.isGM && this.rendered) this.render();
      }
    }

    /** Primer sistema presente en el último estado, para el valor por defecto. */
    #sistemaIngenieriaPorDefecto() {
      const vista = prepararVistaIngenieria({
        conexion: this.conexion,
        ship: this.ultimoEstado?.ship ?? null,
        i18n: game.i18n,
      });
      return vista.opcionesSistema[0]?.id ?? null;
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

      const marca = fechaLocal();
      const contenido = contenidoEstadoBitacora(nave, marca);

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
    // Última firma no-telemétrica renderizada (issue #227 punto 6): evita que
    // el sondeo reconstruya el panel —y sus regiones role="status"— cuando
    // solo cambió telemetría continua.
    #firmaVisibleAnterior = null;
    ultimoEstado = null;
    conexion = "conectando";
    detalleError = "";
    pausaConfirmada = null;
    ordenPendiente = null;
    confirmacionPendiente = null;
    falloOrden = false;
    ayudaAbierta = false;
    ingenieriaSistema = null;
    ingenieriaNivel = 1;
    ingenieriaPendiente = false;
    ingenieriaFallo = false;
    maniobraPendiente = false;
    maniobraFallo = false;
    bridgeAccessRevoked = false;

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
        token: getBridgeToken(),
      });
    }

    #intervaloMs() {
      const base = game.settings.get(MODULE_ID, "pollSeconds") * 1000;
      if (this.#fallosSeguidos === 0) return base;
      return Math.min(base * 2 ** this.#fallosSeguidos, BACKOFF_MAX_MS);
    }

    async #sondear() {
      if (this.bridgeAccessRevoked || !game.user?.isGM) return;
      try {
        const cliente = this.#cliente();
        await cliente.healthz();
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        const estado = await cliente.state();
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        const escenario = await cliente.scenario();
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        const eventos = await cliente.events();
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        const navePrevAlertas = this.ultimoEstado?.ship ?? null;
        this.ultimoEstado = estado;
        this._registrarLecturaPausa(escenario);
        await processBridgeEvents({
          payload: eventos,
          game,
          JournalEntry,
          ui,
        });
        await anotarAlertas({
          alertas: derivarAlertas(navePrevAlertas, estado?.ship ?? null),
          nonce: ALERTAS_NONCE,
          game,
          JournalEntry,
          ui,
          sigueVigente: () => !this.bridgeAccessRevoked && Boolean(game.user?.isGM),
        });
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        this.conexion = "ok";
        this.detalleError = "";
        this.#fallosSeguidos = 0;
      } catch (err) {
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        this.conexion = "error";
        this.detalleError = err instanceof BridgeError ? err.message : game.i18n.localize("LAGUNAK.Errores.Desconocido");
        this.#fallosSeguidos = Math.min(this.#fallosSeguidos + 1, 10);
        // Salida segura: si el sondeo falla con una confirmación pendiente,
        // no se deja la UI esperando para siempre un estado inobservable.
        if (this.confirmacionPendiente !== null) {
          this.confirmacionPendiente = null;
          this.falloOrden = true;
        }
      }
      if (this.rendered) {
        const nave = this.ultimoEstado?.ship ?? null;
        const ruta = prepareRoute(nave, game.i18n);
        const sistemas = nave ? prepareSystemRows(nave, game.i18n) : [];
        const firmaActual = firmaEstadoNaveVisible({
          conexion: this.conexion,
          detalleError: this.detalleError,
          ayudaAbierta: this.ayudaAbierta,
          esGM: Boolean(game.user?.isGM),
          naveExiste: Boolean(nave),
          naveCallsign: nave?.callsign ?? null,
          ruta,
          pausa: prepararVistaPausa({
            conexion: this.conexion,
            paused: this.pausaConfirmada,
            pendiente: this.ordenPendiente ?? this.confirmacionPendiente,
            falloOrden: this.falloOrden,
            foundryPausado: Boolean(game.paused),
            i18n: game.i18n,
          }),
          maniobra: prepararVistaManiobra({
            conexion: this.conexion,
            ship: nave,
            pendiente: this.maniobraPendiente,
            i18n: game.i18n,
          }),
          maniobraFallo: this.maniobraFallo,
          ingenieria: prepararVistaIngenieria({
            conexion: this.conexion,
            ship: nave,
            pendiente: this.ingenieriaPendiente,
            seleccionSistema: this.ingenieriaSistema,
            seleccionNivel: this.ingenieriaNivel,
            i18n: game.i18n,
          }),
          ingenieriaFallo: this.ingenieriaFallo,
          sistemas,
        });
        const cambioVisible = firmaActual !== this.#firmaVisibleAnterior;
        this.#firmaVisibleAnterior = firmaActual;
        if (cambioVisible) this.render(false);
        else this.#actualizarTelemetriaDom(nave, ruta, sistemas);
      }
      clearTimeout(this.#timer);
      this.#timer = setTimeout(() => this.#sondear(), this.#intervaloMs());
    }

    /**
     * Patch directo del DOM para telemetría continua (posición, rumbo, casco,
     * energía, distancia/ETA y salud/calor/potencia de sistemas) que no
     * necesita reconstruir el panel ni sus regiones role="status" — evita el
     * ruido de aria-live del sondeo periódico (issue #227 punto 6).
     */
    #actualizarTelemetriaDom(nave, ruta, sistemas) {
      const raiz = this.element?.[0];
      if (!raiz?.querySelector || !nave) return;
      const set = (selector, texto) => {
        const nodo = raiz.querySelector(selector);
        if (nodo && nodo.textContent !== texto) nodo.textContent = texto;
      };
      set('[data-field="nave-posicion"]', `${nave.position?.x ?? "?"}, ${nave.position?.y ?? "?"}`);
      set('[data-field="nave-rumbo"]', `${nave.heading ?? "?"}°`);
      set('[data-field="nave-casco"]', `${nave.hull ?? "?"} / ${nave.hull_max ?? "?"}`);
      set('[data-field="nave-energia"]', `${nave.energy ?? "?"} / ${nave.energy_max ?? "?"}`);
      if (ruta) {
        set('[data-field="ruta-distancia"]', ruta.distanceLabel);
        set('[data-field="ruta-eta"]', ruta.etaLabel);
      }
      for (const sistema of sistemas) {
        set(`[data-sistema-id="${sistema.id}"] [data-campo="salud"]`, `${sistema.health}%`);
        set(`[data-sistema-id="${sistema.id}"] [data-campo="calor"]`, `${sistema.heat}%`);
        set(`[data-sistema-id="${sistema.id}"] [data-campo="potencia"]`, `${sistema.power}%`);
      }
    }

    /**
     * Única vía de actualización de `pausaConfirmada`: una lectura real de
     * /v1/scenario. El ACK de /v1/command solo deja `confirmacionPendiente`;
     * aquí se resuelve como confirmada (notificación) o discordante (aviso y
     * estado de error con reintento coherente).
     */
    _registrarLecturaPausa(escenario) {
      const lectura = typeof escenario?.paused === "boolean" ? escenario.paused : null;
      this.pausaConfirmada = lectura;
      if (this.confirmacionPendiente === null || lectura === null) return;
      const esperado = this.confirmacionPendiente;
      this.confirmacionPendiente = null;
      if (lectura === esperado) {
        const key = lectura ? "LAGUNAK.Tempo.Pausado" : "LAGUNAK.Tempo.Reanudado";
        ui.notifications.info(game.i18n.localize(key));
      } else {
        this.falloOrden = true;
        ui.notifications.warn(game.i18n.localize("LAGUNAK.Tempo.Discordante"));
      }
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
      this.confirmacionPendiente = null;
      this.falloOrden = false;
      this.ayudaAbierta = false;
      this.ingenieriaSistema = null;
      this.ingenieriaNivel = 1;
      this.ingenieriaPendiente = false;
      this.ingenieriaFallo = false;
      this.maniobraPendiente = false;
      this.maniobraFallo = false;
      this.#firmaVisibleAnterior = null;
      return super.close(options);
    }

    activateListeners(html) {
      super.activateListeners(html);
      html.find('[data-action="anotar"]').on("click", () => this.#anotar());
      html.find('[data-action="ordenarImpulso"]').on("click", (event) =>
        this.#emitirManiobra("impulse", Number(event.currentTarget?.dataset?.value)));
      html.find('[data-action="ordenarWarp"]').on("click", (event) =>
        this.#emitirManiobra("warp", Number(event.currentTarget?.dataset?.value)));
      html.find('[data-action="ordenarEscudos"]').on("click", (event) =>
        this.#emitirManiobra("shields", event.currentTarget?.dataset?.value === "true"));
      html.find('[data-action="ordenarRumbo"]').on("click", () =>
        this.#emitirManiobra("heading", Number(html.find('[data-field="maniobra-rumbo"]').val())));
      html.find('[data-action="pausar"]').on("click", () => this.#cambiarPausa(true));
      html.find('[data-action="reanudar"]').on("click", () => this.#cambiarPausa(false));
      html.find('[data-action="ajustarIngenieria"]').on("click", () => this.#ajustarIngenieria());
      html.find('[data-field="ingenieria-sistema"]').on("change", (event) => {
        this.ingenieriaSistema = event.currentTarget?.value ?? null;
      });
      html.find('[data-field="ingenieria-nivel"]').on("change", (event) => {
        const parsed = Number(event.currentTarget?.value);
        if (Number.isFinite(parsed)) this.ingenieriaNivel = parsed;
      });
      html.find(".lagunak-ayuda").on("toggle", (event) => {
        this.ayudaAbierta = Boolean(event.currentTarget?.open);
      });
    }

    getData(_options) {
      const nave = this.ultimoEstado?.ship ?? null;
      return {
        conexion: this.conexion,
        conexionOk: this.conexion === "ok",
        conexionError: this.conexion === "error",
        conexionConectando: this.conexion === "conectando",
        detalleError: this.detalleError,
        ayudaAbierta: this.ayudaAbierta,
        esGM: Boolean(game.user?.isGM),
        nave,
        ruta: prepareRoute(nave, game.i18n),
        pausa: prepararVistaPausa({
          conexion: this.conexion,
          paused: this.pausaConfirmada,
          // La UI sigue en «pausando»/«reanudando» hasta observar la lectura.
          pendiente: this.ordenPendiente ?? this.confirmacionPendiente,
          falloOrden: this.falloOrden,
          foundryPausado: Boolean(game.paused),
          i18n: game.i18n,
        }),
        maniobra: prepararVistaManiobra({
          conexion: this.conexion,
          ship: nave,
          pendiente: this.maniobraPendiente,
          i18n: game.i18n,
        }),
        maniobraFallo: this.maniobraFallo,
        sistemas: nave
          ? prepareSystemRows(nave, game.i18n).map(({ id, name, health, heat, power }) => ({
              id,
              nombre: name,
              salud: health,
              calor: heat,
              potencia: power,
            }))
          : [],
        ingenieria: prepararVistaIngenieria({
          conexion: this.conexion,
          ship: nave,
          pendiente: this.ingenieriaPendiente,
          seleccionSistema: this.ingenieriaSistema,
          seleccionNivel: this.ingenieriaNivel,
          i18n: game.i18n,
        }),
        ingenieriaFallo: this.ingenieriaFallo,
      };
    }

    async #ajustarIngenieria() {
      if (this.ingenieriaPendiente || !game.user?.isGM || this.bridgeAccessRevoked) return;
      const system = this.ingenieriaSistema ?? this.#sistemaIngenieriaPorDefecto();
      const level = this.ingenieriaNivel;
      if (system == null) return;
      this.ingenieriaSistema = system;
      this.ingenieriaPendiente = true;
      this.ingenieriaFallo = false;
      if (this.rendered) this.render(false);
      try {
        const respuesta = await ajustarPotencia({
          system,
          level,
          isGM: Boolean(game.user?.isGM),
          client: this.#cliente(),
        });
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        const { ok, clave } = claveResultadoIngenieria(respuesta);
        this.ingenieriaFallo = !ok;
        (ok ? ui.notifications.info : ui.notifications.warn).call(
          ui.notifications,
          game.i18n.localize(clave),
        );
      } catch (err) {
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        this.ingenieriaFallo = true;
        const message = err instanceof BridgeError
          ? err.message
          : game.i18n.localize("LAGUNAK.Errores.Desconocido");
        ui.notifications.error(message);
      } finally {
        this.ingenieriaPendiente = false;
        if (!this.bridgeAccessRevoked && game.user?.isGM && this.rendered) this.render(false);
      }
    }

    async #emitirManiobra(op, value) {
      if (this.maniobraPendiente || !game.user?.isGM || this.bridgeAccessRevoked) return;
      this.maniobraPendiente = true;
      this.maniobraFallo = false;
      if (this.rendered) this.render(false);
      try {
        const respuesta = await ordenarManiobra({
          op,
          value,
          isGM: Boolean(game.user?.isGM),
          client: this.#cliente(),
        });
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        const { ok, clave } = claveResultadoManiobra(respuesta);
        this.maniobraFallo = !ok;
        (ok ? ui.notifications.info : ui.notifications.warn).call(
          ui.notifications,
          game.i18n.localize(clave),
        );
      } catch (err) {
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        this.maniobraFallo = true;
        const message = err instanceof BridgeError
          ? err.message
          : game.i18n.localize("LAGUNAK.Errores.Desconocido");
        ui.notifications.error(message);
      } finally {
        this.maniobraPendiente = false;
        if (!this.bridgeAccessRevoked && game.user?.isGM && this.rendered) this.render(false);
      }
    }

    #sistemaIngenieriaPorDefecto() {
      const vista = prepararVistaIngenieria({
        conexion: this.conexion,
        ship: this.ultimoEstado?.ship ?? null,
        i18n: game.i18n,
      });
      return vista.opcionesSistema[0]?.id ?? null;
    }

    async #cambiarPausa(paused) {
      // Una orden cada vez: mientras una viaja o espera confirmación, la UI
      // deshabilita ambas.
      if (this.ordenPendiente !== null || this.confirmacionPendiente !== null) return;
      this.ordenPendiente = paused;
      this.falloOrden = false;
      if (this.rendered) this.render(false);
      try {
        const changed = await setSimulationPaused({
          paused,
          isGM: Boolean(game.user?.isGM),
          client: this.#cliente(),
        });
        if (changed && !this.bridgeAccessRevoked && game.user?.isGM) {
          // El ACK solo confirma que la orden fue aceptada: el estado se
          // considera confirmado únicamente al observarlo en /v1/scenario.
          this.confirmacionPendiente = paused;
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

      const marca = fechaLocal();
      const contenido = contenidoEstadoBitacora(nave, marca);

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
/* parallax + blips de contactos de /v1/contacts, con nave, rumbo y    */
/* contactos inequívocos tweeneados entre las dos últimas muestras     */
/* confirmadas (nunca extrapola: es una vista, no un simulador).       */
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
    #ultimoFrame = null; // último frame pintado, para el hit-test de clic (issue #259)
    #campo = crearCampoEstrellas(MAPA_SEMILLA);
    #decorado = crearDecorado(MAPA_SEMILLA);
    #muestraPrev = null;
    #muestraActual = null;
    contactos = [];
    destino = null; // último destination confirmado de /v1/state (issue #175)
    seleccion = null; // callsign del contacto seleccionado en la lista
    conexion = "conectando";
    detalleError = "";
    bridgeAccessRevoked = false;

    #cliente() {
      return new BridgeClient({
        url: game.settings.get(MODULE_ID, "bridgeUrl"),
        token: getBridgeToken(),
      });
    }

    #intervaloMs() {
      const base = game.settings.get(MODULE_ID, "pollSeconds") * 1000;
      if (this.#fallosSeguidos === 0) return base;
      return Math.min(base * 2 ** this.#fallosSeguidos, BACKOFF_MAX_MS);
    }

    async #sondear() {
      if (this.bridgeAccessRevoked || !game.user?.isGM) return;
      // La generación se captura al entrar: si la ventana se cierra (o se
      // reabre) con esta petición en vuelo, la respuesta tardía no puede
      // tocar estado, renderizar ni rearmar el polling.
      const generacion = this.#generacion;
      const firmaAnterior = firmaEstructuralContactos(this.contactos);
      const conexionAnterior = this.conexion;
      const detalleErrorAnterior = this.detalleError;
      let rotadas = null;
      let contactos = null;
      let destino = null;
      let fallo = null;
      try {
        const cliente = this.#cliente();
        await cliente.healthz();
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        // Estado y contactos se solicitan juntos para reducir el desfase
        // temporal entre ambas fotografías confirmadas del simulador.
        const resultados = await Promise.allSettled([
          cliente.state(),
          cliente.contacts(),
        ]);
        const rechazado = resultados.find((resultado) => resultado.status === "rejected");
        if (rechazado) throw rechazado.reason;
        const [estado, respuestaContactos] = resultados.map((resultado) => resultado.value);
        const nave = estado?.ship ?? null;
        contactos = normalizarContactosMapa(respuestaContactos?.contacts ?? []);
        destino = nave?.destination ?? null;
        if (nave) {
          const centro = normalizarPosicionMapa(nave.position);
          if (!centro) throw new Error("Posición de nave no finita");
          // Ventana de reproducción: nave, rumbo y contactos comparten los
          // mismos timestamps y avanzan juntos entre sondeos confirmados.
          rotadas = rotarMuestras(this.#muestraActual, {
            centro,
            rumboDeg: Number.isFinite(nave.heading) ? nave.heading : 0,
            contactos,
          }, Date.now());
        }
      } catch (err) {
        fallo = err;
      }
      if (generacion !== this.#generacion || this.bridgeAccessRevoked || !game.user?.isGM) return;
      if (fallo === null) {
        if (rotadas) {
          this.#muestraPrev = rotadas.prev;
          this.#muestraActual = rotadas.actual;
        }
        this.contactos = contactos;
        this.destino = destino;
        this.conexion = "ok";
        this.detalleError = "";
        this.#fallosSeguidos = 0;
      } else {
        this.conexion = "error";
        this.detalleError = fallo instanceof BridgeError ? fallo.message : game.i18n.localize("LAGUNAK.Errores.Desconocido");
        this.#fallosSeguidos = Math.min(this.#fallosSeguidos + 1, 10);
      }
      const cambioVisible = conexionAnterior !== this.conexion
        || detalleErrorAnterior !== this.detalleError
        || firmaAnterior !== firmaEstructuralContactos(this.contactos);
      // Una posición nueva alimenta el rAF sin sustituir el canvas. Solo los
      // cambios estructurales o de conexión necesitan reconstruir la ventana;
      // las cifras confirmadas se actualizan sobre el DOM estable.
      if (this.rendered && cambioVisible) this.render();
      else if (this.rendered) this.#actualizarTelemetriaDom();
      this.#programar();
    }

    #programar() {
      clearTimeout(this.#timer);
      this.#timer = setTimeout(() => this.#sondear(), this.#intervaloMs());
    }

    #actualizarTelemetriaDom() {
      const raiz = this.element;
      const centro = this.#muestraActual?.centro ?? null;
      if (!raiz?.querySelectorAll || !centro) return;
      for (const boton of raiz.querySelectorAll("[data-contacto]")) {
        const indice = Number.parseInt(boton.dataset.contactoIndice ?? "", 10);
        const contacto = Number.isInteger(indice) ? this.contactos[indice] : null;
        if (!contacto) continue;
        const detalle = prepararDetalleContacto(contacto, centro);
        const distancia = boton.querySelector?.(".lagunak-mapa-distancia");
        if (distancia) {
          distancia.textContent = game.i18n.format("LAGUNAK.EstadoNave.DistanciaUnidades", {
            distance: Math.round(detalle.distancia),
          });
        }
        const fuera = boton.querySelector?.("[data-lagunak-fuera]");
        if (fuera) fuera.hidden = detalle.distancia <= MAPA_RADIO_MUNDO;
      }
      const seleccionado = this.contactos.find((c) => (c.callsign ?? "?") === this.seleccion);
      if (!seleccionado) return;
      const detalle = prepararDetalleContacto(seleccionado, centro);
      const distancia = raiz.querySelector("[data-lagunak-detalle-distancia]");
      const rumbo = raiz.querySelector("[data-lagunak-detalle-rumbo]");
      if (distancia) {
        distancia.textContent = game.i18n.format("LAGUNAK.EstadoNave.DistanciaUnidades", {
          distance: Math.round(detalle.distancia),
        });
      }
      if (rumbo) {
        rumbo.textContent = game.i18n.format("LAGUNAK.MapaVivo.RumboGrados", {
          rumbo: Math.round(detalle.rumboDeg),
        });
      }
    }

    #animar(rafMs = null) {
      // Sin rAF global (p. ej. arnés de pruebas) la animación se auto-inhibe;
      // el mapa sigue funcionando a golpe de re-render del sondeo.
      if (!this.rendered || typeof requestAnimationFrame !== "function") {
        this.#rafId = null;
        return;
      }
      this.#rafId = requestAnimationFrame((siguienteRafMs) => this.#animar(siguienteRafMs));
      const relojRaf = Number.isFinite(rafMs) ? rafMs : (globalThis.performance?.now?.() ?? 0);
      const ahora = Date.now();
      if (!debeDibujar(this.#ultimoDibujoMs, relojRaf, MAPA_FPS)) return;
      // El re-render del sondeo reemplaza el DOM del part (canvas incluido):
      // el lienzo se busca en cada tick, nunca se cachea.
      const canvas = this.element?.querySelector?.(".lagunak-mapa-canvas");
      const ctx = canvas?.getContext?.("2d");
      if (!ctx) return;
      this.#ultimoDibujoMs = relojRaf;
      const frame = componerFrame({
        muestraPrev: this.#muestraPrev,
        muestraActual: this.#muestraActual,
        contactos: this.contactos,
        destino: this.destino,
        campo: this.#campo,
        tMs: ahora,
        ancho: canvas.width,
        alto: canvas.height,
        radioMundo: MAPA_RADIO_MUNDO,
      });
      const decorado = frame.sinDatos
        ? []
        : componerDecorado(this.#decorado, {
            centro: frame.centro,
            ancho: canvas.width,
            alto: canvas.height,
          });
      dibujarFrame(ctx, frame, { ancho: canvas.width, alto: canvas.height, decorado });
      this.#ultimoFrame = frame;
    }

    _onFirstRender(context, options) {
      super._onFirstRender?.(context, options);
      this.#sondear();
      this.#animar();
    }

    /* Selección de contacto (issue #126): un cambio estructural puede sustituir
     * la lista, así que los listeners se re-atan tras cada render. Clic en el
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
      // Clic directo sobre el objeto en el mapa vivo (issue #259): mismo
      // mecanismo de selección que la lista de contactos, así que reutiliza
      // el panel de detalle ya existente sin duplicar lógica.
      const canvas = this.element?.querySelector?.(".lagunak-mapa-canvas");
      canvas?.addEventListener("click", (ev) => {
        if (!this.#ultimoFrame) return;
        const rect = canvas.getBoundingClientRect();
        const x = ((ev.clientX - rect.left) / rect.width) * canvas.width;
        const y = ((ev.clientY - rect.top) / rect.height) * canvas.height;
        const callsign = contactoEnPunto(this.#ultimoFrame.blips, x, y);
        if (callsign === null) return;
        this.seleccion = callsign === this.seleccion ? null : callsign;
        this.render();
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
    #ultimoFrame = null; // último frame pintado, para el hit-test de clic (issue #259)
    #campo = crearCampoEstrellas(MAPA_SEMILLA);
    #decorado = crearDecorado(MAPA_SEMILLA);
    #muestraPrev = null;
    #muestraActual = null;
    contactos = [];
    destino = null; // último destination confirmado de /v1/state (issue #175)
    seleccion = null; // callsign del contacto seleccionado en la lista
    conexion = "conectando";
    detalleError = "";
    bridgeAccessRevoked = false;

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
        token: getBridgeToken(),
      });
    }

    #intervaloMs() {
      const base = game.settings.get(MODULE_ID, "pollSeconds") * 1000;
      if (this.#fallosSeguidos === 0) return base;
      return Math.min(base * 2 ** this.#fallosSeguidos, BACKOFF_MAX_MS);
    }

    async #sondear() {
      if (this.bridgeAccessRevoked || !game.user?.isGM) return;
      // Misma disciplina que la ruta V2 (réplica aislada): la generación se
      // captura al entrar y una respuesta tardía tras cerrar muere sin tocar
      // estado, renderizar ni rearmar el polling.
      const generacion = this.#generacion;
      const firmaAnterior = firmaEstructuralContactos(this.contactos);
      const conexionAnterior = this.conexion;
      const detalleErrorAnterior = this.detalleError;
      let rotadas = null;
      let contactos = null;
      let destino = null;
      let fallo = null;
      try {
        const cliente = this.#cliente();
        await cliente.healthz();
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        const resultados = await Promise.allSettled([
          cliente.state(),
          cliente.contacts(),
        ]);
        const rechazado = resultados.find((resultado) => resultado.status === "rejected");
        if (rechazado) throw rechazado.reason;
        const [estado, respuestaContactos] = resultados.map((resultado) => resultado.value);
        const nave = estado?.ship ?? null;
        contactos = normalizarContactosMapa(respuestaContactos?.contacts ?? []);
        destino = nave?.destination ?? null;
        if (nave) {
          const centro = normalizarPosicionMapa(nave.position);
          if (!centro) throw new Error("Posición de nave no finita");
          // Ventana de reproducción equivalente a V2: centro, rumbo y
          // contactos comparten la misma ventana temporal confirmada.
          rotadas = rotarMuestras(this.#muestraActual, {
            centro,
            rumboDeg: Number.isFinite(nave.heading) ? nave.heading : 0,
            contactos,
          }, Date.now());
        }
      } catch (err) {
        fallo = err;
      }
      if (generacion !== this.#generacion || this.bridgeAccessRevoked || !game.user?.isGM) return;
      if (fallo === null) {
        if (rotadas) {
          this.#muestraPrev = rotadas.prev;
          this.#muestraActual = rotadas.actual;
        }
        this.contactos = contactos;
        this.destino = destino;
        this.conexion = "ok";
        this.detalleError = "";
        this.#fallosSeguidos = 0;
      } else {
        this.conexion = "error";
        this.detalleError = fallo instanceof BridgeError ? fallo.message : game.i18n.localize("LAGUNAK.Errores.Desconocido");
        this.#fallosSeguidos = Math.min(this.#fallosSeguidos + 1, 10);
      }
      const cambioVisible = conexionAnterior !== this.conexion
        || detalleErrorAnterior !== this.detalleError
        || firmaAnterior !== firmaEstructuralContactos(this.contactos);
      if (this.rendered && cambioVisible) this.render(false);
      else if (this.rendered) this.#actualizarTelemetriaDom();
      clearTimeout(this.#timer);
      this.#timer = setTimeout(() => this.#sondear(), this.#intervaloMs());
    }

    #actualizarTelemetriaDom() {
      const raiz = this.element?.[0];
      const centro = this.#muestraActual?.centro ?? null;
      if (!raiz?.querySelectorAll || !centro) return;
      for (const boton of raiz.querySelectorAll("[data-contacto]")) {
        const indice = Number.parseInt(boton.dataset.contactoIndice ?? "", 10);
        const contacto = Number.isInteger(indice) ? this.contactos[indice] : null;
        if (!contacto) continue;
        const detalle = prepararDetalleContacto(contacto, centro);
        const distancia = boton.querySelector?.(".lagunak-mapa-distancia");
        if (distancia) {
          distancia.textContent = game.i18n.format("LAGUNAK.EstadoNave.DistanciaUnidades", {
            distance: Math.round(detalle.distancia),
          });
        }
        const fuera = boton.querySelector?.("[data-lagunak-fuera]");
        if (fuera) fuera.hidden = detalle.distancia <= MAPA_RADIO_MUNDO;
      }
      const seleccionado = this.contactos.find((c) => (c.callsign ?? "?") === this.seleccion);
      if (!seleccionado) return;
      const detalle = prepararDetalleContacto(seleccionado, centro);
      const distancia = raiz.querySelector("[data-lagunak-detalle-distancia]");
      const rumbo = raiz.querySelector("[data-lagunak-detalle-rumbo]");
      if (distancia) {
        distancia.textContent = game.i18n.format("LAGUNAK.EstadoNave.DistanciaUnidades", {
          distance: Math.round(detalle.distancia),
        });
      }
      if (rumbo) {
        rumbo.textContent = game.i18n.format("LAGUNAK.MapaVivo.RumboGrados", {
          rumbo: Math.round(detalle.rumboDeg),
        });
      }
    }

    #animar(rafMs = null) {
      if (!this.rendered || typeof requestAnimationFrame !== "function") {
        this.#rafId = null;
        return;
      }
      this.#rafId = requestAnimationFrame((siguienteRafMs) => this.#animar(siguienteRafMs));
      const relojRaf = Number.isFinite(rafMs) ? rafMs : (globalThis.performance?.now?.() ?? 0);
      const ahora = Date.now();
      if (!debeDibujar(this.#ultimoDibujoMs, relojRaf, MAPA_FPS)) return;
      const canvas = this.element?.[0]?.querySelector?.(".lagunak-mapa-canvas");
      const ctx = canvas?.getContext?.("2d");
      if (!ctx) return;
      this.#ultimoDibujoMs = relojRaf;
      const frame = componerFrame({
        muestraPrev: this.#muestraPrev,
        muestraActual: this.#muestraActual,
        contactos: this.contactos,
        destino: this.destino,
        campo: this.#campo,
        tMs: ahora,
        ancho: canvas.width,
        alto: canvas.height,
        radioMundo: MAPA_RADIO_MUNDO,
      });
      const decorado = frame.sinDatos
        ? []
        : componerDecorado(this.#decorado, {
            centro: frame.centro,
            ancho: canvas.width,
            alto: canvas.height,
          });
      dibujarFrame(ctx, frame, { ancho: canvas.width, alto: canvas.height, decorado });
      this.#ultimoFrame = frame;
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
      // Clic directo sobre el objeto en el mapa vivo (issue #259), misma
      // lógica que la ruta V2: reutiliza la selección/panel de detalle ya
      // existente en vez de un popover flotante nuevo.
      html.find(".lagunak-mapa-canvas").on("click", (ev) => {
        const canvas = ev.currentTarget;
        if (!this.#ultimoFrame || !canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = ((ev.clientX - rect.left) / rect.width) * canvas.width;
        const y = ((ev.clientY - rect.top) / rect.height) * canvas.height;
        const callsign = contactoEnPunto(this.#ultimoFrame.blips, x, y);
        if (callsign === null) return;
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
