// Geometría de un dado en 3D retro de consola (#413 sobre #362).
//
// EL PROBLEMA QUE RESUELVE. Un dado bonito girando es un dado ilegible: si la
// cara que vale cae de canto, el jugador tiene que adivinar su propia tirada, y
// en una mesa de faroleo lo único que no puede ser ambiguo es el número. Un
// sprite plano se lee perfecto y no es un dado. Aquí no se elige entre las dos
// cosas: el dado es un cubo de verdad, con volumen, sombreado y el aspecto de la
// época que toque, pero SU ORIENTACIÓN NO ES AZAR — se calcula para que la cara
// que vale mire a la cámara, con una inclinación corta que enseña dos caras
// vecinas y basta para que se lea como un objeto y no como un cuadrado.
//
// La legibilidad, por tanto, es una construcción y no una suerte: no hay valor
// que pueda salir de canto porque no hay ninguna orientación libre.
//
// REUTILIZA EL MOTOR, NO LO TOCA. Todo el 3D —proyección, recorte, sombreado,
// niebla, temblor de vértices y tonos por época— es `retro3d.mjs` tal cual, que
// nació para cascos de nave y acepta cualquier malla. Este módulo aporta la
// malla del cubo, la de los puntos y la orientación legible; ni una línea de
// rasterizador nueva.
//
// Puro: ni Foundry, ni DOM, ni <canvas>, ni reloj, ni Math.random(). Devuelve
// polígonos en coordenadas de pantalla, como `componerEscena`; quien pinta vive
// fuera.
//
// Frontera de arte (#351): este módulo NO declara ni un color. El cuerpo y la
// tinta de los puntos entran desde `paleta.mjs`, igual que hace el motor.

import { PIXEL } from "../paleta.mjs";
import { componerEscena, fundirEscenas } from "../retro3d.mjs";

/** Media arista del cubo. La malla vive en [-0.5, 0.5]. */
const MEDIO = 0.5;

/**
 * Qué cara lleva cada valor, por su normal. Caras opuestas suman siete, como en
 * un dado de verdad: si no sumaran, cualquiera que mire dos caras a la vez ve
 * que el objeto es falso.
 */
export const NORMAL_POR_VALOR = Object.freeze({
  1: Object.freeze([0, 0, 1]),
  6: Object.freeze([0, 0, -1]),
  3: Object.freeze([1, 0, 0]),
  4: Object.freeze([-1, 0, 0]),
  5: Object.freeze([0, 1, 0]),
  2: Object.freeze([0, -1, 0]),
});

/**
 * Inclinación por defecto, en radianes. Corta a propósito: lo justo para que
 * asomen dos caras vecinas y el cubo tenga volumen, sin que la cara que vale
 * pierda área en pantalla. Subirla hace el dado más vistoso y menos legible, que
 * es exactamente el intercambio que este módulo existe para no hacer.
 */
export const INCLINACION = Object.freeze({ yaw: 0.38, pitch: 0.3 });

/**
 * Rotación que lleva la cara de un valor a mirar a la cámara. La cámara mira
 * hacia +z, así que la cara que se ve es la de normal −z; estas son las
 * rotaciones que llevan cada normal ahí, en el orden yaw→pitch que aplica
 * `transformar`.
 */
const ORIENTACION_POR_VALOR = Object.freeze({
  6: Object.freeze({ yaw: 0, pitch: 0 }),
  1: Object.freeze({ yaw: Math.PI, pitch: 0 }),
  3: Object.freeze({ yaw: Math.PI / 2, pitch: 0 }),
  4: Object.freeze({ yaw: -Math.PI / 2, pitch: 0 }),
  5: Object.freeze({ yaw: 0, pitch: -Math.PI / 2 }),
  2: Object.freeze({ yaw: 0, pitch: Math.PI / 2 }),
});

/**
 * Orientación con la que un dado enseña su valor. Se expone porque una animación
 * de tirada la necesita como destino: se rueda libre y se aterriza AQUÍ, que es
 * lo que convierte el giro en algo que se puede leer al pararse.
 */
