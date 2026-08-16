// Pruebas del dado en 3D retro (#413 sobre #362). Lo que se defiende aquí no es
// que el cubo sea bonito, sino que SIEMPRE SE LEE: no hay valor que pueda salir
// de canto, porque la orientación se calcula y no se sortea.

import assert from "node:assert/strict";
import test from "node:test";

import {
  INCLINACION,
  NORMAL_POR_VALOR,
  escenaDado,
  mallaDado,
  mallaPuntos,
  orientacionParaValor,
  puntosDeCara,
} from "../scripts/minijuegos/dados-3d.mjs";
import { EPOCAS, areaFirmada, componerEscena, transformar } from "../scripts/retro3d.mjs";
import { afirmarOrdenPorPintor } from "./ayuda-orden-pintor.mjs";

const VALORES = [1, 2, 3, 4, 5, 6];

// Normal de la cara del valor, ya girada como la va a ver la cámara. Sin
// traslación: solo interesa hacia dónde apunta.
function normalEnCamara(valor, orientacion) {
  return transformar(NORMAL_POR_VALOR[valor], { ...orientacion, posicion: [0, 0, 0] });
}

test("el cubo tiene ocho vértices y doce triángulos", () => {
  const malla = mallaDado();
  assert.equal(malla.vertices.length, 8);
  assert.equal(malla.caras.length, 12);
  assert.ok(malla.caras.every((c) => c.every((i) => i >= 0 && i < 8)));
});

test("las caras opuestas suman siete, como en un dado de verdad", () => {
  for (const valor of VALORES) {
    const opuesta = VALORES.find((otro) => {
      const a = NORMAL_POR_VALOR[valor];
      const b = NORMAL_POR_VALOR[otro];
      return a[0] === -b[0] && a[1] === -b[1] && a[2] === -b[2];
    });
    assert.equal(valor + opuesta, 7, `la cara opuesta a ${valor} debería sumar siete`);
  }
});

test("cada cara lleva tantos puntos como vale, y los impares llevan centro", () => {
  for (const valor of VALORES) {
    const puntos = puntosDeCara(valor);
    assert.equal(puntos.length, valor);
    assert.equal(
      puntos.some(([u, v]) => u === 0 && v === 0),
      valor % 2 === 1,
      `el centro solo va en los impares (${valor})`,
    );
    // Ningún punto se derrama fuera de la cara.
    assert.ok(puntos.every(([u, v]) => Math.abs(u) <= 1 && Math.abs(v) <= 1));
  }
});

test("la malla de puntos lleva los veintiún puntos de las seis caras", () => {
  const malla = mallaPuntos();
  const total = VALORES.reduce((suma, v) => suma + v, 0); // 21
  assert.equal(malla.vertices.length, total * 4); // un cuadrado por punto
  assert.equal(malla.caras.length, total * 2); // dos triángulos por cuadrado
});

test("LEGIBILIDAD: la cara del valor mira siempre a la cámara", () => {
  for (const valor of VALORES) {
    const normal = normalEnCamara(valor, orientacionParaValor(valor));
    // La cámara mira hacia +z, así que la cara que se ve tiene la normal hacia
    // −z. Con la inclinación por defecto, la componente sigue siendo dominante:
    // el número queda de frente, no de canto.
    assert.ok(
      normal[2] < -0.85,
      `el valor ${valor} no queda de frente (z = ${normal[2].toFixed(3)})`,
    );
  }
});

test("LEGIBILIDAD: ninguna otra cara le gana el frente a la del valor", () => {
  for (const valor of VALORES) {
    const orientacion = orientacionParaValor(valor);
    const suya = normalEnCamara(valor, orientacion)[2];
    for (const otro of VALORES.filter((v) => v !== valor)) {
      assert.ok(
        normalEnCamara(otro, orientacion)[2] > suya,
        `la cara ${otro} tapa a la ${valor}`,
      );
    }
  }
});

test("la inclinación enseña volumen sin robarle el frente al valor", () => {
  assert.ok(INCLINACION.yaw > 0 && INCLINACION.pitch > 0, "sin inclinación no es un cubo");
  for (const valor of VALORES) {
    const escena = escenaDado({ valor, ancho: 64, alto: 64 });
    // Con el cubo de frente se verían 6 triángulos (una cara); inclinado se ven
    // tres caras, que es lo que da el volumen. Si solo se viera una, el dado
    // sería un cuadrado pintado.
    const caras = escena.poligonos.filter((p) => p.puntos.length >= 3);
    assert.ok(caras.length > 6, `el valor ${valor} sale plano`);
  }
});

test("LEGIBILIDAD: se ven los puntos que hay que contar, en cualquier época", () => {
  for (const epoca of EPOCAS) {
    for (const valor of VALORES) {
      // Solo la malla de puntos, con la misma orientación que usa la escena: así
      // se cuentan puntos y no se confunden con las caras del cuerpo. Cada punto
      // son dos triángulos, y los de la cara de frente tienen que estar TODOS —
      // si el motor descartara uno, el jugador contaría mal su tirada.
      const orientacion = orientacionParaValor(valor);
      const soloPuntos = componerEscena(mallaPuntos(), {
        ...orientacion,
        epoca,
        ancho: 96,
        alto: 96,
        posicion: [0, 0, 3],
      });
      assert.ok(
        soloPuntos.poligonos.length >= valor * 2,
        `${epoca}/${valor}: se pierden puntos (${soloPuntos.poligonos.length} triángulos)`,
      );
      // Y en la escena completa el dado sigue declarando su valor.
      assert.equal(escenaDado({ valor, epoca, ancho: 96, alto: 96 }).valor, valor);
    }
  }
});

test("los polígonos salen ordenados de lejos a cerca, listos para pintar", () => {
  const escena = escenaDado({ valor: 5, ancho: 64, alto: 64 });
  afirmarOrdenPorPintor(escena.poligonos, "el dado");
  // Y todos miran a cámara: el motor ya descartó los de espaldas.
  assert.ok(escena.poligonos.every((p) => areaFirmada(p.puntos) > 0));
});

test("un giro explícito manda sobre la orientación legible", () => {
  // Es el único modo de que un dado salga de canto: pidiéndolo, para animar la
  // tirada. Lo que no puede pasar es que ocurra sin pedirlo.
  const quieto = escenaDado({ valor: 6, ancho: 64, alto: 64 });
  const rodando = escenaDado({ valor: 6, ancho: 64, alto: 64, giro: { yaw: 0.9, pitch: 1.1 } });
  assert.notDeepEqual(quieto.poligonos, rodando.poligonos);
});

test("un valor imposible cae en el 1 en vez de dejar un dado sin cara", () => {
  for (const malo of [0, 7, "seis", null, undefined, 2.5]) {
    assert.equal(escenaDado({ valor: malo, ancho: 32, alto: 32 }).valor, 1);
  }
});

test("la escena conserva el contrato de `componerEscena`", () => {
  const escena = escenaDado({ valor: 4, epoca: "gamecube", ancho: 80, alto: 60 });
  assert.equal(escena.epoca, "gamecube");
  assert.equal(escena.ancho, 80);
  assert.equal(escena.alto, 60);
  assert.ok(escena.poligonos.every((p) => p.puntos.every(
    (q) => Number.isFinite(q.x) && Number.isFinite(q.y),
  )));
});
