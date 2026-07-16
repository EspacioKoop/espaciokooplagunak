import { STATIONS, normalizeStation } from "./station-assignment.mjs";
import { prepareSystemRows } from "./ship-view.mjs";

const DEFINITIONS = Object.freeze({
  captain: Object.freeze({
    icon: "fa-solid fa-chess-king",
    code: "CMD",
    accent: "amber",
    tasks: ["Situacion", "Prioridades", "Coordinacion"],
  }),
  navigation: Object.freeze({
    icon: "fa-solid fa-compass",
    code: "NAV",
    accent: "cyan",
    tasks: ["Rumbo", "Ruta", "Llegada"],
  }),
  engineering: Object.freeze({
    icon: "fa-solid fa-screwdriver-wrench",
    code: "ENG",
    accent: "lime",
    tasks: ["Potencia", "Temperatura", "Reparaciones"],
  }),
  sensors: Object.freeze({
    icon: "fa-solid fa-satellite-dish",
    code: "SEN",
    accent: "violet",
    tasks: ["Barrido", "Identificacion", "Seguimiento"],
  }),
  communications: Object.freeze({
    icon: "fa-solid fa-tower-broadcast",
    code: "COM",
    accent: "blue",
    tasks: ["Canales", "Mensajes", "Bitacora"],
  }),
  weapons: Object.freeze({
    icon: "fa-solid fa-crosshairs",
    code: "TAC",
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
  if (user?.isGM && previewStation) return normalizeStation(previewStation);
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

function hottestSystem(rows) {
  return rows.reduce((current, row) => (!current || row.heat > current.heat ? row : current), null);
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
        metric(i18n, "PicoTermico", hot ? `${hot.name} · ${hot.heat}%` : "—", hot?.heat > 80 ? "danger" : "normal"),
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
        ? Math.round(weaponSystems.reduce((sum, row) => sum + row.health, 0) / weaponSystems.length)
        : 0;
      return [
        metric(i18n, "Escudos", localize(i18n, ship?.shields_active ? "LAGUNAK.Espacios.Activos" : "LAGUNAK.Espacios.Inactivos"), ship?.shields_active ? "good" : "warning"),
        metric(i18n, "SistemasArmas", `${average}%`, average < 40 ? "danger" : "normal", average),
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
  const ship = isGM ? statePayload?.ship ?? null : null;
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
    navigationHeading: integer(ship?.heading),
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
