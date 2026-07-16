import { assignStation, stationRows } from "./station-assignment.mjs";

let stationApp = null;
let configuredModuleId = null;

export function registerStationFeature(moduleId) {
  configuredModuleId = moduleId;
  Hooks.on("updateUser", () => {
    if (!stationApp?.rendered) return;
    if (foundry.applications?.api?.ApplicationV2) {
      stationApp.render({ force: true });
    } else {
      stationApp.render(false);
    }
  });
}

export function addStationControl(controls) {
  const tool = {
    name: "lagunak-puestos",
    title: "LAGUNAK.Controles.AbrirPuestos",
    icon: "fa-solid fa-users-gear",
    button: true,
    onClick: () => openStationApp(),
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

export function openStationApp() {
  if (!configuredModuleId) return;
  stationApp ??= new (stationAppClass())();
  if (foundry.applications?.api?.ApplicationV2) {
    stationApp.render({ force: true });
  } else {
    stationApp.render(true);
  }
}

function stationAppClass() {
  return foundry.applications?.api?.ApplicationV2 ? createV2Class() : createV1Class();
}

function context() {
  return {
    isGM: Boolean(game.user?.isGM),
    crew: stationRows({
      users: game.users,
      actor: game.user,
      moduleId: configuredModuleId,
      i18n: game.i18n,
    }),
  };
}

async function onStationChange(event) {
  const select = event.currentTarget;
  const target = game.users.get(select.dataset.userId);
  if (!target) return;

  try {
    await assignStation({
      actor: game.user,
      target,
      station: select.value,
      moduleId: configuredModuleId,
    });
    ui.notifications.info(game.i18n.localize("LAGUNAK.Puestos.Guardado"));
  } catch (_error) {
    ui.notifications.error(game.i18n.localize("LAGUNAK.Puestos.NoPermitido"));
  }
}

function bindSelects(root) {
  root?.querySelectorAll?.("[data-station-user]").forEach((select) => {
    select.addEventListener("change", onStationChange);
  });
}

function createV2Class() {
  const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
  return class StationAppV2 extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "lagunak-puestos-tripulacion",
      classes: ["lagunak-puestos"],
      window: {
        title: "LAGUNAK.Puestos.Titulo",
        icon: "fa-solid fa-users-gear",
      },
      position: { width: 480, height: "auto" },
    };

    static PARTS = {
      main: { template: `modules/${configuredModuleId}/templates/puestos-tripulacion.hbs` },
    };

    async _prepareContext() {
      return context();
    }

    _onRender(contextData, options) {
      super._onRender?.(contextData, options);
      bindSelects(this.element);
    }
  };
}

function createV1Class() {
  return class StationAppV1 extends Application {
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "lagunak-puestos-tripulacion",
        classes: ["lagunak-puestos"],
        template: `modules/${configuredModuleId}/templates/puestos-tripulacion.hbs`,
        width: 480,
        height: "auto",
        resizable: true,
      });
    }

    get title() {
      return game.i18n.localize("LAGUNAK.Puestos.Titulo");
    }

    getData() {
      return context();
    }

    activateListeners(html) {
      super.activateListeners(html);
      html.find("[data-station-user]").on("change", onStationChange);
    }
  };
}
