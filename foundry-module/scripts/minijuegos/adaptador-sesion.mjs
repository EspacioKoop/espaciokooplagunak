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

import { aplicar, vistaPublicaSesion, vistaPrivadaSesion } from "./sesion-motor.mjs";

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
export function extraerPropuesta({ changes, moduleId }) {
  const sobre = changes?.flags?.[moduleId]?.[FLAG_PROPUESTA];
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
export function procesarPropuesta({ sesion, sobre, actorId, juego, semilla, configuracionJuego }) {
  const resultado = aplicar(sesion, { sobre, actorId, juego, semilla, configuracionJuego });
  if (!resultado.ok) {
    return { ok: false, codigo: resultado.codigo, sesion };
  }
  return {
    ok: true,
    idempotente: resultado.idempotente ?? false,
    sesion: resultado.sesion,
    publico: vistaPublicaSesion(resultado.sesion),
    privadas: vistasPrivadas(resultado.sesion, juego),
  };
}

// Vistas privadas a repartir: una por jugador sentado, dirigida a su userId.
// Los espectadores no reciben nada privado; el ausente tampoco, hasta que
// reconecte y se le vuelva a repartir.
export function vistasPrivadas(sesion, juego) {
  return sesion.publico.jugadores
    .filter((jugador) => jugador.estado === "activo")
    .map((jugador) => ({
      userId: jugador.userId,
      vista: vistaPrivadaSesion(sesion, jugador.userId, juego),
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
  publicar = () => {},
  enviarPrivada = () => {},
  alRechazar = () => {},
}) {
  const sobre = extraerPropuesta({ changes, moduleId });
  if (!sobre) return null;
  if (!puedeCoordinar()) return null;
  const sesion = obtenerSesion();
  if (!sesion) return null;

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
  });
  if (!resultado.ok) {
    alRechazar({ actorId, codigo: resultado.codigo });
    return resultado;
  }
  // Un reenvío idempotente no republica: el estado no ha cambiado.
  if (!resultado.idempotente) {
    publicar(resultado.publico);
    for (const { userId, vista } of resultado.privadas) {
      enviarPrivada(userId, vista);
    }
  }
  return resultado;
}

// ---- Lado receptor --------------------------------------------------------

// Un cliente solo acepta la vista privada dirigida a él. Sirve para descartar
// mensajes ajenos que hayan llegado por difusión.
export function aceptarVistaPrivada({ destinatarioId, userId }) {
  return typeof destinatarioId === "string" && destinatarioId === userId;
}
