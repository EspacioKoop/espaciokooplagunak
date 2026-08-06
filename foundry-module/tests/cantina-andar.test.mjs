import assert from "node:assert/strict";
import test from "node:test";

import { componerCantinaAndar } from "../scripts/cantina-andar.mjs";
import { desdeNativo } from "../scripts/cantina-planta.mjs";
import { PUERTA_CANTINA_HACIA_VESTIBULO } from "../scripts/cantina-escena.mjs";
import { distanciaARect, fraccionAbierta } from "../scripts/nave-sala-caja.mjs";

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

test("los polígonos salen ordenados de más lejos a más cerca", () => {
  const centro = desdeNativo(0, 2);
  const escena = componerCantinaAndar(centro.x, 0, centro.z, Math.PI, { ancho: 160, alto: 90 });
  for (let i = 1; i < escena.poligonos.length; i += 1) {
    assert.ok(escena.poligonos[i - 1].profundidad >= escena.poligonos[i].profundidad);
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

// La puerta oeste (#508 QA: "estilo Star Trek" — hasta ahora este muro no
// tenía ningún hueco, era la única puerta invisible de la nave) reutiliza la
// misma rampa de apertura que `nave-sala-caja.mjs`, pero con `x`/`z` que
// llegan en coordenadas de PLANTA y hay que traducir con `aNativo` antes de
// medir la distancia — es justo el paso que se salta más fácil al copiar el
// patrón de una sala nueva.
test("la puerta oeste de la cantina también se compone sin reventar cerca y lejos, con vértices en rango", () => {
  const ancho = 480, alto = 270;
  const lejos = desdeNativo(4.8, 4); // al otro lado del local
  const cerca = desdeNativo(-4.9, 3.6); // pegada a la puerta
  for (const punto of [lejos, cerca]) {
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const escena = componerCantinaAndar(punto.x, 0, punto.z, yaw, { ancho, alto });
      for (const poligono of escena.poligonos) {
        for (const p of poligono.puntos) {
          assert.ok(Math.abs(p.x) < ancho * 10 && Math.abs(p.y) < alto * 10, `vértice disparado (${p.x}, ${p.y})`);
        }
      }
    }
  }
});

test("la hoja de la puerta oeste responde a la misma rampa de distancia que el resto de la nave", () => {
  const lejosNativo = { x: -1, z: 4 };
  const cercaNativo = { x: -5.0, z: 3.6 };
  assert.equal(fraccionAbierta(distanciaARect(lejosNativo.x, lejosNativo.z, PUERTA_CANTINA_HACIA_VESTIBULO.base)), 0);
  assert.ok(fraccionAbierta(distanciaARect(cercaNativo.x, cercaNativo.z, PUERTA_CANTINA_HACIA_VESTIBULO.base)) > 0);
});
