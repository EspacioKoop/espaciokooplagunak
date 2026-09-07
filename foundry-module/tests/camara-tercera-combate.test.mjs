import assert from "node:assert/strict";
import test from "node:test";

import {
  CASILLA_COMBATE,
  limitarPosicionCombate,
  resolverCamaraTerceraCombate,
} from "../scripts/camara-tercera-combate.mjs";

test("limitarPosicionCombate mantiene el cuerpo dentro de la casilla de 5 ft", () => {
  assert.equal(CASILLA_COMBATE, 5);
  assert.deepEqual(limitarPosicionCombate({ x: -1, z: 7 }), { x: 0, z: 5 });
});

test("resolverCamaraTerceraCombate retira la cámara detrás y pinta el cuerpo", () => {
  const view = resolverCamaraTerceraCombate({ x: 2, z: 3, yaw: 0 });

  assert.deepEqual(view.posicion, { x: 2, z: 3 });
  assert.ok(view.camara[2] < 3);
  assert.ok(view.camara[1] > 1.45);
  assert.equal(view.dibujarPropio, true);
});

test("la cámara sigue la posición limitada y el yaw", () => {
  const view = resolverCamaraTerceraCombate({ x: 8, z: -2, yaw: Math.PI / 2 });

  assert.deepEqual(view.posicion, { x: 5, z: 0 });
  assert.ok(view.camara[0] < 5);
  assert.ok(Math.abs(view.camara[2]) < 1e-9);
});
