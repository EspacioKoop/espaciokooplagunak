// La playa de pruebas (#587): el primer EXTERIOR del módulo.
//
// PARA QUÉ ESTÁ. Es un banco de pruebas de los puntos de interacción (#582) y
// del vocabulario de props (#583) antes de gastarlos en la terraza de #579, que
// sí tiene que quedar bien. Una sala de nave más no probaría nada que las trece
// del Phobos no prueben ya; un exterior rompe TODOS los supuestos de
// `crearSalaCaja` a la vez —no hay caja, ni techo, ni rodapié, el suelo tiene
// pendiente, hay geometría a cientos de metros y el fondo no es gris de
// mamparo—, y eso es exactamente lo que interesa descubrir aquí y no allí.
//
// LAS REFERENCIAS SON KINGDOM HEARTS Y DIGIMON ADVENTURE. La cabina de teléfono
// plantada en mitad de la arena viene de la segunda, y no es un chiste interno:
// es el elemento que convierte una playa genérica en un SITIO. Sin ella esto es
// un degradado de arena; con ella, alguien pregunta qué hace ahí.
//
// LO QUE ESTA ESCENA DEJA AL DESCUBIERTO, a propósito y documentado: el motor de
// movimiento no tiene altura de terreno (`nave-movimiento.mover` resuelve en
// planta y `y` es solo salto/agachado). Se anda por la duna a cota cero, así que
// la duna sube MUY poco —lo que se hunden los pies es proporcional a lo que
// suba— y a partir de cierta altura pasa a ser obstáculo. No es un descuido
// disimulado: es el primer límite que este banco de pruebas ha encontrado.
//
// LA LUZ ES LA MITAD DE LA ESCENA, Y SE COMPONE COMO SE COMPONE UN CUADRO.
// La primera versión se veía plana y el motivo no era la geometría: era que el
// motor solo tenía una direccional de interior de nave y sombrear consistía en
// bajarle el brillo al mismo color. Cuatro decisiones lo arreglan, y las cuatro
// son de pintura, no de código:
//
//  1. UN SOL BAJO, y colocado. Puesto sobre el mar y casi en el horizonte, la
//     luz RASA en vez de caer a plomo: las cosas dejan de estar iluminadas por
//     arriba y pasan a tener un lado claro y otro oscuro. Es lo que hace que un
//     poste sea un cilindro y no una raya.
//  2. CÁLIDO CONTRA FRÍO. El sol tiñe de ámbar lo que toca; la sombra la rellena
//     el cielo, que es azul. Sin esa oposición no hay volumen aunque haya
//     degradado — es la lección que separa un dibujo coloreado de una pintura.
//  3. SOMBRAS PROYECTADAS SOBRE LA ARENA. El motor no las calcula, así que se
//     pintan: con el sol tan bajo son largas y cruzan el camino en diagonal.
//     Además de dar volumen, ATAN cada objeto al suelo — sin sombra, un poste
//     flota aunque esté perfectamente apoyado.
//  4. PERSPECTIVA AÉREA. Lo lejano se aclara y se enfría hacia el color del
//     cielo. Es literalmente lo que escribió Leonardo, y aquí lo hace la niebla
//     del motor con `fondo: PLAYA.cielo`.
//
// Y la composición: el sol se sitúa DELANTE Y A LA DERECHA de quien entra, de
// modo que el camino de luz sobre el agua entra por la esquina y lleva el ojo al
// horizonte, los postes se recortan a contraluz contra el cielo claro, y sus
// sombras y las de las rocas cruzan el camino hacia el espectador. Es el reparto
// de Claude Lorrain —sol bajo sobre el agua, verticales que enmarcan, líneas que
// fugan— y funciona igual con doscientos polígonos que con óleo.
//
// Puro y sin color propio (#351): los colores salen de `PLAYA` en `paleta.mjs`.

import { PLAYA } from "./paleta.mjs";
import { caja } from "./cantina-escena.mjs";
import { componerEscena, fundirEscenas } from "./retro3d.mjs";
import { resolverCamara } from "./nave-camara.mjs";
import { poligonosOtrosJugadores } from "./nave-avatares-render.mjs";
import { crearPlanta } from "./nave-movimiento.mjs";
import { rngSemilla } from "./ventana-nave.mjs";
import { colocarProp, definirVocabulario } from "./nave-props.mjs";
import { declararInteracciones } from "./nave-interaccion.mjs";

/* ---- medidas de la playa -------------------------------------------------- */

/**
 * La franja jugable, en metros. `ancho` es el eje X y va de tierra (0) a mar
 * (24); `profundidad` es el eje Z y es por donde se pasea a lo largo.
 *
 * Las cotas de cada franja se escriben una vez aquí porque la escena se lee de
 * izquierda a derecha y así se puede comprobar de un vistazo que suman lo que
 * pide el encargo: cinco metros lisos, un camino ancho, la duna a la izquierda y
 * los postes a otros cinco metros del camino.
 */
export const ANCHO = 24;
export const PROFUNDIDAD = 44;

/** Donde empieza el agua. A partir de aquí no se pasa. */
const ORILLA = 19;
/** Los cinco metros lisos: arena que acaba de dejar el mar. */
const LISO_DESDE = 14;
/** El camino ancho de arena fina, seis metros de ida y vuelta. */
const CAMINO_DESDE = 8;
/** Los postes, a cinco metros del borde del camino. */
const X_POSTES = CAMINO_DESDE - 5;

/** Cada cuánto hay un poste, a lo largo de Z. */
const PASO_POSTES = 8;
const Z_POSTES = Object.freeze([4, 12, 20, 28, 36]);

/**
 * La cabina, al fondo y AL BORDE del camino, no en medio.
 *
 * Estuvo centrada y era un tapón: es sólida, mide un metro y el camino tiene
 * seis, así que plantada en el eje partía en dos el único paso de la escena. Lo
 * cazó la prueba que recorre el camino de punta a punta, no el ojo.
 */
const CABINA = Object.freeze({ x: 13.2, z: 40.5 });

/**
 * La duna: terrazas de un metro que suben muy poco cada una.
 *
 * Sube 6 cm por metro. Con el motor de movimiento sin altura de terreno, la
 * pendiente que se puede pisar es la que no se nota al pisarla: 6 cm es un
 * escalón que no se ve desde 1,45 m de altura de ojos, y a lo largo de los
 * catorce metros que se ven acumula casi un metro, que sí se lee como duna.
 */
const PASO_DUNA = 1;
const SUBIDA_DUNA = 0.06;
/** A partir de esta altura la duna deja de pisarse y pasa a ser obstáculo. */
const DUNA_INFRANQUEABLE = 0.3;
/** La duna sigue más allá del borde jugable: cortarla en seco delataría la caja. */
const DUNA_HASTA = -16;

