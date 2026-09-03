// La piel de la hoja de una puerta como textura (#458, sobre #584/#550).

import assert from "node:assert/strict";
import test from "node:test";

import { teselaHoja, texturaHoja, piezasPielHojaTextura } from "../scripts/piel-textura-puerta.mjs";
import { METROS_POR_TEXEL } from "../scripts/piel-textura.mjs";
import { ALTURA, crearSalaCaja } from "../scripts/nave-sala-caja.mjs";
import { texturaUtilizable } from "../scripts/retro3d-lienzo.mjs";
import { AMBAR_SENAL } from "../scripts/paleta.mjs";

// Media hoja habitual: 1,2 m de ancho (`ANCHO_PUERTA`/2), 2,8 m de alto
// (`ALTURA_PUERTA`, constante en toda la nave).
const COLUMNAS = Math.round(1.2 / METROS_POR_TEXEL);
const FILAS = Math.round(2.8 / METROS_POR_TEXEL);

/* ---- la tesela --------------------------------------------------------- */

test("dos hojas del mismo tamaño son iguales: sin semilla, es una pieza de serie", () => {
  assert.deepEqual(teselaHoja(COLUMNAS, FILAS), teselaHoja(COLUMNAS, FILAS));
});

test("el dibujo mide justo lo pedido", () => {
  const rejilla = teselaHoja(COLUMNAS, FILAS);
  assert.equal(rejilla.length, FILAS);
  for (const fila of rejilla) assert.equal(fila.length, COLUMNAS);
});

test("trae el ámbar de la franja de aviso, mismo tono que el marco de la puerta", () => {
  const rejilla = teselaHoja(COLUMNAS, FILAS);
  const colores = new Set(rejilla.flat());
  assert.ok(colores.has(AMBAR_SENAL), "la franja de aviso tiene que llegar a la textura");
});

test("una hoja demasiado pequeña no revienta: sigue devolviendo una rejilla válida", () => {
  // Por debajo del umbral, los motivos grandes (registro, franja) se saltan
  // solos —`teselaHoja` no revienta, simplemente dibuja menos—; el bisel del
  // bulto de la hoja es incondicional y sigue ahí a cualquier tamaño.
  const rejilla = teselaHoja(2, 4);
  assert.equal(rejilla.length, 4);
  for (const fila of rejilla) {
    assert.equal(fila.length, 2);
    for (const color of fila) assert.equal(typeof color, "string");
  }
});

/* ---- la textura --------------------------------------------------------- */

test("la textura es consumible por el rasterizador y no tiene huecos", () => {
  const textura = texturaHoja(COLUMNAS, FILAS);
  assert.ok(texturaUtilizable(textura));
  assert.ok([...textura.indices].every((i) => i < textura.paleta.length));
});

test("cabe de sobra en una paleta indexada", () => {
  assert.ok(texturaHoja(COLUMNAS, FILAS).paleta.length <= 16);
});

/* ---- las piezas ----------------------------------------------------------- */

test("una hoja demasiado pequeña no aporta piezas (mismo umbral que la versión en chapas)", () => {
  const puerta = { y0: 0, y1: 0.8, alongX: true, base: { x: 0, z: 4, ancho: 1.2, profundidad: 2.4 } };
  const hoja = { x: 0, z: 4, ancho: 0.2, profundidad: 2.4 };
  assert.deepEqual(piezasPielHojaTextura(puerta, hoja, { color: "#334455" }), []);
});

test("una hoja de tamaño normal aporta dos caras, cada una con su textura", () => {
  const base = { x: 0, z: 4, ancho: 1.2, profundidad: 2.4 };
  const puerta = { y0: 0, y1: 2.8, alongX: true, base };
  const hoja = { x: 0, z: 4, ancho: 1.2, profundidad: 2.4 };
  const piezas = piezasPielHojaTextura(puerta, hoja, { color: "#334455", ambiente: 0.6 });
  assert.equal(piezas.length, 2, "una cara por lado de la hoja");
  for (const pieza of piezas) {
    assert.ok(texturaUtilizable(pieza.textura));
    assert.equal(pieza.color, "#334455");
    assert.equal(pieza.ambiente, 0.6);
  }
});

test("la hoja que cierra a la izquierda se espeja por UV, no repinta la textura", () => {
  const base = { x: 0, z: 4, ancho: 1.2, profundidad: 2.4 };
  const puerta = { y0: 0, y1: 2.8, alongX: true, base };
  // Hoja de la DERECHA del hueco (cierra hacia la izquierda): su x de inicio
  // queda por delante de la mitad del hueco.
  const hojaDerecha = { x: 0.6, z: 4, ancho: 0.6, profundidad: 2.4 };
  const hojaIzquierda = { x: 0, z: 4, ancho: 0.6, profundidad: 2.4 };
  const [piezaIzq] = piezasPielHojaTextura(puerta, hojaIzquierda, { color: "#334455" });
  const [piezaDer] = piezasPielHojaTextura(puerta, hojaDerecha, { color: "#334455" });
  // Misma textura de fondo (mismo tamaño de hoja), pero las uvs vienen al
  // revés: es la MISMA imagen leída del otro lado, no una segunda pintada.
  assert.equal(piezaIzq.textura, piezaDer.textura);
  assert.notDeepEqual(piezaIzq.malla.uvs, piezaDer.malla.uvs);
});

/* ---- en la sala ------------------------------------------------------------ */

test("de serie la puerta va texturada (#458: la decisión ya se tomó)", () => {
  const puertas = [{ rect: { x: 0, z: 4, ancho: 1.2, profundidad: 2.4 } }];
  const sala = crearSalaCaja({ ancho: 11, profundidad: 11, puertas, muralPixel: false, pielObjetos: false });
  const escena = sala.componer(3, 0, 5.2, -Math.PI / 2, { ancho: 320, alto: 180 });
  assert.ok(escena.poligonos.some((p) => p.textura), "la hoja tiene que llegar texturada sin pedir nada");
});
