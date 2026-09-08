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

// La baraja real se recorre por `carta.codigo`, nunca reconstruyendo el código
// a mano: si el arte y `naipes.mjs` dejan de hablar el mismo idioma, esta prueba
// falla en vez de tapar la divergencia.
test("las 52 cartas de la baraja tienen SVG y todos son distintos", () => {
  const vistos = new Set();
  for (const carta of barajaOrdenada()) {
    const dibujo = cartaSvg(carta.codigo);
    assert.match(dibujo, /^<svg /);
    assert.match(dibujo, /crispEdges/);
    assert.equal(vistos.has(dibujo), false, `carta duplicada: ${carta.codigo}`);
    vistos.add(dibujo);
  }
  assert.equal(vistos.size, 52);
});

test("las figuras y el diez, que son la mitad de los rangos, también se dibujan", () => {
  for (const codigo of ["Ts", "Jh", "Qd", "Kc", "Ac"]) {
    assert.match(cartaSvg(codigo), /^<svg /, `esperaba dibujo de ${codigo}`);
  }
});

// Ray-casting sobre un polígono rectilíneo extraído del atributo `d` de un
// <path> con solo M/H/V/Z (nuestros contornos no usan curvas). Sirve para
// comprobar, como haría un rasterizador real, si el CENTRO de un píxel cae
// dentro del contorno exterior o del interior — que es lo único que importa
// para saber si ese píxel es borde o fondo.
function puntosDePath(d) {
  const tokens = d.match(/[MHVZ][^MHVZ]*/g) ?? [];
  const puntos = [];
  let x = 0;
  let y = 0;
  for (const token of tokens) {
    const comando = token[0];
    const numeros = token
      .slice(1)
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(Number);
    if (comando === "M") [x, y] = numeros;
    else if (comando === "H") x = numeros[0];
    else if (comando === "V") y = numeros[0];
    else continue;
    puntos.push([x, y]);
  }
  return puntos;
}

function contienePunto(puntos, px, py) {
  let dentro = false;
  for (let i = 0, j = puntos.length - 1; i < puntos.length; j = i++) {
    const [xi, yi] = puntos[i];
    const [xj, yj] = puntos[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

function esPixelDeBorde(svg, x, y) {
  const [, dExterior] = svg.match(/<path d="([^"]+)"[^>]*\/>/);
  const [, , dInterior] = svg.match(/<path d="([^"]+)"[^>]*\/><path d="([^"]+)"/);
  const cx = x + 0.5;
  const cy = y + 0.5;
  const exterior = puntosDePath(dExterior);
  const interior = puntosDePath(dInterior);
  return contienePunto(exterior, cx, cy) && !contienePunto(interior, cx, cy);
}

test("la silueta de la carta conserva esquinas transparentes y escalonadas", () => {
  const svg = cartaSvg("As");

  assert.match(svg, new RegExp(`M2 0H${ANCHO - 2}`));
  assert.match(svg, new RegExp(`M3 1H${ANCHO - 3}`));
  assert.doesNotMatch(svg, /<rect x="0" y="0"/);
});

test("el marco tiene 1px de separación también en los laterales, no solo arriba/abajo", () => {
  // Repro exacto de la review: (1, 21) es el centro vertical del lateral
  // izquierdo. Antes el interior solo desplazaba el eje Y, así que en los
  // laterales exterior e interior compartían la misma x y ese píxel salía
  // como fondo en vez de borde.
  for (const svg of [cartaSvg("As"), dorsoSvg()]) {
    assert.equal(esPixelDeBorde(svg, 1, 21), true, "el lateral izquierdo debe ser borde a media altura");
    assert.equal(esPixelDeBorde(svg, ANCHO - 2, 21), true, "el lateral derecho debe ser borde a media altura");
    // Y un píxel más adentro ya es el interior/fondo, no borde: la separación
    // es de exactamente 1px, no un marco más grueso de lo pensado.
    assert.equal(esPixelDeBorde(svg, 2, 21), false, "un píxel dentro del lateral izquierdo ya es fondo");
  }
});

test("un código desconocido falla cerrado", () => {
  // Incluye el par valor+palo en crudo ("14s", "10s"): no es el código estable
  // de la baraja y no debe dibujarse "por si acaso".
  for (const malo of ["15s", "1c", "Tx", "", "s14", "7", "14s", "10s", "as", "AS"]) {
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
  const roja = cartaSvg("Ah");
  assert.match(roja, new RegExp(PALETA.rojo));
  assert.doesNotMatch(roja, new RegExp(`<rect x="[0-9.]+" y="[0-9.]+" width="1" height="1" fill="${PALETA.negro}"`));
  const negra = cartaSvg("As");
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
  const svg = cartaSvg("Ts");
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
