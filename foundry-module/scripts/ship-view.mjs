function finiteNonNegative(value) {
  return Number.isFinite(value) && value >= 0;
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
