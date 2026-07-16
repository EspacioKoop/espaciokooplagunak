function finiteNonNegative(value) {
  return Number.isFinite(value) && value >= 0;
}

const SYSTEM_NAMES = new Set([
  "reactor",
  "beamweapons",
  "missilesystem",
  "maneuver",
  "impulse",
  "warp",
  "jumpdrive",
  "frontshield",
  "rearshield",
]);

/** Traduce los identificadores cerrados del DTO sin mostrar inglés interno. */
export function localizeSystemName(name, i18n) {
  const normalized = typeof name === "string" ? name.toLowerCase() : "";
  const key = SYSTEM_NAMES.has(normalized)
    ? `LAGUNAK.Sistemas.${normalized}`
    : "LAGUNAK.Sistemas.Desconocido";
  return i18n?.localize?.(key) ?? key;
}

/** Prepara la matriz técnica con nombres localizados y valores normalizados. */
export function prepareSystemRows(ship, i18n) {
  return Object.entries(ship?.systems ?? {}).map(([name, system]) => ({
    id: name,
    name: localizeSystemName(name, i18n),
    health: Math.round((Number(system?.health) || 0) * 100),
    heat: Math.round((Number(system?.heat) || 0) * 100),
    power: Math.round((Number(system?.power) || 0) * 100),
    coolant: Math.round((Number(system?.coolant) || 0) * 100),
  }));
}

/** Prepara destino/distancia/ETA para Handlebars sin depender de Foundry. */
export function prepareRoute(ship, i18n) {
  const destination = ship?.destination;
  if (
    !destination ||
    typeof destination.name !== "string" ||
    !finiteNonNegative(ship.distance_to_destination)
  ) {
    return null;
  }

  const distance = ship.distance_to_destination;
  let etaLabel;
  if (!finiteNonNegative(ship.eta_seconds)) {
    etaLabel = i18n.localize("LAGUNAK.EstadoNave.EtaDetenida");
  } else {
    const totalSeconds = Math.round(ship.eta_seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    etaLabel =
      hours > 0
        ? i18n.format("LAGUNAK.EstadoNave.EtaHoras", { hours, minutes })
        : i18n.format("LAGUNAK.EstadoNave.EtaMinutos", { minutes, seconds });
  }

  return {
    name: destination.name,
    position: destination.position,
    distanceLabel: i18n.format("LAGUNAK.EstadoNave.DistanciaUnidades", {
      distance: (distance / 1000).toFixed(1),
    }),
    etaLabel,
  };
}
