import {
  assignStation,
  motivoRequisito,
  stationRows,
  STATION_ASSIGNMENT_ERRORS,
} from "./station-assignment.mjs";
import { caracteristicasDeActor } from "./requisitos-puesto.mjs";
import { anadirHerramienta } from "./control-escena.mjs";

let stationApp = null;
let configuredModuleId = null;

export function registerStationFeature(moduleId) {
  configuredModuleId = moduleId;
  Hooks.on("updateUser", () => refrescarPuestos());
  Hooks.on("updateSetting", (ajuste) => {
    const key = ajuste?.key;
    if (
      key === `${configuredModuleId}.requisitosPuesto` ||
      key === `${configuredModuleId}.requisitosPuestoMinimo`
    ) {
      refrescarPuestos();
    }
  });
}

/**
 * Repinta la ventana de puestos si está abierta. Es lo que hay que llamar
 * cuando cambia algo que la ventana LEE al preparar su contexto.
 *
 * Los requisitos se releen en cada render y también al guardar, así que una
 * ventana abierta con el ajuste cambiado enseñaba el estado anterior: opciones
 * que parecían permitidas y el guardado las rechazaba, u opciones deshabilitadas
 * que ya no tenían por qué estarlo y ni siquiera podían emitir el cambio. La
 * ventana tiene que seguir al ajuste, no al revés.
 */
export function refrescarPuestos() {
  if (!stationApp?.rendered) return;
  if (foundry.applications?.api?.ApplicationV2) {
    stationApp.render({ force: true });
  } else {
    stationApp.render(false);
  }
}

export function addStationControl(controls) {
  const tool = {
    name: "lagunak-puestos",
    title: "LAGUNAK.Controles.AbrirPuestos",
    icon: "fa-solid fa-users-gear",
    button: true,
    onClick: () => openStationApp(),
  };

  anadirHerramienta(controls, tool);
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
      requisitos: requisitosVigentes(),
      caracteristicasDe: caracteristicasDeUsuario,
    }),
  };
}

// Configuración vigente de requisitos, leída de los ajustes de mundo. Se lee en
// cada uso y no se guarda: el GM puede activarla o cambiar el mínimo con la
// ventana abierta, y quedarse con la regla anterior sería confuso.
function requisitosVigentes() {
  // Si el ajuste todavía no está registrado, `settings.get` lanza. El fallo
  // seguro es APAGADO: una regla opcional que no se puede leer no debe impedir
  // que nadie ocupe su puesto.
  try {
    return {
      activo: Boolean(game.settings?.get(configuredModuleId, "requisitosPuesto")),
      minimo: game.settings?.get(configuredModuleId, "requisitosPuestoMinimo"),
    };
  } catch {
    return { activo: false };
  }
}

// Las características salen del personaje ASIGNADO al usuario, no del token
// seleccionado: el puesto lo ocupa la persona, y su token puede no estar en la
// escena o no ser suyo.
function caracteristicasDeUsuario(user) {
  return caracteristicasDeActor(user?.character);
}

async function onStationChange(event) {
  const select = event.currentTarget;
  const target = game.users.get(select.dataset.userId);
  if (!target) return;
  const previousStation = target.getFlag(configuredModuleId, "station") ?? "";

  try {
    await assignStation({
      actor: game.user,
      target,
      station: select.value,
      moduleId: configuredModuleId,
      requisitos: requisitosVigentes(),
      caracteristicas: caracteristicasDeUsuario(target),
    });
    ui.notifications.info(game.i18n.localize("LAGUNAK.Puestos.Guardado"));
  } catch (error) {
    select.value = previousStation;
    // El requisito incumplido se explica con su motivo concreto: decir solo «no
    // se pudo guardar» dejaría a quien lo intenta sin saber qué le falta.
    if (error?.code === STATION_ASSIGNMENT_ERRORS.REQUISITO) {
      ui.notifications.warn(motivoRequisito(error.veredicto, game.i18n));
      return;
    }
    const key = error?.code === STATION_ASSIGNMENT_ERRORS.NOT_ALLOWED
      ? "LAGUNAK.Puestos.NoPermitido"
      : "LAGUNAK.Puestos.ErrorGuardado";
    ui.notifications.error(game.i18n.localize(key));
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
