import test from "node:test";
import assert from "node:assert/strict";

import {
  GRID_UNIT_FT,
  casillasDePies,
  casillasEntre,
  celdasAlcanzables,
  celdasEnAlcance,
  claveCasilla,
  crearOcupacion,
  crearTablero,
  lineaLibre,
  objetivosAlAlcance,
  ocupanteDe,
  piesDeCasillas,
} from "../scripts/combate-rejilla.mjs";
import { astar, crearGrid } from "../scripts/pathfinding-core.mjs";

test("la unidad de casilla es la del core, no una propia", () => {
  assert.equal(GRID_UNIT_FT, 5);
  assert.equal(casillasDePies(30), 6);
  assert.equal(piesDeCasillas(6), 30);
});

test("un movimiento que no llega a una casilla entera no da media casilla", () => {
  // 32 ft no son 6,4 casillas jugables: son 6. Redondear hacia arriba
  // regalaría cinco pies de movimiento en cada turno.
  assert.equal(casillasDePies(32), 6);
  assert.equal(casillasDePies(4), 0);
  assert.equal(casillasDePies(-10), 0);
  assert.equal(casillasDePies("no es un número"), 0);
});

test("el alcance mide en línea recta con la diagonal contando como una casilla", () => {
  assert.equal(casillasEntre({ x: 0, y: 0 }, { x: 3, y: 0 }), 3);
  assert.equal(casillasEntre({ x: 0, y: 0 }, { x: 3, y: 3 }), 3);
  assert.equal(casillasEntre({ x: 5, y: 2 }, { x: 2, y: 4 }), 3);
});

test("lo alcanzable no incluye la casilla de origen", () => {
  const grid = crearGrid(10, 10);
  const alcanzables = celdasAlcanzables(grid, { x: 5, y: 5 }, 2);
  assert.equal(alcanzables.has(claveCasilla(5, 5)), false);
  assert.equal(alcanzables.get(claveCasilla(5, 4)), 1);
  assert.equal(alcanzables.get(claveCasilla(5, 3)), 2);
});

test("el coste que devuelve lo alcanzable coincide con el camino del core", () => {
  // Es la propiedad que justifica usar los mismos vecinos que el core: si el
  // resaltado dijera 3 y el A* necesitara 4, una de las dos capas estaría
  // mintiendo sobre el mismo tablero.
  const obstaculos = ["4,4", "4,5", "4,6"];
  const grid = crearGrid(10, 10, obstaculos);
  const origen = { x: 2, y: 5 };
  const alcanzables = celdasAlcanzables(grid, origen, 8);
  for (const [clave, coste] of alcanzables) {
    const [x, y] = clave.split(",").map(Number);
    const camino = astar(grid, origen, { x, y });
    assert.ok(camino, `debería haber camino hasta ${clave}`);
    assert.equal(camino.length - 1, coste, `coste distinto en ${clave}`);
  }
});

test("un obstáculo entre medias deja fuera de rango una casilla cercana", () => {
  // Un muro en U: la casilla del otro lado está a dos de distancia recta pero
  // el rodeo no cabe en el movimiento.
  const grid = crearGrid(8, 8, ["3,2", "3,3", "3,4", "2,2", "2,4"]);
  const alcanzables = celdasAlcanzables(grid, { x: 1, y: 3 }, 3);
  assert.equal(alcanzables.has(claveCasilla(4, 3)), false);
  assert.equal(alcanzables.has(claveCasilla(1, 1)), true);
});

test("una casilla ocupada se atraviesa pero no se puede terminar en ella", () => {
  const grid = crearGrid(8, 8);
  const ocupacion = crearOcupacion([{ id: "aliado", x: 4, y: 3 }]);
  const alcanzables = celdasAlcanzables(grid, { x: 3, y: 3 }, 3, { ocupacion });
  assert.equal(alcanzables.has(claveCasilla(4, 3)), false, "no se termina dentro de otro");
  assert.equal(alcanzables.has(claveCasilla(5, 3)), true, "pero sí se pasa por su lado");
  assert.equal(alcanzables.get(claveCasilla(5, 3)), 2);
});

