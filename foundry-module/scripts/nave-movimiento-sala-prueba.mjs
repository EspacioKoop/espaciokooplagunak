// Salas de pruebas para el andar (#427): dos cajas vacías conectadas por una
// puerta, para verificar de punta a punta el motor de movimiento/colisión
// (`nave-movimiento.mjs`), el bucle de render (`nave-movimiento-lienzo.mjs`)
// y la costura entre estancias (`nave-estancias.mjs`) antes de decidir qué
// sala REAL de la nave se anda primero.
//
// A propósito NO son la cantina. `cantina-escena.mjs` tiene decenas de
// muebles sin colisión definida todavía, y adivinar aquí esa colisión sin que
// nadie la revise sería construir sobre una base sin verificar. Estas salas
// son honestas sobre lo que son: un banco de pruebas, con la MISMA geometría
// exacta en el render que en la colisión — la caja física ES el obstáculo
// visual, sin margen que ocultar entre las dos.
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
import { crearCatalogoEstancias } from "./nave-estancias.mjs";

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

/** A qué altura mira quien anda. Fija: esta rebanada no salta ni se agacha. */
export const ALTURA_OJOS = 1.6;

const ALTURA = 3;
const GROSOR_MURO = 0.4;

/** Rectángulo esquina+medidas a caja centro+medidas en Y = [0, altura]. */
function rectAColumna(rect, altura) {
  return caja(
    [rect.x + rect.ancho / 2, altura / 2, rect.z + rect.profundidad / 2],
    [rect.ancho, altura, rect.profundidad],
  );
}

/** Traslada una malla en coordenadas de mundo. */
function trasladarMalla(malla, [dx, dy, dz]) {
  return { ...malla, vertices: malla.vertices.map(([x, y, z]) => [x + dx, y + dy, z + dz]) };
}

/**
 * Fabrica una sala-caja: cuatro muros por el límite de la planta (sin
 * declararlos como obstáculos aparte — ya los cubre `ancho`/`profundidad` de
 * `crearPlanta`, y duplicarlos podría desincronizar render y colisión),
 * columnas opcionales, suelo y techo.
 *
 * Devuelve `{planta, componer}`, la forma exacta que pide
 * `nave-estancias.declararEstancia` y `nave-movimiento-lienzo.arrancarAndar`.
 *
 * @param {{ancho:number, profundidad:number, columnas?:Array, colorMuro?:string, colorColumna?:string}} medidas
 */