/* ---- la rosa de los vientos ------------------------------------------------ */

// EL NORTE ES LA CABINA. Se fija aquí, una vez, porque en cuanto la escena tiene
// viento hay que poder decir de dónde sopla sin señalar con el dedo:
//
//   Norte = +z  (hacia la cabina, el fondo del camino)
//   Este  = +x  (el mar)
//   Sur   = -z  (por donde se entra)
//   Oeste = -x  (la duna)
//
// EL VIENTO SOPLA HACIA EL ESTE: de la duna al mar. Es viento TERRAL, y eso no
// es un detalle decorativo — decide cómo se ve todo lo blando de la escena:
// la hierba se tumba hacia el mar, los rizos de arena se forman de norte a sur
// (siempre perpendiculares al viento), el agua de la orilla queda planchada
// porque el viento la empuja hacia fuera, y la espuma que se levanta sale
// disparada mar adentro. Un viento que no hace todo eso a la vez es un viento
// que no se cree nadie.
export const VIENTO = Object.freeze([1, 0]); // hacia el este (+x)

/* ---- el sol ---------------------------------------------------------------- */

/**
 * Hacia dónde está el sol, desde cualquier punto de la playa.
 *
 * Es la dirección HACIA la luz, la misma convención que usa `intensidadCara`.
 * Sobre el mar (+x), muy bajo (la componente Y es la que fija la altura) y algo
 * por delante de quien entra (+z), que es lo que pone el camino de luz del agua
 * en diagonal hacia la esquina en vez de plano contra el horizonte.
 */
export const SOL = Object.freeze([0.72, 0.34, 0.52]);

/** El tinte que va con ese sol: ámbar en la luz, azul de cielo en la sombra. */
const TINTE = Object.freeze({ calida: PLAYA.luzSol, fria: PLAYA.sombraCielo });

/**
 * Cuánto se alarga la sombra de algo de un metro de alto.
 *
 * Es `1 / tan(altura del sol)`, sacado del propio `SOL` en vez de escrito a
 * mano: si alguien sube o baja el sol, las sombras se alargan o se acortan solas.
 * Escribirlo aparte es garantizar que un día la luz venga de un sitio y las
 * sombras de otro, que es el fallo que delata una escena antes que ningún otro.
 */
export const LARGO_SOMBRA = (() => {
  const largo = Math.hypot(SOL[0], SOL[1], SOL[2]);
  const seno = SOL[1] / largo;
  return Math.sqrt(1 - seno * seno) / seno;
})();

/** Hacia dónde se tumba una sombra, en planta: el contrario del sol. */
export const RUMBO_SOMBRA = (() => {
  const largo = Math.hypot(SOL[0], SOL[2]);
  return [-SOL[0] / largo, -SOL[2] / largo];
})();

/* ---- props propios de la playa -------------------------------------------- */

/**
 * El vocabulario de la PLAYA, aparte del de la nave.
 *
 * Se comparte la maquinaria de `nave-props.mjs` (partes, giro, ancla,
 * envolvente) y NO la lista: un poste de luz y un aerogenerador en el catálogo
 * de la nave harían largo justo el catálogo que ese módulo mantiene corto a
 * propósito. Son piezas que no pintan nada juntas.
 */
