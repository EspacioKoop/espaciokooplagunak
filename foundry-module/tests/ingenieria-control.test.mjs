import assert from "node:assert/strict";
import test from "node:test";

import { BridgeError } from "../scripts/bridge-client.mjs";
import {
  ajustarPotencia,
  claveResultadoIngenieria,
  esNivelValido,
  esSistemaValido,
  NIVELES_POTENCIA,
  prepararVistaIngenieria,
  SISTEMAS_INGENIERIA,
} from "../scripts/ingenieria-control.mjs";

const i18n = { localize: (key) => key, has: () => false };

const shipCon = (systems, extra = {}) => ({ systems, ...extra });

test("catálogo de sistemas coincide con el enum cerrado del puente", () => {
  assert.deepEqual([...SISTEMAS_INGENIERIA], [
    "reactor", "beamweapons", "missilesystem", "maneuver", "impulse",
    "warp", "jumpdrive", "frontshield", "rearshield",
  ]);
});

test("validación de sistema y nivel", () => {
  assert.equal(esSistemaValido("reactor"), true);
  assert.equal(esSistemaValido("desconocido"), false);
  assert.equal(esSistemaValido(7), false);
  assert.equal(esNivelValido(1), true);
  assert.equal(esNivelValido(0.5), true);
  assert.equal(esNivelValido(3.1), false);
  assert.equal(esNivelValido(1.25), false);
  assert.equal(esNivelValido("1"), false);
  assert.equal(esNivelValido(NaN), false);
});

test("ajustar: no-GM no toca la red y devuelve null", async () => {
  let llamado = false;
  const client = { setSystemPower: async () => { llamado = true; } };
  const r = await ajustarPotencia({ system: "reactor", level: 1, isGM: false, client });
  assert.equal(r, null);
  assert.equal(llamado, false);
});

test("ajustar: sistema fuera de catálogo se rechaza sin tocar la red", async () => {
  let llamado = false;
  const client = { setSystemPower: async () => { llamado = true; } };
  await assert.rejects(
    ajustarPotencia({ system: "cocina", level: 1, isGM: true, client }),
    (e) => e instanceof BridgeError && e.kind === "parse",
  );
  assert.equal(llamado, false);
});

test("ajustar: nivel fuera de catálogo se rechaza sin tocar la red", async () => {
  let llamado = false;
  const client = { setSystemPower: async () => { llamado = true; } };
  await assert.rejects(
    ajustarPotencia({ system: "reactor", level: 2.75, isGM: true, client }),
    (e) => e instanceof BridgeError && e.kind === "parse",
  );
  assert.equal(llamado, false);
});

test("ajustar: GM con sistema y nivel válidos envía la orden", async () => {
  const enviado = [];
  const client = { setSystemPower: async (system, level) => { enviado.push([system, level]); return { result: { ok: true } }; } };
  const r = await ajustarPotencia({ system: "impulse", level: 1.5, isGM: true, client });
  assert.deepEqual(enviado, [["impulse", 1.5]]);
  assert.deepEqual(r, { result: { ok: true } });
});

test("un ACK aislado confirma orden aceptada, no energía ya ajustada", () => {
  const ack = claveResultadoIngenieria({ result: { ok: true } });
  assert.deepEqual(ack, { ok: true, clave: "LAGUNAK.Ingenieria.Aceptada" });
});

test("clave de resultado: sin nave y fallo", () => {
  assert.deepEqual(claveResultadoIngenieria({ result: { ok: false, reason: "no_ship" } }), { ok: false, clave: "LAGUNAK.Ingenieria.SinNave" });
  assert.deepEqual(claveResultadoIngenieria({}), { ok: false, clave: "LAGUNAK.Ingenieria.Fallo" });
  assert.deepEqual(claveResultadoIngenieria(null), { ok: false, clave: "LAGUNAK.Ingenieria.Fallo" });
});

test("vista: sin sistemas queda no disponible y sin telemetría de reparadores", () => {
  const v = prepararVistaIngenieria({ conexion: "ok", ship: null, i18n });
  assert.equal(v.disponible, false);
  assert.equal(v.puedeAjustar, false);
  assert.equal(v.tieneReparadores, false);
  assert.deepEqual(v.sistemas, []);
  assert.deepEqual(v.opcionesSistema, []);
});

test("vista: con sistemas habilita el ajuste y marca el nominal", () => {
  const ship = shipCon(
    { reactor: { health: 1, heat: 0.2, power: 1, coolant: 0 }, impulse: { health: 0.5, heat: 0.9, power: 1, coolant: 0.3 } },
    { repair_crew: 3.4 },
  );
  const v = prepararVistaIngenieria({ conexion: "ok", ship, i18n });
  assert.equal(v.disponible, true);
  assert.equal(v.puedeAjustar, true);
  assert.equal(v.tieneReparadores, true);
  assert.equal(v.reparadores, 3);
  assert.equal(v.sistemas.length, 2);
  assert.equal(v.opcionesSistema[0].seleccionado, true);
  assert.equal(v.opcionesSistema[0].id, "reactor");
  assert.equal(v.niveles.find((n) => n.nominal).valor, 1);
  assert.equal(v.niveles.find((n) => n.seleccionado).valor, 1);
});

test("vista: conexión no-ok o pendiente deshabilita el botón", () => {
  const ship = shipCon({ reactor: { health: 1, heat: 0, power: 1, coolant: 0 } });
  assert.equal(prepararVistaIngenieria({ conexion: "error", ship, i18n }).puedeAjustar, false);
  assert.equal(prepararVistaIngenieria({ conexion: "ok", ship, pendiente: true, i18n }).puedeAjustar, false);
});

test("vista: respeta la selección de sistema y nivel del GM cuando son válidos", () => {
  const ship = shipCon({ reactor: { health: 1, heat: 0, power: 1, coolant: 0 }, warp: { health: 1, heat: 0, power: 1, coolant: 0 } });
  const v = prepararVistaIngenieria({ conexion: "ok", ship, seleccionSistema: "warp", seleccionNivel: 2.5, i18n });
  assert.equal(v.opcionesSistema.find((o) => o.seleccionado).id, "warp");
  assert.equal(v.niveles.find((n) => n.seleccionado).valor, 2.5);
});

test("vista: selección de sistema ausente cae al primero presente", () => {
  const ship = shipCon({ reactor: { health: 1, heat: 0, power: 1, coolant: 0 } });
  const v = prepararVistaIngenieria({ conexion: "ok", ship, seleccionSistema: "warp", i18n });
  assert.equal(v.opcionesSistema.find((o) => o.seleccionado).id, "reactor");
});

test("todos los niveles son aceptados por el rango del puente (0..3)", () => {
  for (const level of NIVELES_POTENCIA) {
    assert.ok(level >= 0 && level <= 3);
  }
});
