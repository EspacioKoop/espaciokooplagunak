#!/usr/bin/env node
// Convierte una malla de terceros (STL binario) en una malla del módulo (#590).
//
// QUÉ RESUELVE. El motor consume `{vertices, caras}` con color plano por cara, y
// lo que hay ahí fuera son escaneos y esculpidos de decenas de miles de
// triángulos. Sin este paso, «traer una estatua» significa modelarla a mano en
// cajas — y una Victoria de Samotracia hecha de cajas es un muñeco, que es peor
// que no tener estatua.
//
// EL DECIMADO ES POR COLAPSO DE ARISTAS CON MÉTRICA DE ERROR (QEM), y se llegó
// a él descartando la alternativa fácil. La primera versión cuantizaba los
// vértices a una rejilla y fundía los que caían en la misma celda: es
// determinista, cabe en veinte líneas, y el razonamiento parecía bueno —facetas
// grandes y planas, que es el aspecto de la época que este motor imita—.
//
// No funciona, y verlo costó un render. El León de Al-Lāt es un RELIEVE, o sea
// casi toda su geometría está en una cara con detalle fino. Cuantizar eso
// produce una costra de triángulos con normales al azar: el resultado no era
// una talla facetada, era ruido con silueta de losa. La agrupación en rejilla
// reparte el error por igual en todo el volumen, y en un relieve el error hay
// que gastarlo donde está la forma.
//
// QEM colapsa la arista que MENOS altera los planos que la rodean, así que gasta
// triángulos donde hay curvatura y los quita donde la superficie ya es plana.
// Conserva la silueta, que es lo que hace reconocible una escultura. Y sigue
// saliendo facetado —a novecientas caras no hay más remedio—, o sea que el
// aspecto de época se consigue igual, pero por la vía correcta: pocos planos
// GRANDES bien puestos en vez de muchos pequeños mal puestos.
//
// LA ESTATUA SE PINTA CON NUESTRA PALETA, no con su textura (frontera de arte de
// #351). Por eso solo se importa GEOMETRÍA: el color lo pone la escena.
//
// EL BINARIO DE ORIGEN NO ENTRA EN EL REPOSITORIO. Se descarga aparte, se anota
// su sha256 en la ficha de procedencia y esta herramienta lo consume desde donde
// esté. Un STL de metro y medio en el árbol para producir un fichero de texto de
// veinte kilobytes es pagar el peso dos veces.
//
//   node tools/convertir-estatua.mjs <fichero.stl> <nombre> [--caras 900] [--alto 2.2]

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { normalizarGlb } from "./normalizar-glb.mjs";

/** Lee un STL binario: cabecera de 80 bytes, número de triángulos, y 50 bytes
 *  por triángulo (normal, tres vértices y dos de relleno). */
export function leerStlBinario(bytes) {
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 84) throw new Error("El fichero es demasiado corto para ser un STL binario.");
  const total = vista.getUint32(80, true);
  const esperado = 84 + total * 50;
  if (bytes.byteLength !== esperado) {
    throw new Error(
      `No cuadra el tamaño: ${total} triángulos deberían ocupar ${esperado} bytes y ocupa ${bytes.byteLength}. ` +
        "¿Es un STL de texto, o está truncado?",
    );
  }
  const triangulos = [];
  for (let i = 0; i < total; i += 1) {
    const base = 84 + i * 50 + 12; // +12: se salta la normal, que se recalcula
    const punto = (k) => [
      vista.getFloat32(base + k * 12, true),
      vista.getFloat32(base + k * 12 + 4, true),
      vista.getFloat32(base + k * 12 + 8, true),
    ];
    triangulos.push([punto(0), punto(1), punto(2)]);
  }
  return triangulos;
}

/**
 * Lee un OBJ de texto (Wavefront): vértices `v`, caras `f`.
 *
 * Solo GEOMETRÍA, como el STL: se ignoran `vt` (textura) y `vn` (normales),
 * que es la frontera de arte de #351 —el color lo pone la escena—. NASA 3D
 * Resources y las demás fuentes públicas (Europeana, Art Institute of
 * Chicago, Wikidata) sueltan OBJ, y hasta ahora el pipeline solo leía STL,
 * así que esas mallas no llegaban nunca a la escena retro3d.
 *
 * Las caras pueden ser polígonos; se triangulan por abanico porque el
 * decimador QEM trabaja a partir de triángulos. Los índices de OBJ son
 * 1-based y pueden ser negativos (relativos al final del fichero).
 *
 * @param {string} texto
 * @returns {{vertices: number[][], caras: number[][]}}
 */
export function leerObj(texto) {
  const vertices = [];
  const caras = [];
  const lineas = texto.split(/\r?\n/);
  for (const linea of lineas) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith("#")) continue;
    const partes = limpia.split(/\s+/);
    const tag = partes[0];
    if (tag === "v") {
      // `x y z [w]`; el w se ignora (siempre 1 en OBJ geométrico).
      const x = Number(partes[1]);
      const y = Number(partes[2]);
      const z = Number(partes[3]);
      if (!(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z))) continue;
      vertices.push([x, y, z]);
    } else if (tag === "f") {
      // Cada vértice de cara: `v`, `v/vt`, `v/vt/vn` o `v//vn`. Basta el
      // índice de vértice, que siempre va primero.
      const idx = [];
      for (let k = 1; k < partes.length; k += 1) {
        const token = partes[k].split("/")[0];
        let n = Number(token);
        if (!Number.isFinite(n)) continue;
        // Negativo = relativo al final de la lista de vértices definida hasta aquí.
        n = n < 0 ? vertices.length + n : n - 1; // OBJ es 1-based.
        if (n >= 0 && n < vertices.length) idx.push(n);
      }
      // Triangular por abanico: un polígono de N vértices da N-2 triángulos.
      for (let i = 1; i + 1 < idx.length; i += 1) {
        const t = [idx[0], idx[i], idx[i + 1]];
        // Una cara degenerada (índices repetidos) no aporta superficie.
        if (t[0] !== t[1] && t[1] !== t[2] && t[0] !== t[2]) caras.push(t);
      }
    }
    // `vt`, `vn`, `vp`, `g`, `o`, `usemtl`, `mtllib`… se ignoran a propósito.
  }
  return { vertices, caras };
}

