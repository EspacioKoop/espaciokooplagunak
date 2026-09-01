// Normalización glTF para el pipeline NASA.
//
// NASA 3D Resources publica muchos de sus modelos COMPRIMIDOS con Draco
// (extensión KHR_draco_mesh_compression). Un loader glTF estándar no los lee:
// la geometría no está como floats en el buffer, sino empaquetada en un blob
// Draco que hay que decodificar. Eso es exactamente lo que le pasaba a leerGlb
// antes de este paso (veía los accessors POSITION sin bufferView y estallaba,
// o no encontraba la geometría).
//
// Este módulo decodifica Draco y reempaqueta a un GLB canónico de UN solo
// buffer, con accessors POSITION + NORMAL + indices, que leerGlb (convertir-
// estatua.mjs) ya entiende. Solo corre en Node: draco3d carga un WASM. El
// navegador nunca lo ve, porque el convertidor produce una malla .mjs plana.
//
// Qué se preserva: POSITION (float VEC3), NORMAL (float VEC3, si el modelo lo
// trae) e indices. El resto de atributos (TEXCOORD, COLOR, JOINTS…) se
// descartan: el consumidor de este pipeline (retro3d) solo usa geometría, y
// los materiales/UV van por la frontera de arte de #351. NASA además deja las
// texturas como ficheros .jpg externos, no embebidos.

import draco3d from "draco3d";

let _modulo = null;
async function moduloDraco() {
  if (!_modulo) _modulo = await draco3d.createDecoderModule();
  return _modulo;
}

function leerChunksGlb(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 12 || dv.getUint32(0, true) !== 0x46546c67) {
    throw new Error("no es un GLB (magic glTF ausente)");
  }
  if (dv.getUint32(8, true) !== bytes.byteLength) throw new Error("GLB truncado");
  let off = 12;
  let json = null;
  let bin = null;
  while (off + 8 <= bytes.byteLength) {
    const largo = dv.getUint32(off, true);
    const tipo = dv.getUint32(off + 4, true);
    const datos = bytes.subarray(off + 8, off + 8 + largo);
    if (tipo === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(datos));
    else if (tipo === 0x004e4942) bin = datos;
    off += 8 + largo + ((4 - (largo % 4)) % 4);
  }
  if (!json) throw new Error("GLB sin chunk JSON");
  return { json, bin };
}

function componerGlb(json, bin) {
  const jsonStr = JSON.stringify(json);
  const jsonPad = jsonStr + " ".repeat((4 - (jsonStr.length % 4)) % 4);
  const jsonBytes = new TextEncoder().encode(jsonPad);
  const total = 12 + 8 + jsonBytes.length + 8 + bin.byteLength;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  out.set([0x67, 0x6c, 0x54, 0x46], 0); // "glTF"
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jsonBytes.length, true);
  dv.setUint32(16, 0x4e4f534a, true);
  out.set(jsonBytes, 20);
  const binOff = 20 + jsonBytes.length;
  dv.setUint32(binOff, bin.byteLength, true);
  dv.setUint32(binOff + 4, 0x004e4942, true);
  out.set(bin, binOff + 8);
  return out;
}

// Lee un accessor completo del json/bin original (para primitivas PLANAS que
// pudiera haber en un GLB que usa Draco en otras). Asume empaquetado apretado
// (ignora bufferView.byteStride: NASA no entrelaza).
function leerAccessor(json, bin, idx) {
  const acc = json.accessors[idx];
  const bv = json.bufferViews[acc.bufferView];
  const base = bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
  const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[acc.type];
  const bytesPer = { 5126: 4, 5123: 2, 5125: 4, 5121: 1 }[acc.componentType];
  const comp = acc.componentType;
  const out =
    comp === 5123 ? new Uint16Array(acc.count * comps)
    : comp === 5125 ? new Uint32Array(acc.count * comps)
    : comp === 5121 ? new Uint8Array(acc.count * comps)
    : new Float32Array(acc.count * comps);
  const dv = new DataView(base.buffer, base.byteOffset, base.byteLength);
  for (let i = 0; i < acc.count; i += 1) {
    for (let c = 0; c < comps; c += 1) {
      const o = (acc.byteOffset || 0) + i * comps * bytesPer + c * bytesPer;
      out[i * comps + c] =
        comp === 5126 ? dv.getFloat32(o, true)
        : comp === 5123 ? dv.getUint16(o, true)
        : comp === 5125 ? dv.getUint32(o, true)
        : dv.getUint8(o, true);
    }
  }
  return out;
}

