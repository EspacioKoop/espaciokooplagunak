import assert from "node:assert/strict";
import test from "node:test";

import { colisiona } from "../scripts/nave-movimiento.mjs";
import { ESTACIONES } from "../scripts/nave-pasillo-puente.mjs";
import { salaEstacion, entradaEstacion, PUERTA_ESTACION_HACIA_PASILLO } from "../scripts/nave-salas-puente.mjs";

test("hay una sala por cada estación declarada", () => {
  for (const estacion of ESTACIONES) {
    assert.ok(salaEstacion(estacion.id), `falta la sala de ${estacion.id}`);
  }
  assert.equal(salaEstacion("no-existe"), undefined);
});

test("cada sala de estación colisiona en sus límites salvo en su puerta, y ve estrellas por su ventana", () => {
  for (const estacion of ESTACIONES) {
    const sala = salaEstacion(estacion.id);
    assert.equal(colisiona(-0.1, 3, 0.3, sala.planta), true);
    assert.equal(colisiona(0.5, 3, 0.3, sala.planta), false);

    const { x, z, yaw } = entradaEstacion();
    const escena = sala.componer(x, 0, z, yaw, { ancho: 320, alto: 180 });
    assert.ok(escena.poligonos.length > 0, `${estacion.id}: sin polígonos`);
    assert.ok(escena.estrellas.length > 0, `${estacion.id}: sin ventana con cielo`);
  }
});

test("PUERTA_ESTACION_HACIA_PASILLO está en el muro oeste, igual en todas las salas", () => {
  assert.equal(PUERTA_ESTACION_HACIA_PASILLO.x, 0);
});
