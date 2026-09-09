import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { leerGlbGeometria, convertirBalcony, FUENTE_BALCONY } from "../../tools/convertir-glb-geometria.mjs";
import { BALCONY_LADDER_BOTTOM } from "../data/mallas/balcony-ladder-bottom.mjs";

const original = await readFile(new URL("../../" + FUENTE_BALCONY.path, import.meta.url));
const jsonLength = original.readUInt32LE(12);
const document = JSON.parse(original.subarray(20, 20 + jsonLength));
const binary = original.subarray(28 + jsonLength);
function fixture(change = () => {}, changeBin = () => {}, extraBytes = 0) {
  const doc = structuredClone(document);
  const bin = Buffer.concat([binary, Buffer.alloc(extraBytes)]);
  change(doc);
  changeBin(bin);
  const text = Buffer.from(JSON.stringify(doc));
  const padded = Buffer.alloc(Math.ceil(text.length / 4) * 4, 32);
  text.copy(padded);
  const bytes = Buffer.alloc(28 + padded.length + bin.length);
  bytes.writeUInt32LE(0x46546c67, 0);
  bytes.writeUInt32LE(2, 4);
  bytes.writeUInt32LE(bytes.length, 8);
  bytes.writeUInt32LE(padded.length, 12);
  bytes.writeUInt32LE(0x4e4f534a, 16);
  padded.copy(bytes, 20);
  bytes.writeUInt32LE(bin.length, 20 + padded.length);
  bytes.writeUInt32LE(0x004e4942, 24 + padded.length);
  bin.copy(bytes, 28 + padded.length);
  return bytes;
}

test("official source hash and exact published geometry, including signed zero", () => {
  assert.equal(original.length, 4196);
  assert.equal(createHash("sha256").update(original).digest("hex"), FUENTE_BALCONY.sha256);
  const malla = leerGlbGeometria(original);
  assert.equal(malla.vertices.length, 48);
  assert.equal(malla.caras.length, 28);
  assert.deepStrictEqual(malla, BALCONY_LADDER_BOTTOM);
  assert.deepStrictEqual(Object.keys(malla), ["vertices", "caras"]);
});

test("reproducible CLI emits the same geometry without loading textures", async () => {
  const first = await convertirBalcony();
  assert.equal(first, await convertirBalcony());
  const generated = await import(`data:text/javascript;base64,${Buffer.from(first).toString("base64")}`);
  assert.deepStrictEqual(generated.BALCONY_LADDER_BOTTOM, BALCONY_LADDER_BOTTOM);
  const run = spawnSync(process.execPath, [new URL("../../tools/convertir-glb-geometria.mjs", import.meta.url).pathname], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout, first);
});

test("Buffer subarray and explicit identity/default triangles preserve geometry", () => {
  const source = fixture((d) => { d.meshes[0].primitives[0].mode = 4; d.nodes[0].translation = [0, 0, 0]; });
  const padded = Buffer.concat([Buffer.alloc(7), source, Buffer.alloc(9)]);
  assert.deepStrictEqual(leerGlbGeometria(padded.subarray(7, 7 + source.length)), BALCONY_LADDER_BOTTOM);
});

for (const [componentType, width] of [[5123, 2], [5125, 4]]) {
  test(`unsigned ${width * 8}-bit indices retain triangles`, () => {
    const bytes = fixture((d) => {
      d.accessors[4].componentType = componentType;
      d.bufferViews[4].byteLength = 84 * width;
      d.buffers[0].byteLength = 2304 + 84 * width;
    }, (b) => {
      for (let i = 0; i < 84; i += 1) {
        if (width === 2) b.writeUInt16LE(binary[2304 + i], 2304 + i * width);
        else b.writeUInt32LE(binary[2304 + i], 2304 + i * width);
      }
    }, 84 * (width - 1));
    assert.deepStrictEqual(leerGlbGeometria(bytes), BALCONY_LADDER_BOTTOM);
  });
}

test("canonical source regenerates the versioned file byte for byte", async () => {
  assert.equal(await convertirBalcony(), await readFile(new URL("../data/mallas/balcony-ladder-bottom.mjs", import.meta.url), "utf8"));
});

