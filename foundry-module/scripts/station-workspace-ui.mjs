import { BridgeClient, BridgeError } from "./bridge-client.mjs";
import { getBridgeToken } from "./bridge-token-session.mjs";
import { openStationApp } from "./station-ui.mjs";
import { buildWorkspaceModel, stationForWorkspace } from "./station-workspaces.mjs";
import { emitWorkspaceOrder } from "./station-order-wiring.mjs";
import { ORDER_FORMS } from "./station-order-forms.mjs";
import { pintarNave } from "./retro3d-lienzo.mjs";
import { aceptarAcuse, estadoOrden } from "./acuse-orden.mjs";
import {
  aceptarTelemetria,
  canalTelemetria,
  difundirTelemetria,
  esMasReciente,
} from "./telemetria-difusion.mjs";
import { CASCO_POR_DEFECTO, mallaDesdeCasco } from "./retro3d.mjs";
import { PIXEL } from "./paleta.mjs";

let configuredModuleId = null;
let workspaceApp = null;

export function registerWorkspaceFeature(moduleId) {
  configuredModuleId = moduleId;
  Hooks.on("updateUser", () => renderWorkspace());

  // Recepción de la telemetría difundida por el GM (#331). Se registra siempre,
  // también en el cliente del GM: es inofensivo —él ya tiene el dato de primera
  // mano y el sello descarta lo viejo— y evita que un relevo de GM deje a un
  // cliente sin oyente.
  // Acuse de la última orden propia (#331, paso 2). Cada cliente descarta lo
  // que no va dirigido a su usuario, igual que las vistas privadas del póker.
  const recibirAcuse = (sobre) => {
    const app = workspaceApp;
    if (!app || app.closed || !sobre) return;
    app.ultimoAcuse = sobre;
    renderWorkspace();
  };
  Hooks.on("lagunakAcuseOrden", recibirAcuse);

  game.socket?.on(canalTelemetria(moduleId), (mensaje) => {
    const acuse = aceptarAcuse(mensaje, game.user?.id);
    if (acuse) {
      recibirAcuse(acuse);
      return;
    }
    const recibido = aceptarTelemetria(mensaje);
    if (!recibido) return;
    const app = workspaceApp;
    if (!app || app.closed) return;
    // Fuera de orden se descarta: sin esto la consola parpadearía hacia atrás, y
    // en una lectura de rumbo eso se ve como una sacudida de la nave.
    if (!esMasReciente(mensaje, app.selloTelemetria)) return;
    app.selloTelemetria = mensaje.sello;
    // El GM conserva su propio sondeo como fuente: tiene los contactos, que no
    // viajan por aquí, y pisarlo con el sobre recortado se los borraría.
    if (!game.user?.isGM) {
      app.statePayload = { ship: recibido.ship };
      // Contactos ya degradados por el GM: la tripulación nunca recibe el
      // payload crudo, así que esto es lo único que tiene y no hay nada que
      // volver a filtrar en este lado.
      app.contactosProyectados = recibido.contactos;
      app.connection = "ok";
      app.error = "";
    }
    renderWorkspace();
  });
}

export function addWorkspaceControl(controls) {
  const tool = {
    name: "lagunak-espacio-puesto",
    title: "LAGUNAK.Controles.AbrirEspacio",
    icon: "fa-solid fa-display",
    button: true,
    onClick: () => openWorkspaceApp(),
  };

  if (Array.isArray(controls)) {
    const grupo = controls.find?.((group) => group.name === "lagunak");
    if (grupo) grupo.tools.push(tool);
    return;
  }

  const group = controls?.lagunak;
  if (group?.tools && !Array.isArray(group.tools)) {
    group.tools[tool.name] = { ...tool, order: Object.keys(group.tools).length, onChange: tool.onClick };
  }
}

export function openWorkspaceApp(previewStation = null) {
  if (!configuredModuleId) return;
  workspaceApp ??= new (workspaceAppClass())();
  if (previewStation && game.user?.isGM) workspaceApp.setPreviewStation(previewStation);
  renderWorkspace(true);
}

