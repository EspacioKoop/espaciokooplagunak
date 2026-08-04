import assert from "node:assert/strict";
import test from "node:test";

import { componerCantinaAndar } from "../scripts/cantina-andar.mjs";
import { desdeNativo } from "../scripts/cantina-planta.mjs";

test("componerCantinaAndar devuelve una escena con el tamaño pedido y polígonos", () => {
  const centro = desdeNativo(0, 2);
  const escena = componerCantinaAndar(centro.x, centro.z, 0, { ancho: 200, alto: 100 });
  assert.equal(escena.ancho, 200);
  assert.equal(escena.alto, 100);
  assert.ok(escena.poligonos.length > 100, "la cantina tiene muchas más piezas que la sala de pruebas");
});

test("moverse cambia lo que se ve, igual que en la sala de pruebas", () => {
  const lejos = desdeNativo(0, -1.5);
  const cerca = desdeNativo(0, 3.5);
  const a = componerCantinaAndar(lejos.x, lejos.z, 0, { ancho: 160, alto: 90 });
  const b = componerCantinaAndar(cerca.x, cerca.z, 0, { ancho: 160, alto: 90 });
  assert.notDeepEqual(a.poligonos, b.poligonos);
});

test("los polígonos salen ordenados de más lejos a más cerca", () => {
  const centro = desdeNativo(0, 2);
  const escena = componerCantinaAndar(centro.x, centro.z, Math.PI, { ancho: 160, alto: 90 });
  for (let i = 1; i < escena.poligonos.length; i += 1) {
    assert.ok(escena.poligonos[i - 1].profundidad >= escena.poligonos[i].profundidad);
  }
});