function decodificarDraco(modulo, decoder, blob, prim) {
  const buffer = new modulo.DecoderBuffer();
  buffer.Init(blob, blob.length);
  const tipo = decoder.GetEncodedGeometryType(buffer);
  if (tipo !== modulo.TRIANGULAR_MESH) {
    throw new Error(`Draco: tipo de geometría ${tipo} no soportado (solo mallas triangulares)`);
  }
  const mesh = new modulo.Mesh();
  const status = decoder.DecodeBufferToMesh(buffer, mesh);
  if (!status.ok() || mesh.num_points() === 0) {
    throw new Error(`Draco: fallo al decodificar — ${status.error_msg()}`);
  }
  const numP = mesh.num_points();
  const mapeo = prim.extensions["KHR_draco_mesh_compression"].attributes;

  // La des-cuantización la hace DRACO, no nosotros. El puente de emscripten
  // escribe en su propio `DracoFloat32Array`: pasarle un `Float32Array` nativo
  // no rellena nada, la llamada se daba por fallida y caíamos en una
  // reconstrucción a mano que repartía UNA escala global entre los tres ejes.
  // En una malla anisótropa eso deforma: una caja de 100 x 1 x 1 salía como
  // 200 x 0 x 0 — geometría fiel es justo lo que esta herramienta promete.
  const sacarFlotantes = (attr) => {
    const comps = attr.num_components();
    const dfa = new modulo.DracoFloat32Array();
    const ok = decoder.GetAttributeFloatForAllPoints(mesh, attr, dfa);
    if (!ok) {
      modulo.destroy(dfa);
      throw new Error("Draco: no se pudo leer un atributo como flotante");
    }
    const arr = new Float32Array(numP * comps);
    for (let i = 0; i < arr.length; i += 1) arr[i] = dfa.GetValue(i);
    modulo.destroy(dfa);
    return arr;
  };

  const posiciones = sacarFlotantes(decoder.GetAttributeByUniqueId(mesh, mapeo.POSITION));
  let normales = null;
  if (mapeo.NORMAL !== undefined) {
    normales = sacarFlotantes(decoder.GetAttributeByUniqueId(mesh, mapeo.NORMAL));
  }

  // Los índices pueden venir como triángulos o como tiras; GetFaceFromMesh
  // los expande a triángulos en ambos casos, así que lo usamos en bucle en vez
  // de GetTrianglesUInt32Array (que devuelve 0 si el malla está en strips).
  const numF = mesh.num_faces();
  const indices = new Uint32Array(numF * 3);
  for (let i = 0; i < numF; i += 1) {
    const cara = new modulo.DracoInt32Array();
    decoder.GetFaceFromMesh(mesh, i, cara);
    indices[i * 3] = cara.GetValue(0);
    indices[i * 3 + 1] = cara.GetValue(1);
    indices[i * 3 + 2] = cara.GetValue(2);
    modulo.destroy(cara);
  }
  return { posiciones, normales, indices };
}

function empaquetar(buffers, arr) {
  const pad = (4 - (arr.byteLength % 4)) % 4;
  const byteOffset = buffers.reduce((o, s) => o + s.byteLength + ((4 - (s.byteLength % 4)) % 4), 0);
  const conPad = new Uint8Array(arr.byteLength + pad);
  conPad.set(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength), 0);
  buffers.push(conPad);
  return { byteOffset, byteLength: arr.byteLength };
}

function minMaxVEC3(posiciones) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < posiciones.length; i += 3) {
    for (let c = 0; c < 3; c += 1) {
      const v = posiciones[i + c];
      if (v < min[c]) min[c] = v;
      if (v > max[c]) max[c] = v;
    }
  }
  return { min, max };
}

