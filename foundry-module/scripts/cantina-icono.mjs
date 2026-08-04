// Iconos 3D animados de las puertas de la cantina (#423 sobre #362).
//
// QUÉ PROBLEMA RESUELVE. Una lista de botones con un icono de fuente no dice a
// qué se juega en esa mesa: dice que hay una opción. Un objeto del juego girando
// —las fichas apiladas, el cubilete— SÍ lo dice, y de paso convierte la sala en
// un sitio con cosas dentro en vez de un menú con fondo bonito.
//
// EL GIRO ES DE REPOSO, NO UN EFECTO. Cada icono gira despacio y siempre, como
// el objeto de un menú de consola de los noventa; el foco solo lo acelera y lo
// inclina un poco hacia quien mira. Nada aparece ni desaparece al pasar por
// encima, porque un icono que solo existe cuando lo enfocas obliga a barrer la
// sala con el ratón para saber qué hay.
//
// LA ANIMACIÓN ES UNA FUNCIÓN DEL TIEMPO, NO UN ESTADO. `componerIcono` recibe
// los milisegundos y devuelve la escena de ese instante. No guarda fase, no
// acumula deriva y dos clientes con el mismo reloj ven lo mismo; además se puede
// probar el fotograma 1234 sin simular los 1233 anteriores.
//
// REUTILIZA EL MOTOR Y LAS MALLAS QUE YA HAY. El cubo del cubilete es el dado de
// `dados-3d.mjs` —el mismo objeto que sale en la mesa de dados, no un parecido—
// y las cajas salen de `cantina-escena.mjs`. Ni un rasterizador nuevo.
//
// Puro: ni Foundry, ni DOM, ni <canvas>, ni reloj propio, ni Math.random().
//
// Frontera de arte (#351): no declara ni un color.

import { FICHA, PIXEL } from "./paleta.mjs";
import { componerEscena } from "./retro3d.mjs";
import { caja } from "./cantina-escena.mjs";

/** Vuelta completa de reposo, en milisegundos. Lento: es respiración, no prisa. */
export const PERIODO_MS = 9000;

/** Cuánto acelera el giro al enfocar. Se nota sin marear. */
export const FACTOR_FOCO = 2.2;

/**
 * Malla de un disco extruido de `lados` caras: la ficha de póker. Un cilindro
 * de verdad a esta resolución no se distingue de uno de diez lados, y diez lados
 * es lo que se rasterizaba entonces.
 */
export function disco({ radio = 1, grosor = 0.28, lados = 10 } = {}) {
  const vertices = [];
  for (const y of [-grosor / 2, grosor / 2]) {
    for (let i = 0; i < lados; i += 1) {
      const a = (i / lados) * Math.PI * 2;
      vertices.push([Math.cos(a) * radio, y, Math.sin(a) * radio]);
    }
  }
  const caras = [];
  // Tapas. La de abajo se recorre al revés para que su normal mire hacia fuera.
  caras.push([...Array(lados).keys()].map((i) => i + lados));
  caras.push([...Array(lados).keys()].reverse());
  // Costado, un cuadrilátero por lado.
  for (let i = 0; i < lados; i += 1) {
    const j = (i + 1) % lados;
    caras.push([i, j, j + lados, i + lados]);
  }
  return { vertices, caras };
}

/**
 * Qué objeto monta cada puerta. Es una tabla y no un `switch` por la misma razón
 * que el catálogo de puertas es una lista: la puerta siguiente debe ser una
 * entrada más, no una rama nueva en el pintor.
 *
 * `piezas` son mallas con su color y su desplazamiento; el conjunto entero gira
 * como un solo objeto.
 */