function crearSalaCaja({ ancho, profundidad, columnas = [], colorMuro = SECCION.casco, colorColumna = SECCION.mamparo }) {
  const muros = [
    { x: -GROSOR_MURO, z: -GROSOR_MURO, ancho: ancho + GROSOR_MURO * 2, profundidad: GROSOR_MURO },
    { x: -GROSOR_MURO, z: profundidad, ancho: ancho + GROSOR_MURO * 2, profundidad: GROSOR_MURO },
    { x: -GROSOR_MURO, z: 0, ancho: GROSOR_MURO, profundidad },
    { x: ancho, z: 0, ancho: GROSOR_MURO, profundidad },
  ];

  const piezas = Object.freeze([
    ...muros.map((rect) => ({ malla: rectAColumna(rect, ALTURA), color: colorMuro })),
    ...columnas.map((rect) => ({ malla: rectAColumna(rect, ALTURA), color: colorColumna })),
    { malla: caja([ancho / 2, -0.05, profundidad / 2], [ancho, 0.1, profundidad]), color: SECCION.sala },
    { malla: caja([ancho / 2, ALTURA + 0.05, profundidad / 2], [ancho, 0.1, profundidad]), color: SECCION.mamparo },
  ]);

  const planta = crearPlanta({ ancho, profundidad, obstaculos: columnas });

  /**
   * Compone la escena vista desde `(x, z)` mirando a `yaw`. La cámara se
   * coloca RESTANDO su posición a cada pieza antes de componer (mismo motivo
   * que `cantina-escena.mjs`): `transformar` gira alrededor del origen y
   * DESPUÉS traslada, así que pasar la posición de cámara como `posicion` la
   * aplicaría después de girar — una cámara orbitando un punto, no una
   * cámara andando por la sala.
   */
  function componer(x, z, yaw, opciones = {}) {
    const { ancho: anchoLienzo = 480, alto: altoLienzo = 270, epoca, fov = 62 } = opciones;
    const camara = [x, ALTURA_OJOS, z];

    const partes = piezas.map(({ malla, color }) =>
      componerEscena(trasladarMalla(malla, [-camara[0], -camara[1], -camara[2]]), {
        ancho: anchoLienzo,
        alto: altoLienzo,
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
    return { ancho: anchoLienzo, alto: altoLienzo, epoca: partes[0]?.epoca, poligonos };
  }

  return { planta, componer };
}

/** Sala A: la sala de pruebas original, con dos columnas para probar
 *  colisión y deslizamiento diagonal (ver los tests de `nave-movimiento.
 *  mjs`). Se conserva como export propio por compatibilidad con quien ya la
 *  usa fuera del catálogo. */
const SALA_A = crearSalaCaja({
  ancho: 10,
  profundidad: 10,
  columnas: [
    { x: 3, z: 3, ancho: 0.8, profundidad: 0.8 },
    { x: 6.2, z: 6.2, ancho: 0.8, profundidad: 0.8 },
  ],
});
export const PLANTA_PRUEBA = SALA_A.planta;
export const componerSalaPrueba = SALA_A.componer;

/** Sala B: más pequeña y sin columnas — basta para demostrar que la costura
 *  entre estancias funciona con geometrías distintas de verdad, no con una
 *  copia de la misma sala. */
const SALA_B = crearSalaCaja({ ancho: 6, profundidad: 6 });
export const PLANTA_PRUEBA_B = SALA_B.planta;
export const componerSalaPruebaB = SALA_B.componer;

/**
 * Las dos salas de pruebas conectadas por una puerta en cada sentido, para
 * probar `nave-estancias.mjs` de punta a punta. La puerta de A hacia B está
 * en el muro de +z (el fondo de la sala, lejos de las columnas); la de B
 * hacia A, en su muro de -z, con el destino mirando HACIA la sala de la que
 * viene —cruzar una puerta y aparecer de espaldas a ella es lo que hace que
 * cruzarla otra vez de inmediato no se sienta un error.
 */
export const CATALOGO_PRUEBA = crearCatalogoEstancias({
  a: {
    planta: PLANTA_PRUEBA,
    componer: componerSalaPrueba,
    entrada: { x: 1.5, z: 1.5, yaw: 0 },
    puertas: [
      // Contra el propio muro de +z (la sala mide 10 de profundidad): el
      // rectángulo hace tope justo donde empieza el muro y se extiende hacia
      // dentro 1.2, para que el círculo de colisión lo toque bastante antes
      // de chocar con la pared — un rectángulo pegado al borde con el mismo
      // radio que el jugador dejaría una franja de un dedo donde ni se activa
      // la puerta ni se puede seguir avanzando.
      {
        rect: { x: 4, z: 8.8, ancho: 2, profundidad: 1.2 },
        destino: { estancia: "b", x: 3, z: 2, yaw: 0 },
      },
    ],
  },
  b: {
    planta: PLANTA_PRUEBA_B,
    componer: componerSalaPruebaB,
    puertas: [
      // Contra el muro de -z de esta sala (z = 0): misma lógica, hacia dentro.
      {
        rect: { x: 2, z: 0, ancho: 2, profundidad: 1.2 },
        // Aparece ANTES de la zona de la puerta de A (que empieza en z=8.8):
        // si cayera dentro, la propia llegada volvería a disparar el cruce.
        destino: { estancia: "a", x: 5, z: 8.3, yaw: Math.PI },
      },
    ],
  },
});
