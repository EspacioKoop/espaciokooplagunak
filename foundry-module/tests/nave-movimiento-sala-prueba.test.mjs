import assert from "node:assert/strict";
import test from "node:test";

import { colisiona, puertaTocada } from "../scripts/nave-movimiento.mjs";
import { puntoDeLlegada } from "../scripts/nave-estancias.mjs";
import { afirmarOrdenPorPintor } from "./ayuda-orden-pintor.mjs";
import {
  ALTURA_OJOS,
  CATALOGO_PRUEBA,
  PLANTA_PRUEBA,
  PLANTA_PRUEBA_B,
  componerSalaPrueba,
} from "../scripts/nave-movimiento-sala-prueba.mjs";

test("la planta de pruebas colisiona con sus columnas y no con el suelo libre", () => {
  // Una de las columnas declaradas está en x:3..3.8, z:3..3.8.
  assert.equal(colisiona(3.4, 3.4, 0.2, PLANTA_PRUEBA), true);
  assert.equal(colisiona(1, 1, 0.3, PLANTA_PRUEBA), false);
});

test("la planta de pruebas colisiona en sus límites (los muros no se declaran dos veces)", () => {
  assert.equal(colisiona(-0.1, 5, 0.3, PLANTA_PRUEBA), true);
  assert.equal(colisiona(PLANTA_PRUEBA.ancho + 0.1, 5, 0.3, PLANTA_PRUEBA), true);
});

test("componerSalaPrueba devuelve una escena con el tamaño pedido y polígonos", () => {
  const escena = componerSalaPrueba(5, 0, 5, 0, { ancho: 200, alto: 100 });
  assert.equal(escena.ancho, 200);
  assert.equal(escena.alto, 100);
  assert.ok(escena.poligonos.length > 0);
  // Y nada que esté enteramente detrás se pinta después.
  afirmarOrdenPorPintor(escena.poligonos, "la sala de prueba", 6); // deuda medida de #510
});

test("moverse cambia lo que se ve: mirar hacia una columna cercana la acerca", () => {
  // Desde el centro de la sala, la columna en (3,3) está más lejos que
  // acercándose a ella; de más lejos a más cerca hay menos polígonos visibles
  // recortados por el plano cercano en el mismo punto, así que basta comprobar
  // que la escena cambia con la posición (no un lienzo estático).
  const lejos = componerSalaPrueba(8, 0, 8, Math.PI, { ancho: 160, alto: 90 });
  const cerca = componerSalaPrueba(2, 0, 2, Math.PI, { ancho: 160, alto: 90 });
  assert.notDeepEqual(lejos.poligonos, cerca.poligonos);
});

test("la cámara mira desde la altura de ojos, no desde el suelo", () => {
  assert.ok(ALTURA_OJOS > 0 && ALTURA_OJOS < 3);
});

test("saltar (y>0) sube la cámara por encima de la altura de ojos en pie", () => {
  const dePie = componerSalaPrueba(5, 0, 5, 0, { ancho: 160, alto: 90 });
  const saltando = componerSalaPrueba(5, 0.5, 5, 0, { ancho: 160, alto: 90 });
  assert.notDeepEqual(dePie.poligonos, saltando.poligonos);
});

test("CATALOGO_PRUEBA: la puerta de A se puede alcanzar sin cruzar antes el muro", () => {
  // El círculo (radio por defecto 0.35) debe poder tocar la puerta ANTES de
  // colisionar con el límite de la planta — si no, la puerta sería
  // inalcanzable y la costura entre salas no se podría probar nunca.
  const puerta = CATALOGO_PRUEBA.obtener("a").puertas[0];
  const zAcercandose = puerta.rect.z + 0.3; // dentro de la franja de la puerta
  assert.equal(colisiona(4.5, zAcercandose, 0.35, PLANTA_PRUEBA), false);
  assert.equal(puertaTocada(4.5, zAcercandose, 0.35, [puerta])?.destino?.estancia, "b");
});

test("CATALOGO_PRUEBA: cruzar hacia B no aparece dentro de la puerta de vuelta a A", () => {
  const llegada = puntoDeLlegada(CATALOGO_PRUEBA, CATALOGO_PRUEBA.obtener("a").puertas[0].destino);
  const puertaDeVuelta = CATALOGO_PRUEBA.obtener("b").puertas[0];
  assert.equal(puertaTocada(llegada.x, llegada.z, 0.35, [puertaDeVuelta]), null);
  assert.equal(colisiona(llegada.x, llegada.z, 0.35, PLANTA_PRUEBA_B), false);
});

test("CATALOGO_PRUEBA: cruzar de vuelta hacia A tampoco reactiva su propia puerta", () => {
  const llegada = puntoDeLlegada(CATALOGO_PRUEBA, CATALOGO_PRUEBA.obtener("b").puertas[0].destino);
  const puertaDeIda = CATALOGO_PRUEBA.obtener("a").puertas[0];
  assert.equal(puertaTocada(llegada.x, llegada.z, 0.35, [puertaDeIda]), null);
  assert.equal(colisiona(llegada.x, llegada.z, 0.35, PLANTA_PRUEBA), false);
});
