// Avatares de la cantina (#423 sobre #362): quién está en la sala.
//
// ESTILO: FF7 ORIGINAL, Y NO ES NOSTALGIA. Aquellos muñecos eran cajas con
// manos como guantes y sin cara, y funcionaban por una razón técnica que aquí
// se repite igual: con pocos polígonos y sin texturas, una figura ESTILIZADA se
// lee y una realista se deshace. Proporción de unas cuatro cabezas —no ocho—,
// manos exageradas para que se vea qué hace, y ni ojos ni boca: la cara la pone
// quien mira. Intentar una figura proporcionada con doce cajas da un espantajo.
//
// LO QUE SE PUEDE USAR SIN PAGAR. Las clases salen del SRD 5.1, publicado bajo
// CC-BY-4.0: las doce están ahí y se pueden nombrar con atribución. Las RAZAS
// son otra historia — el SRD solo trae unas pocas, y las que faltan (dragonborn,
// tiefling, gnome, half-orc, half-elf) NO están bajo esa licencia. Aquí no se
// nombran: quien quiera una escribe la suya en el campo libre, y el catálogo
// ofrece solo lo licenciado más un genérico. Ver `reference_srd_5e_cc_by`.
//
// Puro: ni Foundry, ni DOM, ni red, ni reloj. Recibe una descripción y devuelve
// mallas; quien las pinta y quien las guarda viven fuera.
//
// Frontera de arte (#351): no declara ni un color.

import { AVATAR, FACCIONES, PIXEL, RETRATO } from "./paleta.mjs";
import { caja } from "./cantina-escena.mjs";

/**
 * Clases del SRD 5.1 (CC-BY-4.0). Se nombran por su clave y la traducción vive
 * en `lang/`, que es donde puede decirse en castellano sin pelearse con el
 * nombre propio en inglés de la licencia.
 */
export const CLASES = Object.freeze([
  "barbaro",
  "bardo",
  "clerigo",
  "druida",
  "guerrero",
  "monje",
  "paladin",
  "explorador",
  "picaro",
  "hechicero",
  "brujo",
  "mago",
]);

/**
 * Razas que SÍ podemos nombrar. El SRD 5.1 trae estas; las demás son marca
 * registrada y no entran en el catálogo, ni siquiera "por defecto". `otra` es
 * la salida honesta: quien juega una raza que no está escribe su nombre y el
 * avatar usa el cuerpo genérico.
 */
export const RAZAS = Object.freeze(["humano", "enano", "elfo", "mediano", "otra"]);

/** Presencia, no género biológico: lo que cambia es la silueta, y hay tres
 * porque una silueta neutra es una opción de verdad y no un descarte. */
export const SILUETAS = Object.freeze(["ancha", "estrecha", "neutra"]);

/** Cuánto altera cada raza el cuerpo base. Solo estatura y anchura: el resto
 * es ropa y pelo, que se eligen aparte. Nada de rasgos "propios de raza", que
 * es por donde se cuela la caricatura. */
const CUERPO_POR_RAZA = Object.freeze({
  humano: { alto: 1, ancho: 1 },
  enano: { alto: 0.78, ancho: 1.25 },
  elfo: { alto: 1.06, ancho: 0.92 },
  mediano: { alto: 0.66, ancho: 0.95 },
  otra: { alto: 1, ancho: 1 },
});

const SILUETA_ANCHO = Object.freeze({ ancha: 1.18, estrecha: 0.88, neutra: 1 });

/** Alto total del avatar en unidades de sala, antes de la raza. Una persona
 * junto a una barra de 0.75: esto la deja mirando por encima de ella. */
export const ALTO_BASE = 1.72;

/** Normaliza una descripción venga de donde venga, sin rechazar nada: un avatar
 * mal descrito tiene que aparecer igual, porque no aparecer es peor que
 * aparecer raro. */
export function normalizarAvatar(descripcion = {}) {
  const raza = RAZAS.includes(descripcion.raza) ? descripcion.raza : "humano";
  return {
    nombre: typeof descripcion.nombre === "string" ? descripcion.nombre : "",
    raza,
    clase: CLASES.includes(descripcion.clase) ? descripcion.clase : "guerrero",
    silueta: SILUETAS.includes(descripcion.silueta) ? descripcion.silueta : "neutra",
    pelo: indiceValido(descripcion.pelo, AVATAR.pelos.length),
    piel: indiceValido(descripcion.piel, RETRATO.cascos.length),
    ropa: indiceValido(descripcion.ropa, FACCIONES.length),
  };
}

function indiceValido(valor, cuantos) {
  const n = Number.parseInt(valor, 10);
  return Number.isFinite(n) ? ((n % cuantos) + cuantos) % cuantos : 0;
}

/**
 * Las piezas de un avatar, ya colocadas alrededor de `[x, y, z]` (los pies).
 * Devuelve la misma forma que los muebles de la sala —`{nombre, color, centro,
 * medidas}`— para que la escena no distinga a una persona de un taburete y no
 * haga falta ni un pintor nuevo ni una rama en `componerCantina`.
 */
