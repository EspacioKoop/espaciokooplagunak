// El criterio de salida de #603 sobre una malla DE VERDAD (fase 4).
//
// POR QUÉ HACÍA FALTA ESTE FICHERO. La fase 1 declaró un criterio de salida
// exacto —«una malla con un rig hecho a mano se dobla por el codo y se dibuja
// bien»— y lo comprobó sobre un brazo sintético: doce vértices, tres caras, dos
// huesos, dos unidades de largo. `estatua-rig.test.mjs` (fase 4) heredó esa
// misma geometría. La fase 2 sí toca la Venus, pero con DOS huesos y sin
// preguntar por lo que aquí se mide, y su propio comentario dice que «la
// partición limpia necesita un esqueleto completo (fase 3/4)». O sea: hasta
// ahora nadie había pasado una cadena de cuatro huesos por una malla escaneada
// y decimada, que es el único sitio donde se sabe si esto aguanta.
//
// Aguantó, y de paso enseñó el fallo que arregla el umbral de
// `tools/pesar-despiezar.mjs`: los pies de la estatua resbalaban al inclinar el
// pecho. Las cifras de esa medida están en la cabecera de esa constante.
//
// ESTO NO CAMBIA EL MUSEO. Ninguna pieza de `museo-piezas.mjs` declara `rig`, y
// esta prueba no se lo añade: monta el rig aquí, sobre la malla, y mide. Una
// estatua escaneada que se enseña en una POSE que el original no tiene diría
// «así era» de una forma que la cartela no puede desmentir, y esa es justo la
// mentira contra la que #598 puso el campo `naturaleza`. El primer consumidor
// que se pinte en pantalla no debería ser una pieza de museo.

import assert from "node:assert/strict";
import test from "node:test";

import { VENUS_DE_MILO } from "../data/mallas/venus-de-milo.mjs";
import { crearRig } from "../scripts/rig-esqueleto.mjs";
import { deformarPieza } from "../scripts/estatua-rig.mjs";
import { pesosAutomaticos } from "../../tools/pesar-despiezar.mjs";

// Cadena vertical de cuatro huesos sobre la figura, que viene normalizada a 2 m
// de alto y centrada en xz. Las cotas salen del perfil de la propia malla, no de
// una anatomía inventada: se reparte el eje en tramos con vértices en todos.
const HUESOS = Object.freeze([
  { id: "base", cabeza: [0, 0, 0] },
  { id: "caderas", padre: "base", cabeza: [0, 0.9, 0] },
  { id: "pecho", padre: "caderas", cabeza: [0, 1.35, 0] },
  { id: "cabeza", padre: "pecho", cabeza: [0, 1.7, 0] },
]);

/** Pesos automáticos de la fase 2 en la forma que `deformarPieza` espera. */
function definicion(pose) {
  const rig = crearRig(HUESOS);
  const normalizados = pesosAutomaticos(VENUS_DE_MILO, rig);
  const pesos = normalizados.map((influencias) => influencias.map(({ indice, peso }) => ({
    hueso: rig.huesos[indice].id,
    peso,
  })));
  return { rig: HUESOS, pesos, pose };
}

/** Índice del vértice más alto: la coronilla, que es lo que más viaja al girar. */
const CORONILLA = VENUS_DE_MILO.vertices.reduce(
  (mejor, v, i) => (v[1] > VENUS_DE_MILO.vertices[mejor][1] ? i : mejor),
  0,
);

/** Los vértices que apoyan: por debajo de 5 cm sobre la peana. */
const APOYO = VENUS_DE_MILO.vertices
  .map((v, i) => (v[1] < 0.05 ? i : -1))
  .filter((i) => i >= 0);

/** Área de un triángulo por el módulo del producto vectorial. */
function area(malla, cara) {
  const [a, b, c] = cara.map((i) => malla.vertices[i]);
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  return Math.hypot(
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ) / 2;
}

test("la malla de la Venus llega como la prueba supone", () => {
  // Si la conversión cambia el decimado o la normalización, lo que mide el resto
  // del fichero deja de significar lo que dice. Mejor que falle aquí.
  assert.equal(VENUS_DE_MILO.vertices.length, 448);
  assert.ok(VENUS_DE_MILO.caras.every((c) => c.length === 3), "la malla no es de triángulos");
  const alto = Math.max(...VENUS_DE_MILO.vertices.map((v) => v[1]));
  assert.ok(Math.abs(alto - 2) < 1e-9, `la figura no mide 2 m (${alto})`);
  assert.ok(APOYO.length > 0, "no hay vértices de apoyo");
});