const hostileDocuments = {
  "null view offset": (d) => { d.bufferViews[0].byteOffset = null; },
  "null accessor offset": (d) => { d.accessors[0].byteOffset = null; },
  "null stride": (d) => { d.bufferViews[0].byteStride = null; },
  "negative view offset": (d) => { d.bufferViews[0].byteOffset = -1; },
  "fractional accessor offset": (d) => { d.accessors[0].byteOffset = 0.5; },
  "misaligned accessor": (d) => { d.accessors[0].byteOffset = 1; },
  "view overrun": (d) => { d.bufferViews[0].byteLength = 100000; },
  "accessor crosses view despite fitting BIN": (d) => { d.bufferViews[0].byteLength = 575; },
  "index accessor crosses view": (d) => { d.accessors[4].byteOffset = 1; },
  "negative count": (d) => { d.accessors[0].count = -1; },
  "huge count": (d) => { d.accessors[0].count = 2 ** 40; },
  "bad stride": (d) => { d.bufferViews[0].byteStride = 8; },
  "index stride": (d) => { d.bufferViews[4].byteStride = 4; },
  "external buffer": (d) => { d.buffers[0].uri = "elsewhere.bin"; },
  "short declared buffer": (d) => { d.buffers[0].byteLength = 2387; },
  "long declared buffer": (d) => { d.buffers[0].byteLength = 2392; },
  "unknown buffer": (d) => { d.bufferViews[0].buffer = 1; },
  "unknown accessor": (d) => { d.meshes[0].primitives[0].attributes.POSITION = 900; },
  "sparse accessor": (d) => { d.accessors[0].sparse = {}; },
  "normalized accessor": (d) => { d.accessors[0].normalized = true; },
  "integer position": (d) => { d.accessors[0].componentType = 5123; },
  "float indices": (d) => { d.accessors[4].componentType = 5126; },
  "incomplete triangle": (d) => { d.accessors[4].count = 83; },
  "strip": (d) => { d.meshes[0].primitives[0].mode = 5; },
  "morph targets": (d) => { d.meshes[0].primitives[0].targets = []; },
  "compression": (d) => { d.meshes[0].primitives[0].extensions = { KHR_draco_mesh_compression: {} }; },
  "unknown required extension": (d) => { d.extensionsRequired.push("EXT_mesh_gpu_instancing"); },
  "translation": (d) => { d.nodes[0].translation = [1, 0, 0]; },
  "rotation": (d) => { d.nodes[0].rotation = [0, 1, 0, 0]; },
  "scale": (d) => { d.nodes[0].scale = [2, 1, 1]; },
  "matrix": (d) => { d.nodes[0].matrix = Array(16).fill(0); },
  "children": (d) => { d.nodes[0].children = [0]; },
  "skin": (d) => { d.nodes[0].skin = 0; },
  "animations": (d) => { d.animations = []; },
  "multiple primitives": (d) => { d.meshes[0].primitives.push(d.meshes[0].primitives[0]); },
  "multiple nodes": (d) => { d.nodes.push(d.nodes[0]); },
  "multiple scenes": (d) => { d.scenes.push(d.scenes[0]); },
  "nonzero scene": (d) => { d.scene = 1; },
};
for (const [name, mutate] of Object.entries(hostileDocuments)) {
  test(`reject ${name}`, () => assert.throws(() => leerGlbGeometria(fixture(mutate)), /GLB geometry:/));
}
for (const value of [NaN, Infinity, -Infinity]) {
  test(`reject nonfinite position ${value}`, () => assert.throws(() =>
    leerGlbGeometria(fixture(undefined, (b) => b.writeFloatLE(value, 0))), /nonfinite/));
}
test("reject vertex index outside positions", () => assert.throws(() =>
  leerGlbGeometria(fixture(undefined, (b) => { b[2304] = 48; })), /triangle indices/));

const hostileBytes = {
  "wrong GLB version": (b) => { b.writeUInt32LE(1, 4); return b; },
  "wrong magic": (b) => { b.writeUInt32LE(0, 0); return b; },
  "wrong total length": (b) => { b.writeUInt32LE(b.length - 4, 8); return b; },
  "chunk overrun": (b) => { b.writeUInt32LE(0xfffffffc, 12); return b; },
  "unaligned chunk": (b) => { b.writeUInt32LE(jsonLength - 1, 12); return b; },
  "duplicate JSON chunk": (b) => { b.writeUInt32LE(0x4e4f534a, 24 + jsonLength); return b; },
  "truncated chunk header": (b) => { const out = b.subarray(0, 24 + jsonLength); out.writeUInt32LE(out.length, 8); return out; },
  "extra chunk": (b) => { const out = Buffer.concat([b, Buffer.alloc(8)]); out.writeUInt32LE(out.length, 8); return out; },
  "size cap": () => Buffer.alloc(1024 * 1024 + 1),
};
for (const [name, mutate] of Object.entries(hostileBytes)) {
  test(`reject ${name}`, () => assert.throws(() => leerGlbGeometria(mutate(Buffer.from(original))), /GLB geometry:/));
}
