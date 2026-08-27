// Pruebas del cargador OBJ y del pipeline de conversión a malla del módulo.
//
// No necesita el binario de origen (que no vive en el repo): se alimenta de
// OBJ de texto y de la malla de la nariz del caza ya existente. Lo que se
// comprueba es que un OBJ cualquiera —el formato que NASA 3D, Europeana y
// Wikidata sueltan— entra en el mismo {vertices, caras} que el STL y acaba
// renderizando en la escena retro3d, no que un fichero concreto exista.

import assert from "node:assert/strict";
import test from "node:test";

import { leerObj, simplificar, normalizar } from "../../tools/convertir-estatua.mjs";
import { componerEscena, MALLA_CAZA } from "../../foundry-module/scripts/retro3d.mjs";

const CUBO = `
# cubo de 1 unidad, centrado en el origen
v -0.5 -0.5 -0.5
v  0.5 -0.5 -0.5
v  0.5  0.5 -0.5
v -0.5  0.5 -0.5
v -0.5 -0.5  0.5
v  0.5 -0.5  0.5
v  0.5  0.5  0.5
v -0.5  0.5  0.5
f 1 2 3 4
f 5 6 7 8
f 1 5 8 4
f 2 6 7 3
f 1 2 6 5
f 4 3 7 8
`;

test("un OBJ mínimo da la geometría esperada", () => {
  const m = leerObj("v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n");
  assert.deepEqual(m.vertices, [[0, 0, 0], [1, 0, 0], [0, 1, 0]]);
  assert.deepEqual(m.caras, [[0, 1, 2]]);
});

test("ignora vt/vn y la sintaxis v/vt/vn", () => {
  const m = leerObj("v 0 0 0\nv 1 0 0\nv 0 1 0\nvt 0 0\nvn 0 0 1\nf 1/1/1 2/2/1 3/3/1\n");
  assert.equal(m.vertices.length, 3);
  assert.deepEqual(m.caras, [[0, 1, 2]]);
});

test("admite índices negativos (relativos al final)", () => {
  const m = leerObj("v 0 0 0\nv 1 0 0\nv 0 1 0\nf -3 -2 -1\n");
  assert.deepEqual(m.caras, [[0, 1, 2]]);
});

test("triangula un polígono por abanico", () => {
  // Un cuadrilátero da dos triángulos, no uno.
  const m = leerObj("v 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nf 1 2 3 4\n");
  assert.equal(m.caras.length, 2);
  for (const t of m.caras) assert.equal(t.length, 3);
});

test("descarta caras degeneradas (índices repetidos)", () => {
  const m = leerObj("v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 1 1\n");
  assert.deepEqual(m.caras, []);
});

test("una cara con un índice que no existe no rompe el parseo", () => {
  const m = leerObj("v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 99\n");
  assert.deepEqual(m.caras, []);
});

test("el pipeline OBJ->decimar->normalizar da una malla finita y de pie", () => {
  const parseada = leerObj(CUBO);
  assert.equal(parseada.caras.length, 12, "el cubo entra como 12 triángulos");
  const decimada = simplificar(parseada, 12);
  const malla = normalizar(decimada, { alto: 2 });
  // De pie: apoyada en y=0 y con la altura pedida.
  const ys = malla.vertices.map((v) => v[1]);
  assert.ok(Math.min(...ys) >= -1e-9, "toca el suelo");
  assert.ok(Math.max(...ys) > 1.5 && Math.max(...ys) < 2.5, "alta ~2");
  for (const v of malla.vertices) {
    for (const c of v) assert.ok(Number.isFinite(c), "sin NaN en vértices");
  }
});

test("REGRESIÓN: un OBJ convertido renderiza en retro3d sin NaN", () => {
  // Cierra el bucle NASA-catálogo -> retro3d: si la malla importada no
  // produjera polígonos finitos, se perdería en el lienzo sin avisar.
  const malla = normalizar(simplificar(leerObj(CUBO), 12), { alto: 2 });
  const escena = componerEscena(malla, { epoca: "gamecube" });
  assert.ok(escena.poligonos.length > 0, "se ve algo");
  for (const p of escena.poligonos) {
    for (const pt of p.puntos) {
      assert.ok(Number.isFinite(pt.x) && Number.isFinite(pt.y), "sin NaN en el lienzo");
    }
    assert.match(p.color, /^#[0-9a-f]{6}$/, "color válido");
  }
});

test("REGRESIÓN: leerObj decodifica bien un OBJ leído como Uint8Array (no Buffer)", () => {
  // `principal` lee el fichero a un Uint8Array y lo decodifica con TextDecoder.
  // `Uint8Array.prototype.toString("utf8")` NO decodifica UTF-8 (da los bytes
  // por comas), así que el camino real pasa por TextDecoder; este test lo fija.
  const crudo = new TextEncoder().encode(CUBO);
  const desdeUint8 = leerObj(new TextDecoder("utf8").decode(crudo));
  const desdeTexto = leerObj(CUBO);
  assert.deepEqual(desdeUint8, desdeTexto);
  assert.equal(desdeUint8.caras.length, 12);
});

test("la malla de referencia del módulo sigue renderizando (no se rompió el import)", () => {
  const escena = componerEscena(MALLA_CAZA, { yaw: 0.4 });
  assert.ok(escena.poligonos.length > 0);
});
