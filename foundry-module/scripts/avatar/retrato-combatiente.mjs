// Retrato de combatiente para la carta de turnos (#1018, sub-issue de #1012):
// raza + clase + semilla → rejilla de píxeles indexada, generada en el cliente.
// Cero bytes en el repositorio, igual que el resto del arte del módulo.
//
// POR QUÉ NO ES `retrato-tripulante.mjs`. Aquel (#352) dibuja CASCOS en 12x12
// para la fila de tripulación: codifica presencia, no identidad, y a esa
// rejilla una cara sale caricatura —lo dice su propia cabecera—. Aquí la imagen
// se mira de cerca dentro de una carta, tiene que decir QUIÉN es este
// combatiente, y hay una por cada uno. Son dos problemas distintos con dos
// tamaños distintos; compartir semilla y paleta es todo lo que tiene sentido
// compartir.
//
// LA RESOLUCIÓN ES EL RASGO. El primer intento fue 40x32 y salían caras de
// bloques: a esa rejilla el plano de color más pequeño mide lo mismo que la
// nariz, así que no hay dónde poner un pómulo. A 80x64 el mismo dibujo, con la
// misma paleta corta, se lee como una persona. Subir tonos intermedios no lo
// arreglaba —eso solo convierte el pixelart en un JPEG pequeño—; lo arregla el
// sitio donde poner los planos.
//
// TRES COSAS HACEN QUE NO PAREZCA MINECRAFT, y ninguna es «más colores»:
// la silueta sale de una elipse por filas y no de un rectángulo; la luz es fija
// arriba-izquierda, así que cada superficie elige escalón de rampa según hacia
// dónde mira; y hay un CONTORNO oscuro alrededor de toda la figura, calculado
// al final marcando el fondo que toca figura. Sin el contorno, una silueta
// buena sigue leyéndose como bloques apilados.
//
// LA RAZA CAMBIA PROPORCIONES, NO SOLO EL TINTE. Un enano con la cara de un
// elfo pintada de otro color no es un enano: es el mismo muñeco repintado, que
// es exactamente el fallo que se corrigió aquí. Por eso `RASGOS` mueve ancho,
// altura, línea de los ojos y mentón, y encima de eso van los rasgos propios
// (orejas puntiagudas, barba).
//
// Puro: ni Foundry, ni DOM, ni red. Se prueba desde Node.

import { crearAleatorio } from "../minijuegos/aleatorio.mjs";
import { COMBATIENTE } from "../paleta.mjs";

/** Rejilla lógica. 5:4, que es la proporción del hueco de la carta. */
export const ANCHO = 80;
export const ALTO = 64;

export const RAZAS = Object.freeze(["humano", "elfo", "enano"]);
export const CLASES = Object.freeze(["guerrero", "mago", "picaro"]);

/**
 * Proporciones por raza. `radio` es el semiancho máximo de la cara, `cima` y
 * `menton` sus filas extremas, `afina` cuánto se estrecha hacia la barbilla y
 * `ojos` la fila de la mirada.
 *
 * Los números salen de la lectura, no de la anatomía: el enano tiene que
 * reconocerse por silueta con la carta a tamaño de barra de turnos, y para eso
 * necesita ser más ancho que alto de forma evidente, no un 5% más ancho.
 */
const RASGOS = Object.freeze({
  humano: Object.freeze({ radio: 14, cima: 10, menton: 44, afina: 0.30, ojos: 27, nariz: 3 }),
  elfo: Object.freeze({ radio: 12, cima: 8, menton: 45, afina: 0.42, ojos: 26, nariz: 2 }),
  enano: Object.freeze({ radio: 16, cima: 13, menton: 42, afina: 0.16, ojos: 28, nariz: 4 }),
});

const CENTRO = 40;

function elige(lista, aleatorio) {
  return lista[aleatorio.enteroEntre(0, lista.length - 1)];
}

