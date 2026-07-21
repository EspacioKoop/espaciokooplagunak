import { BridgeClient } from "./bridge-client.mjs";
import { getBridgeToken } from "./bridge-token-session.mjs";
import { normalizeStation } from "./station-assignment.mjs";
import {
  STATION_ORDER_FLAG,
  buildStationOrder,
  dispatchUserUpdate,
} from "./station-order-relay.mjs";

// Cableado Foundry del relé de órdenes por puesto. Capa fina y no testeable en
// Node (usa globales de Foundry): toda la lógica de autoridad vive en los
// módulos puros station-actions.mjs / station-order-relay.mjs, ya cubiertos por
// pruebas. Aquí solo conectamos el hook updateUser, resolvemos el puesto del
// emisor y proveemos un puente con token fresco.
//
// Transporte: el tripulante deja su orden en un flag de SU PROPIO documento User
// (Foundry impide server-side escribir el documento de otro; ver
// station-order-relay.mjs). El GM la recoge en el hook updateUser, donde el
// documento que cambió ES la identidad autenticada del emisor. Así ningún
// cliente puede declarar el userId de otro puesto ni suplantarlo.

let configuredModuleId = null;
let unregister = () => {};

// El GM resuelve el puesto por identidad del emisor (su flag), nunca por la
// orden. Un userId sin puesto válido devuelve null y la orden se rechaza.
function resolveUserStation(moduleId) {
  return (userId) => {
    try {
      return normalizeStation(game.users?.get(userId)?.getFlag(moduleId, "station") ?? null);
    } catch {
      return null;
    }
  };
}

// Puente perezoso: cada método construye un BridgeClient con el token vigente
// del GM en el momento de la orden. Si el acceso está revocado, el token es
// nulo y la petición falla cerrada (401) sin cablearlo aquí.
function lazyBridge(moduleId) {
  return new Proxy({}, {
    get(_target, method) {
      return (...args) => {
        const client = new BridgeClient({
          url: game.settings.get(moduleId, "bridgeUrl"),
          token: getBridgeToken(),
        });
        return client[method](...args);
      };
    },
  });
}

// Registra el manejador GM del relé sobre el hook updateUser. En clientes de
// tripulación es no-op: solo escriben su propio flag. Idempotente — vuelve a
// registrar si se llama de nuevo (p. ej. tras cambiar el rol GM).
export function registerStationOrders(moduleId) {
  configuredModuleId = moduleId;
  unregister();
  if (!game.user?.isGM) {
    unregister = () => {};
    return;
  }
  const resolveStation = resolveUserStation(moduleId);
  const bridge = lazyBridge(moduleId);
  const listener = (userDoc, changes) => {
    dispatchUserUpdate({
      userDoc,
      changes,
      moduleId,
      resolveUserStation: resolveStation,
      bridge,
      // Con varios GM conectados, todos reciben el hook; solo el GM primario
      // ejecuta la orden (evita mandarla N veces al puente). Se evalúa por
      // orden, así que si el primario cambia (desconexión), el relevo pasa solo.
      canHandle: () => game.user === game.users?.activeGM,
      onResult: () => {
        ui.notifications?.info?.(game.i18n.localize("LAGUNAK.Espacios.Orden.Aplicada"));
      },
      onError: () => {
        ui.notifications?.warn?.(game.i18n.localize("LAGUNAK.Espacios.Orden.Rechazada"));
      },
    });
  };
  Hooks.on("updateUser", listener);
  unregister = () => Hooks.off("updateUser", listener);
}

// Lado tripulante: emite una orden del puesto actual escribiéndola en su propio
// flag. No declara el puesto —lo resuelve el GM— solo la acción y parámetros. El
// nonce garantiza que dos órdenes idénticas seguidas disparen updateUser dos
// veces. Devuelve la promesa de setFlag para poder encadenar/observar.
export function emitWorkspaceOrder({ action, params }) {
  if (!configuredModuleId) return undefined;
  const order = buildStationOrder({
    action,
    params,
    nonce: foundry.utils.randomID(),
  });
  return game.user?.setFlag(configuredModuleId, STATION_ORDER_FLAG, order);
}
