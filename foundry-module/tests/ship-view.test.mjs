import assert from "node:assert/strict";
import test from "node:test";

import { localizeSystemName, prepareRoute, prepareSystemRows } from "../scripts/ship-view.mjs";

const i18n = {
  localize: (key) => key,
  format: (key, data) => `${key}:${JSON.stringify(data)}`,
};

const destination = { name: "Argia", position: { x: 28000, y: -16000 } };

test("sin destino conserva compatibilidad y no crea ruta", () => {
  assert.equal(prepareRoute({ destination: null }, i18n), null);
});

test("nave detenida muestra distancia y ETA no disponible", () => {
  const route = prepareRoute(
    { destination, distance_to_destination: 32015.6, eta_seconds: null },
    i18n,
  );
  assert.equal(route.name, "Argia");
  assert.match(route.distanceLabel, /"distance":"32.0"/);
  assert.equal(route.etaLabel, "LAGUNAK.EstadoNave.EtaDetenida");
});

test("nave en movimiento formatea una ETA finita", () => {
  const route = prepareRoute(
    { destination, distance_to_destination: 1000, eta_seconds: 252.4 },
    i18n,
  );
  assert.match(route.etaLabel, /"minutes":4/);
  assert.match(route.etaLabel, /"seconds":12/);
});

test("los sistemas del DTO se localizan sin exponer identificadores ingleses", () => {
  assert.equal(localizeSystemName("beamweapons", i18n), "LAGUNAK.Sistemas.beamweapons");
  assert.equal(localizeSystemName("unknown-drive", i18n), "LAGUNAK.Sistemas.Desconocido");
  const rows = prepareSystemRows({
    systems: { jumpdrive: { health: 0.75, heat: 0.2, power: 1.5, coolant: 0.4 } },
  }, i18n);
  assert.deepEqual(rows, [{
    id: "jumpdrive",
    name: "LAGUNAK.Sistemas.jumpdrive",
    health: 75,
    heat: 20,
    power: 150,
    coolant: 40,
  }]);
});
