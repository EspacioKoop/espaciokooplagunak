import assert from "node:assert/strict";
import test from "node:test";

import { colisiona } from "../scripts/nave-movimiento.mjs";
import { PLANTA_CANTINA, aNativo, desdeNativo } from "../scripts/cantina-planta.mjs";

test("desdeNativo y aNativo son inversas exactas", () => {
  const nativo = { x: -3, z: 5 };
  const planta = desdeNativo(nativo.x, nativo.z);
  const vuelta = aNativo(planta.x, planta.z);
  assert.ok(Math.abs(vuelta.x - nativo.x) < 1e-9);
  assert.ok(Math.abs(vuelta.z - nativo.z) < 1e-9);
});

test("el centro de la planta cae dentro de los límites conservadores", () => {
  assert.equal(colisiona(PLANTA_CANTINA.ancho / 2, PLANTA_CANTINA.profundidad / 2, 0.35, PLANTA_CANTINA), false);
});

test("la barra (cantina-escena.mjs) colisiona en su posición nativa real", () => {
  // Centro nativo de la barra: [0, -1.45, 4.2]. Trasladado a la planta con
  // desdeNativo, su centro debería colisionar.
  const centro = desdeNativo(0, 4.2);
  assert.equal(colisiona(centro.x, centro.z, 0.35, PLANTA_CANTINA), true);
});

test("las dos mesas colisionan cada una en su sitio, y no se confunden entre sí", () => {
  const mesaIzq = desdeNativo(-3.4, 5.2);
  const mesaDer = desdeNativo(3.9, 3.9);
  assert.equal(colisiona(mesaIzq.x, mesaIzq.z, 0.2, PLANTA_CANTINA), true);
  assert.equal(colisiona(mesaDer.x, mesaDer.z, 0.2, PLANTA_CANTINA), true);
  // Un punto cerca de la entrada, lejos de la barra y de las dos mesas, no
  // debería colisionar con ninguna: si colisionara, alguna estaría mal
  // dimensionada (o la planta se ha quedado corta de límites).
  const cercaDeLaEntrada = desdeNativo(0, 0);
  assert.equal(colisiona(cercaDeLaEntrada.x, cercaDeLaEntrada.z, 0.2, PLANTA_CANTINA), false);
});

test("los límites nunca llegan al ventanal: no se puede salir por él", () => {
  // El ventanal nativo está en z≈6.8; el límite conservador se queda en 6.3.
  const cercaDelVentanal = desdeNativo(0, 6.8);
  assert.equal(colisiona(cercaDelVentanal.x, cercaDelVentanal.z, 0.35, PLANTA_CANTINA), true);
});