/**
 * Semiancho de la cara en una fila. Es media elipse con la mandíbula afinada
 * por debajo de los ojos: sin ese afinado la cabeza es un huevo y todas las
 * razas se parecen.
 */
function semiancho(y, rasgos) {
  const centroY = (rasgos.cima + rasgos.menton) / 2;
  const semialto = (rasgos.menton - rasgos.cima) / 2;
  const t = (y - centroY) / semialto;
  let hw = rasgos.radio * Math.sqrt(Math.max(0, 1 - t * t));
  const inicioMandibula = centroY + semialto * 0.35;
  if (y > inicioMandibula) {
    hw *= 1 - rasgos.afina * Math.min(1, (y - inicioMandibula) / (rasgos.menton - inicioMandibula));
  }
  return Math.round(hw);
}

/**
 * Dibuja el retrato y devuelve la rejilla de colores (cadenas hex o null).
 * Se mantiene separada de la indexación para que las pruebas puedan mirar
 * píxeles por color sin resolver índices.
 */
function dibujar({ raza, clase, semilla }) {
  const aleatorio = crearAleatorio(semilla);
  const rasgos = RASGOS[raza];
  const piel = elige(COMBATIENTE.piel[raza], aleatorio);
  const pelo = elige(COMBATIENTE.pelo[raza], aleatorio);
  const ropa = COMBATIENTE.ropa[clase];
  const ojo = COMBATIENTE.ojo;

  const rejilla = Array.from({ length: ALTO }, () => new Array(ANCHO).fill(null));
  const figura = Array.from({ length: ALTO }, () => new Array(ANCHO).fill(false));
  const dentro = (x, y) => x >= 0 && x < ANCHO && y >= 0 && y < ALTO;
  const punto = (x, y, color, esFigura = true) => {
    if (!dentro(x, y)) return;
    rejilla[y][x] = color;
    if (esFigura) figura[y][x] = true;
  };
  const franja = (y, x0, x1, color, esFigura = true) => {
    for (let x = x0; x <= x1; x += 1) punto(x, y, color, esFigura);
  };
  const hw = (y) => semiancho(y, rasgos);

  // Fondo: dos planos y un halo tras la cabeza, para que la silueta se recorte.
  for (let y = 0; y < ALTO; y += 1) {
    franja(y, 0, ANCHO - 1, y < 40 ? COMBATIENTE.fondo.cerca : COMBATIENTE.fondo.lejos, false);
  }
  for (let y = 0; y < ALTO; y += 1) {
    const t = (y - 26) / 26;
    const radio = Math.round(24 * Math.sqrt(Math.max(0, 1 - t * t)));
    if (radio > 0) franja(y, CENTRO - radio, CENTRO + radio, COMBATIENTE.fondo.cerca, false);
  }

  // Torso: los hombros caen, no son un rectángulo.
  const hombro = (y) => Math.min(32, Math.round(10 + 22 * Math.min(1, (y - 46) / 9)));
  for (let y = 47; y < ALTO; y += 1) {
    const w = hombro(y);
    franja(y, CENTRO - w, CENTRO + w, ropa.base);
    franja(y, CENTRO - w, CENTRO - w + 2, ropa.sombra);
    franja(y, CENTRO + w - 2, CENTRO + w, ropa.sombra);
  }
  for (let y = 47; y < 52; y += 1) {
    const w = hombro(y);
    franja(y, CENTRO - w + 3, CENTRO - w + 8, ropa.luz);
  }
  dibujarRopa(clase, { franja, punto, hombro, ropa });

  // Cuello, con su sombra bajo el mentón.
  for (let y = rasgos.menton - 2; y < 50; y += 1) franja(y, CENTRO - 6, CENTRO + 5, piel.sombra);
  for (let y = rasgos.menton; y < 50; y += 1) franja(y, CENTRO - 4, CENTRO + 4, piel.base);

  // Cabeza.
  for (let y = rasgos.cima; y <= rasgos.menton; y += 1) {
    const w = hw(y);
    if (w <= 0) continue;
    franja(y, CENTRO - w, CENTRO + w, piel.base);
    franja(y, CENTRO + w - 3, CENTRO + w, piel.sombra);
    franja(y, CENTRO - w, CENTRO - w + 1, piel.luz);
  }
  for (let y = rasgos.cima + 2; y < rasgos.ojos - 7; y += 1) {
    franja(y, CENTRO - hw(y) + 2, CENTRO - hw(y) + 7, piel.luz);
  }
  for (let y = rasgos.menton - 4; y <= rasgos.menton; y += 1) {
    franja(y, CENTRO - hw(y), CENTRO + hw(y), piel.sombra);
  }

  dibujarCara({ rasgos, piel, pelo, ojo, franja, punto, hw });
  dibujarPelo({ raza, clase, rasgos, pelo, franja, punto, hw });
  // Las orejas van DESPUÉS del pelo: dibujadas antes, la melena tapaba las
  // puntas del elfo, que es justo el rasgo por el que se le reconoce. El
  // tocado sí puede cubrirlas —un yelmo con carrilleras las tapa de verdad—,
  // así que va el último.
  dibujarOrejas({ raza, rasgos, piel, franja, hw });
  dibujarTocado({ clase, rasgos, ropa, ojo, franja, punto, hw });

  // Contorno: el fondo que toca figura. Es lo que separa la silueta.
  for (let y = 0; y < ALTO; y += 1) {
    for (let x = 0; x < ANCHO; x += 1) {
      if (figura[y][x]) continue;
      const toca =
        (dentro(x - 1, y) && figura[y][x - 1]) ||
        (dentro(x + 1, y) && figura[y][x + 1]) ||
        (dentro(x, y - 1) && figura[y - 1][x]) ||
        (dentro(x, y + 1) && figura[y + 1][x]);
      if (toca) rejilla[y][x] = COMBATIENTE.contorno;
    }
  }
  return rejilla;
}

