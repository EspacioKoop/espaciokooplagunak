// Pruebas del cargador OBJ y del pipeline de conversión a malla del módulo.
//
// No necesita el binario de origen (que no vive en el repo): se alimenta de
// OBJ de texto y de la malla de la nariz del caza ya existente. Lo que se
// comprueba es que un OBJ cualquiera —el formato que NASA 3D, Europeana y
// Wikidata sueltan— entra en el mismo {vertices, caras} que el STL y acaba
// renderizando en la escena retro3d, no que un fichero concreto exista.

import assert from "node:assert/strict";
import test from "node:test";

import { leerObj, leerGlb, simplificar, normalizar, moduloDeMalla, validarNombre } from "../../tools/convertir-estatua.mjs";
import { normalizarGlb } from "../../tools/normalizar-glb.mjs";
import { componerEscena, MALLA_CAZA } from "../../foundry-module/scripts/retro3d.mjs";
import draco3d from "draco3d";

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
// Como construirGlb, pero con índices UINT32 (componentType 5125) y el GLB
// marcado como Draco: así `normalizarGlb` toma la rama de primitiva PLANA y
// re-empaqueta los índices, que es donde elegía mal el tipo.
function construirGlbUint32MarcadoDraco(nVertices, indices) {
  const f = new Float32Array(nVertices * 3);
  for (let i = 0; i < nVertices; i += 1) {
    f[i * 3] = i * 0.001;
    f[i * 3 + 1] = 0;
    f[i * 3 + 2] = 0;
  }
  const posBytes = new Uint8Array(f.buffer, f.byteOffset, f.byteLength);
  const idxBytes = new Uint8Array(Uint32Array.from(indices).buffer);
  const binSinPad = posBytes.length + idxBytes.length;
  const bin = new Uint8Array(binSinPad + ((4 - (binSinPad % 4)) % 4));
  bin.set(posBytes, 0);
  bin.set(idxBytes, posBytes.length);

  const json = {
    extensionsUsed: ["KHR_draco_mesh_compression"],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: posBytes.length, target: 34962 },
      { buffer: 0, byteOffset: posBytes.length, byteLength: idxBytes.length, target: 34963 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: nVertices, type: "VEC3",
        min: [0, 0, 0], max: [nVertices * 0.001, 0, 0] },
      { bufferView: 1, componentType: 5125, count: indices.length, type: "SCALAR" },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
  };
  let jsonStr = JSON.stringify(json);
  jsonStr += " ".repeat((4 - (jsonStr.length % 4)) % 4);
  const jsonBytes = new TextEncoder().encode(jsonStr);
  const total = 12 + 8 + jsonBytes.length + 8 + bin.length;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jsonBytes.length, true);
  dv.setUint32(16, 0x4e4f534a, true);
  out.set(jsonBytes, 20);
  const o2 = 20 + jsonBytes.length;
  dv.setUint32(o2, bin.length, true);
  dv.setUint32(o2 + 4, 0x004e4942, true);
  out.set(bin, o2 + 8);
  return out;
}

