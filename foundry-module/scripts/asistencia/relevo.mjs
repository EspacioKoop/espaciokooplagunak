// El relevo: dónde la asistencia (#309) se encuentra con el relé de órdenes
// (#237) sin saltarse a nadie.
//
// Hasta aquí, #309 era una pila de piezas puras que sabían decidir —bandas,
// enfoques, probabilidad, propuesta, temporización— y una sesión que las ordena
// en el tiempo. Ninguna emitía nada. Este módulo es la única costura con el
// mundo, y sigue siendo lógica pura del cableado: recibe lo que Foundry entrega
// y devuelve lo que hay que hacer, igual que `station-order-relay.mjs`. El
// enganche real —hooks, sockets, ajustes— vive fuera, en capa fina.
//
// ## La regla que no se negocia (ADR-0002)
//
// La ayuda NUNCA emite. El asistente no manda una orden con la firma de otro, ni
// el GM la manda por él: la asistencia produce una PROPUESTA, y esa propuesta
// solo se convierte en efecto cuando el TITULAR del puesto emite su propia orden
// por el relé de siempre, bajo su identidad autenticada. Aquí no hay un camino
// alternativo hacia el puente, y no debe haberlo: el día que este archivo
// importe un cliente del puente, el error estará aquí.
//
// Por eso el consumo se cuelga del camino que YA EXISTE. El titular emite
// `set_system_coolant` como cualquier otro día; si su orden lleva el nonce de una
// propuesta viva, el parámetro sale mejorado dentro del rango que la orden ya
// permitía. Sin nonce, la orden es exactamente la de siempre.
//
// ## La ayuda es un bonus, no un peaje
//
// Si la propuesta caducó, ya se gastó o no es de su puesto, la orden del titular
// SIGUE ADELANTE sin mejorar, con un aviso. Bloquearla sería convertir la ayuda
// en un requisito —justo la línea roja del diseño: la asistencia es sal, no un
// peaje—, y además dejaría al ingeniero mirando un error por algo que hizo otro.
//
// ## Identidad
//
// Ni el asistente ni el titular declaran quiénes son. Las dos identidades salen
// del documento `User` que Foundry autorizó a escribir, que es lo que un cliente
// no puede falsificar; cualquier `asistenteId`, `emisorId` o `puesto` que viniera
// dentro del sobre se ignora por diseño. Misma regla que el relé y que #308.

import { SESION_ERRORES, abrir, consumir, declararOrdenMando, resolver } from "./sesion.mjs";

/**
 * Clave del flag donde el ASISTENTE deja su petición, en su propio documento
 * `User`. Es hermana de `STATION_ORDER_FLAG` y por la misma razón: el transporte
 * ya autentica al emisor, así que no hace falta un canal nuevo ni confiar en un
 * campo declarado.
 */
export const ASISTENCIA_FLAG = "pendingAssist";

/** Campo con el que una orden del titular reclama una propuesta. */
export const CAMPO_ASISTENCIA = "asistencia";

/**
 * Lo que puede fallar EN LA COSTURA, y que ninguna pieza de dentro sabía nombrar
 * porque ninguna hablaba con Foundry. Los errores de las reglas siguen viniendo
 * de `SESION_ERRORES`; estos tres son de aquí.
 */
export const RELEVO_ERRORES = Object.freeze({
  /** La matriz de puestos (#268) no deja asistir a esta persona. */
  NO_PUEDE_ASISTIR: "no-puede-asistir",
  /** La petición nombra una tarea que nadie ha declarado. */
  TAREA_DESCONOCIDA: "tarea-desconocida",
  /** Resolver un nonce que abrió otra persona. */
  NO_ES_SU_RESERVA: "no-es-su-reserva",
  /** Solo el capitán autenticado o un GM pueden gastar el recurso de mando. */
  NO_PUEDE_ORDENAR: "no-puede-ordenar",
  /** El puesto no aparece como destino en el catálogo de asistencia activo. */
  DESTINO_MANDO_DESCONOCIDO: "destino-mando-desconocido",
});

export const RELEVO_AVISOS = Object.freeze({
  /** La orden no reclamaba ninguna ayuda: camino normal, sin nada que decir. */
  SIN_ASISTENCIA: null,
  /** Reclamaba una ayuda que ya no vale. La orden pasa igual, sin mejorar. */
  ASISTENCIA_NO_APLICADA: "asistencia-no-aplicada",
});

// --- Lado asistente ---------------------------------------------------------

/**
 * Petición que el asistente guarda en su flag. Como en `buildStationOrder`, el
 * `nonce` va dentro para que Foundry dispare `updateUser` aunque se repita la
 * misma petición, y la identidad no se declara: la pone el documento.
 *
 * `tipo` es `abrir` (reservo hueco y quiero ver mis opciones) o `resolver` (ya
 * he tirado, esta es mi banda).
 */