function dibujarRopa(clase, { franja, punto, hombro, ropa }) {
  if (clase === "guerrero") {
    for (let y = 48; y < 58; y += 1) {
      const w = hombro(y);
      franja(y, CENTRO - w, CENTRO - w + 9, ropa.metal);
      franja(y, CENTRO + w - 9, CENTRO + w, ropa.metal);
    }
    for (let y = 48; y < 51; y += 1) {
      const w = hombro(y);
      franja(y, CENTRO - w + 1, CENTRO - w + 7, ropa.metalLuz);
      franja(y, CENTRO + w - 7, CENTRO + w - 1, ropa.metalLuz);
    }
    franja(56, 34, 46, ropa.metal);
    franja(57, 33, 47, ropa.metalSom);
    return;
  }
  if (clase === "mago") {
    for (let y = 50; y < ALTO; y += 1) {
      const w = Math.max(0, y - 50);
      franja(y, CENTRO - w - 1, CENTRO + w + 1, ropa.sombra);
      const solapa = Math.max(0, y - 52);
      franja(y, CENTRO - solapa - 4, CENTRO - solapa - 2, ropa.luz);
      franja(y, CENTRO + solapa + 2, CENTRO + solapa + 4, ropa.luz);
    }
    franja(51, 38, 42, ropa.metal);
    franja(52, 39, 41, ropa.metalLuz);
    return;
  }
  for (let y = 50; y < ALTO; y += 1) {
    franja(y, 28, 38, ropa.sombra);
    franja(y, 29, 31, ropa.luz);
  }
  franja(53, 20, 60, ropa.metal);
  franja(54, 20, 60, ropa.metalSom);
  punto(24, 53, ropa.metalLuz);
}