/**
 * Lee un GLB (glTF binario, versión 2): cabecera de 12 bytes, un chunk JSON y
 * un chunk BIN con la geometría.
 *
 * Solo GEOMETRÍA (frontera de arte #351): se leen los accesores POSITION y, si
 * los hay, los índices; normales y UV se ignoran. NASA 3D Resources suelta más
 * GLB que OBJ, así que este lector es el que de verdad abre el catálogo
 * `nasa3d.py` hacia la escena retro3d.
 *
 * Funciona con el buffer embebido en el chunk BIN (el caso normal de un GLB
 * descargado) y con buffers como data-URI; un buffer externo (.bin aparte) no
 * entra porque solo tenemos un fichero. Las caras indexadas y las no indexadas
 * (triangle soup) se tratan igual que en `leerObj`: triángulos, 0-based.
 *
 * @param {Uint8Array} bytes
 * @returns {{vertices: number[][], caras: number[][]}}
 */
export function leerGlb(bytes) {
  const cabeza = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 12) throw new Error("El GLB es demasiado corto.");
  if (cabeza.getUint32(0, true) !== 0x46546c67) throw new Error("No es un GLB (la cabecera no dice 'glTF').");
  const version = cabeza.getUint32(4, true);
  if (version !== 2) throw new Error(`GLB versión ${version} no soportada (solo 2).`);
  if (cabeza.getUint32(8, true) !== bytes.byteLength) throw new Error("La longitud del GLB no cuadra con el fichero.");

  let json = null;
  let bin = null;
  let offset = 12;
  while (offset + 8 <= bytes.byteLength) {
    const largo = cabeza.getUint32(offset, true);
    const tipo = cabeza.getUint32(offset + 4, true);
    const datos = bytes.subarray(offset + 8, offset + 8 + largo);
    if (tipo === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(datos));
    else if (tipo === 0x004e4942) bin = datos;
    offset += 8 + largo;
  }
  if (!json) throw new Error("El GLB no trae chunk JSON.");

  // Resuelve cada buffer a sus bytes: embebido en BIN, o data-URI base64.
  const buffers = (json.buffers || []).map((b) => {
    if (b.uri && b.uri.startsWith("data:")) {
      const coma = b.uri.indexOf(",");
      return Uint8Array.from(atob(b.uri.slice(coma + 1)), (c) => c.charCodeAt(0));
    }
    return bin;
  });
  const vistaDe = (buf) => new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const accesor = (i) => json.accessors[i];
  const vistaBuf = (i) => json.bufferViews[i];

  const vertices = [];
  const caras = [];
  for (const mesh of json.meshes || []) {
    for (const prim of mesh.primitives || []) {
      const posIdx = prim.attributes.POSITION;
      const posAcc = accesor(posIdx);
      if (!posAcc) continue; // Una primitiva sin POSITION no es geometría.
      // glTF 2.0 exige `bufferView` en el accessor. NASA 3D Resources exporta
      // varios modelos SIN él (Argo, Ares 1, CubeSat, Aeronomy…) y, peor aún,
      // sin la geometría en el fichero. Mejor un error claro que el TypeError
      // críptico de `buffers[posVista.buffer]` cuando `posVista` es undefined.
      if (posAcc.bufferView === undefined) {
        throw new Error(
          `GLB no conforme a glTF 2.0: el accessor ${posIdx} (POSITION) no tiene bufferView. ` +
            `NASA 3D Resources exporta algunos modelos así — la geometría no está en el ` +
            `fichero. Usa un modelo conforme a glTF 2.0 (p. ej. los que traen bufferView).`,
        );
      }
      const posVista = vistaBuf(posAcc.bufferView);
      const bufPos = buffers[posVista.buffer];
      if (!bufPos) {
        throw new Error(
          `GLB no conforme: el bufferView ${posAcc.bufferView} del accessor ${posIdx} ` +
            `referencia un buffer que no existe.`,
        );
      }
      const dvPos = vistaDe(bufPos);
      const base = vertices.length;
      const inicio = (posVista.byteOffset || 0) + (posAcc.byteOffset || 0);
      for (let k = 0; k < posAcc.count; k += 1) {
        const o = inicio + k * 12; // VEC3 float = 12 bytes.
        vertices.push([dvPos.getFloat32(o, true), dvPos.getFloat32(o + 4, true), dvPos.getFloat32(o + 8, true)]);
      }
      if (prim.indices !== undefined) {
        const idxAcc = accesor(prim.indices);
        if (idxAcc.bufferView === undefined) {
          throw new Error(
            `GLB no conforme a glTF 2.0: el accessor ${prim.indices} (índices) no tiene bufferView.`,
          );
        }
        const idxVista = vistaBuf(idxAcc.bufferView);
        const bufIdx = buffers[idxVista.buffer];
        if (!bufIdx) {
          throw new Error(
            `GLB no conforme: el bufferView ${idxAcc.bufferView} del accessor ${prim.indices} ` +
              `referencia un buffer que no existe.`,
          );
        }
        const dvIdx = vistaDe(bufIdx);
        const i0 = (idxVista.byteOffset || 0) + (idxAcc.byteOffset || 0);
        const ct = idxAcc.componentType;
        const paso = ct === 5125 ? 4 : ct === 5123 ? 2 : 1;
        const leer = (k) =>
          ct === 5125 ? dvIdx.getUint32(i0 + k * paso, true)
            : ct === 5123 ? dvIdx.getUint16(i0 + k * paso, true)
              : dvIdx.getUint8(i0 + k * paso);
        for (let k = 0; k + 2 < idxAcc.count; k += 3) {
          const a = leer(k), b = leer(k + 1), c = leer(k + 2);
          if (a !== b && b !== c && a !== c) caras.push([base + a, base + b, base + c]);
        }
      } else {
        // Sin índices: los vértices ya vienen en triángulos seguidos.
        for (let k = 0; k + 2 < posAcc.count; k += 3) {
          caras.push([base + k, base + k + 1, base + k + 2]);
        }
      }
    }
  }
  return { vertices, caras };
}

