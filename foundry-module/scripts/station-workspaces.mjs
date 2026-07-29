import { STATIONS, normalizeStation } from "./station-assignment.mjs";
import { isActionAllowed } from "./station-actions.mjs";
import { SISTEMAS_INGENIERIA, NIVELES_POTENCIA, NIVELES_REFRIGERANTE } from "./ingenieria-control.mjs";
import { prepareSystemRows } from "./ship-view.mjs";
import { retratoTripulanteDataUri } from "./retrato-tripulante.mjs";

// Marca visible de «no hay lectura», distinta de cualquier valor real.
const SIN_DATO = "—";

const DEFINITIONS = Object.freeze({
  captain: Object.freeze({
    icon: "fa-solid fa-chess-king",
    accent: "amber",
    tasks: ["Situacion", "Prioridades", "Coordinacion"],
  }),
  navigation: Object.freeze({
    icon: "fa-solid fa-compass",
    accent: "cyan",
    tasks: ["Rumbo", "Ruta", "Llegada"],
  }),
  engineering: Object.freeze({
    icon: "fa-solid fa-screwdriver-wrench",
    accent: "lime",
    tasks: ["Potencia", "Temperatura", "Reparaciones"],
  }),
  sensors: Object.freeze({
    icon: "fa-solid fa-satellite-dish",
    accent: "violet",
    tasks: ["Barrido", "Identificacion", "Seguimiento"],
  }),
  communications: Object.freeze({
    icon: "fa-solid fa-tower-broadcast",
    accent: "blue",
    tasks: ["Canales", "Mensajes", "Bitacora"],
  }),
  weapons: Object.freeze({
    icon: "fa-solid fa-crosshairs",
    accent: "red",
    tasks: ["Seguridad", "Soluciones", "Confirmacion"],
  }),
});

export const WORKSPACE_STATIONS = STATIONS;

export function workspaceDefinition(station) {
  const normalized = normalizeStation(station);
  return normalized ? DEFINITIONS[normalized] : null;
}

export function stationForWorkspace({ user, moduleId, previewStation = null }) {
  if (user?.isGM && previewStation) {
    try {
      return normalizeStation(previewStation);
    } catch {
      return "captain";
    }
  }
  const assigned = user?.getFlag?.(moduleId, "station") ?? null;
  if (assigned) return normalizeStation(assigned);
  return user?.isGM ? "captain" : null;
}

function localize(i18n, key) {
  return i18n?.localize?.(key) ?? key;
}

function format(i18n, key, data) {
  if (typeof i18n?.format === "function") return i18n.format(key, data);
  return localize(i18n, key).replace(/\{(\w+)\}/g, (_match, name) => String(data?.[name] ?? ""));
}

const FACTION_KEYS = Object.freeze({
  Independent: "Independent",
  "Human Navy": "HumanNavy",
  Kraylor: "Kraylor",
  Arlenians: "Arlenians",
  Exuari: "Exuari",
  Ghosts: "Ghosts",
  Ktlitans: "Ktlitans",
  TSN: "TSN",
  USN: "USN",
  CUF: "CUF",
});

function localizeFaction(i18n, faction) {
  const key = FACTION_KEYS[faction];
  return localize(i18n, key ? `LAGUNAK.Facciones.${key}` : "LAGUNAK.Facciones.Desconocida");
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

/**
 * Rumbo para el casco 3D, o `null` si no hay lectura.
 *
 * `Number.isFinite(Number(x))` NO vale aquí: `Number(null)` y `Number("")` son
 * cero, así que la ausencia de dato se convertía en «rumbo norte» y el casco se
 * pintaba como si fuera una lectura buena. Ausencia no es cero — esa es la
 * regla que sostiene todo el visor— y por eso se comprueba el tipo antes que el
 * valor. Se admite una cadena numérica porque el puente puede entregarla, pero
 * la vacía no lo es.
 */
function rumboDeLectura(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor === "string" && valor.trim() !== "") {
    const n = Number(valor);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function integer(value) {
  return Math.round(finite(value));
}

function percent(value, maximum) {
  const max = finite(maximum);
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((finite(value) / max) * 100)));
}

