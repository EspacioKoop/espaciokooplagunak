// El plató de pruebas (#584): la sala que ENSEÑA la opción B, no que la
// implementa. La implementación vive en `nave-sala-caja.mjs`
// (`SUBDIVISION_PANO_METROS`, `panosTexturados`) y en `retro3d.mjs`
// (`intensidadCara`, #556) — esta escena solo la pone delante de un foco de
// verdad, que es lo que ningún test Node puede sustituir: si el paño
// texturado fuera todavía un solo cuadrilátero por cara (opción A), un foco
// cercano lo aclararía ENTERO de golpe. Con la subdivisión, el charco de luz
// tiene que leerse recorriendo el muro, más claro cerca del pie de foco y
// apagándose hacia las esquinas.
//
// POR QUÉ UN ESTUDIO DE CINE. Un plató es el único sitio donde tres focos
// point-light plantados a distintas alturas y distancias no necesitan excusa
// narrativa: es SU atrezo. Sirve al mismo tiempo de banco de pruebas para
// #556 (esta es la primera escena del módulo que declara `focos`; hasta hoy
// ninguna lo hacía) y de plató de verdad, con su silla, su cámara y su
// claqueta.
//
// POR QUÉ NO CUELGA DE NINGUNA PUERTA DE LA NAVE. Mismo motivo que la playa
// (#587) y el museo (#598): el Phobos no tiene un plató, y colgarlo de un
// mamparo contaría una historia que nadie ha decidido. Solo-GM, por
// herramienta de la barra de escena, vuelta por su único punto de
// interacción.
//
// Puro y sin color propio (#351): los colores salen de `ESTUDIO` en
// `paleta.mjs`.

import { ESTUDIO } from "./paleta.mjs";
import { crearSalaCaja } from "./nave-sala-caja.mjs";
import { declararInteracciones } from "./nave-interaccion.mjs";

/* ---- medidas de la sala ----------------------------------------------------- */

/** Diez por ocho: un plató pequeño, no un hangar — con tres focos y cuatro
 *  piezas de atrezo, más superficie es pared vacía sin nada que enseñar. */
export const ANCHO = 10.0;
export const PROFUNDIDAD = 8.0;

/* ---- los tres focos ---------------------------------------------------------- */

/**
 * El rig de tres puntos, en coordenadas del MUNDO — el vocabulario clásico de
 * plató: KEY cerca y potente, para que el charco de luz sea inconfundible
 * sobre el paño texturado; FILL enfrente y más débil, que rellena sin competir;
 * BACK detrás del sujeto, bajo, contra el muro del fondo, para separar la
 * silueta del mamparo. Alturas distintas —2,4 / 2,0 / 1,6 m— porque tres
 * focos a la misma altura se leen como una fila de apliques, no como un rig.
 *
 * `alcance` corto (4-5 m) a propósito: en una sala de 10x8, un foco con
 * alcance largo bañaría toda la sala por igual y no habría charco que ver —
 * la lección de #556 aplicada al revés de lo que aplica una luminaria de
 * pasillo.
 */
export const FOCOS = Object.freeze([
  { nombre: "key", posicion: [2.2, 2.4, 1.8], potencia: 3.2, alcance: 5 },
  { nombre: "fill", posicion: [7.6, 2.0, 2.4], potencia: 1.3, alcance: 5.5 },
  { nombre: "back", posicion: [5.0, 1.6, 6.6], potencia: 1.6, alcance: 4 },
]);

/** El pie de una lámpara de plató: un trípode simplificado a un mástil y una
 *  pantalla, para que el foco declarado tenga delante algo que lo explique —
 *  sin esto, un charco de luz sin lámpara visible parece un error de render. */
