// El pasillo de los recuerdos: mármol, una alfombra negra bordada de cuervos,
// y una fila de memorias y centinelas a cada lado que se pierde en niebla.
//
// QUÉ ES, Y QUÉ NO. Es una tercera escena andable del mismo tipo que el museo
// (#598) y la playa (#587): enseña y ambienta, no concede ni cuenta ni
// recuerda (`docs/FOUNDRY.md`). No es una ampliación del museo ni cuelga de él
// — es su propia estancia, con su propia entrada por herramienta, porque el
// Phobos tampoco tiene esto y colgarlo de un mamparo contaría una historia que
// nadie ha decidido, la misma razón por la que el museo no cuelga de ninguno.
//
// LAS "MEMORIAS" SON LAS PIEZAS DEL MUSEO, REAPROVECHADAS TAL CUAL —mismo id,
// misma malla, misma cartela bilingüe, misma procedencia—. No se inventa una
// segunda copia de la Venus de Milo con otro texto: la reutilización es
// literal, y es lo que hace honesta la premisa narrativa (la Guardiana
// custodia memorias de otros mundos; los otros mundos que este módulo conoce
// son, hoy, el museo). Alternan con los CENTINELAS, piezas originales de esta
// ficción (`pasillo-recuerdos-piezas.mjs`, `pasillo-guardiana.mjs`).
//
// EL PASILLO NO ES INFINITO Y NO FINGE SERLO: mide `PROFUNDIDAD` metros, punto.
// Lo que da la sensación de no acabar nunca es que `PROFUNDIDAD` es mayor que
// el alcance de dibujo por defecto de `componerEscena` (80 m): el muro del
// fondo existe pero cae más allá de `recortarLejano` y no llega a pintarse
// nunca, ni siquiera como una silueta borrosa entre la niebla — es la MISMA
// técnica que ya usa el horizonte de la playa (`playa-escena.mjs`, `niebla`),
// aplicada a una geometría cerrada en vez de a un cielo abierto. El día que la
// fábrica de salas (`crearSalaCaja`) exponga `lejos` como parámetro, esto deja
// de depender de una coincidencia numérica y pasa a pedirlo explícitamente.
//
// Puro: compone objetos y funciones que ya son puras (igual que
// `museo-escena.mjs` y `nave-catalogo-andar.mjs`).

import { PASILLO } from "./paleta.mjs";
import { crearSalaCaja } from "./nave-sala-caja.mjs";
import { declararInteracciones } from "./nave-interaccion.mjs";
import { piezasSueloPasillo } from "./pasillo-recuerdos-suelo.mjs";
import { estatuaGuardiana } from "./pasillo-guardiana.mjs";
import { CATALOGO_MUSEO, MALLAS_MUSEO } from "./museo-piezas.mjs";

/** Ancho del pasillo. 6 m: pasan dos personas y sobra sitio para mirar a los
 *  lados sin invadir el paso, pero sigue leyéndose como un pasillo y no como
 *  una sala. */
export const ANCHO = 6.0;

/**
 * Largo del pasillo. Deliberadamente mayor que el alcance de dibujo por
 * defecto (80 m, `componerEscena`): el muro del fondo cae fuera de lo que se
 * llega a pintar, y por eso nunca se ve — ver la cabecera del módulo.
 */
export const PROFUNDIDAD = 96.0;

const Z_ENTRADA = 1.8;

/** Alto de un plinto de mármol. Más bajo que el pedestal del museo (0,6 m):
 *  aquí la fila entera se mira de perfil según se avanza, y un plinto más alto
 *  taparía los pies de la pieza que tiene detrás en según qué ángulo. */
const PLINTO = Object.freeze({ ancho: 1.0, alto: 0.5, fondo: 1.0 });

/** A qué `x` va cada columna de plintos, a un margen fijo del muro. */
const MARGEN_MURO = 1.3;
const X_MEMORIA = MARGEN_MURO;
const X_CENTINELA = ANCHO - MARGEN_MURO;

/** Cada cuántos metros cae un par memoria/centinela. */
const PASO_PAR = 5.0;

/** Cuántos pares caen antes de que la niebla se los coma. Con `PASO_PAR = 5` y
 *  empezando en `Z_GUARDIANA + 6`, el último par cae bien dentro del alcance de
 *  80 m: se cruza con todos ellos antes de que el fondo se pierda. */
const PARES = 14;

