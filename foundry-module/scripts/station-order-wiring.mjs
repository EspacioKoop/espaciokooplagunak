import { BridgeClient } from "./bridge-client.mjs";
import { getBridgeToken } from "./bridge-token-session.mjs";
import { normalizeStation } from "./station-assignment.mjs";
import { prepararOrdenConAsistencia } from "./asistencia-wiring.mjs";
import { RELEVO_AVISOS } from "./asistencia/relevo.mjs";
import { resolverObjetivoEscaneo } from "./resolver-objetivo-sensores.mjs";
import {
  STATION_ORDER_FLAG,
  buildStationOrder,
  dispatchUserUpdate,
} from "./station-order-relay.mjs";

// Aviso propio (no de asistencia): la lectura degradada que el jugador
// seleccionó no encajó con ningún contacto real del sondeo del GM en el
// momento de resolver la orden -pudo salir de alcance, o el margen del
// sensor era tan grueso que no hay un único candidato defendible-.
export const ESCANEO_AVISOS = Object.freeze({
  OBJETIVO_NO_ENCONTRADO: "objetivo-no-encontrado",
});

// Acciones cuyo `params` de partida es una LECTURA degradada
// (distancia/rumboDeg/precision/rumboPrecision), no un indicativo: sensores
// (#462) y armas (#465) comparten exactamente el mismo problema —un eco sin
// escanear no tiene indicativo que el jugador pueda conocer— y la misma
// resolución. `fire_tube` conserva el resto de sus params (`index`) al
// sustituir la lectura por el indicativo resuelto.
const ACCIONES_CON_OBJETIVO_POR_LECTURA = new Set(["scan_object", "set_weapon_target", "fire_tube"]);

// Resuelve una orden de objetivo-por-lectura a indicativo real ANTES de que
// llegue a `resolveStationOrder` (#462/#465). No es una puerta de autoridad:
// el puesto y la acción ya se resolvieron por identidad; esto solo traduce
// qué CONTACTO señalaba el jugador, con el sondeo sin degradar que solo el GM
// tiene (`bridge.state()` para la posición propia, `bridge.contacts()` para
// el crudo). Cualquier otra acción pasa intacta.
async function resolverOrdenDeEscaneo({ order, bridge }) {
  if (!ACCIONES_CON_OBJETIVO_POR_LECTURA.has(order?.action)) return { orden: order };
  const { distancia, rumboDeg, precision, rumboPrecision, ...resto } = order.params ?? {};
  const [statePayload, contactsPayload] = await Promise.all([bridge.state(), bridge.contacts()]);
  const callsign = resolverObjetivoEscaneo({
    contactsPayload,
    centro: statePayload?.ship?.position ?? null,
    lectura: { distancia, rumboDeg, precision, rumboPrecision },
  });
  if (!callsign) {
    return { orden: order, aviso: ESCANEO_AVISOS.OBJETIVO_NO_ENCONTRADO };
  }
  return { orden: { ...order, params: { callsign, ...resto } } };
}

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
      // Donde se cobra una ayuda (#309), y el único sitio donde se cobra. La
      // asistencia no tiene vía propia al puente: se cuelga de la orden que el
      // titular ya iba a emitir, bajo su identidad, y como mucho mueve el
      // parámetro dentro del rango que esa orden ya permitía. Si la ayuda
      // caducó o no era de su puesto, la orden sale igual sin mejorar: la
      // asistencia es sal, no un peaje.
      //
      // El escaneo (#462) se resuelve PRIMERO: traduce rumbo/distancia a
      // indicativo real antes de que la asistencia mueva nada dentro de la
      // orden ya resuelta. Para cualquier acción que no sea `scan_object`,
      // `resolverOrdenDeEscaneo` es un paso transparente.
      prepareOrder: ({ userId, order }) =>
        resolverOrdenDeEscaneo({ order, bridge }).then(({ orden, aviso: avisoEscaneo }) => {
          const { orden: ordenFinal, aviso: avisoAsistencia } = prepararOrdenConAsistencia({
            userId,
            order: orden,
          });
          return { orden: ordenFinal, aviso: avisoEscaneo ?? avisoAsistencia };
        }),
      onResult: (_result, { aviso } = {}) => {
        if (aviso === RELEVO_AVISOS.ASISTENCIA_NO_APLICADA) {
          ui.notifications?.warn?.(game.i18n.localize("LAGUNAK.Asistencia.NoAplicada"));
        }
        ui.notifications?.info?.(game.i18n.localize("LAGUNAK.Espacios.Orden.Aplicada"));
      },
      // Sin objetivo resuelto, `resolverOrdenDeEscaneo` deja pasar la orden
      // sin `callsign`: el puente la rechaza (BridgeError, "debe ser una
      // cadena") y llega aquí, no a `onResult` — de ahí el mensaje específico
      // en vez del genérico de "Rechazada" para estas acciones en concreto.
      onError: (_error, { order } = {}) => {
        const clave = ACCIONES_CON_OBJETIVO_POR_LECTURA.has(order?.action) && !order?.params?.callsign
          ? "LAGUNAK.Espacios.Orden.ObjetivoNoEncontrado"
          : "LAGUNAK.Espacios.Orden.Rechazada";
        ui.notifications?.warn?.(game.i18n.localize(clave));
      },
      // #483: el emisor cambió de puesto mientras la orden esperaba a
      // procesarse. Aviso propio, distinto de "Rechazada": no es que el
      // puente la rechazara, es que ya no hay identidad bajo la que
      // ejecutarla.
      onOrdenHuerfana: () => {
        ui.notifications?.warn?.(game.i18n.localize("LAGUNAK.Espacios.Orden.Huerfana"));
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