/** La caja que envuelve a todos los puntos. */
export function envolvente(triangulos) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const tri of triangulos) {
    for (const p of tri) {
      for (let e = 0; e < 3; e += 1) {
        if (p[e] < min[e]) min[e] = p[e];
        if (p[e] > max[e]) max[e] = p[e];
      }
    }
  }
  return { min, max };
}

/**
 * Suelda los vértices repetidos de una sopa de triángulos.
 *
 * Un STL no tiene vértices compartidos: cada triángulo trae los suyos, así que
 * un modelo de 29 000 caras trae 88 000 puntos de los que solo 15 000 son
 * distintos. Sin soldar, no hay aristas —cada triángulo está suelto— y sin
 * aristas no se puede colapsar nada.
 *
 * `epsilon` es a qué precisión se consideran el mismo punto. Fina de más, se
 * quedan grietas; gruesa de más, se pegan cosas que no se tocaban.
 */
export function soldar(triangulos, epsilon = 1e-4) {
  const vertices = [];
  const indiceDe = new Map();
  const caras = [];
  const clave = (p) => p.map((c) => Math.round(c / epsilon)).join(",");
  for (const tri of triangulos) {
    const idx = tri.map((p) => {
      const k = clave(p);
      let i = indiceDe.get(k);
      if (i === undefined) {
        i = vertices.length;
        vertices.push([...p]);
        indiceDe.set(k, i);
      }
      return i;
    });
    if (idx[0] !== idx[1] && idx[1] !== idx[2] && idx[0] !== idx[2]) caras.push(idx);
  }
  return { vertices, caras };
}

/** El plano de un triángulo como `[a, b, c, d]` normalizado, o `null` si el
 *  triángulo no tiene superficie. */
function planoDe(p0, p1, p2) {
  const u = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
  const v = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const largo = Math.hypot(...n);
  if (!(largo > 0)) return null;
  const [a, b, c] = n.map((k) => k / largo);
  return [a, b, c, -(a * p0[0] + b * p0[1] + c * p0[2])];
}

/** Acumula en `Q` el plano `p`: la matriz simétrica 4×4 cuyo producto con un
 *  punto da la suma de distancias al cuadrado a los planos acumulados. Es toda
 *  la idea de QEM, y cabe en dos bucles. */
function sumarPlano(Q, p) {
  for (let i = 0; i < 4; i += 1) for (let j = 0; j < 4; j += 1) Q[i * 4 + j] += p[i] * p[j];
}

/** Cuánto se apartaría de su sitio la superficie si el punto acabara en `v`. */
function errorEn(Q, v) {
  const x = [v[0], v[1], v[2], 1];
  let suma = 0;
  for (let i = 0; i < 4; i += 1) for (let j = 0; j < 4; j += 1) suma += Q[i * 4 + j] * x[i] * x[j];
  return suma;
}

/**
 * Resuelve dónde conviene poner el vértice que sustituye a una arista.
 *
 * El mínimo de la cuádrica se obtiene resolviendo el sistema 3×3 de su parte
 * lineal, y ES LA MITAD DE LA CALIDAD DE ESTE ALGORITMO: con el punto medio, un
 * colapso en mitad de una superficie curva hunde la malla hacia dentro y la
 * estatua adelgaza a cada pasada. Con el óptimo, el vértice se coloca donde
 * menos altera los planos que lo rodean, que muchas veces está FUERA del
 * segmento.
 *
 * La matriz es singular en superficies planas o rectas —hay infinitos puntos
 * igual de buenos—, y ahí se cae al punto medio, que es tan válido como
 * cualquiera.
 */
function mejorPunto(Q, a, b) {
  const m = [
    [Q[0], Q[1], Q[2]],
    [Q[4], Q[5], Q[6]],
    [Q[8], Q[9], Q[10]],
  ];
  const d = [-Q[3], -Q[7], -Q[11]];
  const det =
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  if (Math.abs(det) > 1e-10) {
    const col = (k, v) => m.map((fila, i) => fila.map((c, j) => (j === k ? v[i] : c)));
    const detDe = (n) =>
      n[0][0] * (n[1][1] * n[2][2] - n[1][2] * n[2][1]) -
      n[0][1] * (n[1][0] * n[2][2] - n[1][2] * n[2][0]) +
      n[0][2] * (n[1][0] * n[2][1] - n[1][1] * n[2][0]);
    return [detDe(col(0, d)) / det, detDe(col(1, d)) / det, detDe(col(2, d)) / det];
  }
  return [0, 1, 2].map((e) => (a[e] + b[e]) / 2);
}

/** Una cola de prioridad binaria. Sin ella hay que reordenar la lista entera
 *  cada vez que un colapso cambia el coste de sus vecinas, que es O(n log n)
 *  por colapso en vez de O(log n). */
