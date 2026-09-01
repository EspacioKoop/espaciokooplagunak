// Decodificador PNG general, SOLO para `convertir-token.mjs` (#891).
//
// POR QUÉ NO ES `png-indexado.mjs`. Ese módulo decodifica exactamente lo que él
// mismo escribe —color indexado de 8 bits, sin comprimir de verdad— a propósito,
// para no abrir una puerta de decodificación general de PNGs de terceros (la
// advertencia está en su propia cabecera, y es la puerta de #571). Esta
// herramienta SÍ necesita leer PNGs de terceros de verdad: los packs pixelart
// que se descargan de itch.io u otras fuentes vienen comprimidos con DEFLATE de
// verdad y a menudo en truecolor+alfa, no en el subconjunto que emite el
// codificador propio.
//
// POR QUÉ AQUÍ SÍ VALE `node:zlib`. `png-indexado.mjs` evita `zlib` porque debe
// correr igual en el navegador que en Node (issue #354); esta herramienta es un
// script de conversión de línea de comandos que solo corre en Node, así que no
// hay esa restricción — usar el `zlib` de la plataforma es lo simple y correcto.
//
// SOLO 8 BITS POR CANAL, y grises/paleta/truecolor con o sin alfa: es lo que
// cubre un pack pixelart normal. Cualquier otra profundidad o el entrelazado
// Adam7 se rechazan en vez de intentar adivinar.

import { inflateSync } from "node:zlib";

const FIRMA = Object.freeze([137, 80, 78, 71, 13, 10, 26, 10]);

function leerChunks(bytes) {
  for (const [i, byte] of FIRMA.entries()) {
    if (bytes[i] !== byte) throw new Error("No es un PNG: la firma no coincide.");
  }
  const u32 = (pos) => ((bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3]) >>> 0;
  const idat = [];
  const otros = new Map();
  let pos = FIRMA.length;
  while (pos + 8 <= bytes.length) {
    const largo = u32(pos);
    const tipo = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8));
    const datos = bytes.subarray(pos + 8, pos + 8 + largo);
    if (tipo === "IDAT") idat.push(datos);
    else otros.set(tipo, datos);
    pos += 12 + largo;
    if (tipo === "IEND") break;
  }
  return { idat, otros };
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/** Deshace el filtrado por scanline (tipos 0-4 de la especificación PNG). */
function desfiltrar(datos, ancho, alto, bytesPorPixel) {
  const stride = ancho * bytesPorPixel;
  const salida = new Uint8Array(alto * stride);
  let pos = 0;
  for (let y = 0; y < alto; y += 1) {
    const filtro = datos[pos];
    pos += 1;
    const filaActual = salida.subarray(y * stride, (y + 1) * stride);
    const filaAnterior = y > 0 ? salida.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x += 1) {
      const cruda = datos[pos + x];
      const a = x >= bytesPorPixel ? filaActual[x - bytesPorPixel] : 0;
      const b = filaAnterior ? filaAnterior[x] : 0;
      const c = filaAnterior && x >= bytesPorPixel ? filaAnterior[x - bytesPorPixel] : 0;
      let valor;
      switch (filtro) {
        case 0: valor = cruda; break;
        case 1: valor = cruda + a; break;
        case 2: valor = cruda + b; break;
        case 3: valor = cruda + Math.floor((a + b) / 2); break;
        case 4: valor = cruda + paeth(a, b, c); break;
        default: throw new Error(`Filtro de PNG no soportado: ${filtro}`);
      }
      filaActual[x] = valor & 255;
    }
    pos += stride;
  }
  return salida;
}

/**
 * Decodifica un PNG de terceros a `{ancho, alto, rgba: Uint8ClampedArray}`.
 *
 * Soporta color tipo 0 (gris), 2 (truecolor), 3 (indexado, con `PLTE`/`tRNS`
 * opcional) y 6 (truecolor+alfa), todos a 8 bits por canal y sin entrelazar.
 * El nombre recuerda que no importa si el ORIGEN es indexado o truecolor: la
 * salida siempre es RGBA para que el resto del pipeline no distinga los casos.
 */
export function decodificarPngIndexadoOTrueColor(bytes) {
  const { idat, otros } = leerChunks(bytes);
  const ihdr = otros.get("IHDR");
  if (!ihdr) throw new Error("Al PNG le falta IHDR.");
  const u32De = (buf, i) => ((buf[i] << 24) | (buf[i + 1] << 16) | (buf[i + 2] << 8) | buf[i + 3]) >>> 0;
  const ancho = u32De(ihdr, 0);
  const alto = u32De(ihdr, 4);
  const [profundidad, tipoColor, compresion, filtro, entrelazado] = ihdr.subarray(8, 13);
  if (profundidad !== 8) throw new Error(`Solo se leen PNG de 8 bits por canal, y este es de ${profundidad}.`);
  if (compresion !== 0 || filtro !== 0) throw new Error("Cabecera de PNG con opciones no soportadas.");
  if (entrelazado !== 0) throw new Error("El entrelazado Adam7 no está soportado.");

  const CANALES_POR_TIPO = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const canales = CANALES_POR_TIPO[tipoColor];
  if (!canales) throw new Error(`Tipo de color de PNG no soportado: ${tipoColor}`);

  const comprimido = Uint8Array.from(idat.flatMap((trozo) => Array.from(trozo)));
  const crudo = inflateSync(comprimido);
  const plano = desfiltrar(crudo, ancho, alto, canales);

  const rgba = new Uint8ClampedArray(ancho * alto * 4);
  if (tipoColor === 3) {
    const plte = otros.get("PLTE");
    if (!plte) throw new Error("PNG indexado sin PLTE.");
    const trns = otros.get("tRNS");
    for (let i = 0; i < ancho * alto; i += 1) {
      const indice = plano[i];
      rgba[i * 4] = plte[indice * 3];
      rgba[i * 4 + 1] = plte[indice * 3 + 1];
      rgba[i * 4 + 2] = plte[indice * 3 + 2];
      rgba[i * 4 + 3] = trns && indice < trns.length ? trns[indice] : 255;
    }
  } else if (tipoColor === 0 || tipoColor === 4) {
    const conAlfa = tipoColor === 4;
    for (let i = 0; i < ancho * alto; i += 1) {
      const base = i * canales;
      const gris = plano[base];
      rgba[i * 4] = gris;
      rgba[i * 4 + 1] = gris;
      rgba[i * 4 + 2] = gris;
      rgba[i * 4 + 3] = conAlfa ? plano[base + 1] : 255;
    }
  } else {
    const conAlfa = tipoColor === 6;
    for (let i = 0; i < ancho * alto; i += 1) {
      const base = i * canales;
      rgba[i * 4] = plano[base];
      rgba[i * 4 + 1] = plano[base + 1];
      rgba[i * 4 + 2] = plano[base + 2];
      rgba[i * 4 + 3] = conAlfa ? plano[base + 3] : 255;
    }
  }

  return { ancho, alto, rgba };
}
