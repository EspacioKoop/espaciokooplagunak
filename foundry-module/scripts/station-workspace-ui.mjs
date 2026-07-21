import { BridgeClient, BridgeError } from "./bridge-client.mjs";
import { getBridgeToken } from "./bridge-token-session.mjs";
import { openStationApp } from "./station-ui.mjs";
import { buildWorkspaceModel, stationForWorkspace } from "./station-workspaces.mjs";
import { emitWorkspaceOrder } from "./station-order-wiring.mjs";

let configuredModuleId = null;
let workspaceApp = null;

export function registerWorkspaceFeature(moduleId) {
  configuredModuleId = moduleId;
  Hooks.on("updateUser", () => renderWorkspace());
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

function renderWorkspace(force = false) {
  if (!workspaceApp) return;
  if (foundry.applications?.api?.ApplicationV2) {
    workspaceApp.render({ force: true });
  } else {
    workspaceApp.render(force);
  }
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

  return buildWorkspaceModel({
    station,
    isGM: Boolean(game.user?.isGM),
    users: game.users,
    moduleId: configuredModuleId,
    i18n: game.i18n,
    statePayload: app.statePayload,
    contactsPayload: app.contactsPayload,
    connection: app.connection,
    error: app.error,
  });
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

// Valida el rumbo introducido por el tripulante antes de emitir la orden.
// Devuelve el grado normalizado o `null` si es inválido. Rechaza ausencia y
// cadena vacía/espacios ANTES de convertir: `Number("")` es 0 y colaría como
// una orden real a rumbo 0 en vez de avisar. El cero explícito sí es válido.
export function parseHeadingValue(raw) {
  if (raw === undefined || raw === null) return null;
  const texto = String(raw).trim();
  if (texto === "") return null;
  const heading = Number(texto);
  if (!Number.isFinite(heading) || heading < 0 || heading >= 360) return null;
  return heading;
}

function submitHeadingOrder(app) {
  const root = app.element?.[0] ?? app.element;
  const input = root?.querySelector?.("#lagunak-orden-rumbo");
  const heading = parseHeadingValue(input?.value);
  if (heading === null) {
    ui.notifications?.warn?.(game.i18n.localize("LAGUNAK.Espacios.Orden.RumboInvalido"));
    return;
  }
  emitWorkspaceOrder({ action: "set_target_heading", params: { heading } });
  ui.notifications?.info?.(game.i18n.localize("LAGUNAK.Espacios.Orden.Enviada"));
}

async function handleWorkspaceAction(app, event) {
  const action = actionFromEvent(event);
  if (action === "refresh") return refreshTelemetry(app);
  if (action === "assignments") return openStationApp();
  if (action === "orden-rumbo") return submitHeadingOrder(app);
  if (action === "preview" && game.user?.isGM) {
    app.setPreviewStation(stationFromEvent(event));
    renderWorkspace();
  }
  return undefined;
}

function bindWorkspaceRoot(root, app) {
  root?.querySelectorAll?.("[data-workspace-action]").forEach((element) => {
    element.addEventListener("click", (event) => handleWorkspaceAction(app, event));
  });
}

function initialiseApp(app) {
  app.previewStation = null;
  app.statePayload = null;
  app.contactsPayload = null;
  app.connection = game.user?.isGM ? "loading" : "restricted";
  app.error = "";
  app.loading = false;
  app.closed = false;
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

    activateListeners(html) {
      super.activateListeners(html);
      html.find("[data-workspace-action]").on("click", (event) => handleWorkspaceAction(this, event));
    }

    async close(options) {
      releaseWorkspaceApp(this);
      return super.close(options);
    }
  };
}