export const VOCABULARIO_PLAYA = definirVocabulario({
  /**
   * Poste de luz: mástil, dos travesaños y la luminaria colgada.
   *
   * El travesaño superior es el que lleva los cables y por eso está donde está;
   * la luminaria cuelga hacia el camino (+z al declararla, se gira al colocarla).
   */
  poste: {
    color: PLAYA.poste,
    partes: [
      { medidas: [0.22, 5.4, 0.22], centro: [0, 2.7, 0] },
      { medidas: [1.5, 0.1, 0.1], centro: [0, 5.1, 0] },
      { medidas: [1.1, 0.09, 0.09], centro: [0, 4.6, 0] },
      { medidas: [0.12, 0.5, 0.12], centro: [0, 4.15, 0.55] },
      { medidas: [0.4, 0.16, 0.4], centro: [0, 3.85, 0.55] },
    ],
    ancla: null,
  },

  /**
   * Cabina de teléfono: cuatro montantes, techo, base y tres cristales.
   *
   * Los cristales son parte con COLOR PROPIO, no una cabina de un solo tono: sin
   * ellos la cabina es un armario rojo. El motor no dibuja transparencias, así
   * que el vidrio se resuelve como lo resolvía la época — un color frío que se
   * lee como reflejo del cielo.
   *
   * La puerta mira a +z; el ancla se planta delante, mirándola.
   */
  cabina: {
    color: PLAYA.cabina,
    partes: [
      { medidas: [1.0, 0.12, 1.0], centro: [0, 0.06, 0] },
      { medidas: [0.12, 2.3, 0.12], centro: [-0.44, 1.2, -0.44] },
      { medidas: [0.12, 2.3, 0.12], centro: [0.44, 1.2, -0.44] },
      { medidas: [0.12, 2.3, 0.12], centro: [-0.44, 1.2, 0.44] },
      { medidas: [0.12, 2.3, 0.12], centro: [0.44, 1.2, 0.44] },
      { medidas: [1.1, 0.22, 1.1], centro: [0, 2.44, 0] },
      { medidas: [1.05, 0.1, 1.05], centro: [0, 2.62, 0], color: PLAYA.cabinaTecho },
      { medidas: [0.8, 1.7, 0.06], centro: [0, 1.35, -0.46], color: PLAYA.cristal },
      { medidas: [0.06, 1.7, 0.8], centro: [-0.46, 1.35, 0], color: PLAYA.cristal },
      { medidas: [0.06, 1.7, 0.8], centro: [0.46, 1.35, 0], color: PLAYA.cristal },
    ],
    ancla: { centro: [0, 1.3], orientacion: Math.PI },
  },

  /**
   * Roca: tres bloques desiguales, uno de ellos con la cara al sol de otro tono.
   *
   * Tres y no uno porque una roca de una caja es una caja. Y desiguales porque
   * lo que hace que algo parezca piedra y no mueble es que ninguna medida sea
   * redonda ni repita a la anterior.
   */
  roca: {
    color: PLAYA.roca,
    partes: [
      { medidas: [1.3, 0.7, 1.1], centro: [0, 0.3, 0] },
      { medidas: [0.9, 0.5, 0.8], centro: [0.35, 0.72, -0.15], color: PLAYA.rocaClara },
      { medidas: [0.6, 0.35, 0.7], centro: [-0.42, 0.5, 0.25] },
    ],
    ancla: null,
  },

  /** Madera de deriva: un tronco tumbado y dos ramas. Marca la línea de marea. */
  madera: {
    color: PLAYA.madera,
    partes: [
      { medidas: [2.6, 0.28, 0.3], centro: [0, 0.14, 0] },
      { medidas: [0.7, 0.14, 0.14], centro: [1.1, 0.22, 0.28] },
      { medidas: [0.5, 0.12, 0.12], centro: [-0.9, 0.2, -0.24] },
    ],
    ancla: null,
  },

  /**
   * Matojo de duna: cuatro manojos de hierba, uno seco.
   *
   * Es lo que hace que la duna sea duna y no un montón de arena: la hierba es
   * literalmente lo que la sujeta. Y en el cuadro cumple otra función —rompe la
   * pendiente lisa con verticales pequeñas, que es lo que le da escala.
   */
  matojo: {
    color: PLAYA.matojo,
    partes: [
      // TUMBADA HACIA EL ESTE. Cada manojo son dos tramos: el que sale del suelo
      // casi vertical y el que ya se ha rendido y se va con el viento. Es la
      // única forma de inclinar algo en un motor que solo compone cajas
      // alineadas con los ejes, y a este tamaño se lee perfectamente como
      // hierba peinada — que es lo que hace un terral constante.
      { medidas: [0.09, 0.38, 0.09], centro: [0, 0.19, 0] },
      { medidas: [0.34, 0.1, 0.09], centro: [0.18, 0.42, 0] },
      { medidas: [0.08, 0.3, 0.08], centro: [-0.13, 0.15, 0.12] },
      { medidas: [0.28, 0.09, 0.08], centro: [0.04, 0.33, 0.12] },
      { medidas: [0.07, 0.26, 0.07], centro: [0.14, 0.13, -0.14], color: PLAYA.matojoSeco },
      { medidas: [0.3, 0.08, 0.07], centro: [0.33, 0.29, -0.14], color: PLAYA.matojoSeco },
    ],
    ancla: null,
  },

  /**
   * Manga de viento: el mástil y el cono, que se estrecha hacia el este.
   *
   * Es el prop que dice el viento SIN que haya que deducirlo. Todo lo demás
   * —hierba tumbada, rizos, espuma a sotavento— es coherente con él, pero
   * requiere saber mirar; una manga hinchada la lee cualquiera de un vistazo, y
   * además dice la dirección exacta, que es justo lo que un dato ambiental
   * debería hacer.
   *
   * El cono va en tres tramos que se estrechan: es la única forma de que un
   * motor de cajas dibuje algo que se afila.
   */
  manga: {
    color: PLAYA.manga,
    partes: [
      { medidas: [0.16, 3.6, 0.16], centro: [0, 1.8, 0] },
      { medidas: [1.0, 0.7, 0.7], centro: [0.62, 3.3, 0], color: PLAYA.mangaFranja },
      { medidas: [1.0, 0.55, 0.55], centro: [1.58, 3.28, 0] },
      { medidas: [1.0, 0.38, 0.38], centro: [2.5, 3.24, 0], color: PLAYA.mangaFranja },
    ],
    ancla: null,
  },

  /** Boya: el cuerpo naranja, el mástil y el remate. Puntos vivos en el agua. */
  boya: {
    color: PLAYA.boya,
    partes: [
      { medidas: [0.8, 0.6, 0.8], centro: [0, 0.3, 0] },
      { medidas: [0.12, 1.1, 0.12], centro: [0, 1.1, 0] },
      { medidas: [0.3, 0.16, 0.3], centro: [0, 1.7, 0] },
    ],
    ancla: null,
  },

  /**
   * Aerogenerador: torre, góndola y aspas en cruz.
   *
   * EN CRUZ Y NO EN TRES ASPAS, que es como son de verdad. El motor compone
   * cajas alineadas con los ejes y no sabe girar una pieza 120°: unas aspas «a
   * 120°» saldrían como sus cajas envolventes, o sea, tres bloques gordos. Una
   * cruz de cuatro aspas finas es geometría honesta, se lee inequívocamente como
   * aerogenerador a la distancia a la que está, y no finge una precisión que el
   * motor no tiene. La alternativa correcta —rotación libre— es #573/#556, no
   * esto.
   */
  aerogenerador: {
    color: PLAYA.torre,
    partes: [
      { medidas: [3.2, 44, 3.2], centro: [0, 22, 0] },
      { medidas: [3.0, 3.2, 6.0], centro: [0, 44.5, 0] },
      { medidas: [1.4, 34, 0.6], centro: [0, 44.5, -3.2], color: PLAYA.aspa },
      { medidas: [34, 1.4, 0.6], centro: [0, 44.5, -3.2], color: PLAYA.aspa },
    ],
    ancla: null,
  },
});

/**
 * Lo que llena la playa, colocado a mano.
 *
 * A MANO Y NO POR SORTEO. Un generador reparte cosas; una escena las COLOCA. Las
 * rocas y la madera están donde están porque su sombra cruza el camino a la
 * altura a la que el ojo ya iba —tercio de la profundidad, tercio del ancho— y
 * porque dejan libre el paso. Un sorteo habría acertado la densidad y fallado
 * justo eso.
 */
const ROCAS = Object.freeze([
  { x: 15.6, z: 12, cuartos: 0 },
  { x: 17.2, z: 27, cuartos: 1 },
  { x: 16.1, z: 34.5, cuartos: 2 },
  { x: 9.4, z: 21, cuartos: 3 },
]);

const MADERAS = Object.freeze([
  { x: 15.2, z: 19.5, cuartos: 1 },
  { x: 17, z: 6.5, cuartos: 0 },
]);

/** Los matojos suben por la duna: cuantos más arriba, más juntos. */
const MATOJOS = Object.freeze([
  { x: 7.2, z: 3 }, { x: 6.4, z: 9.5 }, { x: 7.5, z: 16 }, { x: 5.9, z: 23 },
  { x: 6.8, z: 30 }, { x: 7.1, z: 38 }, { x: 4.6, z: 6 }, { x: 4.1, z: 18 },
  { x: 3.8, z: 33 }, { x: 2.4, z: 11 }, { x: 2.1, z: 26 }, { x: 1.6, z: 41 },
  { x: 5.2, z: 43 }, { x: 8.2, z: 25.5 },
]);

/** Boyas fondeadas: cerca, para que se lea que el agua tiene profundidad. */
const BOYAS = Object.freeze([
  { x: 26, z: 9 },
  { x: 31, z: 31 },
  { x: 22.5, z: 21 },
]);

/** Dónde están los aerogeneradores, mar adentro. Lejos y a distintas
 *  distancias: puestos en fila se leerían como una valla, no como un parque. */
const AEROGENERADORES = Object.freeze([
  { x: 78, z: 2 },
  { x: 104, z: 26 },
  { x: 138, z: 12 },
  { x: 166, z: 40 },
]);

