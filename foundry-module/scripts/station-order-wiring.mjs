import { BridgeClient } from "./bridge-client.mjs";
import { getBridgeToken } from "./bridge-token-session.mjs";
import { normalizeStation } from "./station-assignment.mjs";
import { emitStationOrder, registerStationOrderHandler } from "./station-order-relay.mjs";

// Cableado Foundry del relé de órdenes por puesto. Capa fina y no testeable en
// Node (usa globales de Foundry): toda la lógica de autoridad vive en los
// módulos puros station-actions.mjs / station-order-relay.mjs, ya cubiertos por
// pruebas. Aquí solo adaptamos el socket del módulo, resolvemos el puesto del
// emisor y proveemos un puente con token fresco.

let configuredModuleId = null;
let unregister = () => {};

// Adaptador del socket del módulo: el relé habla en términos de un evento
// lógico; Foundry exige el canal `module.<id>`. El tipo real viaja dentro del
// payload (lo comprueba el manejador), así que un único canal basta.
function moduleSocket(moduleId) {
  const channel = `module.${moduleId}`;
  return {
    emit: (_event, payload) => game.socket.emit(channel, payload),
    on: (_event, fn) => game.socket.on(channel, fn),
    off: (_event, fn) => game.socket.off?.(channel, fn),
  };
}

// El GM resuelve el puesto por identidad del emisor (su flag), nunca por el
// payload. Un userId sin puesto válido devuelve null y la orden se rechaza.
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

// Registra el manejador GM del relé. En clientes de tripulación es no-op: solo
// emiten. Idempotente — vuelve a registrar si se llama de nuevo (p. ej. tras
// cambiar el rol GM).
export function registerStationOrders(moduleId) {
  configuredModuleId = moduleId;
  unregister();
  unregister = registerStationOrderHandler({
    socket: moduleSocket(moduleId),
    isGM: Boolean(game.user?.isGM),
    resolveUserStation: resolveUserStation(moduleId),
    bridge: lazyBridge(moduleId),
    onResult: () => {
      ui.notifications?.info?.(game.i18n.localize("LAGUNAK.Espacios.Orden.Aplicada"));
    },
    onError: () => {
      ui.notifications?.warn?.(game.i18n.localize("LAGUNAK.Espacios.Orden.Rechazada"));
    },
  });
}

// Lado tripulante: emite una orden del puesto actual. No declara el puesto —lo
// resuelve el GM— solo la acción y sus parámetros.
export function emitWorkspaceOrder({ action, params }) {
  if (!configuredModuleId) return;
  emitStationOrder({
    socket: moduleSocket(configuredModuleId),
    userId: game.user?.id,
    action,
    params,
  });
}
