// Adaptador Foundry del motor de sesión de minijuegos (#308, paso 3). Es la
// lógica pura del cableado: traduce entre el motor (que no sabe de Foundry) y
// el transporte de Foundry, sin tocar globales. El cableado real —hooks,
// ajustes, sockets— vive en minijuegos-wiring.mjs, que es capa fina.
//
// TRANSPORTE E IDENTIDAD. Mismo principio que el relé de órdenes (#237): el
// participante deja su propuesta en un flag de SU PROPIO documento `User`.
// Foundry impide server-side escribir el documento de otra persona, así que el
// GM coordinador lee la identidad del documento que cambió, nunca de un campo
// del payload. Por eso `despacharCambioDeUsuario` pasa `userDoc.id` al motor
// como `actorId` y descarta cualquier identidad que viniera dentro del sobre.
//
// PRIVACIDAD. El estado público se publica para toda la mesa; las vistas
// privadas se entregan una a una, dirigidas al `userId` autenticado, y nunca
// se escriben en el estado compartido. Como dice el contrato, esto es
// privacidad de interfaz, no secreto criptográfico frente a un cliente hostil.

import {
  ERRORES,
  accionesPermitidas,
  aplicar,
  sustituirCoordinador,
  vistaPublicaSesion,
  vistaPrivadaSesion,
} from "./sesion-motor.mjs";

// Flag donde el participante deja su propuesta, en su propio documento User.
export const FLAG_PROPUESTA = "minijuegoPropuesta";
// Ajuste de mundo donde el coordinador publica el estado público de la mesa.
export const AJUSTE_SESION = "minijuegoSesionPublica";

// ---- Lado participante ----------------------------------------------------

// Construye el sobre a partir del estado público que el cliente conoce. La
// época y la revisión salen de ahí: si el cliente va desfasado, el coordinador
// rechazará el sobre con `epoca_obsoleta`/`revision_obsoleta` en vez de aplicar
// una acción pensada para otro estado. El sobre NO declara identidad.
export function construirPropuesta({ publico, tipo, parametros, nonce }) {
  if (!publico) throw new TypeError("construirPropuesta requiere el estado público");
  if (!tipo) throw new TypeError("construirPropuesta requiere tipo");
  if (!nonce) throw new TypeError("construirPropuesta requiere nonce");
  const sobre = {
    sessionId: publico.id,
    epocaCoordinador: publico.epocaCoordinador,
    revisionEsperada: publico.revision,
    tipo,
    nonce,
  };
  return parametros == null ? sobre : { ...sobre, parametros };
}

// ---- Lado coordinador -----------------------------------------------------

// Extrae la propuesta del objeto de cambios de un `updateUser`. Foundry dispara
// ese hook por cualquier cambio del User, así que devuelve null si el cambio no
// tocó nuestro flag o si no tiene forma de sobre.
export function extraerPropuesta({ changes, moduleId, userDoc }) {
  // OJO CON `changes`: Foundry entrega el DIFERENCIAL, no el valor completo. La
  // segunda propuesta de un mismo cliente solo trae las claves que cambiaron
  // —típicamente `nonce` y poco más—, así que el sobre llegaba sin `sessionId`
  // ni `epocaCoordinador` y el coordinador lo rechazaba con `payload_invalido`.
  // Se veía como «la primera jugada va y las siguientes no».
  //
  // Por eso `changes` se usa solo para saber QUE nuestro flag cambió, y el sobre
  // se lee del documento ya actualizado, que sí lo tiene entero. La identidad
  // sigue siendo la del documento, que es lo que no se puede falsificar.
  const tocado = changes?.flags?.[moduleId]?.[FLAG_PROPUESTA];
  if (!tocado || typeof tocado !== "object") return null;
  const sobre = userDoc?.flags?.[moduleId]?.[FLAG_PROPUESTA] ?? tocado;
  if (!sobre || typeof sobre !== "object") return null;
  if (typeof sobre.tipo !== "string" || typeof sobre.nonce !== "string") return null;
  return sobre;
}

// Aplica una propuesta autenticada y devuelve qué debe publicarse.
//
// `actorId` es la identidad NO FALSIFICABLE: procede del documento User que
// Foundry autorizó a escribir. Cualquier `userId`/`actorId` embebido en el
// sobre se ignora, igual que en el relé de órdenes.
//
// Devuelve `{ ok, sesion, publico, privadas, idempotente?, codigo? }`. No
// escribe nada: quien decide persistir y emitir es el cableado.
export function procesarPropuesta({
  sesion,
  sobre,
  actorId,
  juego,
  semilla,
  configuracionJuego,
  destinatarios,
}) {
  const resultado = aplicar(sesion, { sobre, actorId, juego, semilla, configuracionJuego });
  if (!resultado.ok) {
    return { ok: false, codigo: resultado.codigo, sesion };
  }
  return {
    ok: true,
    idempotente: resultado.idempotente ?? false,
    sesion: resultado.sesion,
    publico: vistaPublicaSesion(resultado.sesion),
    privadas: vistasPrivadas(resultado.sesion, juego, destinatarios),
  };
}