/* ---- el terreno ----------------------------------------------------------- */

/**
 * Una franja de suelo: una losa fina cuya CARA SUPERIOR queda a `alto`.
 *
 * Losa y no plano porque el motor descarta las caras de espaldas, y un plano sin
 * grosor desaparece en cuanto se mira desde el otro lado — la orilla se ve desde
 * los dos.
 */
function franja({ desde, hasta, z0, z1, alto, color }) {
  const GRUESO = 0.4;
  return {
    malla: caja(
      [(desde + hasta) / 2, alto - GRUESO / 2, (z0 + z1) / 2],
      [hasta - desde, GRUESO, z1 - z0],
    ),
    color,
  };
}

/** Las terrazas de la duna, de dentro hacia fuera, con su canto en sombra. */
function terrazasDuna() {
  const piezas = [];
  let alto = 0;
  for (let x = CAMINO_DESDE; x > DUNA_HASTA; x -= PASO_DUNA) {
    alto += SUBIDA_DUNA;
    piezas.push(
      franja({ desde: x - PASO_DUNA, hasta: x, z0: -8, z1: PROFUNDIDAD + 8, alto, color: PLAYA.duna }),
      // El canto: sin él, dos terrazas del mismo color son un plano. Va justo en
      // el escalón, mirando al mar, que es de donde viene la luz.
      //
      // Fino a propósito (la mitad del escalón, no el escalón entero). Con el
      // canto completo la duna se leía como campo arado —rayas negras paralelas
      // de arriba abajo del cuadro— en vez de como arena. A la mitad se lee como
      // lo que es: la cresta de un rizo de arena, que además es exactamente lo
      // que un sol rasante dibuja en una duna de verdad.
      {
        malla: caja(
          [x, alto - SUBIDA_DUNA / 4, PROFUNDIDAD / 2 - 4],
          [0.04, SUBIDA_DUNA / 2, PROFUNDIDAD + 16],
        ),
        color: PLAYA.dunaSombra,
      },
    );
  }
  return piezas;
}

/** Los obstáculos de la planta: el agua, la duna alta y lo que ocupa un prop. */
function obstaculosDeTerreno() {
  const obstaculos = [
    // El mar. No se nada en esta escena (#587 lo deja fuera a propósito).
    { x: ORILLA, z: -1, ancho: ANCHO - ORILLA + 1, profundidad: PROFUNDIDAD + 2 },
  ];
  // Donde la duna pasa de la altura que se puede pisar sin notarlo, se bloquea.
  const metrosPisables = Math.floor(DUNA_INFRANQUEABLE / SUBIDA_DUNA) * PASO_DUNA;
  const bordePisable = Math.max(CAMINO_DESDE - metrosPisables, 0);
  if (bordePisable > 0) {
    obstaculos.push({ x: -1, z: -1, ancho: bordePisable + 1, profundidad: PROFUNDIDAD + 2 });
  }
  return obstaculos;
}

/* ---- la escena ------------------------------------------------------------ */

/** Todo lo que se planta sobre la arena, ya colocado. */
function propsColocados() {
  const puestos = [];

  for (const [indice, z] of Z_POSTES.entries()) {
    // Girados media vuelta: la luminaria cuelga hacia el camino, que está a la
    // derecha (+x) de los postes... y el prop la declara hacia +z, así que un
    // cuarto de vuelta la lleva a +x.
    puestos.push(
      colocarProp("poste", {
        x: X_POSTES,
        z,
        cuartos: 1,
        nombre: `poste-${indice}`,
        vocabulario: VOCABULARIO_PLAYA,
      }),
    );
  }

  puestos.push(
    colocarProp("cabina", {
      x: CABINA.x,
      z: CABINA.z,
      cuartos: 2, // la puerta mira hacia quien llega andando por el camino
      nombre: "cabina",
      vocabulario: VOCABULARIO_PLAYA,
    }),
  );

  const enPlaya = (clave) => (sitio, indice) =>
    colocarProp(clave, { ...sitio, nombre: `${clave}-${indice}`, vocabulario: VOCABULARIO_PLAYA });

  // La manga, junto al primer poste y a la altura por la que se entra: se ve
  // desde el arranque sin tener que buscarla.
  puestos.push(colocarProp("manga", { x: 4.6, z: 5, nombre: "manga", vocabulario: VOCABULARIO_PLAYA }));

  puestos.push(
    ...ROCAS.map(enPlaya("roca")),
    ...MADERAS.map(enPlaya("madera")),
    ...MATOJOS.map(enPlaya("matojo")),
    ...BOYAS.map(enPlaya("boya")),
  );

  for (const [indice, sitio] of AEROGENERADORES.entries()) {
    puestos.push(
      colocarProp("aerogenerador", {
        ...sitio,
        nombre: `aerogenerador-${indice}`,
        vocabulario: VOCABULARIO_PLAYA,
      }),
    );
  }

  return puestos;
}

/** El mar sigue mucho más allá del borde jugable, o se vería su canto. */
const MAR_HASTA = 380;

/* ---- arena y mar: lo que hace el viento ------------------------------------ */

/**
 * Los rizos de la arena.
 *
 * PERPENDICULARES AL VIENTO, no en cualquier dirección: el viento sopla al este,
 * así que las crestas corren de norte a sur. Es la única orientación posible y
 * por eso sale del propio `VIENTO` en vez de escribirse. Si alguien gira el
 * viento, los rizos giran con él.
 *
 * Van sobre la arena seca del camino y sobre la duna, y NO sobre los cinco
 * metros lisos: ahí el agua acaba de pasar y los ha borrado. Que la arena mojada
 * esté lisa y la seca rizada es medio motivo de que se distingan.
 */
const PASO_RIZO = 0.55;
const ALTO_RIZO = 0.035;

function rizosDeArena(desde, hasta, z0, z1, base, color) {
  const piezas = [];
  const azar = rngSemilla(20260817);
  for (let x = desde; x < hasta; x += PASO_RIZO) {
    // La cresta se desvía un poco en cada tramo: un rizo perfectamente recto de
    // cuarenta metros es un listón, no arena.
    const desvio = (azar() - 0.5) * 0.12;
    piezas.push({
      malla: caja(
        [x + desvio, base + ALTO_RIZO / 2, (z0 + z1) / 2],
        [0.16, ALTO_RIZO, z1 - z0],
      ),
      color,
    });
  }
  return piezas;
}

/**
 * Las lenguas de agua que dejó la marea al bajar.
 *
 * Arcos de arena más oscura sobre los cinco metros lisos. Son lo que convierte
 * una franja plana en una PLAYA: sin ellas, la arena mojada es un rectángulo de
 * otro color, y es exactamente lo que se veía.
 */
