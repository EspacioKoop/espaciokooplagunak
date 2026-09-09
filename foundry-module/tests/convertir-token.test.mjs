// La entrada de token 2D de terceros (#891): decodificación PNG, reescalado y
// cuantización, sin necesitar ningún fichero de fuera (no hay PNG de origen que
// descargar en esta entrega — ver `docs/PROCEDENCIA_ASSETS.md`).

import assert from "node:assert/strict";
import test from "node:test";

import { codificarPngIndexado } from "../scripts/png-indexado.mjs";
import { decodificarPngIndexadoOTrueColor } from "../../tools/convertir-token-png.mjs";
import {
  LADO_TOKEN,
  cuantizarIndexado,
  moduloDeToken,
  reescalarVecinoMasProximo,
} from "../../tools/convertir-token.mjs";

/* ---- decodificador general de PNG ------------------------------------------ */

test("decodifica un PNG indexado propio (round-trip con png-indexado.mjs)", () => {
  const ancho = 4;
  const alto = 2;
  // fila 0: rojo, verde, azul, hueco; fila 1: todo rojo
  const indices = Uint8Array.from([1, 2, 3, 0, 1, 1, 1, 1]);
  const paleta = ["#ff0000", "#00ff00", "#0000ff"];
  const png = codificarPngIndexado({ ancho, alto, indices, paleta });

  const decodificada = decodificarPngIndexadoOTrueColor(png);
  assert.equal(decodificada.ancho, ancho);
  assert.equal(decodificada.alto, alto);
  // píxel 0: rojo opaco
  assert.deepEqual(Array.from(decodificada.rgba.subarray(0, 4)), [255, 0, 0, 255]);
  // píxel 3: hueco, transparente
  assert.equal(decodificada.rgba[3 * 4 + 3], 0);
  // píxel 4 (fila 1, col 0): rojo opaco
  assert.deepEqual(Array.from(decodificada.rgba.subarray(4 * 4, 4 * 4 + 4)), [255, 0, 0, 255]);
});

test("rechaza lo que no sea un PNG", () => {
  assert.throws(() => decodificarPngIndexadoOTrueColor(new Uint8Array([1, 2, 3])), /firma/);
});

/* Un PNG bien formado del que partir para estropearlo de una manera cada vez.
   Estropear uno real es lo único que prueba de verdad las guardas: un buffer
   inventado a mano falla por la firma antes de llegar a ninguna de ellas. */
function pngDePrueba() {
  return codificarPngIndexado({
    ancho: 4,
    alto: 2,
    indices: Uint8Array.from([1, 2, 3, 0, 1, 1, 1, 1]),
    paleta: ["#ff0000", "#00ff00", "#0000ff"],
  });
}

/** Posición del primer chunk del tipo pedido (tras los 8 bytes de la firma). */
function posicionDeChunk(png, tipo) {
  let pos = 8;
  while (pos + 8 <= png.length) {
    const largo = ((png[pos] << 24) | (png[pos + 1] << 16) | (png[pos + 2] << 8) | png[pos + 3]) >>> 0;
    const nombre = String.fromCharCode(...png.subarray(pos + 4, pos + 8));
    if (nombre === tipo) return { pos, largo };
    pos += 12 + largo;
  }
  throw new Error(`chunk ${tipo} no encontrado en el PNG de prueba`);
}

test("un PNG truncado se rechaza en vez de seguir con un chunk a medias", () => {
  const png = pngDePrueba();
  assert.throws(() => decodificarPngIndexadoOTrueColor(png.subarray(0, png.length - 20)), /truncado/);
});

test("un PNG sin IEND se rechaza aunque todos sus chunks quepan", () => {
  const png = pngDePrueba();
  const { pos } = posicionDeChunk(png, "IEND");
  assert.throws(() => decodificarPngIndexadoOTrueColor(png.subarray(0, pos)), /IEND/);
});

test("un chunk que declara un largo imposible no reserva por su palabra", () => {
  const png = Uint8Array.from(pngDePrueba());
  const { pos } = posicionDeChunk(png, "IHDR");
  png[pos] = 0xff;
  png[pos + 1] = 0xff;
  png[pos + 2] = 0xff;
  png[pos + 3] = 0xff;
  assert.throws(() => decodificarPngIndexadoOTrueColor(png), /largo imposible/);
});

test("dimensiones nulas se rechazan: no hay token de 0 px", () => {
  const png = Uint8Array.from(pngDePrueba());
  const { pos } = posicionDeChunk(png, "IHDR");
  png.set([0, 0, 0, 0], pos + 8); // ancho = 0
  assert.throws(() => decodificarPngIndexadoOTrueColor(png), /nulas/);
});

test("una imagen mayor que el tope declarado se rechaza", () => {
  const png = Uint8Array.from(pngDePrueba());
  const { pos } = posicionDeChunk(png, "IHDR");
  png.set([0, 1, 0, 0], pos + 8); // ancho = 65536
  assert.throws(() => decodificarPngIndexadoOTrueColor(png), /lado máximo/);
});

