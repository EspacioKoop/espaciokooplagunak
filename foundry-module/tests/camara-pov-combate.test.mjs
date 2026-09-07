import assert from "node:assert/strict";
import test from "node:test";

import {
  ALTURA_OJOS_COMBATE,
  CASILLA_COMBATE,
  limitarMovimientoCasilla,
  moverEnCasilla,
  resolverCamaraPov,
} from "../scripts/camara-pov-combate.mjs";

test("limitarMovimientoCasilla mantiene al personaje dentro de una casilla de 5 ft", () => {
  assert.equal(CASILLA_COMBATE, 5);
  assert.deepEqual(limitarMovimientoCasilla({ x: -3, z: 9 }), { x: 0, z: 5 });
  assert.deepEqual(limitarMovimientoCasilla({ x: 2, z: 4 }), { x: 2, z: 4 });
});

test("moverEnCasilla aplica el delta y no muta la posición anterior", () => {
  const position = { x: 1, z: 2 };
  const moved = moverEnCasilla(position, { x: 2, z: 4 });

  assert.deepEqual(moved, { x: 3, z: 5 });
  assert.deepEqual(position, { x: 1, z: 2 });
});

test("resolverCamaraPov conserva yaw y altura de ojos de la cámara de nave", () => {
  const view = resolverCamaraPov({ x: 2, z: 3, yaw: Math.PI / 2, y: 0.4 });

  assert.deepEqual(view, {
    camara: [2, ALTURA_OJOS_COMBATE + 0.4, 3],
    yaw: Math.PI / 2,
    dibujarPropio: false,
  });
});