function marcasDeMarea() {
  const azar = rngSemilla(20260818);
  const piezas = [];
  for (let z = -4; z < PROFUNDIDAD + 6; z += 3.1) {
    const alcance = ORILLA - 1.2 - azar() * 3.4;
    const largo = 1.9 + azar() * 1.5;
    piezas.push({
      malla: caja([(alcance + ORILLA) / 2, 0.008, z], [ORILLA - alcance, 0.02, largo]),
      color: PLAYA.marMarca,
    });
  }
  return piezas;
}

/**
 * La línea de restos que marca hasta dónde llegó el agua: algas y astillas.
 *
 * Un solo detalle, y es el que más playa aporta por polígono gastado — es lo
 * primero que el ojo reconoce de una playa de verdad.
 */
function lineaDeRestos() {
  const azar = rngSemilla(20260819);
  const piezas = [];
  for (let z = -4; z < PROFUNDIDAD + 6; z += 0.7) {
    if (azar() > 0.62) continue;
    const x = LISO_DESDE + 0.4 + azar() * 1.3;
    piezas.push({
      malla: caja([x, 0.02, z + azar() * 0.4], [0.18 + azar() * 0.35, 0.05, 0.1 + azar() * 0.2]),
      color: azar() > 0.5 ? PLAYA.alga : PLAYA.madera,
    });
  }
  return piezas;
}

/**
 * Las bandas del mar.
 *
 * Un mar de un solo color no tiene ni profundidad ni superficie. Tres bandas
 * paralelas a la orilla —bajío, medio, abierto— y encima las crestas.
 */
const BANDAS_MAR = Object.freeze([
  { desde: ORILLA, hasta: 27, color: PLAYA.marBajio },
  { desde: 27, hasta: 58, color: PLAYA.mar },
  { desde: 58, hasta: MAR_HASTA, color: PLAYA.marLejos },
]);

/* ---- lo que el viento MUEVE ------------------------------------------------ */

/**
 * Un viento que no mueve nada no es viento: es una hierba torcida.
 *
 * Esa fue la corrección más útil de todo el playtest. La primera versión tenía
 * la hierba tumbada, los rizos perpendiculares y la espuma a sotavento —todo
 * coherente— y aun así no se notaba, porque **quieto no hay viento que valga**.
 * El ojo no deduce viento de una forma; lo reconoce de un movimiento.
 *
 * Lo que se mueve va aparte de `PIEZAS` y se regenera en cada fotograma con el
 * reloj que pasa el bucle. Es barato —unas decenas de cuadriláteros— y es lo que
 * separa un decorado de un sitio donde hace un día de viento.
 */

/** A qué velocidad corre lo que arrastra el viento, en metros por segundo. */
const VELOCIDAD_VIENTO = 7.5;

/** Módulo positivo: `%` en JS conserva el signo y con tiempos grandes da saltos. */
function ciclo(valor, periodo) {
  return ((valor % periodo) + periodo) % periodo;
}

/**
 * La arena que corre a ras de suelo.
 *
 * Es LO que hace ver el viento en una playa de verdad: no la duna ni la hierba,
 * sino esas lenguas bajas que cruzan la arena y desaparecen. Van pegadas al
 * suelo, son alargadas en la dirección del viento y se reciclan por el borde de
 * poniente para que el reguero no se acabe nunca.
 */
const LENGUAS_ARENA = 26;

function arenaVolando(segundos) {
  const azar = rngSemilla(20260821);
  const piezas = [];
  const anchoBarrido = LISO_DESDE - DUNA_HASTA;
  for (let i = 0; i < LENGUAS_ARENA; i += 1) {
    // Cada lengua tiene su carril, su fase y su velocidad: a la misma velocidad
    // se leerían como una rejilla desplazándose, no como arena suelta.
    const z = -6 + azar() * (PROFUNDIDAD + 12);
    const velocidad = VELOCIDAD_VIENTO * (0.7 + azar() * 0.6);
    const x = DUNA_HASTA + ciclo(azar() * anchoBarrido + segundos * velocidad, anchoBarrido);
    const largo = 1.2 + azar() * 2.6;
    // Se levanta un poco a media carrera y vuelve a caer: la arena no vuela a
    // altura constante, y ese subir y bajar es la mitad de la lectura.
    const alturaBase = terrenoEn(x);
    const soplo = 0.02 + 0.09 * Math.abs(Math.sin(segundos * 1.7 + i));
    piezas.push({
      malla: caja([x, alturaBase + soplo, z], [largo, 0.05, 0.14]),
      color: PLAYA.arenaVolada,
    });
  }
  return piezas;
}

/** A qué altura está el terreno en `x`, para que lo que vuela lo haga sobre él. */
function terrenoEn(x) {
  if (x >= LISO_DESDE) return 0;
  if (x >= CAMINO_DESDE) return 0.02;
  return 0.02 + (CAMINO_DESDE - x) * SUBIDA_DUNA;
}

/**
 * El oleaje, ahora en movimiento.
 *
 * Las crestas avanzan hacia la orilla —las olas rompen contra la costa, sople
 * lo que sople— y el penacho de espuma de cada una sale a sotavento, hacia el
 * este. Que las dos cosas vayan en direcciones distintas es justo lo que se ve
 * con terral, y es lo que hace que el agua se lea como líquido y no como una
 * chapa pintada.
 */
const CRESTAS = 54;

function oleaje(segundos) {
  const azar = rngSemilla(20260820);
  const piezas = [];
  const [vx] = VIENTO;
  const recorrido = 52;
  for (let i = 0; i < CRESTAS; i += 1) {
    const z = -12 + azar() * (PROFUNDIDAD + 24);
    const largo = 2.4 + azar() * 4.5;
    const velocidad = 1.5 + azar() * 1.1;
    // Hacia la orilla: de mar abierto (+x) hacia ORILLA. De ahí el signo menos.
    const x = ORILLA + 2 + ciclo(azar() * recorrido - segundos * velocidad, recorrido);
    // Cabecea: una cresta que no sube y baja es una raya.
    const alto = -0.085 + 0.03 * Math.sin(segundos * 2.3 + i * 1.7);
    piezas.push({ malla: caja([x, alto, z], [0.55, 0.05, largo]), color: PLAYA.cresta });
    if (azar() > 0.5) {
      piezas.push({
        malla: caja([x + vx * (0.8 + azar()), alto + 0.02, z], [1.0, 0.04, largo * 0.5]),
        color: PLAYA.espuma,
      });
    }
  }
  return piezas;
}

/**
 * La orilla: la lámina que sube y baja sobre la arena mojada.
 *
 * Un solo cuadrilátero, y arregla lo que más delataba al mar — que la línea
 * donde el agua toca la arena estuviera clavada. Que respire ya la hace agua.
 */
