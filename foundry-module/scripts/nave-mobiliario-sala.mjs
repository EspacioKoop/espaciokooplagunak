// La maquinaria de cada sala del Phobos (#560).
//
// Con la piel puesta (#548–#555) las paredes, el suelo y el techo están
// trabajados, y las salas seguían sin un solo mueble más allá de su consola:
// trece cajas bien pintadas y vacías. El contraste con las paredes lo hacía más
// evidente, no menos.
//
// EL DATO YA EXISTE, NO SE INVENTA. «Qué hay en un cuarto de reactor» suena a
// decisión narrativa, y por eso #557 lo dejó fuera. Pero `SALAS_PHOBOS` declara
// el SISTEMA de cada sala, y de ahí sale qué maquinaria le toca — igual que la
// planta salió del `.lua` (#540) y la consola sale de tener puesto (#557). Una
// sala de reactor lleva bancadas y conductos porque aloja el reactor, no porque
// alguien haya decidido que quedan bien.
//
// ES MAQUINARIA, NO ATREZO. Bancadas, armarios de servicio, conductos
// verticales, cajas de registro. Lo que cuelga de las paredes, lo que se ha
// dejado la tripulación por ahí y cualquier cosa que CUENTE algo es contenido de
// campaña y no lo decide quien pinta.
//
// NADA QUE SE PUEDA LEER (#526): ni etiquetas, ni diales, ni pilotos. La misma
// regla que dejó la pantalla de la consola encendida y vacía. Un armario cerrado
// no afirma nada sobre el estado de la nave.
//
// SE COLOCA CONTRA LAS PAREDES Y LEJOS DE LAS PUERTAS. Un mueble sólido mal
// puesto rompe cosas que ya funcionan, y pasó una vez: en #557 la consola
// aterrizaba justo donde se aparece al cruzar desde la sala vecina. Los puntos
// de llegada los declaran las salas VECINAS y aquí no se conocen, pero una
// llegada siempre cae cerca de su puerta, así que apartarse de las puertas basta
// y no acopla este módulo con el resto del catálogo. El centro se deja
// despejado: una sala llena por el medio no se cruza.
//
// Puro y sin color propio (#351). Devuelve piezas con la forma `mobiliario` que
// ya acepta `crearSalaCaja`.

import { VOCABULARIO, colocarProp } from "./nave-props.mjs";
import { rngSemilla } from "./ventana-nave.mjs";

/**
 * La MAQUINARIA: qué props del vocabulario común (#583) puede plantar este
 * módulo.
 *
 * Sigue siendo una lista CERRADA y corta a propósito: cuatro piezas que se
 * combinan, no un mueble distinto por sala. Lo que cambió en #583 es dónde viven
 * sus medidas —en `nave-props.mjs`, con las del resto de la nave, bajo la misma
 * rejilla— y no cuáles son. Una silla no aparece aquí aunque esté en el
 * vocabulario: en un cuarto de reactor no pinta nada.
 *
 * Las medidas son de MÁQUINA: nada llega a la altura de los ojos (1,45) salvo el
 * conducto, que es lo único que se mira hacia arriba.
 */
const MAQUINARIA = Object.freeze(["bancada", "armario", "conducto", "registro"]);

export const CATALOGO = Object.freeze(
  Object.fromEntries(MAQUINARIA.map((clave) => [clave, VOCABULARIO[clave]])),
);

/**
 * Qué maquinaria le toca a cada sistema, y cuánta.
 *
 * Es una tabla y no una fórmula porque es una decisión de ambientación por
 * sistema, y una tabla se lee y se discute. Lo que NO es es una lista por SALA:
 * dos salas del mismo sistema tendrían el mismo material, que es lo correcto en
 * una nave.
 *
 * Las salas sin sistema (las pasarelas, los camarotes) llevan lo mínimo: son
 * tránsito, y llenarlas de máquinas contradice para qué están.
 */
const POR_SISTEMA = Object.freeze({
  Reactor: ["bancada", "bancada", "conducto", "conducto", "armario"],
  Warp: ["bancada", "conducto", "conducto", "registro"],
  JumpDrive: ["bancada", "conducto", "registro"],
  BeamWeapons: ["bancada", "armario", "registro"],
  MissileSystem: ["armario", "armario", "bancada"],
  Impulse: ["bancada", "conducto", "registro"],
  Maneuver: ["bancada", "registro"],
  FrontShield: ["armario", "conducto", "registro"],
  RearShield: ["armario", "conducto", "registro"],
});

/** Lo que lleva una sala sin sistema. */
const SIN_SISTEMA = Object.freeze(["registro"]);

/** Cuánto hay que apartarse de una puerta para no estorbar su paso ni caer
 *  donde aterriza quien la cruza. 2,2 m: el ancho de puerta más el radio de
 *  quien anda, con margen para no rozar. */