function construirGlb(posiciones, indices, sinBufferView = false) {
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
    accessors: [{ ...(sinBufferView ? {} : { bufferView: 0 }), componentType: 5126, count: posiciones.length, type: "VEC3", min: [0, 0, 0], max: [1, 1, 1] }],
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

test("REGRESIÓN: un GLB con POSITION sin bufferView lanza error claro (no crash)", () => {
  // NASA 3D Resources exporta varios modelos (Argo, Ares 1, CubeSat,
  // Aeronomy of Ice…) con accessors POSITION SIN bufferView y sin la
  // geometría en el fichero. Antes estallaba con
  // `Cannot read properties of undefined (reading 'buffer')`; ahora da un
  // error que dice qué pasa y qué hacer.
  const glb = construirGlb([[0, 0, 0], [1, 0, 0], [0, 1, 0]], null, true);
  assert.throws(() => leerGlb(glb), /no conforme|bufferView/);
});

test("REGRESIÓN: un GLB indexado cuyo accessor de índices falta de bufferView lanza claro", () => {
  // Variante del caso anterior: el POSITION es conforme pero los índices no.
  const pos = construirGlb([[0, 0, 0], [1, 0, 0], [0, 1, 0]], [0, 1, 2]);
  const dv = new DataView(pos.buffer, pos.byteOffset, pos.byteLength);
  const jsonLen = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(pos.subarray(20, 20 + jsonLen)));
  delete json.accessors[1].bufferView; // quita el bufferView de los índices
  let jsonStr = JSON.stringify(json);
  jsonStr += " ".repeat((4 - (jsonStr.length % 4)) % 4);
  const jsonBytes = new TextEncoder().encode(jsonStr);
  const binLen = dv.getUint32(20 + jsonLen, true);
  const binOff = 20 + jsonLen;
  const total = 12 + 8 + jsonBytes.length + 8 + binLen;
  const out = new Uint8Array(total);
  const ndv = new DataView(out.buffer);
  out.set(pos.subarray(0, 20), 0);
  ndv.setUint32(12, jsonBytes.length, true);
  out.set(jsonBytes, 20);
  const nbinOff = 20 + jsonBytes.length;
  ndv.setUint32(8, total, true);
  ndv.setUint32(nbinOff, binLen, true);
  ndv.setUint32(nbinOff + 4, 0x004e4942, true);
  out.set(pos.subarray(binOff + 8, binOff + 8 + binLen), nbinOff + 8);
  assert.throws(() => leerGlb(out), /no conforme|bufferView/);
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

// --- Fixture Draco sintético -------------------------------------------------
// No usamos un binario de NASA: lo generamos con el encoder de draco3d. Así la
// prueba es determinista, no toca la red y no introduce binarios de origen en el
// repo (ver PROCEDENCIA_ASSETS.md). El cubo es 8 vértices / 12 triángulos.
const DT_FLOAT32 = 6;
async function construirGlbDraco(posiciones, indices, mn = [-1, -1, -1], mx = [1, 1, 1]) {
  const encMod = await draco3d.createEncoderModule();
  const mb = new encMod.MeshBuilder();
  const mesh = new encMod.Mesh();
  mb.AddFloatAttributeToMesh(mesh, 0, DT_FLOAT32, 3, Float32Array.from(posiciones.flat()));
  mb.AddFacesToMesh(mesh, indices.length / 3, Uint32Array.from(indices));
  const encoder = new encMod.Encoder();
  encoder.SetEncodingMethod(encMod.MESH_EDGEBREAKER_ENCODING);
  encoder.SetAttributeQuantization(0, 14);
  const encodedData = new encMod.DracoInt8Array();
  const len = encoder.EncodeMeshToDracoBuffer(mesh, encodedData);
  if (len <= 0) throw new Error("fallo al codificar Draco");
  const blob = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) blob[i] = encodedData.GetValue(i);
  const json = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{
      primitives: [{
        attributes: { POSITION: 0 },
        extensions: { KHR_draco_mesh_compression: { bufferView: 0, attributes: { POSITION: 0 } } },
      }],
    }],
    accessors: [{ componentType: 5126, count: posiciones.length / 3, type: "VEC3", min: mn, max: mx }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: blob.length }],
    buffers: [{ byteLength: blob.length }],
    extensionsUsed: ["KHR_draco_mesh_compression"],
  };
  const jsonStr = JSON.stringify(json);
  const pad = (s) => s + " ".repeat((4 - (s.length % 4)) % 4);
  const jb = Buffer.from(pad(jsonStr), "utf8");
  const bin = Buffer.from(blob);
  const pad4 = (b) => { const r = b.length % 4; return r ? Buffer.concat([b, Buffer.alloc(4 - r)]) : b; };
  const jp = pad4(jb);
  const bp = pad4(bin);
  const total = 12 + 8 + jp.length + 8 + bp.length;
  const out = Buffer.alloc(total);
  out.writeUInt32LE(0x46546c67, 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(total, 8);
  out.writeUInt32LE(jp.length, 12);
  out.writeUInt32LE(0x4e4f534a, 16);
  jp.copy(out, 20);
  const o2 = 20 + jp.length;
  out.writeUInt32LE(bp.length, o2);
  out.writeUInt32LE(0x004e4942, o2 + 4);
  bp.copy(out, o2 + 8);
  return new Uint8Array(out);
}