function dibujarCara({ rasgos, piel, pelo, ojo, franja, punto, hw }) {
  const y = rasgos.ojos;
  // Cejas, un punto por encima del hueco del ojo.
  franja(y - 4, CENTRO - 9, CENTRO - 4, pelo.sombra);
  franja(y - 4, CENTRO + 4, CENTRO + 9, pelo.sombra);
  franja(y - 3, CENTRO - 8, CENTRO - 5, pelo.base);
  franja(y - 3, CENTRO + 5, CENTRO + 8, pelo.base);

  for (const cx of [CENTRO - 7, CENTRO + 7]) {
    franja(y - 1, cx - 4, cx + 3, piel.sombra);
    franja(y, cx - 4, cx + 3, ojo.blanco);
    franja(y + 1, cx - 4, cx + 3, ojo.blanco);
    franja(y, cx - 1, cx + 1, ojo.iris);
    franja(y + 1, cx - 1, cx + 1, ojo.iris);
    punto(cx - 1, y, ojo.brillo);
    franja(y + 2, cx - 3, cx + 2, piel.sombra);
  }

  const n = rasgos.nariz;
  for (let fila = y + 2; fila <= y + 8; fila += 1) {
    franja(fila, CENTRO - n + 1, CENTRO + n - 2, piel.base);
    franja(fila, CENTRO + n - 1, CENTRO + n, piel.sombra);
  }
  franja(y + 9, CENTRO - n, CENTRO + n, piel.sombra);
  franja(y + 8, CENTRO - n, CENTRO + n - 1, piel.luz);

  franja(y + 11, CENTRO - 5, CENTRO + 5, piel.prof);
  franja(y + 12, CENTRO - 4, CENTRO + 4, piel.sombra);
  franja(y + 13, CENTRO - 3, CENTRO + 3, piel.luz);

  for (let fila = y + 3; fila < y + 11; fila += 1) {
    franja(fila, CENTRO - hw(fila) + 1, CENTRO - hw(fila) + 3, piel.luz);
  }
}

function dibujarOrejas({ raza, rasgos, piel, franja, hw }) {
  const base = rasgos.ojos;
  if (raza === "elfo") {
    for (let y = base - 3; y <= base + 6; y += 1) {
      franja(y, CENTRO - hw(y) - 3, CENTRO - hw(y), piel.base);
      franja(y, CENTRO + hw(y), CENTRO + hw(y) + 3, piel.sombra);
    }
    // La punta sube hacia fuera: es el rasgo que identifica a la raza de lejos.
    for (let k = 0; k < 5; k += 1) {
      const y = base - 4 - k;
      const w = hw(base);
      franja(y, CENTRO - w - 3 + k, CENTRO - w - 1 + k, piel.base);
      franja(y, CENTRO + w + 1 - k, CENTRO + w + 3 - k, piel.sombra);
    }
    return;
  }
  for (let y = base - 1; y <= base + 6; y += 1) {
    franja(y, CENTRO - hw(y) - 2, CENTRO - hw(y), piel.base);
    franja(y, CENTRO + hw(y), CENTRO + hw(y) + 2, piel.sombra);
  }
}

