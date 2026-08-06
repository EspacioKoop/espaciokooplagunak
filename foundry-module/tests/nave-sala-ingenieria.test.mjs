import assert from "node:assert/strict";
import test from "node:test";

import { colisiona } from "../scripts/nave-movimiento.mjs";
import {
  PLANTA_INGENIERIA,
  componerIngenieria,
  PUERTA_INGENIERIA_HACIA_A,
} from "../scripts/nave-sala-ingenieria.mjs";

test("la sala de ingeniería colisiona en sus límites salvo en la puerta hacia 'a'", () => {
  assert.equal(colisiona(4, -0.1, 0.3, PLANTA_INGENIERIA), true);
  assert.equal(colisiona(PUERTA_INGENIERIA_HACIA_A.x + 1, 0.5, 0.3, PLANTA_INGENIERIA), false);
});

test("componerIngenieria devuelve una escena con polígonos y estrellas por la ventana", () => {
  const escena = componerIngenieria(4, 0, 4, 0, { ancho: 200, alto: 100 });
  assert.equal(escena.ancho, 200);
  assert.equal(escena.alto, 100);
  assert.ok(escena.poligonos.length > 0);
  // Mirando hacia el muro norte (yaw=0, la ventana está en z=8) debe haber
  // algo de cielo: la sala tiene ventana por requisito de #508.
  assert.ok(escena.estrellas.length > 0);
});