export const ICONOS = Object.freeze({
  // Póker: tres fichas apiladas, ligeramente descuadradas. Una pila perfecta
  // parece un cilindro; una torcida parece que la ha dejado ahí alguien.
  // Las denominaciones son las de la mesa de verdad (`FICHA.valores`), de mayor
  // abajo a menor arriba: es como se apilan cuando alguien las ordena.
  poker: Object.freeze([
    Object.freeze({ malla: disco(), color: FICHA.valores[500], centro: [0, -0.3, 0] }),
    Object.freeze({ malla: disco(), color: FICHA.valores[25], centro: [0.08, 0, 0.05] }),
    Object.freeze({ malla: disco(), color: FICHA.valores[5], centro: [-0.05, 0.3, 0.03] }),
  ]),
  // Dados: dos cubos, uno mayor y otro caído al lado. El del fondo va girado
  // sobre su eje para que las dos siluetas no se solapen en una sola mancha.
  dados: Object.freeze([
    Object.freeze({ malla: caja([0, 0, 0], [1.3, 1.3, 1.3]), color: PIXEL.cara, centro: [-0.35, 0.15, 0] }),
    Object.freeze({ malla: caja([0, 0, 0], [0.95, 0.95, 0.95]), color: PIXEL.rojo, centro: [0.6, -0.35, 0.2] }),
  ]),
  // Blackjack: dos cartas apoyadas la una en la otra, como un solitario a
  // medio recoger. Dos cajas por carta —canto y cara, un pelo más pequeña—
  // para que el grosor se lea, igual que en la mesa de verdad.
  blackjack: Object.freeze([
    Object.freeze({ malla: caja([0, 0, 0], [1.15, 0.16, 1.7]), color: PIXEL.borde, centro: [-0.3, -0.1, 0] }),
    Object.freeze({ malla: caja([0, 0, 0], [1.05, 0.16, 1.56]), color: PIXEL.cara, centro: [-0.3, 0.02, 0] }),
    Object.freeze({ malla: caja([0, 0, 0], [1.15, 0.16, 1.7]), color: PIXEL.borde, centro: [0.32, 0.32, 0.15] }),
    Object.freeze({ malla: caja([0, 0, 0], [1.05, 0.16, 1.56]), color: PIXEL.dorsoFondo, centro: [0.32, 0.44, 0.15] }),
  ]),
});

/** Objeto de respaldo para una puerta sin icono propio: un dado neutro. Una
 * puerta sin arte debe verse rara pero abrirse igual, no dejar un hueco. */
const RESPALDO = Object.freeze([
  Object.freeze({ malla: caja([0, 0, 0], [1.2, 1.2, 1.2]), color: PIXEL.neutro, centro: [0, 0, 0] }),
]);

export function piezasDe(idIcono) {
  return ICONOS[idIcono] ?? RESPALDO;
}

/**
 * Fase del giro de reposo en radianes para un instante dado. Se saca aparte
 * porque es lo único que depende del tiempo, y así se puede afirmar que el ciclo
 * cierra sin pasar por la geometría.
 */
export function faseEn(ms, { enfocado = false } = {}) {
  const t = Number.isFinite(ms) ? ms : 0;
  const velocidad = enfocado ? FACTOR_FOCO : 1;
  return ((t * velocidad) / PERIODO_MS) * Math.PI * 2;
}

/**
 * La escena de un icono en el instante `ms`. Misma forma que `componerEscena`,
 * para que el pintor no distinga un icono de una nave.
 */
export function componerIcono(idIcono, opciones = {}) {
  const { ancho = 64, alto = 64, epoca, ms = 0, enfocado = false, fondo = null } = opciones;
  const yaw = faseEn(ms, { enfocado });
  // Enfocado se inclina hacia quien mira: enseña la cara superior de la pila y
  // el objeto deja de ser una silueta de perfil.
  const pitch = enfocado ? 0.34 : 0.2;

  const partes = piezasDe(idIcono).map((pieza) =>
    componerEscena(desplazar(pieza.malla, pieza.centro), {
      ancho,
      alto,
      epoca,
      color: pieza.color,
      fondo,
      yaw,
      pitch,
      posicion: [0, 0, 4.2],
    }),
  );

  const poligonos = partes
    .flatMap((parte) => parte.poligonos)
    .sort((a, b) => b.profundidad - a.profundidad);

  return { ancho, alto, epoca: partes[0]?.epoca, poligonos, yaw };
}

/** Mueve una malla sin tocar la original: las de `ICONOS` están congeladas y
 * compartidas entre todas las puertas que usen el mismo objeto. */
function desplazar(malla, [dx, dy, dz] = [0, 0, 0]) {
  return {
    vertices: malla.vertices.map(([x, y, z]) => [x + dx, y + dy, z + dz]),
    caras: malla.caras,
  };
}
