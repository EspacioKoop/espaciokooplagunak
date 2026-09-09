// GLB 2 geometry-only, deliberately bounded; not a general glTF importer.
// One scene/node/mesh/primitive, identity transforms, indexed triangles only.
// No welding, decimation, axis conversion, normalization or material transfer.
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

const MAX_BYTES = 1024 * 1024;
function requireThat(ok, message) {
  if (!ok) throw new Error(`GLB geometry: ${message}`);
}
function integer(value, min, max) {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}
function keys(object, allowed) {
  requireThat(object !== null && typeof object === "object" && !Array.isArray(object), "object expected");
  requireThat(Object.keys(object).every((key) => allowed.includes(key)), "unsupported fields");
}
function one(array) {
  requireThat(Array.isArray(array) && array.length === 1, "exactly one entry required");
  return array[0];
}
function identity(value, expected) {
  requireThat(value === undefined || (Array.isArray(value) && value.length === expected.length &&
    value.every((n, i) => n === expected[i])), "non-identity transform");
}

export function leerGlbGeometria(bytes) {
  requireThat(bytes instanceof Uint8Array && bytes.byteLength >= 28 && bytes.byteLength <= MAX_BYTES, "size limit");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  requireThat(view.getUint32(0, true) === 0x46546c67 && view.getUint32(4, true) === 2, "header/version");
  requireThat(view.getUint32(8, true) === bytes.byteLength, "file length");
  let offset = 12;
  function chunk(type) {
    requireThat(offset + 8 <= bytes.byteLength, "truncated chunk header");
    const length = view.getUint32(offset, true);
    requireThat(view.getUint32(offset + 4, true) === type, "chunk type/order");
    requireThat(length % 4 === 0 && offset + 8 + length <= bytes.byteLength, "chunk length");
    const result = bytes.subarray(offset + 8, offset + 8 + length);
    offset += 8 + length;
    return result;
  }
  const json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(chunk(0x4e4f534a)));
  const bin = chunk(0x004e4942);
  requireThat(offset === bytes.byteLength, "extra chunks/trailing bytes");
  keys(json, ["asset", "scene", "scenes", "nodes", "meshes", "buffers", "bufferViews", "accessors",
    "extensionsUsed", "extensionsRequired", "images", "materials", "samplers", "textures"]);
  requireThat(json.asset?.version === "2.0" && json.asset.minVersion === undefined, "asset version");
  // These extensions only affect the material/UV data deliberately discarded.
  for (const list of [json.extensionsUsed, json.extensionsRequired]) {
    requireThat(list === undefined || (Array.isArray(list) && list.every((name) =>
      ["KHR_materials_unlit", "KHR_texture_transform"].includes(name))), "unsupported extension");
  }
  requireThat(json.scene === undefined || json.scene === 0, "scene index");
  const scene = one(json.scenes);
  keys(scene, ["nodes", "name"]);
  requireThat(one(scene.nodes) === 0, "root node");
  const node = one(json.nodes);
  keys(node, ["mesh", "name", "translation", "rotation", "scale", "matrix"]);
  requireThat(node.mesh === 0, "mesh index");
  requireThat(node.matrix === undefined || [node.translation, node.rotation, node.scale].every((v) => v === undefined), "matrix with TRS");
  identity(node.translation, [0, 0, 0]);
  identity(node.rotation, [0, 0, 0, 1]);
  identity(node.scale, [1, 1, 1]);
  identity(node.matrix, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const mesh = one(json.meshes);
  keys(mesh, ["primitives", "name"]);
  const primitive = one(mesh.primitives);
  keys(primitive, ["attributes", "indices", "mode", "material"]);
  requireThat(primitive.mode === undefined || primitive.mode === 4, "triangles only");
  keys(primitive.attributes, ["POSITION", "NORMAL", "TANGENT", "TEXCOORD_0", "TEXCOORD_1", "COLOR_0"]);
  const buffer = one(json.buffers);
  keys(buffer, ["byteLength", "name"]);
  requireThat(integer(buffer.byteLength, 1, bin.byteLength) && bin.byteLength - buffer.byteLength <= 3, "buffer length");
  requireThat(Array.isArray(json.bufferViews) && Array.isArray(json.accessors), "accessor tables");
  const data = new DataView(bin.buffer, bin.byteOffset, buffer.byteLength);
  function accessor(index, positions) {
    requireThat(integer(index, 0, json.accessors.length - 1), "accessor index");
    const a = json.accessors[index];
    keys(a, ["bufferView", "byteOffset", "componentType", "count", "type", "min", "max", "name"]);
    const width = positions ? 3 : 1;
    requireThat(a.type === (positions ? "VEC3" : "SCALAR"), "accessor type");
    requireThat(positions ? a.componentType === 5126 : [5121, 5123, 5125].includes(a.componentType), "component type");
    requireThat(integer(a.count, 1, 65536) && integer(a.bufferView, 0, json.bufferViews.length - 1), "accessor count/view");
    const bv = json.bufferViews[a.bufferView];
    keys(bv, ["buffer", "byteOffset", "byteLength", "byteStride", "target", "name"]);
    requireThat(bv.buffer === 0, "buffer index");
    const size = a.componentType === 5121 ? 1 : a.componentType === 5123 ? 2 : 4;
    const start = bv.byteOffset === undefined ? 0 : bv.byteOffset;
    const local = a.byteOffset === undefined ? 0 : a.byteOffset;
    const stride = bv.byteStride === undefined ? width * size : bv.byteStride;
    requireThat(integer(start, 0, buffer.byteLength) && integer(bv.byteLength, 1, buffer.byteLength - start), "view bounds");
    requireThat(integer(local, 0, bv.byteLength) && local % size === 0 && (start + local) % size === 0, "accessor offset/alignment");
    requireThat(integer(stride, width * size, 252) && stride % size === 0, "stride");
    requireThat(bv.byteStride === undefined || (positions && stride % 4 === 0), "index stride/vertex alignment");
    requireThat(local + (a.count - 1) * stride + width * size <= bv.byteLength, "accessor bounds");
    const values = [];
    for (let i = 0; i < a.count; i += 1) {
      const row = [];
      for (let c = 0; c < width; c += 1) {
        const p = start + local + i * stride + c * size;
        const n = positions ? data.getFloat32(p, true) : size === 1 ? data.getUint8(p) : size === 2 ? data.getUint16(p, true) : data.getUint32(p, true);
        requireThat(Number.isFinite(n), "nonfinite position");
        row.push(n);
      }
      values.push(positions ? row : row[0]);
    }
    return values;
  }
  const vertices = accessor(primitive.attributes.POSITION, true);
  const indices = accessor(primitive.indices, false);
  requireThat(indices.length % 3 === 0 && indices.every((i) => i < vertices.length), "triangle indices");
  const caras = [];
  for (let i = 0; i < indices.length; i += 3) caras.push(indices.slice(i, i + 3));
  return { vertices, caras };
}