/** Más lejos que la entrada (`Z_ENTRADA = 1.8`): quien entra ve primero el
 *  pasillo abriéndose y a la Guardiana después, no un muro plantado en la
 *  cara desde el primer fotograma. */
const Z_GUARDIANA = 9.0;
/** Escala de la Guardiana frente a un centinela: más alta, para que se la
 *  reconozca como la pieza distinta, pero SIN tocar el techo (`ALTURA` de
 *  `nave-sala-caja.mjs` es 3,8 m) — una estatua que atraviesa el techo se lee
 *  como un error de escala, no como grandeza. */
const ALTO_GUARDIANA = 3.2;
const ALTO_CENTINELA = 2.2;

function limitesDe(malla) {
  const xs = malla.vertices.map(([x]) => x);
  const ys = malla.vertices.map(([, y]) => y);
  const zs = malla.vertices.map(([, , z]) => z);
  return {
    x0: Math.min(...xs), x1: Math.max(...xs),
    y0: Math.min(...ys), y1: Math.max(...ys),
    z0: Math.min(...zs), z1: Math.max(...zs),
  };
}

/**
 * Coloca una malla YA centrada en planta y apoyada en el suelo (la convención
 * que comparten `tools/convertir-estatua.mjs` y `estatuaGuardiana`) sobre un
 * plinto en `(x, z)`.
 *
 * `girada180` respeta la misma corrección que `museo-escena.colocarPieza`: una
 * memoria reaprovechada puede necesitarla y el pasillo no debe reinventar esa
 * regla, solo aplicarla.
 */
function colocarSobrePlinto({ malla, x, z, girada180 = false }) {
  const cota = PLINTO.alto;
  const limites = limitesDe(malla);
  return {
    vertices: malla.vertices.map(([vx, vy, vz]) =>
      girada180 ? [x - vx, cota + vy, z - vz] : [x + vx, cota + vy, z + vz],
    ),
    caras: malla.caras,
    centro: [x, cota + (limites.y1 - limites.y0) / 2, z],
    // Delante de la pieza es hacia -x si está en la columna de centinelas y
    // hacia +x si es una memoria: el pasillo se mira desde el centro, nunca
    // desde el propio muro.
    medioFondo: (limites.z1 - limites.z0) / 2,
  };
}

/** Las 14 memorias, cicladas sobre el catálogo del museo (18 piezas): con
 *  menos pares que piezas no hay repetición, y si algún día hay más pares que
 *  piezas, `% CATALOGO_MUSEO.piezas.length` las repite en vez de reventar —
 *  una memoria repetida en un pasillo muy largo no es un error de diseño, es
 *  justo lo que pasaría con memorias de verdad. */
function memoriaEn(indice) {
  return CATALOGO_MUSEO.piezas[indice % CATALOGO_MUSEO.piezas.length];
}

const MALLA_GUARDIANA = Object.freeze(estatuaGuardiana(ALTO_GUARDIANA));
const MALLA_CENTINELA = Object.freeze(estatuaGuardiana(ALTO_CENTINELA));

function construirEstatuas() {
  const guardiana = colocarSobrePlinto({
    malla: MALLA_GUARDIANA,
    x: ANCHO / 2,
    z: Z_GUARDIANA,
  });
  const memorias = [];
  const centinelas = [];
  for (let i = 0; i < PARES; i += 1) {
    const z = Z_GUARDIANA + PLINTO.fondo + 1.5 + i * PASO_PAR;
    const pieza = memoriaEn(i);
    memorias.push({
      pieza,
      ...colocarSobrePlinto({
        malla: MALLAS_MUSEO[pieza.malla],
        x: X_MEMORIA,
        z,
        girada180: pieza.girada180 === true,
      }),
    });
    centinelas.push({
      indice: i,
      ...colocarSobrePlinto({ malla: MALLA_CENTINELA, x: X_CENTINELA, z }),
    });
  }
  return { guardiana, memorias, centinelas };
}

const { guardiana: GUARDIANA_COLOCADA, memorias: MEMORIAS_COLOCADAS, centinelas: CENTINELAS_COLOCADOS } =
  construirEstatuas();

/** El mirador de una pieza: delante de ella, mirando hacia el eje del pasillo. */
function miradorDe(colocada, ladoCentinela) {
  const [x, , z] = colocada.centro;
  const dx = (ladoCentinela ? -1 : 1) * (0.9 + colocada.medioFondo);
  return [x + dx, z];
}