class Cola {
  constructor() {
    this.datos = [];
  }
  get tamano() {
    return this.datos.length;
  }
  meter(x) {
    const d = this.datos;
    d.push(x);
    let i = d.length - 1;
    while (i > 0) {
      const padre = (i - 1) >> 1;
      if (d[padre].coste <= d[i].coste) break;
      [d[padre], d[i]] = [d[i], d[padre]];
      i = padre;
    }
  }
  sacar() {
    const d = this.datos;
    const cima = d[0];
    const ultimo = d.pop();
    if (d.length > 0) {
      d[0] = ultimo;
      let i = 0;
      for (;;) {
        const izq = i * 2 + 1;
        const der = izq + 1;
        let menor = i;
        if (izq < d.length && d[izq].coste < d[menor].coste) menor = izq;
        if (der < d.length && d[der].coste < d[menor].coste) menor = der;
        if (menor === i) break;
        [d[menor], d[i]] = [d[i], d[menor]];
        i = menor;
      }
    }
    return cima;
  }
}

/**
 * Decima por colapso de aristas hasta dejar `objetivo` caras.
 *
 * QUÉ TIENE ESTA VERSIÓN QUE NO TENÍA LA PRIMERA, porque las cuatro cosas se
 * ven en el resultado y ninguna es opcional:
 *
 *  1. COLA DE PRIORIDAD CON REEVALUACIÓN. Antes el orden se decidía una vez al
 *     principio: se colapsaba por costes calculados sobre una malla que ya no
 *     existía, y se agotaban los candidatos antes de llegar al objetivo —había
 *     que dar varias pasadas—. Ahora cada colapso reencola a sus vecinas con el
 *     coste nuevo, y una sola pasada llega a donde se le pida.
 *  2. PUNTO ÓPTIMO en vez de punto medio. Con el medio, cada colapso en una
 *     superficie curva la hunde hacia dentro y la pieza ADELGAZA a cada pasada.
 *  3. BORDES PROTEGIDOS. Este modelo es un relieve: tiene bordes abiertos, y una
 *     arista de borde no tiene caras a los dos lados que la sujeten, así que sale
 *     baratísima de colapsar y el contorno se come solo. Se les añade un plano
 *     perpendicular que las encarece, que es el truco clásico y funciona.
 *  4. SIN VOLTEAR CARAS. Un colapso puede dejar un triángulo del revés; el motor
 *     descarta las caras de espaldas, así que un triángulo volteado es un agujero
 *     en la estatua. Antes de aceptar un colapso se comprueba que ninguna cara
 *     afectada invierta su normal. Es de donde salían las esquirlas sueltas.
 */
