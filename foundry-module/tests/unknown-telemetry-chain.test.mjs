// Synthetic fixtures only — OTACON Astra, #1005. No live bridge/Foundry data.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { recortarNave, sobreTelemetria, difundirTelemetria, aceptarTelemetria, aceptarSensores, aceptarSensoresSonda } from "../scripts/ship-view/telemetria-difusion.mjs";
import { buildWorkspaceModel } from "../scripts/station-workspaces.mjs";
const es = JSON.parse(readFileSync(new URL("../lang/es.json", import.meta.url)));
const i18n = { localize: k => es[k] ?? k, format: (k, data) => Object.entries(data).reduce((s, [key, v]) => s.replaceAll(`{${key}}`, String(v)), es[k] ?? k) };
const radar = { short_range: 100, long_range: 2000 };
const contact = (position, extra = {}) => ({ callsign: "Synthetic contact", scan_state: "full", position, ...extra });
const fixture = value => ({ ship: { callsign: "Synthetic ship", position: { x: 0, y: 0 }, radar, heading: value, hull: value, energy: value, shields: [value], systems: { reactor: { health: value, heat: value, power: value, coolant: value } }, combat_maneuver: { charge: value }, self_destruct: { active: true, countdown: value, code: "SYNTHETIC-NOT-FOR-CREW" }, shield_calibration: { frequency: value, calibration_delay: value }, probes: { stock: value, max: value }, token: "SYNTHETIC-NOT-FOR-CREW" } });
function consume(state, contacts = { contacts: [] }, station = "navigation") {
  let wire;
  difundirTelemetria({ statePayload: state, contactsPayload: contacts, ahora: 100, publicar: s => { wire = JSON.parse(JSON.stringify(s)); } });
  return { wire, model: buildWorkspaceModel({ station, isGM: false, users: [], moduleId: "espaciokoop-lagunak", i18n, connection: "ok", statePayload: { ship: aceptarTelemetria(wire) }, sensores: aceptarSensores(wire), sensoresSonda: aceptarSensoresSonda(wire) }) };
}
test("probe-only loss and recovery are published, not hidden by ship deduplication", () => {
  const state = fixture(0);
  state.ship.science_link = { callsign: "Synthetic probe", position: { x: 0, y: 0 } };
  const contactsPayload = { contacts: [contact({ x: 30, y: 0 })] };
  const previous = sobreTelemetria(state, 1, contactsPayload);
  state.ship.science_link.position.x = null;
  const writes = [];
  const next = difundirTelemetria({ statePayload: state, contactsPayload, anterior: previous, ahora: 2, publicar: s => writes.push(JSON.parse(JSON.stringify(s))) });
  assert.equal(writes.length, 1);
  assert.equal(aceptarSensoresSonda(writes[0]), null);
  state.ship.science_link.position.x = 0;
  difundirTelemetria({ statePayload: state, contactsPayload, anterior: next, ahora: 3, publicar: s => writes.push(JSON.parse(JSON.stringify(s))) });
  assert.equal(writes.length, 2);
  assert.equal(aceptarSensoresSonda(writes[1]).contactos.length, 1);
});
const invalid = [null, undefined, "", " \t", false, true, [], [0], {}, NaN, Infinity, "not-a-number"];
for (const [index, value] of invalid.entries()) {
  test(`unknown fixture ${index}: producer → JSON publication → receiver → workspace`, () => {
    const { wire, model } = consume(fixture(value));
    assert.equal(wire.ship.heading, null);
    assert.equal(wire.ship.hull, null);
    assert.equal(wire.ship.energy, null);
    assert.deepEqual(wire.ship.shields, [null]);
    assert.deepEqual(wire.ship.systems.reactor, { health: null, heat: null, power: null, coolant: null });
    assert.equal(wire.ship.combat_maneuver, null);
    assert.equal(wire.ship.shield_calibration, null);
    assert.equal(wire.ship.probes, null);
    assert.equal(wire.ship.self_destruct.countdown, null);
    assert.equal(model.maniobraCarga, null);
    assert.equal(model.maniobraCargaTexto, es["LAGUNAK.Espacios.Orden.ManiobraSinLectura"]);
    assert.equal(model.cascoRumbo, null);
    assert.equal(model.navigationHeading, null);
    assert.equal(model.navigationHeadingKnown, false);
    assert.equal(model.metrics[0].value, "—°");
    assert.equal(model.metrics[2].value, "—, —");
    assert.doesNotMatch(JSON.stringify(wire), /SYNTHETIC-NOT-FOR-CREW/);
    assert.equal("position" in wire.ship, false);
    assert.equal("hull_max" in wire.ship, false);
    const engineering = consume(fixture(value), undefined, "engineering").model;
    assert.equal(engineering.metrics[0].value, "— / —");
    assert.equal(engineering.metrics[0].hasProgress, false);
    assert.equal(engineering.metrics[0].tone, "normal");
    assert.equal(engineering.metrics[1].value, "—");
    assert.deepEqual(engineering.systems[0], {
      id: "reactor",
      name: es["LAGUNAK.Sistemas.reactor"],
      health: null,
      heat: null,
      power: null,
      coolant: null,
    });
    assert.equal(engineering.autodestruccionTexto, es["LAGUNAK.Espacios.Orden.AutodestruccionArmada"]);
  });
  test(`invalid coordinate fixture ${index}: both axes, player, ship and probe centers`, () => {
    for (const axis of ["x", "y"]) {
      const position = { x: 0, y: 0, [axis]: value };
      for (const is_player of [false, true]) {
        const { wire, model } = consume(fixture(0), { contacts: [contact(position, { is_player })] });
        assert.deepEqual(wire.sensores.contactos, []);
        assert.deepEqual(model.dockTargets, []);
      }
      const state = fixture(0);
      state.ship.position = position;
      state.ship.science_link = { callsign: "Synthetic probe", position };
      const { wire, model } = consume(state, { contacts: [contact({ x: 0, y: 0 })] });
      assert.equal(wire.sensores, null);
      assert.equal(wire.sensoresSonda, null);
      assert.equal(model.sensores, null);
    }
  });
}
test("measured zero and numeric strings remain readings, not absence", () => {
  for (const value of [0, "0"]) {
    const { wire, model } = consume(fixture(value), { contacts: [contact({ x: value, y: value })] });
    assert.equal(model.maniobraCarga, 0);
    assert.equal(model.cascoRumbo, 0);
    assert.equal(model.metrics[0].value, "0°");
    assert.equal(wire.sensores.contactos.length, 1);
    assert.equal(wire.sensores.contactos[0].distancia, 0);
  }
  assert.equal(recortarNave(fixture("12.34").ship).heading, 12.3);
});
test("valid measurements do not expand privacy or scan/range resolution", () => {
  const { wire } = consume(fixture(0), { contacts: [contact({ x: 43, y: 0 }, { scan_state: "none" }), contact({ x: 1234, y: 0 }), contact({ x: 3000, y: 0 })] });
  assert.equal(wire.sensores.contactos.length, 2);
  assert.equal(wire.sensores.contactos[0].callsign, null);
  assert.equal(wire.sensores.contactos[0].precision, 10);
  assert.equal(wire.sensores.contactos[1].precision, 1000);
  assert.equal(wire.sensores.contactos[1].rumboPrecision, 15);
  assert.ok(wire.sensores.contactos.every(c => !("position" in c)));
});
test("interior refuses missing room/crew coordinates and preserves zero", () => {
  const room = { x: 0, y: 0, w: 2, h: 2 };
  for (const value of invalid) {
    assert.equal(recortarNave({ internal: { rooms: [{ ...room, x: value }] } }).internal, null);
    const internal = recortarNave({ internal: { rooms: [room], crews: [{ position: { x: value, y: 0 } }, { position: { x: 0, y: 0 }, target: { x: 0, y: value } }] } }).internal;
    assert.deepEqual(internal.crews, [{ position: { x: 0, y: 0 }, target: null }]);
  }
});
test("zero → unknown publishes once rather than retaining a false zero", () => {
  const previous = sobreTelemetria(fixture(0), 1);
  let writes = 0;
  const next = difundirTelemetria({ statePayload: fixture(null), anterior: previous, publicar: () => writes++, ahora: 2 });
  assert.equal(writes, 1);
  assert.equal(next.ship.heading, null);
  assert.equal(difundirTelemetria({ statePayload: fixture(null), anterior: next, publicar: () => writes++, ahora: 3 }), null);
  assert.equal(writes, 1);
});
