// Malla mínima de un jugador andando por la nave (#453): un muñeco de cajas
// sin cara, en la misma familia visual que las salas de prueba de
// `nave-movimiento-sala-prueba.mjs` — bloques, no un modelo articulado.
//
// El gesto (de pie, agachado, saltando, andando) sale de PARÁMETROS, no de
// una lista de poses dibujadas a mano: piernas más cortas y torso más bajo
// para agachado, piernas recogidas y brazos alzados para saltando, y un
// vaivén de zancada con `faseCaminar` — la misma idea que `AJUSTES_EPOCA` en
// `retro3d.mjs`, datos en vez de ramas sueltas.
//
// Sin color propio (#351): esta malla no lleva pintura, la asigna quien la
// compone (`nave-jugadores-render.mjs`) desde `paleta.mjs`.
//
// Puro: ni Foundry, ni <canvas>, ni reloj, ni Math.random().

const ALTURA_PIERNA_DE_PIE = 0.8;
const ALTURA_PIERNA_AGACHADO = 0.45;
const ALTURA_PIERNA_SALTO = 0.55;
const ANCHO_PIERNA = 0.16;
const ANCHURA_CADERAS = 0.14;
const TORSO = Object.freeze([0.4, 0.55, 0.22]);
const CABEZA_LADO = 0.28;
const BRAZO = Object.freeze([0.12, 0.5, 0.12]);
const OFFSET_ZANCADA = 0.25;
const ALZADO_BRAZO_SALTO = 0.2;

/** Altura aproximada del muñeco de pie, de los pies a la coronilla — útil
 *  para quien necesite encuadrar o depurar sin adivinar las medidas de arriba. */
export const ALTURA_APROX = ALTURA_PIERNA_DE_PIE + TORSO[1] + CABEZA_LADO;

/** Caja alineada a ejes por centro+medidas, misma topología (antihoraria
 *  vista desde fuera) que `nave-movimiento-sala-prueba.caja` — copia local a
 *  propósito: cada mesa de mallas del módulo aporta la suya (ver `dados-3d.
 *  mallaDado`), no hay un util compartido de "caja" del que depender aquí. */
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
      [0, 3, 2, 1],
      [4, 5, 6, 7],
      [0, 4, 7, 3],
      [1, 2, 6, 5],
      [3, 7, 6, 2],
      [0, 1, 5, 4],
    ],
  };
}

/** Une varias mallas en una sola, corriendo los índices de cara. */
function fusionar(mallas) {
  const vertices = [];
  const caras = [];
  for (const malla of mallas) {
    const offset = vertices.length;
    vertices.push(...malla.vertices);
    for (const cara of malla.caras) caras.push(cara.map((i) => i + offset));
  }
  return { vertices, caras };
}

/**
 * Malla del muñeco en coordenadas locales (pies en y=0, mirando a +z, mismo
 * convenio que `retro3d.transformar`). Quien la compone la traslada y la gira
 * a la posición/orientación real del jugador.
 *
 * @param {{agachado?: boolean, saltando?: boolean, faseCaminar?: number}} pose
 */
export function mallaPersonaje({ agachado = false, saltando = false, faseCaminar = 0 } = {}) {
  const alturaPierna = agachado ? ALTURA_PIERNA_AGACHADO : saltando ? ALTURA_PIERNA_SALTO : ALTURA_PIERNA_DE_PIE;
  // De pie y en movimiento se ve el vaivén de zancada; agachado o saltando no
  // (las piernas ya están en una pose fija que la zancada rompería).
  const zancada = agachado || saltando ? 0 : Math.sin(faseCaminar) * OFFSET_ZANCADA;
  const brazoAlzado = saltando ? ALZADO_BRAZO_SALTO : 0;

  const piernaIzquierda = caja([-ANCHURA_CADERAS, alturaPierna / 2, zancada], [ANCHO_PIERNA, alturaPierna, ANCHO_PIERNA]);
  const piernaDerecha = caja([ANCHURA_CADERAS, alturaPierna / 2, -zancada], [ANCHO_PIERNA, alturaPierna, ANCHO_PIERNA]);

  const yTorso = alturaPierna + TORSO[1] / 2;
  const torso = caja([0, yTorso, 0], TORSO);

  const yBrazo = yTorso + brazoAlzado;
  const brazoIzquierdo = caja([-(TORSO[0] / 2 + BRAZO[0] / 2), yBrazo, 0], BRAZO);
  const brazoDerecho = caja([TORSO[0] / 2 + BRAZO[0] / 2, yBrazo, 0], BRAZO);

  const cabeza = caja([0, alturaPierna + TORSO[1] + CABEZA_LADO / 2, 0], [CABEZA_LADO, CABEZA_LADO, CABEZA_LADO]);

  return fusionar([piernaIzquierda, piernaDerecha, torso, brazoIzquierdo, brazoDerecho, cabeza]);
}
