import assert from "node:assert/strict";
import test from "node:test";

import { BridgeError } from "../scripts/bridge-client.mjs";
import {
  claveResultadoManiobra,
  IMPULSOS,
  NIVELES_WARP,
  OPS_MANIOBRA,
  ordenarManiobra,
  prepararVistaManiobra,
  RUMBOS,
} from "../scripts/maniobra-control.mjs";

const i18n = { localize: (key) => key, has: () => false };

function clienteEspia() {
  const enviado = [];
  return {
    enviado,
    setImpulse: async (v) => { enviado.push(["impulse", v]); return { result: { ok: true } }; },
    setWarp: async (v) => { enviado.push(["warp", v]); return { result: { ok: true } }; },
    setTargetHeading: async (v) => { enviado.push(["heading", v]); return { result: { ok: true } }; },
    setShields: async (v) => { enviado.push(["shields", v]); return { result: { ok: true } }; },
  };
}

test("catálogos dentro de los rangos que valida el puente", () => {
  assert.deepEqual([...IMPULSOS], [-1, -0.5, 0, 0.5, 1]);
  assert.deepEqual([...NIVELES_WARP], [0, 1, 2, 3, 4]);
  assert.deepEqual([...RUMBOS], [0, 45, 90, 135, 180, 225, 270, 315]);
  assert.deepEqual([...OPS_MANIOBRA], ["impulse", "warp", "heading", "shields"]);
  for (const v of IMPULSOS) assert.ok(v >= -1 && v <= 1);
  for (const v of NIVELES_WARP) assert.ok(Number.isInteger(v) && v >= 0 && v <= 4);
  for (const v of RUMBOS) assert.ok(v >= 0 && v <= 360);
});

test("ordenar: no-GM no toca la red y devuelve null", async () => {
  const client = clienteEspia();
  const r = await ordenarManiobra({ op: "impulse", value: 1, isGM: false, client });
  assert.equal(r, null);
  assert.deepEqual(client.enviado, []);
});

test("ordenar: cada op válida despacha al método correcto", async () => {
  const client = clienteEspia();
  await ordenarManiobra({ op: "impulse", value: 0.5, isGM: true, client });
  await ordenarManiobra({ op: "warp", value: 3, isGM: true, client });
  await ordenarManiobra({ op: "heading", value: 90, isGM: true, client });
  await ordenarManiobra({ op: "shields", value: true, isGM: true, client });
  assert.deepEqual(client.enviado, [
    ["impulse", 0.5], ["warp", 3], ["heading", 90], ["shields", true],
  ]);
});

test("ordenar: op desconocida se rechaza sin tocar la red", async () => {
  const client = clienteEspia();
  await assert.rejects(
    ordenarManiobra({ op: "teleport", value: 1, isGM: true, client }),
    (e) => e instanceof BridgeError && e.kind === "parse",
  );
  assert.deepEqual(client.enviado, []);
});

test("ordenar: valores fuera de catálogo se rechazan sin tocar la red", async () => {
  const client = clienteEspia();
  const casos = [
    { op: "impulse", value: 0.3 },
    { op: "impulse", value: 2 },
    { op: "warp", value: 2.5 },
    { op: "warp", value: 5 },
    { op: "heading", value: 30 },
    { op: "heading", value: 400 },
    { op: "shields", value: "on" },
    { op: "shields", value: 1 },
  ];
  for (const caso of casos) {
    await assert.rejects(
      ordenarManiobra({ ...caso, isGM: true, client }),
      (e) => e instanceof BridgeError && e.kind === "parse",
      `esperaba rechazo en ${JSON.stringify(caso)}`,
    );
  }
  assert.deepEqual(client.enviado, []);
});

test("clave de resultado: ok, sin nave y fallo", () => {
  assert.deepEqual(claveResultadoManiobra({ result: { ok: true } }), { ok: true, clave: "LAGUNAK.Maniobra.Enviada" });
  assert.deepEqual(claveResultadoManiobra({ result: { ok: false, reason: "no_ship" } }), { ok: false, clave: "LAGUNAK.Maniobra.SinNave" });
  assert.deepEqual(claveResultadoManiobra({}), { ok: false, clave: "LAGUNAK.Maniobra.Fallo" });
  assert.deepEqual(claveResultadoManiobra(null), { ok: false, clave: "LAGUNAK.Maniobra.Fallo" });
});

test("vista: sin nave queda no disponible", () => {
  const v = prepararVistaManiobra({ conexion: "ok", ship: null, i18n });
  assert.equal(v.disponible, false);
  assert.equal(v.puedeOrdenar, false);
  assert.equal(v.escudosActivos, false);
  assert.equal(v.escudosInactivos, false);
});

test("vista: con nave habilita, marca el impulso neutro y refleja escudos", () => {
  const v = prepararVistaManiobra({ conexion: "ok", ship: { shields_active: true }, i18n });
  assert.equal(v.disponible, true);
  assert.equal(v.puedeOrdenar, true);
  assert.equal(v.impulsos.length, 5);
  assert.equal(v.impulsos.find((i) => i.neutro).valor, 0);
  assert.equal(v.warps.length, 5);
  assert.equal(v.rumbos.length, 8);
  assert.equal(v.escudosActivos, true);
  assert.equal(v.escudosInactivos, false);
});

test("vista: escudos abajo se refleja como inactivo, no como desconocido", () => {
  const v = prepararVistaManiobra({ conexion: "ok", ship: { shields_active: false }, i18n });
  assert.equal(v.escudosActivos, false);
  assert.equal(v.escudosInactivos, true);
});

test("vista: conexión no-ok o pendiente deshabilita las órdenes", () => {
  const ship = { shields_active: true };
  assert.equal(prepararVistaManiobra({ conexion: "error", ship, i18n }).puedeOrdenar, false);
  assert.equal(prepararVistaManiobra({ conexion: "ok", ship, pendiente: true, i18n }).puedeOrdenar, false);
});

test("vista: etiqueta de impulso en porcentaje con signo", () => {
  const v = prepararVistaManiobra({ conexion: "ok", ship: { shields_active: true }, i18n });
  assert.equal(v.impulsos.find((i) => i.valor === -1).etiqueta, "-100%");
  assert.equal(v.impulsos.find((i) => i.valor === 0.5).etiqueta, "50%");
});
