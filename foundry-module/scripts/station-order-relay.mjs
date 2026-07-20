import { resolveStationOrder } from "./station-actions.mjs";

// Nombre del mensaje de socket. El canal real (`module.<id>`) lo fija quien
// registra el manejador; aquí solo viaja el tipo de evento y su carga.
export const STATION_ORDER_EVENT = "stationOrder";

// --- Lado tripulante ---------------------------------------------------------

// Emite una orden de puesto por el socket. El cliente NUNCA declara su propio
// puesto: manda su `userId` y el GM resuelve el puesto autoritativamente. Así
// un cliente manipulado no puede hacerse pasar por otro puesto.
export function emitStationOrder({ socket, userId, action, params = {} }) {
  if (!socket || typeof socket.emit !== "function") {
    throw new TypeError("emitStationOrder requiere un socket con emit()");
  }
  if (!userId) throw new TypeError("emitStationOrder requiere userId");
  socket.emit(STATION_ORDER_EVENT, {
    type: STATION_ORDER_EVENT,
    userId,
    action,
    params,
  });
}

// --- Lado GM -----------------------------------------------------------------

// Procesa una orden recibida por socket. Solo debe invocarse en el cliente GM
// (único con token del puente); el registro comprueba `isGM` antes de llamar.
//
// Deps inyectadas para poder probar sin Foundry:
// - `resolveUserStation(userId)`: devuelve el puesto asignado del emisor
//   (leído de su flag por el GM), o null.
// - `bridge`: instancia BridgeClient (o equivalente con los métodos de orden).
//
// El puesto SIEMPRE se resuelve del emisor, ignorando cualquier `station` que
// pudiera venir en el payload. Devuelve el resultado del puente en éxito.
export async function handleStationOrder({ payload, resolveUserStation, bridge }) {
  const { userId, action, params } = payload ?? {};
  if (!userId) throw new TypeError("orden sin userId");
  const station = resolveUserStation(userId);
  const { method, args } = resolveStationOrder({ station, action, params });
  if (typeof bridge?.[method] !== "function") {
    throw new TypeError(`el puente no expone ${method}`);
  }
  return bridge[method](...args);
}

// Registra el manejador de órdenes en el socket, solo en el cliente GM. Fuera
// del GM es no-op (los clientes de tripulación solo emiten, no procesan).
//
// `canHandle` se evalúa EN CADA orden (no al registrar): con varios GM
// conectados, todos reciben el mensaje del socket, pero solo debe ejecutarlo
// uno para no mandar la orden N veces al puente. El cableado pasa aquí el
// criterio de GM primario (game.users.activeGM); por defecto, ejecuta siempre.
// Devuelve una función para dar de baja el manejador.
export function registerStationOrderHandler({
  socket,
  isGM,
  resolveUserStation,
  bridge,
  canHandle = () => true,
  onResult = () => {},
  onError = () => {},
}) {
  if (!isGM) return () => {};
  const listener = (payload) => {
    if (payload?.type !== STATION_ORDER_EVENT) return;
    if (!canHandle()) return;
    Promise.resolve()
      .then(() => handleStationOrder({ payload, resolveUserStation, bridge }))
      .then((result) => onResult(result, payload))
      .catch((error) => onError(error, payload));
  };
  socket.on(STATION_ORDER_EVENT, listener);
  return () => socket.off?.(STATION_ORDER_EVENT, listener);
}