test("si los datos de imagen no cuadran con las dimensiones, se rechaza", () => {
  const png = Uint8Array.from(pngDePrueba());
  const { pos } = posicionDeChunk(png, "IHDR");
  png.set([0, 0, 0, 9], pos + 8); // ancho = 9, pero los IDAT son de 4
  assert.throws(() => decodificarPngIndexadoOTrueColor(png), /incompleto/);
});

test("un índice fuera de la PLTE se rechaza en vez de inventar un negro", () => {
  const png = Uint8Array.from(pngDePrueba());
  const { pos, largo } = posicionDeChunk(png, "PLTE");
  // Recorta la paleta declarada a un solo color dejando el resto de bytes
  // como relleno: los índices 2 y 3 de la imagen quedan fuera.
  png[pos + 3] = 3;
  const sobra = largo - 3;
  const recortado = Uint8Array.from([
    ...png.subarray(0, pos + 8 + 3),
    ...png.subarray(pos + 8 + 3 + sobra),
  ]);
  assert.throws(() => decodificarPngIndexadoOTrueColor(recortado), /fuera de una PLTE/);
});

test("una PLTE de tamaño no múltiplo de 3 se rechaza", () => {
  const png = Uint8Array.from(pngDePrueba());
  const { pos, largo } = posicionDeChunk(png, "PLTE");
  png[pos + 3] = largo - 1;
  const recortado = Uint8Array.from([
    ...png.subarray(0, pos + 8 + largo - 1),
    ...png.subarray(pos + 8 + largo),
  ]);
  assert.throws(() => decodificarPngIndexadoOTrueColor(recortado), /PLTE de PNG con tamaño inválido/);
});

/* ---- reescalado por vecino más próximo ------------------------------------- */

test("reescalarVecinoMasProximo no inventa colores intermedios", () => {
  // Una imagen de 2x1: mitad izquierda roja, mitad derecha azul.
  const origen = {
    ancho: 2,
    alto: 1,
    rgba: Uint8ClampedArray.from([255, 0, 0, 255, 0, 0, 255, 255]),
  };
  const reescalada = reescalarVecinoMasProximo(origen, 4, 1);
  assert.equal(reescalada.ancho, 4);
  const colores = [];
  for (let x = 0; x < 4; x += 1) {
    colores.push(Array.from(reescalada.rgba.subarray(x * 4, x * 4 + 3)));
  }
  // Todos los píxeles son rojo puro o azul puro: ninguno es una mezcla.
  for (const [r, g, b] of colores) {
    assert.ok((r === 255 && g === 0 && b === 0) || (r === 0 && g === 0 && b === 255));
  }
});

test("LADO_TOKEN es 128, el tamaño de token que pide #891", () => {
  assert.equal(LADO_TOKEN, 128);
});

/* ---- cuantización ----------------------------------------------------------- */

test("cuantizarIndexado: el índice 0 es siempre el hueco transparente", () => {
  const rgba = Uint8ClampedArray.from([
    255, 0, 0, 255, // opaco rojo
    0, 0, 0, 0, // transparente
  ]);
  const { indices, paleta } = cuantizarIndexado({ ancho: 2, alto: 1, rgba }, 255);
  assert.equal(indices[1], 0);
  assert.notEqual(indices[0], 0);
  assert.equal(paleta[indices[0] - 1], "#ff0000");
});

test("cuantizarIndexado agrupa píxeles del mismo color exacto en el mismo índice", () => {
  const rgba = Uint8ClampedArray.from([
    10, 20, 30, 255,
    10, 20, 30, 255,
    40, 50, 60, 255,
  ]);
  const { indices, paleta } = cuantizarIndexado({ ancho: 3, alto: 1, rgba }, 255);
  assert.equal(indices[0], indices[1]);
  assert.notEqual(indices[0], indices[2]);
  assert.equal(paleta.length, 2);
});

test("cuantizarIndexado se niega por encima del tope de colores, no funde a ciegas", () => {
  const pixeles = 300;
  const rgba = new Uint8ClampedArray(pixeles * 4);
  for (let i = 0; i < pixeles; i += 1) {
    rgba[i * 4] = i % 256;
    rgba[i * 4 + 1] = (i * 3) % 256;
    rgba[i * 4 + 2] = (i * 7) % 256;
    rgba[i * 4 + 3] = 255;
  }
  assert.throws(
    () => cuantizarIndexado({ ancho: pixeles, alto: 1, rgba }, 255),
    /más de 255 colores/,
  );
});

/* ---- generación del módulo de datos ----------------------------------------- */

test("moduloDeToken escribe la ficha y conserva la paleta propia del origen", () => {
  const imagen = { ancho: 2, alto: 1, indices: Uint8Array.from([1, 2]), paleta: ["#abcdef", "#123456"] };
  const ficha = {
    obra: "Campesino de prueba",
    modelo: "pixelart original",
    autoria: "Alguien",
    fuente: "Un sitio",
    licencia: "CC0",
    sha256: "deadbeef",
  };
  const texto = moduloDeToken("campesino-01", imagen, ficha);
  assert.match(texto, /export const CAMPESINO_01 = Object\.freeze/);
  assert.match(texto, /#abcdef/);
  assert.match(texto, /#123456/);
  assert.match(texto, /sha256\s+deadbeef/);
  assert.match(texto, /GENERADO, NO ESCRITO A MANO/);
});
