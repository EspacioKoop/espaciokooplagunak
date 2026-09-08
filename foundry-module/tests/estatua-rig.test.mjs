import assert from "node:assert/strict";
import test from "node:test";

import { deformarPieza } from "../scripts/estatua-rig.mjs";

// Brazo de prueba: dos tramos en +y, sección en xz. Misma geometría que las
// fases 1 y 2, para reusar el criterio de «se dobla con gradiente».
const MALLA = {
  vertices: [
    [-0.1, 0, -0.1], [0.1, 0, -0.1], [0.1, 0, 0.1], [-0.1, 0, 0.1],
    [-0.1, 1, -0.1], [0.1, 1, -0.1], [0.1, 1, 0.1], [-0.1, 1, 0.1],
    [-0.1, 2, -0.1], [0.1, 2, -0.1], [0.1, 2, 0.1], [-0.1, 2, 0.1],
  ],
  caras: [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11]],
};
const RIG = [
  { id: "brazo", cabeza: [0, 0, 0] },
  { id: "antebrazo", padre: "brazo", cabeza: [0, 1, 0] },
];
// Pesos: abajo pesa por el brazo, arriba por el antebrazo, con solape en la
// unión (blend, no tajo).
const PESOS = [
  [{ hueso: "brazo", peso: 1 }],
  [{ hueso: "brazo", peso: 1 }],
  [{ hueso: "brazo", peso: 1 }],
  [{ hueso: "brazo", peso: 1 }],
  [{ hueso: "brazo", peso: 0.5 }, { hueso: "antebrazo", peso: 0.5 }],
  [{ hueso: "brazo", peso: 0.5 }, { hueso: "antebrazo", peso: 0.5 }],
  [{ hueso: "brazo", peso: 0.5 }, { hueso: "antebrazo", peso: 0.5 }],
  [{ hueso: "brazo", peso: 0.5 }, { hueso: "antebrazo", peso: 0.5 }],
  [{ hueso: "antebrazo", peso: 1 }],
  [{ hueso: "antebrazo", peso: 1 }],
  [{ hueso: "antebrazo", peso: 1 }],
  [{ hueso: "antebrazo", peso: 1 }],
];

const CASI = 1e-6;

/** Centro de un anillo de cuatro vértices (la sección tiene grosor). */
function centro(vertices, desde) {
  const cuatro = vertices.slice(desde, desde + 4);
  return [0, 1, 2].map((eje) => cuatro.reduce((s, v) => s + v[eje], 0) / 4);
}

test("deformarPieza en reposo devuelve la malla igual (no cambia el aspecto)", () => {
  const out = deformarPieza(MALLA, { rig: RIG, pesos: PESOS });
  assert.equal(out.vertices.length, MALLA.vertices.length);
  for (let v = 0; v < MALLA.vertices.length; v += 1) {
    for (let e = 0; e < 3; e += 1) {
      assert.ok(Math.abs(out.vertices[v][e] - MALLA.vertices[v][e]) < CASI, `vértice ${v} movido en reposo`);
    }
  }
  assert.deepEqual(out.caras, MALLA.caras);
});

test("deformarPieza dobla el antebrazo con gradiente (criterio fase 4)", () => {
  const doblada = deformarPieza(MALLA, {
    rig: RIG,
    pesos: PESOS,
    pose: { antebrazo: { eje: [0, 0, 1], angulo: Math.PI / 2 } },
  });
  const manoAntes = centro(MALLA.vertices, 8);
  const mano = centro(doblada.vertices, 8);
  const hombroAntes = centro(MALLA.vertices, 0);
  const hombro = centro(doblada.vertices, 0);
  const dxMano = mano[0] - manoAntes[0];
  const dxHombro = hombro[0] - hombroAntes[0];
  // La mano se va a -x (el codo es el pivote) y se mueve más que el hombro:
  // hay un gradiente a lo largo del brazo, no un tajo ni un amasijo.
  assert.ok(dxMano < -0.3, `la mano no fue a -x (dx=${dxMano})`);
  assert.ok(Math.abs(dxMano) > Math.abs(dxHombro), "el hombro se mueve más que la mano");
  assert.ok(doblada.vertices.every((v) => v.every(Number.isFinite)), "hay NaNs");
  assert.deepEqual(doblada.caras, MALLA.caras, "la topología cambió");
});

test("deformarPieza con un rig roto falla como cabía (no silencia)", () => {
  assert.throws(
    () => deformarPieza(MALLA, {
      rig: [{ id: "x", cabeza: [0, 0, 0] }],
      pesos: PESOS,
    }),
    /no existe el hueso|sin hueso|influencias/,
  );
});
