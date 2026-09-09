// El kit de EXTERIORES (#589): lo que la playa descubrió y ya no hay que pagar.
//
// QUÉ ES. La playa (#587) fue el primer exterior del módulo, y midió la
// proporción exacta que este kit existe para invertir: lo que costó fue casi
// todo INFRAESTRUCTURA —el sol declarado, las sombras proyectadas, el terreno
// por franjas—, y lo que de verdad era «la playa» —cuatro tramos de arena, una
// lista de props y dónde va cada uno— costó poco. Mientras esa infraestructura
// siguiera dentro de `playa-escena.mjs`, la playa no sería la primera escena:
// sería la única. Esto es sacarla.
//
// POR QUÉ EL SOL SE DECLARA Y LO DEMÁS SE DERIVA. Una escena de exterior no
// tiene una lista de ajustes de luz: tiene UNA decisión —dónde está el sol— de
// la que cuelga todo lo demás. Cuánto se alarga una sombra es `1 / tan(altura
// del sol)`; hacia dónde se tumba es el contrario del sol en planta. Escritos a
// mano, un día alguien sube el sol y las sombras se quedan donde estaban, que es
// el fallo que delata una escena antes que ningún otro: la luz viene de un sitio
// y las sombras van hacia otro, y aunque nadie sepa decir por qué, se ve.
// Derivados, no puede pasar.
//
// LO QUE NO ESTÁ AQUÍ, y a propósito: el oleaje, la duna, la arena volando y el
// reloj varado siguen en la playa. Son ESA playa, no «exteriores». Un kit que se
// traga también el contenido deja de ser un kit y pasa a ser una escena con
// parámetros — y la siguiente escena tendría que apagarle la mitad de las cosas
// para no ser una playa.
//
// Puro y sin color propio (#351): los colores los pone quien compone.

import { caja, losa } from "./escena-primitivas.mjs";

/* ---- el sol ---------------------------------------------------------------- */

/** Cuánto se levanta del suelo una sombra, para que no pelee con el terreno. */
const ALTURA_SOMBRA = 0.012;

/**
 * Declara el sol de una escena y devuelve todo lo que se deriva de él.
 *
 * `direccion` es hacia dónde ESTÁ la luz —no hacia dónde va—, la misma
 * convención que usa `intensidadCara` en el motor. La componente Y es la altura:
 * bajarla alarga las sombras y hace que la luz rase, que es lo que da a las
 * cosas un lado claro y otro oscuro en vez de dejarlas iluminadas desde arriba.
 */
export function declararSol(direccion) {
  const [sx, sy, sz] = direccion;
  const largo = Math.hypot(sx, sy, sz);
  if (!(largo > 0)) throw new Error("El sol necesita una dirección con largo.");
  if (!(sy > 0)) throw new Error("Un sol bajo el horizonte no ilumina nada.");

  const seno = sy / largo;
  const largoSombra = Math.sqrt(1 - seno * seno) / seno;

  const enPlanta = Math.hypot(sx, sz);
  // Un sol en el cenit no tumba la sombra hacia ningún lado: cualquier rumbo
  // valdría, así que se elige uno en vez de dividir por cero.
  const rumboSombra = enPlanta > 0 ? [-sx / enPlanta, -sz / enPlanta] : [0, -1];

  const sol = {
    direccion: Object.freeze([sx, sy, sz]),
    unitaria: Object.freeze([sx / largo, sy / largo, sz / largo]),
    largoSombra,
    rumboSombra: Object.freeze(rumboSombra),
    sombraDeCaja: (pieza) => sombraDeCaja(sol, pieza),
    sombraDeProp: (piezas) => sombraDeProp(sol, piezas),
    disco: (opciones) => discoDelSol(sol, opciones),
  };
  return Object.freeze(sol);
}

/**
 * La sombra de una caja, tirada por el suelo.
 *
 * El motor no calcula sombras, así que se PINTAN: son geometría, no un cálculo.
 * Y lo que aportan no es sutil — una sombra ATA el objeto al suelo. Sin ella un
 * poste perfectamente apoyado parece flotar.
 *
 * Sale un cuadrilátero y no la silueta exacta: con un sol bajo la sombra es
 * larga y estrecha, y a esa proporción la diferencia entre la silueta real y su
 * huella tirada no se ve. Lo que sí se vería es que no estuviera.
 */