export async function normalizarGlb(bytes) {
  const { json, bin } = leerChunksGlb(bytes);
  const usados = json.extensionsUsed || [];
  if (!usados.includes("KHR_draco_mesh_compression")) {
    return { bytes, draco: false };
  }

  const modulo = await moduloDraco();
  const decoder = new modulo.Decoder();

  const buffers = [];
  const accessors = [];
  const bufferViews = [];
  const meshes = [];
  let primitivasDecodificadas = 0;
  let vertices = 0;
  let triangulos = 0;

  for (const mesh of json.meshes) {
    const primitivas = [];
    for (const prim of mesh.primitives) {
      const ext = prim.extensions && prim.extensions["KHR_draco_mesh_compression"];
      let posiciones, normales, indices;

      if (ext) {
        const blob = bin.subarray(
          json.bufferViews[ext.bufferView].byteOffset,
          json.bufferViews[ext.bufferView].byteOffset + json.bufferViews[ext.bufferView].byteLength,
        );
        ({ posiciones, normales, indices } = decodificarDraco(modulo, decoder, blob, prim));
        primitivasDecodificadas += 1;
      } else {
        // Primitiva plana dentro de un GLB Draco: la leemos tal cual y re-embebemos.
        posiciones = leerAccessor(json, bin, prim.attributes.POSITION);
        normales = prim.attributes.NORMAL !== undefined ? leerAccessor(json, bin, prim.attributes.NORMAL) : null;
        indices = prim.indices !== undefined ? leerAccessor(json, bin, prim.indices) : null;
      }

      vertices += posiciones.length / 3;
      if (indices) triangulos += indices.length / 3;

      const posBv = empaquetar(buffers, posiciones);
      const { min, max } = minMaxVEC3(posiciones);
      const posAcc = accessors.push({
        bufferView: bufferViews.length,
        componentType: 5126,
        count: posiciones.length / 3,
        type: "VEC3",
        min,
        max,
      }) - 1;
      bufferViews.push({ buffer: 0, byteOffset: posBv.byteOffset, byteLength: posBv.byteLength });

      const nuevaPrim = { attributes: { POSITION: posAcc } };

      if (normales) {
        const nBv = empaquetar(buffers, normales);
        const nAcc = accessors.push({
          bufferView: bufferViews.length,
          componentType: 5126,
          count: normales.length / 3,
          type: "VEC3",
        }) - 1;
        bufferViews.push({ buffer: 0, byteOffset: nBv.byteOffset, byteLength: nBv.byteLength });
        nuevaPrim.attributes.NORMAL = nAcc;
      }

      if (indices) {
        // El tipo lo decide el VALOR MÁXIMO, no cuántos índices hay: una malla
        // de 70.000 vértices puede tener tres índices, y `[0, 65536, 69999]`
        // metido en un Uint16Array se convierte en `[0, 0, 4463]` — el modelo
        // sale conectando vértices equivocados, sin ningún error por el camino.
        let maxIdx = 0;
        for (let i = 0; i < indices.length; i += 1) {
          if (indices[i] > maxIdx) maxIdx = indices[i];
        }
        const idxComp = maxIdx > 65535 ? 5125 : 5123;
        const idxArr = idxComp === 5125 ? new Uint32Array(indices) : new Uint16Array(indices);
        const iBv = empaquetar(buffers, idxArr);
        const iAcc = accessors.push({
          bufferView: bufferViews.length,
          componentType: idxComp,
          count: idxArr.length,
          type: "SCALAR",
        }) - 1;
        bufferViews.push({ buffer: 0, byteOffset: iBv.byteOffset, byteLength: iBv.byteLength });
        nuevaPrim.indices = iAcc;
      }

      primitivas.push(nuevaPrim);
    }
    meshes.push({ name: mesh.name, primitives: primitivas });
  }

  const binBytes = new Uint8Array(buffers.reduce((t, s) => t + s.byteLength, 0));
  let cur = 0;
  for (const s of buffers) {
    binBytes.set(s, cur);
    cur += s.byteLength;
  }

  const nuevoJson = {
    asset: json.asset || { version: "2.0", generator: "normalizar-glb (decode Draco)" },
    scene: json.scene,
    scenes: json.scenes,
    nodes: json.nodes,
    meshes,
    accessors,
    bufferViews,
    buffers: [{ byteLength: binBytes.byteLength }],
  };

  return {
    bytes: componerGlb(nuevoJson, binBytes),
    draco: true,
    estadisticas: { primitivasDecodificadas, vertices, triangulos },
  };
}
