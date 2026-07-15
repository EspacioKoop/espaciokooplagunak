function finiteNonNegative(value) {
  return Number.isFinite(value) && value >= 0;
}

/**
 * Prepara destino/distancia/ETA para Handlebars sin depender de Foundry.
 *
 * Onboarding (issue #126): la ruta SIEMPRE tiene etiquetas, también cuando no
 * hay destino o faltan datos — una persona nueva debe poder leer «sin
 * destino» en vez de encontrarse filas ausentes. Estados posibles:
 * `sin_destino`, `sin_datos` (hay destino pero la distancia no es un número),
 * `detenida` (nave parada: sin ETA), `calculando` (en movimiento pero el
 * puente aún no publica ETA) y `en_ruta`.
 */
export function prepareRoute(ship, i18n) {
  if (!ship) return null;

  const destination = ship.destination;
  if (!destination || typeof destination.name !== "string") {
    const etiqueta = i18n.localize("LAGUNAK.Ruta.SinDestino");
    return { estado: "sin_destino", name: etiqueta, distanceLabel: "—", etaLabel: "—" };
  }

  if (!finiteNonNegative(ship.distance_to_destination)) {
    const sinDatos = i18n.localize("LAGUNAK.Ruta.SinDatos");
    return {
      estado: "sin_datos",
      name: destination.name,
      position: destination.position,
      distanceLabel: sinDatos,
      etaLabel: sinDatos,
    };
  }

  const distance = ship.distance_to_destination;
  let estado = "en_ruta";
  let etaLabel;
  if (!finiteNonNegative(ship.eta_seconds)) {
    const vx = ship.velocity?.x ?? 0;
    const vy = ship.velocity?.y ?? 0;
    const enMovimiento = Math.hypot(vx, vy) > 0.01;
    estado = enMovimiento ? "calculando" : "detenida";
    etaLabel = i18n.localize(
      enMovimiento ? "LAGUNAK.Ruta.Calculando" : "LAGUNAK.EstadoNave.EtaDetenida",
    );
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
    estado,
    name: destination.name,
    position: destination.position,
    distanceLabel: i18n.format("LAGUNAK.EstadoNave.DistanciaUnidades", {
      distance: (distance / 1000).toFixed(1),
    }),
    etaLabel,
  };
}
