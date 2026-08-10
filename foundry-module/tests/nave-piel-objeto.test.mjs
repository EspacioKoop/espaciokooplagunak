// Piel pixelart de los objetos de una sala (#550).
//
// La decisión de diseño que hay que defender aquí no es el dibujo: es a QUÉ se le
// pone. Vestir los 126 muebles de la cantina multiplicaría por cuatro caras cada
// botella, y el presupuesto de una sala lo gasta el conjunto.

import test from "node:test";
import assert from "node:assert/strict";

import {
  MINIMO_ALTO,
  MINIMO_LADO,
  TOPE_OBJETO,
  piezasPielColumna,
  piezasPielObjeto,
  rejillaObjeto,
} from "../scripts/nave-piel-objeto.mjs";
import { CELDA } from "../scripts/nave-mural-pixel.mjs";
import { MURAL } from "../scripts/paleta.mjs";
import { crearSalaCaja, ALTURA } from "../scripts/nave-sala-caja.mjs";

const ARMARIO = { centro: [2, 0.9, 3], medidas: [1.6, 1.8, 0.8] };

test("solo se viste lo que es arquitectura de la sala", () => {
  assert.ok(piezasPielObjeto(ARMARIO).length > 0, "un armario sí se ve de cerca");
  // Lo pequeño se queda liso, que a esa escala es lo correcto y no una carencia.
  assert.deepEqual(piezasPielObjeto({ centro: [1, 1.1, 1], medidas: [0.1, 0.25, 0.1] }), [], "una botella");
  assert.deepEqual(piezasPielObjeto({ centro: [1, 0.4, 1], medidas: [0.4, 0.8, 0.4] }), [], "un taburete");
  // Justo en la frontera: una tabla larga pero estrecha se ve de canto la mitad
  // del tiempo, así que manda el lado MENOR.
  assert.deepEqual(piezasPielObjeto({ centro: [1, 1, 1], medidas: [4, 2, MINIMO_LADO - 0.01] }), []);
  assert.deepEqual(piezasPielObjeto({ centro: [1, 0.2, 1], medidas: [2, MINIMO_ALTO - 0.01, 2] }), []);
});

test("la piel de un objeto usa la misma celda que el muro y la puerta", () => {
  for (const { malla } of piezasPielObjeto(ARMARIO)) {
    const alturas = malla.vertices.map(([, y]) => y);
    assert.ok(Math.abs(Math.max(...alturas) - Math.min(...alturas) - CELDA) < 1e-9);
  }
});

test("las cuatro caras verticales, y ninguna suelta por fuera del objeto", () => {
  const piezas = piezasPielObjeto(ARMARIO);
  const [cx, cy, cz] = ARMARIO.centro;
  const [ancho, alto, fondo] = ARMARIO.medidas;
  const planos = new Set();
  for (const { malla } of piezas) {
    for (const [x, y, z] of malla.vertices) {
      assert.ok(y >= cy - alto / 2 - 1e-9 && y <= cy + alto / 2 + 1e-9, "ni por debajo del suelo ni por encima del canto");
      assert.ok(Math.abs(x - cx) <= ancho / 2 + 0.05, "no se sale de la caja en x");
      assert.ok(Math.abs(z - cz) <= fondo / 2 + 0.05, "no se sale de la caja en z");
    }
    // Una chapa vive en un plano: o todos sus vértices comparten `z` (cara
    // frontal/trasera) o comparten `x` (cara lateral). Se identifica así y no por
    // comparar con el centro, que en una esquina da los dos a la vez.
    const zs = new Set(malla.vertices.map(([, , z]) => z.toFixed(3)));
    const xs = new Set(malla.vertices.map(([x]) => x.toFixed(3)));
    planos.add(zs.size === 1 ? `z${[...zs][0]}` : `x${[...xs][0]}`);
  }
  assert.equal(planos.size, 4, "las cuatro caras verticales");
});