export function piezasAvatar(descripcion, { pies = [0, 0, 0], indice = 0 } = {}) {
  const av = normalizarAvatar(descripcion);
  const cuerpo = CUERPO_POR_RAZA[av.raza];
  const escala = ALTO_BASE * cuerpo.alto;
  const ancho = cuerpo.ancho * SILUETA_ANCHO[av.silueta];
  const [px, py, pz] = pies;

  const piel = RETRATO.cascos[av.piel];
  const pelo = AVATAR.pelos[av.pelo];
  const ropa = FACCIONES[av.ropa];
  const prefijo = `avatar${indice}`;

  // Cuatro cabezas de alto, repartidas: piernas, torso y una cabeza enorme.
  const altoCabeza = escala * 0.26;
  const altoTorso = escala * 0.36;
  const altoPiernas = escala - altoCabeza - altoTorso;

  const yPiernas = py + altoPiernas / 2;
  const yTorso = py + altoPiernas + altoTorso / 2;
  const yCabeza = py + altoPiernas + altoTorso + altoCabeza / 2;

  return [
    { nombre: `${prefijo}Pierna`, color: piel, centro: [px, yPiernas, pz], medidas: [0.3 * ancho, altoPiernas, 0.26] },
    { nombre: `${prefijo}Torso`, color: ropa, centro: [px, yTorso, pz], medidas: [0.46 * ancho, altoTorso, 0.3] },
    { nombre: `${prefijo}Cabeza`, color: piel, centro: [px, yCabeza, pz], medidas: [0.38 * ancho, altoCabeza, 0.36] },
    // El pelo es una tapa, no una peluca: a esta resolución basta para leerse.
    {
      nombre: `${prefijo}Pelo`,
      color: pelo,
      centro: [px, yCabeza + altoCabeza * 0.42, pz - 0.02],
      medidas: [0.42 * ancho, altoCabeza * 0.34, 0.4],
    },
    // Manos como guantes, a los lados y grandes: es la firma de aquel estilo y
    // además es lo único que deja ver a distancia qué está haciendo alguien.
    {
      nombre: `${prefijo}ManoIzq`,
      color: piel,
      centro: [px - 0.3 * ancho, yTorso - altoTorso * 0.2, pz + 0.06],
      medidas: [0.16, 0.16, 0.16],
    },
    {
      nombre: `${prefijo}ManoDer`,
      color: piel,
      centro: [px + 0.3 * ancho, yTorso - altoTorso * 0.2, pz + 0.06],
      medidas: [0.16, 0.16, 0.16],
    },
    // Y lo que lleva encima, que es lo que dice la clase de un vistazo.
    ...distintivoDeClase(av.clase, { px, py: yTorso, pz, ancho, altoTorso, prefijo }),
  ].map((pieza) => Object.freeze(pieza));
}

/**
 * El distintivo de la clase: una pieza, no un equipo completo. Lo que se busca
 * es reconocer a alguien al otro lado de la sala, no inventariar su mochila —y
 * a esta resolución dos cajas más ya son una mancha.
 */
function distintivoDeClase(clase, { px, py, pz, ancho, altoTorso, prefijo }) {
  const alHombro = (color, medidas) => [
    {
      nombre: `${prefijo}Distintivo`,
      color,
      centro: [px + 0.34 * ancho, py + altoTorso * 0.35, pz - 0.16],
      medidas,
    },
  ];
  switch (clase) {
    // Armas al hombro: la silueta de un mandoble asomando por encima es
    // exactamente cómo se reconocía a un personaje en aquellos juegos.
    case "guerrero":
    case "paladin":
    case "barbaro":
      return alHombro(AVATAR.acero, [0.09, altoTorso * 1.5, 0.09]);
    case "picaro":
    case "explorador":
      return alHombro(AVATAR.acero, [0.07, altoTorso * 0.9, 0.07]);
    // Báculos y varas, más largos y de madera.
    case "mago":
    case "hechicero":
    case "brujo":
    case "druida":
      return alHombro(AVATAR.madera, [0.08, altoTorso * 1.8, 0.08]);
    case "clerigo":
      return alHombro(AVATAR.simbolo, [0.16, 0.22, 0.06]);
    case "bardo":
      return alHombro(AVATAR.madera, [0.28, altoTorso * 0.7, 0.1]);
    // El monje no lleva nada, y eso también es un distintivo.
    default:
      return [];
  }
}

/**
 * Dónde se coloca cada quien en la cantina. Los sitios son fijos y en orden
 * estable: quien entra ocupa el primero libre y no baila de sitio entre
 * fotogramas, que es lo que convertiría a la tripulación en un parpadeo.
 *
 * Están de cara a la barra o de cara a las mesas, nunca mirando a cámara.
 */
export const SITIOS = Object.freeze([
  Object.freeze({ pies: [-2.4, -1.75, 2.4] }),
  Object.freeze({ pies: [-0.8, -1.75, 2.4] }),
  Object.freeze({ pies: [0.8, -1.75, 2.4] }),
  Object.freeze({ pies: [2.4, -1.75, 2.4] }),
  Object.freeze({ pies: [-3.6, -1.75, 4.6] }),
  Object.freeze({ pies: [3.9, -1.75, 3.2] }),
]);

/**
 * Las piezas de toda la gente que hay en la sala.
 *
 * @param {Array<object>} gente descripciones de avatar, en orden estable.
 * @param {{omitirId?: string}} opciones `omitirId` es quien mira: no se pinta a
 *   sí mismo, porque la cámara está en sus ojos y solo vería su propia nuca.
 */
export function piezasDeLaGente(gente = [], { omitirId = null } = {}) {
  if (!Array.isArray(gente)) return [];
  const piezas = [];
  let sitio = 0;
  for (const persona of gente) {
    if (!persona) continue;
    if (omitirId && persona.id === omitirId) continue;
    if (sitio >= SITIOS.length) break;
    piezas.push(...piezasAvatar(persona, { pies: SITIOS[sitio].pies, indice: sitio }));
    sitio += 1;
  }
  return piezas;
}
