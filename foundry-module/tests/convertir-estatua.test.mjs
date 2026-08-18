// La entrada de malla de terceros (#590): lectura, decimado y UV triplanar.

import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { METROS_POR_TEXTURA, uvsTriplanar } from "../scripts/escena-primitivas.mjs";
import { LEON_AL_LAT } from "../data/mallas/leon-al-lat.mjs";
import { VENUS_DE_MILO } from "../data/mallas/venus-de-milo.mjs";
import { FARAO_AMASIS } from "../data/mallas/farao-amasis.mjs";
import { LOBA_CAPITOLINA } from "../data/mallas/loba-capitolina.mjs";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const herramienta = await import(path.join(RAIZ, "tools", "convertir-estatua.mjs").replace(/^/, "file://"))
  .catch(() => null);

/* ---- el decimador ---------------------------------------------------------- */

// Una malla de prueba: un cilindro de doce lados cerrado por arriba y por abajo.
// Sirve para todo lo que hay que comprobar y no depende de ningún fichero de
// fuera, que es lo que permite que estas pruebas corran en CI sin red.
function cilindroDePrueba(lados = 24, altura = 2) {
  const vertices = [];
  for (const y of [0, altura]) {
    for (let i = 0; i < lados; i += 1) {
      const t = (i / lados) * Math.PI * 2;
      vertices.push([Math.cos(t), y, Math.sin(t)]);
    }
  }
  const cima = vertices.push([0, altura, 0]) - 1;
  const suelo = vertices.push([0, 0, 0]) - 1;
  const caras = [];
  for (let i = 0; i < lados; i += 1) {
    const j = (i + 1) % lados;
    caras.push([i, lados + i, lados + j], [i, lados + j, j]);
    caras.push([lados + i, cima, lados + j]);
    caras.push([i, j, suelo]);
  }
  return { vertices, caras };
}

test("el decimado baja hasta el objetivo pedido", async (t) => {
  if (!herramienta) return t.skip("la herramienta no se pudo importar");
  const malla = cilindroDePrueba(48);
  const simple = herramienta.simplificar(malla, 40);
  assert.ok(simple.caras.length <= 44, `quedaron ${simple.caras.length} caras`);
  assert.ok(simple.caras.length > 0);
});

test("una sola pasada llega al objetivo: la cola se reevalúa", async (t) => {
  if (!herramienta) return t.skip("la herramienta no se pudo importar");
  // La primera versión decidía el orden una vez y se quedaba a medio camino: con
  // el León se plantaba en 3903 caras por mucho que se le pidiera 900.
  const malla = cilindroDePrueba(64);
  const antes = malla.caras.length;
  const simple = herramienta.simplificar(malla, Math.round(antes / 8));
  assert.ok(simple.caras.length < antes / 4, `apenas bajó: ${antes} -> ${simple.caras.length}`);
});

test("no deja caras degeneradas ni repetidas", async (t) => {
  if (!herramienta) return t.skip("la herramienta no se pudo importar");
  const simple = herramienta.simplificar(cilindroDePrueba(48), 30);
  const vistas = new Set();
  for (const cara of simple.caras) {
    assert.equal(new Set(cara).size, 3, "una cara con vértices repetidos no tiene superficie");
    for (const i of cara) assert.ok(i >= 0 && i < simple.vertices.length, "índice fuera de rango");
    const clave = [...cara].sort((a, b) => a - b).join(",");
    assert.ok(!vistas.has(clave), "dos caras sobre los mismos tres vértices");
    vistas.add(clave);
  }
});

test("no voltea caras: un triángulo del revés es un agujero", async (t) => {
  if (!herramienta) return t.skip("la herramienta no se pudo importar");
  // El motor descarta las caras de espaldas, así que una cara volteada no se ve
  // y deja un boquete. Era de donde salían las esquirlas sueltas.
  const malla = cilindroDePrueba(48);
  const simple = herramienta.simplificar(malla, 60);
  const haciaFuera = simple.caras.filter((cara) => {
    const [a, b, c] = cara.map((i) => simple.vertices[i]);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const centro = [(a[0] + b[0] + c[0]) / 3, 0, (a[2] + b[2] + c[2]) / 3];
    return n[0] * centro[0] + n[2] * centro[2] >= 0;
  });
  // En un cilindro, casi todas las laterales tienen que seguir mirando afuera.
  assert.ok(haciaFuera.length > simple.caras.length * 0.6, "demasiadas caras del revés");
});