test("el tope por objeto es duro: son muchos y pequeños", () => {
  const enorme = { centro: [10, 2, 10], medidas: [12, 4, 12] };
  const porCara = new Map();
  for (const { malla } of piezasPielObjeto(enorme)) {
    const clave = JSON.stringify(malla.vertices[0].map((n, i) => (i === 1 ? 0 : Math.round(n * 100))));
    porCara.set(clave, (porCara.get(clave) ?? 0) + 1);
  }
  for (const cuenta of porCara.values()) assert.ok(cuenta <= TOPE_OBJETO);
});

test("el dibujo no lleva color propio ni nada que se pueda leer", () => {
  const permitidos = new Set(Object.values(MURAL));
  for (const { color } of piezasPielObjeto(ARMARIO)) assert.ok(permitidos.has(color), `${color} (#351)`);
  // Regla de #526: cantos, un refuerzo y una rejilla de ventilación. Ningún
  // piloto encendido, que sí afirmaría un estado. Lo que informa en esta nave
  // son las consolas, y esas tienen su propio lenguaje.
  const rejilla = rejillaObjeto(8, 9);
  assert.ok(rejilla.flat().some((c) => c === null), "el color del objeto sigue siendo el fondo");
  assert.ok(!rejilla[0].some(Boolean), "la fila del suelo va limpia: un canto a ras de suelo es una sombra mal puesta");
});

test("dos objetos iguales salen iguales", () => {
  // Sin semilla: el mobiliario de una nave es de serie. Lo que rompe la
  // repetición entre dos armarios es dónde están, no unos remaches torcidos.
  assert.deepEqual(rejillaObjeto(8, 9), rejillaObjeto(8, 9));
});

test("una columna se viste sin que quien llama convierta esquinas a centros", () => {
  const rect = { x: 3, z: 3, ancho: 0.8, profundidad: 0.8 };
  const porColumna = piezasPielColumna(rect, ALTURA);
  const porObjeto = piezasPielObjeto({
    centro: [rect.x + rect.ancho / 2, ALTURA / 2, rect.z + rect.profundidad / 2],
    medidas: [rect.ancho, ALTURA, rect.profundidad],
  });
  assert.deepEqual(porColumna, porObjeto);
  assert.ok(porColumna.length > 0);
});

test("la piel no cambia por dónde se puede andar", () => {
  const comun = { ancho: 8, profundidad: 6, columnas: [{ x: 3, z: 3, ancho: 0.8, profundidad: 0.8 }] };
  assert.deepEqual(
    crearSalaCaja({ ...comun, pielObjetos: true }).planta,
    crearSalaCaja({ ...comun, pielObjetos: false }).planta,
  );
});

test("la fábrica viste columnas y muebles de serie, y el interruptor los desnuda", () => {
  const comun = {
    ancho: 8,
    profundidad: 6,
    muralPixel: false,
    columnas: [{ x: 3, z: 3, ancho: 0.8, profundidad: 0.8 }],
    mobiliario: [{ centro: [5, 0.9, 2], medidas: [1.6, 1.8, 0.8], color: MURAL.junta }],
  };
  const vista = (pielObjetos) =>
    crearSalaCaja({ ...comun, pielObjetos }).componer(1, 0, 1, 0, { ancho: 320, alto: 180 }).poligonos.length;
  assert.ok(vista(true) > vista(false));
});

test("un mueble puede renunciar a su piel sin apagarla en toda la sala", () => {
  // La cantina tiene muebles hechos a mano (#423) que no quieren chapa encima;
  // negarla pieza a pieza es más barato que sacar la sala entera del sistema.
  const comun = { ancho: 8, profundidad: 6, muralPixel: false };
  const mueble = { centro: [3.4, 0.9, 3.4], medidas: [1.6, 1.8, 0.8], color: MURAL.junta };
  const vista = (piel) =>
    crearSalaCaja({ ...comun, mobiliario: [{ ...mueble, piel }] })
      .componer(1, 0, 1, 0, { ancho: 320, alto: 180 }).poligonos.length;
  assert.ok(vista(true) > vista(false));
});
