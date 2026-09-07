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

test("cada puesto tiene identidad y lista de guardia propias", () => {
  // #517 añadió `relay` y por eso esto ya no habla de "seis": la prueba mira
  // que NINGÚN puesto comparta acento ni código, no que haya un número
  // concreto. Un acento repetido haría dos consolas indistinguibles de reojo,
  // que es justo para lo que sirve el acento.
  assert.deepEqual(WORKSPACE_STATIONS, [
    "captain", "navigation", "engineering", "sensors", "communications", "weapons",
    "relay", "damagecontrol",
  ]);
  const definitions = WORKSPACE_STATIONS.map(workspaceDefinition);
  assert.equal(new Set(definitions.map(({ accent }) => accent)).size, WORKSPACE_STATIONS.length);
  assert.ok(definitions.every(({ tasks }) => tasks.length === 3));
  const codes = WORKSPACE_STATIONS.map((station) => buildWorkspaceModel({
    station,
    isGM: true,
    users: [],
    moduleId: MODULE_ID,
    i18n,
  }).stationCode);
  assert.equal(new Set(codes).size, WORKSPACE_STATIONS.length);
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

test("el modelo publica los puestos no atendidos con etiquetas localizadas", () => {
  const model = buildWorkspaceModel({
    station: "captain",
    isGM: false,
    users: [
      user({ id: "p1", station: "captain", active: true }),
      user({ id: "p2", station: "engineering", active: false }),
    ],
    moduleId: MODULE_ID,
    i18n: i18nEs,
  });

  assert.equal(model.hasUncrewedStations, true);
  assert.equal(model.uncrewedStations.some(({ id }) => id === "captain"), false);
  assert.deepEqual(
    model.uncrewedStations.find(({ id }) => id === "engineering"),
    { id: "engineering", label: "Ingeniería" },
  );
});

test("el aviso de puestos no atendidos es visible y accesible", async () => {
  const template = await readFile(new URL("../templates/espacio-puesto.hbs", import.meta.url), "utf8");

  assert.match(template, /{{#if hasUncrewedStations}}/);
  assert.match(template, /lagunak-workspace__uncrewed" role="status"/);
  assert.match(template, /aria-live="polite"/);
  assert.match(template, /LAGUNAK\.Espacios\.PuestosNoAtendidos/);
});

test("un jugador SÍ ve la telemetría de su nave, pero NO los contactos (#331)", () => {
  // Cambio de doctrina deliberado. Antes esta prueba exigía lo contrario, y ese
  // «lo contrario» era la razón de que las consolas salieran vacías: `metricsFor`
  // ya tenía una lectura por puesto, pero sin `ship` no llegaba a ejecutarse.
  //
  // Ocultar la nave propia no defendía nada: en el EmptyEpsilon del que esto es
  // fork, cada pantalla de tripulación ve casco, energía y sistemas. Lo que se
  // protege es el Bearer del puente, que sigue sin salir del navegador del GM.
  const model = buildWorkspaceModel({
    station: "weapons",
    isGM: false,
    users: [user({ id: "p1", station: "weapons" })],
    moduleId: MODULE_ID,
    i18n,
    statePayload,
    contactsPayload,
    connection: "ok",
  });
  assert.equal(model.hasStation, true);
  assert.equal(model.hasTelemetry, true);
  assert.ok(model.ship, "la nave propia se ve");
  assert.ok(model.metrics.length > 0, "y por fin hay lectura de puesto");

  // La excepción que SIGUE cerrada: los contactos son recurso del GM hasta que
  // se abran degradados por distancia y salud de sensores. Difundirlos crudos
  // regalaría el trabajo del puesto de Sensores.
  assert.deepEqual(model.contacts, [], "los contactos siguen siendo del GM");

  const comoGM = buildWorkspaceModel({
    station: "weapons",
    isGM: true,
    users: [user({ id: "p1", station: "weapons" })],
    moduleId: MODULE_ID,
    i18n,
    statePayload,
    contactsPayload,
    connection: "ok",
  });
  assert.ok(comoGM.contacts.length > 0, "el GM sí los ve");
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

test("ingeniería también puede repartir refrigerante 0..10, no el GM ni otros puestos (#301)", () => {
  const model = buildWorkspaceModel({
    station: "engineering",
    isGM: false,
    users: [user({ id: "p1", station: "engineering" })],
    moduleId: MODULE_ID,
    i18n,
    connection: "restricted",
  });
  assert.equal(model.canOrderCoolant, true);
  assert.ok(model.coolantSystems.some((option) => option.value === "reactor"));
  assert.ok(model.coolantLevels.some((option) => option.value === 0));
  assert.ok(model.coolantLevels.some((option) => option.value === 10));

  const gmIng = buildWorkspaceModel({ station: "engineering", isGM: true, users: [], moduleId: MODULE_ID, i18n });
  assert.equal(gmIng.canOrderCoolant, false);
  assert.deepEqual(gmIng.coolantSystems, []);

  const navegacion = buildWorkspaceModel({ station: "navigation", isGM: false, users: [], moduleId: MODULE_ID, i18n });
  assert.equal(navegacion.canOrderCoolant, false);
});

test("ingeniería activa/desactiva la reparación automática, no el GM ni otros puestos (#464)", () => {
  const model = buildWorkspaceModel({
    station: "engineering",
    isGM: false,
    users: [user({ id: "p1", station: "engineering" })],
    moduleId: MODULE_ID,
    i18n,
    connection: "restricted",
  });
  assert.equal(model.canOrderAutoRepair, true);

  const gmIng = buildWorkspaceModel({ station: "engineering", isGM: true, users: [], moduleId: MODULE_ID, i18n });
  assert.equal(gmIng.canOrderAutoRepair, false);

  const navegacion = buildWorkspaceModel({ station: "navigation", isGM: false, users: [], moduleId: MODULE_ID, i18n });
  assert.equal(navegacion.canOrderAutoRepair, false);
});

test("autoRepairActivo refleja el auto_repair publicado, y null/ausente no es cero (#464/#466)", () => {
  const base = { station: "engineering", isGM: false, users: [], moduleId: MODULE_ID, i18n };

  const activa = buildWorkspaceModel({
    ...base,
    statePayload: { ship: { ...statePayload.ship, auto_repair: true } },
  });
  assert.equal(activa.autoRepairActivo, true);

  const inactiva = buildWorkspaceModel({
    ...base,
    statePayload: { ship: { ...statePayload.ship, auto_repair: false } },
  });
  assert.equal(inactiva.autoRepairActivo, false);

  const sinLectura = buildWorkspaceModel({
    ...base,
    statePayload: { ship: { ...statePayload.ship, auto_repair: null } },
  });
  assert.equal(sinLectura.autoRepairActivo, false);

  const sinTelemetria = buildWorkspaceModel(base);
  assert.equal(sinTelemetria.autoRepairActivo, false);
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

test("sensores puede ordenar escaneo como tripulación, con un objetivo por contacto ajeno (#462)", () => {
  const sensores = {
    contactos: [
      { banda: "corto", esJugador: false, callsign: "Argia", faction: "Humanos", distancia: 1230, rumboDeg: 90, precision: 10, rumboPrecision: 1 },
      { banda: "largo", esJugador: false, callsign: null, faction: null, distancia: 20000, rumboDeg: 75, precision: 1000, rumboPrecision: 15 },
      { banda: "propia", esJugador: true, callsign: "Lagunak", faction: "Humanos", distancia: 0, rumboDeg: 0, precision: 0, rumboPrecision: 0 },
    ],
    alcance: { corto: 5000, largo: 30000 },
  };
  const modelo = buildWorkspaceModel({
    station: "sensors",
    isGM: false,
    users: [user({ id: "p1", station: "sensors" })],
    moduleId: MODULE_ID,
    i18n,
    sensores,
    connection: "restricted",
  });
  assert.equal(modelo.canOrderScan, true);
  // La nave propia no es un objetivo de escaneo: no aparece en la lista.
  assert.equal(modelo.scanTargets.length, 2, "un objetivo por contacto ajeno, ninguno para la propia nave");
  const [identificado, eco] = modelo.scanTargets;
  assert.deepEqual(JSON.parse(identificado.value), {
    distancia: 1230,
    rumboDeg: 90,
    precision: 10,
    rumboPrecision: 1,
  });
  assert.deepEqual(JSON.parse(eco.value), { distancia: 20000, rumboDeg: 75, precision: 1000, rumboPrecision: 15 });

  const gmSensores = buildWorkspaceModel({ station: "sensors", isGM: true, users: [], moduleId: MODULE_ID, i18n, sensores });
  assert.equal(gmSensores.canOrderScan, false, "el GM no emite órdenes de puesto");
  assert.deepEqual(gmSensores.scanTargets, []);

  const navegacion = buildWorkspaceModel({ station: "navigation", isGM: false, users: [], moduleId: MODULE_ID, i18n, sensores });
  assert.equal(navegacion.canOrderScan, false);
});

test("armas puede fijar objetivo y disparar tubos, con la misma lista de objetivos que sensores (#465)", () => {
  const sensores = {
    contactos: [
      { banda: "corto", esJugador: false, callsign: "Argia", faction: "Humanos", distancia: 1230, rumboDeg: 90, precision: 10, rumboPrecision: 1 },
      { banda: "largo", esJugador: false, callsign: null, faction: null, distancia: 20000, rumboDeg: 75, precision: 1000, rumboPrecision: 15 },
      { banda: "propia", esJugador: true, callsign: "Lagunak", faction: "Humanos", distancia: 0, rumboDeg: 0, precision: 0, rumboPrecision: 0 },
    ],
    alcance: { corto: 5000, largo: 30000 },
  };
  const modelo = buildWorkspaceModel({
    station: "weapons",
    isGM: false,
    users: [user({ id: "p1", station: "weapons" })],
    moduleId: MODULE_ID,
    i18n,
    sensores,
    connection: "restricted",
  });
  assert.equal(modelo.canOrderWeaponTarget, true);
  assert.equal(modelo.canOrderFireTube, true);
  assert.equal(modelo.weaponTargets.length, 2, "un objetivo por contacto ajeno, ninguno para la propia nave");
  assert.deepEqual(JSON.parse(modelo.weaponTargets[0].value), {
    distancia: 1230,
    rumboDeg: 90,
    precision: 10,
    rumboPrecision: 1,
  });

  const gmArmas = buildWorkspaceModel({ station: "weapons", isGM: true, users: [], moduleId: MODULE_ID, i18n, sensores });
  assert.equal(gmArmas.canOrderWeaponTarget, false, "el GM no emite órdenes de puesto");
  assert.equal(gmArmas.canOrderFireTube, false);
  assert.deepEqual(gmArmas.weaponTargets, []);

  const navegacion = buildWorkspaceModel({ station: "navigation", isGM: false, users: [], moduleId: MODULE_ID, i18n, sensores });
  assert.equal(navegacion.canOrderWeaponTarget, false);
  assert.equal(navegacion.canOrderFireTube, false);
  assert.deepEqual(navegacion.weaponTargets, []);
});

test("comunicaciones puede contestar/cerrar/dialogar/chatear como tripulación, no el GM ni otros puestos (#463)", () => {
  const comms = buildWorkspaceModel({
    station: "communications",
    isGM: false,
    users: [user({ id: "p1", station: "communications" })],
    moduleId: MODULE_ID,
    i18n,
    connection: "restricted",
  });
  assert.equal(comms.canOrderCommsHail, true);
  assert.equal(comms.canOrderCommsClose, true);
  assert.equal(comms.canOrderCommsReply, true);
  assert.equal(comms.canOrderCommsMessage, true);
  assert.equal(comms.canOrderShields, false);

  const gmComms = buildWorkspaceModel({ station: "communications", isGM: true, users: [], moduleId: MODULE_ID, i18n });
  assert.equal(gmComms.canOrderCommsHail, false);
  assert.equal(gmComms.canOrderCommsClose, false);
  assert.equal(gmComms.canOrderCommsReply, false);
  assert.equal(gmComms.canOrderCommsMessage, false);

  const armas = buildWorkspaceModel({ station: "weapons", isGM: false, users: [], moduleId: MODULE_ID, i18n });
  assert.equal(armas.canOrderCommsHail, false);
  assert.equal(armas.canOrderCommsClose, false);
  assert.equal(armas.canOrderCommsReply, false);
  assert.equal(armas.canOrderCommsMessage, false);
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
  // La fila del GM lleva ahora `lectura` en vez de `x`/`y` sueltos (#331 paso 3):
  // la misma plantilla sirve para su sondeo crudo y para la lectura degradada de
  // la tripulación, y lo que cambia es el contenido, no la forma. El GM sigue
  // viendo coordenadas exactas y sin márgenes.
  assert.deepEqual(model.contacts, [
    { eco: false, callsign: "Eco-1", faction: "LAGUNAK.Facciones.Independent", lectura: "10, 20" },
  ]);
  assert.equal(Object.hasOwn(model.contacts[0], "hostile"), false);
  assert.equal(model.contactsDegradados, false, "el GM no lee degradado");
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

test("los valores de estilo derivados del puente no aceptan CSS ni fingen rumbo norte", () => {
  const model = buildWorkspaceModel({
    station: "navigation",
    isGM: true,
    users: [],
    moduleId: MODULE_ID,
    i18n,
    statePayload: { ship: { ...statePayload.ship, heading: "90deg; color:red" } },
    connection: "ok",
  });
  assert.equal(model.navigationHeading, null);
  assert.equal(model.navigationHeadingKnown, false);
  assert.equal(model.navigationAriaLabel, "LAGUNAK.Espacios.Metrica.Rumbo: LAGUNAK.Espacios.Sensores.SinLectura");
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

test("cada tripulante trae su retrato, y el retrato no sustituye al texto (#352)", () => {
  const model = buildWorkspaceModel({
    station: "captain",
    isGM: false,
    users: [
      user({ id: "p1", station: "engineering" }),
      { ...user({ id: "p2", station: null }), active: false },
    ],
    moduleId: MODULE_ID,
    i18n,
  });

  const [enLinea, desconectado] = model.crew;
  assert.match(enLinea.portrait, /^data:image\/svg\+xml,/);
  // El texto sigue llevando la información: el retrato es un ancla visual, no
  // el canal por el que se comunica puesto ni estado.
  assert.ok(enLinea.stationLabel);
  assert.ok(desconectado.statusLabel);

  // Se siembra con el id: dos tripulantes distintos, retratos distintos.
  assert.notEqual(enLinea.portrait, desconectado.portrait);

  // Y el estado de presencia llega hasta el dibujo, no solo hasta la clase CSS.
  const svg = decodeURIComponent(desconectado.portrait.split(",")[1]);
  for (const [, color] of svg.matchAll(/fill="(#[0-9a-f]{6})"/gi)) {
    assert.equal(color.slice(1, 3), color.slice(3, 5), `${color} no es gris`);
  }
});

test("cascoRumbo distingue «sin lectura» de rumbo cero (#362)", () => {
  // Es la misma trampa que resolvió barras-estado: si la ausencia se degradara
  // a 0, el visor enseñaría una nave apuntando al norte cuando en realidad no
  // se sabe nada de ella.
  const conRumbo = buildWorkspaceModel({
    station: "navigation",
    isGM: true,
    users: [],
    moduleId: "m",
    i18n: { localize: (k) => k, format: (k) => k },
    statePayload: { ship: { callsign: "Itsaso 1", heading: 214 } },
    connection: "ok",
  });
  assert.equal(conRumbo.cascoRumbo, 214);

  const aCero = buildWorkspaceModel({
    station: "navigation",
    isGM: true,
    users: [],
    moduleId: "m",
    i18n: { localize: (k) => k, format: (k) => k },
    statePayload: { ship: { callsign: "Itsaso 1", heading: 0 } },
    connection: "ok",
  });
  assert.equal(aCero.cascoRumbo, 0, "cero es un rumbo, no una ausencia");

  const sinNada = buildWorkspaceModel({
    station: "navigation",
    isGM: true,
    users: [],
    moduleId: "m",
    i18n: { localize: (k) => k, format: (k) => k },
    statePayload: null,
    connection: "error",
  });
  assert.equal(sinNada.cascoRumbo, null, "sin telemetría no hay rumbo que dibujar");
});

test("REGRESIÓN: rumbo nulo o vacío NO es norte", () => {
  // `Number.isFinite(Number(x))` aceptaba `null` y `""` porque los dos valen
  // cero: la ausencia de dato se convertía en «rumbo 0» y el casco se pintaba
  // como si fuera una lectura buena. Ausencia no es cero — esa es la regla que
  // sostiene el visor entero.
  const modelo = (heading) =>
    buildWorkspaceModel({
      station: "navigation",
      isGM: true,
      users: [],
      moduleId: "m",
      i18n: { localize: (k) => k, format: (k) => k },
      statePayload: { ship: { callsign: "Itsaso 1", heading } },
      connection: "ok",
    });

  for (const ausente of [null, undefined, "", "   ", NaN, Infinity, -Infinity, {}, [], true]) {
    assert.equal(
      modelo(ausente).cascoRumbo,
      null,
      `sin lectura con ${JSON.stringify(ausente) ?? String(ausente)}`,
    );
  }

  // Y lo que SÍ es una lectura sigue siéndolo, incluido el cero y la cadena que
  // puede entregar el puente.
  assert.equal(modelo(0).cascoRumbo, 0, "cero es un rumbo");
  assert.equal(modelo(214).cascoRumbo, 214);
  assert.equal(modelo("214").cascoRumbo, 214, "el puente puede entregarlo como texto");
  assert.equal(modelo("0").cascoRumbo, 0);
});

test("REGRESIÓN: el casco lo ve la tripulación, no solo el GM", async () => {
  const plantillaPuesto = await readFile(
    new URL("../templates/espacio-puesto.hbs", import.meta.url),
    "utf8",
  );
  // El visor vivía dentro de `{{#if hasTelemetry}}`, y la telemetría solo la
  // recibe el GM: en un cliente de tripulación —que es para quien se hizo— no
  // existía ningún lienzo que pintar. La primera superficie visible del 3D solo
  // aparecía en la pantalla de quien dirige.
  const plantilla = plantillaPuesto;
  const lienzo = plantilla.indexOf("data-lagunak-casco");
  const telemetria = plantilla.indexOf("{{#if hasTelemetry}}");
  assert.ok(lienzo > 0 && telemetria > 0, "la plantilla tiene visor y bloque de telemetría");
  assert.ok(lienzo < telemetria, "el visor se pinta ANTES, fuera del bloque de telemetría");

  // Y el modelo de un jugador sin telemetría sigue diciendo la verdad: no hay
  // rumbo que dibujar, así que el visor se queda quieto y gris.
  const jugador = buildWorkspaceModel({
    station: "navigation",
    isGM: false,
    users: [],
    moduleId: "m",
    i18n: { localize: (k) => k, format: (k) => k },
    statePayload: null,
    connection: "restricted",
  });
  assert.equal(jugador.hasTelemetry, false, "el jugador no recibe telemetría, como debe ser");
  assert.equal(jugador.cascoRumbo, null, "y sin lectura no se inventa un rumbo");
});

// ---- Contactos degradados en la consola de tripulación (#331, paso 3) -------

test("la tripulación ve los contactos que le llegaron degradados, no el crudo", () => {
  const crudo = {
    contacts: [
      { callsign: "Argia", faction: "Humanos", is_player: false, position: { x: 1000, y: 0 } },
    ],
    total: 9,
    truncated: true,
  };
  const sensores = {
    contactos: [
      { banda: "largo", esJugador: false, callsign: null, faction: null, position: { x: 20000, y: 0 }, precision: 1000 },
    ],
    alcance: { corto: 5000, largo: 30000 },
  };
  const modelo = buildWorkspaceModel({
    station: "sensors",
    isGM: false,
    users: [],
    moduleId: "lagunak",
    i18n: { localize: (k) => k, format: (k) => k },
    statePayload: { ship: { callsign: "Lagunak", systems: {} } },
    contactsPayload: crudo,
    sensores,
    connection: "ok",
  });
  const texto = JSON.stringify(modelo);
  // Lo que importa: el crudo pasó por la función y NO salió por el otro lado.
  assert.doesNotMatch(texto, /Argia/, "el indicativo del crudo no llega a la tripulación");
  // Y el recuento es el de lo visible, no el total del GM: un «9» diría «hay
  // ocho cosas más ahí fuera», que es el dato que el puesto tiene que ganarse.
  const contactos = modelo.metrics.find((m) => m.label.endsWith("Contactos"));
  assert.equal(contactos.value, "1");
});

test("sin difusión de sensores la tripulación no ve contactos, como antes", () => {
  const modelo = buildWorkspaceModel({
    station: "sensors",
    isGM: false,
    users: [],
    moduleId: "lagunak",
    i18n: { localize: (k) => k, format: (k) => k },
    statePayload: { ship: { callsign: "Lagunak", systems: {} } },
    contactsPayload: { contacts: [{ callsign: "Argia", is_player: false }], total: 4 },
    sensores: null,
    connection: "ok",
  });
  assert.doesNotMatch(JSON.stringify(modelo), /Argia/);
  const contactos = modelo.metrics.find((m) => m.label.endsWith("Contactos"));
  assert.equal(contactos.value, "0");
});

test("el GM sigue viendo su sondeo crudo, con su total", () => {
  const modelo = buildWorkspaceModel({
    station: "sensors",
    isGM: true,
    users: [],
    moduleId: "lagunak",
    i18n: { localize: (k) => k, format: (k) => k },
    statePayload: { ship: { callsign: "Lagunak", systems: {} } },
    contactsPayload: {
      contacts: [{ callsign: "Argia", is_player: false, position: { x: 1000, y: 0 } }],
      total: 9,
    },
    sensores: null,
    connection: "ok",
  });
  const total = modelo.metrics.find((m) => m.label.endsWith("TotalSensor"));
  assert.equal(total.value, "9", "degradar a la tripulación no le quita precisión al GM");
});

test("la tripulación ve la lectura degradada como filas, no como un número suelto", () => {
  // El pago visible del paso 3: el dato estaba difundido y la consola solo
  // enseñaba un recuento.
  const modelo = buildWorkspaceModel({
    station: "sensors",
    isGM: false,
    users: [],
    moduleId: MODULE_ID,
    i18n,
    statePayload: { ship: { callsign: "Lagunak", systems: {} } },
    contactsPayload: { contacts: [{ callsign: "SECRETO", is_player: false, position: { x: 1, y: 2 } }] },
    sensores: {
      contactos: [
        { banda: "largo", callsign: null, faction: null, distancia: 20000, rumboDeg: 75, precision: 1000, rumboPrecision: 15 },
        { banda: "corto", callsign: "Argia", faction: "Humanos", distancia: 1230, rumboDeg: 90, precision: 10, rumboPrecision: 1 },
      ],
    },
    connection: "ok",
  });
  assert.equal(modelo.contacts.length, 2);
  assert.equal(modelo.contacts[0].callsign, "Argia", "lo más cercano primero");
  assert.equal(modelo.contacts[1].eco, true);
  assert.equal(modelo.contactsDegradados, true, "y la cabecera dice de dónde sale");
  // El crudo del GM no se cuela por esta ruta ni aunque venga en el mismo modelo.
  assert.doesNotMatch(JSON.stringify(modelo.contacts), /SECRETO/);
});

test("el visor del piloto recibe la lectura de sensores, y solo pilotaje", () => {
  // El visor 3D (#362) necesita distancia y marcación como NÚMEROS, no como las
  // filas ya formateadas que consumen ciencia y artillería. Se le pasa la misma
  // lectura degradada que ya se difunde a toda la tripulación, así que no abre
  // ni un dato nuevo: lo único que hace es colocarlo en un cuadro.
  const sensores = {
    contactos: [
      { banda: "corto", esJugador: false, callsign: "Argia", faction: "Humanos", distancia: 2000, rumboDeg: 45, precision: 10, rumboPrecision: 1 },
    ],
    alcance: { corto: 5000, largo: 30000 },
  };
  const comun = {
    isGM: false,
    users: [],
    moduleId: "lagunak",
    i18n: { localize: (k) => k, format: (k) => k },
    statePayload: { ship: { callsign: "Lagunak", heading: 90, systems: {} } },
    sensores,
    connection: "ok",
  };

  const piloto = buildWorkspaceModel({ ...comun, station: "navigation" });
  assert.equal(piloto.sensores, sensores, "pilotaje sí recibe la lectura cruda");
  assert.equal(piloto.isNavigation, true);

  // Las demás consolas no tienen visor, así que tampoco tienen por qué cargar
  // con la lectura: lo que no se usa no se pasa.
  for (const station of ["sensors", "weapons", "engineering", "communications", "captain"]) {
    assert.equal(buildWorkspaceModel({ ...comun, station }).sensores, null, station);
  }
});

test("en pilotaje la distancia y la marcación siguen en texto, no solo en el visor", () => {
  // El bloqueante de la revisión de #431: el visor va `aria-hidden` y era la
  // ÚNICA vía a esos dos datos en la consola de pilotaje —`contacts` se armaba
  // solo para ciencia y artillería—, así que quien no lo viera los perdía
  // enteros. El contrato de #362 dice lo contrario: el 3D es refuerzo, y lo que
  // informa se lee escrito.
  const sensores = {
    contactos: [
      { banda: "corto", esJugador: false, callsign: "Argia", faction: "Humanos", distancia: 2000, rumboDeg: 45, precision: 10, rumboPrecision: 1 },
    ],
    alcance: { corto: 5000, largo: 30000 },
  };
  const modelo = buildWorkspaceModel({
    station: "navigation",
    isGM: false,
    users: [],
    moduleId: MODULE_ID,
    i18n,
    statePayload: { ship: { callsign: "Lagunak", heading: 90, systems: {} } },
    sensores,
    connection: "ok",
  });
  assert.equal(modelo.contacts.length, 1, "pilotaje lista lo que su visor coloca");
  const [fila] = modelo.contacts;
  assert.match(fila.lectura, /2\D?000/, "la distancia, escrita");
  assert.match(fila.lectura, /45°/, "y la marcación, escrita");
  assert.equal(modelo.contactsDegradados, true);
});

test("pilotaje lee lo degradado también siendo GM: el visor no pinta otra cosa", () => {
  // La lista de pilotaje existe para respaldar el visor, y el visor pinta la
  // lectura degradada. Enseñar aquí coordenadas exactas describiría un cuadro
  // distinto del que hay en pantalla; ciencia, que es donde el crudo tiene
  // oficio, sigue viéndolo.
  const comun = {
    isGM: true,
    users: [],
    moduleId: MODULE_ID,
    i18n,
    statePayload: { ship: { callsign: "Lagunak", heading: 90, systems: {} } },
    contactsPayload: { contacts: [{ callsign: "SECRETO", is_player: false, position: { x: 1234, y: 5678 } }] },
    sensores: { contactos: [{ banda: "largo", esJugador: false, distancia: 20000, rumboDeg: 75, precision: 1000, rumboPrecision: 15 }] },
    connection: "ok",
  };

  const piloto = buildWorkspaceModel({ ...comun, station: "navigation" });
  assert.doesNotMatch(JSON.stringify(piloto.contacts), /SECRETO/);
  assert.equal(piloto.contacts[0].eco, true);
  assert.equal(piloto.contactsDegradados, true);

  const ciencia = buildWorkspaceModel({ ...comun, station: "sensors" });
  assert.match(JSON.stringify(ciencia.contacts), /SECRETO/, "el GM no pierde su sondeo donde le sirve");
  assert.equal(ciencia.contactsDegradados, false);
});

test("sin sondeo el modelo de pilotaje lleva null, no un sondeo vacío", () => {
  // `null` apaga el visor; `{contactos: []}` lo enciende diciendo «he mirado y
  // no hay nada». Confundirlos es el cuarto estado (#353) al revés.
  const modelo = buildWorkspaceModel({
    station: "navigation",
    isGM: false,
    users: [],
    moduleId: "lagunak",
    i18n: { localize: (k) => k, format: (k) => k },
    statePayload: { ship: { callsign: "Lagunak", systems: {} } },
    sensores: null,
    connection: "ok",
  });
  assert.equal(modelo.sensores, null);
});

// --- Maniobra de combate y atraque en la consola de pilotaje (#519) -----------

function pilotaje({ ship, sensores = null }) {
  return buildWorkspaceModel({
    station: "navigation",
    isGM: false,
    users: [user({ id: "p1", station: "navigation" })],
    moduleId: MODULE_ID,
    i18n: i18nEs,
    statePayload: { ship },
    sensores,
    connection: "ok",
  });
}

// --- Base de datos científica y vista de sonda (#520) -------------------------

function sensoresDe({ ship = { callsign: "Lagunak", systems: {} }, baseDatos, sensoresSonda } = {}) {
  return buildWorkspaceModel({
    station: "sensors",
    isGM: false,
    users: [user({ id: "p1", station: "sensors" })],
    moduleId: MODULE_ID,
    i18n: i18nEs,
    statePayload: { ship },
    baseDatos,
    sensoresSonda,
    connection: "ok",
  });
}

// --- Consola de Relay (#517) --------------------------------------------------

function enlace(ship, sensores = null) {
  return buildWorkspaceModel({
    station: "relay",
    isGM: false,
    users: [user({ id: "p1", station: "relay" })],
    moduleId: MODULE_ID,
    i18n: i18nEs,
    statePayload: { ship },
    sensores,
    connection: "ok",
  });
}

// --- Autodestrucción y frecuencia de escudos en la consola (#518) -------------

function ingenieria(ship) {
  return buildWorkspaceModel({
    station: "engineering",
    isGM: false,
    users: [user({ id: "p1", station: "engineering" })],
    moduleId: MODULE_ID,
    i18n: i18nEs,
    statePayload: { ship },
    connection: "ok",
  });
}

// --- Consola de control de daños (#522) ---------------------------------------

function control(ship) {
  return buildWorkspaceModel({
    station: "damagecontrol",
    isGM: false,
    users: [user({ id: "p1", station: "damagecontrol" })],
    moduleId: MODULE_ID,
    i18n: i18nEs,
    statePayload: { ship },
    connection: "ok",
  });
}

test("pilotaje ofrece maniobra de combate y atraque, y solo pilotaje", () => {
  const modelo = pilotaje({ ship: { callsign: "Lagunak", systems: {} } });
  assert.equal(modelo.canOrderCombatManeuver, true);
  assert.equal(modelo.canOrderDock, true);
  assert.equal(modelo.canOrderUndock, true);
  assert.equal(modelo.canOrderAbortDock, true);

  const ingenieria = buildWorkspaceModel({
    station: "engineering",
    isGM: false,
    users: [user({ id: "p1", station: "engineering" })],
    moduleId: MODULE_ID,
    i18n: i18nEs,
    statePayload: { ship: { callsign: "Lagunak", systems: {} } },
    connection: "ok",
  });
  assert.equal(ingenieria.canOrderCombatManeuver, false);
  assert.equal(ingenieria.canOrderDock, false);
});

test("la carga de maniobra se lee de la telemetría y no se estima", () => {
  const modelo = pilotaje({
    ship: { callsign: "Lagunak", systems: {}, combat_maneuver: { charge: 0.42 } },
  });
  assert.equal(modelo.maniobraCarga, 42);
  assert.match(modelo.maniobraCargaTexto, /42/);
});

test("sin lectura de maniobra no se pinta un cero", () => {
  // La distinción que sostiene el criterio de #519: `null` es «no sé si puedes
  // maniobrar» y 0 es «no puedes». Colapsarlas convierte una ausencia de sondeo
  // en una afirmación sobre la nave.
  const sinComponente = pilotaje({ ship: { callsign: "Lagunak", systems: {} } });
  assert.equal(sinComponente.maniobraCarga, null);
  assert.doesNotMatch(sinComponente.maniobraCargaTexto, /0/);

  const cargaCero = pilotaje({
    ship: { callsign: "Lagunak", systems: {}, combat_maneuver: { charge: 0 } },
  });
  assert.equal(cargaCero.maniobraCarga, 0);
  assert.match(cargaCero.maniobraCargaTexto, /0/);
  assert.notEqual(cargaCero.maniobraCargaTexto, sinComponente.maniobraCargaTexto);
});

test("los objetivos de atraque salen de la MISMA lectura degradada, no del crudo", () => {
  const sensores = {
    contactos: [
      { distancia: 1200, rumboDeg: 45, precision: 100, rumboPrecision: 5, indicativo: null },
    ],
  };
  const modelo = pilotaje({ ship: { callsign: "Lagunak", systems: {} }, sensores });
  assert.equal(modelo.dockTargets.length, 1);
  // El valor que viaja es la lectura, no un indicativo: el timón no se entera
  // del nombre de una estación solo por querer amarrar en ella; resolverlo es
  // trabajo del relé del GM (#237, #462).
  const valor = JSON.parse(modelo.dockTargets[0].value);
  assert.equal(valor.distancia, 1200);
  assert.equal(valor.indicativo, undefined);
});

test("sin sondeo no hay objetivos de atraque inventados", () => {
  const modelo = pilotaje({ ship: { callsign: "Lagunak", systems: {} }, sensores: null });
  assert.deepEqual(modelo.dockTargets, []);
});

test("la autodestrucción no se ofrece si la nave no puede autodestruirse", () => {
  // Sin componente el puente publica null. Un botón que no hace nada es peor
  // que no tener botón: promete una salida que no existe.
  const sinComponente = ingenieria({ callsign: "Lagunak", systems: {} });
  assert.equal(sinComponente.canOrderSelfDestruct, false);

  const conComponente = ingenieria({
    callsign: "Lagunak",
    systems: {},
    self_destruct: { active: false, countdown: null },
  });
  assert.equal(conComponente.canOrderSelfDestruct, true);
});

test("confirmar código solo aparece con la secuencia ya armada", () => {
  // Teclear un código antes de armar no significa nada, y ofrecerlo sugeriría
  // que el ritual ya está en marcha.
  const desarmada = ingenieria({
    callsign: "Lagunak",
    systems: {},
    self_destruct: { active: false, countdown: null },
  });
  assert.equal(desarmada.canOrderDestructCode, false);

  const armada = ingenieria({
    callsign: "Lagunak",
    systems: {},
    self_destruct: { active: true, countdown: 42 },
  });
  assert.equal(armada.canOrderDestructCode, true);
  assert.match(armada.autodestruccionTexto, /42/);
});

test("sin lectura de autodestrucción no se dice que esté desarmada", () => {
  const sinLectura = ingenieria({ callsign: "Lagunak", systems: {} });
  const desarmada = ingenieria({
    callsign: "Lagunak",
    systems: {},
    self_destruct: { active: false, countdown: null },
  });
  assert.notEqual(sinLectura.autodestruccionTexto, desarmada.autodestruccionTexto);
});

test("el modelo NUNCA transporta códigos de autodestrucción", () => {
  // La frontera que sostiene el puzle: la telemetría que el GM reparte viaja
  // por un ajuste de mundo que toda la mesa puede leer, así que un código aquí
  // sería un código público.
  const modelo = ingenieria({
    callsign: "Lagunak",
    systems: {},
    self_destruct: { active: true, countdown: 30, code: [1111, 2222, 3333] },
  });
  const serializado = JSON.stringify(modelo);
  assert.doesNotMatch(serializado, /1111/);
  assert.doesNotMatch(serializado, /2222/);
});

test("recalibrar avisa de que los escudos se caen mientras dura", () => {
  // Ese aviso es lo que convierte un número en una decisión.
  const calibrando = ingenieria({
    callsign: "Lagunak",
    systems: {},
    shield_calibration: { frequency: 12, calibration_delay: 4 },
  });
  assert.match(calibrando.frecuenciaEscudosTexto, /12/);
  assert.match(calibrando.frecuenciaEscudosTexto, /caíd/i);

  const estable = ingenieria({
    callsign: "Lagunak",
    systems: {},
    shield_calibration: { frequency: 12, calibration_delay: 0 },
  });
  assert.match(estable.frecuenciaEscudosTexto, /12/);
  assert.doesNotMatch(estable.frecuenciaEscudosTexto, /caíd/i);

  const sinLectura = ingenieria({ callsign: "Lagunak", systems: {} });
  assert.notEqual(sinLectura.frecuenciaEscudosTexto, estable.frecuenciaEscudosTexto);
});

test("relay ofrece rutas, sondas, enlace y condición de alerta", () => {
  const modelo = enlace({ callsign: "Lagunak", systems: {} });
  assert.equal(modelo.canOrderWaypoints, true);
  assert.equal(modelo.canOrderProbe, true);
  assert.equal(modelo.canOrderScienceLink, true);
  assert.equal(modelo.canOrderAlertLevel, true);
});

test("la condición declarada se lee del puente y no se deduce del daño", () => {
  // La distinción que resuelve el choque con #338: esto es la postura que la
  // tripulación ha declarado, no el aviso derivado de casco y energía. Una nave
  // intacta puede estar en alerta roja, y una hecha trizas en normal.
  const intactaEnRoja = enlace({
    callsign: "Lagunak",
    systems: {},
    hull: 100,
    hull_max: 100,
    alert_level: "red",
  });
  assert.equal(intactaEnRoja.alertaDeclarada, "red");
  assert.match(intactaEnRoja.alertaDeclaradaTexto, /roja/i);
});

test("sin lectura de condición no se dice 'normal'", () => {
  // Caer a normal sería afirmar que la nave está tranquila justo cuando no se
  // sabe si lo está.
  const modelo = enlace({ callsign: "Lagunak", systems: {} });
  assert.equal(modelo.alertaDeclarada, null);
  assert.doesNotMatch(modelo.alertaDeclaradaTexto, /normal/i);
});

test("las sondas restantes se publican con su máximo, y cero es una lectura", () => {
  const conStock = enlace({ callsign: "Lagunak", systems: {}, probes: { stock: 3, max: 8 } });
  assert.match(conStock.sondasTexto, /3/);
  assert.match(conStock.sondasTexto, /8/);

  const agotadas = enlace({ callsign: "Lagunak", systems: {}, probes: { stock: 0, max: 8 } });
  assert.match(agotadas.sondasTexto, /0/);

  const sinLectura = enlace({ callsign: "Lagunak", systems: {} });
  assert.notEqual(sinLectura.sondasTexto, agotadas.sondasTexto);
});

test("los objetivos de enlace salen de la lectura degradada, no del crudo", () => {
  const sensores = {
    contactos: [
      { distancia: 4000, rumboDeg: 210, precision: 500, rumboPrecision: 10, indicativo: null },
    ],
  };
  const modelo = enlace({ callsign: "Lagunak", systems: {} }, sensores);
  assert.equal(modelo.probeTargets.length, 1);
  const valor = JSON.parse(modelo.probeTargets[0].value);
  assert.equal(valor.distancia, 4000);
  assert.equal(valor.indicativo, undefined);

  assert.deepEqual(enlace({ callsign: "Lagunak", systems: {} }).probeTargets, []);
});

test("ningún otro puesto recibe el control de frecuencia ni el de armar", () => {
  for (const puesto of ["navigation", "sensors", "communications", "weapons", "relay"]) {
    const modelo = buildWorkspaceModel({
      station: puesto,
      isGM: false,
      users: [user({ id: "p1", station: puesto })],
      moduleId: MODULE_ID,
      i18n: i18nEs,
      statePayload: {
        ship: { callsign: "Lagunak", systems: {}, self_destruct: { active: true, countdown: 10 } },
      },
      connection: "ok",
    });
    assert.equal(modelo.canOrderShieldFrequency, false, puesto);
    assert.equal(modelo.canOrderSelfDestruct, false, puesto);
  }
});

const BASE = {
  entradas: [
    { id: "Naves", nombre: "Naves", padre: null, descripcion: "Clasificación", valores: [] },
  ],
  total: 1,
  truncada: false,
};

test("la base de datos es consulta y no orden: no entra en la matriz", () => {
  // No hay `canOrder*` para esto a propósito. Autorizar una lectura que no
  // cambia nada sería inventar una puerta donde no hace falta ninguna.
  const modelo = sensoresDe({ baseDatos: BASE });
  assert.equal(modelo.tieneBaseDatos, true);
  assert.equal(modelo.canOrderBaseDatos, undefined);
  assert.equal(modelo.baseDatosEntradas.length, 1);
});

test("no consultada y vacía se dicen distinto", () => {
  // Una base vacía es una respuesta; no haberla pedido no lo es.
  const sinConsultar = sensoresDe({});
  const vacia = sensoresDe({ baseDatos: { entradas: [], total: 0, truncada: false } });
  assert.equal(sinConsultar.tieneBaseDatos, false);
  assert.equal(vacia.tieneBaseDatos, true);
  assert.notEqual(sinConsultar.baseDatosTexto, vacia.baseDatosTexto);
});

const INTERIOR = {
  rooms: [
    { x: 0, y: 0, w: 2, h: 1, system: "reactor" },
    { x: 2, y: 0, w: 1, h: 1, system: null },
  ],
  crews: [
    { position: { x: 0, y: 0 }, target: { x: 2, y: 0 } },
    { position: { x: 1, y: 0 }, target: null },
  ],
};

test("la planta que se pinta es la del motor, con su sistema por sala", () => {
  // El riesgo que señalaba el issue: pintar equipos sobre la planta declarativa
  // de la sección de la nave (#427) sería pintar sobre un plano que no es este.
  const modelo = control({ callsign: "Lagunak", systems: {}, internal: INTERIOR });
  assert.equal(modelo.tieneInterior, true);
  assert.equal(modelo.plantaSalas.length, 2);
  assert.match(modelo.plantaSalas[0].etiqueta, /reactor/i);
  // Una sala sin sistema no se queda sin nombre: se llama pasillo.
  assert.ok(modelo.plantaSalas[1].etiqueta.length > 0);
});

test("el valor que viaja del equipo es su POSICIÓN, no su índice", () => {
  // El orden de las entidades no está garantizado: un índice podría referirse a
  // otro equipo entre dos sondeos, y mover al equivocado en mitad de una avería
  // es peor que no mover a ninguno.
  const modelo = control({ callsign: "Lagunak", systems: {}, internal: INTERIOR });
  const valor = JSON.parse(modelo.equiposReparacion[0].valor);
  assert.deepEqual(valor, { x: 0, y: 0 });
  // El número solo sirve para nombrarlo en pantalla.
  assert.equal(modelo.equiposReparacion[0].numero, 1);
  assert.equal(modelo.equiposReparacion[0].enMovimiento, true);
  assert.equal(modelo.equiposReparacion[1].enMovimiento, false);
});

test("sin interior no se pinta un plano en blanco", () => {
  // Una nave sin salas no es una nave con cero salas.
  const modelo = control({ callsign: "Lagunak", systems: {} });
  assert.equal(modelo.tieneInterior, false);
  assert.deepEqual(modelo.plantaSalas, []);
  assert.deepEqual(modelo.equiposReparacion, []);
});

test("ningún otro puesto recibe los controles de relay", () => {
  for (const puesto of ["captain", "navigation", "engineering", "sensors", "weapons", "damagecontrol"]) {
    const modelo = buildWorkspaceModel({
      station: puesto,
      isGM: false,
      users: [user({ id: "p1", station: puesto })],
      moduleId: MODULE_ID,
      i18n: i18nEs,
      statePayload: { ship: { callsign: "Lagunak", systems: {} } },
      connection: "ok",
    });
    assert.equal(modelo.canOrderAlertLevel, false, puesto);
    assert.equal(modelo.canOrderProbe, false, puesto);
  }
});

test("la base de datos solo la ve sensores", () => {
  for (const puesto of ["captain", "navigation", "engineering", "communications", "weapons"]) {
    const modelo = buildWorkspaceModel({
      station: puesto,
      isGM: false,
      users: [user({ id: "p1", station: puesto })],
      moduleId: MODULE_ID,
      i18n: i18nEs,
      statePayload: { ship: { callsign: "Lagunak", systems: {} } },
      baseDatos: BASE,
      connection: "ok",
    });
    assert.equal(modelo.tieneBaseDatos, false, puesto);
    assert.deepEqual(modelo.baseDatosEntradas, [], puesto);
  }
});

test("la vista de sonda solo aparece con enlace", () => {
  const sinEnlace = sensoresDe({});
  assert.equal(sinEnlace.hayEnlaceSonda, false);

  const conEnlace = sensoresDe({
    ship: { callsign: "Lagunak", systems: {}, science_link: { callsign: "P-1" } },
    sensoresSonda: { contactos: [{ etiqueta: "eco a 900" }] },
  });
  assert.equal(conEnlace.hayEnlaceSonda, true);
  assert.match(conEnlace.enlaceSondaTexto, /P-1/);
  assert.equal(conEnlace.sensoresSonda.contactos.length, 1);
});

test("la lectura de la sonda no se le pasa a otros puestos", () => {
  // Es trabajo de sensores. Repartirla a todos regalaría justo lo que hace de
  // este puesto un puesto.
  const armas = buildWorkspaceModel({
    station: "weapons",
    isGM: false,
    users: [user({ id: "p1", station: "weapons" })],
    moduleId: MODULE_ID,
    i18n: i18nEs,
    statePayload: { ship: { callsign: "Lagunak", systems: {}, science_link: { callsign: "P-1" } } },
    sensoresSonda: { contactos: [{ etiqueta: "eco a 900" }] },
    connection: "ok",
  });
  assert.equal(armas.sensoresSonda, null);
});

test("ningún otro puesto recibe el control de equipos", () => {
  for (const puesto of ["captain", "navigation", "engineering", "sensors", "communications", "weapons", "relay"]) {
    const modelo = buildWorkspaceModel({
      station: puesto,
      isGM: false,
      users: [user({ id: "p1", station: puesto })],
      moduleId: MODULE_ID,
      i18n: i18nEs,
      statePayload: { ship: { callsign: "Lagunak", systems: {}, internal: INTERIOR } },
      connection: "ok",
    });
    assert.equal(modelo.canOrderRepairCrew, false, puesto);
  }
});