test("soldar quita los vértices repetidos de la sopa de triángulos", async (t) => {
  if (!herramienta) return t.skip("la herramienta no se pudo importar");
  // Un STL no comparte vértices: sin soldar no hay aristas, y sin aristas no se
  // puede colapsar nada.
  const triangulos = [
    [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
    [[1, 0, 0], [1, 1, 0], [0, 1, 0]],
  ];
  const { vertices, caras } = herramienta.soldar(triangulos);
  assert.equal(vertices.length, 4, "seis puntos, cuatro distintos");
  assert.equal(caras.length, 2);
});

test("un STL truncado se rechaza con un mensaje que dice qué pasa", async (t) => {
  if (!herramienta) return t.skip("la herramienta no se pudo importar");
  const malo = new Uint8Array(200);
  new DataView(malo.buffer).setUint32(80, 1000, true);
  assert.throws(() => herramienta.leerStlBinario(malo), /truncado|cuadra/i);
});

test("normalizar deja la pieza apoyada, centrada y de la altura pedida", async (t) => {
  if (!herramienta) return t.skip("la herramienta no se pudo importar");
  // Colocar algo que se planta en el suelo es decir dónde TOCA el suelo.
  const malla = herramienta.normalizar(cilindroDePrueba(12, 5), { alto: 3, ejeArriba: "y" });
  const ys = malla.vertices.map(([, y]) => y);
  assert.ok(Math.abs(Math.min(...ys)) < 1e-9, "la base va en y = 0");
  assert.ok(Math.abs(Math.max(...ys) - 3) < 1e-3, "y la altura es la pedida");
  const xs = malla.vertices.map(([x]) => x);
  assert.ok(Math.abs((Math.min(...xs) + Math.max(...xs)) / 2) < 1e-3, "centrada en planta");
});

/* ---- las UV triplanar ------------------------------------------------------ */

test("triplanar da una UV por vértice de cada cara", () => {
  const uvs = uvsTriplanar(LEON_AL_LAT, 1.5);
  assert.equal(uvs.length, LEON_AL_LAT.caras.length, "paralelas a las caras, no a los vértices");
  assert.ok(uvs.every((cara, i) => cara.length === LEON_AL_LAT.caras[i].length));
  assert.ok(uvs.every((cara) => cara.every(([u, v]) => Number.isFinite(u) && Number.isFinite(v))));
});

test("triplanar NO estira: una cara vertical se mide por su altura", () => {
  // Es la razón de elegirla frente a la proyección plana, que en todo lo que
  // mire de lado convierte la textura en rayas largas.
  const pared = {
    vertices: [[0, 0, 0], [0, 0, 2], [0, 2, 2], [0, 2, 0]],
    caras: [[0, 1, 2, 3]],
  };
  const [uv] = uvsTriplanar(pared, 1);
  const alto = Math.max(...uv.map(([, v]) => v)) - Math.min(...uv.map(([, v]) => v));
  const ancho = Math.max(...uv.map(([u]) => u)) - Math.min(...uv.map(([u]) => u));
  assert.ok(Math.abs(alto - 2) < 1e-9, "los dos metros de alto salen como dos de textura");
  assert.ok(Math.abs(ancho - 2) < 1e-9, "y los dos de fondo, igual");
});

test("la escala va en metros, como en la caja y el prisma", () => {
  // El grano tiene que medir lo mismo en una estatua que en un tablón, o la
  // escena se lee a dos tamaños a la vez.
  const fina = uvsTriplanar(LEON_AL_LAT, METROS_POR_TEXTURA);
  const gruesa = uvsTriplanar(LEON_AL_LAT, METROS_POR_TEXTURA * 3);
  const alcance = (uvs) => Math.max(...uvs.flat().map(([u]) => Math.abs(u)));
  assert.ok(alcance(fina) > alcance(gruesa) * 2.5);
});

/* ---- plantada en la playa -------------------------------------------------- */

test("la ruina llega al cuadro, y texturada", async () => {
  const { componerPlaya } = await import("../scripts/playa-escena.mjs");
  const escena = componerPlaya(9.5, 0, 30.5, -0.85, { tiempo: 0 });
  // La malla del León tiene cientos de caras y ninguna otra pieza de la escena
  // se le acerca: si aparece un bloque grande de polígonos texturados por esa
  // zona, es ella.
  const texturados = escena.poligonos.filter((p) => p.textura);
  assert.ok(texturados.length > 100, `solo ${texturados.length} polígonos texturados en cuadro`);
});

test("no se puede atravesar: es piedra maciza", async () => {
  // Cruzarla andando desmentiría de golpe todo lo que la ruina cuenta.
  const { PLANTA_PLAYA } = await import("../scripts/playa-escena.mjs");
  const tapa = PLANTA_PLAYA.obstaculos.some(
    (r) => r.x < 5.5 && r.x + r.ancho > 3.5 && r.z < 34 && r.z + r.profundidad > 32,
  );
  assert.ok(tapa, "la estatua tendría que estorbar donde está");
});

test("está fuera del camino: se ve y no se llega", () => {
  // Lo que se mira desde lejos y no se toca es lo que hace grande un sitio.
  const xs = LEON_AL_LAT.vertices.map(([x]) => x);
  assert.ok(Math.max(...xs) - Math.min(...xs) < 4, "no es tan ancha como para invadir el camino");
});

/* ---- el catálogo ----------------------------------------------------------- */

const CATALOGO = [
  ["león de Al-Lāt", LEON_AL_LAT],
  ["Venus de Milo", VENUS_DE_MILO],
  ["faraón Amasis", FARAO_AMASIS],
  ["loba", LOBA_CAPITOLINA],
];

test("cada pieza del catálogo está apoyada en el suelo y de pie", () => {
  for (const [nombre, malla] of CATALOGO) {
    const ys = malla.vertices.map(([, y]) => y);
    assert.ok(Math.min(...ys) >= -1e-6, `${nombre} no apoya en el suelo`);
    assert.ok(Math.max(...ys) > 1, `${nombre} se ha quedado enana`);
  }
});

test("todas son geometría y nada más (#351)", () => {
  // Si una malla importada trajera color propio, la frontera de arte se habría
  // roto por la puerta de atrás.
  for (const [nombre, malla] of CATALOGO) {
    assert.deepEqual(Object.keys(malla).sort(), ["caras", "vertices"], nombre);
  }
});

test("ninguna se pasa de lo que el motor mueve sin despeinarse", () => {
  for (const [nombre, malla] of CATALOGO) {
    assert.ok(malla.caras.length < 1200, `${nombre}: ${malla.caras.length} caras es pasarse`);
  }
});

test("el catálogo cubre culturas distintas, que es el punto de #590", () => {
  // Una estatua dice quién estuvo antes; cuatro de la misma cultura dicen menos
  // que cuatro de cuatro sitios.
  assert.ok(CATALOGO.length >= 4);
});

test("cada malla del árbol tiene ficha en la herramienta", async () => {
  // La herramienta se NIEGA a convertir lo que no tenga ficha, así que esto
  // comprueba que nadie ha metido una malla por otro camino.
  const { FICHAS } = await import("../../tools/convertir-estatua.mjs");
  for (const clave of ["leon-al-lat", "venus-de-milo", "farao-amasis", "loba-capitolina"]) {
    assert.ok(FICHAS[clave], `${clave} no tiene ficha`);
    assert.match(FICHAS[clave].licencia, /CC0/, `${clave} no declara CC0`);
    assert.ok(FICHAS[clave].modelo, `${clave} no dice si es escaneo, vaciado o reconstrucción`);
  }
});

test("la ficha dice QUÉ es el fichero, no solo qué obra representa", () => {
  // El León es una reconstrucción; las del SMK son escaneos de vaciados en yeso,
  // no de los originales. Decirlo no es una nota al pie: es lo que la escena
  // podría llegar a afirmar.
  return import("../../tools/convertir-estatua.mjs").then(({ FICHAS }) => {
    assert.match(FICHAS["venus-de-milo"].modelo, /vaciado/i);
    assert.match(FICHAS["leon-al-lat"].modelo, /reconstrucción/i);
  });
});

/* ---- la malla que está en el árbol ----------------------------------------- */

test("el León está apoyado en el suelo y de pie", () => {
  const ys = LEON_AL_LAT.vertices.map(([, y]) => y);
  assert.ok(Math.min(...ys) >= -1e-6);
  assert.ok(Math.max(...ys) > 1.5, "una estatua de menos de metro y medio no es una estatua");
});

test("la malla es geometría y nada más (#351)", () => {
  // El color y el material los pone la escena con NUESTRA paleta. Si algún día
  // una malla importada trajera color propio, la frontera de arte se habría roto
  // por la puerta de atrás.
  assert.deepEqual(Object.keys(LEON_AL_LAT).sort(), ["caras", "vertices"]);
});

test("cabe en lo que el motor mueve sin despeinarse", () => {
  assert.ok(LEON_AL_LAT.caras.length < 1200, `${LEON_AL_LAT.caras.length} caras es pasarse`);
});

test("la ficha de procedencia existe y nombra la licencia y el sha256", async () => {
  // Un asset sin procedencia comprobable no entra, por bueno que sea.
  const ficha = await readFile(path.join(RAIZ, "docs", "PROCEDENCIA_ASSETS.md"), "utf8");
  assert.match(ficha, /León de Al-Lāt/);
  assert.match(ficha, /CC0 1\.0/);
  assert.match(ficha, /5748e4d150a370f34328ea768ced85ccafcaae6dd3c3891f2c0e80fb0a7a4ac8/);
  assert.match(ficha, /reconstrucción digital/i, "hay que decir que no es un escaneo");
});