function ratioLabel(value, maximum) {
  return `${integer(value)} / ${integer(maximum)}`;
}

function velocity(ship) {
  const x = finite(ship?.velocity?.x);
  const y = finite(ship?.velocity?.y);
  return Math.round(Math.hypot(x, y));
}

function metric(i18n, key, value, tone = "normal", progress = null) {
  return {
    label: localize(i18n, `LAGUNAK.Espacios.Metrica.${key}`),
    value,
    tone,
    progress,
    hasProgress: progress !== null,
  };
}

// Promedio de salud sobre los sistemas CON lectura. Si no hay ninguna, el
// promedio no existe (null) en vez de valer cero, que se leería como
// «armamento destruido».
function promedioSalud(rows) {
  const leidos = rows.filter((row) => Number.isFinite(row.health));
  if (leidos.length === 0) return null;
  return Math.round(leidos.reduce((suma, row) => suma + row.health, 0) / leidos.length);
}

function hottestSystem(rows) {
  // Un sistema sin lectura de calor no puede ser el pico térmico: se ignora en
  // vez de competir como si estuviera frío.
  return rows
    .filter((row) => Number.isFinite(row.heat))
    .reduce((current, row) => (!current || row.heat > current.heat ? row : current), null);
}

function metricsFor(station, ship, contactsPayload, i18n, crewCount = 0) {
  const systems = prepareSystemRows(ship, i18n);
  const contacts = Array.isArray(contactsPayload?.contacts) ? contactsPayload.contacts : [];
  const externalContacts = contacts.filter((entry) => !entry?.is_player);
  const hull = percent(ship?.hull, ship?.hull_max);
  const energy = percent(ship?.energy, ship?.energy_max);
  const hot = hottestSystem(systems);

  switch (station) {
    case "captain":
      return [
        metric(i18n, "Nave", String(ship?.callsign ?? "—")),
        metric(i18n, "Casco", ratioLabel(ship?.hull, ship?.hull_max), hull < 35 ? "danger" : "normal", hull),
        metric(i18n, "Energia", ratioLabel(ship?.energy, ship?.energy_max), energy < 25 ? "danger" : "normal", energy),
        metric(i18n, "Escudos", localize(i18n, ship?.shields_active ? "LAGUNAK.Espacios.Activos" : "LAGUNAK.Espacios.Inactivos"), ship?.shields_active ? "good" : "warning"),
      ];
    case "navigation":
      return [
        metric(i18n, "Rumbo", `${integer(ship?.heading)}°`),
        metric(i18n, "Velocidad", format(i18n, "LAGUNAK.Espacios.Valor.Velocidad", { value: velocity(ship) })),
        metric(i18n, "Posicion", `${integer(ship?.position?.x)}, ${integer(ship?.position?.y)}`),
        metric(i18n, "Destino", String(ship?.destination?.name ?? "—")),
      ];
    case "engineering":
      return [
        metric(i18n, "Energia", ratioLabel(ship?.energy, ship?.energy_max), energy < 25 ? "danger" : "normal", energy),
        metric(i18n, "Casco", `${hull}%`, hull < 35 ? "danger" : "normal", hull),
        metric(i18n, "Sistemas", String(systems.length)),
        metric(
          i18n,
          "PicoTermico",
          hot ? `${hot.name} · ${hot.heat}%` : SIN_DATO,
          hot?.heat > 80 ? "danger" : "normal",
        ),
      ];
    case "sensors":
      return [
        metric(i18n, "Contactos", String(externalContacts.length)),
        metric(i18n, "TotalSensor", String(integer(contactsPayload?.total ?? contacts.length))),
        metric(i18n, "Cobertura", localize(i18n, "LAGUNAK.Espacios.Valor.Cobertura")),
        metric(i18n, "Truncado", localize(i18n, contactsPayload?.truncated ? "LAGUNAK.Espacios.Si" : "LAGUNAK.Espacios.No"), contactsPayload?.truncated ? "warning" : "good"),
      ];
    case "communications":
      return [
        metric(i18n, "Indicativo", String(ship?.callsign ?? "—")),
        metric(i18n, "Tripulacion", String(crewCount)),
        metric(i18n, "CanalPuente", localize(i18n, "LAGUNAK.Espacios.SoloGM"), "warning"),
        metric(i18n, "Bitacora", localize(i18n, "LAGUNAK.Espacios.Disponible"), "good"),
      ];
    case "weapons": {
      const weaponSystems = systems.filter(({ id }) => id === "beamweapons" || id === "missilesystem");
      const average = weaponSystems.length
        ? promedioSalud(weaponSystems)
        : null;
      return [
        metric(i18n, "Escudos", localize(i18n, ship?.shields_active ? "LAGUNAK.Espacios.Activos" : "LAGUNAK.Espacios.Inactivos"), ship?.shields_active ? "good" : "warning"),
        metric(
          i18n,
          "SistemasArmas",
          average === null ? SIN_DATO : `${average}%`,
          average !== null && average < 40 ? "danger" : "normal",
          average,
        ),
        metric(i18n, "Contactos", String(externalContacts.length)),
        metric(i18n, "Autorizacion", localize(i18n, "LAGUNAK.Espacios.SinOrdenes"), "warning"),
      ];
    }
    default:
      return [];
  }
}