function lenguaDeOrilla(segundos) {
  const avance = 0.9 * Math.sin(segundos * 0.55);
  return {
    malla: caja(
      [ORILLA - 0.9 + avance, -0.015, PROFUNDIDAD / 2 - 4],
      [1.8, 0.03, PROFUNDIDAD + 16],
    ),
    color: PLAYA.espuma,
  };
}

/* ---- sombras, sol y reflejo ------------------------------------------------ */

/** Un cuadrilátero horizontal a la altura `y`, con los vértices que se le den. */
function losa(puntos, y) {
  return {
    vertices: puntos.map(([px, pz]) => [px, y, pz]),
    caras: [[0, 1, 2, 3]],
  };
}

/**
 * La sombra que proyecta una caja sobre la arena.
 *
 * El motor no calcula sombras, así que se pintan: es exactamente lo que hacía la
 * máquina de referencia, donde una sombra era un polígono oscuro pegado al suelo
 * y no un cálculo. Y lo que aporta no es sutil — una sombra ATA el objeto al
 * suelo. Sin ella, un poste perfectamente apoyado parece flotar, que es medio
 * motivo de que la primera versión se viera plana.
 *
 * Sale un cuadrilátero y no la silueta exacta: con el sol tan bajo la sombra es
 * larga y estrecha, y a esa proporción la diferencia entre la silueta real y su
 * huella tirada no se ve. Lo que sí se vería es que no estuviera.
 */
const ALTURA_SOMBRA = 0.012;

