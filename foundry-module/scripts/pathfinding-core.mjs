// Core de pathfinding standalone para Espaciokoop.
// - A* sobre grid de casillas cuadradas.
// - Caso base para Foundry 2D y para port a C++ en escenas 3D.
// - PURO: sin Foundry, DOM, red, reloj ni Math.random().
// - Testeable desde Node.

/**
 * Crea un grid rectángulo.
 * @param {number} anchoCeldas
 * @param {number} altoCeldas
 * @param {Set<string>|{x:number,y:number}[]} obstaculos - celdas bloqueadas
 * @returns {{anchoCeldas:number, altoCeldas:number, obstaculos:Set<string>}}
 */
export function crearGrid(anchoCeldas, altoCeldas, obstaculos = new Set()) {
  if (!Number.isInteger(anchoCeldas) || !Number.isInteger(altoCeldas) || anchoCeldas <= 0 || altoCeldas <= 0) {
    throw new RangeError("crearGrid requiere anchoCeldas y altoCeldas enteros positivos");
  }
  const set = new Set();
  for (const entrada of obstaculos ?? []) {
    if (typeof entrada === "string") set.add(entrada);
    else if (entrada && typeof entrada.x === "number" && typeof entrada.y === "number") set.add(`${entrada.x},${entrada.y}`);
  }
  return Object.freeze({ anchoCeldas, altoCeldas, obstaculos: Object.freeze(set) });
}

/** ¿Celda dentro de límites? */
export function dentro(grid, x, y) {
  return x >= 0 && x < grid.anchoCeldas && y >= 0 && y < grid.altoCeldas;
}

/** ¿Celda bloqueada? */
export function bloqueada(grid, x, y) {
  return grid.obstaculos.has(`${x},${y}`);
}

/** Vecinos 4-conexos de `(x,y)` dentro de `grid`, sin diagonales. */
export function vecinos(grid, x, y) {
  const candidatos = [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
  ];
  return candidatos.filter((n) => dentro(grid, n.x, n.y) && !bloqueada(grid, n.x, n.y));
}

/** Coste de paso entre celdas adyacentes. Aquí, unitario. */
export function costePaso() {
  return 1;
}

/** Distancia de Manhattan entre dos celdas. */
export function heuristico(x0, y0, x1, y1) {
  return Math.abs(x1 - x0) + Math.abs(y1 - y0);
}

const clave = (nodo) => `${nodo.x},${nodo.y}`;

/**
 * A* determinista sobre grid 4-conexo.
 * @param {{anchoCeldas:number, altoCeldas:number, obstaculos:Set<string>}} grid
 * @param {{x:number, y:number}} inicio
 * @param {{x:number, y:number}} fin
 * @returns {{x:number, y:number}[]|null} lista de celdas incluyendo inicio y fin, o null si no hay camino
 */
export function astar(grid, inicio, fin) {
  if (!dentro(grid, inicio.x, inicio.y) || bloqueada(grid, inicio.x, inicio.y)) return null;
  if (!dentro(grid, fin.x, fin.y) || bloqueada(grid, fin.x, fin.y)) return null;

  const abiertos = new Set([clave(inicio)]);
  const desde = new Map();
  const g = new Map([[clave(inicio), 0]]);
  const f = new Map([[clave(inicio), heuristico(inicio.x, inicio.y, fin.x, fin.y)]]);

  while (abiertos.size > 0) {
    // Nodo con menor f; ante empate, el que tenga menor h.
    let mejorClave = null;
    let mejorF = Infinity;
    let mejorH = Infinity;
    for (const c of abiertos) {
      const [cx, cy] = c.split(",").map(Number);
      const fn = f.get(c) ?? Infinity;
      const hn = heuristico(cx, cy, fin.x, fin.y);
      if (fn < mejorF || (fn === mejorF && hn < mejorH)) {
        mejorF = fn;
        mejorH = hn;
        mejorClave = c;
      }
    }

    const [ax, ay] = mejorClave.split(",").map(Number);
    if (ax === fin.x && ay === fin.y) {
      // Reconstruir camino.
      const camino = [{ x: ax, y: ay }];
      let cur = mejorClave;
      while (desde.has(cur)) {
        const [px, py] = desde.get(cur).split(",").map(Number);
        const padre = { x: px, y: py };
        camino.unshift(padre);
        cur = clave(padre);
      }
      return camino;
    }

    abiertos.delete(mejorClave);

    for (const vec of vecinos(grid, ax, ay)) {
      const cVec = clave(vec);
      const tentativaG = (g.get(mejorClave) ?? Infinity) + costePaso();
      if (tentativaG < (g.get(cVec) ?? Infinity)) {
        desde.set(cVec, mejorClave);
        g.set(cVec, tentativaG);
        f.set(cVec, tentativaG + heuristico(vec.x, vec.y, fin.x, fin.y));
        abiertos.add(cVec);
      }
    }
  }

  return null; // sin camino
}

/**
 * Suaviza un camino A* eliminando puntos intermedios innecesarios.
 * No elimina inicio ni fin. No salta sobre obstáculos diagonales: solo
 * aplica la prueba directa entre dos nodos del camino original.
 */
export function suavizarCamino(grid, camino) {
  if (!camino || camino.length <= 2) return camino;
  const resultado = [camino[0]];
  for (let i = 1; i < camino.length; i++) {
    const anterior = resultado[resultado.length - 1];
    const actual = camino[i];
    if (!caminoDirecto(grid, anterior, actual)) {
      resultado.push(camino[i - 1]);
    }
  }
  resultado.push(camino[camino.length - 1]);
  return resultado;
}

/** ¿Hay línea de celdas libres entre `a` y `b`? */
export function caminoDirecto(grid, a, b) {
  const dx = Math.abs(b.x - a.x);
  const dy = Math.abs(b.y - a.y);
  const sx = a.x < b.x ? 1 : -1;
  const sy = a.y < b.y ? 1 : -1;
  let err = dx - dy;
  let x = a.x;
  let y = a.y;
  while (true) {
    if (x === b.x && y === b.y) return true;
    if (bloqueada(grid, x, y) && !(x === a.x && y === a.y)) return false;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}

/**
 * Marca obstáculos a partir de cajas alineadas a ejes.
 * @param {{anchoCeldas:number, altoCeldas:number, obstaculos:Set<string>}} grid
 * @param {{x:number, z:number, ancho:number, profundidad:number}[]} cajas
 * @returns {Set<string>}
 */
export function obstaculosDesdeCajas(grid, cajas = []) {
  const out = new Set(grid.obstaculos);
  for (const caja of cajas) {
    const x0 = Math.floor(caja.x);
    const z0 = Math.floor(caja.z);
    const x1 = Math.floor(caja.x + caja.ancho);
    const z1 = Math.floor(caja.z + caja.profundidad);
    for (let cx = x0; cx < x1; cx++) {
      for (let cz = z0; cz < z1; cz++) {
        if (dentro(grid, cx, cz)) out.add(`${cx},${cz}`);
      }
    }
  }
  return out;
}