export function construirPeticionAsistencia({ tipo, tareaId, nonce, banda = null, enfoqueId = null }) {
  if (tipo !== "abrir" && tipo !== "resolver") {
    throw new TypeError("construirPeticionAsistencia: tipo debe ser abrir o resolver");
  }
  if (!nonce) throw new TypeError("construirPeticionAsistencia requiere nonce");
  if (tipo === "abrir" && !tareaId) {
    throw new TypeError("construirPeticionAsistencia: abrir requiere tareaId");
  }
  return { tipo, tareaId: tareaId ?? null, nonce, banda, enfoqueId };
}

/** Orden de mando por el mismo transporte autenticado, sin identidad declarada. */
export function construirPeticionOrdenMando({ puestoAsistido, nonce }) {
  if (!puestoAsistido) throw new TypeError("construirPeticionOrdenMando requiere puestoAsistido");
  if (!nonce) throw new TypeError("construirPeticionOrdenMando requiere nonce");
  return { tipo: "orden-mando", puestoAsistido, nonce };
}

/** Consulta correlacionada del recurso efímero; no declara identidad ni intención de gasto. */
export function construirPeticionConsultaMando({ nonce }) {
  if (!nonce) throw new TypeError("construirPeticionConsultaMando requiere nonce");
  return { tipo: "consulta-mando", nonce };
}

/**
 * Saca la petición del diferencial de un `updateUser`.
 *
 * Mismo cuidado que en el relé de órdenes: Foundry entrega el DIFERENCIAL, no el
 * documento, así que los cambios solo sirven para saber QUE nuestro flag se
 * tocó; la petición se lee del `User` ya actualizado, que la tiene entera.
 */
export function extraerPeticionDeCambio({ changes, moduleId, userDoc }) {
  const tocado = changes?.flags?.[moduleId]?.[ASISTENCIA_FLAG];
  if (!tocado || typeof tocado !== "object") return null;
  const peticion = userDoc?.flags?.[moduleId]?.[ASISTENCIA_FLAG] ?? tocado;
  if (!peticion || typeof peticion !== "object") return null;
  if (!["abrir", "resolver", "orden-mando", "consulta-mando"].includes(peticion.tipo)) return null;
  if (!peticion.nonce) return null;
  if (peticion.tipo === "orden-mando" && !peticion.puestoAsistido) return null;
  if (peticion.tipo === "consulta-mando") {
    return { tipo: peticion.tipo, nonce: peticion.nonce };
  }
  if (peticion.tipo === "orden-mando") {
    return {
      tipo: peticion.tipo,
      puestoAsistido: peticion.puestoAsistido,
      nonce: peticion.nonce,
    };
  }
  return {
    tipo: peticion.tipo,
    tareaId: peticion.tareaId ?? null,
    nonce: peticion.nonce,
    banda: peticion.banda ?? null,
    enfoqueId: peticion.enfoqueId ?? null,
  };
}

// --- Lado GM coordinador ----------------------------------------------------

/**
 * Aplica una petición de asistencia a la sesión. Devuelve el estado nuevo y qué
 * contarle a quien la pidió; NO emite nada al puente, porque una asistencia no
 * es una orden — ese es el punto entero del diseño.
 *
 * Deps inyectadas para poder probar sin Foundry:
 * - `buscarTarea(tareaId)`: la tarea declarada, o null si no existe.
 * - `puedeAsistir(asistenteId)`: la matriz de puestos (#268) decide si esa
 *   persona puede echar una mano; por defecto, cualquiera conectado.
 */
export function despacharPeticion({
  estado,
  asistenteId,
  peticion,
  buscarTarea,
  puedeAsistir = () => true,
  puedeOrdenar = () => false,
  esDestinoOrdenMando = () => false,
  ahora = Date.now(),
  opcionesApertura = {},
}) {
  if (!asistenteId) throw new TypeError("asistencia sin emisor autenticado");
  if (!peticion) return { ok: false, error: SESION_ERRORES.RESERVA_DESCONOCIDA, estado };
  if (peticion.tipo === "orden-mando" || peticion.tipo === "consulta-mando") {
    if (!puedeOrdenar(asistenteId)) {
      return { ok: false, error: RELEVO_ERRORES.NO_PUEDE_ORDENAR, estado };
    }
    if (peticion.tipo === "consulta-mando") {
      return { ok: true, consultaMando: true, estado };
    }
    if (!esDestinoOrdenMando(peticion.puestoAsistido)) {
      return { ok: false, error: RELEVO_ERRORES.DESTINO_MANDO_DESCONOCIDO, estado };
    }
    return declararOrdenMando({
      estado,
      puestoAsistido: peticion.puestoAsistido,
      nonce: peticion.nonce,
    });
  }
  if (!puedeAsistir(asistenteId)) {
    return { ok: false, error: RELEVO_ERRORES.NO_PUEDE_ASISTIR, estado };
  }

  if (peticion.tipo === "abrir") {
    const tarea = buscarTarea?.(peticion.tareaId) ?? null;
    if (!tarea) return { ok: false, error: RELEVO_ERRORES.TAREA_DESCONOCIDA, estado };
    return abrir({ ...opcionesApertura, estado, tarea, asistenteId, nonce: peticion.nonce, ahora });
  }

  // `resolver` no comprueba la identidad porque la reserva ya la lleva dentro:
  // el nonce se creó con el asistente que abrió, y quien resuelve un nonce ajeno
  // solo puede cerrar una reserva que no le dará nada a él. Aun así se mira, para
  // que el registro no atribuya a nadie una tirada que no hizo.
  const reserva = (estado?.reservas ?? []).find((r) => r.nonce === peticion.nonce);
  if (reserva && reserva.asistenteId !== asistenteId) {
    return { ok: false, error: RELEVO_ERRORES.NO_ES_SU_RESERVA, estado };
  }
  return resolver({ estado, nonce: peticion.nonce, banda: peticion.banda, ahora });
}

