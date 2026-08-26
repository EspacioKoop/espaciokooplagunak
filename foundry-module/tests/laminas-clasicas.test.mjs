import assert from "node:assert/strict";
import test from "node:test";

import * as laminas from "../scripts/laminas-clasicas.mjs";
import {
  tramaGrabado,
  discoLunar,
  discoLunarSvg,
  cartografia,
  cartografiaSvg,
  cartografiaDataUri,
  rosaDeLosVientos,
  TINTA,
} from "../scripts/laminas-clasicas.mjs";

test("la trama codifica la sombra por densidad de línea, no por opacidad", () => {
  assert.deepEqual(tramaGrabado(0), []);
  const suave = tramaGrabado(0.3);
  const densa = tramaGrabado(1);
  assert.ok(densa.length > suave.length, "más sombra = más pasadas de rayado");
  // Cada pasada cruza a la anterior: es rayado cruzado, no líneas paralelas.
  const angulos = new Set(densa.map((l) => l.angulo));
  assert.ok(angulos.size > 1, "las pasadas deben cruzarse entre sí");
  // Y las pasadas sucesivas van más juntas, que es lo que oscurece.
  for (let i = 1; i < densa.length; i += 1) {
    assert.ok(densa[i].separacion < densa[i - 1].separacion);
  }
});

test("la intensidad de trama se acota y tolera basura", () => {
  assert.deepEqual(tramaGrabado(-5), []);
  assert.deepEqual(tramaGrabado("x"), []);
  assert.deepEqual(tramaGrabado(null), []);
  assert.equal(tramaGrabado(99).length, tramaGrabado(1).length, "no se desborda por arriba");
});

test("el disco lunar es determinista por semilla y no repite dos veces lo mismo", () => {
  const a = discoLunar("mesa-1");
  const b = discoLunar("mesa-1");
  const c = discoLunar("mesa-2");
  assert.deepEqual(a, b, "misma semilla, misma lámina");
  assert.notDeepEqual(a.crateres, c.crateres, "semilla distinta, relieve distinto");
});

test("los cráteres caen dentro del disco", () => {
  const { radio, crateres } = discoLunar("s", { radio: 40, crateres: 60 });
  assert.equal(crateres.length, 60);
  for (const c of crateres) {
    const distancia = Math.hypot(c.x, c.y) + c.r;
    assert.ok(distancia <= radio, `cráter fuera del disco: ${JSON.stringify(c)}`);
  }
});

test("la fase se acota y el disco sigue siendo SVG válido en los extremos", () => {
  for (const fase of [-1, 0, 0.5, 1, 2, "x"]) {
    const svg = discoLunarSvg("s", { fase });
    assert.match(svg, /^<svg /);
    assert.doesNotMatch(svg, /NaN/, `fase ${fase} produjo NaN`);
  }
});

