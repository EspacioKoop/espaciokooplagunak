// Sala de pruebas para el andar (#427): una caja vacía con dos columnas, para
// verificar el motor de movimiento/colisión (`nave-movimiento.mjs`) y el
// bucle de render (`nave-movimiento-lienzo.mjs`) de punta a punta antes de
// decidir qué sala REAL de la nave se anda primero.
//
// A propósito NO es la cantina. `cantina-escena.mjs` tiene decenas de muebles
// sin colisión definida todavía, y adivinar aquí esa colisión sin que nadie
// la revise sería construir sobre una base sin verificar. Esta sala es
// honesta sobre lo que es: un banco de pruebas, con la MISMA geometría exacta
// en el render que en la colisión — la caja física ES el obstáculo visual,
// sin margen que ocultar entre las dos.
//
// Reutiliza el motor 3D (`retro3d.mjs`) sin tocarlo, igual que
// `cantina-escena.mjs`/`dados-3d.mjs`: aporta solo mallas y su colocación.
//
// Puro: ni Foundry, ni DOM, ni <canvas>, ni reloj, ni Math.random().
//
// Frontera de arte (#351): no declara ni un color propio — todos vienen de
// `paleta.mjs` (`SECCION`, ya usada para materiales genéricos de nave).

import { SECCION } from "./paleta.mjs";
import { componerEscena } from "./retro3d.mjs";
import { crearPlanta } from "./nave-movimiento.mjs";

/** Caja alineada a ejes por centro+medidas, caras en sentido antihorario
 *  vistas desde fuera (lo que `componerEscena` necesita para descartar las de
 *  espaldas) — la misma primitiva que ya usa `cantina-escena.mjs`. */
function caja([cx, cy, cz], [ancho, alto, fondo]) {
  const x = ancho / 2;
  const y = alto / 2;
  const z = fondo / 2;
  return {
    vertices: [
      [cx - x, cy - y, cz - z],
      [cx + x, cy - y, cz - z],
      [cx + x, cy + y, cz - z],
      [cx - x, cy + y, cz - z],
      [cx - x, cy - y, cz + z],
      [cx + x, cy - y, cz + z],
      [cx + x, cy + y, cz + z],
      [cx - x, cy + y, cz + z],
    ],
    caras: [
      [0, 3, 2, 1], // frente (−z)
      [4, 5, 6, 7], // fondo (+z)
      [0, 4, 7, 3], // izquierda
      [1, 2, 6, 5], // derecha
      [3, 7, 6, 2], // techo
      [0, 1, 5, 4], // suelo
    ],
  };
}

const ANCHO = 10;
const PROFUNDIDAD = 10;
const ALTURA = 3;
const GROSOR_MURO = 0.4;

/** A qué altura mira quien anda. Fija: esta rebanada no salta ni se agacha. */
export const ALTURA_OJOS = 1.6;

/** Dos columnas centrales: algo con lo que colisionar y con lo que probar el
 *  deslizamiento diagonal (ver los tests de `nave-movimiento.mjs`). Los
 *  rectángulos son esquina+medidas, la forma que pide `crearPlanta`. */
const COLUMNAS = Object.freeze([
  Object.freeze({ x: 3, z: 3, ancho: 0.8, profundidad: 0.8 }),
  Object.freeze({ x: 6.2, z: 6.2, ancho: 0.8, profundidad: 0.8 }),
]);

/** Los cuatro muros como obstáculos, para que la caja de colisión y la de
 *  render sean literalmente la misma pieza (ver cabecera del archivo). */
const MUROS = Object.freeze([
  Object.freeze({ x: -GROSOR_MURO, z: -GROSOR_MURO, ancho: ANCHO + GROSOR_MURO * 2, profundidad: GROSOR_MURO }),
  Object.freeze({ x: -GROSOR_MURO, z: PROFUNDIDAD, ancho: ANCHO + GROSOR_MURO * 2, profundidad: GROSOR_MURO }),
  Object.freeze({ x: -GROSOR_MURO, z: 0, ancho: GROSOR_MURO, profundidad: PROFUNDIDAD }),
  Object.freeze({ x: ANCHO, z: 0, ancho: GROSOR_MURO, profundidad: PROFUNDIDAD }),
]);

/**
 * La planta de colisión de la sala de pruebas. Los muros no van en
 * `obstaculos`: ya los cubre el límite de la propia planta (`ancho`/
 * `profundidad` de `crearPlanta`), y declararlos dos veces solo podría
 * desincronizar el render de la colisión.
 */
export const PLANTA_PRUEBA = crearPlanta({
  ancho: ANCHO,
  profundidad: PROFUNDIDAD,
  obstaculos: COLUMNAS,
});

/** Rectángulo esquina+medidas a caja centro+medidas en Y = [0, altura]. */
function rectAColumna(rect, altura) {
  return caja(
    [rect.x + rect.ancho / 2, altura / 2, rect.z + rect.profundidad / 2],
    [rect.ancho, altura, rect.profundidad],
  );
}

const PIEZAS = Object.freeze([
  ...MUROS.map((rect) => ({ malla: rectAColumna(rect, ALTURA), color: SECCION.casco })),
  ...COLUMNAS.map((rect) => ({ malla: rectAColumna(rect, ALTURA), color: SECCION.mamparo })),
  { malla: caja([ANCHO / 2, -0.05, PROFUNDIDAD / 2], [ANCHO, 0.1, PROFUNDIDAD]), color: SECCION.sala },
  { malla: caja([ANCHO / 2, ALTURA + 0.05, PROFUNDIDAD / 2], [ANCHO, 0.1, PROFUNDIDAD]), color: SECCION.mamparo },
]);

/** Traslada una malla en coordenadas de mundo. */
function trasladarMalla(malla, [dx, dy, dz]) {
  return { ...malla, vertices: malla.vertices.map(([x, y, z]) => [x + dx, y + dy, z + dz]) };
}

/**
 * Compone la escena vista desde `(x, z)` mirando a `yaw`, dentro de la sala
 * de pruebas. Misma firma que pide `nave-movimiento-lienzo.mjs`
 * (`componer(x, z, yaw) -> escena`).
 *
 * La cámara se coloca RESTANDO su posición a cada pieza antes de componer
 * (mismo motivo que `cantina-escena.mjs`): `transformar` gira alrededor del
 * origen y DESPUÉS traslada, así que pasar la posición de cámara como
 * `posicion` la aplicaría después de girar — una cámara orbitando un punto,
 * no una cámara andando por la sala.
 */
export function componerSalaPrueba(x, z, yaw, opciones = {}) {
  const { ancho = 480, alto = 270, epoca, fov = 62 } = opciones;
  const camara = [x, ALTURA_OJOS, z];

  const partes = PIEZAS.map(({ malla, color }) =>
    componerEscena(trasladarMalla(malla, [-camara[0], -camara[1], -camara[2]]), {
      ancho,
      alto,
      epoca,
      fov,
      color,
      posicion: [0, 0, 0],
      yaw,
    }),
  );

  // Fundido y reordenado global, igual que en `cantina-escena.mjs`: cada
  // pieza ya viene ordenada por su cuenta, y el orden por pintor no es
  // componible — concatenar dos listas correctas da una lista incorrecta.
  const poligonos = partes.flatMap((parte) => parte.poligonos).sort((a, b) => b.profundidad - a.profundidad);
  return { ancho, alto, epoca: partes[0]?.epoca, poligonos };
}
