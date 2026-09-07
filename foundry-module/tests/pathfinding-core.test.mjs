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

/** Todo par consecutivo de un camino suavizado debe tener línea directa real. */
function segmentosValidos(grid, camino) {
  for (let i = 0; i < camino.length - 1; i++) {
    if (!caminoDirecto(grid, camino[i], camino[i + 1])) return false;
  }
  return true;
}

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

test("obstaculosDesdeCajas recorta una caja parcialmente fuera del grid, no la descarta", () => {
  const grid = crearGrid(5, 5);
  // La caja empieza dentro (x=3) y se sale por la derecha (hasta x=7, fuera de anchoCeldas=5).
  const obstaculos = obstaculosDesdeCajas(grid, [{ x: 3, z: 1, ancho: 4, profundidad: 1 }]);
  assert.ok(obstaculos.has("3,1"), "la parte dentro del grid se marca");
  assert.ok(obstaculos.has("4,1"), "la última celda válida también se marca");
  assert.ok(![...obstaculos].some((c) => Number(c.split(",")[0]) >= grid.anchoCeldas), "nada fuera de rango entra en el conjunto");
});

test("crearGrid: el conjunto de obstáculos es de verdad inmutable, no solo Object.freeze superficial", () => {
  const grid = crearGrid(3, 3, [{ x: 1, y: 1 }]);
  assert.throws(() => grid.obstaculos.add("0,0"), TypeError);
  assert.throws(() => grid.obstaculos.delete("1,1"), TypeError);
  // Y sigue funcionando con normalidad para lectura.
  assert.equal(grid.obstaculos.has("1,1"), true);
  assert.equal(bloqueada(grid, 1, 1), true);
});

test("caminoDirecto no permite cortar la esquina entre dos obstáculos diagonales", () => {
  // (1,0) y (0,1) bloqueados: la diagonal de (0,0) a (1,1) pasa exactamente
  // por el punto donde se tocan sus esquinas.
  const grid = crearGrid(3, 3, [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
  ]);
  assert.equal(caminoDirecto(grid, { x: 0, y: 0 }, { x: 1, y: 1 }), false);
});

test("caminoDirecto sí permite la diagonal si solo una esquina está bloqueada", () => {
  const grid = crearGrid(3, 3, [{ x: 1, y: 0 }]);
  assert.equal(caminoDirecto(grid, { x: 0, y: 0 }, { x: 1, y: 1 }), true);
});

test("caminoDirecto rechaza un destino bloqueado aunque el trazado hasta él esté libre", () => {
  const grid = crearGrid(3, 1, [{ x: 2, y: 0 }]);
  assert.equal(caminoDirecto(grid, { x: 0, y: 0 }, { x: 2, y: 0 }), false);
});

test("caminoDirecto rechaza extremos fuera de los límites del grid", () => {
  const grid = crearGrid(3, 3);
  assert.equal(caminoDirecto(grid, { x: 0, y: 0 }, { x: 3, y: 0 }), false);
  assert.equal(caminoDirecto(grid, { x: -1, y: 0 }, { x: 1, y: 1 }), false);
});

test("obstaculosDesdeCajas cubre por techo también el borde final, no solo el inicial", () => {
  const grid = crearGrid(3, 3);
  const obstaculos = obstaculosDesdeCajas(grid, [{ x: -0.2, z: 0, ancho: 0.4, profundidad: 1 }]);
  assert.ok(obstaculos.has("0,0"), "la celda con solape parcial en ambos bordes debe quedar ocupada");
});

test("suavizarCamino: todo segmento del resultado tiene línea directa real, incluido el último", () => {
  const grid = crearGrid(6, 6, [
    { x: 2, y: 1 },
    { x: 2, y: 2 },
    { x: 2, y: 3 },
    { x: 3, y: 4 },
  ]);
  const camino = astar(grid, { x: 0, y: 0 }, { x: 5, y: 5 });
  assert.ok(Array.isArray(camino), "debe existir camino en este grid");
  const suavizado = suavizarCamino(grid, camino);
  assert.deepEqual(suavizado[0], camino[0]);
  assert.deepEqual(suavizado[suavizado.length - 1], camino[camino.length - 1]);
  assert.ok(segmentosValidos(grid, suavizado), "cada tramo del camino suavizado, incluido el final, debe ser directo de verdad");
});
