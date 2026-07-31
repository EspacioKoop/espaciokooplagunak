import assert from "node:assert/strict";
import test from "node:test";

import {
  AJUSTES_EPOCA,
  MALLA_CAZA,
  componerEscena,
  factorNiebla,
  mezclar,
} from "../scripts/retro3d.mjs";
import { PIXEL, canales } from "../scripts/paleta.mjs";

const FONDO = PIXEL.dorsoFondo;

const escena = (opciones = {}) =>
  componerEscena(MALLA_CAZA, { ancho: 160, alto: 120, color: PIXEL.neutro, ...opciones });

/** Distancia media de lo pintado: sirve para saber si algo quedó dentro o fuera. */
const profundidades = (poligonos) => poligonos.map((p) => p.profundidad);

test("mezclar es una interpolación, y los extremos son exactos", () => {
  assert.equal(mezclar("#000000", "#ffffff", 0), "#000000");
  assert.equal(mezclar("#000000", "#ffffff", 1), "#ffffff");
  assert.equal(mezclar("#000000", "#ffffff", 0.5), "#808080");
});

test("mezclar devuelve el color de partida si el otro es ilegible, no un negro silencioso", () => {
  assert.equal(mezclar("#123456", "no-es-un-color", 1), "#123456");
  assert.equal(mezclar("#123456", "#ffffff", Number.NaN), "#123456");
});

test("la niebla no empieza en la cámara: lo que estás mirando no se destiñe", () => {
  const comun = { cerca: 0.1, lejos: 100, niebla: AJUSTES_EPOCA.psx.niebla };
  assert.equal(factorNiebla(1, comun), 0);
  assert.equal(factorNiebla(45, comun), 0); // justo en el umbral, todavía nada
  assert.ok(factorNiebla(70, comun) > 0);
});

test("en el plano lejano la PSX funde del todo y la GameCube se queda a medias", () => {
  const comun = { cerca: 0.1, lejos: 100 };
  assert.equal(factorNiebla(100, { ...comun, niebla: AJUSTES_EPOCA.psx.niebla }), 1);
  assert.equal(factorNiebla(100, { ...comun, niebla: AJUSTES_EPOCA.gamecube.niebla }), 0.5);
  // Y más allá del plano no se pasa de rosca.
  assert.equal(factorNiebla(1e6, { ...comun, niebla: AJUSTES_EPOCA.psx.niebla }), 1);
});

test("la niebla crece con la distancia, sin saltos", () => {
  const comun = { cerca: 0.1, lejos: 100, niebla: AJUSTES_EPOCA.psx.niebla };
  const serie = [50, 60, 70, 80, 90, 100].map((z) => factorNiebla(z, comun));
  for (let i = 1; i < serie.length; i += 1) assert.ok(serie[i] > serie[i - 1]);
});

test("sin fondo declarado no hay niebla: no se tiñe hacia un color inventado", () => {
  const sinFondo = escena({ posicion: [0, 0, 70], lejos: 100 });
  assert.ok(sinFondo.poligonos.length > 0);
  assert.ok(sinFondo.poligonos.every((p) => p.niebla === 0));
  // Y el color sigue siendo el sombreado puro: gris de la nave, sin azul del fondo.
  assert.ok(sinFondo.poligonos.every((p) => canales(p.color)[2] === canales(p.color)[0]));
});

test("con fondo declarado, lo lejano se acerca al color del fondo", () => {
  // La cámara se queda cerca en números absolutos porque a mucha distancia la
  // nave ocupa menos de un píxel y el ajuste a rejilla la borra: lo que importa
  // aquí es la fracción del alcance recorrida, no la cifra.
  const cerca = escena({ posicion: [0, 0, 3], lejos: 12, fondo: FONDO });
  const lejos = escena({ posicion: [0, 0, 11.5], lejos: 12, fondo: FONDO });
  assert.ok(cerca.poligonos.every((p) => p.niebla === 0));
  assert.ok(lejos.poligonos.every((p) => p.niebla > 0.8));
  const [, , azulFondo] = canales(FONDO);
  const [rojoLejos, , azulLejos] = canales(lejos.poligonos[0].color);
  // El casco es blanco: si de lejos tira a azul y pierde rojo, se está fundiendo
  // con el fondo y no simplemente oscureciéndose.
  assert.ok(azulLejos > rojoLejos);
  assert.ok(Math.abs(azulLejos - azulFondo) < 0.2);
});

test("la época decide cuánto se traga la niebla, con la misma cámara", () => {
  const comun = { posicion: [0, 0, 11.5], lejos: 12, fondo: FONDO };
  const psx = escena({ ...comun, epoca: "psx" });
  const cubo = escena({ ...comun, epoca: "gamecube" });
  assert.ok(psx.poligonos[0].niebla > cubo.poligonos[0].niebla);
});

test("más allá del alcance no se pinta nada, y el alcance sale en la escena", () => {
  const dentro = escena({ posicion: [0, 0, 8], lejos: 12 });
  const fuera = escena({ posicion: [0, 0, 300], lejos: 12 });
  assert.ok(dentro.poligonos.length > 0);
  assert.deepEqual(fuera.poligonos, []);
  assert.equal(fuera.lejos, 12);
});

test("una cara que asoma por un extremo se ve: el recorte mide por el vértice más cercano", () => {
  // La nave se coloca justo a caballo del plano lejano. Si el descarte usara la
  // media, la mitad delantera desaparecería de golpe, que es el artefacto que la
  // niebla existe para evitar.
  const alBorde = escena({ posicion: [0, 0, 12.6], lejos: 12 });
  assert.ok(alBorde.poligonos.length > 0);
  // Su centro cae YA FUERA del alcance y aun así se pinta: sobrevive por el
  // extremo que sigue dentro, que es justo la diferencia entre las dos reglas.
  assert.ok(Math.max(...profundidades(alBorde.poligonos)) > 12);
});

test("un alcance imposible se corrige y no propaga un volumen vacío", () => {
  const rota = escena({ posicion: [0, 0, 6], cerca: 5, lejos: 1, fondo: FONDO });
  assert.equal(rota.lejos, 10);
  assert.ok(Number.isFinite(rota.poligonos[0]?.niebla));
});