export function simplificar({ vertices, caras }, objetivo) {
  const V = vertices.map((v) => [...v]);
  const Q = V.map(() => new Float64Array(16));
  const vivas = caras.map((c) => [...c]);
  const normales = new Map();

  for (const [i, cara] of vivas.entries()) {
    const plano = planoDe(V[cara[0]], V[cara[1]], V[cara[2]]);
    if (!plano) continue;
    normales.set(i, plano.slice(0, 3));
    for (const v of cara) sumarPlano(Q[v], plano);
  }

  const carasDe = V.map(() => new Set());
  vivas.forEach((cara, i) => cara.forEach((v) => carasDe[v].add(i)));

  // Cuántas caras comparte cada arista. Una sola = borde abierto.
  const claveArista = (a, b) => (a < b ? `${a},${b}` : `${b},${a}`);
  const cuantasCaras = new Map();
  for (const cara of vivas) {
    for (let k = 0; k < 3; k += 1) {
      const c = claveArista(cara[k], cara[(k + 1) % 3]);
      cuantasCaras.set(c, (cuantasCaras.get(c) ?? 0) + 1);
    }
  }
  // El plano que encarece los bordes: perpendicular a la cara y conteniendo la
  // arista, con peso alto. Colapsar el borde exigiría apartarse de ÉL también.
  for (const [i, cara] of vivas.entries()) {
    const n = normales.get(i);
    if (!n) continue;
    for (let k = 0; k < 3; k += 1) {
      const [a, b] = [cara[k], cara[(k + 1) % 3]];
      if (cuantasCaras.get(claveArista(a, b)) !== 1) continue;
      const e = [0, 1, 2].map((j) => V[b][j] - V[a][j]);
      const largo = Math.hypot(...e) || 1;
      const u = e.map((c) => c / largo);
      const perp = [
        u[1] * n[2] - u[2] * n[1],
        u[2] * n[0] - u[0] * n[2],
        u[0] * n[1] - u[1] * n[0],
      ];
      const l2 = Math.hypot(...perp) || 1;
      const p = perp.map((c) => (c / l2) * PESO_BORDE);
      const plano = [...p, -(p[0] * V[a][0] + p[1] * V[a][1] + p[2] * V[a][2])];
      sumarPlano(Q[a], plano);
      sumarPlano(Q[b], plano);
    }
  }

  const vivo = V.map(() => true);
  const borrada = vivas.map(() => false);
  let cuantas = vivas.length;
  const version = V.map(() => 0);

  const costeDe = (a, b) => {
    const suma = new Float64Array(16);
    for (let i = 0; i < 16; i += 1) suma[i] = Q[a][i] + Q[b][i];
    const punto = mejorPunto(suma, V[a], V[b]);
    return { punto, coste: Math.max(0, errorEn(suma, punto)) };
  };

  const cola = new Cola();
  const aristas = new Set();
  for (const cara of vivas) {
    for (let k = 0; k < 3; k += 1) aristas.add(claveArista(cara[k], cara[(k + 1) % 3]));
  }
  for (const clave of aristas) {
    const [a, b] = clave.split(",").map(Number);
    cola.meter({ a, b, ...costeDe(a, b), va: version[a], vb: version[b] });
  }

  /** ¿Voltearía alguna cara de `v` si el vértice se moviera a `punto`? */
  const voltearia = (v, otro, punto) => {
    for (const ci of carasDe[v]) {
      if (borrada[ci]) continue;
      const cara = vivas[ci];
      if (cara.includes(otro)) continue; // esta cara desaparece en el colapso
      const antes = normales.get(ci);
      if (!antes) continue;
      const puntos = cara.map((k) => (k === v ? punto : V[k]));
      const ahora = planoDe(...puntos);
      if (!ahora) return true; // se quedaría sin superficie
      const coseno = ahora[0] * antes[0] + ahora[1] * antes[1] + ahora[2] * antes[2];
      if (coseno < COSENO_MINIMO) return true;
    }
    return false;
  };

  while (cuantas > objetivo && cola.tamano > 0) {
    const cand = cola.sacar();
    const { a, b, punto } = cand;
    if (!vivo[a] || !vivo[b]) continue;
    // Perezosa: si alguno de los dos cambió desde que se encoló, el coste que
    // trae es viejo. Se recalcula y se vuelve a encolar en su sitio.
    if (cand.va !== version[a] || cand.vb !== version[b]) {
      cola.meter({ a, b, ...costeDe(a, b), va: version[a], vb: version[b] });
      continue;
    }
    if (voltearia(a, b, punto) || voltearia(b, a, punto)) continue;

    V[a] = punto;
    for (let i = 0; i < 16; i += 1) Q[a][i] += Q[b][i];
    vivo[b] = false;
    version[a] += 1;

    for (const ci of carasDe[b]) {
      if (borrada[ci]) continue;
      const nueva = vivas[ci].map((v) => (v === b ? a : v));
      if (nueva[0] === nueva[1] || nueva[1] === nueva[2] || nueva[0] === nueva[2]) {
        borrada[ci] = true;
        cuantas -= 1;
        continue;
      }
      vivas[ci] = nueva;
      carasDe[a].add(ci);
    }
    // Las normales de las caras que quedan han cambiado: si no se actualizan, la
    // comprobación de volteo compara contra una malla que ya no existe.
    const vecinas = new Set();
    for (const ci of carasDe[a]) {
      if (borrada[ci]) continue;
      const cara = vivas[ci];
      const plano = planoDe(V[cara[0]], V[cara[1]], V[cara[2]]);
      if (plano) normales.set(ci, plano.slice(0, 3));
      for (const v of cara) if (v !== a && vivo[v]) vecinas.add(v);
    }
    for (const v of vecinas) {
      version[v] += 1;
      cola.meter({ a, b: v, ...costeDe(a, v), va: version[a], vb: version[v] });
    }
  }

  const mapa = new Map();
  const salida = [];
  V.forEach((v, i) => {
    if (!vivo[i]) return;
    mapa.set(i, salida.length);
    salida.push(v);
  });
  const finales = [];
  const vistas = new Set();
  vivas.forEach((c, i) => {
    if (borrada[i]) return;
    const m = c.map((v) => mapa.get(v));
    if (m.some((x) => x === undefined)) return;
    if (m[0] === m[1] || m[1] === m[2] || m[0] === m[2]) return;
    const clave = [...m].sort((x, y) => x - y).join(",");
    if (vistas.has(clave)) return;
    vistas.add(clave);
    finales.push(m);
  });
  return { vertices: salida, caras: finales };
}

/** Cuánto se encarece colapsar un borde abierto. Alto a propósito: el contorno
 *  de un relieve es su silueta, y la silueta es lo que lo hace reconocible. */
const PESO_BORDE = 12;

/** Cuánto puede girar la normal de una cara en un colapso antes de considerarlo
 *  un volteo. 0,2 permite que la superficie se reoriente al simplificar y frena
 *  en seco lo que se daría la vuelta. */
const COSENO_MINIMO = 0.2;

/**
 * Deja la malla en coordenadas del módulo: de pie, centrada en planta, apoyada
 * en el suelo y de la altura que se pida.
 *
 * Se apoya en `y = 0` y se centra en X y Z porque es lo que `colocarProp` da por
 * hecho de todo lo que se planta: colocar algo es decir dónde toca el suelo.
 */
export function normalizar({ vertices, caras }, { alto = 2.2, ejeArriba = "z" } = {}) {
  // Muchos modelos de impresión 3D vienen con Z arriba, que es la convención de
  // CAD; el módulo usa Y. Se gira una vez aquí y no en cada consumidor.
  const puestos =
    ejeArriba === "z" ? vertices.map(([x, y, z]) => [x, z, -y]) : vertices.map((v) => [...v]);

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const p of puestos) {
    for (let e = 0; e < 3; e += 1) {
      if (p[e] < min[e]) min[e] = p[e];
      if (p[e] > max[e]) max[e] = p[e];
    }
  }
  const escala = alto / (max[1] - min[1]);
  const cx = (min[0] + max[0]) / 2;
  const cz = (min[2] + max[2]) / 2;
  const redondo = (n) => Math.round(n * 1000) / 1000;
  return {
    vertices: puestos.map(([x, y, z]) => [
      redondo((x - cx) * escala),
      redondo((y - min[1]) * escala),
      redondo((z - cz) * escala),
    ]),
    caras,
  };
}

/**
 * Lista CERRADA para el nombre de la pieza: minúsculas, dígitos y guiones.
 *
 * De ese nombre salen DOS cosas peligrosas —la ruta del fichero que se escribe y
 * el identificador exportado del módulo generado—, así que se valida una vez y
 * en un sitio. Sin esto, `../../../PR837_ESCAPE` escribía fuera de
 * `foundry-module/data/mallas`, y cualquier cosa rara acababa en un `export
 * const` que no compila. Se valida el NOMBRE, no la ruta resultante: comprobar
 * la ruta después es una segunda red, no la primera.
 */
