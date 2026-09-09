// Lo que un combate necesita saber de una rejilla (#1013, #1020).
//
// QUÉ AÑADE SOBRE `pathfinding-core.mjs`. El core sabe si HAY camino y cuál es
// el más corto. Un combate necesita tres preguntas más, y ninguna es un camino:
// hasta dónde llego con mi movimiento, a quién alcanzo desde donde estoy, y si
// hay algo entre nosotros. Se escriben aquí y no allí porque el core es la capa
// que también se porta a C++ para las escenas 3D, y estas tres preguntas son de
// reglas de mesa, no de geometría.
//
// MOVERSE ES RECORRER; ALCANZAR ES MEDIR. Es la distinción que gobierna este
// archivo y la razón de que las dos funciones no compartan una sola noción de
// distancia:
//
//  - `celdasAlcanzables` recorre el grafo con los MISMOS vecinos que usa el
//    A* del core (cuatro direcciones, sin diagonales). Si usara ocho, el
//    resaltado podría prometer una casilla a la que el propio `astar` del core
//    no llega en ese número de pasos: dos capas dando respuestas distintas
//    sobre el mismo tablero, que es el fallo que este módulo existe para no
//    tener. Si algún día el juego quiere diagonales, se añaden EN EL CORE y
//    esto las hereda; no se abre aquí una segunda opinión.
//  - `casillasEntre` mide en línea recta contando la diagonal como una casilla
//    (Chebyshev), que es la regla simplificada de alcance de una mesa 5e. Medir
//    un alcance recorriendo el tablero sería otra cosa: un enemigo al otro lado
//    de una roca está a tiro de un arco aunque no haya camino.
//
// LA COBERTURA NO SE GRADÚA, Y ES A PROPÓSITO. Se responde «hay línea» o «no
// la hay» (`lineaLibre`), reusando `caminoDirecto` del core con su regla de no
// cortar esquinas. Los grados de cobertura de 5e —media, tres cuartos, total—
// se deciden trazando líneas entre ESQUINAS de casilla en espacio continuo, no
// entre centros, y fingirlos con una línea de centros daría un número con
// pinta de regla que no es la regla. Cuando el motor de turnos (#1014) los
// necesite de verdad, se implementan con su geometría; hasta entonces esto
// dice lo que sabe.
//
// Puro: ni Foundry, ni DOM, ni reloj, ni Math.random(). Testeable desde Node.

import {
  GRID_UNIT_FT,
  bloqueada,
  caminoDirecto,
  crearGrid,
  dentro,
  vecinos,
} from "./pathfinding-core.mjs";

export { GRID_UNIT_FT };

/** Clave de casilla. La misma forma que usa el core, para poder cruzar conjuntos. */
export function claveCasilla(x, y) {
  return `${x},${y}`;
}

/** Pies → casillas, redondeando hacia abajo: 32 ft de movimiento son 6 casillas, no 6,4. */
export function casillasDePies(pies) {
  const n = Number(pies);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n / GRID_UNIT_FT);
}

/** Casillas → pies. */
export function piesDeCasillas(casillas) {
  const n = Number(casillas);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n * GRID_UNIT_FT;
}

/**
 * Distancia de alcance entre dos casillas, en casillas (Chebyshev).
 *
 * La diagonal cuenta como una: es la regla simplificada del PHB, la que juega
 * casi toda mesa, y la que hace que un círculo de alcance se dibuje como un
 * cuadrado. La variante 5-10-5 es una regla de la casa y, si se quiere, entra
 * como opción del motor de turnos, no como una segunda función aquí.
 */
export function casillasEntre(a, b) {
  return Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
}

/**
 * Ocupación del tablero: qué casilla tiene a quién.
 *
 * Es un dato aparte de los obstáculos porque se comporta distinto: un muro
 * bloquea el paso Y la línea; una criatura bloquea DÓNDE TERMINAS pero no el
 * paso —en 5e se puede atravesar la casilla de un aliado— ni la línea de tiro.
 * Meterla en `grid.obstaculos` habría sido más corto y habría convertido a
 * cada aliado en un muro.
 */
export function crearOcupacion(combatientes = []) {
  const porCasilla = new Map();
  for (const quien of combatientes) {
    if (!quien || !Number.isInteger(quien.x) || !Number.isInteger(quien.y)) continue;
    porCasilla.set(claveCasilla(quien.x, quien.y), quien);
  }
  return porCasilla;
}

/** Quién está en una casilla, o `null`. */
export function ocupanteDe(ocupacion, x, y) {
  return ocupacion?.get(claveCasilla(x, y)) ?? null;
}

/**
 * Hasta dónde llega alguien con su movimiento, en casillas de coste.
 *
 * Devuelve un `Map` de clave de casilla a COSTE en pasos, no un `Set`: quien
 * pinta el resaltado casi siempre quiere degradarlo por distancia, y quien
 * decide una acción quiere saber cuánto le queda al llegar. Reconstruir eso
 * después obligaría a repetir la búsqueda.
 *
 * La casilla de origen NO va en el resultado: «hasta dónde puedo ir» no
 * incluye quedarse quieto, y tenerla dentro obliga a filtrarla en cada
 * consumidor.
 *
 * Las casillas OCUPADAS se pueden atravesar pero no son destino válido, que es
 * la regla de mesa: pasas junto a tu compañero, no te quedas dentro de él.
 */
