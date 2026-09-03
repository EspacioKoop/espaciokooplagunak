import assert from "node:assert/strict";
import test from "node:test";

import { crearRig, deformarMalla, normalizarPesos } from "../scripts/rig-esqueleto.mjs";
import { ErrorDeRetargeting, mapeoPorId, retargetPose } from "../scripts/retargeting-pose.mjs";

/** Dos brazos con la MISMA nomenclatura y proporciones DISTINTAS: el criterio
 *  de salida de la fase 3 es que una pose hecha para uno se doble por donde
 *  toca en el otro. */
function mallaBrazo(largoBrazo, largoAntebrazo) {
  const y0 = 0;
  const y1 = largoBrazo;
  const y2 = largoBrazo + largoAntebrazo;
  return Object.freeze({
    vertices: [
      [-0.1, y0, -0.1], [0.1, y0, -0.1], [0.1, y0, 0.1], [-0.1, y0, 0.1],
      [-0.1, y1, -0.1], [0.1, y1, -0.1], [0.1, y1, 0.1], [-0.1, y1, 0.1],
      [-0.1, y2, -0.1], [0.1, y2, -0.1], [0.1, y2, 0.1], [-0.1, y2, 0.1],
    ],
    caras: [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11]],
  });
}

function rigBrazo(largoBrazo) {
  return crearRig([
    { id: "brazo", cabeza: [0, 0, 0] },
    { id: "antebrazo", padre: "brazo", cabeza: [0, largoBrazo, 0] },
  ]);
}

function pesosBrazo(rig) {
  return normalizarPesos(
    rig,
    [
      ...Array.from({ length: 4 }, () => [{ hueso: "brazo", peso: 1 }]),
      ...Array.from({ length: 4 }, () => [
        { hueso: "brazo", peso: 0.5 },
        { hueso: "antebrazo", peso: 0.5 },
      ]),
      ...Array.from({ length: 4 }, () => [{ hueso: "antebrazo", peso: 1 }]),
    ],
    12,
  );
}

const RIG_VENUS = rigBrazo(1); // brazo de 1 m, «origen».
const RIG_NPC = rigBrazo(1.5); // brazo de 1.5 m, proporciones distintas.
const MALLA_NPC = mallaBrazo(1.5, 1.5);

const POSE_ORIGEN = { antebrazo: { eje: [0, 0, 1], angulo: Math.PI / 2 } };

function manoDe(vertices) {
  const cuatro = vertices.slice(8, 12);
  return [0, 1, 2].map((eje) => cuatro.reduce((suma, v) => suma + v[eje], 0) / 4);
}

test("mapeoPorId empareja huesos de mismo id entre rigs de proporciones distintas", () => {
  const mapeo = mapeoPorId(RIG_VENUS, RIG_NPC);
  assert.deepEqual(mapeo, { brazo: "brazo", antebrazo: "antebrazo" });
});

test("una pose retargeted dobla el codo del rig destino, con sus propias proporciones", () => {
  const mapeo = mapeoPorId(RIG_VENUS, RIG_NPC);
  const poseDestino = retargetPose(RIG_VENUS, POSE_ORIGEN, RIG_NPC, mapeo);

  const pesos = pesosBrazo(RIG_NPC);
  const deformada = deformarMalla(MALLA_NPC, RIG_NPC, pesos, poseDestino);

  for (const v of deformada.vertices) {
    for (const componente of v) assert.ok(Number.isFinite(componente), "sin NaN/Infinity");
  }
  assert.equal(deformada.caras, MALLA_NPC.caras, "la topología no cambia");

  // El codo del rig destino está a y=1.5, no a y=1: si el retargeting hubiera
  // copiado geometría en vez de solo el giro, la mano acabaría en el sitio
  // equivocado para ESTAS proporciones.
  const mano = manoDe(deformada.vertices);
  assert.ok(mano[0] < -0.01, `la mano gira hacia -x: ${mano}`);
  const recta = deformarMalla(MALLA_NPC, RIG_NPC, pesos, {});
  const manoRecta = manoDe(recta.vertices);
  assert.ok(mano[1] < manoRecta[1] - 0.1, "la mano sube menos que en reposo: el codo se dobló");
});

test("una pose parcial en el mapeo se traduce parcial: lo no mapeado se ignora", () => {
  const poseDestino = retargetPose(RIG_VENUS, POSE_ORIGEN, RIG_NPC, {}); // mapeo vacío
  assert.deepEqual(poseDestino, {});
});

test("un mapeo que apunta a un hueso inexistente en destino falla, no se ignora en silencio", () => {
  assert.throws(
    () => retargetPose(RIG_VENUS, POSE_ORIGEN, RIG_NPC, { antebrazo: "mano_fantasma" }),
    ErrorDeRetargeting,
  );
});

test("un mapeo que nombra un hueso inexistente en origen falla", () => {
  assert.throws(
    () => retargetPose(RIG_VENUS, POSE_ORIGEN, RIG_NPC, { codo_fantasma: "antebrazo" }),
    ErrorDeRetargeting,
  );
});

test("mapeo debe ser un objeto plano", () => {
  assert.throws(() => retargetPose(RIG_VENUS, POSE_ORIGEN, RIG_NPC, ["antebrazo"]), ErrorDeRetargeting);
  assert.throws(() => retargetPose(RIG_VENUS, POSE_ORIGEN, RIG_NPC, null), ErrorDeRetargeting);
});

test("un hueso llamado __proto__ sobrevive a mapeoPorId, no se pierde en el prototipo", () => {
  const origen = crearRig([{ id: "__proto__", cabeza: [0, 0, 0] }]);
  const destino = crearRig([{ id: "__proto__", cabeza: [0, 0, 0] }]);
  const mapeo = mapeoPorId(origen, destino);
  assert.deepEqual(Object.keys(mapeo), ["__proto__"]);
  assert.equal(mapeo.__proto__, "__proto__");
});

test("un hueso de pose llamado toString, sin mapeo, se ignora en vez de crear una entrada fantasma", () => {
  const origen = crearRig([{ id: "toString", cabeza: [0, 0, 0] }]);
  const destino = crearRig([{ id: "antebrazo", cabeza: [0, 0, 0] }]);
  const poseDestino = retargetPose(origen, { toString: { eje: [0, 0, 1], angulo: 1 } }, destino, {});
  assert.deepEqual(Object.keys(poseDestino), []);
});