export async function revokeWorkspaceAccess() {
  const app = workspaceApp;
  if (!app) return;
  app.statePayload = null;
  app.contactsPayload = null;
  app.connection = "restricted";
  const root = app.element?.[0] ?? app.element;
  root?.replaceChildren?.();
  releaseWorkspaceApp(app);
  try {
    await app.close();
  } catch {
    // Datos, referencia y DOM ya están revocados aunque Foundry no cierre.
  }
}

function esAppV2() {
  return Boolean(foundry.applications?.api?.ApplicationV2);
}

function raizDe(app) {
  return app?.element?.[0] ?? app?.element ?? null;
}

// Un refresco no forzado solo es seguro si la consola sigue montada y quieta:
// `rendered` puede seguir a true mientras Foundry desmonta el elemento o
// mientras un _render asíncrono anterior sigue en vuelo, y un updateUser en ese
// hueco reproduce el TypeError de #263. La apertura usa force=true.
function puedeRefrescar(app) {
  if (!app.rendered) return false;
  if (globalThis.document && !raizDe(app)?.isConnected) return false;
  const estados = globalThis.Application?.RENDER_STATES;
  return !(estados && app._state === estados.RENDERING);
}

function renderWorkspace(force = false) {
  const app = workspaceApp;
  if (!app) return;
  if (!force && !puedeRefrescar(app)) return;
  if (esAppV2()) app.render({ force: true });
  else app.render(force);
}

function workspaceAppClass() {
  return foundry.applications?.api?.ApplicationV2 ? createV2Class() : createV1Class();
}

function bridgeClient() {
  return new BridgeClient({
    url: game.settings.get(configuredModuleId, "bridgeUrl"),
    token: getBridgeToken(),
  });
}

// Etiquetas del delta. Se resuelven aquí y no en la plantilla para no depender
// de un helper de Handlebars que puede no existir en todas las versiones de
// Foundry, y para que un booleano (escudos) se lea como palabra y no como
// «true».
function etiquetarOrden(orden) {
  if (!orden) return null;
  const texto = (valor) => {
    if (valor === null || valor === undefined) return "—";
    if (typeof valor === "boolean") {
      return game.i18n.localize(valor ? "LAGUNAK.Espacios.Activos" : "LAGUNAK.Espacios.Inactivos");
    }
    // Un rumbo con seis decimales no se lee: la consola redondea a lo que una
    // persona puede comparar de un vistazo.
    return String(Math.round(valor * 100) / 100);
  };
  return {
    ...orden,
    estadoLabel: game.i18n.localize(`LAGUNAK.Espacios.Orden.Estado.${orden.estado}`),
    ordenadoLabel: texto(orden.ordenado),
    realLabel: texto(orden.real),
  };
}

function workspaceContext(app) {
  let station = null;
  try {
    station = stationForWorkspace({
      user: game.user,
      moduleId: configuredModuleId,
      previewStation: app.previewStation,
    });
  } catch {
    station = null;
  }

  // Se guarda el modelo del último render para que el pintor del casco lo tenga
  // al enganchar el DOM: la plantilla ya se ha resuelto para entonces y el
  // contexto no llega a `_onRender`.
  app.ultimoModelo = buildWorkspaceModel({
    station,
    isGM: Boolean(game.user?.isGM),
    users: game.users,
    moduleId: configuredModuleId,
    i18n: game.i18n,
    statePayload: app.statePayload,
    contactsPayload: app.contactsPayload,
    contactosProyectados: app.contactosProyectados,
    connection: app.connection,
    error: app.error,
  });
  // Delta ordenado/real de la última orden de este puesto. La mitad izquierda
  // sale del acuse del GM y la derecha de la telemetría, que desde #331 llega a
  // toda la tripulación: sin aquello, esto no existiría para quien lo necesita.
  app.ultimoModelo.orden = etiquetarOrden(
    estadoOrden({ acuse: app.ultimoAcuse, ship: app.ultimoModelo.ship }),
  );
  return app.ultimoModelo;
}

