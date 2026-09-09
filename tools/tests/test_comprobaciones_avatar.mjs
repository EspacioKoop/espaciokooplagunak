// Fija que las cinco reglas de #976 detectan lo que dicen detectar: cada
// prueba trae un caso que cumple y uno que no. `ningunaCaraRectangularAlineada`
// se ejercita sobre la primitiva real (`escena-primitivas.caja`) para que el
// caso "no cumple" no sea un invento — es exactamente la geometría de hoy.

import assert from "node:assert/strict";
import test from "node:test";

import { caja, prisma } from "../../foundry-module/scripts/escena-primitivas.mjs";
import {
  esRectanguloAlineado,
  ningunaCaraRectangularAlineada,
  proporcionDedosAMuslo,
  piesPlantados,
  huellasAlternasYAlineadas,
  envolvente2D,
  siluetasDistintasPorClase,
} from "../comprobaciones-avatar.mjs";

test("una cara de escena-primitivas.caja() es rectángulo alineado a ejes", () => {
  const { vertices, caras } = caja([0, 0, 0], [1, 2, 0.5]);
  assert.equal(esRectanguloAlineado(vertices, caras[0]), true);
  const veredicto = ningunaCaraRectangularAlineada({ vertices, caras });
  assert.equal(veredicto.cumple, false);
  assert.equal(veredicto.infractoras.length, caras.length);
});

test("un prisma octogonal no tiene caras rectangulares alineadas", () => {
  const malla = prisma([0, 0, 0], { radioAbajo: 0.1, radioArriba: 0.1, alto: 0.5, lados: 8 });
  const veredicto = ningunaCaraRectangularAlineada(malla);
  assert.equal(veredicto.cumple, true);
  assert.deepEqual(veredicto.infractoras, []);
});

test("una cara girada 45° deja de ser rectángulo alineado a ejes", () => {
  const c = Math.cos(Math.PI / 4);
  const s = Math.sin(Math.PI / 4);
  const vertices = [
    [-1, -1, 0],
    [1 * c - (-1) * s, 1 * s + (-1) * c, 0],
    [1, 1, 0],
    [-1 * c - 1 * s, -1 * s + 1 * c, 0],
  ];
  assert.equal(esRectanguloAlineado(vertices, [0, 1, 2, 3]), false);
});

test("proporción: la yema de los dedos a medio muslo cumple", () => {
  const veredicto = proporcionDedosAMuslo({ cadera: 1.0, rodilla: 0.5, yemaDedos: 0.75 });
  assert.equal(veredicto.cumple, true);
});

test("proporción: la yema a la altura de la rodilla no cumple", () => {
  const veredicto = proporcionDedosAMuslo({ cadera: 1.0, rodilla: 0.5, yemaDedos: 0.5 });
  assert.equal(veredicto.cumple, false);
});

test("proporción: la yema a la altura de la cadera no cumple", () => {
  const veredicto = proporcionDedosAMuslo({ cadera: 1.0, rodilla: 0.5, yemaDedos: 1.0 });
  assert.equal(veredicto.cumple, false);
});

test("pie plantado: un ciclo con siempre un pie en el suelo cumple", () => {
  const fotogramas = [
    { pies: [{ y: 0 }, { y: 0.2 }] },
    { pies: [{ y: 0 }, { y: 0 }] },
    { pies: [{ y: 0.2 }, { y: 0 }] },
  ];
  assert.equal(piesPlantados(fotogramas).cumple, true);
});

test("pie plantado: los dos pies en el aire a la vez no cumple", () => {
  const fotogramas = [{ pies: [{ y: 0.1 }, { y: 0.1 }] }];
  const veredicto = piesPlantados(fotogramas);
  assert.equal(veredicto.cumple, false);
  assert.equal(veredicto.problemas[0].algunoTocaSuelo, false);
});

test("pie plantado: un pie por debajo del suelo no cumple", () => {
  const fotogramas = [{ pies: [{ y: 0 }, { y: -0.05 }] }];
  const veredicto = piesPlantados(fotogramas);
  assert.equal(veredicto.cumple, false);
  assert.equal(veredicto.problemas[0].ningunoAtraviesa, false);
});

test("huellas: pisadas alternas y alineadas con el eje de marcha cumplen", () => {
  const huellas = [
    { x: 0.1, z: 0, pie: "der" },
    { x: -0.1, z: 0.3, pie: "izq" },
    { x: 0.1, z: 0.6, pie: "der" },
    { x: -0.1, z: 0.9, pie: "izq" },
  ];
  assert.equal(huellasAlternasYAlineadas(huellas, [0, 1]).cumple, true);
});

test("huellas: repetir el mismo pie dos veces seguidas no cumple", () => {
  const huellas = [
    { x: 0.1, z: 0, pie: "der" },
    { x: 0.1, z: 0.3, pie: "der" },
  ];
  const veredicto = huellasAlternasYAlineadas(huellas, [0, 1]);
  assert.equal(veredicto.cumple, false);
  assert.ok(veredicto.problemas.some((p) => p.motivo.includes("mismo pie")));
});

test("huellas: pisadas cruzadas al otro lado del eje no cumplen", () => {
  const huellas = [
    { x: 0.1, z: 0, pie: "der" },
    { x: -0.1, z: 0.3, pie: "izq" },
    { x: -0.1, z: 0.6, pie: "der" },
    { x: 0.1, z: 0.9, pie: "izq" },
  ];
  const veredicto = huellasAlternasYAlineadas(huellas, [0, 1]);
  assert.equal(veredicto.cumple, false);
});

test("huellas: retroceder respecto al eje de marcha no cumple", () => {
  const huellas = [
    { x: 0.1, z: 1, pie: "der" },
    { x: -0.1, z: 0.5, pie: "izq" },
  ];
  const veredicto = huellasAlternasYAlineadas(huellas, [0, 1]);
  assert.equal(veredicto.cumple, false);
  assert.ok(veredicto.problemas.some((p) => p.motivo.includes("no avanza")));
});

test("silueta: envolvente 2D de una caja simple", () => {
  const { vertices } = caja([0, 1, 0], [2, 4, 1]);
  const env = envolvente2D(vertices, "xy");
  assert.deepEqual(env.min, [-1, -1]);
  assert.deepEqual(env.max, [1, 3]);
});

test("silueta: mago y guerrero con envolventes distintas cumplen", () => {
  const mago = caja([0, 0.9, 0], [0.4, 1.8, 0.3]).vertices;
  const guerrero = caja([0, 0.9, 0], [0.6, 1.8, 0.5]).vertices;
  const veredicto = siluetasDistintasPorClase(mago, guerrero);
  assert.equal(veredicto.cumple, true);
});

test("silueta: dos mallas con la misma envolvente no cumplen", () => {
  const a = caja([0, 0.9, 0], [0.5, 1.8, 0.4]).vertices;
  const b = caja([0, 0.9, 0], [0.5, 1.8, 0.4]).vertices;
  const veredicto = siluetasDistintasPorClase(a, b);
  assert.equal(veredicto.cumple, false);
});
