import { BridgeClient, BridgeError } from "./bridge-client.mjs";
import { getBridgeToken } from "./bridge-token-session.mjs";
import { openStationApp } from "./station-ui.mjs";
import { buildWorkspaceModel, stationForWorkspace } from "./station-workspaces.mjs";
import { emitWorkspaceOrder } from "./station-order-wiring.mjs";
import { esSistemaValido, esNivelValido } from "./ingenieria-control.mjs";

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

function numberFrom(root, id) {
  return Number(root?.querySelector?.(`#${id}`)?.value);
}

// Orden de un único campo numérico: valida y devuelve los parámetros o null.
function numericOrder(inputId, param, valid) {
  return (root) => {
    const value = numberFrom(root, inputId);
    return valid(value) ? { [param]: value } : null;
  };
}

// Formularios de orden de puesto: cada acción de UI declara cómo LEE sus
// parámetros del DOM (devolviendo el objeto de params o null si es inválido),
// a qué acción del contrato los emite y qué aviso mostrar si no validan. La
// validación aquí es cortesía de UX; el puente revalida rangos igualmente.
const ORDER_FORMS = Object.freeze({
  "orden-rumbo": {
    action: "set_target_heading",
    read: numericOrder("lagunak-orden-rumbo", "heading", (n) => Number.isFinite(n) && n >= 0 && n < 360),
    invalidKey: "LAGUNAK.Espacios.Orden.RumboInvalido",
  },
  "orden-impulso": {
    action: "set_impulse",
    read: numericOrder("lagunak-orden-impulso", "value", (n) => Number.isFinite(n) && n >= -1 && n <= 1),
    invalidKey: "LAGUNAK.Espacios.Orden.ImpulsoInvalido",
  },
  "orden-warp": {
    action: "set_warp",
    read: numericOrder("lagunak-orden-warp", "level", (n) => Number.isInteger(n) && n >= 0 && n <= 4),
    invalidKey: "LAGUNAK.Espacios.Orden.WarpInvalido",
  },
  "orden-potencia": {
    action: "set_system_power",
    read: (root) => {
      const system = root?.querySelector?.("#lagunak-orden-sistema")?.value ?? "";
      const level = numberFrom(root, "lagunak-orden-nivel");
      return esSistemaValido(system) && esNivelValido(level) ? { system, level } : null;
    },
    invalidKey: "LAGUNAK.Espacios.Orden.PotenciaInvalida",
  },
  // Escudos: dos acciones con valor fijo (no leen del DOM) que comparten la
  // orden set_shields con `active` true/false.
  "orden-escudos-subir": {
    action: "set_shields",
    read: () => ({ active: true }),
    invalidKey: "LAGUNAK.Espacios.Orden.EscudosInvalido",
  },
  "orden-escudos-bajar": {
    action: "set_shields",
    read: () => ({ active: false }),
    invalidKey: "LAGUNAK.Espacios.Orden.EscudosInvalido",
  },
});

function submitStationOrder(app, spec) {
  const root = app.element?.[0] ?? app.element;
  const params = spec.read(root);
  if (!params) {
    ui.notifications?.warn?.(game.i18n.localize(spec.invalidKey));
    return;
  }
  emitWorkspaceOrder({ action: spec.action, params });
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