test("sin pasos no hay nada alcanzable, y no revienta", () => {
  const grid = crearGrid(5, 5);
  assert.equal(celdasAlcanzables(grid, { x: 2, y: 2 }, 0).size, 0);
  assert.equal(celdasAlcanzables(grid, { x: 2, y: 2 }, Number.NaN).size, 0);
  assert.equal(celdasAlcanzables(grid, { x: 99, y: 99 }, 3).size, 0);
  assert.equal(celdasAlcanzables(null, { x: 0, y: 0 }, 3).size, 0);
});

test("el alcance es un cuadrado y se recorta contra el borde del tablero", () => {
  const grid = crearGrid(6, 6);
  const centro = celdasEnAlcance(grid, { x: 3, y: 3 }, 1);
  assert.equal(centro.size, 8, "las ocho de alrededor, sin la propia");
  const esquina = celdasEnAlcance(grid, { x: 0, y: 0 }, 1);
  assert.equal(esquina.size, 3, "en la esquina solo quedan tres");
});

test("el alcance ignora obstáculos: medir no es recorrer", () => {
  const grid = crearGrid(8, 8, ["4,3"]);
  const enAlcance = celdasEnAlcance(grid, { x: 3, y: 3 }, 3);
  assert.equal(enAlcance.has(claveCasilla(5, 3)), true, "detrás de la roca sigue estando a tiro de medida");
  assert.equal(lineaLibre(grid, { x: 3, y: 3 }, { x: 5, y: 3 }), false, "pero sin línea");
});

test("la línea despejada respeta la regla de no cortar esquinas del core", () => {
  const grid = crearGrid(6, 6, ["2,1", "1,2"]);
  assert.equal(lineaLibre(grid, { x: 1, y: 1 }, { x: 2, y: 2 }), false);
});

test("no hay línea contra una casilla que es un obstáculo", () => {
  const grid = crearGrid(6, 6, ["3,3"]);
  assert.equal(lineaLibre(grid, { x: 1, y: 3 }, { x: 3, y: 3 }), false);
});

test("una casilla siempre se ve a sí misma", () => {
  const grid = crearGrid(4, 4);
  assert.equal(lineaLibre(grid, { x: 2, y: 2 }, { x: 2, y: 2 }), true);
});

test("los objetivos al alcance filtran por línea cuando se pide", () => {
  const grid = crearGrid(10, 10, ["4,5"]);
  const ocupacion = crearOcupacion([
    { id: "tapado", x: 5, y: 5 },
    { id: "a la vista", x: 3, y: 6 },
  ]);
  const conLinea = objetivosAlAlcance(grid, { x: 3, y: 5 }, 4, { ocupacion });
  assert.deepEqual(conLinea.map((q) => q.id), ["a la vista"]);
  const sinFiltrar = objetivosAlAlcance(grid, { x: 3, y: 5 }, 4, { ocupacion, conLinea: false });
  assert.equal(sinFiltrar.length, 2, "un conjuro que no necesita ver sí los alcanza a los dos");
});

test("la ocupación resuelve quién está en cada casilla y descarta entradas rotas", () => {
  const ocupacion = crearOcupacion([
    { id: "bien", x: 2, y: 2 },
    { id: "sin coordenadas" },
    null,
    { id: "no entera", x: 1.5, y: 2 },
  ]);
  assert.equal(ocupanteDe(ocupacion, 2, 2).id, "bien");
  assert.equal(ocupanteDe(ocupacion, 9, 9), null);
  assert.equal(ocupacion.size, 1);
});

test("un tablero monta grid y ocupación, que son cosas distintas a propósito", () => {
  const tablero = crearTablero({
    anchoCeldas: 30,
    altoCeldas: 20,
    obstaculos: ["16,8"],
    combatientes: [{ id: "enemigo", x: 19, y: 7 }],
  });
  assert.equal(tablero.grid.anchoCeldas, 30);
  assert.equal(tablero.grid.altoCeldas, 20);
  assert.equal(tablero.grid.obstaculos.has("16,8"), true);
  // Una criatura NO es un obstáculo del grid: si lo fuera, un aliado sería un
  // muro y no se podría pasar por su casilla.
  assert.equal(tablero.grid.obstaculos.has("19,7"), false);
  assert.equal(ocupanteDe(tablero.ocupacion, 19, 7).id, "enemigo");
});
