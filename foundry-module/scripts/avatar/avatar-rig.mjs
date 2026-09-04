// El esqueleto del avatar, y los anclajes que salen de él (#897 sobre #603).
//
// QUÉ RESUELVE. Colgar algo de un avatar —un cigarro junto a la boca, una jarra
// en la mano, un distintivo al hombro— exigía repetir la misma cuenta de
// proporción de cuerpo en cada sitio que lo necesitara. En `cantina-avatar.mjs`
// esa cuenta estaba escrita tres veces: `manosDelGesto`, `distintivoDeClase` y
// `puntaDelCigarro`, que ya nació de rescatar la copia que el humo y la brasa
// tenían por separado (#439). El siguiente prop era la cuarta copia.
//
// POR QUÉ UN RIG Y NO UNA TABLA DE PUNTOS. Porque el rig YA EXISTE en el cuerpo
// y no se estaba usando: piernas, torso y cabeza se apilan uno sobre otro y las
// manos cuelgan del torso — eso es una jerarquía, y escribir cada punto en
// coordenadas absolutas es resolverla a mano en cada llamada. `rig-esqueleto.mjs`
// (#603, fase 1) resuelve exactamente eso, y su `posicionesDeHuesos` dice en su
// propia documentación para qué sirve: «colgar cosas de un hueso —un prop en la
// mano— sin volver a resolver la jerarquía fuera». Un contrato de anclajes
// aparte, con sus propios puntos escritos a mano, sería una segunda forma de
// decir dónde cae una mano; y dos formas de decirlo es de donde salió este
// problema.
//
// LO QUE SE GANA ADEMÁS, Y NO ES UN EXTRA. Un anclaje sacado de un hueso trae
// ORIENTACIÓN gratis —la dirección de su padre a él—, que es lo que un prop
// necesita para no quedar siempre mirando al mismo sitio; y girar el avatar
// entero es girar el hueso raíz, que es la limitación que
// `nave-avatares-render.mjs` declaró y aparcó («el cuerpo NO gira con el yaw
// propio de cada jugador»). Las dos cosas salen de la jerarquía, no de código
// nuevo.
//
// ESTO NO DEFORMA NADA. El avatar sigue siendo cajas y se sigue dibujando caja a
// caja: aquí el rig se usa solo para SITUAR, que es lo que `posicionesDeHuesos`
// hace sin tocar una malla. Que el mismo formato sirva luego para doblar una
// malla escaneada (#603, fase 4) es la razón de usar este y no inventar otro,
// pero no es lo que se está haciendo hoy.
//
// NO SABE QUIÉN ES NADIE. Recibe medidas —escala y anchura ya resueltas— y no
// la raza, la clase ni la silueta: esas son de `cantina-avatar.mjs`, que es
// quien tiene las tablas del SRD. Así no hay ciclo entre los dos módulos y el
// cuerpo se puede medir sin saber de quién es.
//
// Puro: ni Foundry, ni DOM, ni red, ni reloj.
//
// Frontera de arte (#351): no declara ni un color.

import { crearRig, posicionesDeHuesos } from "../rig-esqueleto.mjs";

/**
 * El reparto vertical del cuerpo: cuatro cabezas de alto, con la cabeza
 * exagerada. Es la proporción de #423 y no se toca aquí — este módulo la lee
 * para colocar huesos, no la decide.
 */
export function proporciones(escala) {
  const altoCabeza = escala * 0.26;
  const altoTorso = escala * 0.36;
  return Object.freeze({
    altoCabeza,
    altoTorso,
    altoPiernas: escala - altoCabeza - altoTorso,
  });
}

/**
 * Las cotas del cuerpo alrededor de sus pies. Es la cuenta que `piezasAvatar`
 * hacía en línea, sacada aquí para que el rig y el dibujo salgan del MISMO
 * sitio: si divergen, las manos dejan de estar donde están las cajas.
 *
 * @param {{escala:number, ancho:number, pies:number[]}} medidas
 */
