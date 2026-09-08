import assert from "node:assert/strict";
import test from "node:test";

import {
  STATIONS,
  STATION_ASSIGNMENT_ERRORS,
  assignStation,
  canAssignStation,
  normalizeStation,
  stationRows,
  uncrewedStations,
  visibleCrew,
} from "../scripts/station-assignment.mjs";

function user({ id, name = id, isGM = false, active = true, station = null } = {}) {
  return {
    id,
    name,
    isGM,
    active,
    flags: station ? { station } : {},
    getFlag(_moduleId, key) { return this.flags[key]; },
    async setFlag(_moduleId, key, value) { this.flags[key] = value; },
    async unsetFlag(_moduleId, key) { delete this.flags[key]; },
  };
}

const i18n = { localize: (key) => key };

test("los puestos canónicos son cerrados y los valores desconocidos se rechazan", () => {
  assert.deepEqual(STATIONS, [
    "captain",
    "navigation",
    "engineering",
    "sensors",
    "communications",
    "weapons",
    // #517: Relay va el último para no reordenar los que la mesa ya conoce.
    "relay",
    // #522: Damage Control va el último para no reordenar los que la mesa ya
    // tiene aprendidos.
    "damagecontrol",
  ]);
  assert.equal(normalizeStation("engineering"), "engineering");
  assert.equal(normalizeStation(""), null);
  assert.throws(() => normalizeStation("pilot"), /Unknown crew station/);
});

test("cada jugador puede asignarse su propio puesto y limpiarlo", async () => {
  const player = user({ id: "p1" });

  assert.equal(canAssignStation(player, player), true);
  await assignStation({ actor: player, target: player, station: "navigation", moduleId: "lagunak" });
  assert.equal(player.flags.station, "navigation");

  await assignStation({ actor: player, target: player, station: "", moduleId: "lagunak" });
  assert.equal(player.flags.station, undefined);
});

test("un jugador no puede cambiar el puesto de otro", async () => {
  const actor = user({ id: "p1" });
  const target = user({ id: "p2" });

  assert.equal(canAssignStation(actor, target), false);
  await assert.rejects(
    assignStation({ actor, target, station: "weapons", moduleId: "lagunak" }),
    (error) => error.code === STATION_ASSIGNMENT_ERRORS.NOT_ALLOWED,
  );
  assert.equal(target.flags.station, undefined);
});

test("el GM puede corregir el puesto de cualquier jugador", async () => {
  const gm = user({ id: "gm", isGM: true });
  const target = user({ id: "p1", station: "weapons" });

  await assignStation({ actor: gm, target, station: "sensors", moduleId: "lagunak" });
  assert.equal(target.flags.station, "sensors");
});

test("el jugador solo ve su fila y el GM ve toda la tripulación, conectada o no", () => {
  const gm = user({ id: "gm", isGM: true });
  const p1 = user({ id: "p1", name: "Uno", station: "engineering" });
  const p2 = user({ id: "p2", name: "Dos", active: false });
  const users = [gm, p1, p2];

  assert.deepEqual(visibleCrew(users, p1).map((entry) => entry.id), ["p1"]);
  assert.deepEqual(visibleCrew(users, gm).map((entry) => entry.id), ["p1", "p2"]);

  const rows = stationRows({ users, actor: gm, moduleId: "lagunak", i18n });
  assert.equal(rows[0].stations.find((entry) => entry.value === "engineering").selected, true);
  assert.equal(rows[1].active, false);
  assert.equal(rows.every((entry) => entry.canEdit), true);
});

test("ocupado a vacío: desconectar al usuario activo vuelve a marcar su puesto", () => {
  const navigation = user({ id: "p1", station: "navigation", active: true });

  assert.equal(uncrewedStations([navigation], "lagunak").includes("navigation"), false);
  navigation.active = false;
  assert.equal(uncrewedStations([navigation], "lagunak").includes("navigation"), true);
});

test("vacío a ocupado: conectar a un usuario con asignación efectiva retira el aviso", () => {
  const engineering = user({ id: "p1", station: "engineering", active: false });

  assert.equal(uncrewedStations([engineering], "lagunak").includes("engineering"), true);
  engineering.active = true;
  assert.equal(uncrewedStations([engineering], "lagunak").includes("engineering"), false);
});

test("solo usuarios reales activos y asignaciones canónicas atienden puestos", () => {
  const gm = user({ id: "gm", isGM: true, station: "captain" });
  const disconnected = user({ id: "p1", active: false, station: "weapons" });
  const invalid = user({ id: "p2" });
  invalid.flags.station = "pilot";

  const uncrewed = uncrewedStations([gm, disconnected, invalid], "lagunak");
  assert.deepEqual(uncrewed, STATIONS);
});
