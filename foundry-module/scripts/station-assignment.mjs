const FLAG_KEY = "station";

export const STATIONS = Object.freeze([
  "captain",
  "navigation",
  "engineering",
  "sensors",
  "communications",
  "weapons",
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

export async function assignStation({ actor, target, station, moduleId }) {
  if (!canAssignStation(actor, target)) {
    throw new Error("Not allowed to assign this crew station");
  }
  const normalized = normalizeStation(station);
  if (normalized === null) {
    await target.unsetFlag(moduleId, FLAG_KEY);
  } else {
    await target.setFlag(moduleId, FLAG_KEY, normalized);
  }
  return normalized;
}

export function visibleCrew(users, actor) {
  const players = Array.from(users ?? []).filter((user) => !user.isGM);
  return actor?.isGM ? players : players.filter((user) => user.id === actor?.id);
}

export function stationRows({ users, actor, moduleId, i18n }) {
  return visibleCrew(users, actor).map((user) => {
    const current = user.getFlag(moduleId, FLAG_KEY) ?? "";
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
        ...STATIONS.map((station) => ({
          value: station,
          label: i18n.localize(`LAGUNAK.Puestos.${station}`),
          selected: current === station,
        })),
      ],
    };
  });
}
