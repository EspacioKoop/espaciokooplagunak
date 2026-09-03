// Piel pixelart de la hoja de una puerta (#550).
//
// Lo exigible aquí es que la puerta esté en la MISMA rejilla que el muro que la
// rodea (que es el motivo entero del módulo), que se vea por las dos caras, que
// viaje con la hoja al abrirse y que aguante una hoja estrecha sin deshacerse.

import test from "node:test";
import assert from "node:assert/strict";

import { RESALTE_HOJA, piezasPielHoja, rejillaHoja } from "../scripts/nave-piel-puerta.mjs";
import { CELDA } from "../scripts/nave-mural-pixel.mjs";
import { AMBAR_SENAL, MURAL } from "../scripts/paleta.mjs";
import { crearSalaCaja, rectsHojaPuerta } from "../scripts/nave-sala-caja.mjs";

/** Media hoja de una puerta de 1,2 m en el muro norte, cerrada. */
const PUERTA = { y0: 0, y1: 2.8, alongX: true };
const HOJA = { x: 3, z: -0.4, ancho: 0.6, profundidad: 0.4 };

test("la puerta usa la misma celda que el muro, no una escala propia", () => {
  // El módulo entero existe por esto: si el detalle de la puerta midiera otra
  // cosa, al pasar de la pared a la hoja el tamaño del pixelart cambiaría y la
  // puerta parecería de otra nave. Se comprueba que todo cae CLAVADO en la
  // rejilla; el alto de cada pieza ya no es una celda desde que se funde en
  // rectángulos (#551), y exigirlo era describir el fundido, no la escala.
  const enRejilla = (n) => Math.abs(n / CELDA - Math.round(n / CELDA)) < 1e-6;
  for (const { malla } of piezasPielHoja(PUERTA, HOJA)) {
    const alturas = malla.vertices.map(([, y]) => y);
    assert.ok(alturas.every(enRejilla), "toda altura cae en la rejilla del casco");
    assert.ok(enRejilla(Math.max(...alturas) - Math.min(...alturas)));
  }
});

test("la hoja lleva piel por sus DOS caras", () => {
  // Una puerta separa dos salas y se ve desde las dos. Con una sola cara, la
  // hoja se queda lisa justo cuando la cruzas.
  const planos = new Set(piezasPielHoja(PUERTA, HOJA).map(({ malla }) => malla.vertices[0][2].toFixed(3)));
  assert.equal(planos.size, 2, "una cara por lado de la hoja");
  assert.ok(planos.has((HOJA.z - RESALTE_HOJA).toFixed(3)));
  assert.ok(planos.has((HOJA.z + HOJA.profundidad + RESALTE_HOJA).toFixed(3)));
});

test("la piel viaja con la hoja al abrirse", () => {
  // Se calcula desde el MISMO rect que la hoja: con dos cálculos, el dibujo se
  // quedaría quieto mientras la puerta corre.
  const base = { x: 2.4, z: -0.4, ancho: 1.2, profundidad: 0.4 };
  const puerta = { base, y0: 0, y1: 2.8, alongX: true };
  const equis = (fraccion) =>
    rectsHojaPuerta(puerta, fraccion).flatMap((hoja) =>
      piezasPielHoja(puerta, hoja).map(({ malla }) => malla.vertices[0][0]),
    );
  const cerrada = equis(0);
  const abierta = equis(1);
  assert.equal(cerrada.length, abierta.length);
  assert.ok(cerrada.some((x, i) => x !== abierta[i]), "el dibujo se desplaza con su hoja");
});

test("una hoja estrecha se sigue leyendo, y una hoja diminuta se queda lisa", () => {
  // Media hoja de una puerta de 1,2 m son TRES celdas: el dibujo está diseñado
  // para eso y no puede depender de tener anchura.
  assert.ok(piezasPielHoja(PUERTA, HOJA).length > 0, "seis celdas de ancho sí llevan dibujo");
  const diminuta = { ...HOJA, ancho: 0.3 };
  assert.deepEqual(piezasPielHoja(PUERTA, diminuta), [], "por debajo de 40 cm, mejor lisa que ruidosa");
  const bajita = { y0: 0, y1: 0.9, alongX: true };
  assert.deepEqual(piezasPielHoja(bajita, HOJA), [], "en 90 cm no cabe ni el zócalo ni la franja");
});

