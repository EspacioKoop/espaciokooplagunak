import { resolveStationOrder } from "./station-actions.mjs";
// Solo el NOMBRE del campo con el que una orden reclama una ayuda (#309). El relé
// no sabe nada de asistencia y no debe: lo único que hace es no tirar ese campo a
// la basura por el camino. Se importa en vez de repetir la cadena para que
// renombrarlo en un sitio no deje al otro leyendo un campo que ya no existe.
import { CAMPO_ASISTENCIA as ASSIST_FIELD } from "./asistencia/relevo.mjs";

// Clave de flag donde el tripulante deja su orden pendiente EN SU PROPIO
// documento User. La identidad del emisor NO viaja como campo declarable: es la
// del documento que Foundry autoriza a escribir (server-side, un usuario solo
// puede modificar su propio User; el mismo principio que canAssignStation). El
// GM la lee del hook updateUser, así que un cliente no puede hacerse pasar por
// otro puesto: tendría que escribir el documento de otra persona, y el servidor
// de Foundry lo rechaza.
export const STATION_ORDER_FLAG = "pendingOrder";

// --- Lado tripulante ---------------------------------------------------------

// Construye el registro de orden a guardar como flag propio. Incluye un `nonce`
// para que Foundry dispare `updateUser` aunque se repita la misma acción/params
// (dos órdenes idénticas seguidas deben llegar como dos cambios distintos). El
// puesto NUNCA se declara aquí: lo resuelve el GM por la identidad autenticada.
export function buildStationOrder({ action, params = {}, nonce }) {
  if (!action) throw new TypeError("buildStationOrder requiere action");
  if (!nonce) throw new TypeError("buildStationOrder requiere nonce");
  return { action, params, nonce };
}

// Extrae la orden pendiente del objeto de cambios de un `updateUser`. Foundry
// dispara ese hook por cualquier cambio del User, así que devuelve null cuando
// el cambio no tocó nuestro flag. Puro: recibe los cambios y el moduleId.
export function extractOrderFromChange({ changes, moduleId, userDoc }) {
  // OJO CON `changes`: Foundry entrega el DIFERENCIAL del documento, no el
  // valor completo. La segunda orden de un mismo puesto solo trae las claves
  // que cambiaron —si repites la misma orden con otros parámetros, puede llegar
  // sin `action`, y si la repites igual, sin `params`—, así que la orden se
  // reconstruía a medias o se descartaba. Los cambios sirven para saber QUE
  // nuestro flag se tocó; la orden se lee del `User` ya actualizado, que la
  // tiene entera. La identidad sigue siendo la del documento, que es lo que no
  // se puede falsificar (#237).
  const tocado = changes?.flags?.[moduleId]?.[STATION_ORDER_FLAG];
  if (!tocado || typeof tocado !== "object") return null;
  const order = userDoc?.flags?.[moduleId]?.[STATION_ORDER_FLAG] ?? tocado;
  if (!order || typeof order !== "object") return null;
  if (!order.action || !order.nonce) return null;
  const extraida = { action: order.action, params: order.params ?? {}, nonce: order.nonce };
  // Reclamación de asistencia (#309), si la orden la trae. NO es un parámetro
  // del puente y no llega a salir de aquí: `prepararOrdenAsistida` la consume y
  // devuelve la orden limpia. Se conserva en la extracción porque si se cayera
  // aquí, la ayuda no tendría por dónde cobrarse y el titular emitiría su orden
  // de siempre sin saber que alguien le había echado una mano.
  if (order[ASSIST_FIELD]) extraida[ASSIST_FIELD] = order[ASSIST_FIELD];
  return extraida;
}

// --- Lado GM -----------------------------------------------------------------

// Procesa una orden autenticada. Solo debe invocarse en el cliente GM (único con
// token del puente); el registro comprueba `isGM`/GM primario antes de llamar.
//
// `userId` es la identidad NO FALSIFICABLE del emisor: procede del documento User
// que Foundry autorizó a escribir, no de un campo dentro de la orden. Cualquier
// `userId`/`station` que apareciera embebido en `order` se ignora por diseño.
//
// Deps inyectadas para poder probar sin Foundry:
// - `resolveUserStation(userId)`: puesto asignado del emisor (su flag), o null.
// - `bridge`: instancia BridgeClient (o equivalente con los métodos de orden).
export async function handleStationOrder({ userId, order, resolveUserStation, bridge }) {
  if (!userId) throw new TypeError("orden sin emisor autenticado");
  const { action, params } = order ?? {};
  // El puesto se resuelve SIEMPRE por la identidad autenticada del emisor,
  // ignorando cualquier userId/station que viniera dentro de la orden.
  const station = resolveUserStation(userId);
  const { method, args } = resolveStationOrder({ station, action, params });
  if (typeof bridge?.[method] !== "function") {
    throw new TypeError(`el puente no expone ${method}`);
  }
  return bridge[method](...args);
}

// Adapta un `updateUser` a una orden despachada. Es la lógica pura del cableado:
// filtra cambios ajenos a nuestro flag, aplica el criterio de GM primario y usa
// la identidad autenticada del documento. Devuelve una promesa con el resultado
// del puente, o null si el cambio no era una orden (o no toca ejecutarla aquí).
//
// - `userDoc`: documento User que cambió (su `id` es la identidad autenticada).
// - `changes`: objeto de cambios que entrega Foundry al hook.
// - `canHandle()`: solo el GM primario ejecuta, para no duplicar la orden.
//
// - `prepareOrder({ userId, order })`: última oportunidad de MODIFICAR la orden
//   antes de que salga, sin poder ampliarla. Existe por la asistencia (#309): el
//   parámetro que emite el titular puede venir mejorado dentro del rango que su
//   orden ya permitía. Devuelve `{ orden, aviso }`; por defecto no toca nada, así
//   que una orden sin ayuda recorre exactamente el camino de siempre.
//
//   No es una puerta de autoridad y no debe convertirse en una: el puesto ya se
//   resolvió por identidad, la acción sigue pasando por `resolveStationOrder` y
//   el puente revalida. Lo único que puede hacer quien se enganche aquí es mover
//   un número dentro de lo que ya estaba autorizado.
export function dispatchUserUpdate({
  userDoc,
  changes,
  moduleId,
  resolveUserStation,
  bridge,
  canHandle = () => true,
  prepareOrder = ({ order }) => ({ orden: order }),
  onResult = () => {},
  onError = () => {},
}) {
  const order = extractOrderFromChange({ changes, moduleId, userDoc });
  if (!order) return null;
  if (!canHandle()) return null;
  const userId = userDoc?.id;
  return Promise.resolve()
    // `prepareOrder` puede devolver `{orden, aviso}` directo o una promesa de
    // ello (#462: resolver un objetivo de escaneo necesita consultar el
    // puente). Envolver en `Promise.resolve(...)` trata ambos casos igual sin
    // que la asistencia síncrona existente tenga que volverse async.
    .then(() => Promise.resolve(prepareOrder({ userId, order })))
    .then((resultadoPrepare) => {
      const preparada = resultadoPrepare ?? {};
      // Sin orden preparada se emite la original. Un `prepareOrder` que devuelva
      // basura no puede dejar al titular sin poder dar una orden que era suya.
      const emitible = preparada.orden ?? order;
      return Promise.resolve()
        .then(() => handleStationOrder({ userId, order: emitible, resolveUserStation, bridge }))
        .then((result) => {
          onResult(result, { userId, order: emitible, aviso: preparada.aviso ?? null });
          return result;
        });
    })
    .catch((error) => { onError(error, { userId, order }); return null; });
}