function sombraDeCaja({ centro, medidas }) {
  const [cx, , cz] = centro;
  const [ancho, alto, fondo] = medidas;
  const [dx, dz] = RUMBO_SOMBRA;
  const largo = alto * LARGO_SOMBRA;
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
 * Una a una, la cabina tiraría cuatro montantes, un techo y tres cristales, y el
 * resultado sería una maraña de rectángulos superpuestos en vez de una sombra.
 * Se toma la pieza más alta de las que arrancan del suelo, que es la que manda
 * en la silueta, y se le da el ancho de la envolvente del prop.
 */
function sombraDeProp(piezas) {
  const enPie = piezas.filter(({ centro, medidas }) => centro[1] - medidas[1] / 2 < 0.2);
  if (enPie.length === 0) return null;
  const alta = enPie.reduce((a, b) => (a.centro[1] + a.medidas[1] > b.centro[1] + b.medidas[1] ? a : b));
  const anchoTotal = Math.max(...enPie.map(({ medidas }) => medidas[0]));
  const fondoTotal = Math.max(...enPie.map(({ medidas }) => medidas[2]));
  return sombraDeCaja({
    centro: alta.centro,
    medidas: [anchoTotal, alta.centro[1] + alta.medidas[1] / 2, fondoTotal],
  });
}

/**
 * Una esfera facetada, del tamaño de malla que sabe leer el motor.
 *
 * POCOS MERIDIANOS A PROPÓSITO. Una esfera de mil caras no se vería más redonda:
 * el motor sombrea PLANO por cara, así que lo que da la vuelta es la escalera de
 * tonos entre facetas, y con demasiadas la escalera desaparece y queda un disco
 * liso. Ocho por seis es donde una esfera se lee como esfera y sigue teniendo
 * facetas visibles, que es exactamente el aspecto de la época.
 *
 * Y es la primitiva que hacía falta: hasta ahora TODO el módulo se dibujaba con
 * cajas. Un planeta no se puede fingir con una caja.
 */
function esfera([cx, cy, cz], radio, meridianos = 8, paralelos = 6) {
  const vertices = [];
  const caras = [];
  for (let i = 0; i <= paralelos; i += 1) {
    const phi = (i / paralelos) * Math.PI;
    for (let j = 0; j < meridianos; j += 1) {
      const theta = (j / meridianos) * 2 * Math.PI;
      vertices.push([
        cx + radio * Math.sin(phi) * Math.cos(theta),
        cy + radio * Math.cos(phi),
        cz + radio * Math.sin(phi) * Math.sin(theta),
      ]);
    }
  }
  const indice = (i, j) => i * meridianos + (j % meridianos);
  for (let i = 0; i < paralelos; i += 1) {
    for (let j = 0; j < meridianos; j += 1) {
      // Antihorario visto desde fuera, que es lo que `componerEscena` necesita
      // para descartar las caras de espaldas.
      caras.push([indice(i, j), indice(i + 1, j), indice(i + 1, j + 1), indice(i, j + 1)]);
    }
  }
  return { vertices, caras };
}

/** Un anillo plano alrededor de un centro, en cuadriláteros. */
function anillo([cx, cy, cz], interior, exterior, lados = 16, inclinacion = 0.22) {
  const vertices = [];
  const caras = [];
  for (let j = 0; j < lados; j += 1) {
    const t = (j / lados) * 2 * Math.PI;
    const [co, si] = [Math.cos(t), Math.sin(t)];
    for (const r of [interior, exterior]) {
      // Inclinado: un anillo de canto perfecto desaparece, y uno de plano parece
      // un plato. La inclinación es lo que lo hace leerse como órbita.
      vertices.push([cx + r * co, cy + r * si * inclinacion, cz + r * si]);
    }
  }
  for (let j = 0; j < lados; j += 1) {
    const a = (j * 2) % (lados * 2);
    const b = (j * 2 + 1) % (lados * 2);
    const c = (j * 2 + 3) % (lados * 2);
    const d = (j * 2 + 2) % (lados * 2);
    caras.push([a, b, c, d]);
  }
  return { vertices, caras };
}

/**
 * Los planetas.
 *
 * Son lo que recuerda, sin decir una palabra, que esta playa la mira gente que
 * vive en una nave. Y con el sol ya declarado salen gratis en lo que importa:
 * una esfera facetada iluminada por una luz rasante enseña TERMINADOR —una cara
 * cálida, un borde de facetas girando y un lado frío—, que es justo la lectura
 * que una caja no puede dar por muchas caras que tenga.
 *
 * Colocados FUERA del camino de sol y a distintas alturas: agrupados o alineados
 * se leerían como decoración repetida en vez de como cielo.
 */
const PLANETAS = Object.freeze([
  // Medidos por el ÁNGULO que ocupan, no por su radio: lo que importa es cuánto
  // cuadro se comen. La primera versión puso uno de 25 m a 205, o sea catorce
  // grados —cuatro veces la luna llena— y salía como un pegote de barro cortado
  // por el borde de la ventana. Estos rondan los tres o cuatro grados: se leen
  // como cuerpos lejanos, que es lo que son, y dejan el cielo siendo cielo.
  { centro: [-320, 240, 620], radio: 26, color: PLAYA.planetaPalido, facetas: [10, 7] },
  { centro: [190, 300, 700], radio: 17, color: PLAYA.luna, facetas: [8, 5] },
  { centro: [430, 205, 560], radio: 21, color: PLAYA.planetaOcre, facetas: [9, 6], anillo: [30, 44] },
  { centro: [-540, 165, 380], radio: 12, color: PLAYA.planetaRojizo, facetas: [7, 5] },
]);

function piezasPlanetas() {
  return PLANETAS.flatMap(({ centro, radio, color, facetas, anillo: medidasAnillo }) => [
    { malla: esfera(centro, radio, facetas[0], facetas[1]), color },
    ...(medidasAnillo
      ? [{ malla: anillo(centro, medidasAnillo[0], medidasAnillo[1]), color: PLAYA.anillo }]
      : []),
  ]);
}

/**
 * El disco del sol, sobre el mar y casi tocando el agua.
 *
 * EMISIVO: es lo más claro del cuadro y no puede estar sujeto a la luz — se
 * ilumina a sí mismo, que es literalmente lo que hace un sol. Va lejos, pero
 * dentro del alcance de dibujo, y de cara a la cámara no se puede: el motor no
 * tiene billboards, así que se pone plano contra el plano del horizonte, que es
 * donde se le mira desde la playa.
 */
const DISTANCIA_SOL = 330;

function discoDelSol() {
  const largo = Math.hypot(SOL[0], SOL[1], SOL[2]);
  const [ux, uy, uz] = SOL.map((c) => (c / largo) * DISTANCIA_SOL);
  const radio = 16;
  // Un cuadrado alineado con los ejes X/Y, que a esta distancia y con la rejilla
  // de la época se lee como el disco que es.
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

/**
 * El camino de luz del sol sobre el agua.
 *
 * Es EL elemento que quita lo plano al mar, y no por realismo: una lámina de un
 * solo color no tiene ni distancia ni superficie, y en cuanto la cruza un reguero
 * que se estrecha al acercarse, el agua pasa a tener las dos cosas. Turner
 * pintaba poco más que esto.
 *
 * Se compone de trozos sueltos y no de una franja continua porque el agua no
 * refleja seguido: cada trozo es una cresta. Se estrechan y se separan al
 * acercarse, que es como se ve de verdad y, de paso, cómo se lee la profundidad.
 */
function caminoDeSol() {
  const [dx, dz] = RUMBO_SOMBRA; // hacia el observador, o sea, desde el sol
  const trozos = [];
  for (let d = 6; d < 300; d *= 1.28) {
    const cx = ORILLA + 2 - dx * d;
    const cz = PROFUNDIDAD / 2 - dz * d;
    // Ancho proporcional a la distancia: es la perspectiva del propio reguero.
    const medio = 0.5 + d * 0.055;
    const largo = 0.6 + d * 0.05;
    trozos.push({
      malla: losa(
        [
          [cx - medio, cz - largo],
          [cx + medio, cz - largo],
          [cx + medio, cz + largo],
          [cx - medio, cz + largo],
        ],
        -0.085,
      ),
      color: PLAYA.destello,
      emisivo: true,
    });
  }
  return trozos;
}

/**
 * Los cables entre postes: dos tramos por vano, el segundo más bajo que el
 * primero.
 *
 * Es la catenaria que sabe dibujar un motor de cajas: no se puede curvar una
 * caja, pero dos tramos escalonados ya no leen como una barra recta, que es lo
 * que hace que un cable parezca un cable.
 */
const ALTURA_CABLE = 5.1;
const DESCUELGUE = 0.35;

function cables() {
  const piezas = [];
  for (let i = 0; i < Z_POSTES.length - 1; i += 1) {
    const z0 = Z_POSTES[i];
    const medio = z0 + PASO_POSTES / 2;
    // Dos cables por vano, uno a cada lado del travesaño.
    for (const dx of [-0.5, 0.5]) {
      piezas.push(
        {
          malla: caja(
            [X_POSTES + dx, ALTURA_CABLE - DESCUELGUE / 2, (z0 + medio) / 2],
            [0.05, 0.05, PASO_POSTES / 2],
          ),
          color: PLAYA.cable,
        },
        {
          malla: caja(
            [X_POSTES + dx, ALTURA_CABLE - DESCUELGUE, (medio + z0 + PASO_POSTES) / 2],
            [0.05, 0.05, PASO_POSTES / 2],
          ),
          color: PLAYA.cable,
        },
      );
    }
  }
  return piezas;
}

/**
 * El suelo de luz a la intemperie.
 *
 * 0,62 contra el 0,35 de interior de nave. No es subirle el brillo: con un sol
 * a 21° la cara de arriba de la arena recibe poquísima direccional, y lo que la
 * ilumina de verdad es el cielo entero. Con el ambiente de interior, la playa a
 * pleno día salía del color del barro.
 */
const AMBIENTE_EXTERIOR = 0.62;

/** Alcance para lo que está en el CIELO: sin niebla que se lo coma. */
const ALCANCE_CIELO = 4000;

/** Hasta dónde dibuja esta escena. Los aerogeneradores están a 170 m y el mar
 *  llega al horizonte: con los 80 de serie no habría ni mar ni parque eólico. */
const ALCANCE = 420;

const PROPS = propsColocados();

const PIEZAS = Object.freeze([
  // De lejos a cerca, que es como se lee la escena y como conviene escribirla.
  franja({ desde: 60, hasta: MAR_HASTA, z0: -MAR_HASTA, z1: MAR_HASTA, alto: -0.1, color: PLAYA.marLejos }),
  franja({ desde: ORILLA, hasta: 60, z0: -MAR_HASTA, z1: MAR_HASTA, alto: -0.1, color: PLAYA.mar }),
  // La lengua de espuma, justo en la orilla y un pelo por encima del agua.
  franja({ desde: LISO_DESDE, hasta: ORILLA, z0: -8, z1: PROFUNDIDAD + 8, alto: 0, color: PLAYA.arenaMojada }),
  franja({ desde: CAMINO_DESDE, hasta: LISO_DESDE, z0: -8, z1: PROFUNDIDAD + 8, alto: 0.02, color: PLAYA.arena }),
  // El cielo va PRIMERO: es el fondo de todo lo demás.
  ...piezasPlanetas().map((pieza) => ({ ...pieza, lejos: ALCANCE_CIELO })),
  ...terrazasDuna(),
  // El reguero de sol va sobre el agua y antes que nada de lo que hay en tierra.
  ...caminoDeSol(),
  { malla: discoDelSol(), color: PLAYA.sol, emisivo: true, lejos: ALCANCE_CIELO },
  // LAS SOMBRAS ANTES QUE LO QUE LAS PROYECTA: van pegadas al suelo, y así el
  // orden por pintor no tiene que desempatar dos superficies casi coplanares.
  ...PROPS.map(({ piezas }) => sombraDeProp(piezas))
    .filter(Boolean)
    .map((malla) => ({ malla, color: PLAYA.sombra })),
  ...cables(),
  ...PROPS.flatMap(({ piezas }) => piezas).map(({ centro, medidas, color }) => ({
    malla: caja(centro, medidas),
    color,
  })),
]);

/**
 * Los puntos de interacción de la playa (#582).
 *
 * Solo uno: la cabina. Descolgar devuelve a la nave, que además resuelve que la
 * escena no sea un callejón sin salida — un exterior al que se entra por
 * herramienta y del que no se sale sin cerrar la ventana sería un banco de
 * pruebas incómodo de usar.
 *
 * El ancla la declara el PROP y no esta escena: es exactamente el mecanismo que
 * #579 necesita para su punto de pesca, probado aquí primero.
 */
const CABINA_COLOCADA = PROPS.find(({ ancla }) => ancla !== null);

export const INTERACCIONES = declararInteracciones([
  {
    id: "cabina-telefono",
    punto: CABINA_COLOCADA.ancla.punto,
    orientacion: CABINA_COLOCADA.ancla.orientacion,
    accion: { tipo: "estancia", estancia: "cantina" },
  },
]);

/** La huella en planta de un prop colocado, para que no se pueda atravesar. */
function huellaDe(piezas) {
  return piezas
    // Lo que está por encima de la cabeza no estorba al andar: las aspas de un
    // aerogenerador a 44 m de altura no son un muro.
    .filter(({ centro, medidas }) => centro[1] - medidas[1] / 2 < 2)
    .map(({ centro, medidas }) => ({
      x: centro[0] - medidas[0] / 2,
      z: centro[2] - medidas[2] / 2,
      ancho: medidas[0],
      profundidad: medidas[2],
    }));
}

export const PLANTA_PLAYA = crearPlanta({
  ancho: ANCHO,
  profundidad: PROFUNDIDAD,
  obstaculos: [
    ...obstaculosDeTerreno(),
    // Los aerogeneradores están mar adentro, fuera de la planta: su huella no
    // llega. Se filtran para no meter obstáculos con coordenadas de otro mundo.
    ...PROPS.flatMap(({ piezas }) => huellaDe(piezas)).filter((rect) => rect.x < ANCHO),
  ],
});

/** Dónde se aparece: en el camino, a la altura de la cabina pero lejos de ella,
 *  mirando hacia el fondo — así lo primero que se ve es la cabina al final del
 *  camino, con el mar a la derecha. */
export const ENTRADA = Object.freeze({ x: 11.5, z: 6, yaw: 0 });

/**
 * Compone la playa vista desde `(x, z)` mirando a `yaw`.
 *
 * Misma firma que la `componer` de `crearSalaCaja` —es lo que el bucle de andar
 * espera— pero sin nada de lo que una sala da por hecho: ni hojas de puerta, ni
 * ventanas, ni campo estelar. A cambio, dos cosas que ninguna sala usa: alcance
 * de dibujo largo y niebla hacia el color del cielo, que es lo que cierra el
 * horizonte en vez de dejar el mar cortado en seco.
 */
export function componerPlaya(x, y, z, yaw, opciones = {}) {
  const {
    ancho: anchoLienzo = 480,
    alto: altoLienzo = 270,
    epoca,
    fov = 62,
    otrosJugadores = [],
    modoCamara,
    avatarPropio = {},
    // El reloj que pasa el bucle (#587). Sin él la escena se dibuja parada, que
    // es lo correcto para una prueba y para cualquier anfitrión sin
    // `requestAnimationFrame`: lo que se mueve simplemente se queda quieto, y
    // todo lo demás sale igual.
    tiempo = 0,
  } = opciones;
  const segundos = Number.isFinite(tiempo) ? tiempo / 1000 : 0;
  const { camara, dibujarPropio } = resolverCamara({ x, z, y, yaw, modo: modoCamara });
  const yawCamara = -yaw;

  // Lo quieto está calculado una vez; lo que el viento mueve, en cada fotograma.
  // Son unas decenas de cuadriláteros, el mismo orden de magnitud que las hojas
  // de puerta que `crearSalaCaja` ya rehace en cada pasada.
  const enMovimiento = [
    ...oleaje(segundos),
    lenguaDeOrilla(segundos),
    ...arenaVolando(segundos),
  ];

  const partes = [...PIEZAS, ...enMovimiento].map(({ malla, color, emisivo, lejos }) =>
    componerEscena(
      { ...malla, vertices: malla.vertices.map(([vx, vy, vz]) => [vx - camara[0], vy - camara[1], vz - camara[2]]) },
      {
        ancho: anchoLienzo,
        alto: altoLienzo,
        epoca,
        fov,
        color,
        posicion: [0, 0, 0],
        yaw: yawCamara,
        recorteLateral: true,
        luzFija: true,
        emisivo: emisivo === true,
        // El cielo se dibuja con un alcance MUCHO mayor que el suelo (#587): un
        // sol y unos planetas a doscientos metros caían en plena niebla y se
        // los tragaba el propio color del cielo hacia el que se funde. Y es
        // correcto además de práctico: la perspectiva aérea la produce el AIRE
        // que hay entre medias, y entre el observador y un planeta no hay
        // playa. Lo lejano de la tierra se lava; lo del cielo, no.
        lejos: lejos ?? ALCANCE,
        // Un exterior lo rellena la bóveda del cielo entera, no cuatro mamparos.
        ambiente: AMBIENTE_EXTERIOR,
        // El sol de ESTA escena, no la direccional de interior de nave. Va en
        // coordenadas del mundo, que es lo que exige `luzFija`.
        luz: SOL,
        // Y su color, contra el del cielo que rellena la sombra. Sin esto, lo
        // iluminado y lo oscuro son el mismo color a dos brillos, que es
        // exactamente el aspecto de cartón recortado que había que quitar.
        tinte: TINTE,
        // Sin esto no hay niebla, y sin niebla el mar termina en una raya recta
        // a 380 m: el horizonte lo hace el fundido, no la geometría.
        fondo: PLAYA.cielo,
      },
    ),
  );

  const cuerpos = dibujarPropio ? [...otrosJugadores, { x, y, z, yaw, avatar: avatarPropio }] : otrosJugadores;
  const poligonosJugadores = poligonosOtrosJugadores(cuerpos, {
    camara,
    yaw: yawCamara,
    ancho: anchoLienzo,
    alto: altoLienzo,
    epoca,
    fov,
  });

  const { poligonos } = fundirEscenas([...partes, poligonosJugadores]);
  return { ancho: anchoLienzo, alto: altoLienzo, epoca: partes[0]?.epoca, poligonos, estrellas: [] };
}