export function celdasAlcanzables(grid, origen, pasos, { ocupacion = null } = {}) {
  const alcanzables = new Map();
  if (!grid || !origen) return alcanzables;
  if (!dentro(grid, origen.x, origen.y)) return alcanzables;
  const tope = Number.isFinite(pasos) ? Math.max(0, Math.floor(pasos)) : 0;
  if (tope === 0) return alcanzables;

  const visitados = new Set([claveCasilla(origen.x, origen.y)]);
  let frontera = [{ x: origen.x, y: origen.y }];
  for (let paso = 1; paso <= tope && frontera.length > 0; paso += 1) {
    const siguiente = [];
    for (const casilla of frontera) {
      for (const vecino of vecinos(grid, casilla.x, casilla.y)) {
        const clave = claveCasilla(vecino.x, vecino.y);
        if (visitados.has(clave)) continue;
        visitados.add(clave);
        siguiente.push(vecino);
        // Atravesable pero no destino: se sigue expandiendo desde ella, y no
        // se anota como alcanzable.
        if (ocupanteDe(ocupacion, vecino.x, vecino.y)) continue;
        alcanzables.set(clave, paso);
      }
    }
    frontera = siguiente;
  }
  return alcanzables;
}

/**
 * A quién alcanzas desde una casilla, con un alcance dado en casillas.
 *
 * No mira obstáculos: eso es `lineaLibre`, y va aparte porque un conjuro que
 * no necesita ver y una flecha que sí tienen el mismo alcance y distinta
 * respuesta. Devolver aquí las dos cosas mezcladas obligaría a este módulo a
 * saber qué clase de ataque es, que es del motor de turnos.
 */
export function celdasEnAlcance(grid, origen, alcance) {
  const enAlcance = new Set();
  if (!grid || !origen) return enAlcance;
  const r = Number.isFinite(alcance) ? Math.max(0, Math.floor(alcance)) : 0;
  for (let dy = -r; dy <= r; dy += 1) {
    for (let dx = -r; dx <= r; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const x = origen.x + dx, y = origen.y + dy;
      if (!dentro(grid, x, y)) continue;
      if (casillasEntre(origen, { x, y }) > r) continue;
      enAlcance.add(claveCasilla(x, y));
    }
  }
  return enAlcance;
}

/**
 * ¿Hay línea despejada entre dos casillas?
 *
 * Delegado en `caminoDirecto` del core para no tener dos trazados de línea que
 * puedan discrepar: el que decide si se puede disparar tiene que ser el mismo
 * que decide si se puede andar en línea recta, o habrá tiros que atraviesan
 * una esquina por la que nadie cabe.
 */
export function lineaLibre(grid, a, b) {
  if (!grid || !a || !b) return false;
  if (a.x === b.x && a.y === b.y) return true;
  // `caminoDirecto` rechaza un destino bloqueado, y para un ataque eso es lo
  // contrario de lo que queremos: se dispara CONTRA la casilla, no a través
  // de ella. Se pregunta por la línea hasta el borde y el destino se juzga
  // aparte.
  if (bloqueada(grid, b.x, b.y)) return false;
  return caminoDirecto(grid, a, b);
}

/**
 * Objetivos alcanzables desde una casilla: quién está dentro del alcance y,
 * si se pide `conLinea`, además a la vista.
 */
export function objetivosAlAlcance(grid, origen, alcance, { ocupacion = null, conLinea = true } = {}) {
  const casillas = celdasEnAlcance(grid, origen, alcance);
  const objetivos = [];
  for (const clave of casillas) {
    const [x, y] = clave.split(",").map(Number);
    const quien = ocupanteDe(ocupacion, x, y);
    if (!quien) continue;
    if (conLinea && !lineaLibre(grid, origen, { x, y })) continue;
    objetivos.push(quien);
  }
  return objetivos;
}

/**
 * El tablero de un combate, con su grid y su ocupación ya montados.
 *
 * Existe para que un consumidor no tenga que acordarse del orden —primero el
 * grid con los obstáculos, luego la ocupación aparte— ni de que son dos cosas
 * distintas por un motivo.
 *
 * Las medidas se llaman `anchoCeldas`/`altoCeldas`, como en el core, y no
 * «casillas»: es exactamente el mismo dato, y tener dos palabras para una cosa
 * obliga a traducir en cada frontera. «Casilla» se queda para lo que sí es de
 * reglas de mesa —cuántas casillas de alcance, cuántas por 30 pies—, que es un
 * concepto de la mesa y no del grafo.
 */
export function crearTablero({ anchoCeldas, altoCeldas, obstaculos = [], combatientes = [] }) {
  const grid = crearGrid(anchoCeldas, altoCeldas, obstaculos);
  return Object.freeze({ grid, ocupacion: crearOcupacion(combatientes) });
}
