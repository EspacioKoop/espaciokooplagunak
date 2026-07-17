import { BridgeClient, BridgeError } from "./bridge-client.mjs";
import { getBridgeToken } from "./bridge-token-session.mjs";
import { openStationApp } from "./station-ui.mjs";
import { buildWorkspaceModel, stationForWorkspace } from "./station-workspaces.mjs";

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
    const tokenControls = controls.find?.((group) => group.name === "token");
    if (tokenControls) tokenControls.tools.push(tool);
    return;
  }

  const group = controls?.tokens ?? controls?.token;
  if (group?.tools && !Array.isArray(group.tools)) {
    group.tools[tool.name] = { ...tool, onChange: tool.onClick };
  }
}

export function openWorkspaceApp(previewStation = null) {
  if (!configuredModuleId) return;
  workspaceApp ??= new (workspaceAppClass())();
  if (previewStation && game.user?.isGM) workspaceApp.setPreviewStation(previewStation);
  renderWorkspace(true);
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
    if (app.closed) return false;
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

async function handleWorkspaceAction(app, event) {
  const action = actionFromEvent(event);
  if (action === "refresh") return refreshTelemetry(app);
  if (action === "assignments") return openStationApp();
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