// Vistas a repartir, una por destinatario y dirigida a su userId.
//
// Cada envío lleva TAMBIÉN lo que ese usuario puede hacer ahora mismo. Es la
// pieza que le faltaba a la interfaz: `accionesPermitidas` necesita la sesión
// viva —con la mano en curso—, y esa solo existe en la memoria del coordinador.
// Un cliente que quisiera deducir sus botones desde el estado público estaría
// reimplementando las reglas, y una segunda implementación de las reglas es una
// forma cara de acabar enseñando un botón que el coordinador va a rechazar.
// La lista no CONCEDE nada: la autoridad sigue siendo el coordinador.
//
// Sin `destinatarios` se reparte a los jugadores sentados y activos, que son
// los únicos con secretos que recibir. Con `destinatarios` se llega también a
// quien todavía no se ha sentado —lo que necesita cualquier interfaz para
// ofrecer «sentarse» o «mirar»—; a esos, `vistaPrivadaSesion` les devuelve
// exactamente la pública, que ya es de mundo. El ausente no recibe hasta que
// reconecte y se le vuelva a repartir.
export function vistasPrivadas(sesion, juego, destinatarios) {
  const ids =
    Array.isArray(destinatarios) && destinatarios.length > 0
      ? [...new Set(destinatarios.filter((id) => typeof id === "string" && id !== ""))]
      : sesion.publico.jugadores
          .filter((jugador) => jugador.estado === "activo")
          .map((jugador) => jugador.userId);
  return ids.map((userId) => ({
    userId,
    vista: vistaPrivadaSesion(sesion, userId, juego),
    acciones: accionesPermitidas(sesion, userId, juego),
  }));
}

// Cableado puro del hook `updateUser`: filtra cambios ajenos, aplica el criterio
// de coordinador único y usa la identidad autenticada del documento. Devuelve
// null si el cambio no era una propuesta o si no toca procesarla aquí.
//
// - `userDoc`: documento User que cambió (su `id` es la identidad autenticada).
// - `obtenerSesion()`: sesión viva en memoria del coordinador.
// - `puedeCoordinar()`: solo el coordinador aplica, para no duplicar la acción.
// - `semillaNueva()`: se invoca solo cuando la acción necesita secreto nuevo.
export function despacharCambioDeUsuario({
  userDoc,
  changes,
  moduleId,
  obtenerSesion,
  puedeCoordinar = () => true,
  juego,
  semillaNueva = () => undefined,
  configuracionJuego,
  // A quién se le reparte la vista dirigida. El cableado pasa aquí los usuarios
  // conectados, para que también quien mira desde fuera reciba su vista y sus
  // acciones (ver `vistasPrivadas`).
  destinatarios,
  publicar = () => {},
  enviarPrivada = () => {},
  alRechazar = () => {},
}) {
  const sobre = extraerPropuesta({ changes, moduleId, userDoc });
  if (!sobre) return null;
  if (!puedeCoordinar()) return null;
  const sesion = obtenerSesion();
  // Sin sesión viva no hay nada que aplicar, pero callarse deja al que propuso
  // mirando un botón que no hace nada. Se le dice que la mesa ya no existe,
  // que es exactamente lo que le pasa a su propuesta.
  if (!sesion) {
    alRechazar({ actorId: userDoc?.id, codigo: ERRORES.SESION_DESCONOCIDA });
    return null;
  }

  const actorId = userDoc?.id;
  const resultado = procesarPropuesta({
    sesion,
    sobre,
    actorId,
    juego,
    // La semilla solo se pide para las acciones que arrancan una mano, y nunca
    // viaja al estado público ni al sobre del cliente.
    semilla: sobre.tipo === "start" ? semillaNueva() : undefined,
    configuracionJuego,
    destinatarios: typeof destinatarios === "function" ? destinatarios() : destinatarios,
  });
  if (!resultado.ok) {
    alRechazar({ actorId, codigo: resultado.codigo });
    return resultado;
  }
  // Un reenvío idempotente no republica: el estado no ha cambiado.
  if (!resultado.idempotente) {
    publicar(resultado.publico);
    for (const { userId, vista, acciones } of resultado.privadas) {
      enviarPrivada(userId, vista, acciones);
    }
  }
  return resultado;
}

// ---- Relevo de coordinador ------------------------------------------------

// Adopción de una mesa cuyo coordinador anterior ya no coordina. El GM que toma
// el relevo NO tiene la sesión viva: los secretos (semilla, mazo, manos) solo
// existían en la memoria del anterior y se han perdido. Lo único disponible es
// el estado público del ajuste de mundo.
//
// Por eso la adopción reconstruye la sesión con `privado` vacío y delega en
// `sustituirCoordinador`, que es quien cumple el contrato: sube la época
// —invalidando los sobres en vuelo del coordinador anterior—, cancela la mano
// en curso y restaura el checkpoint previo al reparto. No se reanuda ninguna
// mano: sin semilla no hay forma honesta de continuar la que estaba a medias.
//
// Devuelve null si no hay estado público adoptable o si ya coordinaba este
// mismo usuario, para que el cableado no republique sin motivo.
export function adoptarSesionPublicada({ publico, coordinadorId }) {
  if (!publico || typeof publico !== "object" || typeof publico.id !== "string") return null;
  if (typeof coordinadorId !== "string" || !coordinadorId) return null;
  if (publico.fase === "terminada") return null;
  const sesion = {
    publico: structuredClone(publico),
    privado: {
      epocaCoordinador: publico.epocaCoordinador ?? 0,
      semilla: null,
      estadoJuego: null,
      nonces: [],
    },
  };
  const adoptada = sustituirCoordinador(sesion, { coordinadorId });
  return { sesion: adoptada, publico: vistaPublicaSesion(adoptada) };
}

// ---- Lado receptor --------------------------------------------------------

// Un cliente solo acepta la vista privada dirigida a él. Sirve para descartar
// mensajes ajenos que hayan llegado por difusión.
export function aceptarVistaPrivada({ destinatarioId, userId }) {
  return typeof destinatarioId === "string" && destinatarioId === userId;
}
