// Token de propuesta consumible: el modo B de la asistencia (#309).
//
// EL MURO DE DISEÑO, en una frase: el minijuego vive en Foundry y NO EMITE NADA.
// Un éxito solo produce este token efímero, y quien lo gasta es el TITULAR del
// puesto asistido, como una de SUS órdenes ya autorizadas, bajo su identidad
// autenticada (relé #237). El ayudante nunca gana derechos de emisión sobre un
// puesto que no ocupa; si los ganara, habría dos autoridades sobre la verdad de
// la nave y eso lo prohíbe ADR-0002 aunque compile.
//
// Regla invariable que este módulo hace cumplir con código, no con prosa:
// «ayudar» no puede hacer nada que el puesto asistido no pudiera pedir por sí
// mismo. Ni siquiera el crítico abre un rango nuevo: el grado de éxito elige
// DÓNDE dentro de un rango ya autorizado.
//
// Puro: ni flags, ni sockets, ni reloj propio (`ahora` entra como parámetro).

import { BANDAS, bandaEsFavorable } from "./bandas.mjs";
import { STATION_ACTIONS } from "../station-actions.mjs";

export const PROPUESTA_ERRORES = Object.freeze({
  BANDA_SIN_FRUTO: "banda-sin-fruto",
  CADUCADA: "caducada",
  NO_ES_TITULAR: "no-es-titular",
  ACCION_NO_AUTORIZADA: "accion-no-autorizada",
  PRESUPUESTO_AGOTADO: "presupuesto-agotado",
  YA_ASISTE: "ya-asiste",
});

/**
 * Presupuesto de asistencia concurrente. Permitir que media tripulación ayude a
 * la vez al mismo puesto genera efectos imposibles de equilibrar e incentiva el
 * «todos ayudan siempre al ingeniero». Un asistente activo por puesto y ventana.
 */
export const PRESUPUESTO_POR_DEFECTO = Object.freeze({
  asistentesPorPuesto: 1,
  vigenciaMs: 120_000,
});

/** Tier dentro del rango YA autorizado. El crítico sube de tier, no de rango. */
export const TIERS = Object.freeze({ BAJO: "bajo", ALTO: "alto" });

export function tierDeBanda(banda) {
  if (banda === BANDAS.CRITICO) return TIERS.ALTO;
  if (banda === BANDAS.EXITO) return TIERS.BAJO;
  return null;
}

function propuestasVivas(propuestas, puesto, ahora) {
  return (propuestas ?? []).filter(
    (p) => p.puestoAsistido === puesto && propuestaVigente(p, ahora),
  );
}

/** ¿Cabe una asistencia más a este puesto ahora mismo? */
export function puedeAsistir({
  puestoAsistido,
  asistenteId,
  propuestas = [],
  ahora = Date.now(),
  presupuesto = PRESUPUESTO_POR_DEFECTO,
}) {
  const vivas = propuestasVivas(propuestas, puestoAsistido, ahora);
  if (vivas.some((p) => p.asistenteId === asistenteId)) {
    return { ok: false, error: PROPUESTA_ERRORES.YA_ASISTE };
  }
  if (vivas.length >= presupuesto.asistentesPorPuesto) {
    return { ok: false, error: PROPUESTA_ERRORES.PRESUPUESTO_AGOTADO };
  }
  return { ok: true };
}

/**
 * Crea el token a partir de la banda. Fallo y pifia no dejan token: la ayuda es
 * un bonus, y su ausencia nunca puede bloquear una orden que el titular ya podía
 * dar por sí mismo (la asistencia es sal, no peaje).
 *
 * Registra `asistenteId` aparte de quien luego emita, para que al cerrar una
 * crisis siga estando claro quién decidió y quién prestó apoyo.
 */
export function crearPropuesta({
  tareaId,
  puestoAsistido,
  accion,
  banda,
  asistenteId,
  nonce,
  ahora = Date.now(),
  vigenciaMs = PRESUPUESTO_POR_DEFECTO.vigenciaMs,
}) {
  if (!asistenteId) throw new TypeError("crearPropuesta requiere asistenteId");
  if (!nonce) throw new TypeError("crearPropuesta requiere nonce");
  if (!bandaEsFavorable(banda)) {
    return { ok: false, error: PROPUESTA_ERRORES.BANDA_SIN_FRUTO };
  }
  const permitidas = STATION_ACTIONS[puestoAsistido] ?? [];
  if (!permitidas.includes(accion)) {
    return { ok: false, error: PROPUESTA_ERRORES.ACCION_NO_AUTORIZADA };
  }
  return {
    ok: true,
    propuesta: Object.freeze({
      tareaId,
      puestoAsistido,
      accion,
      banda,
      tier: tierDeBanda(banda),
      asistenteId,
      nonce,
      creadaEn: ahora,
      caducaEn: ahora + vigenciaMs,
    }),
  };
}

export function propuestaVigente(propuesta, ahora = Date.now()) {
  return Boolean(propuesta) && ahora < propuesta.caducaEn;
}

/**
 * Acota un valor propuesto al rango que la orden YA permitía, eligiendo el tramo
 * según el tier. `rango` es [min, max] del propio contrato del puente; el tier
 * bajo se queda en la mitad inferior del margen de ayuda y el alto llega al tope
 * de ese margen — nunca por encima del máximo autorizado.
 */
export function acotarPorTier({ base, objetivo, rango, tier }) {
  const [min, max] = rango;
  const acotar = (v) => Math.min(max, Math.max(min, v));
  const desde = acotar(Number(base));
  const hasta = acotar(Number(objetivo));
  const fraccion = tier === TIERS.ALTO ? 1 : 0.5;
  return acotar(desde + (hasta - desde) * fraccion);
}

/**
 * El titular gasta la propuesta. Devuelve la orden lista para `buildStationOrder`
 * —el mismo camino que cualquier orden suya—, o el motivo del rechazo.
 *
 * `emisorPuesto` DEBE venir resuelto por la identidad autenticada del emisor (el
 * relé lo saca de `userDoc.id`), nunca de un campo declarado por el cliente.
 */
export function consumirPropuesta({
  propuesta,
  emisorId,
  emisorPuesto,
  params = {},
  ahora = Date.now(),
}) {
  if (!propuestaVigente(propuesta, ahora)) {
    return { ok: false, error: PROPUESTA_ERRORES.CADUCADA };
  }
  if (!emisorId || emisorPuesto !== propuesta.puestoAsistido) {
    return { ok: false, error: PROPUESTA_ERRORES.NO_ES_TITULAR };
  }
  const permitidas = STATION_ACTIONS[emisorPuesto] ?? [];
  if (!permitidas.includes(propuesta.accion)) {
    return { ok: false, error: PROPUESTA_ERRORES.ACCION_NO_AUTORIZADA };
  }
  return {
    ok: true,
    orden: { action: propuesta.accion, params },
    // Quién apoyó y quién decidió, por separado: la ayuda amplifica al
    // especialista, no diluye la identidad del puesto.
    credito: Object.freeze({
      asistenteId: propuesta.asistenteId,
      emisorId,
      banda: propuesta.banda,
      tier: propuesta.tier,
      tareaId: propuesta.tareaId,
    }),
  };
}
