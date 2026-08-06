import assert from "node:assert/strict";
import test from "node:test";

import { colisiona } from "../scripts/nave-movimiento.mjs";
import {
  ESTACIONES,
  PLANTA_PASILLO_PUENTE,
  componerPasilloPuente,
  PUERTA_PASILLO_HACIA_VESTIBULO,
  puertaHaciaEstacion,
} from "../scripts/nave-pasillo-puente.mjs";

test("ESTACIONES declara las cinco estaciones del puente, sin duplicar z", () => {
  assert.equal(ESTACIONES.length, 5);
  const zs = ESTACIONES.map((e) => e.z);
  assert.equal(new Set(zs).size, zs.length);
});

test("el pasillo colisiona en sus límites salvo en cada puerta", () => {
  assert.equal(colisiona(2, -0.1, 0.3, PLANTA_PASILLO_PUENTE), true);
  assert.equal(colisiona(0.5, PUERTA_PASILLO_HACIA_VESTIBULO.z + 1, 0.3, PLANTA_PASILLO_PUENTE), false);
  for (const estacion of ESTACIONES) {
    const puerta = puertaHaciaEstacion(estacion);
    assert.equal(colisiona(PLANTA_PASILLO_PUENTE.ancho - 0.5, puerta.z + 1, 0.3, PLANTA_PASILLO_PUENTE), false);
  }
});

test("componerPasilloPuente devuelve una escena con polígonos", () => {
  const escena = componerPasilloPuente(2, 0, 4, 0, { ancho: 160, alto: 90 });
  assert.ok(escena.poligonos.length > 0);
});
