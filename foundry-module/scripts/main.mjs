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
 * para no poder afectarla). Las cuatro factorías de ventana (estado de
 * nave y mapa vivo, V1/V2) viven en sus propios módulos
 * (estado-nave-app-v2.mjs, estado-nave-app-v1.mjs, mapa-vivo-app-v2.mjs,
 * mapa-vivo-app-v1.mjs); este archivo solo orquesta settings, hooks,
 * scene controls y la apertura/revocación de esas ventanas.
 *
 * Seguridad: la URL es un ajuste de ámbito "client"; el token del puente vive
 * solo en memoria durante la sesión del navegador GM. Nunca entra en la base
 * de datos del mundo, localStorage, sockets, Journal o logs.
 * El token Bearer es la autoridad del puente; `game.user.isGM` protege la UI,
 * pero el navegador no puede acreditar por sí solo un rol ante el servidor.
 */

import {
  clearLegacyBridgeToken,
  getBridgeToken,
  openBridgeTokenApp,
  registerBridgeTokenFeature,
  revokeBridgeTokenAccess,
} from "./bridge-token-session.mjs";
import { probarConexion } from "./diagnostico-conexion.mjs";
import { addStationControl, registerStationFeature } from "./station-ui.mjs";
import {
  addWorkspaceControl,
  registerWorkspaceFeature,
  revokeWorkspaceAccess,
} from "./station-workspace-ui.mjs";
import { registerStationOrders } from "./station-order-wiring.mjs";
import { registrarAjusteAlerta, registrarEscuchaAlerta } from "./alerta-escena.mjs";
import { crearClaseV2 } from "./estado-nave-app-v2.mjs";
import { crearClaseV1 } from "./estado-nave-app-v1.mjs";
import { crearClaseMapaV2 } from "./mapa-vivo-app-v2.mjs";
import { crearClaseMapaV1 } from "./mapa-vivo-app-v1.mjs";
import {
  MODULE_ID,
  POLL_MIN_S,
  POLL_MAX_S,
  MAPA_SEMILLA_DEFECTO,
} from "./lagunak-constantes.mjs";

registerStationFeature(MODULE_ID);
registerWorkspaceFeature(MODULE_ID);
registerBridgeTokenFeature(MODULE_ID);

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

  // Semilla del decorado de fondo del mapa vivo (issue #215, mejora pedida en
  // review): ajuste de MUNDO para que todos vean el mismo cielo. El GM puede
  // escribir un valor concreto aquí, o usar el botón "nuevo decorado
  // aleatorio" de los controles de escena (regenerarDecoradoAleatorio), que
  // guarda un valor al azar en este mismo ajuste.
  // Nivel de alerta vigente (verde/amarilla/roja). Ajuste de MUNDO: lo escribe
  // el GM y lo leen todos, así que un jugador que entra tarde ve la alerta en
  // curso sin esperar al siguiente sondeo del GM.
  registrarAjusteAlerta(MODULE_ID);

  game.settings.register(MODULE_ID, "decoradoSemilla", {
    name: "LAGUNAK.Ajustes.DecoradoSemilla.Nombre",
    hint: "LAGUNAK.Ajustes.DecoradoSemilla.Pista",
    scope: "world",
    config: true,
    type: Number,
    default: MAPA_SEMILLA_DEFECTO,
    // Único punto de regeneración del mapa abierto: Foundry lo invoca tanto
    // en el cliente que escribe el ajuste como en el resto al sincronizar el
    // valor de mundo, así que un cambio desde ajustes o desde el botón "nuevo
    // decorado aleatorio" refresca a todos por igual (issue #215 review).
    onChange: (semilla) => mapaApp?.regenerarDecorado?.(semilla),
  });
});

Hooks.once("ready", () => {
  // Migración de #183: no se lee el valor legado; se sobrescribe con vacío.
  // El token operativo vive exclusivamente en bridge-token-session.mjs.
  void clearLegacyBridgeToken();
  // Nivel de alerta de la nave: TODOS los clientes escuchan, porque la alerta
  // es información de ambiente que la tripulación conocería de sobra. Solo el
  // GM la publica, desde el estado que solo él recibe.
  registrarEscuchaAlerta(MODULE_ID);
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
        {
          name: "lagunak-decorado-aleatorio",
          title: "LAGUNAK.Controles.DecoradoAleatorio",
          icon: "fa-solid fa-dice",
          button: true,
          onClick: () => regenerarDecoradoAleatorio(),
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

/* Nuevo decorado aleatorio (issue #215, mejora pedida en review): el GM puede
 * cambiar el cielo/decorado del mapa vivo a uno nuevo con un clic, en vez de
 * teclear una semilla a mano en los ajustes del módulo. Se guarda como ajuste
 * de MUNDO para que quede igual para todos y sobreviva a recargas; el
 * `onChange` del ajuste (arriba) es el único punto que reconstruye el mapa
 * abierto, así que aquí no se llama a mapaApp directamente: evita
 * regenerarlo dos veces en este mismo cliente y cubre también a los demás. */
async function regenerarDecoradoAleatorio() {
  if (!game.user?.isGM) return;
  const nuevaSemilla = Math.floor(Math.random() * 0x100000000); // 32 bits, mismo rango que rngSemilla
  await game.settings.set(MODULE_ID, "decoradoSemilla", nuevaSemilla);
  ui.notifications.info(
    game.i18n.format("LAGUNAK.Notificaciones.DecoradoRegenerado", { semilla: nuevaSemilla }),
  );
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