async function refreshTelemetry(app) {
  if (!game.user?.isGM || app.loading || app.closed) return false;
  app.loading = true;
  app.connection = "loading";
  app.error = "";
  renderWorkspace();

  try {
    const client = bridgeClient();
    const [statePayload, contactsPayload] = await Promise.all([
      client.state(),
      client.contacts(),
    ]);
    if (app.closed || !game.user?.isGM) return false;
    app.statePayload = statePayload;
    app.contactsPayload = contactsPayload;
    app.connection = "ok";
    // La tripulación no puede sondear el puente —no tiene token— así que el GM
    // reparte lo que acaba de recibir (#331). Solo la nave propia: los contactos
    // se quedan aquí hasta que se abran degradados.
    difundirTelemetria({
      statePayload,
      contactsPayload,
      emitir: (sobre) => game.socket?.emit(canalTelemetria(configuredModuleId), sobre),
    });
    return true;
  } catch (error) {
    if (app.closed) return false;
    app.connection = "error";
    app.error = error instanceof BridgeError
      ? error.message
      : game.i18n.localize("LAGUNAK.Errores.Desconocido");
    return false;
  } finally {
    app.loading = false;
    if (!app.closed) renderWorkspace();
  }
}

function actionFromEvent(event) {
  return event?.currentTarget?.dataset?.workspaceAction ?? null;
}

function stationFromEvent(event) {
  return event?.currentTarget?.dataset?.station ?? null;
}

function submitStationOrder(app, spec) {
  const root = app.element?.[0] ?? app.element;
  const params = spec.read(root);
  if (!params) {
    ui.notifications?.warn?.(game.i18n.localize(spec.invalidKey));
    return;
  }
  emitWorkspaceOrder({ action: spec.action, params });
  // «Enviada» es un estado real y se pinta como tal: entre emitir y que el GM
  // conteste hay un viaje de ida y vuelta, y una consola que no dice nada en ese
  // hueco parece rota.
  app.ultimoAcuse = { accion: spec.action, params, estado: "enviada", codigo: null };
  renderWorkspace();
  ui.notifications?.info?.(game.i18n.localize("LAGUNAK.Espacios.Orden.Enviada"));
}

async function handleWorkspaceAction(app, event) {
  const action = actionFromEvent(event);
  if (action === "refresh") return refreshTelemetry(app);
  if (action === "assignments") return openStationApp();
  if (ORDER_FORMS[action]) return submitStationOrder(app, ORDER_FORMS[action]);
  if (action === "preview" && game.user?.isGM) {
    app.setPreviewStation(stationFromEvent(event));
    renderWorkspace();
  }
  return undefined;
}

// Casco propio en 3D (#362, rebanada 3).
//
// Se pinta UNA vez por render y no en un bucle: el rumbo solo cambia cuando
// llega telemetría, y la telemetría ya provoca un render. Un bucle de animación
// aquí gastaría fotogramas para repetir el mismo dibujo, y habría que acordarse
// de pararlo al cerrar.
//
// Y no gira por decorar. Sin lectura de rumbo la nave se queda QUIETA, con la
// misma regla que los iconos de sistema (#353): ausencia no es cero. Un casco
// girando alegremente en el puente mientras la nave real mantiene el rumbo sería
// una mentira pequeña, pero en una consola de mando no hay mentiras pequeñas.
const MALLA_PROPIA = mallaDesdeCasco(CASCO_POR_DEFECTO);

function pintarCascoPropio(root, modelo) {
  const lienzo = root?.querySelector?.("[data-lagunak-casco]");
  if (!lienzo) return null;
  const rumbo = modelo?.cascoRumbo;
  const hayLectura = Number.isFinite(rumbo);
  return pintarNave(lienzo, {
    malla: MALLA_PROPIA,
    // La nave propia lleva el crema reservado del mapa vivo: es la misma nave y
    // se toma de la paleta, no se elige aquí.
    color: hayLectura ? PIXEL.naveJugador : PIXEL.sinFaccion,
    // Rumbo del mundo a giro del visor. Sin lectura, morro al frente y quieta.
    yaw: hayLectura ? (rumbo * Math.PI) / 180 : 0,
    pitch: 0.42,
    posicion: [0, 0, 4.4],
    fov: 55,
  });
}

function bindWorkspaceRoot(root, app) {
  root?.querySelectorAll?.("[data-workspace-action]").forEach((element) => {
    element.addEventListener("click", (event) => handleWorkspaceAction(app, event));
  });
  pintarCascoPropio(root, app.ultimoModelo);
}

