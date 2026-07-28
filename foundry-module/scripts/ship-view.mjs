import { leerNormalizado, leerNumero } from "./lectura-puente.mjs";
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

/**
 * Porcentaje de una fracción del puente, o `null` si no hay lectura.
 *
 * Conservar la ausencia importa: colapsarla a 0 —como se hacía con
 * `Number(x) || 0`— presenta un sistema del que no sabemos nada como si
 * estuviera destruido, frío y sin potencia. «Sin lectura» y «a cero» son
 * cosas opuestas, y el cero real sigue siendo información que debe verse.
 */
const porcentajeSistema = leerNormalizado;

/** Prepara la matriz técnica con nombres localizados y valores normalizados. */
export function prepareSystemRows(ship, i18n) {
  return Object.entries(ship?.systems ?? {}).map(([name, system]) => ({
    id: name,
    name: localizeSystemName(name, i18n),
    health: porcentajeSistema(system?.health),
    heat: porcentajeSistema(system?.heat),
    power: porcentajeSistema(system?.power),
    coolant: porcentajeSistema(system?.coolant),
  }));
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
    // Sin lectura de velocidad NO se puede decir «detenida»: eso es una
    // afirmación sobre la nave, no una ausencia de dato. Antes se tapaba con
    // `?? 0` y una nave de la que no se sabía nada aparecía parada, que es justo
    // la clase de mentira que evita `lectura-puente.mjs`.
    const vx = leerNumero(ship.velocity?.x);
    const vy = leerNumero(ship.velocity?.y);
    const hayLectura = vx !== null && vy !== null;
    const enMovimiento = hayLectura && Math.hypot(vx, vy) > 0.01;
    estado = enMovimiento || !hayLectura ? "calculando" : "detenida";
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

/**
 * Firma estable del panel de estado de nave que ignora telemetría continua
 * (posición, rumbo, casco, energía, distancia/ETA y salud/calor/potencia de
 * sistemas) y solo cambia cuando algo que de verdad requiere reconstruir el
 * DOM —incluidas las regiones `role="status"`— ha cambiado: conexión, error,
 * disponibilidad/resultado de paneles GM o la existencia/identidad de la nave
 * y sus sistemas. Sin esto, el sondeo periódico reconstruye el panel entero
 * en cada tick y las regiones aria-live anuncian ruido aunque nada relevante
 * haya cambiado (issue #227, punto 6).
 */
export function firmaEstadoNaveVisible({
  conexion,
  detalleError,
  ayudaAbierta,
  esGM,
  naveExiste,
  naveCallsign,
  ruta,
  pausa,
  encuentros,
  maniobra,
  maniobraFallo,
  ingenieria,
  ingenieriaFallo,
  sistemas,
}) {
  return JSON.stringify({
    conexion,
    detalleError,
    ayudaAbierta,
    esGM,
    naveExiste,
    naveCallsign: naveCallsign ?? null,
    rutaEstado: ruta?.estado ?? null,
    rutaNombre: ruta?.name ?? null,
    pausaEstado: pausa?.estado ?? null,
    pausaPuedePausar: Boolean(pausa?.puedePausar),
    pausaPuedeReanudar: Boolean(pausa?.puedeReanudar),
    pausaFoundryPausado: Boolean(pausa?.foundryPausado),
    encuentrosDisponible: Boolean(encuentros?.disponible),
    encuentrosPuedeIntroducir: Boolean(encuentros?.puedeIntroducir),
    encuentrosPendiente: Boolean(encuentros?.pendiente),
    maniobraDisponible: Boolean(maniobra?.disponible),
    maniobraPuedeOrdenar: Boolean(maniobra?.puedeOrdenar),
    maniobraEscudosActivos: Boolean(maniobra?.escudosActivos),
    maniobraFallo: Boolean(maniobraFallo),
    ingenieriaDisponible: Boolean(ingenieria?.disponible),
    ingenieriaPuedeAjustar: Boolean(ingenieria?.puedeAjustar),
    ingenieriaPendiente: Boolean(ingenieria?.pendiente),
    ingenieriaTieneReparadores: Boolean(ingenieria?.tieneReparadores),
    ingenieriaFallo: Boolean(ingenieriaFallo),
    sistemas: (sistemas ?? []).map((sistema) => sistema.id),
  });
}
