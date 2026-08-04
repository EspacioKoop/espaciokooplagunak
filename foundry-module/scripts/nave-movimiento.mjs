// Movimiento continuo y colisión dentro de una sala (#427: moverse por la
// nave). Es la pieza que #423 (cantina) decidió NO construir a propósito
// —"CORTE SECO, nunca travelling"— y que #427 sí necesita: un andar de verdad,
// con teclas mantenidas y una pared que para.
//
// PURO: ni Foundry, ni DOM, ni reloj propio, ni Math.random(). El tiempo
// (`dt`) y qué teclas están pulsadas entran siempre por parámetro, igual que
// hace `temporizacion.mjs` en #309 — así una prueba puede avanzar el reloj a
// mano sin esperar un fotograma real.
//
// LA PLANTA ES UNA CAJA CON AGUJEROS. Un suelo rectangular y una lista de
// obstáculos rectangulares (AABB) alineados a los ejes: es la misma primitiva
// que ya usa `cantina-escena.mjs` para los muebles (`caja`), pero aquí solo
// hace falta su huella en el plano X/Z, no su altura — la cámara no salta.
//
// COLISIÓN CÍRCULO-CONTRA-CAJA, EJE POR EJE. Quien anda es un círculo (un
// radio de hombros, no un punto): un punto que camina se cuela por la esquina
// de cualquier mesa. Resolver X y Z por separado —probar el desplazamiento en
// X, aceptarlo o no, y LUEGO probar Z desde ahí— es lo que hace que rozar una
// pared en diagonal deslice en vez de clavarse en seco: bloquear el vector
// entero por un solo eje convertiría cualquier esquina en una trampa.

/**
 * Una planta rectangular (X: 0..ancho, Z: 0..profundidad) con obstáculos.
 * Los obstáculos son cajas `{x, z, ancho, profundidad}` (esquina + medidas,
 * no centro: es la forma que hace trivial la comprobación de cercanía).
 */
export function crearPlanta({ ancho, profundidad, obstaculos = [] }) {
  if (!(ancho > 0) || !(profundidad > 0)) {
    throw new RangeError("crearPlanta: ancho y profundidad deben ser positivos");
  }
  return Object.freeze({
    ancho,
    profundidad,
    obstaculos: Object.freeze(obstaculos.map((o) => Object.freeze({ ...o }))),
  });
}

/** Punto de la caja `rect` más cercano a `(x, z)`, acotando a sus bordes. */
function puntoMasCercano(x, z, rect) {
  return {
    x: Math.max(rect.x, Math.min(x, rect.x + rect.ancho)),
    z: Math.max(rect.z, Math.min(z, rect.z + rect.profundidad)),
  };
}

function colisionaConRect(x, z, radio, rect) {
  const cerca = puntoMasCercano(x, z, rect);
  const dx = x - cerca.x;
  const dz = z - cerca.z;
  return dx * dx + dz * dz < radio * radio;
}

/** ¿Un círculo de `radio` centrado en `(x, z)` cabe en la planta? */
export function colisiona(x, z, radio, planta) {
  if (x - radio < 0 || x + radio > planta.ancho || z - radio < 0 || z + radio > planta.profundidad) {
    return true;
  }
  return planta.obstaculos.some((rect) => colisionaConRect(x, z, radio, rect));
}

/**
 * ¿Qué puerta toca un círculo de `radio` en `(x, z)`, si toca alguna?
 *
 * Una puerta es `{rect, destino}`: el mismo rectángulo esquina+medidas que un
 * obstáculo, pero NO bloquea —es un disparador, no una pared— y `destino` es
 * opaco para este módulo (lo interpreta quien gestione el catálogo de
 * estancias, #427 rebanada siguiente). Se reutiliza la misma comprobación de
 * cercanía que la colisión: solaparse con el rectángulo de la puerta es
 * exactamente la misma pregunta que solaparse con un obstáculo, solo que la
 * respuesta no para el paso, dispara otra cosa.
 *
 * Devuelve la PRIMERA puerta tocada, o `null`. Con puertas que se solapasen
 * (no debería pasar en una planta bien hecha) manda el orden de la lista.
 */
export function puertaTocada(x, z, radio, puertas) {
  for (const puerta of puertas ?? []) {
    if (colisionaConRect(x, z, radio, puerta.rect)) return puerta;
  }
  return null;
}

/** Las cuatro direcciones que reconoce el motor. Nombradas por su efecto, no
 *  por la tecla física: quien cablee el teclado decide qué tecla es cuál. */
export const DIRECCIONES = Object.freeze(["adelante", "atras", "izquierda", "derecha"]);

/**
 * Traduce el conjunto de direcciones activas a un vector LOCAL unitario
 * (adelante = +z local, derecha = +x local). Diagonal normalizada: adelante+
 * derecha a la vez no debe andar más rápido que uno solo — normalizar sin
 * comprobar el módulo dividiría por cero cuando no hay ninguna tecla.
 */
export function vectorLocal(activas) {
  let x = 0;
  let z = 0;
  if (activas?.has?.("adelante") || activas?.adelante) z += 1;
  if (activas?.has?.("atras") || activas?.atras) z -= 1;
  if (activas?.has?.("derecha") || activas?.derecha) x += 1;
  if (activas?.has?.("izquierda") || activas?.izquierda) x -= 1;
  const modulo = Math.hypot(x, z);
  if (modulo === 0) return { x: 0, z: 0 };
  return { x: x / modulo, z: z / modulo };
}

/**
 * Un paso de movimiento: de `{x, z}` mirando a `yaw` (radianes, 0 = +z
 * mundo), con las direcciones `activas` mantenidas durante `dt` segundos, a
 * la nueva posición dentro de `planta`. Sin teclas activas devuelve la misma
 * posición sin tocar nada — no hay inercia ni fricción que simular en reposo.
 *
 * @param {{x:number, z:number, yaw:number, activas:Set<string>|object,
 *   dt:number, planta:object, velocidad?:number, radio?:number}} entrada
 * @returns {{x:number, z:number}}
 */
export function mover({ x, z, yaw, activas, dt, planta, velocidad = 2.2, radio = 0.35 }) {
  const local = vectorLocal(activas);
  if (local.x === 0 && local.z === 0) return { x, z };
  if (!(dt > 0)) return { x, z };

  const distancia = velocidad * dt;
  const seno = Math.sin(yaw);
  const coseno = Math.cos(yaw);
  // Rotación del vector local al mundo: adelante local (0,1) gira a
  // (sen(yaw), cos(yaw)) en mundo cuando yaw=0 mira a +z.
  const dx = (local.x * coseno + local.z * seno) * distancia;
  const dz = (local.z * coseno - local.x * seno) * distancia;

  // Eje por eje, y en este orden porque es el que hace que rozar una pared de
  // lado (moviéndose sobre todo en X) deslice sobre ella en vez de parar en
  // seco: se prueba primero el eje dominante del propio desplazamiento.
  const primero = Math.abs(dx) >= Math.abs(dz);
  let nx = x;
  let nz = z;
  if (primero) {
    if (!colisiona(x + dx, z, radio, planta)) nx = x + dx;
    if (!colisiona(nx, z + dz, radio, planta)) nz = z + dz;
  } else {
    if (!colisiona(x, z + dz, radio, planta)) nz = z + dz;
    if (!colisiona(x + dx, nz, radio, planta)) nx = x + dx;
  }
  return { x: nx, z: nz };
}
