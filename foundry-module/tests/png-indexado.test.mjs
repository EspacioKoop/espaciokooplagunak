import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_PALETA,
  crc32,
  adler32,
  zlibSinComprimir,
  base64,
  hexARgb,
  codificarPngIndexado,
  decodificarPngIndexado,
  pngADataUri,
} from "../scripts/png-indexado.mjs";

test("MAX_PALETA es 256", () => {
  assert.strictEqual(MAX_PALETA, 256);
});

test("hexARgb convierte correctamente", () => {
  assert.deepStrictEqual(hexARgb("#ff00aa"), [255, 0, 170]);
  assert.deepStrictEqual(hexARgb("00FF00"), [0, 255, 0]);
  assert.throws(() => hexARgb("#fff"), Error);
  assert.throws(() => hexARgb("#ff00zz"), Error);
});

test("codificarPngIndexado y decodificarPngIndexado ida y vuelta", () => {
  const ancho = 4;
  const alto = 3;
  const paleta = ["#ff0000", "#00ff00", "#0000ff"]; // rojo, verde, azul
  const indices = new Uint8Array([
    1, 2, 0, 1,
    0, 1, 2, 0,
    2, 0, 1, 2,
  ]);
  const png = codificarPngIndexado({ ancho, alto, indices, paleta });
  const decoded = decodificarPngIndexado(png);
  assert.strictEqual(decoded.ancho, ancho);
  assert.strictEqual(decoded.alto, alto);
  assert.deepStrictEqual(decoded.indices, indices);
  assert.deepStrictEqual(decoded.paleta, paleta);
});

test("paleta de 1 color", () => {
  const ancho = 2;
  const alto = 2;
  const paleta = ["#ffffff"];
  const indices = new Uint8Array([1, 1, 1, 1]);
  const png = codificarPngIndexado({ ancho, alto, indices, paleta });
  const decoded = decodificarPngIndexado(png);
  assert.strictEqual(decoded.ancho, ancho);
  assert.strictEqual(decoded.alto, alto);
  assert.deepStrictEqual(decoded.indices, indices);
  assert.deepStrictEqual(decoded.paleta, paleta);
});

test("paleta de MAX_PALETA-1 colores (255)", () => {
  const ancho = 1;
  const alto = 1;
  // generate 255 distinct hex colors
  const paleta = [];
  for (let i = 0; i < 255; i++) {
    const val = i.toString(16).padStart(6, "0");
    paleta.push(`#${val}`);
  }
  const indices = new Uint8Array([1]); // use index 1 (second color)
  const png = codificarPngIndexado({ ancho, alto, indices, paleta });
  const decoded = decodificarPngIndexado(png);
  assert.strictEqual(decoded.ancho, ancho);
  assert.strictEqual(decoded.alto, alto);
  assert.deepStrictEqual(decoded.indices, indices);
  assert.deepStrictEqual(decoded.paleta, paleta);
});

test("ancho o alto de 1 pixel", () => {
  const ancho = 1;
  const alto = 1;
  const paleta = ["#000000"];
  const indices = new Uint8Array([1]);
  const png = codificarPngIndexado({ ancho, alto, indices, paleta });
  const decoded = decodificarPngIndexado(png);
  assert.strictEqual(decoded.ancho, ancho);
  assert.strictEqual(decoded.alto, alto);
  assert.deepStrictEqual(decoded.indices, indices);
  assert.deepStrictEqual(decoded.paleta, paleta);
});

test("PNG comienza con firma correcta", () => {
  const ancho = 1;
  const alto = 1;
  const paleta = ["#ff00ff"];
  const indices = new Uint8Array([1]);
  const png = codificarPngIndexado({ ancho, alto, indices, paleta });
  const firma = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < firma.length; i++) {
    assert.strictEqual(png[i], firma[i], `byte ${i} de la firma`);
  }
});

test("codificarPngIndexado rechaza dimensiones inválidas", () => {
  assert.throws(() => codificarPngIndexado({ ancho: 0, alto: 1, indices: new Uint8Array([0]), paleta: ["#000000"] }), Error);
  assert.throws(() => codificarPngIndexado({ ancho: 1, alto: 0, indices: new Uint8Array([0]), paleta: ["#000000"] }), Error);
  assert.throws(() => codificarPngIndexado({ ancho: -1, alto: 1, indices: new Uint8Array([0]), paleta: ["#000000"] }), Error);
});

test("codificarPngIndexado rechaza longitud de indices incorrecta", () => {
  assert.throws(() => codificarPngIndexado({ ancho: 2, alto: 2, indices: new Uint8Array([0,0,0]), paleta: ["#000000"] }), Error);
});

test("codificarPngIndexado rechaza paleta vacía o demasiado grande", () => {
  assert.throws(() => codificarPngIndexado({ ancho: 1, alto: 1, indices: new Uint8Array([0]), paleta: [] }), Error);
  // paleta de 256 colores (MAX_PALETA) should error
  const bigPaleta = Array.from({length: 256}, (_, i) => `#${i.toString(16).padStart(6, "0")}`);
  assert.throws(() => codificarPngIndexado({ ancho: 1, alto: 1, indices: new Uint8Array([0]), paleta: bigPaleta }), Error);
});

test("decodificarPngIndexado rechaza firma incorrecta", () => {
  const bytes = [0,0,0,0,0,0,0,0]; // no PNG signature
  assert.throws(() => decodificarPngIndexado(bytes), Error);
});

test("zlibSinComprimir produce bytes esperados para entrada vacía", () => {
  const out = zlibSinComprimir(new Uint8Array([]));
  // Should be zlib header + empty stored block + adler32 of empty (1)
  // According to code: if crudo.length===0 then salida.push(1,0,0,255,255) after header.
  // Then later push adler32(crudo) which is adler32([]) = 1.
  // So bytes: 0x78 0x01 0x01 0x00 0x00 0xff 0xff 0x00 0x00 0x00 0x01
  const expected = [0x78,0x01,0x01,0x00,0x00,0xff,0xff,0x00,0x00,0x00,0x01];
  assert.deepStrictEqual(out, expected);
});

test("base64 codifica correctamente", () => {
  assert.strictEqual(base64(new Uint8Array([])), "");
  assert.strictEqual(base64(Uint8Array.from([0x14, 0xfb, 0x9c, 0x03, 0xdd])), "FPucA90=");
});

test("pngADataUri devuelve data URI", () => {
  const bytes = Uint8Array.from([137,80,78,71,13,10,26,10]);
  const uri = pngADataUri(bytes);
  assert.strictEqual(uri.startsWith("data:image/png;base64,"), true);
  const b64 = uri.substring("data:image/png;base64,".length);
  assert.strictEqual(b64, base64(bytes));
});