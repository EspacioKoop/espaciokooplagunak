import assert from "node:assert/strict";
import test from "node:test";

import {
  crearCamaraFoto,
  orbitarCamaraFoto,
  moverCamaraFoto,
  controlesCamaraFoto,
} from "../scripts/camara-foto.mjs";

test("la cámara foto solo permite movimiento y órbita al GM", () => {
  assert.deepEqual(controlesCamaraFoto({ esGM: true }), {
    mover: true,
    orbitar: true,
    zoom: true,
    capturar: true,
  });
  assert.deepEqual(controlesCamaraFoto({ esGM: false }), {
    mover: false,
    orbitar: false,
    zoom: false,
    capturar: true,
  });
});

test("moverCamaraFoto no cambia la cámara de un jugador", () => {
  const camera = crearCamaraFoto({ esGM: false, posicion: { x: 1, y: 2, z: 3 } });

  assert.deepEqual(moverCamaraFoto(camera, { x: 10, y: 0, z: -4 }), camera);
  assert.deepEqual(moverCamaraFoto({ ...camera, esGM: true }, { x: 10, y: 0, z: -4 }).posicion, {
    x: 11,
    y: 2,
    z: -1,
  });
});

test("orbitarCamaraFoto limita el pitch para evitar voltear la cámara", () => {
  const camera = crearCamaraFoto({ esGM: true });
  const orbited = orbitarCamaraFoto(camera, { yaw: Math.PI, pitch: 99 });

  assert.equal(orbited.orbita.yaw, Math.PI);
  assert.ok(orbited.orbita.pitch < Math.PI / 2);
  assert.ok(orbited.orbita.pitch > -Math.PI / 2);
  assert.equal(crearCamaraFoto().orbita.yaw, 0);
});
