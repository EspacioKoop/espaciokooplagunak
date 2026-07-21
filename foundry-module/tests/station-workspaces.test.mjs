import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  WORKSPACE_STATIONS,
  buildWorkspaceModel,
  stationForWorkspace,
  workspaceDefinition,
} from "../scripts/station-workspaces.mjs";

const MODULE_ID = "espaciokoop-lagunak";
const i18n = { localize: (key) => key };
const es = JSON.parse(await readFile(new URL("../lang/es.json", import.meta.url), "utf8"));
const i18nEs = {
  lang: "es",
  localize: (key) => es[key] ?? key,
  format: (key, data) => (es[key] ?? key).replace(/\{(\w+)\}/g, (_match, name) => String(data[name])),
};

function user({ id, station = null, isGM = false, active = true }) {
  return {
    id,
    name: id,
    isGM,
    active,
    getFlag() { return station; },
  };
}

const statePayload = {
  ship: {
    callsign: "Lagunak",
    position: { x: 1200.4, y: -830.6 },
    heading: 91.6,
    velocity: { x: 3, y: 4 },
    destination: { name: "Argia" },
    hull: 40,
    hull_max: 100,
    energy: 20,
    energy_max: 100,
    shields_active: true,
    systems: {
      reactor: { health: 0.8, heat: 0.92, power: 1.1, coolant: 0.5 },
      beamweapons: { health: 0.6, heat: 0.2, power: 0.8, coolant: 0.4 },
      missilesystem: { health: 0.4, heat: 0.1, power: 0.6, coolant: 0.3 },
    },
  },
};

const contactsPayload = {
  contacts: [
    { callsign: "Lagunak", faction: "Human Navy", is_player: true, position: { x: 0, y: 0 } },
    { callsign: "Eco-1", faction: "Independent", is_player: false, position: { x: 10, y: 20 } },
  ],
  total: 2,
  truncated: false,
};

test("los seis puestos tienen identidad y lista de guardia propias", () => {
  assert.deepEqual(WORKSPACE_STATIONS, [
    "captain", "navigation", "engineering", "sensors", "communications", "weapons",
  ]);
  const definitions = WORKSPACE_STATIONS.map(workspaceDefinition);
  assert.equal(new Set(definitions.map(({ accent }) => accent)).size, 6);
  assert.ok(definitions.every(({ tasks }) => tasks.length === 3));
  const codes = WORKSPACE_STATIONS.map((station) => buildWorkspaceModel({
    station,
    isGM: true,
    users: [],
    moduleId: MODULE_ID,
    i18n,
  }).stationCode);
  assert.equal(new Set(codes).size, 6);
});

test("el jugador abre su puesto y el GM puede previsualizar cualquier consola", () => {
  const player = user({ id: "p1", station: "engineering" });
  const gm = user({ id: "gm", isGM: true });
  assert.equal(stationForWorkspace({ user: player, moduleId: MODULE_ID }), "engineering");
  assert.equal(stationForWorkspace({ user: gm, moduleId: MODULE_ID }), "captain");
  assert.equal(stationForWorkspace({ user: gm, moduleId: MODULE_ID, previewStation: "sensors" }), "sensors");
  assert.equal(
    stationForWorkspace({ user: gm, moduleId: MODULE_ID, previewStation: "unknown" }),
    "captain",
  );
});

test("un jugador nunca recibe telemetría aunque se le inyecte por error", () => {
  const model = buildWorkspaceModel({
    station: "weapons",
    isGM: false,
    users: [user({ id: "p1", station: "weapons" })],
    moduleId: MODULE_ID,
    i18n,
    statePayload,
    contactsPayload,
    connection: "restricted",
  });
  assert.equal(model.hasStation, true);
  assert.equal(model.hasTelemetry, false);
  assert.equal(model.ship, null);
  assert.deepEqual(model.metrics, []);
  assert.deepEqual(model.contacts, []);
  assert.equal(model.connectionRestricted, true);
});

test("navegación puede ordenar rumbo aunque no tenga telemetría; otros puestos no", () => {
  const navegacion = buildWorkspaceModel({
    station: "navigation",
    isGM: false,
    users: [user({ id: "p1", station: "navigation" })],
    moduleId: MODULE_ID,
    i18n,
    connection: "restricted",
  });
  assert.equal(navegacion.hasTelemetry, false);
  assert.equal(navegacion.canOrderHeading, true);
  assert.equal(navegacion.canOrderImpulse, true);
  assert.equal(navegacion.canOrderWarp, true);

  // El GM no recibe el control de tripulación (tiene los suyos y el emit no se
  // autoentrega), ni siquiera en navegación.
  const gmNav = buildWorkspaceModel({ station: "navigation", isGM: true, users: [], moduleId: MODULE_ID, i18n });
  assert.equal(gmNav.canOrderHeading, false);

  for (const station of ["captain", "engineering", "sensors", "communications", "weapons"]) {
    const model = buildWorkspaceModel({ station, isGM: false, users: [], moduleId: MODULE_ID, i18n });
    assert.equal(model.canOrderHeading, false, `${station} no debería ordenar rumbo en esta rebanada`);
    assert.equal(model.canOrderImpulse, false, `${station} no debería ordenar impulso`);
    assert.equal(model.canOrderWarp, false, `${station} no debería ordenar warp`);
  }
});