function crewRows(users, moduleId, i18n) {
  return Array.from(users ?? [])
    .filter((user) => !user?.isGM)
    .map((user) => {
      let station = null;
      try {
        station = normalizeStation(user.getFlag?.(moduleId, "station") ?? null);
      } catch {
        station = null;
      }
      return {
        id: user.id,
        name: user.name,
        active: Boolean(user.active),
        station,
        // Ancla visual para reconocer a alguien de un vistazo (#352). Se siembra
        // con el id y no con el nombre para que sobreviva a un renombrado. Es
        // decorativo: la fila sigue diciendo puesto y estado en texto.
        portrait: retratoTripulanteDataUri(user.id, { activo: Boolean(user.active) }),
        stationLabel: station
          ? localize(i18n, `LAGUNAK.Puestos.${station}`)
          : localize(i18n, "LAGUNAK.Puestos.SinAsignar"),
        statusLabel: localize(i18n, user.active ? "LAGUNAK.Espacios.EnLinea" : "LAGUNAK.Puestos.Desconectado"),
      };
    });
}

function visibleContacts(contactsPayload, i18n) {
  const contacts = Array.isArray(contactsPayload?.contacts) ? contactsPayload.contacts : [];
  return contacts
    .filter((entry) => !entry?.is_player)
    .slice(0, 6)
    .map((entry) => ({
      callsign: String(entry?.callsign ?? "?"),
      faction: entry?.faction
        ? localizeFaction(i18n, String(entry.faction))
        : localize(i18n, "LAGUNAK.Facciones.SinFaccion"),
      x: integer(entry?.position?.x),
      y: integer(entry?.position?.y),
    }));
}

