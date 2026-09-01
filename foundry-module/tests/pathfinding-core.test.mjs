import assert from "node:assert/strict";
import test from "node:test";

import {
  astar,
  bloqueada,
  caminoDirecto,
  crearGrid,
  dentro,
  obstaculosDesdeCajas,
  suavizarCamino,
  vecinos,
} from "../scripts/pathfinding-core.mjs";

test("crearGrid exige dimensiones positivas enteras", () => {
  assert.throws(() => crearGrid(0, 5), RangeError);
  assert.throws(() => crearGrid(5, -1), RangeError);
  assert.throws(() => crearGrid(1.5, 2), RangeError);
});

test("dentro y bloqueada funcionan sobre celdas", () => {
  const grid = crearGrid(3, 3, [{ x: 1, y: 1 }]);
  assert.equal(dentro(grid, 0, 0), true);
  assert.equal(dentro(grid, -1, 0), false);
  assert.equal(bloqueada(grid, 1, 1), true);
  assert.equal(bloqueada(grid, 0, 0), false);
});

test("vecinos: 4-conexos, no entra en obstáculo ni fuera de límites", () => {
  const grid = crearGrid(3, 3, [{ x: 1, y: 1 }]);
  const v = vecinos(grid, 1, 0);
  assert.deepEqual(v.map((n) => `${n.x},${n.y}`), ["2,0", "0,0"]);
});

test("astar: camino recto cuando no hay obstáculos", () => {
  const grid = crearGrid(3, 3);
  const camino = astar(grid, { x: 0, y: 0 }, { x: 2, y: 0 });
  assert.ok(Array.isArray(camino));
  assert.equal(camino.length, 3);
  assert.deepEqual(camino[0], { x: 0, y: 0 });
  assert.deepEqual(camino[camino.length - 1], { x: 2, y: 0 });
});

test("astar: rodea obstáculo y sigue siendo mínimo", () => {
  const grid = crearGrid(4, 4, [
    { x: 1, y: 1 },
    { x: 2, y: 1 },
  ]);
  const camino = astar(grid, { x: 0, y: 1 }, { x: 3, y: 1 });
  assert.ok(Array.isArray(camino));
  assert.equal(camino.length, 6);
  assert.deepEqual(camino[0], { x: 0, y: 1 });
  assert.deepEqual(camino[camino.length - 1], { x: 3, y: 1 });
});

test("astar: devuelve null si inicio o fin están bloqueados", () => {
  const grid = crearGrid(3, 3, [{ x: 0, y: 0 }]);
  assert.equal(astar(grid, { x: 0, y: 0 }, { x: 2, y: 0 }), null);
  assert.equal(astar(grid, { x: 1, y: 1 }, { x: 0, y: 0 }), null);
});

test("astar: devuelve null si no existe camino", () => {
  const grid = crearGrid(3, 3, [
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
  ]);
  assert.equal(astar(grid, { x: 0, y: 0 }, { x: 2, y: 2 }), null);
});

test("suavizarCamino elimina nodos intermedios innecesarios", () => {
  const camino = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 3, y: 0 },
  ];
  const suavizado = suavizarCamino(crearGrid(5, 5), camino);
  assert.deepEqual(suavizado, [
    { x: 0, y: 0 },
    { x: 3, y: 0 },
  ]);
});

test("suavizarCamino puede compactar rutas cortas sin perder nodos válidos", () => {
  const grid = crearGrid(3, 3, [{ x: 1, y: 1 }]);
  const camino = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 1 },
    { x: 2, y: 2 },
  ];
  const suavizado = suavizarCamino(grid, camino);
  assert.ok(suavizado.length >= 3);
  assert.deepEqual(suavizado[0], { x: 0, y: 0 });
  assert.deepEqual(suavizado[suavizado.length - 1], { x: 2, y: 2 });
});

test("obstaculosDesdeCajas marca celdas completas de la caja", () => {
  const grid = crearGrid(5, 5);
  const obstaculos = obstaculosDesdeCajas(grid, [{ x: 1.2, z: 0.5, ancho: 1.8, profundidad: 2.4 }]);
  const gridConObs = Object.freeze({ ...grid, obstaculos: Object.freeze(obstaculos) });
  assert.equal(bloqueada(gridConObs, 1, 0), true);
  assert.equal(bloqueada(gridConObs, 2, 0), true);
  assert.equal(bloqueada(gridConObs, 1, 1), true);
  assert.equal(bloqueada(gridConObs, 2, 1), true);
  assert.equal(bloqueada(gridConObs, 3, 1), false);
});