const MALLA_MINIMA = { vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]], caras: [[0, 1, 2]] };
const FICHA_MINIMA = {
  obra: "Pieza de prueba", modelo: "m", autoria: "a",
  fuente: "https://example.org", licencia: "CC0", sha256: "0".repeat(64),
};

test("validarNombre rechaza lo que saldría del directorio de mallas", () => {
  // El nombre decide DOS cosas peligrosas: la ruta que se escribe y el
  // identificador exportado. Se valida el nombre, no la ruta ya construida.
  for (const malo of [
    "../../../PR837_ESCAPE", "a/b", "a\\b", "leon-al-lat/../../x",
    "", "Mayúsculas", "con espacio", "-guion-al-principio", "x".repeat(65),
  ]) {
    assert.throws(() => validarNombre(malo), /no válido/, `debería rechazar ${JSON.stringify(malo)}`);
  }
  for (const bueno of ["leon-al-lat", "e2e-nasa-1234", "pieza9"]) {
    assert.equal(validarNombre(bueno), bueno);
  }
});

test("moduloDeMalla rechaza un salto de línea en la procedencia (inyección)", () => {
  // Un `\n` en --obra cerraba el comentario y dejaba el resto como CÓDIGO en un
  // fichero que después se importa.
  for (const campo of ["obra", "modelo", "autoria", "fuente", "licencia"]) {
    const ficha = { ...FICHA_MINIMA, [campo]: "X\nexport const INYECTADO = 1;" };
    assert.throws(
      () => moduloDeMalla("pieza", MALLA_MINIMA, ficha),
      /saltos de línea/,
      `${campo} debería rechazarse`,
    );
  }
  assert.throws(
    () => moduloDeMalla("pieza", MALLA_MINIMA, { ...FICHA_MINIMA, obra: "X\u2028y" }),
    /saltos de línea/,
    "U+2028 también termina una línea en JavaScript",
  );
});