export function buildWorkspaceModel({
  station,
  isGM,
  users,
  moduleId,
  i18n,
  statePayload = null,
  contactsPayload = null,
  connection = "restricted",
  error = "",
}) {
  const normalized = normalizeStation(station);
  const definition = normalized ? DEFINITIONS[normalized] : null;
  // Telemetría de la PROPIA NAVE: la ve toda la tripulación (#331).
  //
  // Estaba cerrada al GM y por eso las consolas salían vacías: `metricsFor` ya
  // tenía una lectura distinta para cada puesto, pero sin `ship` no llegaba a
  // ejecutarse. No era falta de diseño, era una llave echada.
  //
  // Y ocultarla no defendía nada: en el EmptyEpsilon del que esto es fork, cada
  // pantalla de tripulación ve casco, energía y sistemas. Una consola de Foundry
  // que esconde lo que la consola nativa enseña es un peor producto a cambio de
  // cero seguridad. Lo que se protege es el **Bearer del puente**, que nunca sale
  // del navegador del GM, no el contenido de un `/v1/state` que la tripulación
  // vería igual asomándose a su propia nave.
  const ship = statePayload?.ship ?? null;
  // Los contactos SÍ siguen siendo recurso del GM. Es la excepción del issue:
  // callsign, facción y coordenadas exactas son lo que el sistema de sensores
  // debería decidir cuánto revela, y difundirlos crudos regalaría el trabajo del
  // puesto. Se abrirán degradados por distancia y salud de sensores, con su
  // propio módulo puro y sus pruebas.
  const safeContactsPayload = isGM ? contactsPayload : null;
  const crew = crewRows(users, moduleId, i18n);

  if (!definition) {
    return {
      hasStation: false,
      isGM: Boolean(isGM),
      connection,
      crew,
    };
  }

  return {
    hasStation: true,
    station: normalized,
    stationLabel: localize(i18n, `LAGUNAK.Puestos.${normalized}`),
    stationCode: localize(i18n, `LAGUNAK.Espacios.${normalized}.Codigo`),
    stationIcon: definition.icon,
    accent: definition.accent,
    isNavigation: normalized === "navigation",
    // Acciones operativas por puesto (#236/#238/#240): disponibles aunque el
    // tripulante no tenga telemetría —la orden es intención, la simulación es
    // autoritativa—. Solo para tripulación (no-GM): el GM tiene sus controles
    // directos y `game.socket.emit` no se autoentrega, así que no le serviría.
    canOrderHeading: !isGM && isActionAllowed(normalized, "set_target_heading"),
    canOrderImpulse: !isGM && isActionAllowed(normalized, "set_impulse"),
    canOrderWarp: !isGM && isActionAllowed(normalized, "set_warp"),
    canOrderPower: !isGM && isActionAllowed(normalized, "set_system_power"),
    canOrderShields: !isGM && isActionAllowed(normalized, "set_shields"),
    powerSystems: !isGM && isActionAllowed(normalized, "set_system_power")
      ? SISTEMAS_INGENIERIA.map((id) => ({ value: id, label: localize(i18n, `LAGUNAK.Sistemas.${id}`) }))
      : [],
    powerLevels: !isGM && isActionAllowed(normalized, "set_system_power")
      ? NIVELES_POTENCIA.map((value) => ({ value, label: String(value) }))
      : [],
    canOrderCoolant: !isGM && isActionAllowed(normalized, "set_system_coolant"),
    coolantSystems: !isGM && isActionAllowed(normalized, "set_system_coolant")
      ? SISTEMAS_INGENIERIA.map((id) => ({ value: id, label: localize(i18n, `LAGUNAK.Sistemas.${id}`) }))
      : [],
    coolantLevels: !isGM && isActionAllowed(normalized, "set_system_coolant")
      ? NIVELES_REFRIGERANTE.map((value) => ({ value, label: String(value) }))
      : [],
    navigationHeading: integer(ship?.heading),
    // Casco propio en 3D (#362). `null` cuando no hay lectura, que NO es lo
    // mismo que rumbo cero: el visor se queda quieto y apagado en vez de
    // enseñar una nave girando que no se corresponde con nada.
    cascoRumbo: rumboDeLectura(ship?.heading),
    navigationAriaLabel: format(i18n, "LAGUNAK.Espacios.RumboAccesible", { heading: integer(ship?.heading) }),
    isGM: Boolean(isGM),
    hasTelemetry: Boolean(ship),
    connection,
    connectionOk: connection === "ok",
    connectionLoading: connection === "loading",
    connectionError: connection === "error",
    connectionRestricted: connection === "restricted",
    error,
    ship,
    metrics: ship ? metricsFor(normalized, ship, safeContactsPayload, i18n, crew.length) : [],
    systems: normalized === "engineering" ? prepareSystemRows(ship, i18n) : [],
    contacts: normalized === "sensors" || normalized === "weapons" ? visibleContacts(safeContactsPayload, i18n) : [],
    crew,
    crewCount: crew.length,
    activeCrew: crew.filter((member) => member.active).length,
    tasks: definition.tasks.map((task, index) => ({
      number: index + 1,
      label: localize(i18n, `LAGUNAK.Espacios.${normalized}.Tarea.${task}`),
    })),
    tabs: Boolean(isGM)
      ? STATIONS.map((entry) => ({
          station: entry,
          label: localize(i18n, `LAGUNAK.Puestos.${entry}`),
          selected: entry === normalized,
        }))
      : [],
  };
}