function initialiseApp(app) {
  app.previewStation = null;
  app.statePayload = null;
  app.contactsPayload = null;
  // La tripulación ya no está «restringida»: espera la difusión del GM. Si no
  // llega —porque no hay GM conectado o su puente está caído— se queda en espera
  // y lo dice, que es distinto de «no tienes permiso».
  app.connection = "loading";
  app.selloTelemetria = null;
  app.ultimoAcuse = null;
  app.contactosProyectados = [];
  app.error = "";
  app.loading = false;
  app.closed = false;
  app.ultimoModelo = null;
}

function releaseWorkspaceApp(app) {
  app.closed = true;
  if (workspaceApp === app) workspaceApp = null;
}

function createV2Class() {
  const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
  return class StationWorkspaceV2 extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "lagunak-espacio-puesto",
      classes: ["lagunak-workspace"],
      window: {
        title: "LAGUNAK.Espacios.Titulo",
        icon: "fa-solid fa-display",
      },
      position: { width: 860, height: 680 },
    };

    static PARTS = {
      main: { template: `modules/${configuredModuleId}/templates/espacio-puesto.hbs` },
    };

    constructor(...args) {
      super(...args);
      initialiseApp(this);
    }

    setPreviewStation(station) {
      this.previewStation = station;
    }

    async refreshTelemetry() {
      return refreshTelemetry(this);
    }

    async _prepareContext() {
      return workspaceContext(this);
    }

    _onFirstRender(context, options) {
      super._onFirstRender?.(context, options);
      if (game.user?.isGM) this.refreshTelemetry();
    }

    _onRender(context, options) {
      super._onRender?.(context, options);
      bindWorkspaceRoot(this.element, this);
    }

    _onClose(options) {
      releaseWorkspaceApp(this);
      super._onClose?.(options);
    }
  };
}

function createV1Class() {
  return class StationWorkspaceV1 extends Application {
    constructor(...args) {
      super(...args);
      initialiseApp(this);
      this.started = false;
    }

    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "lagunak-espacio-puesto",
        classes: ["lagunak-workspace"],
        template: `modules/${configuredModuleId}/templates/espacio-puesto.hbs`,
        width: 860,
        height: 680,
        resizable: true,
      });
    }

    get title() {
      return game.i18n.localize("LAGUNAK.Espacios.Titulo");
    }

    setPreviewStation(station) {
      this.previewStation = station;
    }

    async refreshTelemetry() {
      return refreshTelemetry(this);
    }

    getData() {
      return workspaceContext(this);
    }

    async _render(force, options) {
      await super._render(force, options);
      if (!this.started && game.user?.isGM) {
        this.started = true;
        this.refreshTelemetry();
      }
    }

    /**
     * El mismo updateUser que re-renderiza esta consola también puede
     * revocarla (main.mjs cierra el workspace al cambiar de puesto). Como el
     * _render de Foundry V1 es asíncrono, _replaceHTML puede llegar con el
     * elemento ya desmontado o nulo y revienta con «can't access property
     * "hasChildNodes"» (#263). Si el DOM ya no está, no hay nada que
     * reemplazar: el siguiente render con force lo reconstruye entero.
     */
    _replaceHTML(element, html) {
      const nodo = element?.[0] ?? element;
      if (!nodo?.isConnected) return;
      // revokeWorkspaceAccess vacía el elemento ENTERO (replaceChildren), así
      // que puede seguir conectado pero sin esqueleto de ventana. El
      // _replaceHTML de Foundry v11 hace `.find(".window-title")[0].hasChildNodes()`
      // sin comprobar nada: sin cabecera, revienta. Aquí solo se protege; la
      // reconstrucción la hace renderWorkspace ANTES de renderizar, porque
      // re-entrar en render() desde dentro deja al _render externo llamando a
      // setPosition con el elemento ya sustituido.
      if (!nodo.querySelector?.(".window-title")) return;
      super._replaceHTML(element, html);
    }

    activateListeners(html) {
      super.activateListeners(html);
      html.find("[data-workspace-action]").on("click", (event) => handleWorkspaceAction(this, event));
      pintarCascoPropio(raizDe(this), this.ultimoModelo);
    }

    async close(options) {
      releaseWorkspaceApp(this);
      return super.close(options);
    }
  };
}