export function orientacionParaValor(valor, inclinacion = INCLINACION) {
  const base = ORIENTACION_POR_VALOR[valor] ?? ORIENTACION_POR_VALOR[1];
  return {
    yaw: base.yaw + (Number.isFinite(inclinacion?.yaw) ? inclinacion.yaw : 0),
    pitch: base.pitch + (Number.isFinite(inclinacion?.pitch) ? inclinacion.pitch : 0),
    roll: 0,
  };
}

/**
 * Orientación DURANTE una tirada, con `t` de 0 (recién lanzado) a 1 (parado).
 *
 * El dado rueda y **aterriza legible por construcción**: la vuelta que le queda
 * por dar se multiplica por un factor que vale 1 al principio y exactamente 0 al
 * final, así que en `t = 1` lo que queda es `orientacionParaValor(valor)` y ni un
 * radián más. No hay que «parar cerca» y corregir después —eso es lo que produce
 * el tirón feo del último fotograma— ni existe el riesgo de que un dado se quede
 * de canto porque la animación terminó a destiempo.
 *
 * `vueltas` es cuánto rueda antes de asentarse; `desfase` separa los dados de una
 * misma fila para que no giren como un bloque. Ambos son datos, no azar: la
 * misma tirada se ve igual dos veces.
 */
export function giroDeTirada(valor, t, { vueltas = 3, desfase = 0 } = {}) {
  const destino = orientacionParaValor(valor);
  const avance = Math.min(1, Math.max(0, Number(t) || 0));
  // Desaceleración cúbica: mucho recorrido al principio, casi nada al final, que
  // es como se para un dado de verdad sobre la mesa.
  const restante = (1 - avance) ** 3;
  const giro = 2 * Math.PI * vueltas * restante;
  return {
    yaw: destino.yaw + giro + desfase * restante,
    pitch: destino.pitch + giro * 0.6 + desfase * restante,
    roll: giro * 0.35,
  };
}

// ---- Mallas ---------------------------------------------------------------

// Los ocho vértices del cubo, en el orden en que los nombran las caras.
const VERTICES_CUBO = Object.freeze([
  [-MEDIO, -MEDIO, -MEDIO], // 0
  [MEDIO, -MEDIO, -MEDIO], // 1
  [MEDIO, MEDIO, -MEDIO], // 2
  [-MEDIO, MEDIO, -MEDIO], // 3
  [-MEDIO, -MEDIO, MEDIO], // 4
  [MEDIO, -MEDIO, MEDIO], // 5
  [MEDIO, MEDIO, MEDIO], // 6
  [-MEDIO, MEDIO, MEDIO], // 7
]);

// Dos triángulos por cara, en sentido antihorario visto desde fuera: es lo que
// hace funcionar el descarte de caras traseras del motor.
const CARAS_CUBO = Object.freeze([
  [0, 3, 2], [0, 2, 1], // −z
  [5, 6, 7], [5, 7, 4], // +z
  [1, 2, 6], [1, 6, 5], // +x
  [4, 7, 3], [4, 3, 0], // −x
  [3, 7, 6], [3, 6, 2], // +y
  [4, 0, 1], [4, 1, 5], // −y
]);

/** Malla del cuerpo del dado, en el formato que come `componerEscena`. */
export function mallaDado() {
  return {
    vertices: VERTICES_CUBO.map((v) => [...v]),
    caras: CARAS_CUBO.map((c) => [...c]),
  };
}

/**
 * Posición de los puntos de una cara, en coordenadas locales [-1, 1]. Es el
 * reparto de siempre: las esquinas primero, el centro solo en los impares.
 */
export function puntosDeCara(valor) {
  const E = 0.55; // esquina
  const esquinas = [
    [-E, E], [E, -E], // diagonal principal (2)
    [-E, -E], [E, E], // la otra diagonal (4)
    [-E, 0], [E, 0], // laterales (6)
  ];
  const puntos = [];
  if (valor % 2 === 1) puntos.push([0, 0]);
  const pares = (valor - (valor % 2)) / 2;
  for (let i = 0; i < pares; i += 1) {
    puntos.push(esquinas[i * 2], esquinas[i * 2 + 1]);
  }
  return puntos;
}