export const NOMBRE_VALIDO = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validarNombre(nombre) {
  if (typeof nombre !== "string" || nombre.length > 64 || !NOMBRE_VALIDO.test(nombre)) {
    throw new Error(
      `nombre de pieza no válido: ${JSON.stringify(nombre)} — ` +
        "solo minúsculas, dígitos y guiones (p. ej. `leon-al-lat`)",
    );
  }
  return nombre;
}

/**
 * Los metadatos entran en un COMENTARIO de línea del módulo generado. Un salto
 * de línea en `--obra` cierra el comentario y deja el resto como código en un
 * fichero que después se importa: es inyección de JavaScript por la puerta de
 * la procedencia. Se RECHAZA en vez de recortar — un dato de procedencia con un
 * salto de línea dentro está mal en origen, y truncarlo en silencio dejaría una
 * cartela mutilada afirmando ser la buena.
 */
function textoDeComentario(campo, valor) {
  if (valor === null || valor === undefined) return String(valor);
  const txt = String(valor);
  if (/[\r\n\u2028\u2029]/.test(txt)) {
    throw new Error(`la procedencia "${campo}" no puede contener saltos de línea`);
  }
  return txt;
}

/** El módulo que se escribe en el árbol: texto, revisable en un PR y sin binario. */
export function moduloDeMalla(nombre, malla, ficha) {
  validarNombre(nombre);
  const { vertices, caras } = malla;
  const meta = Object.fromEntries(
    ["obra", "modelo", "autoria", "fuente", "licencia", "sha256"].map(
      (k) => [k, textoDeComentario(k, ficha[k])],
    ),
  );
  return `// ${meta.obra} — malla importada (#590).
//
// GENERADO, NO ESCRITO A MANO. Sale de \`tools/convertir-estatua.mjs\` a partir
// del fichero de origen que documenta \`docs/PROCEDENCIA_ASSETS.md\`. Si se edita
// aquí, la próxima conversión lo pisa.
//
//   obra       ${meta.obra}
//   modelo     ${meta.modelo}
//   autoría    ${meta.autoria}
//   fuente     ${meta.fuente}
//   licencia   ${meta.licencia}
//   sha256     ${meta.sha256}
//
// Solo GEOMETRÍA: el color lo pone la escena con la paleta del módulo, que es la
// frontera de arte de #351. La malla no trae ni textura ni material propios.

export const ${nombre.toUpperCase().replace(/-/g, "_")} = Object.freeze({
  vertices: ${JSON.stringify(vertices)},
  caras: ${JSON.stringify(caras)},
});
`;
}

/**
 * La procedencia de cada pieza, EN EL CÓDIGO y no solo en la prosa.
 *
 * Está aquí para que convertir sin ficha sea imposible, no solo desaconsejado:
 * la herramienta se niega. `docs/PROCEDENCIA_ASSETS.md` es la versión legible
 * para humanos, con el porqué de cada decisión; esto es lo que se estampa dentro
 * del módulo generado, para que la malla lleve su licencia pegada aunque alguien
 * la copie a otro sitio.
 */