/** Adapta un `updateUser` a una petición despachada, como `dispatchUserUpdate`. */
export function despacharCambioDeAsistencia({
  estado,
  userDoc,
  changes,
  moduleId,
  buscarTarea,
  puedeAsistir,
  puedeOrdenar,
  esDestinoOrdenMando,
  canHandle = () => true,
  ahora = Date.now(),
  opcionesApertura = {},
}) {
  const peticion = extraerPeticionDeCambio({ changes, moduleId, userDoc });
  if (!peticion) return null;
  // Solo el GM primario resuelve, o dos coordinadores gastarían dos veces el
  // mismo hueco del presupuesto.
  if (!canHandle()) return null;
  return {
    peticion,
    ...despacharPeticion({
      estado,
      asistenteId: userDoc?.id,
      peticion,
      buscarTarea,
      puedeAsistir,
      puedeOrdenar,
      esDestinoOrdenMando,
      ahora,
      opcionesApertura,
    }),
  };
}

// --- Donde se cobra: la orden del titular -----------------------------------

/**
 * Prepara la orden que el titular acaba de emitir, gastando su ayuda si la
 * reclama y sigue viva.
 *
 * Se coloca ENTRE el relé y el puente a propósito: la orden ya viene autenticada
 * y con su puesto resuelto por identidad, así que aquí no hay ninguna decisión de
 * autoridad que tomar —solo si el parámetro se mejora o no—. Devuelve siempre una
 * orden emitible; el `aviso` cuenta qué pasó con la ayuda sin llegar a impedir
 * nada.
 *
 * - `leerBase({ puesto, accion, params })`: la lectura ACTUAL de la nave, que es
 *   desde donde la ayuda mueve el parámetro. Inyectada porque vive en el puente
 *   y este módulo no habla con él.
 */
export function prepararOrdenAsistida({
  estado,
  userId,
  orden,
  resolverPuesto,
  leerBase = () => null,
  ahora = Date.now(),
}) {
  if (!userId) throw new TypeError("orden sin emisor autenticado");
  const { [CAMPO_ASISTENCIA]: nonce, ...limpia } = orden ?? {};
  // La orden que sale nunca lleva el campo de asistencia: es una reclamación
  // nuestra, no un parámetro que el puente entienda.
  const base = { ...limpia, params: { ...(limpia.params ?? {}) } };
  if (!nonce) {
    return { orden: base, credito: null, aviso: RELEVO_AVISOS.SIN_ASISTENCIA, estado };
  }

  const puesto = resolverPuesto(userId);
  const lectura = leerBase({ puesto, accion: base.action, params: base.params });
  const gasto = consumir({
    estado,
    nonce,
    emisorId: userId,
    emisorPuesto: puesto,
    // La acción REALMENTE emitida, no la de la propuesta: si no coinciden, la
    // ayuda no se aplica y la orden sale como la mandó su titular.
    accion: base.action,
    params: base.params,
    base: lectura,
    ahora,
  });

  if (!gasto.ok) {
    // La ayuda se pierde, la orden no. Quien está al mando del puesto pidió algo
    // que podía pedir de todas formas.
    return {
      orden: base,
      credito: null,
      aviso: RELEVO_AVISOS.ASISTENCIA_NO_APLICADA,
      error: gasto.error,
      estado: gasto.estado,
    };
  }

  return {
    // `consumir` devuelve acción y parámetros ya acotados; el nonce de la orden
    // se conserva porque es el del relé, no el de la asistencia.
    orden: { ...base, action: gasto.orden.action, params: gasto.orden.params },
    credito: gasto.credito,
    aviso: RELEVO_AVISOS.SIN_ASISTENCIA,
    estado: gasto.estado,
  };
}
