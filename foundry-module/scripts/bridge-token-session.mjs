import { probarConexion } from "./diagnostico-conexion.mjs";

let configuredModuleId = null;
let sessionToken = "";
let tokenApp = null;
let legacyStorageCleared = false;
let legacyMigrationPromise = null;

export function registerBridgeTokenFeature(moduleId) {
  configuredModuleId = moduleId;
}

export function getBridgeToken() {
  return game.user?.isGM ? sessionToken : "";
}

export function setBridgeToken(value) {
  sessionToken = String(value ?? "").trim();
  return Boolean(sessionToken);
}

export function clearBridgeToken() {
  sessionToken = "";
}

export async function clearLegacyBridgeToken() {
  if (!configuredModuleId) return false;
  if (legacyStorageCleared) return true;
  if (legacyMigrationPromise) return legacyMigrationPromise;
  const attempt = (async () => {
    try {
      await game.settings.set(configuredModuleId, "bridgeToken", "");
      legacyStorageCleared = true;
      return true;
    } catch {
      legacyStorageCleared = false;
      ui.notifications.warn(game.i18n.localize("LAGUNAK.Token.ErrorMigracion"));
      return false;
    }
  })();
  legacyMigrationPromise = attempt;
  const result = await attempt;
  if (legacyMigrationPromise === attempt) legacyMigrationPromise = null;
  return result;
}

export async function openBridgeTokenApp() {
  if (!configuredModuleId || !game.user?.isGM) return null;
  if (!legacyStorageCleared && !(await clearLegacyBridgeToken())) return null;
  tokenApp ??= new (tokenAppClass())();
  try {
    if (foundry.applications?.api?.ApplicationV2) {
      await tokenApp.render({ force: true });
    } else {
      tokenApp.render(true);
    }
  } catch {
    const failedApp = tokenApp;
    clearBridgeToken();
    if (failedApp) {
      failedApp.bridgeAccessRevoked = true;
      wipeTokenInput(failedApp);
      try {
        await failedApp.close();
      } catch {
        // La instancia queda revocada y sin secreto aunque Foundry no cierre.
      }
      releaseTokenApp(failedApp);
    }
    ui.notifications.error(game.i18n.localize("LAGUNAK.Token.ErrorVentana"));
    return null;
  }
  return tokenApp;
}

export async function revokeBridgeTokenAccess() {
  // When revoking, clear the secret and mark the current app
  // instance as revoked so that subsequent saves from this app are
  // no-ops. This implements behavior 1 and 2 from the task.
  clearBridgeToken();
  const app = tokenApp;
  if (!app) return;
  app.bridgeAccessRevoked = true;
  await closeTokenAppSafely(app);
}

function wipeTokenInput(app) {
  const root = app.element;
  const input = root?.querySelector?.('[name="bridge-token"]')
    ?? root?.find?.('[name="bridge-token"]')?.[0];
  if (input) input.value = "";
}

async function closeTokenAppSafely(app, { rollbackToken = false } = {}) {
  wipeTokenInput(app);
  try {
    await app.close();
    return true;
  } catch {
    if (rollbackToken) clearBridgeToken();
    ui.notifications.warn(game.i18n.localize("LAGUNAK.Token.ErrorCierre"));
    return false;
  }
}

function tokenAppClass() {
  return foundry.applications?.api?.ApplicationV2 ? createV2Class() : createV1Class();
}

function releaseTokenApp(app) {
  if (tokenApp === app) tokenApp = null;
}

function context() {
  return { configured: Boolean(sessionToken) };
}

/**
 * Guarda el token y, en el mismo gesto, dispara el diagnóstico de conexión
 * (issue #289: antes eran dos herramientas separadas — guardar no
 * comprobaba nada, y probar la conexión vivía aparte). El resultado
 * reemplaza la notificación genérica "Token configurado" por el estado real
 * (ok / token inválido / puente inaccesible / …), sin exponer el token.
 */
async function saveAndClose(value, app) {
  if (app?.bridgeAccessRevoked) {
    wipeTokenInput(app);
    return;
  }
  if (!game.user?.isGM || !legacyStorageCleared) return;
  if (!setBridgeToken(value)) {
    ui.notifications.warn(game.i18n.localize("LAGUNAK.Token.Vacio"));
    return;
  }
  const savedToken = sessionToken;
  const diagnostico = await probarConexion({
    url: game.settings.get(configuredModuleId, "bridgeUrl"),
    token: savedToken,
    canUseToken: () => Boolean(game.user?.isGM) && sessionToken === savedToken,
  });
  if (!(await closeTokenAppSafely(app, { rollbackToken: true }))) return;
  const mensaje = game.i18n.localize(diagnostico.claveI18n);
  if (diagnostico.exito) ui.notifications.info(mensaje);
  else ui.notifications.warn(mensaje);
}

async function clearAndClose(app) {
  clearBridgeToken();
  if (app?.bridgeAccessRevoked) {
    wipeTokenInput(app);
    return;
  }
  if (!game.user?.isGM) return;
  if (!(await closeTokenAppSafely(app))) return;
  ui.notifications.info(game.i18n.localize("LAGUNAK.Token.Borrado"));
}

function createV2Class() {
  const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
  return class BridgeTokenAppV2 extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "lagunak-token-puente",
      classes: ["lagunak-token-puente"],
      window: {
        title: "LAGUNAK.Token.Titulo",
        icon: "fa-solid fa-key",
      },
      position: { width: 460, height: "auto" },
      actions: {
        saveToken: async function () {
          const value = this.element?.querySelector?.('[name="bridge-token"]')?.value ?? "";
          await saveAndClose(value, this);
        },
        clearToken: async function () {
          await clearAndClose(this);
        },
      },
    };

    static PARTS = {
      main: { template: `modules/${configuredModuleId}/templates/token-puente.hbs` },
    };

    async _prepareContext() {
      return context();
    }

    _onClose(options) {
      releaseTokenApp(this);
      super._onClose?.(options);
    }
  };
}

function createV1Class() {
  return class BridgeTokenAppV1 extends Application {
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "lagunak-token-puente",
        classes: ["lagunak-token-puente"],
        template: `modules/${configuredModuleId}/templates/token-puente.hbs`,
        width: 460,
        height: "auto",
        resizable: false,
      });
    }

    get title() {
      return game.i18n.localize("LAGUNAK.Token.Titulo");
    }

    getData() {
      return context();
    }

    activateListeners(html) {
      super.activateListeners(html);
      html.find('[data-action="saveToken"]').on("click", async () => {
        await saveAndClose(html.find('[name="bridge-token"]').val(), this);
      });
      html.find('[data-action="clearToken"]').on("click", async () => {
        await clearAndClose(this);
      });
    }

    async close(options) {
      const result = await super.close(options);
      releaseTokenApp(this);
      return result;
    }
  };
}
