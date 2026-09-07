import assert from "node:assert/strict";
import test from "node:test";

import {
  ALTURA_OJOS_COMBATE,
  CASILLA_COMBATE,
  CASILLA_COMBATE_METROS,
  limitarMovimientoCasilla,
  moverEnCasilla,
  resolverCamaraPov,
} from "../scripts/camara-pov-combate.mjs";

test("CASILLA_COMBATE_METROS convierte la casilla de 5 ft a metros", () => {
  assert.equal(CASILLA_COMBATE, 5);
  assert.ok(Math.abs(CASILLA_COMBATE_METROS - 1.524) < 1e-9);
});

test("limitarMovimientoCasilla mantiene al personaje dentro de una casilla de 5 ft (en metros)", () => {
  assert.deepEqual(limitarMovimientoCasilla({ x: -3, z: 9 }), {
    x: 0,
    z: CASILLA_COMBATE_METROS,
  });
  assert.deepEqual(limitarMovimientoCasilla({ x: 0.5, z: 1 }), { x: 0.5, z: 1 });
});

test("moverEnCasilla aplica el delta y no muta la posición anterior", () => {
  const position = { x: 0.2, z: 0.3 };
  const moved = moverEnCasilla(position, { x: 0.5, z: 0.5 });

  assert.deepEqual(moved, { x: 0.7, z: 0.8 });
  assert.deepEqual(position, { x: 0.2, z: 0.3 });
});

test("moverEnCasilla no traspasa el límite de la casilla en metros, no en pies", () => {
  const moved = moverEnCasilla({ x: 1, z: 1 }, { x: 5, z: 5 });
  assert.deepEqual(moved, { x: CASILLA_COMBATE_METROS, z: CASILLA_COMBATE_METROS });
});

test("resolverCamaraPov conserva yaw y altura de ojos de la cámara de nave", () => {
  const view = resolverCamaraPov({ x: 0.5, z: 1, yaw: Math.PI / 2, y: 0.4 });

  assert.deepEqual(view, {
    camara: [0.5, ALTURA_OJOS_COMBATE + 0.4, 1],
    yaw: Math.PI / 2,
    dibujarPropio: false,
  });
});