test("ingeniería puede repartir energía por sistema, con opciones pobladas", () => {
  const model = buildWorkspaceModel({
    station: "engineering",
    isGM: false,
    users: [user({ id: "p1", station: "engineering" })],
    moduleId: MODULE_ID,
    i18n,
    connection: "restricted",
  });
  assert.equal(model.hasTelemetry, false);
  assert.equal(model.canOrderPower, true);
  assert.equal(model.canOrderHeading, false);
  assert.ok(model.powerSystems.length >= 1);
  assert.ok(model.powerSystems.some((option) => option.value === "reactor"));
  assert.ok(model.powerLevels.some((option) => option.value === 1));

  const navegacion = buildWorkspaceModel({ station: "navigation", isGM: true, users: [], moduleId: MODULE_ID, i18n });
  assert.equal(navegacion.canOrderPower, false);
  assert.deepEqual(navegacion.powerSystems, []);
});

test("armas puede subir/bajar escudos como tripulación, no el GM ni otros puestos", () => {
  const armas = buildWorkspaceModel({
    station: "weapons",
    isGM: false,
    users: [user({ id: "p1", station: "weapons" })],
    moduleId: MODULE_ID,
    i18n,
    connection: "restricted",
  });
  assert.equal(armas.canOrderShields, true);
  assert.equal(armas.canOrderHeading, false);

  const gmArmas = buildWorkspaceModel({ station: "weapons", isGM: true, users: [], moduleId: MODULE_ID, i18n });
  assert.equal(gmArmas.canOrderShields, false);

  const navegacion = buildWorkspaceModel({ station: "navigation", isGM: false, users: [], moduleId: MODULE_ID, i18n });
  assert.equal(navegacion.canOrderShields, false);
});

test("ingeniería recibe sistemas y alarmas medibles para la vista GM", () => {
  const model = buildWorkspaceModel({
    station: "engineering",
    isGM: true,
    users: [user({ id: "p1", station: "engineering" })],
    moduleId: MODULE_ID,
    i18n,
    statePayload,
    contactsPayload,
    connection: "ok",
  });
  assert.equal(model.hasTelemetry, true);
  assert.equal(model.systems.length, 3);
  assert.equal(model.metrics[0].progress, 20);
  assert.match(model.metrics[3].value, /LAGUNAK\.Sistemas\.reactor · 92%/);
  assert.equal(model.tabs.length, 6);
});

test("sensores excluye la propia nave y no inventa hostilidad", () => {
  const model = buildWorkspaceModel({
    station: "sensors",
    isGM: true,
    users: [],
    moduleId: MODULE_ID,
    i18n,
    statePayload,
    contactsPayload,
    connection: "ok",
  });
  assert.deepEqual(model.contacts, [
    { callsign: "Eco-1", faction: "LAGUNAK.Facciones.Independent", x: 10, y: 20 },
  ]);
  assert.equal(Object.hasOwn(model.contacts[0], "hostile"), false);
});

test("el modelo final entrega sistemas, facciones y códigos en español de España", () => {
  const engineering = buildWorkspaceModel({
    station: "engineering",
    isGM: true,
    users: [],
    moduleId: MODULE_ID,
    i18n: i18nEs,
    statePayload,
    contactsPayload,
    connection: "ok",
  });
  assert.equal(engineering.stationCode, "ING");
  assert.equal(engineering.systems[0].name, "Reactor");
  assert.equal(engineering.metrics[3].value, "Reactor · 92%");

  const sensors = buildWorkspaceModel({
    station: "sensors",
    isGM: true,
    users: [],
    moduleId: MODULE_ID,
    i18n: i18nEs,
    statePayload,
    contactsPayload,
    connection: "ok",
  });
  assert.equal(sensors.contacts[0].faction, "Independiente");
  assert.equal(i18nEs.localize("LAGUNAK.Facciones.HumanNavy"), "Armada Humana");
});

test("comunicaciones usa la tripulación local sin consultar el puente", () => {
  const model = buildWorkspaceModel({
    station: "communications",
    isGM: true,
    users: [
      user({ id: "p1", station: "communications" }),
      user({ id: "p2", station: "navigation" }),
    ],
    moduleId: MODULE_ID,
    i18n,
    statePayload,
    connection: "ok",
  });
  assert.equal(model.metrics[1].value, "2");
  assert.equal(model.metrics[1].label, "LAGUNAK.Espacios.Metrica.Tripulacion");
});

test("los valores de estilo derivados del puente quedan reducidos a números", () => {
  const model = buildWorkspaceModel({
    station: "navigation",
    isGM: true,
    users: [],
    moduleId: MODULE_ID,
    i18n,
    statePayload: { ship: { ...statePayload.ship, heading: "90deg; color:red" } },
    connection: "ok",
  });
  assert.equal(model.navigationHeading, 0);
});

test("un usuario sin puesto obtiene una pantalla de asignación, no capitán", () => {
  const player = user({ id: "p1" });
  assert.equal(stationForWorkspace({ user: player, moduleId: MODULE_ID }), null);
  const model = buildWorkspaceModel({
    station: null,
    isGM: false,
    users: [player],
    moduleId: MODULE_ID,
    i18n,
    connection: "restricted",
  });
  assert.equal(model.hasStation, false);
});