function piezasPie({ posicion: [x, y, z] }) {
  const altoMastil = Math.max(0.1, y - 0.15);
  return [
    { centro: [x, altoMastil / 2, z], medidas: [0.06, altoMastil, 0.06], color: ESTUDIO.pieFoco },
    // Tres patas cortas, a modo de trípode: sin ellas el pie flota sin apoyo.
    ...[0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((angulo) => ({
      centro: [x + Math.cos(angulo) * 0.22, 0.04, z + Math.sin(angulo) * 0.22],
      medidas: [0.05, 0.08, 0.05],
      color: ESTUDIO.pieFoco,
    })),
    // La pantalla, EMISIVA: es lo único de la sala que se pinta a intensidad
    // plena (#555) — un plató con la lámpara apagada y el charco encendido
    // sería la misma mentira que una consola con la pantalla a oscuras.
    {
      centro: [x, y, z],
      medidas: [0.28, 0.22, 0.1],
      color: ESTUDIO.pantallaFoco,
      emisivo: true,
      colision: false,
    },
  ];
}

/* ---- el atrezo ---------------------------------------------------------------- */

/** La silla de director: un asiento y un respaldo, nada más — es atrezo, no
 *  mobiliario para sentarse de verdad. */
function piezasSilla(x, z) {
  return [
    { centro: [x, 0.45, z], medidas: [0.5, 0.06, 0.5], color: ESTUDIO.atril },
    { centro: [x, 0.22, z], medidas: [0.05, 0.44, 0.05], color: ESTUDIO.atrilCanto },
    { centro: [x, 0.75, z - 0.22], medidas: [0.5, 0.6, 0.06], color: ESTUDIO.atril },
  ];
}

/** La cámara sobre su trípode: un cuerpo y un objetivo, apuntando hacia donde
 *  se sienta quien actúa. */
function piezasCamara(x, z) {
  return [
    { centro: [x, 1.1, z], medidas: [0.06, 1.0, 0.06], color: ESTUDIO.pieFoco },
    { centro: [x, 1.15, z], medidas: [0.32, 0.2, 0.22], color: ESTUDIO.atril },
    { centro: [x, 1.15, z + 0.2], medidas: [0.12, 0.12, 0.18], color: ESTUDIO.atrilCanto },
  ];
}

/** La claqueta, apoyada en el suelo junto a la silla: dos franjas y ya está —
 *  lo que la hace reconocible sin gastar una pieza más. */
function piezasClaqueta(x, z) {
  return [
    { centro: [x, 0.18, z], medidas: [0.32, 0.36, 0.03], color: ESTUDIO.claqueta, colision: false },
    { centro: [x, 0.33, z - 0.015], medidas: [0.32, 0.05, 0.01], color: ESTUDIO.claquetaFranja, colision: false },
    { centro: [x, 0.24, z - 0.015], medidas: [0.32, 0.05, 0.01], color: ESTUDIO.claquetaFranja, colision: false },
  ];
}

function mobiliario() {
  return [
    ...piezasSilla(5.0, 5.4),
    ...piezasCamara(5.0, 2.6),
    ...piezasClaqueta(4.3, 5.7),
    ...FOCOS.flatMap(piezasPie),
  ];
}

/* ---- la salida ---------------------------------------------------------------- */

/** Un torno de salida contra el muro de entrada, igual que el museo (#598) y
 *  la cabina de teléfono de la playa (#587): el mismo camino de vuelta a la
 *  cantina, reusando el salto de estancia que ya existe. */
const SALIDA = Object.freeze({
  centro: Object.freeze([ANCHO / 2, 0.55, 0.7]),
  medidas: Object.freeze([1.1, 1.1, 0.35]),
});

export const ENTRADA = Object.freeze({ x: ANCHO / 2, z: 1.8, yaw: 0 });

export const INTERACCIONES = declararInteracciones([
  {
    id: "salida",
    punto: [SALIDA.centro[0], SALIDA.centro[2] + 0.9],
    orientacion: Math.PI,
    accion: { tipo: "estancia", estancia: "cantina" },
  },
]);

/* ---- la sala -------------------------------------------------------------------- */

const SALA = crearSalaCaja({
  ancho: ANCHO,
  profundidad: PROFUNDIDAD,
  mobiliario: [
    ...mobiliario(),
    { centro: [...SALIDA.centro], medidas: [...SALIDA.medidas], color: ESTUDIO.atril },
  ],
  colorMuro: ESTUDIO.muro,
  colorColumna: ESTUDIO.atril,
  // Sin ventanas: un plató es una caja cerrada por definición — lo que ilumina
  // son los focos, no el campo estelar.
  //
  // EL PUNTO DE TODA LA SALA: la piel del muro va TEXTURADA (#584, opción B).
  // Es la única superficie de las trece salas del Phobos donde ese camino
  // está encendido, y a propósito: aquí es donde hay que VER si la
  // subdivisión deja que el rig de arriba pinte un charco de luz recorrible
  // sobre el paño, o si —como en la opción A, un solo cuadrilátero por
  // cara— el muro entero se aclara de golpe.
  pielMuro: "textura",
  // Sin piel de objetos: el atrezo de un plató es atrezo, no chapa de casco
  // remachada — mismo motivo por el que la cantina la apaga en sus muebles.
  pielObjetos: false,
  semillaMural: 20260901,
});

export const PLANTA_ESTUDIO = SALA.planta;

/**
 * Compone el plató. Misma firma que la `componer` de `crearSalaCaja` —es lo
 * que el bucle de andar espera—, pero con el rig de focos SIEMPRE encendido:
 * a diferencia de una sala de la nave, este banco de pruebas no tiene sentido
 * sin su luz declarada, así que no se deja a que alguien la pase por opciones.
 */
export function componerEstudio(x, y, z, yaw, opciones = {}) {
  return SALA.componer(x, y, z, yaw, { ...opciones, focos: FOCOS });
}