export function dimensionesCuerpo({ escala, ancho, pies = [0, 0, 0] }) {
  const [px, py, pz] = pies;
  const { altoCabeza, altoTorso, altoPiernas } = proporciones(escala);
  const yTorso = py + altoPiernas + altoTorso / 2;
  return Object.freeze({
    px,
    py,
    pz,
    ancho,
    altoCabeza,
    altoTorso,
    altoPiernas,
    yPiernas: py + altoPiernas / 2,
    yTorso,
    yCabeza: py + altoPiernas + altoTorso + altoCabeza / 2,
    // La altura de una mano en reposo, colgando. Sale una sola vez porque es el
    // reposo de los dos brazos y el punto de partida de todos los gestos.
    yReposo: yTorso - altoTorso * 0.2,
  });
}

/**
 * Los huesos del avatar en reposo, en el orden en que cuelgan unos de otros.
 *
 * El reposo ES la postura «quieto» de `GESTOS`: brazos caídos a los lados. Eso
 * no es una comodidad, es lo que hace que un gesto sea una POSE parcial —«la
 * mano derecha, ahí»— y no una lista completa de dónde va cada parte. Una pose
 * parcial no envejece cuando el cuerpo cambia; una lista completa sí.
 */
export function huesosAvatar(medidas) {
  const d = dimensionesCuerpo(medidas);
  const { px, py, pz, ancho, yPiernas, yTorso, yCabeza, altoTorso, yReposo } = d;
  return Object.freeze([
    // La raíz va en los PIES y no en la cadera: es el punto que la sala conoce
    // —dónde está esa persona en el suelo— y girar por él es girar a alguien
    // sobre sí mismo, que es lo que hace falta para el yaw.
    Object.freeze({ id: "raiz", cabeza: Object.freeze([px, py, pz]) }),
    Object.freeze({ id: "piernas", padre: "raiz", cabeza: Object.freeze([px, yPiernas, pz]) }),
    Object.freeze({ id: "torso", padre: "piernas", cabeza: Object.freeze([px, yTorso, pz]) }),
    Object.freeze({ id: "cabeza", padre: "torso", cabeza: Object.freeze([px, yCabeza, pz]) }),
    // «Boca» es un decir: #423 renunció a ojos y boca a propósito, y no hay cara
    // que perforar. Es el punto donde queda algo que se lleva a la altura de la
    // cara, y su valor es exactamente el que tenía `puntaDelCigarro`.
    Object.freeze({ id: "boca", padre: "cabeza", cabeza: Object.freeze([px + 0.26 * ancho, yCabeza - 0.06, pz + 0.4]) }),
    // Los hombros son huesos de verdad y no un punto suelto: de ellos cuelgan
    // las manos, así que mover un hombro mueve su brazo, que es lo que hace que
    // esto sea una jerarquía y no una tabla.
    Object.freeze({ id: "hombroDer", padre: "torso", cabeza: Object.freeze([px + 0.34 * ancho, yTorso + altoTorso * 0.35, pz - 0.16]) }),
    Object.freeze({ id: "manoDer", padre: "hombroDer", cabeza: Object.freeze([px + 0.3 * ancho, yReposo, pz + 0.06]) }),
    Object.freeze({ id: "hombroIzq", padre: "torso", cabeza: Object.freeze([px - 0.34 * ancho, yTorso + altoTorso * 0.35, pz - 0.16]) }),
    Object.freeze({ id: "manoIzq", padre: "hombroIzq", cabeza: Object.freeze([px - 0.3 * ancho, yReposo, pz + 0.06]) }),
  ]);
}

/** El rig ya montado, listo para posar. */
export function rigAvatar(medidas) {
  return crearRig(huesosAvatar(medidas));
}

