import assert from "node:assert/strict";
import test from "node:test";

import { barajaOrdenada } from "../scripts/minijuegos/naipes.mjs";
import {
  cartaSvg,
  dorsoSvg,
  cartaDataUri,
  dorsoDataUri,
  etiquetaValor,
  colorDePalo,
  PALETA,
  ANCHO,
  ALTO,
} from "../scripts/minijuegos/cartas-pixelart.mjs";

test("las 52 cartas de la baraja tienen SVG y todos son distintos", () => {
  const vistos = new Set();
  for (const carta of barajaOrdenada()) {
    const codigo = `${carta.valor}${carta.palo}`;
    const dibujo = cartaSvg(codigo);
    assert.match(dibujo, /^<svg /);
    assert.match(dibujo, /crispEdges/);
    assert.equal(vistos.has(dibujo), false, `carta duplicada: ${codigo}`);
    vistos.add(dibujo);
  }
  assert.equal(vistos.size, 52);
});

test("un código desconocido falla cerrado", () => {
  for (const malo of ["15s", "1c", "14x", "", "s14", "7"]) {
    assert.throws(() => cartaSvg(malo), RangeError, `esperaba rechazo de ${malo}`);
  }
});

test("la legibilidad se apoya en índice doble y color de palo correcto", () => {
  // Corazones y diamantes en carmesí; picas y tréboles en tinta oscura.
  assert.equal(colorDePalo("h"), PALETA.rojo);
  assert.equal(colorDePalo("d"), PALETA.rojo);
  assert.equal(colorDePalo("s"), PALETA.negro);
  assert.equal(colorDePalo("c"), PALETA.negro);
  // Cada cara usa exactamente su tinta (índices + palo central) sobre pergamino.
  const roja = cartaSvg("14h");
  assert.match(roja, new RegExp(PALETA.rojo));
  assert.doesNotMatch(roja, new RegExp(`<rect x="[0-9.]+" y="[0-9.]+" width="1" height="1" fill="${PALETA.negro}"`));
  const negra = cartaSvg("14s");
  assert.match(negra, new RegExp(PALETA.negro));
  // Índice repetido: hay píxeles de tinta tanto en la banda superior como en la
  // inferior de la carta, como en una baraja física girada.
  const pixeles = [...roja.matchAll(/<rect x="(\d+)" y="(\d+)" width="1"/g)].map((m) => Number(m[2]));
  assert.equal(pixeles.some((y) => y < ALTO / 3), true, "falta índice superior");
  assert.equal(pixeles.some((y) => y > (2 * ALTO) / 3), true, "falta índice inferior");
});

test("el índice girado del 10 se lee 10, no 01", () => {
  // En el índice inferior (girado 180º), el glifo del "1" debe quedar a la
  // DERECHA del "0" en coordenadas de lienzo para leerse bien al girar.
  const svg = cartaSvg("10s");
  const pixeles = [...svg.matchAll(/<rect x="(\d+)" y="(\d+)" width="1"/g)]
    .map((m) => ({ x: Number(m[1]), y: Number(m[2]) }))
    .filter((p) => p.y >= ALTO - 9); // banda del valor inferior
  // El "1" invertido es estrecho (3 columnas); el "0" ocupa 5. Si el orden es
  // correcto, la columna del píxel más a la derecha pertenece al "1": la mitad
  // derecha de la banda tiene menos píxeles que la izquierda.
  const centro = ALTO - 9 + 3;
  const izquierda = pixeles.filter((p) => p.x < ANCHO - 2 - 5).length;
  const derecha = pixeles.filter((p) => p.x >= ANCHO - 2 - 5).length;
  assert.ok(izquierda > derecha, `esperaba el "0" (denso) a la izquierda: ${izquierda} vs ${derecha} (centro ${centro})`);
});

test("las etiquetas de valor son las de una baraja inglesa", () => {
  assert.equal(etiquetaValor(14), "A");
  assert.equal(etiquetaValor(13), "K");
  assert.equal(etiquetaValor(12), "Q");
  assert.equal(etiquetaValor(11), "J");
  assert.equal(etiquetaValor(10), "10");
  assert.equal(etiquetaValor(2), "2");
});

test("el dorso es común, no revela la carta y lleva el motivo d20", () => {
  assert.equal(dorsoSvg(), dorsoSvg());
  assert.match(dorsoSvg(), new RegExp(PALETA.dorsoMotivo));
  assert.doesNotMatch(dorsoSvg(), new RegExp(PALETA.cara));
});

test("los data URIs son autosuficientes y con el viewBox del lienzo", () => {
  const uri = cartaDataUri("2c");
  assert.match(uri, /^data:image\/svg\+xml,/);
  assert.match(decodeURIComponent(uri.slice("data:image/svg+xml,".length)), new RegExp(`viewBox="0 0 ${ANCHO} ${ALTO}"`));
  assert.match(dorsoDataUri(), /^data:image\/svg\+xml,/);
});
