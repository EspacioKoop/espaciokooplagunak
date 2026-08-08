import assert from "node:assert/strict";
import test from "node:test";

import { colisiona } from "../scripts/nave-movimiento.mjs";
import { aNativo, PLANTA_CANTINA, desdeNativo } from "../scripts/cantina-planta.mjs";

test("desdeNativo y aNativo son inversas exactas", () => {
  const nativo = { x: -3, z: 5 };
  const planta = desdeNativo(nativo.x, nativo.z);
  const vuelta = aNativo(planta.x, planta.z);
  assert.ok(Math.abs(vuelta.x - nativo.x) < 1e-9);
  assert.ok(Math.abs(vuelta.z - nativo.z) < 1e-9);
});

test("la cantina es un espacio ANDABLE, no una sala llena de muebles", () => {
  // Sustituye a una aserción que exigía el centro geométrico libre: ahí está la
  // barra, y con los obstáculos derivados de `MUEBLES` (QA 2026-08-08) eso dejó
  // de ser cierto sin que nada estuviera mal. Lo que de verdad importa es que
  // quede sala por la que andar: se mide barriendo la planta.
  let libres = 0;
  let total = 0;
  for (let x = 0.05; x < PLANTA_CANTINA.ancho; x += 0.15) {
    for (let z = 0.05; z < PLANTA_CANTINA.profundidad; z += 0.15) {
      total += 1;
      if (!colisiona(x, z, 0.35, PLANTA_CANTINA)) libres += 1;
    }
  }
  const fraccion = libres / total;
  assert.ok(fraccion > 0.45, `solo el ${Math.round(fraccion * 100)}% de la cantina es andable`);
});

test("la planta llega hasta los muros PINTADOS, sin recortes silenciosos", () => {
  // El fallo que el QA describió como «un vacío absurdo frente a la pared»: la
  // planta se quedaba en z=6.3 mientras la sala se ve hasta 9.5, así que un
  // tercio amueblado quedaba fuera. Se compara con la geometría real.
  const fondo = aNativo(0, PLANTA_CANTINA.profundidad);
  const derecha = aNativo(PLANTA_CANTINA.ancho, 0);
  assert.ok(fondo.z >= 9.4, `la planta se queda en z=${fondo.z} y los muros llegan a 9.5`);
  assert.ok(derecha.x >= 4.9, `la planta se queda en x=${derecha.x} y los muros llegan a 5.0`);
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