function dibujarPelo({ raza, clase, rasgos, pelo, franja, punto, hw }) {
  const tapado = clase === "guerrero";
  if (!tapado) {
    for (let y = rasgos.cima - 2; y <= rasgos.ojos - 3; y += 1) {
      const w = hw(Math.max(y, rasgos.cima + 2)) + 1;
      franja(y, CENTRO - w, CENTRO + w, pelo.base);
      if (y < rasgos.cima + 6) franja(y, CENTRO - w + 2, CENTRO - w + 8, pelo.luz);
      else franja(y, CENTRO + w - 4, CENTRO + w, pelo.sombra);
    }
    franja(rasgos.ojos - 6, CENTRO - 10, CENTRO + 10, pelo.base);
    franja(rasgos.ojos - 5, CENTRO - 8, CENTRO + 8, pelo.sombra);
    for (let y = rasgos.ojos - 7; y <= rasgos.menton - 4; y += 1) {
      const w = hw(Math.min(y, rasgos.menton - 11)) + 2;
      franja(y, CENTRO - w - 2, CENTRO - w, pelo.base);
      franja(y, CENTRO + w, CENTRO + w + 2, pelo.sombra);
    }
  }
  if (raza === "elfo") {
    // Melena larga por fuera de la silueta de la cara.
    for (let y = rasgos.ojos - 3; y <= 52; y += 1) {
      const w = hw(rasgos.menton - 11) + 4;
      franja(y, CENTRO - w - 3, CENTRO - w, pelo.base);
      franja(y, CENTRO + w, CENTRO + w + 3, pelo.sombra);
      punto(CENTRO - w - 3, y, pelo.luz);
    }
  }
  if (raza === "enano") {
    // Barba: ocupa el tercio inferior y desborda el mentón.
    const arranque = rasgos.ojos + 5;
    for (let y = arranque; y <= 52; y += 1) {
      const t = (y - arranque) / (52 - arranque);
      const w = Math.round(17 * (1 - 0.45 * t * t));
      franja(y, CENTRO - w, CENTRO + w, pelo.base);
      franja(y, CENTRO + w - 3, CENTRO + w, pelo.sombra);
      franja(y, CENTRO - w, CENTRO - w + 2, pelo.luz);
    }
    franja(rasgos.ojos + 8, CENTRO - 7, CENTRO + 7, pelo.luz);
    franja(rasgos.ojos + 9, CENTRO - 8, CENTRO + 8, pelo.base);
    franja(rasgos.ojos + 10, CENTRO - 4, CENTRO + 4, pelo.sombra);
    for (let y = 44; y <= 52; y += 1) franja(y, CENTRO - 2, CENTRO + 2, pelo.sombra);
  }
}