/**
 * Los anclajes que un avatar ofrece. Cada uno es un hueso: ampliar la lista es
 * añadir un hueso, no una fórmula.
 */
export const ANCLAS = Object.freeze({
  manoDerecha: "manoDer",
  manoIzquierda: "manoIzq",
  boca: "boca",
  hombro: "hombroDer",
  cabeza: "cabeza",
});

/** Vector unitario de `a` a `b`, o `null` si coinciden (no hay dirección que
 *  inventar, y devolver un eje cualquiera sería peor que no devolver nada). */
function direccion(a, b) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const largo = Math.hypot(d[0], d[1], d[2]);
  if (largo < 1e-9) return null;
  return Object.freeze([d[0] / largo, d[1] / largo, d[2] / largo]);
}

/**
 * Dónde caen los anclajes de este avatar, con esta pose y este rumbo.
 *
 * Cada anclaje trae `punto` y `orientacion`: la orientación es la dirección de
 * su padre a él, ya girada por la pose. Eso es lo que le falta a un punto
 * suelto — un cigarro colgado de un punto sin dirección apunta siempre al mismo
 * lado, y al girar la persona se queda mirando a donde miraba antes.
 *
 * @param {{escala:number, ancho:number, pies:number[]}} medidas
 * @param {{pose?:object, yaw?:number}} [opciones] `pose` es la del rig (#603),
 *   parcial; `yaw` gira el cuerpo entero sobre sus pies, en radianes.
 * @returns {Object<string, {punto:number[], orientacion:number[]|null}>}
 */
export function anclasAvatar(medidas, { pose = {}, yaw = 0 } = {}) {
  const rig = rigAvatar(medidas);
  const posadas = posicionesDeHuesos(rig, poseConRumbo(pose, yaw));
  const porId = new Map(posadas.map(({ id, punto }) => [id, punto]));
  const padreDe = new Map(rig.huesos.map((h) => [h.id, h.padre]));

  const salida = {};
  for (const [ancla, hueso] of Object.entries(ANCLAS)) {
    const punto = porId.get(hueso);
    const padre = padreDe.get(hueso);
    const desde = padre === null || padre === undefined ? null : porId.get(padre);
    salida[ancla] = Object.freeze({
      punto: Object.freeze([...punto]),
      orientacion: desde ? direccion(desde, punto) : null,
    });
  }
  return Object.freeze(salida);
}

/**
 * La pose con el rumbo metido dentro, girando la raíz.
 *
 * El yaw NO es un caso especial: es un giro del hueso raíz, y como todo lo demás
 * cuelga de él, el cuerpo entero y lo que lleve encima giran con él. Por eso
 * `nave-avatares-render.mjs` puede dejar de tener su limitación declarada sin
 * que aparezca ni una rama nueva: el giro estaba disponible en cuanto hubo
 * jerarquía.
 *
 * Si la pose ya declara la raíz, esa declaración manda: quien pide una pose
 * explícita de la raíz sabe más que este apaño.
 */
export function poseConRumbo(pose = {}, yaw = 0) {
  if (!Number.isFinite(yaw) || yaw === 0 || pose.raiz) return pose;
  return { ...pose, raiz: { eje: [0, 1, 0], angulo: yaw } };
}

/**
 * Las posiciones de TODOS los huesos, para quien dibuja el cuerpo.
 *
 * `piezasAvatar` necesita más que los cuatro anclajes: necesita dónde va cada
 * caja. Se lo damos del mismo rig, para que las cajas y los anclajes no puedan
 * separarse — que es justo el fallo que este módulo existe para impedir.
 */
export function puntosAvatar(medidas, { pose = {}, yaw = 0 } = {}) {
  const rig = rigAvatar(medidas);
  const posadas = posicionesDeHuesos(rig, poseConRumbo(pose, yaw));
  const salida = {};
  for (const { id, punto } of posadas) salida[id] = Object.freeze([...punto]);
  return Object.freeze(salida);
}