export function sombraDeCaja(sol, { centro, medidas }) {
  const [cx, , cz] = centro;
  const [ancho, alto, fondo] = medidas;
  const [dx, dz] = sol.rumboSombra;
  const largo = alto * sol.largoSombra;
  // El ancho de la sombra se mide PERPENDICULAR a por donde se tumba, o una caja
  // estrecha vista de canto proyectaría una mancha ancha.
  const medio = (Math.abs(dz) * ancho + Math.abs(dx) * fondo) / 2;
  const [px, pz] = [-dz * medio, dx * medio];
  return losa(
    [
      [cx + px, cz + pz],
      [cx - px, cz - pz],
      [cx - px + dx * largo, cz - pz + dz * largo],
      [cx + px + dx * largo, cz + pz + dz * largo],
    ],
    ALTURA_SOMBRA,
  );
}

/**
 * Qué piezas de un prop proyectan sombra: solo las que tocan el suelo.
 *
 * Una a una, una cabina de teléfono tiraría cuatro montantes, un techo y tres
 * cristales, y el resultado sería una maraña de rectángulos superpuestos en vez
 * de una sombra. Se toma la pieza más alta de las que arrancan del suelo, que es
 * la que manda en la silueta, y se le da el ancho de la envolvente del prop.
 */
export function sombraDeProp(sol, piezas) {
  const enPie = piezas.filter(({ centro, medidas }) => centro[1] - medidas[1] / 2 < 0.2);
  if (enPie.length === 0) return null;
  const alta = enPie.reduce((a, b) =>
    a.centro[1] + a.medidas[1] > b.centro[1] + b.medidas[1] ? a : b,
  );
  const anchoTotal = Math.max(...enPie.map(({ medidas }) => medidas[0]));
  const fondoTotal = Math.max(...enPie.map(({ medidas }) => medidas[2]));
  return sombraDeCaja(sol, {
    centro: alta.centro,
    medidas: [anchoTotal, alta.centro[1] + alta.medidas[1] / 2, fondoTotal],
  });
}

/**
 * El disco del sol, colocado donde el sol dice que está.
 *
 * Un cuadrado alineado con los ejes X/Y: a esta distancia y con la rejilla de la
 * época se lee como el disco que es, y cuesta una cara.
 */
export function discoDelSol(sol, { distancia = 330, radio = 16 } = {}) {
  const [ux, uy, uz] = sol.unitaria.map((c) => c * distancia);
  return {
    vertices: [
      [ux - radio, uy - radio, uz],
      [ux + radio, uy - radio, uz],
      [ux + radio, uy + radio, uz],
      [ux - radio, uy + radio, uz],
    ],
    caras: [[0, 1, 2, 3]],
  };
}

/* ---- el terreno ------------------------------------------------------------ */

/** Cuánto grosor se le da a una franja de suelo. */
const GRUESO_FRANJA = 0.4;

/**
 * Una franja de suelo: una losa fina cuya CARA SUPERIOR queda a `alto`.
 *
 * Losa y no plano porque el motor descarta las caras de espaldas, y un plano sin
 * grosor desaparece en cuanto se mira desde el otro lado — una orilla se ve
 * desde los dos.
 */
export function franja({ desde, hasta, z0, z1, alto, color }) {
  return {
    malla: caja(
      [(desde + hasta) / 2, alto - GRUESO_FRANJA / 2, (z0 + z1) / 2],
      [hasta - desde, GRUESO_FRANJA, z1 - z0],
    ),
    color,
  };
}

/**
 * La huella en planta de un prop colocado, para que no se pueda atravesar.
 *
 * Lo que está por encima de la cabeza no estorba al andar: las aspas de un
 * aerogenerador a 44 m de altura no son un muro, y `altura` es dónde se pone esa
 * raya.
 */
export function huellaDe(piezas, { altura = 2 } = {}) {
  return piezas
    .filter(({ centro, medidas }) => centro[1] - medidas[1] / 2 < altura)
    .map(({ centro, medidas }) => ({
      x: centro[0] - medidas[0] / 2,
      z: centro[2] - medidas[2] / 2,
      ancho: medidas[0],
      profundidad: medidas[2],
    }));
}

/**
 * Un valor que da la vuelta dentro de `[0, periodo)`, también con negativos.
 *
 * Es lo que recicla por un borde lo que se sale por el otro — la arena que
 * corre, las crestas que avanzan— para que un reguero no se acabe nunca.
 */
export function ciclo(valor, periodo) {
  return ((valor % periodo) + periodo) % periodo;
}