export const FICHAS = Object.freeze({
  "leon-al-lat": {
    obra: "León de Al-Lāt (Asad Al-Lāt), Palmira",
    modelo: "reconstrucción digital, no escaneo",
    autoria: "Georges Dahdouh, optimización de Jim Ellis — #NEWPALMYRA / RSSSD",
    fuente: "Wikimedia Commons, File:Asad Al-Lat.stl",
    licencia: "CC0 1.0 (revisión de licencia de Commons, 2018-02-22)",
  },
  "venus-de-milo": {
    obra: "Afrodita de Melos (Venus de Milo) — vaciado en yeso, KAS434",
    modelo: "escaneo del VACIADO de la Colección Real de Vaciados, no del original",
    autoria: "Statens Museum for Kunst (Copenhague)",
    fuente: "Wikimedia Commons, colección SMK",
    licencia: "CC0 1.0 sobre el escaneo; la obra, dominio público (Licensed-PD-Art)",
  },
  "farao-amasis": {
    obra: "Retrato del faraón Amasis II (563–525 a. C.) — vaciado en yeso, KAS576",
    modelo: "escaneo del VACIADO de la Colección Real de Vaciados, no del original",
    autoria: "Statens Museum for Kunst (Copenhague)",
    fuente: "Wikimedia Commons, colección SMK",
    licencia: "CC0 1.0 sobre el escaneo; la obra, dominio público (Licensed-PD-Art)",
  },
  "loba-capitolina": {
    obra: "Loba (Ulvinde) — vaciado en yeso, KAS837",
    modelo: "escaneo del VACIADO de la Colección Real de Vaciados, no del original",
    autoria: "Statens Museum for Kunst (Copenhague)",
    fuente: "Wikimedia Commons, colección SMK",
    licencia: "CC0 1.0 sobre el escaneo; la obra, dominio público (Licensed-PD-Art)",
  },
  "poseidon-artemision": {
    obra: "Poseidón (o Zeus) de Artemisión — vaciado en yeso, KAS2100",
    modelo: "escaneo del VACIADO de la Colección Real de Vaciados, no del original",
    autoria: "Statens Museum for Kunst (Copenhague)",
    fuente: "Wikimedia Commons, colección SMK",
    licencia: "CC0 1.0 sobre el escaneo; la obra, dominio público (Licensed-PD-Art)",
  },
  "doriforo": {
    obra: "Doríforo (el portador de lanza), de Policleto — vaciado en yeso, KAS1242",
    modelo: "escaneo del VACIADO de la Colección Real de Vaciados, no del original",
    autoria: "Statens Museum for Kunst (Copenhague)",
    fuente: "Wikimedia Commons, colección SMK",
    licencia: "CC0 1.0 sobre el escaneo; la obra, dominio público (Licensed-PD-Art)",
  },
  "kore-chiton": {
    obra: "Koré con quitón y epíblema — vaciado en yeso, KAS1800",
    modelo: "escaneo del VACIADO de la Colección Real de Vaciados, no del original",
    autoria: "Statens Museum for Kunst (Copenhague)",
    fuente: "Wikimedia Commons, colección SMK",
    licencia: "CC0 1.0 sobre el escaneo; la obra, dominio público (Licensed-PD-Art)",
  },
  "herakles-farnese": {
    obra: "Heracles Farnesio — vaciado en yeso, KAS701",
    modelo: "escaneo del VACIADO de la Colección Real de Vaciados, no del original",
    autoria: "Statens Museum for Kunst (Copenhague)",
    fuente: "Wikimedia Commons, colección SMK",
    licencia: "CC0 1.0 sobre el escaneo; la obra, dominio público (Licensed-PD-Art)",
  },
  "laocoonte": {
    obra: "Laocoonte y sus hijos — vaciado en yeso, KAS385",
    modelo: "escaneo del VACIADO de la Colección Real de Vaciados, no del original",
    autoria: "Statens Museum for Kunst (Copenhague)",
    fuente: "Wikimedia Commons, colección SMK",
    licencia: "CC0 1.0 sobre el escaneo; la obra, dominio público (Licensed-PD-Art)",
  },
  "penelope": {
    obra: "Penélope sentada — vaciado en yeso, KAS202",
    modelo: "escaneo del VACIADO de la Colección Real de Vaciados, no del original",
    autoria: "Statens Museum for Kunst (Copenhague)",
    fuente: "Wikimedia Commons, colección SMK",
    licencia: "CC0 1.0 sobre el escaneo; la obra, dominio público (Licensed-PD-Art)",
  },
  "venus-capitolina": {
    obra: "Venus Capitolina — vaciado en yeso, KAS493",
    modelo: "escaneo del VACIADO de la Colección Real de Vaciados, no del original",
    autoria: "Statens Museum for Kunst (Copenhague)",
    fuente: "Wikimedia Commons, colección SMK",
    licencia: "CC0 1.0 sobre el escaneo; la obra, dominio público (Licensed-PD-Art)",
  },
  "marco-aurelio": {
    obra: "Retrato de Marco Aurelio, emperador (161–180 d. C.) — vaciado en yeso, KAS979",
    modelo: "escaneo del VACIADO de la Colección Real de Vaciados, no del original",
    autoria: "Statens Museum for Kunst (Copenhague)",
    fuente: "Wikimedia Commons, colección SMK",
    licencia: "CC0 1.0 sobre el escaneo; la obra, dominio público (Licensed-PD-Art)",
  },
  "julio-cesar": {
    obra: "Julio César — vaciado en yeso, KAS297",
    modelo: "escaneo del VACIADO de la Colección Real de Vaciados, no del original",
    autoria: "Statens Museum for Kunst (Copenhague)",
    fuente: "Wikimedia Commons, colección SMK",
    licencia: "CC0 1.0 sobre el escaneo; la obra, dominio público (Licensed-PD-Art)",
  },
  "prinsesse-amarna": {
    obra: "Princesa de Amarna — vaciado en yeso, KAS2226",
    modelo: "escaneo del VACIADO de la Colección Real de Vaciados, no del original",
    autoria: "Statens Museum for Kunst (Copenhague)",
    fuente: "Wikimedia Commons, colección SMK",
    licencia: "CC0 1.0 sobre el escaneo; la obra, dominio público (Licensed-PD-Art)",
  },
  "jabali": {
    obra: "Jabalí sentado (el Porcellino) — vaciado en yeso, KAS2157",
    modelo: "escaneo del VACIADO de la Colección Real de Vaciados, no del original",
    autoria: "Statens Museum for Kunst (Copenhague)",
    fuente: "Wikimedia Commons, colección SMK",
    licencia: "CC0 1.0 sobre el escaneo; la obra, dominio público (Licensed-PD-Art)",
  },
  "caballo-marco-aurelio": {
    obra: "Caballo de la estatua ecuestre de Marco Aurelio — vaciado en yeso, KAS1133/2",
    modelo: "escaneo del VACIADO de la Colección Real de Vaciados, no del original",
    autoria: "Statens Museum for Kunst (Copenhague)",
    fuente: "Wikimedia Commons, colección SMK",
    licencia: "CC0 1.0 sobre el escaneo; la obra, dominio público (Licensed-PD-Art)",
  },
  "david-cabeza": {
    obra: "Cabeza del David, de Miguel Ángel — vaciado en yeso, KAS2232",
    modelo: "escaneo del VACIADO de la Colección Real de Vaciados, no del original",
    autoria: "Statens Museum for Kunst (Copenhague)",
    fuente: "Wikimedia Commons, colección SMK",
    licencia: "CC0 1.0 sobre el escaneo; la obra, dominio público (Licensed-PD-Art)",
  },
  "homero": {
    obra: "Retrato de Homero — vaciado en yeso, KAS210",
    modelo: "escaneo del VACIADO de la Colección Real de Vaciados, no del original",
    autoria: "Statens Museum for Kunst (Copenhague)",
    fuente: "Wikimedia Commons, colección SMK",
    licencia: "CC0 1.0 sobre el escaneo; la obra, dominio público (Licensed-PD-Art)",
  },
});

// ---- ejecución -------------------------------------------------------------

