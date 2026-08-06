import assert from "node:assert/strict";
import test from "node:test";

import { componerCantinaAndar } from "../scripts/cantina-andar.mjs";
import { desdeNativo } from "../scripts/cantina-planta.mjs";

test("componerCantinaAndar devuelve una escena con el tamaño pedido y polígonos", () => {
  const centro = desdeNativo(0, 2);
  const escena = componerCantinaAndar(centro.x, 0, centro.z, 0, { ancho: 200, alto: 100 });
  assert.equal(escena.ancho, 200);
  assert.equal(escena.alto, 100);
  assert.ok(escena.poligonos.length > 100, "la cantina tiene muchas más piezas que la sala de pruebas");
});

test("moverse cambia lo que se ve, igual que en la sala de pruebas", () => {
  const lejos = desdeNativo(0, -1.5);
  const cerca = desdeNativo(0, 3.5);
  const a = componerCantinaAndar(lejos.x, 0, lejos.z, 0, { ancho: 160, alto: 90 });
  const b = componerCantinaAndar(cerca.x, 0, cerca.z, 0, { ancho: 160, alto: 90 });
  assert.notDeepEqual(a.poligonos, b.poligonos);
});

test("los polígonos salen ordenados de más lejos a más cerca (con el margen anti-parpadeo de #510)", () => {
  const centro = desdeNativo(0, 2);
  const escena = componerCantinaAndar(centro.x, 0, centro.z, Math.PI, { ancho: 160, alto: 90 });
  // >= -EPSILON y no >= a secas: `compararProfundidad` trata como empate
  // cualquier par a menos de 0.01 de diferencia (para no parpadear con el
  // temblor de cámara, #510), así que un par empatado puede quedar en
  // cualquier orden relativo dentro de ese margen — nunca por encima de él.
  const EPSILON = 0.01 + 1e-9;
  for (let i = 1; i < escena.poligonos.length; i += 1) {
    const diferencia = escena.poligonos[i - 1].profundidad - escena.poligonos[i].profundidad;
    assert.ok(diferencia >= -EPSILON, `polígono ${i} rompe el orden por pintor más allá del margen: ${diferencia}`);
  }
});

test("saltar (y>0) sube la cámara por encima de la altura de ojos en pie", () => {
  const centro = desdeNativo(0, 2);
  const dePie = componerCantinaAndar(centro.x, 0, centro.z, 0, { ancho: 160, alto: 90 });
  const saltando = componerCantinaAndar(centro.x, 0.5, centro.z, 0, { ancho: 160, alto: 90 });
  assert.notDeepEqual(dePie.poligonos, saltando.poligonos);
});

// REGRESIÓN (#510, confirmado en vídeo de QA sobre #508/#509): de pie cerca
// de la barra —un mueble de 6.4m de ancho— mirando a lo largo de ella, sin
// el recorte lateral un vértice se disparaba a miles de píxeles fuera de
// pantalla. La cantina caminable (a diferencia de los encuadres fijos de
// #423) ya lo activa.
test("REGRESIÓN: de pie junto a la barra, ningún punto proyectado se dispara fuera de pantalla", () => {
  const ancho = 480, alto = 270;
  // Cerca de la barra (native z≈4.2) y mirando a lo largo de ella (yaw hacia
  // +x nativo, el eje largo del mueble).
  const junto = desdeNativo(-2, 4);
  const escena = componerCantinaAndar(junto.x, 0, junto.z, Math.PI / 2, { ancho, alto });
  for (const poligono of escena.poligonos) {
    for (const punto of poligono.puntos) {
      assert.ok(Math.abs(punto.x) < ancho * 10, `x disparado: ${punto.x}`);
      assert.ok(Math.abs(punto.y) < alto * 10, `y disparado: ${punto.y}`);
    }
  }
});
