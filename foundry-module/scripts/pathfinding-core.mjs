// Core de pathfinding standalone para Espaciokoop.
// - A* sobre grid de casillas cuadradas.
// - Caso base para Foundry 2D y para port a C++ en escenas 3D.
// - PURO: sin Foundry, DOM, red, reloj ni Math.random().
// - Testeable desde Node.
//
// Unidad de la rejilla: 1 celda = 5 pies (GRID_UNIT_FT), la casilla estándar
// de mapa táctico D&D 5e. `obstaculosDesdeCajas` asume que las coordenadas
// de las cajas que recibe YA vienen en esa unidad -- convertir desde metros u
// otra unidad de escena es responsabilidad de quien llama, no de este core.

/** Pies que representa un lado de celda. Ver la nota de unidad arriba. */
export const GRID_UNIT_FT = 5;

/**
 * `Object.freeze` en un `Set` no impide `.add()`/`.delete()` -- solo congela
 * las propiedades del objeto `Set`, no su estado interno. Esta envoltura es
 * lo que de verdad impide mutar la colección de obstáculos que expone un
 * grid, para que el contrato de "core puro" no se pueda romper por fuera.
 */
function congelarConjunto(set) {
  return new Proxy(set, {
    get(objetivo, propiedad, receptor) {
      if (propiedad === "add" || propiedad === "delete" || propiedad === "clear") {
        return () => {
          throw new TypeError("obstaculos del grid es inmutable: crea un grid nuevo con crearGrid()");
        };
      }
      const valor = Reflect.get(objetivo, propiedad, objetivo);
      return typeof valor === "function" ? valor.bind(objetivo) : valor;
    },
  });
}

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
  return Object.freeze({ anchoCeldas, altoCeldas, obstaculos: congelarConjunto(set) });
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
 * No elimina inicio ni fin.
 *
 * Algoritmo del "punto más lejano visible": desde cada nodo retenido, busca
 * el nodo MÁS LEJANO del camino original al que exista línea directa
 * (`caminoDirecto`) y salta directamente a él. A diferencia de un barrido
 * incremental que solo compara pares consecutivos, esto garantiza que TODO
 * segmento del resultado -- incluido el último, hacia el destino -- ha sido
 * validado por `caminoDirecto`: no puede colarse un tramo final sin probar.
 */
export function suavizarCamino(grid, camino) {
  if (!camino || camino.length <= 2) return camino;
  const resultado = [camino[0]];
  let i = 0;
  while (i < camino.length - 1) {
    let j = camino.length - 1;
    while (j > i + 1 && !caminoDirecto(grid, camino[i], camino[j])) {
      j -= 1;
    }
    resultado.push(camino[j]);
    i = j;
  }
  return resultado;
}

/**
 * ¿Hay línea de celdas libres entre `a` y `b`?
 *
 * No permite CORTAR ESQUINA: en cada paso diagonal (cuando el trazado de
 * Bresenham avanza en x e y a la vez), si las DOS celdas ortogonales que
 * forman esa esquina están bloqueadas, el paso se considera bloqueado aunque
 * Bresenham nunca "pise" esas celdas -- de lo contrario un camino podría
 * atravesar el punto exacto donde se tocan dos obstáculos en diagonal, algo
 * que ninguna sala física permitiría.
 */
export function caminoDirecto(grid, a, b) {
  if (!dentro(grid, a.x, a.y) || !dentro(grid, b.x, b.y)) return false;
  if (bloqueada(grid, b.x, b.y)) return false;
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
    const avanzaX = e2 > -dy;
    const avanzaY = e2 < dx;
    const xAntes = x;
    const yAntes = y;
    if (avanzaX) { err -= dy; x += sx; }
    if (avanzaY) { err += dx; y += sy; }
    if (avanzaX && avanzaY) {
      const esquinaA = bloqueada(grid, x, yAntes);
      const esquinaB = bloqueada(grid, xAntes, y);
      if (esquinaA && esquinaB) return false;
    }
  }
}

/**
 * Marca obstáculos a partir de cajas alineadas a ejes.
 *
 * Las coordenadas de cada caja ya deben venir en celdas de grid (ver
 * `GRID_UNIT_FT`), no en metros ni en la unidad nativa de la escena --
 * convertir es responsabilidad de quien llama.
 *
 * Una caja parcialmente fuera del grid se RECORTA a la parte que cae dentro
 * (`dentro()` descarta cada celda fuera de rango una por una); no se
 * descarta la caja entera ni se rechaza la llamada. Es la política correcta
 * para geometría de escena que puede extenderse más allá del área jugable.
 *
 * @param {{anchoCeldas:number, altoCeldas:number, obstaculos:Set<string>}} grid
 * @param {{x:number, z:number, ancho:number, profundidad:number}[]} cajas - en celdas de GRID_UNIT_FT
 * @returns {Set<string>}
 */
export function obstaculosDesdeCajas(grid, cajas = []) {
  const out = new Set(grid.obstaculos);
  for (const caja of cajas) {
    const x0 = Math.floor(caja.x);
    const z0 = Math.floor(caja.z);
    const x1 = Math.ceil(caja.x + caja.ancho);
    const z1 = Math.ceil(caja.z + caja.profundidad);
    for (let cx = x0; cx < x1; cx++) {
      for (let cz = z0; cz < z1; cz++) {
        if (dentro(grid, cx, cz)) out.add(`${cx},${cz}`);
      }
    }
  }
  return out;
}