function dibujarTocado({ clase, rasgos, ropa, ojo, franja, punto, hw }) {
  if (clase === "guerrero") {
    // Capacete ceñido con corona redondeada. La primera versión era un cubo que
    // tapaba media cara: el casco tiene que seguir la cabeza, no envolverla.
    const cejas = rasgos.ojos - 4;
    for (let y = rasgos.cima - 3; y <= cejas + 1; y += 1) {
      const base = y >= rasgos.cima + 3 ? hw(y) : hw(rasgos.cima + 3) - (rasgos.cima + 3 - y);
      const w = base + 1;
      franja(y, CENTRO - w, CENTRO + w, ropa.metal);
      franja(y, CENTRO + w - 2, CENTRO + w, ropa.metalSom);
      franja(y, CENTRO - w, CENTRO - w + 1, ropa.metalLuz);
      if (y >= rasgos.cima - 1 && y <= rasgos.cima + 4) {
        franja(y, CENTRO - w + 2, CENTRO - w + 5, ropa.metalLuz);
      }
    }
    franja(cejas + 2, CENTRO - hw(cejas + 2) - 1, CENTRO + hw(cejas + 2) + 1, ropa.metalSom);
    // Nasal de tres píxeles: más ancho y deja de ser una nariz de metal.
    for (let y = cejas + 3; y <= rasgos.ojos + 6; y += 1) {
      franja(y, CENTRO - 1, CENTRO + 1, ropa.metal);
      punto(CENTRO + 1, y, ropa.metalSom);
      punto(CENTRO - 1, y, ropa.metalLuz);
    }
    for (let y = rasgos.ojos - 2; y <= rasgos.menton - 6; y += 1) {
      const w = hw(Math.min(y, rasgos.menton - 11)) + 1;
      franja(y, CENTRO - w, CENTRO - w + 1, ropa.metal);
      franja(y, CENTRO + w - 1, CENTRO + w, ropa.metalSom);
    }
    return;
  }
  if (clase === "mago") {
    // Cono inclinado: un cono recto y centrado parece un embudo.
    for (let y = 0; y <= rasgos.cima + 7; y += 1) {
      const w = Math.round(1 + y * 0.85);
      const cx = CENTRO + 4 - Math.round(y * 0.35);
      franja(y, cx - w, cx + w, ropa.base);
      franja(y, cx - w, cx - w + 2, ropa.luz);
      franja(y, cx + w - 2, cx + w, ropa.sombra);
    }
    franja(rasgos.cima + 7, 18, 62, ropa.base);
    franja(rasgos.cima + 8, 16, 64, ropa.base);
    franja(rasgos.cima + 9, 16, 64, ropa.sombra);
    franja(rasgos.cima + 7, 20, 40, ropa.luz);
    franja(rasgos.cima + 5, 26, 54, ropa.sombra);
    franja(rasgos.cima + 4, 26, 54, ropa.metal);
    punto(CENTRO, rasgos.cima + 4, ropa.metalLuz);
    punto(CENTRO + 1, rasgos.cima + 4, ropa.metalLuz);
    return;
  }
  // Capucha: embozo en sombra con los ojos encendidos dentro.
  for (let y = rasgos.cima - 6; y <= rasgos.ojos - 3; y += 1) {
    const w = hw(Math.max(y, rasgos.cima + 3)) + 4;
    franja(y, CENTRO - w, CENTRO + w, ropa.base);
    franja(y, CENTRO + w - 3, CENTRO + w, ropa.sombra);
    franja(y, CENTRO - w, CENTRO - w + 2, ropa.luz);
  }
  for (let y = rasgos.ojos - 3; y <= rasgos.menton + 4; y += 1) {
    const w = hw(Math.min(y, rasgos.menton - 11)) + 4;
    franja(y, CENTRO - w - 2, CENTRO - w + 2, ropa.base);
    franja(y, CENTRO + w - 2, CENTRO + w + 2, ropa.sombra);
  }
  franja(rasgos.ojos - 2, CENTRO - hw(rasgos.ojos - 2) - 4, CENTRO + hw(rasgos.ojos - 2) + 4, ropa.sombra);
  for (let y = rasgos.ojos - 1; y <= rasgos.ojos + 1; y += 1) {
    franja(y, CENTRO - hw(y), CENTRO + hw(y), COMBATIENTE.contorno);
  }
  for (const cx of [CENTRO - 7, CENTRO + 7]) {
    franja(rasgos.ojos, cx - 4, cx + 3, ojo.blanco);
    franja(rasgos.ojos, cx - 1, cx + 1, ojo.iris);
  }
}

/**
 * Retrato indexado listo para pintar o para codificar como PNG de color
 * indexado (`png-indexado.mjs`): `paleta` son los colores usados y `pixeles`
 * un índice por celda, en orden de filas.
 */
export function retratoCombatiente({ raza, clase, semilla = 0 } = {}) {
  if (!RAZAS.includes(raza)) throw new TypeError(`raza desconocida: ${raza}`);
  if (!CLASES.includes(clase)) throw new TypeError(`clase desconocida: ${clase}`);

  const rejilla = dibujar({ raza, clase, semilla });
  const indice = new Map();
  const paleta = [];
  const pixeles = new Uint8Array(ANCHO * ALTO);
  for (let y = 0; y < ALTO; y += 1) {
    for (let x = 0; x < ANCHO; x += 1) {
      const color = rejilla[y][x] ?? COMBATIENTE.fondo.lejos;
      let i = indice.get(color);
      if (i === undefined) {
        i = paleta.length;
        indice.set(color, i);
        paleta.push(color);
      }
      pixeles[y * ANCHO + x] = i;
    }
  }
  return { ancho: ANCHO, alto: ALTO, paleta: Object.freeze(paleta), pixeles };
}

/** Color de una celda, para consumidores y pruebas que no quieren índices. */
export function colorEn(retrato, x, y) {
  if (x < 0 || x >= retrato.ancho || y < 0 || y >= retrato.alto) return null;
  return retrato.paleta[retrato.pixeles[y * retrato.ancho + x]];
}
