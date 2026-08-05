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
