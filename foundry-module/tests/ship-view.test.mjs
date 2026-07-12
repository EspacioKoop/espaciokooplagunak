import assert from "node:assert/strict";
import test from "node:test";

import { prepareRoute } from "../scripts/ship-view.mjs";

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