// Base ortonormal (derecha, arriba) de cada cara, para colocar sus puntos sobre
// ella sin tener que escribir seis veces las mismas coordenadas a mano.
const BASE_POR_VALOR = Object.freeze({
  1: Object.freeze({ derecha: [1, 0, 0], arriba: [0, 1, 0] }),
  6: Object.freeze({ derecha: [-1, 0, 0], arriba: [0, 1, 0] }),
  3: Object.freeze({ derecha: [0, 0, -1], arriba: [0, 1, 0] }),
  4: Object.freeze({ derecha: [0, 0, 1], arriba: [0, 1, 0] }),
  5: Object.freeze({ derecha: [1, 0, 0], arriba: [0, 0, -1] }),
  2: Object.freeze({ derecha: [1, 0, 0], arriba: [0, 0, 1] }),
});

/**
 * Malla con TODOS los puntos de las seis caras, como cuadraditos despegados del
 * cuerpo lo justo para ganar el orden por pintor.
 *
 * Los puntos son geometría y no textura a propósito: una textura obligaría a un
 * mapeado de UV que el motor no tiene —y no lo va a tener por seis dados—, y
 * además un cuadradito ajustado a la rejilla es exactamente lo que hacía la
 * consola que estamos imitando.
 */
export function mallaPuntos(radio = 0.11, separacion = 0.006) {
  const vertices = [];
  const caras = [];
  for (const valor of [1, 2, 3, 4, 5, 6]) {
    const normal = NORMAL_POR_VALOR[valor];
    const { derecha, arriba } = BASE_POR_VALOR[valor];
    // Alcance útil de la cara: desde el centro hasta el borde, menos el radio
    // del punto, para que ninguno se derrame por la arista.
    const alcance = MEDIO - radio * 1.6;
    for (const [u, v] of puntosDeCara(valor)) {
      const centro = normal.map((n, i) => n * (MEDIO + separacion)
        + derecha[i] * u * alcance
        + arriba[i] * v * alcance);
      const base = vertices.length;
      // Cuadrado sobre el plano de la cara, en sentido antihorario visto desde
      // fuera: `derecha × arriba` apunta hacia la normal, así que este orden
      // sobrevive al descarte de caras traseras igual que el cuerpo.
      for (const [du, dv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        vertices.push(centro.map((c, i) => c + derecha[i] * du * radio + arriba[i] * dv * radio));
      }
      caras.push([base, base + 1, base + 2], [base, base + 2, base + 3]);
    }
  }
  return { vertices, caras };
}

// ---- Escena ---------------------------------------------------------------

/**
 * Escena de un dado ya orientado para que su valor se lea.
 *
 * Se compone en DOS pasadas del motor —cuerpo y puntos— porque `componerEscena`
 * pinta una malla con UN color, y un dado necesita dos: hueso y tinta. Las dos
 * listas se funden y se reordenan por profundidad, que es el mismo orden por
 * pintor que ya usa el motor; los puntos van despegados de la cara, así que caen
 * siempre delante de ella.
 *
 * @param {object} opciones `valor` (1–6) y lo que acepte `componerEscena`
 *   (`epoca`, `ancho`, `alto`, `fondo`, `posicion`…). `giro` sustituye a la
 *   orientación legible cuando alguien quiera animar la tirada, y es el único
 *   modo de que un dado salga de canto: por petición expresa.
 */
export function escenaDado(opciones = {}) {
  const valor = [1, 2, 3, 4, 5, 6].includes(opciones.valor) ? opciones.valor : 1;
  const orientacion = opciones.giro ?? orientacionParaValor(valor, opciones.inclinacion);
  const comun = {
    ...opciones,
    yaw: orientacion.yaw,
    pitch: orientacion.pitch,
    roll: orientacion.roll ?? 0,
    posicion: opciones.posicion ?? [0, 0, 3],
  };

  const cuerpo = componerEscena(mallaDado(), { ...comun, color: opciones.color ?? PIXEL.cara });
  const puntos = componerEscena(mallaPuntos(), { ...comun, color: opciones.tinta ?? PIXEL.borde });

  // Los puntos van incrustados en las caras del cuerpo, así que el orden entre
  // ambas listas es justo el caso que `fundirEscenas` (#510) resuelve por
  // geometría en vez de por centroide.
  const { poligonos } = fundirEscenas([cuerpo, puntos]);

  return { ...cuerpo, valor, poligonos };
}