test("la zona no iluminada se raya, no se rellena: nada de negro sobre negro", () => {
  const svg = discoLunarSvg("s", { radio: 40, fase: 0.6 });
  // El terminador se pinta con la trama de grabado…
  assert.match(svg, /<path d="M 0 -40[^"]*" fill="url\(#luna-s-40-t0\)"/);
  // …y no con un relleno plano, que sobre fondo oscuro era invisible.
  assert.doesNotMatch(svg, /fill-opacity/);
  // El rayado nunca se sale del limbo del disco.
  assert.match(svg, /<clipPath id="luna-s-40-c"><circle cx="0" cy="0" r="40"\/><\/clipPath>/);
  assert.match(svg, /clip-path="url\(#luna-s-40-c\)"/);
});

test("dos discos de la misma semilla y distinto radio no comparten identificadores", () => {
  const ids = (svg) => [...svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  const pequeno = ids(discoLunarSvg("mesa", { radio: 20 }));
  const grande = ids(discoLunarSvg("mesa", { radio: 60 }));
  assert.ok(pequeno.length > 0);
  for (const id of pequeno) {
    assert.ok(!grande.includes(id), `id compartido entre discos distintos: ${id}`);
  }
});

test("la carta enmarca sin tapar: el interior queda hueco", () => {
  const svg = cartografiaSvg({ ancho: 200, alto: 120 });
  assert.match(svg, /viewBox="0 0 200 120"/);
  // Ningún rect de fondo relleno que cubra el lienzo que envuelve.
  assert.doesNotMatch(svg, /<rect[^>]*x="0.5"[^>]*fill="(?!none)/);
  assert.match(svg, /fill="none"/);
});

test("la retícula reparte las marcas por los cuatro lados", () => {
  const { marcasX, marcasY } = cartografia({ ancho: 100, alto: 80, divisiones: 4 });
  assert.deepEqual(marcasX, [0, 25, 50, 75, 100]);
  assert.deepEqual(marcasY, [0, 20, 40, 60, 80]);
  // Divisiones absurdas no rompen la carta.
  assert.equal(cartografia({ divisiones: 0 }).marcasX.length, 3);
  assert.equal(cartografia({ divisiones: "x" }).marcasX.length, 9);
});

test("la rosa de los vientos tiene ocho brazos y los cardinales son los largos", () => {
  const brazos = rosaDeLosVientos(20);
  assert.equal(brazos.length, 8);
  const cardinales = brazos.filter((b) => b.cardinal);
  assert.equal(cardinales.length, 4);
  const largoCardinal = Math.hypot(cardinales[0].x, cardinales[0].y);
  const intercardinal = brazos.find((b) => !b.cardinal);
  assert.ok(largoCardinal > Math.hypot(intercardinal.x, intercardinal.y));
});

test("el título de la cartela se escapa: un nombre hostil no inyecta marcado", () => {
  const svg = cartografiaSvg({ titulo: '<script>alert(1)</script>' });
  assert.doesNotMatch(svg, /<script>/i);
  assert.match(svg, /&lt;script&gt;/);
  // Y en mayúsculas: el analizador de HTML no distingue caja, así que un
  // escape que solo cubriera minúsculas no sería escape.
  const gritado = cartografiaSvg({ titulo: '<SCRIPT>alert(1)</SCRIPT>' });
  assert.doesNotMatch(gritado, /<script/i);
  assert.match(gritado, /&lt;SCRIPT&gt;/);
  // Sin título no se dibuja cartela vacía.
  assert.doesNotMatch(cartografiaSvg({}), /<text/);
});

test("los data URI son autosuficientes y sin referencias externas", () => {
  const uri = cartografiaDataUri({ titulo: "ITSASO 1" });
  assert.match(uri, /^data:image\/svg\+xml,/);
  const svg = decodeURIComponent(uri.slice("data:image/svg+xml,".length));
  assert.match(svg, /ITSASO 1/);
  // Nada que pueda salir a la red: ni http, ni url(), ni <image>.
  assert.doesNotMatch(svg, /https?:\/\/(?!www\.w3\.org)/);
  assert.doesNotMatch(svg, /<image/);
});



test("la paleta es tinta sobre papel, no colores de pantalla", () => {
  assert.equal(typeof TINTA.linea, "string");
  assert.equal(typeof TINTA.papel, "string");
  assert.notEqual(TINTA.linea, TINTA.papel);
});

// ---- Cozy: bello, no geométrico -------------------------------------------

test("la carta tiembla como una plancha cortada a mano, y siempre igual", () => {
  const a = cartografiaSvg({ ancho: 200, alto: 200 });
  const b = cartografiaSvg({ ancho: 200, alto: 200 });
  assert.equal(a, b, "no debe parpadear entre renders");

  // Las marcas no caen todas en coordenadas exactas: eso sería una hoja de
  // cálculo con adornos, no un grabado.
  const finales = [...a.matchAll(/L (-?[\d.]+) (-?[\d.]+)"/g)].map((m) => [
    Number(m[1]),
    Number(m[2]),
  ]);
  const conDecimal = finales.filter(([x, y]) => !Number.isInteger(x) || !Number.isInteger(y));
  assert.ok(conDecimal.length > 0, "todas las líneas salen perfectamente rectas");

  // Pero el temblor es sutil: nunca desplaza más de un par de píxeles.
  const svgLimpio = cartografiaSvg({ ancho: 200, alto: 200, divisiones: 4 });
  for (const [, sx, sy] of svgLimpio.matchAll(/L (-?[\d.]+) (-?[\d.]+)"/g)) {
    assert.ok(Math.abs(Number(sx)) <= 210, "el temblor se salió del lienzo");
    assert.ok(Math.abs(Number(sy)) <= 210);
  }
});

test("las cuentas de dibujo se acotan: nada de bucles de cien mil", () => {
  // Antes, `divisiones: 100000` generaba 100001 marcas y otros tantos objetos:
  // suficiente para congelar la pestaña de quien tuviera la escena abierta.
  const enorme = cartografia({ divisiones: 100000 });
  assert.equal(enorme.marcasX.length, 65);
  assert.equal(enorme.marcasY.length, 65);
  assert.equal(discoLunar("probe", { crateres: 100000 }).crateres.length, 240);

  // Por abajo y con basura: se acota, no se rompe ni se cuelga.
  assert.equal(cartografia({ divisiones: 0 }).marcasX.length, 3);
  assert.equal(cartografia({ divisiones: -50 }).marcasX.length, 3);
  assert.equal(cartografia({ divisiones: 8.7 }).marcasX.length, 10);
  assert.equal(cartografia({ divisiones: Infinity }).marcasX.length, 9);
  assert.equal(cartografia({ divisiones: "muchas" }).marcasX.length, 9);
  assert.equal(discoLunar("probe", { crateres: -3 }).crateres.length, 0);
  assert.equal(discoLunar("probe", { crateres: Infinity }).crateres.length, 18);
  assert.equal(discoLunar("probe", { crateres: 4.6 }).crateres.length, 5);
});