const DESPEJE_PUERTA = 2.2;
/** Y de la consola, que necesita su hueco para plantarse delante. */
const DESPEJE_CONSOLA = 1.8;

/**
 * Cuántas veces como mucho se repite la receta de un sistema.
 *
 * Es el tope de presupuesto de este módulo, y va en pasadas y no en muebles
 * porque una pasada es una unidad con sentido: media receta de reactor deja una
 * sala con dos bancadas y ningún conducto, que se lee como que falta algo.
 */
const TOPE_PASADAS = 4;

/**
 * Sitios pegados a la pared donde puede ir un mueble, en orden estable.
 *
 * Recorre el perímetro por dentro dejando un pasillo libre, y devuelve puntos
 * con el eje contra el que se apoyan — un armario contra el muro norte tiene que
 * estar orientado como el muro, no como la sala.
 */
export function sitiosJuntoAlMuro(sala, paso = 2.4) {
  const { ancho, profundidad } = sala;
  const margen = 0.75;
  const sitios = [];
  for (let x = margen + paso / 2; x < ancho - margen; x += paso) {
    sitios.push({ x, z: margen, alLargoDeX: true });
    sitios.push({ x, z: profundidad - margen, alLargoDeX: true });
  }
  for (let z = margen + paso / 2; z < profundidad - margen; z += paso) {
    sitios.push({ x: margen, z, alLargoDeX: false });
    sitios.push({ x: ancho - margen, z, alLargoDeX: false });
  }
  return sitios;
}

/** ¿Está este sitio lo bastante lejos de todo lo que no puede estorbarse? */
function despejado(sitio, { puertas, consola }) {
  for (const { rect } of puertas) {
    const cx = rect.x + rect.ancho / 2;
    const cz = rect.z + rect.profundidad / 2;
    if (Math.hypot(sitio.x - cx, sitio.z - cz) < DESPEJE_PUERTA) return false;
  }
  if (consola) {
    const cx = consola.x + consola.ancho / 2;
    const cz = consola.z + consola.profundidad / 2;
    if (Math.hypot(sitio.x - cx, sitio.z - cz) < DESPEJE_CONSOLA) return false;
  }
  return true;
}

/**
 * La maquinaria de una sala.
 *
 * @param {object} opciones
 * @param {{ancho:number, profundidad:number}} opciones.sala
 * @param {string|null} opciones.sistema el que declara `SALAS_PHOBOS`.
 * @param {Array<{rect:object}>} opciones.puertas
 * @param {object|null} opciones.consola el rect de su zona, si la sala tiene.
 * @param {number} opciones.semilla
 * @returns {Array<{nombre:string, centro:number[], medidas:number[], color:string}>}
 */
export function piezasMobiliarioSala({ sala, sistema, puertas = [], consola = null, semilla = 1 }) {
  const base = POR_SISTEMA[sistema] ?? SIN_SISTEMA;
  // La receta se REPITE con el tamaño de la sala. Con una pasada fija, el
  // reactor (22x22 m) se quedaba con cinco muebles perdidos en un descampado y
  // una sala pequeña salía abarrotada con los mismos cinco. Lo que se mantiene
  // constante es la DENSIDAD —una pieza cada seis metros de muro—, igual que las
  // luminarias mantienen su cadencia en vez de su número (#555).
  const perimetro = 2 * (sala.ancho + sala.profundidad);
  const pasadas = Math.max(1, Math.min(TOPE_PASADAS, Math.round(perimetro / (base.length * 6))));
  const receta = Array.from({ length: pasadas }, () => base).flat();
  const libres = sitiosJuntoAlMuro(sala).filter((sitio) => despejado(sitio, { puertas, consola }));
  if (libres.length === 0) return [];

  // El sorteo elige QUÉ sitio de los libres, no dónde: así una sala estrecha no
  // acaba con todo amontonado en una esquina, y el resultado sigue siendo el
  // mismo en todas las pantallas de la mesa.
  const azar = rngSemilla(semilla >>> 0);
  const barajados = libres
    .map((sitio) => ({ sitio, orden: azar() }))
    .sort((a, b) => a.orden - b.orden)
    .map(({ sitio }) => sitio);

  return receta.slice(0, barajados.length).flatMap((clave, indice) => {
    const sitio = barajados[indice];
    // Un mueble se apoya de LARGO contra su muro: girado, sobresaldría hacia el
    // paso en vez de pegarse a la pared. Un cuarto de vuelta es exactamente el
    // intercambio de ancho y fondo que se hacía a mano antes de #583.
    return colocarProp(clave, {
      x: sitio.x,
      z: sitio.z,
      cuartos: sitio.alLargoDeX ? 0 : 1,
      nombre: `maquina-${clave}-${indice}`,
    }).piezas;
  });
}
