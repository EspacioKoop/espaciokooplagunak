// Pruebas del cargador OBJ y del pipeline de conversión a malla del módulo.
//
// No necesita el binario de origen (que no vive en el repo): se alimenta de
// OBJ de texto y de la malla de la nariz del caza ya existente. Lo que se
// comprueba es que un OBJ cualquiera —el formato que NASA 3D, Europeana y
// Wikidata sueltan— entra en el mismo {vertices, caras} que el STL y acaba
// renderizando en la escena retro3d, no que un fichero concreto exista.

import assert from "node:assert/strict";
import test from "node:test";

import { leerObj, leerGlb, simplificar, normalizar } from "../../tools/convertir-estatua.mjs";
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

// Construye un GLB mínimo y válido (versión 2) a partir de posiciones e
// índices, para no depender de un fichero binario externo en la prueba.
function construirGlb(posiciones, indices) {
  const f = new Float32Array(posiciones.length * 3);
  posiciones.forEach((p, i) => {
    f[i * 3] = p[0];
    f[i * 3 + 1] = p[1];
    f[i * 3 + 2] = p[2];
  });
  const posBytes = new Uint8Array(f.buffer, f.byteOffset, f.byteLength);
  const idxBytes = indices ? new Uint8Array(new Uint16Array(indices).buffer) : new Uint8Array(0);

  const binSinPad = posBytes.length + idxBytes.length;
  const bin = new Uint8Array(binSinPad + ((4 - (binSinPad % 4)) % 4));
  bin.set(posBytes, 0);
  bin.set(idxBytes, posBytes.length);

  const json = {
    buffers: [{ byteLength: bin.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: posBytes.length, target: 34962 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: posiciones.length, type: "VEC3", min: [0, 0, 0], max: [1, 1, 1] }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
  };
  if (indices) {
    json.bufferViews.push({ buffer: 0, byteOffset: posBytes.length, byteLength: idxBytes.length, target: 34963 });
    json.accessors.push({ bufferView: 1, componentType: 5123, count: indices.length, type: "SCALAR" });
    json.meshes[0].primitives[0].indices = 1;
  }
  let jsonStr = JSON.stringify(json);
  jsonStr += " ".repeat((4 - (jsonStr.length % 4)) % 4);
  const jsonBytes = new TextEncoder().encode(jsonStr);

  const total = 12 + 8 + jsonBytes.length + 8 + bin.length;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true); // 'glTF'
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jsonBytes.length, true);
  dv.setUint32(16, 0x4e4f534a, true); // JSON chunk
  out.set(jsonBytes, 20);
  const binOff = 20 + jsonBytes.length;
  dv.setUint32(binOff, bin.length, true);
  dv.setUint32(binOff + 4, 0x004e4942, true); // BIN chunk
  out.set(bin, binOff + 8);
  return out;
}

test("un GLB indexado da la geometría esperada", () => {
  const glb = construirGlb([[0, 0, 0], [1, 0, 0], [0, 1, 0]], [0, 1, 2]);
  const m = leerGlb(glb);
  assert.deepEqual(m.vertices, [[0, 0, 0], [1, 0, 0], [0, 1, 0]]);
  assert.deepEqual(m.caras, [[0, 1, 2]]);
});

test("un GLB sin índices (triangle soup) triangula los vértices seguidos", () => {
  const glb = construirGlb(
    [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]],
    null,
  );
  const m = leerGlb(glb);
  assert.equal(m.caras.length, 2);
  assert.deepEqual(m.caras, [[0, 1, 2], [3, 4, 5]]);
});

test("un GLB con magic erróneo lanza", () => {
  const basura = new Uint8Array([1, 2, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.throws(() => leerGlb(basura), /glTF/);
});

test("REGRESIÓN: un GLB convertido renderiza en retro3d sin NaN", () => {
  // Tetraedro (3D de verdad, no un quad plano): un polígono plano no se ve
  // desde la cámara por defecto y el test daría 0 polígonos sin que haya fallo.
  const glb = construirGlb(
    [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]],
    [0, 1, 2, 0, 2, 3, 0, 3, 1, 1, 3, 2],
  );
  const malla = normalizar(simplificar(leerGlb(glb), 12), { alto: 2 });
  const escena = componerEscena(malla, { epoca: "gamecube" });
  assert.ok(escena.poligonos.length > 0, "se ve algo");
  for (const p of escena.poligonos) {
    for (const pt of p.puntos) {
      assert.ok(Number.isFinite(pt.x) && Number.isFinite(pt.y), "sin NaN en el lienzo");
    }
    assert.match(p.color, /^#[0-9a-f]{6}$/, "color válido");
  }
});

test("la malla de referencia del módulo sigue renderizando (no se rompió el import)", () => {
  const escena = componerEscena(MALLA_CAZA, { yaw: 0.4 });
  assert.ok(escena.poligonos.length > 0);
});
