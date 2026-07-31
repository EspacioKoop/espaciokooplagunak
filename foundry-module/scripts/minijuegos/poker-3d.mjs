// La mesa de póker en 3D retro de consola (#308 sobre #362).
//
// QUÉ PROBLEMA RESUELVE. La mesa se leía perfectamente y no se parecía a una
// mesa: una lista de cartas y una fila de fichas. Lo que falta no es
// información —esa ya estaba— sino el OBJETO: un tapete visto en perspectiva
// con las comunitarias tumbadas encima y las pilas de fichas delante de cada
// quien. Eso es lo que hace que apostar se sienta apostar.
//
// LA LEGIBILIDAD MANDA SOBRE EL VOLUMEN, igual que en el dado de #413. Las
// cartas se tumban con una inclinación CORTA: lo justo para que se vea que
// tienen grosor y están sobre un tapete, no tanto como para que el índice se
// escorce y haya que adivinar el palo. Una mesa bonita e ilegible no es una
// mesa: en un juego de faroleo lo único que no puede ser ambiguo es qué hay.
//
// REUTILIZA EL MOTOR Y EL ARTE QUE YA HAY. El 3D es `retro3d.mjs` tal cual —ni
// una línea de rasterizador nueva—, los colores salen de `paleta.mjs` y las
// caras de las cartas las sigue dibujando `cartas-pixelart.mjs` encima, porque
// una carta pintada píxel a píxel se lee mejor que una carta texturizada.
//
// Puro: ni Foundry, ni DOM, ni <canvas>, ni reloj, ni Math.random().

import { FICHA, PIXEL } from "../paleta.mjs";
import { componerEscena } from "../retro3d.mjs";
import { campoEstelar, proyectarEstrellas } from "../retro3d-estrellas.mjs";

/**
 * Medidas de una carta tumbada. GRUESA A PROPÓSITO —"como un tazo"—: una carta
 * de grosor realista, a esta resolución, es una lámina sin canto y se lee como
 * una calcomanía pegada al fieltro. Con canto visible el objeto tiene peso, se
 * ve que se puede coger, y el borde recoge la luz del sombreado por cara.
 *
 * No es un error de escala como el de la altura de los ojos: aquí la exageración
 * es la que hace legible el objeto, igual que la cabeza enorme de los avatares.
 */
const CARTA = Object.freeze({ ancho: 0.62, alto: 0.16, largo: 0.9 });

/** Canto de la carta: un reborde apenas más pequeño y de otro tono, para que el
 * grosor se LEA en vez de solo estar. */
const CANTO_CARTA = 0.02;

/** La ficha: un disco de diez lados, como el de la cantina. Diez lados y no
 * treinta porque a esta resolución no se distinguen y sí se pagan. */
const LADOS_FICHA = 10;

/** Inclinación de la mesa: se mira desde arriba y desde delante, como quien
 * está sentado. Corta a propósito — ver el tapete desde muy alto convierte la
 * mesa en un plano y pierde el volumen que se venía a buscar. */
export const VISTA = Object.freeze({ pitch: 0.72, yaw: 0, altura: 3.4, atras: 4.6 });

/** Caja alineada a los ejes por centro y medidas. Misma primitiva que la
 * cantina: una mesa de consola de los noventa se construía con cajas. */
export function caja([cx, cy, cz], [ancho, alto, fondo]) {
  const x = ancho / 2;
  const y = alto / 2;
  const z = fondo / 2;
  const vertices = [
    [cx - x, cy - y, cz - z],
    [cx + x, cy - y, cz - z],
    [cx + x, cy + y, cz - z],
    [cx - x, cy + y, cz - z],
    [cx - x, cy - y, cz + z],
    [cx + x, cy - y, cz + z],
    [cx + x, cy + y, cz + z],
    [cx - x, cy + y, cz + z],
  ];
  const caras = [
    [0, 3, 2, 1],
    [4, 5, 6, 7],
    [0, 4, 7, 3],
    [1, 2, 6, 5],
    [3, 7, 6, 2],
    [0, 1, 5, 4],
  ];
  return { vertices, caras };
}

/** Mueve una malla sin tocar la original. */
function mover(malla, [dx, dy, dz]) {
  return {
    vertices: malla.vertices.map(([x, y, z]) => [x + dx, y + dy, z + dz]),
    caras: malla.caras,
  };
}

/** Disco extruido: la ficha. */
export function disco({ radio = 0.3, grosor = 0.16, lados = LADOS_FICHA } = {}) {
  const vertices = [];
  for (const y of [-grosor / 2, grosor / 2]) {
    for (let i = 0; i < lados; i += 1) {
      const a = (i / lados) * Math.PI * 2;
      vertices.push([Math.cos(a) * radio, y, Math.sin(a) * radio]);
    }
  }
  const caras = [
    [...Array(lados).keys()].map((i) => i + lados),
    [...Array(lados).keys()].reverse(),
  ];
  for (let i = 0; i < lados; i += 1) {
    const j = (i + 1) % lados;
    caras.push([i, j, j + lados, i + lados]);
  }
  return { vertices, caras };
}

/**
 * Dónde se tumba cada comunitaria. Cinco huecos fijos y centrados: el hueco
 * vacío SE VE, que es lo que dice cuántas cartas faltan por salir sin ponerlo
 * en un texto.
 */
export function huecosComunitarias(cuantas = 5) {
  const paso = CARTA.ancho + 0.16;
  const inicio = -((cuantas - 1) * paso) / 2;
  return Array.from({ length: cuantas }, (_, i) => [inicio + i * paso, 0.08, 0]);
}

