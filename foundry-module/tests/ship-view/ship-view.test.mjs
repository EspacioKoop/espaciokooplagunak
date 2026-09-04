import assert from "node:assert/strict";
import test from "node:test";

import {
  firmaEstadoNaveVisible,
  localizeSystemName,
  prepareRoute,
  prepareSystemRows,
} from "../../scripts/ship-view/ship-view.mjs";

const i18n = {
  localize: (key) => key,
  format: (key, data) => `${key}:${JSON.stringify(data)}`,
};

const destination = { name: "Argia", position: { x: 28000, y: -16000 } };

test("sin nave no hay ruta (la ventana muestra su propio aviso)", () => {
  assert.equal(prepareRoute(null, i18n), null);
});

test("sin destino la ruta sigue siendo legible: estado y etiquetas explícitas", () => {
  const route = prepareRoute({ destination: null }, i18n);
  assert.equal(route.estado, "sin_destino");
  assert.equal(route.name, "LAGUNAK.Ruta.SinDestino");
  assert.equal(route.distanceLabel, "—");
  assert.equal(route.etaLabel, "—");
});

test("destino sin distancia utilizable queda como sin datos, no oculto", () => {
  const route = prepareRoute(
    { destination, distance_to_destination: null },
    i18n,
  );
  assert.equal(route.estado, "sin_datos");
  assert.equal(route.name, "Argia");
  assert.equal(route.distanceLabel, "LAGUNAK.Ruta.SinDatos");
  assert.equal(route.etaLabel, "LAGUNAK.Ruta.SinDatos");
});

test("nave detenida muestra distancia y ETA no disponible", () => {
  const route = prepareRoute(
    {
      destination,
      distance_to_destination: 32015.6,
      eta_seconds: null,
      velocity: { x: 0, y: 0 },
    },
    i18n,
  );
  assert.equal(route.estado, "detenida");
  assert.equal(route.name, "Argia");
  assert.match(route.distanceLabel, /"distance":"32.0"/);
  assert.equal(route.etaLabel, "LAGUNAK.EstadoNave.EtaDetenida");
});

test("nave en movimiento sin ETA publicada queda como calculando", () => {
  const route = prepareRoute(
    {
      destination,
      distance_to_destination: 32015.6,
      eta_seconds: null,
      velocity: { x: 12.5, y: -3.1 },
    },
    i18n,
  );
  assert.equal(route.estado, "calculando");
  assert.equal(route.etaLabel, "LAGUNAK.Ruta.Calculando");
});

test("nave en movimiento formatea una ETA finita", () => {
  const route = prepareRoute(
    { destination, distance_to_destination: 1000, eta_seconds: 252.4 },
    i18n,
  );
  assert.equal(route.estado, "en_ruta");
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

const vistaBase = () => ({
  conexion: "ok",
  detalleError: "",
  ayudaAbierta: false,
  esGM: true,
  naveExiste: true,
  naveCallsign: "Artemis",
  ruta: { estado: "en_ruta", name: "Argia", distanceLabel: "12.3 u", etaLabel: "00:04:12" },
  pausa: { estado: "activa", puedePausar: true, puedeReanudar: false, foundryPausado: false },
  encuentros: { disponible: true, puedeIntroducir: true, pendiente: false },
  maniobra: { disponible: true, puedeOrdenar: true, escudosActivos: true },
  maniobraFallo: false,
  ingenieria: { disponible: true, puedeAjustar: true, pendiente: false, tieneReparadores: true },
  ingenieriaFallo: false,
  sistemas: [{ id: "reactor", salud: 90, calor: 10, potencia: 100 }],
});

test("firmaEstadoNaveVisible ignora telemetría continua", () => {
  const base = vistaBase();
  const soloTelemetriaDistinta = {
    ...vistaBase(),
    ruta: { ...base.ruta, distanceLabel: "8.1 u", etaLabel: "00:02:50" },
    sistemas: [{ id: "reactor", salud: 40, calor: 55, potencia: 60 }],
  };
  assert.equal(firmaEstadoNaveVisible(base), firmaEstadoNaveVisible(soloTelemetriaDistinta));
});

test("firmaEstadoNaveVisible detecta cambios que sí requieren reconstruir el panel", () => {
  const base = vistaBase();
  assert.notEqual(
    firmaEstadoNaveVisible(base),
    firmaEstadoNaveVisible({ ...base, conexion: "error" }),
  );
  assert.notEqual(
    firmaEstadoNaveVisible(base),
    firmaEstadoNaveVisible({ ...base, maniobraFallo: true }),
  );
  assert.notEqual(
    firmaEstadoNaveVisible(base),
    firmaEstadoNaveVisible({ ...base, ingenieria: { ...base.ingenieria, pendiente: true } }),
  );
  assert.notEqual(
    firmaEstadoNaveVisible(base),
    firmaEstadoNaveVisible({ ...base, encuentros: { ...base.encuentros, pendiente: true } }),
  );
  assert.notEqual(
    firmaEstadoNaveVisible(base),
    firmaEstadoNaveVisible({ ...base, sistemas: [{ id: "reactor", salud: 90, calor: 10, potencia: 100 }, { id: "warp", salud: 80, calor: 5, potencia: 70 }] }),
  );
});