test("en reposo la estatua no se mueve ni un float", () => {
  // El reposo declarado solo por traslación (fase 1) tiene que dar identidad
  // EXACTA, no aproximada: si aquí hay deriva, el museo cambiaría de aspecto por
  // el mero hecho de declarar un rig.
  const out = deformarPieza(VENUS_DE_MILO, definicion({}));
  let deriva = 0;
  for (let v = 0; v < VENUS_DE_MILO.vertices.length; v += 1) {
    for (let e = 0; e < 3; e += 1) {
      deriva = Math.max(deriva, Math.abs(out.vertices[v][e] - VENUS_DE_MILO.vertices[v][e]));
    }
  }
  assert.ok(deriva < 1e-12, `deriva en reposo: ${deriva}`);
  assert.deepEqual(out.caras, VENUS_DE_MILO.caras);
});

test("los pies quedan CLAVADOS al inclinar el pecho", () => {
  // El fallo que encontró esta prueba. Una estatua sobre un pedestal cuyos pies
  // resbalan seis centímetros no se lee como una atenuación de los pesos: se lee
  // como que la estatua flota. El umbral relativo de `pesar-despiezar.mjs` es lo
  // que lo sostiene, así que esta aserción es su guarda.
  const doblada = deformarPieza(VENUS_DE_MILO, definicion({
    pecho: { eje: [0, 0, 1], angulo: Math.PI / 4 },
  }));
  for (const i of APOYO) {
    const dx = Math.hypot(
      doblada.vertices[i][0] - VENUS_DE_MILO.vertices[i][0],
      doblada.vertices[i][2] - VENUS_DE_MILO.vertices[i][2],
    );
    assert.ok(dx < 1e-9, `el pie ${i} resbaló ${dx.toFixed(4)} m`);
  }
});

test("dobla con gradiente a lo largo de la figura", () => {
  const doblada = deformarPieza(VENUS_DE_MILO, definicion({
    pecho: { eje: [0, 0, 1], angulo: Math.PI / 4 },
  }));
  const dxCoronilla = doblada.vertices[CORONILLA][0] - VENUS_DE_MILO.vertices[CORONILLA][0];
  // Se va a -x (el pecho es el pivote) y de forma apreciable: medido, 0,42 m.
  assert.ok(dxCoronilla < -0.3, `la coronilla no se inclinó (dx=${dxCoronilla})`);
  // Y por encima del pivote el desplazamiento CRECE con la altura: es una
  // inclinación, no un empujón en bloque ni un tajo por encima del pecho.
  const alturas = [1.5, 1.7, 1.9];
  const desvio = (y) => {
    const cerca = VENUS_DE_MILO.vertices
      .map((v, i) => ({ v, i }))
      .filter(({ v }) => Math.abs(v[1] - y) < 0.15);
    return cerca.reduce((s, { v, i }) => s + (doblada.vertices[i][0] - v[0]), 0) / cerca.length;
  };
  const arriba = alturas.map(desvio);
  for (let t = 1; t < arriba.length; t += 1) {
    assert.ok(
      arriba[t] < arriba[t - 1],
      `el tramo a ${alturas[t]} m no se inclina más que el de abajo (${arriba.join(", ")})`,
    );
  }
  // Y por DEBAJO del pivote apenas se mueve. No es cero —girar alrededor de un
  // punto manda lo que hay debajo al lado contrario, y eso es LBS funcionando,
  // no un fallo—, pero tiene que ser un residuo de centímetros frente a los
  // 42 cm de la coronilla, o el rig estaría moviendo la figura entera.
  for (const y of [0.3, 0.7, 1.1]) {
    assert.ok(
      Math.abs(desvio(y)) < 0.05,
      `el tramo a ${y} m se movió ${desvio(y).toFixed(3)} m, y está bajo el pivote`,
    );
  }
});

test("ninguna cara colapsa ni se invierte con una inclinación de uso", () => {
  // Lo que de verdad se preguntaba #603 antes de apostar los personajes a esto:
  // si la deformación por huesos sobrevive a un decimado agresivo o si revienta
  // la malla. 20° es una inclinación de pose creíble.
  const doblada = deformarPieza(VENUS_DE_MILO, definicion({
    pecho: { eje: [0, 0, 1], angulo: (20 * Math.PI) / 180 },
  }));
  assert.ok(doblada.vertices.every((v) => v.every(Number.isFinite)), "hay NaNs");
  assert.deepEqual(doblada.caras, VENUS_DE_MILO.caras, "la topología cambió");
  let peor = 1;
  for (const cara of VENUS_DE_MILO.caras) {
    const antes = area(VENUS_DE_MILO, cara);
    if (antes < 1e-9) continue;
    peor = Math.min(peor, area(doblada, cara) / antes);
  }
  // Medido: la peor cara conserva el 56 % de su área. Una cara que se quedara
  // casi sin área es un triángulo de canto, que con color plano por cara se ve
  // como un agujero.
  assert.ok(peor > 0.4, `una cara perdió casi toda su área (ratio ${peor.toFixed(3)})`);
});