/**
 * Todo lo de arriba se exporta y NO se ejecuta al importar.
 *
 * Es lo que permite que `convertir-estatua.test.mjs` pruebe el decimador sin
 * lanzar la conversión —y sin necesitar el STL de origen, que no vive en el
 * repositorio—. Sin esta guarda, importar la herramienta desde una prueba la
 * ejecutaba y salía por `process.exit(2)` al no encontrar argumentos.
 */
async function principal() {

  const [ruta, nombre, ...resto] = process.argv.slice(2);
  if (!ruta || !nombre) {
    console.error(
      "uso: node tools/convertir-estatua.mjs <fichero.stl|.obj> <nombre> " +
        "[--caras N] [--alto M] [--fuente T] [--licencia L] [--obra O] " +
        "[--autoria A] [--modelo M] [--force]",
    );
    process.exit(2);
  }
  // Antes de leer nada: el nombre decide dónde se escribe.
  try {
    validarNombre(nombre);
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  const textoOp = (bandera, porDefecto) => {
    const i = resto.indexOf(bandera);
    return i === -1 ? porDefecto : resto[i + 1];
  };
  const numeroOp = (bandera, porDefecto) => {
    const v = textoOp(bandera, null);
    const n = Number(v);
    return v === null || !Number.isFinite(n) ? porDefecto : n;
  };

  const ext = path.extname(ruta).toLowerCase();
  const bytes = new Uint8Array(await readFile(ruta));
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  // OBJ ya viene indexado (no hace falta soldar); STL trae una sopa de
  // triángulos sueltos que hay que soldar primero. Ambos acaban en el mismo
  // {vertices, caras} que consumen el decimador y la escena retro3d.
  let entrada;
  let triangulosEntrada;
  if (ext === ".obj") {
    // `bytes` es Uint8Array, y su `toString` NO decodifica UTF-8; hay que
    // pasar por TextDecoder para obtener el texto del OBJ.
    entrada = leerObj(new TextDecoder("utf8").decode(bytes));
    triangulosEntrada = entrada.caras.length;
  } else if (ext === ".glb") {
    // NASA 3D Resources publica muchos GLB comprimidos con Draco
    // (KHR_draco_mesh_compression): la geometría no está como floats en el
    // buffer, hay que decodificarla antes de que leerGlb la vea. normalizarGlb
    // decodifica Draco y reempaqueta a un GLB canónico (o deja pasar los ya
    // planos, sin tocarlos).
    const { bytes: normalizados, draco } = await normalizarGlb(bytes);
    entrada = leerGlb(normalizados);
    triangulosEntrada = entrada.caras.length;
    if (draco) {
      console.warn("AVISO: el GLB venía comprimido con Draco; se decodificó al vuelo.");
    }
  } else {
    const triangulos = leerStlBinario(bytes);
    triangulosEntrada = triangulos.length;
    entrada = soldar(triangulos);
  }

  const decimada = simplificar(entrada, numeroOp("--caras", 900));
  const malla = normalizar(decimada, { alto: numeroOp("--alto", 2.2) });

  const destino = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "foundry-module", "data", "mallas");
  await mkdir(destino, { recursive: true });

  // Procedencia: o bien una ficha fija del catálogo SMK, o bien una malla
  // externa (NASA 3D Resources, Europeana…) con la procedencia pasada por
  // CLI. Sin origen comprobable no se convierte, por buena que sea la malla.
  let ficha = FICHAS[nombre];
  if (!ficha) {
    const fuente = textoOp("--fuente", "");
    if (!fuente) {
      console.error(
        `No hay ficha para "${nombre}" y falta --fuente. ` +
          "Añádela a FICHAS, o pasa --fuente/--licencia/--obra/--autoria/--modelo " +
          "para mallas externas (NASA 3D Resources, etc.).",
      );
      process.exit(2);
    }
    const licencia = textoOp("--licencia", null);
    ficha = {
      obra: textoOp("--obra", nombre),
      modelo: textoOp("--modelo", "desconocido — pasa --modelo para dejarlo escrito"),
      autoria: textoOp("--autoria", "desconocida — pasa --autoria para dejarlo escrito"),
      fuente,
      // null = no declarada: no se afirma dominio público (ver nasa3d.py).
      licencia: licencia === null ? null : licencia,
    };
    if (licencia === null) {
      console.warn(
        "AVISO: licencia no declarada (null). No se afirma dominio público; " +
          "verifica las condiciones de uso del origen antes de publicar la malla.",
      );
    }
  }
  ficha = { ...ficha, sha256 };
  const salida = path.resolve(destino, `${nombre}.mjs`);
  // Segunda red, después de `validarNombre`: la ruta resuelta tiene que caer
  // DENTRO del directorio de mallas. Si algún día el nombre se ensancha, esto
  // sigue sujetando la garantía de «escribe dentro de su alcance».
  if (path.dirname(salida) !== path.resolve(destino)) {
    console.error(`el destino ${salida} cae fuera de ${destino}`);
    process.exit(2);
  }
  // Exclusivo salvo `--force`: pisar una malla ya convertida es una decisión,
  // no un efecto secundario de repetir un comando.
  try {
    await writeFile(salida, moduloDeMalla(nombre, malla, ficha), {
      encoding: "utf8",
      flag: resto.includes("--force") ? "w" : "wx",
    });
  } catch (e) {
    if (e && e.code === "EEXIST") {
      console.error(`${salida} ya existe; pasa --force para sobrescribirlo.`);
      process.exit(2);
    }
    throw e;
  }

  console.log(
    `${triangulosEntrada} triángulos de entrada -> ${malla.caras.length} caras ` +
      `y ${malla.vertices.length} vértices ` +
      `(${(100 - (malla.caras.length / Math.max(1, triangulosEntrada)) * 100).toFixed(1)} % menos)`,
  );
  console.log("sha256 del origen:", sha256);

}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await principal();
}
