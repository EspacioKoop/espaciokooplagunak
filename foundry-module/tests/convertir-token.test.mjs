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
