import assert from "node:assert/strict";
import test from "node:test";

import {
  CASILLA_COMBATE,
  CASILLA_COMBATE_METROS,
  limitarPosicionCombate,
  resolverCamaraTerceraCombate,
} from "../scripts/camara-tercera-combate.mjs";

test("CASILLA_COMBATE_METROS convierte la casilla de 5 ft a metros", () => {
  assert.equal(CASILLA_COMBATE, 5);
  assert.ok(Math.abs(CASILLA_COMBATE_METROS - 1.524) < 1e-9);
});

test("limitarPosicionCombate mantiene el cuerpo dentro de la casilla de 5 ft (en metros)", () => {
  assert.deepEqual(limitarPosicionCombate({ x: -1, z: 7 }), {
    x: 0,
    z: CASILLA_COMBATE_METROS,
  });
});

test("resolverCamaraTerceraCombate retira la cámara detrás y pinta el cuerpo", () => {
  const view = resolverCamaraTerceraCombate({ x: 1, z: 1, yaw: 0 });

  assert.deepEqual(view.posicion, { x: 1, z: 1 });
  assert.ok(view.camara[2] < 1);
  assert.ok(view.camara[1] > 1.45);
  assert.equal(view.dibujarPropio, true);
});

test("la cámara sigue la posición limitada (en metros, no en pies) y el yaw", () => {
  const view = resolverCamaraTerceraCombate({ x: 8, z: -2, yaw: Math.PI / 2 });

  assert.deepEqual(view.posicion, { x: CASILLA_COMBATE_METROS, z: 0 });
  assert.ok(view.camara[0] < CASILLA_COMBATE_METROS);
  assert.ok(Math.abs(view.camara[2]) < 1e-9);
});

test("casilla desplazada y negativa limita relativo al origen sin teletransporte", () => {
  for (const origen of [{ x: 4.572, z: 6.096 }, { x: -8, z: -12 }]) {
    const interior = { x: origen.x + 0.4, z: origen.z + 0.7 };
    assert.deepEqual(limitarPosicionCombate(interior, origen), interior);
    assert.deepEqual(limitarPosicionCombate({ x: origen.x - 2, z: origen.z + 5 }, origen),
      { x: origen.x, z: origen.z + CASILLA_COMBATE_METROS });
  }
});

test("tercera aplica retiro al cuerpo en la casilla no originaria", () => {
  const origenCasilla = { x: 4.572, z: 6.096 };
  const vista = resolverCamaraTerceraCombate({ x: 5, z: 7, yaw: 0, origenCasilla });
  assert.deepEqual(vista.posicion, { x: 5, z: 7 });
  assert.deepEqual(vista.camara, [5, 2, 7 - 2.2]);
});