test("moduloDeMalla exige un nombre válido antes de componer el identificador", () => {
  assert.throws(() => moduloDeMalla("../fuera", MALLA_MINIMA, FICHA_MINIMA), /no válido/);
  const txt = moduloDeMalla("leon-al-lat", MALLA_MINIMA, FICHA_MINIMA);
  assert.match(txt, /export const LEON_AL_LAT = Object\.freeze\(/);
});

test("normalizarGlb conserva la forma de una malla ANISÓTROPA y desplazada", async () => {
  // Una caja de 100 x 1 x 1 corrida del origen. Con la des-cuantización hecha a
  // mano —una sola escala global repartida entre los tres ejes— salía como
  // 200 x 0 x 0: los ejes cortos se aplastaban a nada. Un cubo no lo detecta,
  // porque ahí la escala global SÍ vale para los tres ejes.
  const P = [
    [-50, -0.5, -0.5], [50, -0.5, -0.5], [50, 0.5, -0.5], [-50, 0.5, -0.5],
    [-50, -0.5, 0.5], [50, -0.5, 0.5], [50, 0.5, 0.5], [-50, 0.5, 0.5],
  ];
  const I = [
    0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1,
    1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0,
  ];
  const glb = await construirGlbDraco(P, I, [-50, -0.5, -0.5], [50, 0.5, 0.5]);
  const m = leerGlb((await normalizarGlb(glb)).bytes);
  const rango = (c) => {
    const v = m.vertices.map((p) => p[c]);
    return Math.max(...v) - Math.min(...v);
  };
  // Tolerancia amplia: la cuantización a 14 bits sobre una caja tan alargada
  // deja un error de milésimas. Lo que se vigila es la PROPORCIÓN, no el bit.
  assert.ok(Math.abs(rango(0) - 100) < 0.5, `eje largo ${rango(0)} ≈ 100`);
  assert.ok(Math.abs(rango(1) - 1) < 0.05, `eje corto Y ${rango(1)} ≈ 1`);
  assert.ok(Math.abs(rango(2) - 1) < 0.05, `eje corto Z ${rango(2)} ≈ 1`);
});

test("normalizarGlb pasa de largo un GLB ya plano (draco:false, bytes ídem)", async () => {
  const glb = construirGlb([[0, 0, 0], [1, 0, 0], [0, 1, 0]], [0, 1, 2]);
  const r = await normalizarGlb(glb);
  assert.equal(r.draco, false);
  assert.deepEqual([...r.bytes], [...glb], "bytes sin cambios");
});

test("normalizarGlb decodifica un GLB Draco compacto → malla 3D (8 vértices, 12 caras)", async () => {
  const glbDraco = await construirGlbDraco(
    [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
    [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0],
  );
  const r = await normalizarGlb(glbDraco);
  assert.equal(r.draco, true, "marcó que venía comprimido");
  assert.ok(r.estadisticas.vertices > 0, "estadísticas con vértices");
  const m = leerGlb(r.bytes);
  assert.equal(m.vertices.length, 8, "8 vértices tras decodificar");
  assert.equal(m.caras.length, 12, "12 caras (triangulado)");
  // La geometría decodificada debe ser finita y los índices válidos.
  for (const v of m.vertices) {
    assert.equal(v.length, 3, "vértice es tripleta");
    for (const c of v) assert.ok(Number.isFinite(c), "coordenada finita");
  }
  assert.ok(
    m.vertices.some((v) => v.some((c) => Math.abs(c) > 0.5)),
    "geometría no degenerada (hay vértices fuera del origen, no todo ceros)",
  );
  for (const f of m.caras) {
    assert.equal(f.length, 3, "cara triangular");
    for (const i of f) {
      assert.ok(Number.isInteger(i) && i >= 0 && i < m.vertices.length, "índice dentro de rango");
    }
  }
  // Y entra en el pipeline de malla sin estallar.
  const malla = normalizar(simplificar(m, 12), { alto: 2 });
  assert.ok(Array.isArray(malla.vertices), "sale del pipeline como malla");
});

test("el tipo de índice lo decide el valor MÁXIMO, no cuántos índices hay", async () => {
  // Pocos índices que apuntan muy alto: `indices.length > 65535` era falso, así
  // que se declaraba UNSIGNED_SHORT y `[0, 65536, 69999]` se truncaba a
  // `[0, 0, 4463]` — la malla salía conectando vértices equivocados.
  const glb = construirGlbUint32MarcadoDraco(70000, [0, 65536, 69999]);
  const r = await normalizarGlb(glb);
  const { json } = leerChunksGlbDePrueba(r.bytes);
  const accIdx = json.accessors[json.meshes[0].primitives[0].indices];
  assert.equal(accIdx.componentType, 5125, "debe ser UNSIGNED_INT: el máximo pasa de 65535");

  const m = leerGlb(r.bytes);
  assert.deepEqual(m.caras[0], [0, 65536, 69999], "los índices sobreviven al viaje");
});

test("con todos los índices por debajo de 65535 se conserva UNSIGNED_SHORT", async () => {
  // El recorte importa: subir todo a UNSIGNED_INT dobla el tamaño del buffer
  // de índices de cualquier malla normal.
  const glb = construirGlbUint32MarcadoDraco(70000, [0, 1, 65535]);
  const r = await normalizarGlb(glb);
  const { json } = leerChunksGlbDePrueba(r.bytes);
  const accIdx = json.accessors[json.meshes[0].primitives[0].indices];
  assert.equal(accIdx.componentType, 5123, "UNSIGNED_SHORT sigue siendo suficiente");
  assert.deepEqual(leerGlb(r.bytes).caras[0], [0, 1, 65535]);
});

/** Lee el chunk JSON de un GLB, para inspeccionar los accessors producidos. */
function leerChunksGlbDePrueba(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const largoJson = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + largoJson)));
  return { json };
}