export const ENTRADA = Object.freeze({ x: ANCHO / 2, z: Z_ENTRADA, yaw: 0 });

const SALIDA = Object.freeze({
  centro: Object.freeze([ANCHO / 2, 0.55, 0.7]),
  medidas: Object.freeze([1.1, 1.1, 0.35]),
});

function mobiliario() {
  const piezas = [];
  const plinto = (x, z, ancho = PLINTO.ancho, fondo = PLINTO.fondo) => ({
    centro: [x, PLINTO.alto / 2, z],
    medidas: [ancho, PLINTO.alto, fondo],
    color: PASILLO.zocalo,
  });
  // El plinto de la Guardiana es más ancho que el de un centinela: su base es
  // más grande (`ALTO_GUARDIANA` la escala entera) y un plinto más pequeño que
  // la pieza que sostiene se leería como un pie que sobresale del zócalo.
  piezas.push(plinto(ANCHO / 2, Z_GUARDIANA, 1.6, 1.6));
  piezas.push({ malla: GUARDIANA_COLOCADA, color: PASILLO.guardiana, colision: false, piel: false });
  for (const memoria of MEMORIAS_COLOCADAS) {
    piezas.push(plinto(X_MEMORIA, memoria.centro[2]));
    piezas.push({
      malla: memoria,
      color: memoria.pieza.naturaleza === "reconstruccion" ? PASILLO.guardianaSombra : PASILLO.marmol,
      colision: false,
      piel: false,
    });
  }
  for (const centinela of CENTINELAS_COLOCADOS) {
    piezas.push(plinto(X_CENTINELA, centinela.centro[2]));
    piezas.push({ malla: centinela, color: PASILLO.guardiana, colision: false, piel: false });
  }
  piezas.push({ ...SALIDA, color: PASILLO.zocalo });
  // El suelo propio (mármol + alfombra): la sala apaga su piel de serie
  // (`pielSuelo: false`, ver `SALA` más abajo) y esta pieza plana la sustituye
  // entera, con el mismo truco que un cuadro (#836): un rectángulo casi sin
  // grosor, sin colisión, encima del suelo real de la fábrica.
  for (const { malla, color } of piezasSueloPasillo({ ancho: ANCHO, profundidad: PROFUNDIDAD })) {
    piezas.push({ malla, color, colision: false, piel: false });
  }
  return piezas;
}

export const INTERACCIONES = declararInteracciones([
  {
    id: "pieza-guardiana",
    punto: miradorDe(GUARDIANA_COLOCADA, false),
    orientacion: Math.PI,
    accion: { tipo: "cartela", pieza: "guardiana" },
  },
  ...MEMORIAS_COLOCADAS.map((memoria, i) => ({
    id: `memoria-${i}-${memoria.pieza.id}`,
    punto: miradorDe(memoria, false),
    orientacion: Math.PI,
    accion: { tipo: "cartela", pieza: memoria.pieza.id },
  })),
  ...CENTINELAS_COLOCADOS.map((centinela, i) => ({
    id: `centinela-${i}`,
    punto: miradorDe(centinela, true),
    orientacion: 0,
    accion: { tipo: "cartela", pieza: "centinela" },
  })),
  {
    id: "salida",
    punto: [SALIDA.centro[0], SALIDA.centro[2] + 0.9],
    orientacion: Math.PI,
    accion: { tipo: "estancia", estancia: "cantina" },
  },
]);

const SALA = crearSalaCaja({
  ancho: ANCHO,
  profundidad: PROFUNDIDAD,
  mobiliario: mobiliario(),
  colorMuro: PASILLO.marmol,
  colorColumna: PASILLO.zocalo,
  // Sin piel de objetos (#550) y sin piel de muro pixelart: un mármol de
  // galería no lleva chapa remachada, la misma frontera que ya cruza el museo.
  // La pared queda al color plano de `colorMuro` — con un pasillo de 96 m de
  // largo eso es, además, el presupuesto correcto: la piel de casco cuesta por
  // metro cuadrado de muro, y este pasillo tiene casi diez veces la superficie
  // de muro de la sala del museo.
  pielObjetos: false,
  muralPixel: false,
  // Y sin la piel de suelo de serie: la de mármol/alfombra la trae
  // `mobiliario()` como una pieza plana más, por el mismo motivo que un cuadro
  // (#836) no usa la piel de sus objetos.
  pielSuelo: false,
});

export const PLANTA_PASILLO = SALA.planta;
export const componerPasillo = SALA.componer;