test("el ámbar de la franja es el de señalización, no un tono nuevo", () => {
  const colores = new Set(piezasPielHoja(PUERTA, HOJA).map((p) => p.color));
  assert.ok(colores.has(AMBAR_SENAL), "la franja de aviso se lee de lejos");
  const permitidos = new Set([...Object.values(MURAL), AMBAR_SENAL]);
  for (const color of colores) assert.ok(permitidos.has(color), `${color} no está en la paleta (#351)`);
});

test("la franja de aviso queda a la altura de la mano", () => {
  const amarillas = piezasPielHoja(PUERTA, HOJA)
    .filter((p) => p.color === AMBAR_SENAL)
    .flatMap(({ malla }) => malla.vertices.map(([, y]) => y));
  assert.ok(Math.min(...amarillas) >= 0.9, "ni a la altura del tobillo");
  assert.ok(Math.max(...amarillas) <= 1.5, "ni por encima de la cabeza");
});

test("dos puertas de la misma nave son iguales", () => {
  // Sin semilla a propósito: una puerta es una pieza de serie. Sortear sus
  // remaches la convertiría en artesanía, justo lo contrario de una esclusa.
  assert.deepEqual(rejillaHoja(3, 14), rejillaHoja(3, 14));
});

test("el dibujo no puede leerse como una medida", () => {
  // Regla de #526: cada pieza es un rectángulo de UNA celda de alto, así que no
  // hay forma de que la hoja dibuje una barra que crezca ni una escala graduada.
  const rejilla = rejillaHoja(3, 14);
  assert.equal(rejilla.length, 14);
  for (const fila of rejilla) assert.equal(fila.length, 3);
});

test("la fábrica viste la hoja de serie con TEXTURA (#458: la decisión ya se tomó)", () => {
  // `pielPuertas: "textura"` es el valor por defecto desde #458 — el mismo
  // cambio de serie que `pielMuro`. La textura gana en detalle con MENOS
  // polígonos que las bandas lisas (esa es la razón de ser de una textura), así
  // que "va vestida" ya no se puede leer en el conteo: se lee en que la escena
  // trae piezas con `textura`.
  const puertas = [{ rect: { x: 0, z: 4, ancho: 1.2, profundidad: 2.4 } }];
  const vista = (opciones) =>
    crearSalaCaja({ ancho: 11, profundidad: 11, puertas, muralPixel: false, ...opciones })
      // Mirando al muro oeste, que es donde está la puerta.
      .componer(3, 0, 5.2, -Math.PI / 2, { ancho: 320, alto: 180 });
  const conTextura = vista({}).poligonos;
  const conBandas = vista({ pielPuertas: false }).poligonos;
  assert.ok(conTextura.some((p) => p.textura), "sin pedir nada, la hoja llega texturada");
  assert.equal(conBandas.filter((p) => p.textura).length, 0, "apagada, la hoja no trae textura");
  assert.ok(conBandas.length > 0, "apagada, la hoja conserva sus bandas de siempre");
});

test("pedir geometría explícitamente sigue vistiendo la hoja en chapas, sin textura", () => {
  const puertas = [{ rect: { x: 0, z: 4, ancho: 1.2, profundidad: 2.4 } }];
  const escena = crearSalaCaja({ ancho: 11, profundidad: 11, puertas, muralPixel: false, pielPuertas: "geometria" })
    .componer(3, 0, 5.2, -Math.PI / 2, { ancho: 320, alto: 180 });
  assert.equal(escena.poligonos.filter((p) => p.textura).length, 0);
  assert.ok(escena.poligonos.length > 0);
});
