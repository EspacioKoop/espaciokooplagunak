import assert from "node:assert/strict";
import test from "node:test";

import {
  crearCamaraFoto,
  orbitarCamaraFoto,
  moverCamaraFoto,
  zoomCamaraFoto,
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

test("zoomCamaraFoto solo cambia el zoom al GM y lo acota", () => {
  const jugador = crearCamaraFoto({ esGM: false, zoom: 2 });
  assert.deepEqual(zoomCamaraFoto(jugador, 1), jugador);

  const gm = crearCamaraFoto({ esGM: true, zoom: 1 });
  const acercado = zoomCamaraFoto(gm, 5);
  assert.ok(acercado.zoom <= 4);

  const alejado = zoomCamaraFoto(gm, -5);
  assert.ok(alejado.zoom >= 0.25);
});

test("zoom -> mover -> orbitar no pierde el zoom por el camino", () => {
  let camara = crearCamaraFoto({ esGM: true });
  camara = zoomCamaraFoto(camara, 1);
  assert.equal(camara.zoom, 2);

  camara = moverCamaraFoto(camara, { x: 1 });
  assert.equal(camara.zoom, 2, "moverCamaraFoto no debe resetear el zoom");

  camara = orbitarCamaraFoto(camara, { yaw: 1 });
  assert.equal(camara.zoom, 2, "orbitarCamaraFoto no debe resetear el zoom");
});
