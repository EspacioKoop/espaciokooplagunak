import assert from "node:assert/strict";
import test from "node:test";

import { ALTURA_OJOS, PRIMERA, TERCERA, alternarModo, resolverCamara } from "../scripts/nave-camara.mjs";

test("en primera persona la cámara está en los ojos y el cuerpo no se pinta", () => {
  const { camara, dibujarPropio } = resolverCamara({ x: 4, z: 6, yaw: 0, modo: PRIMERA });
  assert.deepEqual(camara, [4, ALTURA_OJOS, 6]);
  assert.equal(dibujarPropio, false, "verse a uno mismo en primera persona es estar dentro de tu cabeza");
});

test("en tercera persona la cámara se retira DETRÁS y el cuerpo se pinta", () => {
  // yaw 0 mira a +z, así que detrás es -z. Misma convención que nave-movimiento.
  const { camara, dibujarPropio } = resolverCamara({ x: 4, z: 6, yaw: 0, modo: TERCERA });
  assert.equal(camara[0], 4, "sin desviarse en x mirando a +z");
  assert.ok(camara[2] < 6, "la cámara tiene que quedar detrás, no delante");
  assert.ok(camara[1] > ALTURA_OJOS, "y algo más alta, para ver por encima del hombro");
  assert.equal(dibujarPropio, true);
});

test("la cámara se retira en la dirección del yaw, no siempre en la misma", () => {
  // Mirando a +x (yaw = π/2) hay que retirarse hacia -x.
  const { camara } = resolverCamara({ x: 4, z: 6, yaw: Math.PI / 2, modo: TERCERA });
  assert.ok(camara[0] < 4, `retirada hacia -x esperada, y salió x=${camara[0]}`);
  assert.ok(Math.abs(camara[2] - 6) < 1e-9, "mirando a +x no debe moverse en z");
});

test("el salto/agachado sube la cámara en los dos modos", () => {
  for (const modo of [PRIMERA, TERCERA]) {
    const quieto = resolverCamara({ x: 0, z: 0, yaw: 0, modo });
    const saltando = resolverCamara({ x: 0, z: 0, y: 0.8, yaw: 0, modo });
    assert.ok(saltando.camara[1] > quieto.camara[1], `el modo ${modo} ignora el salto`);
  }
});

test("un modo desconocido cae a primera persona en vez de romper", () => {
  const { camara, dibujarPropio } = resolverCamara({ x: 1, z: 2, yaw: 0, modo: "orbital" });
  assert.deepEqual(camara, [1, ALTURA_OJOS, 2]);
  assert.equal(dibujarPropio, false);
});

test("alternar es un vaivén entre los dos únicos modos", () => {
  assert.equal(alternarModo(PRIMERA), TERCERA);
  assert.equal(alternarModo(TERCERA), PRIMERA);
  // Y desde un valor raro se va a tercera: alternar siempre tiene que CAMBIAR
  // algo, o el botón parecería roto.
  assert.equal(alternarModo("orbital"), TERCERA);
});

test("la distancia de retirada es corta: las salas miden once metros", () => {
  const { camara } = resolverCamara({ x: 0, z: 0, yaw: 0, modo: TERCERA });
  const retiro = Math.hypot(camara[0], camara[2]);
  assert.ok(retiro > 1.2 && retiro < 3, `retiro de ${retiro} m: fuera del rango jugable`);
});
