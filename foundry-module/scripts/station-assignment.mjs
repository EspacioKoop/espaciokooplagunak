import { REQUISITO_ERRORES, cumpleRequisito, puestosDisponibles } from "./requisitos-puesto.mjs";

const FLAG_KEY = "station";

export const STATION_ASSIGNMENT_ERRORS = Object.freeze({
  NOT_ALLOWED: "not-allowed",
  REQUISITO: "requisito-no-cumplido",
});

export const STATIONS = Object.freeze([
  "captain",
  "navigation",
  "engineering",
  "sensors",
  "communications",
  "weapons",
  // #517: Relay existía en el juego nativo desde siempre —waypoints, sondas,
  // enlace sonda→ciencia y condición de alerta— y no en esta lista, así que
  // nadie podía ocuparlo desde Foundry. Va el último a propósito: añadirlo
  // antes reordenaría los puestos ya existentes en toda superficie que
  // enumere STATIONS, y ese orden es el que la mesa tiene aprendido.
  "relay",
  // #522: Damage Control existía en el juego nativo con posición de tripulación
  // propia (`CrewPosition::damageControl`) y no en esta lista. Va el último a
  // propósito: insertarlo en medio reordenaría los puestos que la mesa ya tiene
  // aprendidos en toda superficie que enumere STATIONS.
  "damagecontrol",
]);

export function normalizeStation(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !STATIONS.includes(value)) {
    throw new TypeError("Unknown crew station");
  }
  return value;
}

export function canAssignStation(actor, target) {
  return Boolean(actor?.isGM || (actor?.id && actor.id === target?.id));
}

export async function assignStation({ actor, target, station, moduleId, requisitos, caracteristicas }) {
  if (!canAssignStation(actor, target)) {
    const error = new Error("Not allowed to assign this crew station");
    error.code = STATION_ASSIGNMENT_ERRORS.NOT_ALLOWED;
    throw error;
  }
  const normalized = normalizeStation(station);

  // Requisitos de característica (opcional, apagado de serie). El GM está exento
  // a propósito: tiene que poder recolocar a la tripulación aunque la regla diga
  // que no, o una mesa mal configurada se queda atascada sin salida.
  if (normalized !== null && requisitos?.activo && !actor?.isGM) {
    const veredicto = cumpleRequisito({ puesto: normalized, caracteristicas, requisitos });
    if (!veredicto.ok) {
      const error = new Error(`Crew station requirement not met: ${veredicto.codigo}`);
      error.code = STATION_ASSIGNMENT_ERRORS.REQUISITO;
      error.veredicto = veredicto;
      throw error;
    }
  }
  if (normalized === null) {
    await target.unsetFlag(moduleId, FLAG_KEY);
  } else {
    await target.setFlag(moduleId, FLAG_KEY, normalized);
  }
  return normalized;
}

/** Frase corta que explica por qué un puesto está cerrado. */
export function motivoRequisito(veredicto, i18n) {
  if (!veredicto || veredicto.ok) return null;
  if (veredicto.codigo === REQUISITO_ERRORES.SIN_FICHA) {
    return i18n.localize("LAGUNAK.Puestos.Requisitos.SinFicha");
  }
  const nombres = veredicto.exigidas
    .map((clave) => i18n.localize(`LAGUNAK.Caracteristicas.${clave}`))
    .join(" / ");
  return i18n.format("LAGUNAK.Puestos.Requisitos.PuntuacionBaja", {
    caracteristicas: nombres,
    minimo: veredicto.minimo,
  });
}

export function visibleCrew(users, actor) {
  const players = Array.from(users ?? []).filter((user) => !user.isGM);
  return actor?.isGM ? players : players.filter((user) => user.id === actor?.id);
}

/**
 * Puestos que no tienen ningún jugador real conectado con esa asignación.
 *
 * La ocupación se deriva siempre del documento User de Foundry: una orden no
 * puede declarar quién ocupa un puesto ni mantenerlo atendido después de una
 * desconexión. Los flags desconocidos se ignoran como asignaciones inválidas.
 */
export function uncrewedStations(users, moduleId) {
  const crewed = new Set();
  for (const user of Array.from(users ?? [])) {
    if (user?.isGM || !user?.active) continue;
    try {
      const station = normalizeStation(user.getFlag?.(moduleId, FLAG_KEY) ?? null);
      if (station) crewed.add(station);
    } catch {
      // Un flag obsoleto o manipulado no corresponde a ningún puesto efectivo.
    }
  }
  return STATIONS.filter((station) => !crewed.has(station));
}

export function stationRows({ users, actor, moduleId, i18n, requisitos, caracteristicasDe }) {
  return visibleCrew(users, actor).map((user) => {
    const current = user.getFlag(moduleId, FLAG_KEY) ?? "";
    // Una opción deshabilitada tiene que decir POR QUÉ: una puerta muda se vive
    // como un fallo del módulo, no como una regla de la mesa.
    const veredictos = requisitos?.activo
      ? Object.fromEntries(
          puestosDisponibles({
            caracteristicas: caracteristicasDe?.(user) ?? null,
            requisitos,
            // Exento quien ASIGNA, no quien ocupa: es el GM el que recoloca.
            esGM: Boolean(actor?.isGM),
          }).map((v) => [v.puesto, v]),
        )
      : null;
    return {
      id: user.id,
      name: user.name,
      active: Boolean(user.active),
      canEdit: canAssignStation(actor, user),
      stations: [
        {
          value: "",
          label: i18n.localize("LAGUNAK.Puestos.SinAsignar"),
          selected: current === "",
        },
        ...STATIONS.map((station) => {
          const veredicto = veredictos?.[station];
          // El puesto que ya se ocupa nunca se deshabilita: si los requisitos
          // cambian con alguien sentado, la lista se quedaría sin poder mostrar
          // dónde está.
          const bloqueado = Boolean(veredicto && !veredicto.ok && current !== station);
          return {
            value: station,
            label: i18n.localize(`LAGUNAK.Puestos.${station}`),
            selected: current === station,
            disabled: bloqueado,
            motivo: bloqueado ? motivoRequisito(veredicto, i18n) : null,
          };
        }),
      ],
    };
  });
}