/**
 * Dónde se apila la pila de cada jugador. Las plazas se reparten en un arco por
 * delante del tapete: la tuya abajo del todo, y las demás abriéndose a los
 * lados. Nunca detrás — lo que no se ve no cuenta como estar en la mesa.
 */
export function plazas(cuantos) {
  const total = Math.max(1, Math.min(6, Math.trunc(cuantos) || 1));
  return Array.from({ length: total }, (_, i) => {
    // Semicírculo delantero, de izquierda a derecha.
    const t = total === 1 ? 0.5 : i / (total - 1);
    const angulo = Math.PI * (0.15 + t * 0.7);
    return [Math.cos(angulo) * 2.5, 0.1, 1.9 + Math.sin(angulo) * 0.5];
  });
}

/**
 * La mesa entera en 3D: tapete, comunitarias (y sus huecos) y las pilas.
 *
 * Una llamada a `componerEscena` por material, como la cantina: el motor pinta
 * una malla con UN color y una mesa tiene fieltro, cartas y fichas de varias
 * denominaciones. Se funden reordenando por profundidad, porque el orden por
 * pintor no es componible.
 *
 * @param {object} mesa `{ comunitarias, jugadores }` — `comunitarias` es cuántas
 *   hay boca arriba (0..5) y `jugadores` la lista con sus fichas.
 */
export function componerMesa(mesa = {}, opciones = {}) {
  const { ancho = 320, alto = 200, epoca, fondo = null, semillaCielo = 20260731 } = opciones;
  const comunitarias = Math.max(0, Math.min(5, Math.trunc(mesa.comunitarias) || 0));
  const jugadores = Array.isArray(mesa.jugadores) ? mesa.jugadores.slice(0, 6) : [];

  const piezas = [
    // El tapete, con su reborde: dos cajas y ya tiene canto.
    { malla: caja([0, -0.12, 0.6], [6.4, 0.22, 4.4]), color: FICHA.tapete },
    { malla: caja([0, -0.02, 0.6], [6.0, 0.06, 4.0]), color: FICHA.tapete },
  ];

  // Comunitarias: las que están boca arriba se pintan con la cara clara; los
  // huecos que faltan, con el fieltro apenas levantado, para que se cuenten.
  huecosComunitarias().forEach((centro, i) => {
    const salida = i < comunitarias;
    if (!salida) {
      // El hueco vacío: una marca hundida en el fieltro. Se ve, y por eso se
      // cuenta cuántas faltan por salir sin ponerlo en un texto.
      piezas.push({ malla: caja(centro, [CARTA.ancho, 0.02, CARTA.largo]), color: FICHA.tapete });
      return;
    }
    // Dos cajas por carta: el canto oscuro y la cara encima, un pelo más
    // pequeña. Es lo que hace que el grosor se lea como un borde y no como un
    // bloque de color del mismo tono que la cara.
    piezas.push({
      malla: caja(centro, [CARTA.ancho, CARTA.alto, CARTA.largo]),
      color: PIXEL.borde,
    });
    piezas.push({
      malla: caja(
        [centro[0], centro[1] + CANTO_CARTA, centro[2]],
        [CARTA.ancho - CANTO_CARTA * 2, CARTA.alto, CARTA.largo - CANTO_CARTA * 2],
      ),
      color: PIXEL.cara,
    });
  });

  // Las pilas. La altura dice cuántas fichas hay sin escribir el número, que es
  // lo que hace que una mesa se lea de un vistazo.
  plazas(jugadores.length).forEach((plaza, i) => {
    const jugador = jugadores[i] ?? {};
    const cuantas = Math.max(1, Math.min(12, Math.round((jugador.fichas ?? 0) / 20) || 1));
    const denominacion = FICHA.valores[jugador.denominacion] ?? FICHA.valores[5];
    for (let f = 0; f < cuantas; f += 1) {
      const malla = disco();
      piezas.push({
        malla: {
          vertices: malla.vertices.map(([x, y, z]) => [
            x + plaza[0],
            // Fichas gordas: se apilan con su grosor entero y un pelo de aire,
            // que es lo que hace que una pila se vea como fichas contadas y no
            // como un cilindro pintado de rayas.
            y + plaza[1] + f * 0.185,
            z + plaza[2],
          ]),
          caras: malla.caras,
        },
        color: denominacion,
      });
    }
  });

  const partes = piezas.map((pieza) =>
    componerEscena(pieza.malla, {
      ancho,
      alto,
      epoca,
      color: pieza.color,
      fondo,
      pitch: VISTA.pitch,
      yaw: VISTA.yaw,
      posicion: [0, VISTA.altura, VISTA.atras],
    }),
  );

  const poligonos = partes
    .flatMap((parte) => parte.poligonos)
    .sort((a, b) => b.profundidad - a.profundidad);

  // EL ESPACIO DE FONDO. Se juega dentro de una nave que está volando, y una
  // mesa recortada sobre negro podría estar en cualquier sótano. El campo es el
  // mismo de #384, sembrado: toda la mesa ve el mismo cielo.
  const estrellas = proyectarEstrellas(campoEstelar(semillaCielo, { cantidad: 70 }), {
    ancho,
    alto,
    epoca,
    pitch: VISTA.pitch,
  });

  return { ancho, alto, epoca: partes[0]?.epoca, poligonos, estrellas };
}