export const FUENTE_BALCONY = Object.freeze({
  path: "tools/sources/kenney-retro-urban-kit/balcony-ladder-bottom.glb",
  sha256: "266b04ffb06c53a17988f858646d1fd1072258050ac3d9ba653004a769cc37d1",
});

// Canonical offline recipe: only this registered CC0 source is emitted by CLI.
export async function convertirBalcony() {
  const bytes = await readFile(new URL("../" + FUENTE_BALCONY.path, import.meta.url));
  requireThat(createHash("sha256").update(bytes).digest("hex") === FUENTE_BALCONY.sha256, "source hash");
  const malla = leerGlbGeometria(bytes);
  // JSON.stringify would erase -0; preserve the exact float values as JS literals.
  const rows = (array) => `[${array.map((row) => `[${row.map((n) => Object.is(n, -0) ? "-0" : String(n)).join(", ")}]`).join(", ")}]`;
  return `// Balcony ladder bottom — Kenney Retro Urban Kit 2.0; CC0 1.0.
// Source: ${FUENTE_BALCONY.path}
// https://kenney.nl/assets/retro-urban-kit
// sha256: ${FUENTE_BALCONY.sha256}
// Regenerate: node tools/convertir-glb-geometria.mjs
// Geometry only; no material, texture, axis conversion or simplification.
export const BALCONY_LADDER_BOTTOM = Object.freeze({
  vertices: ${rows(malla.vertices)},
  caras: ${rows(malla.caras)}
});
`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    requireThat(process.argv.length === 2, "no CLI arguments supported");
    process.stdout.write(await convertirBalcony());
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
