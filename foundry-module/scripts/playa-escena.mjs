// La playa de pruebas (#587): el primer EXTERIOR del módulo.
//
// QUÉ ES. La ESCENA DE REFERENCIA del kit (#589): el sitio donde se prueba cada
// primitiva y cada sistema nuevo antes de gastarlos en contenido que ve la mesa.
// Nació como «banco de pruebas» y el nombre se le quedó corto en cuanto tuvo una
// cabina y un reloj varado — pero tampoco es contenido de campaña, y esa segunda
// mitad importa igual: es solo-GM, no guarda estado y no concede nada (la regla
// está en `docs/FOUNDRY.md`). Un exterior accesible por botón, sin trayecto ni
// motivo, le enseñaría a la mesa que las escenas son un menú.
//
// Aquí se estrenaron los puntos de interacción (#582) y el vocabulario de props
// (#583) antes de gastarlos en la terraza de #579, que sí tiene que quedar bien. Una sala de nave más no probaría nada que las trece
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
import { anillo, caja, esfera, losa, rampa } from "./escena-primitivas.mjs";
import { componerEscena, fundirEscenas, mezclar } from "./retro3d.mjs";
import { resolverCamara } from "./nave-camara.mjs";
import { poligonosOtrosJugadores } from "./nave-avatares-render.mjs";
import { crearPlanta } from "./nave-movimiento.mjs";
import { rngSemilla } from "./ventana-nave.mjs";
import { colocarProp, mezclarVocabularios } from "./nave-props.mjs";
import {
  VOCABULARIO_COSTA,
  VOCABULARIO_MARITIMO,
  VOCABULARIO_URBANO,
} from "./props-exteriores.mjs";
import { declararInteracciones } from "./nave-interaccion.mjs";
import { ciclo, declararSol, franja, huellaDe } from "./escena-exteriores.mjs";
import { piezasHorizonte, texturasHorizonte } from "./horizonte-matte.mjs";
import { LEON_AL_LAT } from "../data/mallas/leon-al-lat.mjs";
import { uvsTriplanar } from "./escena-primitivas.mjs";
import { metrosPorTextura, texturaMaterial } from "./props-materiales.mjs";

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
/**
 * Hasta dónde se dibuja tierra y todo lo que la puebla.
 *
 * MÁS ALLÁ DEL ALCANCE, a propósito. `ALCANCE` (420 m) es donde el motor recorta;
 * si la arena se acabara antes, se vería su canto flotando en el aire, que es
 * exactamente lo que pasaba: la playa terminaba a cincuenta metros y detrás no
 * había nada. Llegando más lejos que el recorte, lo último que se ve ya está
 * fundido con el color del cielo y el horizonte cierra solo.
 */
const HASTA_NIEBLA = 520;

/**
 * Dónde va cada poste. La línea NO SE ACABA: sigue hasta la niebla.
 *
 * Una hilera de cinco postes que termina en seco dice que el mundo termina ahí.
 * Una que se pierde en la bruma dice que sigue habiendo costa, y no cuesta nada
 * —son cuatro cajas por poste y los lejanos ocupan tres píxeles—. Es de las
 * cosas que más barato compran la sensación de que hay mundo fuera del decorado.
 *
 * Los cercanos son los que se ven de verdad y los que llevan el ancla y la
 * sombra; de ahí en adelante son perfil contra el cielo.
 */
const Z_POSTES = Object.freeze(
  Array.from({ length: Math.ceil((HASTA_NIEBLA - 4) / PASO_POSTES) }, (_, i) => 4 + i * PASO_POSTES),
);

/** Cuántos de ellos son «de cerca»: los que proyectan sombra y cuentan como
 *  obstáculo. Más allá, la sombra sería un pelo de un píxel y el obstáculo
 *  estaría fuera de la planta por la que se anda. */
const POSTES_CERCANOS = 5;

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
const SOL_PLAYA = declararSol([0.72, 0.34, 0.52]);

export const SOL = SOL_PLAYA.direccion;

/** El tinte que va con ese sol: ámbar en la luz, azul de cielo en la sombra. */
const TINTE = Object.freeze({ calida: PLAYA.luzSol, fria: PLAYA.sombraCielo });

/**
 * Cuánto se alarga la sombra de algo de un metro de alto, y hacia dónde se
 * tumba. Los calcula el kit a partir del propio `SOL` (#589): si alguien sube o
 * baja el sol, las sombras se alargan o se acortan solas.
 */
export const LARGO_SOMBRA = SOL_PLAYA.largoSombra;
export const RUMBO_SOMBRA = SOL_PLAYA.rumboSombra;

/* ---- props propios de la playa -------------------------------------------- */

/**
 * El vocabulario de la PLAYA, aparte del de la nave.
 *
 * Se comparte la maquinaria de `nave-props.mjs` (partes, giro, ancla,
 * envolvente) y NO la lista: un poste de luz y un aerogenerador en el catálogo
 * de la nave harían largo justo el catálogo que ese módulo mantiene corto a
 * propósito. Son piezas que no pintan nada juntas.
 */
/**
 * El vocabulario de la PLAYA: los tres ambientes de exterior que le tocan.
 *
 * Ya no es una lista propia (#589). La playa está en el litoral, tiene obra
 * humana en el agua y tiene una farola y una cabina plantadas en la arena — así
 * que pide los tres y los mezcla. Una escena de puerto pedirá dos de ellos, y
 * una de acantilado, uno.
 */
export const VOCABULARIO_PLAYA = mezclarVocabularios(
  VOCABULARIO_COSTA,
  VOCABULARIO_MARITIMO,
  VOCABULARIO_URBANO,
);

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
 * La duna, como PENDIENTE de verdad y no como escalera.
 *
 * Fueron terrazas: losas horizontales, cada una un escalón más alta. Sobre el
 * papel daba igual —seis centímetros no se ven— y en la práctica no: de cerca y
 * a ras de suelo los cantos se alinean y la duna se lee como una escalinata de
 * piedra. Es el fallo clásico de aproximar una pendiente por escalones y luego
 * mirarla justo desde donde los escalones se ven de canto.
 *
 * Cada tramo es ahora un cuadrilátero INCLINADO: sus dos bordes están a alturas
 * distintas, así que la superficie sube de verdad. No cuesta ni un polígono más
 * y no hay escalón que alinear porque no hay escalones. Se puede hacer porque
 * una malla no tiene por qué ser una caja — lo mismo que permitió los planetas y
 * el reloj.
 */
function laderaDeDuna() {
  const piezas = [];
  const z0 = -8;
  const z1 = PROFUNDIDAD + 8;
  for (let x = CAMINO_DESDE; x > DUNA_HASTA; x -= PASO_DUNA) {
    const dentro = x - PASO_DUNA;
    // El bobinado importa: esta cara se descartó ENTERA por tenerlo al revés y la
    // duna desapareció, dejando solo sus rizos flotando sobre el cielo. Por eso
    // la primitiva vive en `escena-primitivas.mjs` con su regla escrita, en vez
    // de escribirse a mano cada vez que hace falta una superficie inclinada.
    piezas.push({
      malla: rampa([
        [dentro, terrenoEn(dentro), z0],
        [dentro, terrenoEn(dentro), z1],
        [x, terrenoEn(x), z1],
        [x, terrenoEn(x), z0],
      ]),
      color: PLAYA.duna,
    });
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
    puestos.push({
      ...colocarProp("poste", {
        x: X_POSTES,
        z,
        cuartos: 1,
        nombre: `poste-${indice}`,
        vocabulario: VOCABULARIO_PLAYA,
      }),
      // Los lejanos son PERFIL Y NADA MÁS: ni sombra ni estorbo. Su sombra sería
      // un pelo de un píxel y su huella cae fuera de la planta por la que se
      // anda, así que calcularlas es pagar por nada sesenta y tantas veces.
      lejano: indice >= POSTES_CERCANOS,
    });
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

/**
 * Hasta dónde llega el mar. MUY por detrás del plano lejano, y ese es el truco.
 *
 * Estuvo en 380 con un alcance de dibujo de 420, y el resultado era la raya rara
 * del horizonte: el canto del mar caía DENTRO del alcance, o sea a un 78% de
 * niebla, no al 100%. Un borde teñido casi —pero no del todo— del color del
 * cielo es justo lo que el ojo caza: se lee como que el mar termina y como que
 * está levantado, porque una banda clara ancha por encima del agua parece
 * inclinación.
 *
 * Pasándolo del plano lejano, el mar YA NO TIENE canto visible: lo corta el
 * recorte lejano, y ahí la niebla vale exactamente 1, así que el polígono ES el
 * color del cielo. El horizonte deja de ser geometría y pasa a ser lo que es de
 * verdad — el sitio donde el agua se acaba de teñir de aire.
 */
const MAR_HASTA = 1400;

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

function rizosDeArena(desde, hasta, z0, z1, color) {
  const piezas = [];
  const azar = rngSemilla(20260817);
  for (let x = desde; x < hasta; x += PASO_RIZO) {
    // La cresta se desvía un poco en cada tramo: un rizo perfectamente recto de
    // cuarenta metros es un listón, no arena.
    const desvio = (azar() - 0.5) * 0.12;
    // La altura sale del TERRENO, no de un número fijo: sobre la duna, unos
    // rizos a cota constante se hundirían cuesta arriba y flotarían cuesta
    // abajo. Que salga de `terrenoEn` es lo que los deja pegados a la ladera.
    const base = terrenoEn(x + desvio);
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
 * MUCHAS Y NO TRES, y el motivo es del motor y no del gusto: la niebla se calcula
 * **por polígono, en su centroide**. Un mar de tres cuadriláteros enormes recibe
 * tres valores de niebla en total, así que el agua entera se tiñe a saltos y su
 * borde de fuera es un canto duro contra el cielo. Eso era la «raya rara del
 * horizonte», y no se arregla estirando el mar: se arregla dándole al motor más
 * polígonos donde repartir el degradado.
 *
 * Crecen geométricamente hacia fuera —las de cerca estrechas, las de lejos muy
 * anchas— porque así es como cae la perspectiva: en pantalla ocupan más o menos
 * lo mismo, y el degradado sale regular para el que mira, que es lo que cuenta.
 *
 * La última pasa del plano lejano a propósito. Ahí la niebla vale 1, el polígono
 * ES el color del cielo, y el horizonte deja de ser geometría para pasar a ser
 * lo que de verdad es: el sitio donde el agua acaba de teñirse de aire.
 */
const BANDAS_MAR = (() => {
  const bandas = [];
  let desde = ORILLA;
  let ancho = 2.2;
  while (desde < MAR_HASTA) {
    const hasta = Math.min(desde + ancho, MAR_HASTA);
    // El color va del bajío al mar abierto en la primera parte del recorrido, y
    // de ahí a la niebla se encarga el motor.
    // Dos mezclas encadenadas. La primera es el AGUA: del bajío al mar abierto
    // en los primeros sesenta metros. La segunda es el AIRE que hay entre medias:
    // de ese azul al color del cielo, hasta casi tocarlo en la última banda.
    //
    // Y esto lo hace la PALETA, no la niebla del motor, aunque la niebla exista y
    // esté bien. El motivo es concreto: la niebla solo llega a 1 en el plano
    // lejano, y ahí la geometría ya está recortada — o sea, el único sitio donde
    // el agua se fundiría del todo es justo donde ya no hay agua. Cerrando el
    // horizonte por color, la última banda que se dibuja YA es prácticamente
    // cielo, y no hay canto que ver. Es lo mismo que hace un pintor cuando
    // afloja el último término hasta que se pierde: el horizonte no se dibuja,
    // se deja de dibujar.
    const agua = Math.min(1, (desde - ORILLA) / 60);
    const aire = Math.min(1, ((desde - ORILLA) / 175) ** 0.8);
    const azul =
      agua < 0.5 ? mezclar(PLAYA.marBajio, PLAYA.mar, agua * 2) : mezclar(PLAYA.mar, PLAYA.marLejos, (agua - 0.5) * 2);
    // Y las últimas bandas van EMISIVAS. No porque brillen: emisivo aquí
    // significa «no la sombrees», y es la única forma de que el color que se ha
    // calculado llegue intacto al lienzo. Una banda pintada del color exacto del
    // cielo pero sombreada por el sol sale distinta del cielo —el cielo es el
    // fondo del lienzo y ese no lo sombrea nadie— y esa diferencia de un pelo,
    // repetida a lo largo de todo el horizonte, ES la raya que se veía.
    bandas.push({
      desde,
      hasta,
      color: mezclar(azul, PLAYA.cielo, aire * 0.94),
      emisivo: aire > 0.72,
    });
    desde = hasta;
    ancho *= 1.42;
  }
  return Object.freeze(bandas);
})();

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
const CRESTAS = 88;

function oleaje(segundos) {
  const azar = rngSemilla(20260820);
  const piezas = [];
  const [vx] = VIENTO;
  const recorrido = 115;
  for (let i = 0; i < CRESTAS; i += 1) {
    const z = -14 + azar() * (PROFUNDIDAD + 28);
    const largo = 2.4 + azar() * 4.5;
    const velocidad = 1.5 + azar() * 1.1;
    // Hacia la orilla: de mar abierto (+x) hacia ORILLA. De ahí el signo menos.
    //
    // El recorrido llega hasta más de cien metros, y no a cincuenta: con el
    // campo corto, el agua se quedaba lisa de golpe a media distancia y esa raya
    // —donde acababan las crestas— era el segundo borde falso del horizonte.
    const x = ORILLA + 2 + ciclo(azar() * recorrido - segundos * velocidad, recorrido);
    // Cabecea: una cresta que no sube y baja es una raya.
    const alto = -0.085 + 0.03 * Math.sin(segundos * 2.3 + i * 1.7);
    piezas.push({ malla: caja([x, alto, z], [0.55, 0.05, largo]), color: PLAYA.cresta, lejos: ALCANCE_AGUA });
    if (azar() > 0.5) {
      piezas.push({
        malla: caja([x + vx * (0.8 + azar()), alto + 0.02, z], [1.0, 0.04, largo * 0.5]),
        color: PLAYA.espuma,
        lejos: ALCANCE_AGUA,
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

/**
 * El reloj varado en la arena (#587).
 *
 * QUÉ ES. Una esfera de reloj de latón, del tamaño de una tapa de alcantarilla,
 * medio enterrada e inclinada hacia quien llega. Sus agujas marcan **el reloj de
 * la escena**: el mismo que mueve la arena y las olas, hecho visible.
 *
 * POR QUÉ ESTÁ BIEN QUE ESTÉ. Tres cosas a la vez, y ninguna sobra:
 *
 *  - Cuenta algo. Un objeto fabricado, caro y roto, tirado en una playa vacía,
 *    dice que aquí pasó algo sin que nadie tenga que explicarlo. Es lo mismo que
 *    hace la cabina de teléfono, y por eso funcionan juntos.
 *  - Es la referencia obvia —un reloj blando en un paisaje desierto— y es la
 *    clase de guiño que la mesa pilla sola.
 *  - Y es honestamente útil: enseña que el reloj de la escena corre. Cuando
 *    alguien diga «no se mueve nada», bastará mirar el segundero.
 *
 * ESCALA DE LO QUE MARCA. El segundero da la vuelta en un minuto y el horario en
 * una hora, contando desde que se abrió la ventana. No es la hora del mundo: es
 * cuánto llevas aquí. Un reloj varado en una playa no tendría por qué saber qué
 * hora es en ningún otro sitio.
 */
const RELOJ = Object.freeze({
  centro: [12.6, 0.02, 10.5],
  radio: 0.62,
  // Inclinación desde la vertical. A 38° la cara mira arriba y al sur, que es
  // por donde se entra: se lee andando hacia la cabina, sin buscarlo.
  inclinacion: (38 * Math.PI) / 180,
  // Cuánto se ha tragado la arena. Casi la mitad — enterrado del todo no se ve,
  // y de pie parecería colocado ahí por alguien.
  enterrado: 0.42,
});

/** Los dos ejes del plano de la esfera: `u` a su derecha, `v` hacia sus doce. */
function ejesDelReloj() {
  const { inclinacion } = RELOJ;
  return {
    u: [1, 0, 0],
    v: [0, Math.cos(inclinacion), -Math.sin(inclinacion)],
  };
}

/** Un punto de la esfera, a `radio` y en el ángulo `t` (0 = las doce). */
function enLaEsfera(radio, t) {
  const { u, v } = ejesDelReloj();
  const [cx, cy, cz] = RELOJ.centro;
  const [su, sv] = [Math.sin(t), Math.cos(t)];
  return [
    cx + (u[0] * su + v[0] * sv) * radio,
    cy + (u[1] * su + v[1] * sv) * radio,
    cz + (u[2] * su + v[2] * sv) * radio,
  ];
}

/**
 * Un sector de la esfera, entre dos ángulos y dos radios.
 *
 * Con esto se dibuja todo: la cara (del centro al cerco), el cerco (un anillo
 * estrecho), las marcas de las horas y las propias agujas. Una sola función
 * porque todas son lo mismo —un trozo de corona circular en el plano de la
 * esfera— y tenerlo escrito una vez es lo que hace que las agujas no puedan
 * salirse del plano de la cara.
 */
function sectorDelReloj(desde, hasta, radioInterior, radioExterior) {
  return {
    vertices: [
      enLaEsfera(radioInterior, desde),
      enLaEsfera(radioExterior, desde),
      enLaEsfera(radioExterior, hasta),
      enLaEsfera(radioInterior, hasta),
    ],
    caras: [[0, 1, 2, 3]],
  };
}

/** Hasta dónde se ve la esfera: lo de debajo se lo ha tragado la arena. */
const ARCO_VISIBLE = Math.acos(RELOJ.enterrado * 2 - 1);

function piezasReloj(segundos) {
  const { radio } = RELOJ;
  const piezas = [];

  // La cara, en gajos: un solo cuadrilátero no sería redondo, y con doce se lee
  // como disco sin dejar de tener las facetas de la época.
  const gajos = 14;
  for (let i = 0; i < gajos; i += 1) {
    const a = -ARCO_VISIBLE + ((2 * ARCO_VISIBLE) / gajos) * i;
    const b = a + (2 * ARCO_VISIBLE) / gajos;
    piezas.push({ malla: sectorDelReloj(a, b, 0, radio * 0.9), color: PLAYA.relojCara });
    piezas.push({ malla: sectorDelReloj(a, b, radio * 0.9, radio), color: PLAYA.relojCerco });
  }

  // Las marcas de las horas que quedan por encima de la arena.
  for (let h = 0; h < 12; h += 1) {
    const t = (h / 12) * 2 * Math.PI;
    const normalizado = t > Math.PI ? t - 2 * Math.PI : t;
    if (Math.abs(normalizado) > ARCO_VISIBLE - 0.08) continue;
    const ancho = h % 3 === 0 ? 0.09 : 0.045;
    piezas.push({
      malla: sectorDelReloj(normalizado - ancho, normalizado + ancho, radio * 0.72, radio * 0.87),
      color: PLAYA.relojMarca,
    });
  }

  // Y las agujas, que es a lo que ha venido. El segundero da la vuelta en un
  // minuto; el horario, en una hora. Se cuenta desde que se abrió la ventana.
  const agujas = [
    { vuelta: 3600, largo: 0.42, grosor: 0.05 },
    { vuelta: 60, largo: 0.66, grosor: 0.028 },
  ];
  for (const { vuelta, largo, grosor } of agujas) {
    const t = ((segundos % vuelta) / vuelta) * 2 * Math.PI;
    piezas.push({
      malla: sectorDelReloj(t - grosor, t + grosor, 0, radio * largo),
      color: PLAYA.relojAguja,
    });
  }

  return piezas;
}

/**
 * El montón de arena que lo entierra.
 *
 * Va DESPUÉS de la esfera en la lista y por delante en el mundo: el motor ordena
 * por pintor, así que lo que tapa se dibuja encima. Es lo que convierte «un
 * reloj apoyado en el suelo» en «un reloj que la playa se está comiendo».
 */
function monticuloDelReloj() {
  const [cx, , cz] = RELOJ.centro;
  return [
    { malla: caja([cx, 0.06, cz + 0.42], [RELOJ.radio * 2.3, 0.16, 0.5]), color: PLAYA.arena },
    { malla: caja([cx - 0.5, 0.05, cz + 0.2], [0.5, 0.13, 0.5]), color: PLAYA.arena },
    { malla: caja([cx + 0.55, 0.05, cz + 0.22], [0.45, 0.12, 0.45]), color: PLAYA.arena },
  ];
}

/* ---- sombras, sol y reflejo ------------------------------------------------ */

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
 * 0,78 contra el 0,35 de interior de nave. No es subirle el brillo: con un sol
 * a 21° la cara de arriba de la arena recibe poquísima direccional, y lo que la
 * ilumina de verdad es el cielo entero. Con el ambiente de interior, la playa a
 * pleno día salía del color del barro.
 */
const AMBIENTE_EXTERIOR = 0.78;

/** Alcance para lo que está en el CIELO: sin niebla que se lo coma. */
const ALCANCE_CIELO = 4000;

/**
 * Las texturas del matte, generadas una sola vez.
 *
 * A nivel de módulo y no dentro de `componerPlaya`: son tres imágenes de
 * 256×48 y no cambian nunca, así que rehacerlas en cada fotograma sería pagar
 * sesenta veces por segundo por un dibujo idéntico.
 */
const TEXTURAS_MATTE = texturasHorizonte();

/* ---- la ruina -------------------------------------------------------------- */

/**
 * El León de Al-Lāt, medio enterrado en la duna (#590).
 *
 * ES LO ÚNICO DE ESTA ESCENA QUE DICE QUIÉN ESTUVO ANTES. Una playa con una
 * cabina de teléfono es un sitio; una playa con un león de piedra hundido en la
 * arena es un sitio con historia, y nadie tiene que explicar nada — la mesa
 * pregunta sola. Para una campaña que va de sitio en sitio es la herramienta más
 * barata que hay para que un lugar tenga pasado.
 *
 * SE QUEDAN LOS SILLARES, y es una decisión, no una comodidad. El modelo trae
 * los bloques del muro en el que el relieve estaba encajado —el León de Al-Lāt
 * no era un bulto redondo sino un alto relieve en la fachada del templo—, y
 * recortarlos habría dado una estatua suelta, o sea un monumento. Un monumento
 * dice que alguien lo puso ahí y alguien lo mantiene. Con sus bloques dice otra
 * cosa: que esto fue un edificio, que el edificio ya no está, y que nadie ha
 * vuelto. Es más historia por menos trabajo.
 *
 * ORIENTADA PARA QUE SE LLEGUE A ELLA DE FRENTE. Un relieve solo se lee por un
 * lado: de canto es mampostería con un hueco. Se probaron las cuatro
 * orientaciones desde el camino y esta es la única en la que se le distingue la
 * cabeza al pasar. No es un ajuste fino — con otra, la pieza no se lee y da igual
 * lo buena que sea la malla.
 *
 * HUNDIDA, y no apoyada sobre una peana: se baja por debajo de la cota de la
 * duna y la arena la recorta sola. No cuesta un polígono y es la diferencia
 * entre una ruina y una escultura expuesta.
 *
 * EN LA DUNA Y NO EN EL CAMINO: se ve y no se llega. Lo que se mira desde lejos
 * y no se toca es lo que hace grande un sitio.
 *
 * Se pinta con NUESTRA paleta y nuestro material (frontera de arte de #351): la
 * malla solo aporta geometría. Su ficha está en `docs/PROCEDENCIA_ASSETS.md`, y
 * sin ficha no habría entrado.
 */
const ESTATUA = Object.freeze({ x: 4.6, z: 33, hundida: 0.62, giro: 4.71 });

export { ESTATUA };

const MALLA_ESTATUA = (() => {
  const cos = Math.cos(ESTATUA.giro);
  const sen = Math.sin(ESTATUA.giro);
  const vertices = LEON_AL_LAT.vertices.map(([x, y, z]) => [
    ESTATUA.x + x * cos - z * sen,
    y - ESTATUA.hundida,
    ESTATUA.z + x * sen + z * cos,
  ]);
  const malla = { vertices, caras: LEON_AL_LAT.caras };
  // Las UV se calculan sobre la malla YA colocada: el grano de la piedra es del
  // mundo y no de la pieza, así que dos ruinas juntas no repetirían el mismo
  // dibujo en el mismo sitio de su cuerpo.
  return { ...malla, uvs: uvsTriplanar(malla, metrosPorTextura("piedra")) };
})();

const TEXTURA_ESTATUA = texturaMaterial("piedra", PLAYA.roca);

/** Su huella en planta, para que no se pueda atravesar. Es piedra maciza, y
 *  cruzarla andando desmentiría de golpe todo lo que la ruina cuenta. */
const HUELLA_ESTATUA = (() => {
  const xs = MALLA_ESTATUA.vertices.map(([x]) => x);
  const zs = MALLA_ESTATUA.vertices.map(([, , z]) => z);
  const x0 = Math.min(...xs);
  const z0 = Math.min(...zs);
  return { x: x0, z: z0, ancho: Math.max(...xs) - x0, profundidad: Math.max(...zs) - z0 };
})();

/**
 * Alcance del agua. El mismo que el del resto de la escena, y a propósito.
 *
 * Aquí está la raya rara del horizonte, y no era donde parecía. El mar sí llega
 * lejísimos, pero a partir de unos doscientos metros una lámina horizontal vista
 * desde 1,45 m de altura subtiende MENOS DE UN PÍXEL y desaparece sola. Con el
 * alcance general (420 m), a esa distancia la niebla iba solo por el 20%: el
 * agua se esfumaba estando todavía azul, y el salto a cielo era un canto duro.
 *
 * Dándole al agua su propio alcance, la niebla llega al 93% justo donde el agua
 * deja de tener grosor en pantalla. Se funde en vez de terminarse. Es el mismo
 * ajuste que hace un pintor cuando afloja el último término hasta que se pierde:
 * el horizonte no se dibuja, se deja de dibujar.
 */
const ALCANCE_AGUA = 420;

/** Hasta dónde dibuja esta escena. Los aerogeneradores están a 170 m y el mar
 *  llega al horizonte: con los 80 de serie no habría ni mar ni parque eólico. */
const ALCANCE = 420;

const PROPS = propsColocados();

const PIEZAS = Object.freeze([
  // El cielo va PRIMERO: es el fondo de todo lo demás.
  ...piezasPlanetas().map((pieza) => ({ ...pieza, lejos: ALCANCE_CIELO })),
  // EL MAR, en muchas bandas y con su propio alcance de dibujo: entre las dos
  // cosas se reparte el degradado del horizonte (ver `BANDAS_MAR` y
  // `ALCANCE_AGUA`, que es donde está explicada la «raya rara»).
  ...BANDAS_MAR.map(({ desde, hasta, color, emisivo }) => ({
    ...franja({ desde, hasta, z0: -MAR_HASTA, z1: MAR_HASTA, alto: -0.1, color }),
    lejos: ALCANCE_AGUA,
    emisivo,
  })),
  // LA TIERRA LEJANA, primero y por debajo de todo lo demás: las mismas franjas
  // pero llegando hasta la niebla. Sin ellas la playa se acababa a cincuenta
  // metros y se veía su canto flotando, con el mar por detrás y un vacío en
  // medio. Van lisas —ni rizos, ni marcas de marea, ni restos— porque a esa
  // distancia no se distingue un rizo de la nada, y sí se distinguiría el gasto.
  franja({ desde: LISO_DESDE, hasta: ORILLA, z0: -HASTA_NIEBLA, z1: HASTA_NIEBLA, alto: 0, color: PLAYA.arenaMojada }),
  franja({ desde: CAMINO_DESDE, hasta: LISO_DESDE, z0: -HASTA_NIEBLA, z1: HASTA_NIEBLA, alto: 0.02, color: PLAYA.arena }),
  franja({ desde: DUNA_HASTA, hasta: CAMINO_DESDE, z0: -HASTA_NIEBLA, z1: HASTA_NIEBLA, alto: 0.02, color: PLAYA.duna }),
  // La arena que acaba de dejar el mar, con lo que el agua se dejó encima. Sin
  // rizos: el agua acaba de pasar por ahí y los ha borrado.
  franja({ desde: LISO_DESDE, hasta: ORILLA, z0: -8, z1: PROFUNDIDAD + 8, alto: 0, color: PLAYA.arenaMojada }),
  ...marcasDeMarea(),
  ...lineaDeRestos(),
  // El camino de arena fina, y sus rizos de norte a sur porque el viento va al este.
  franja({ desde: CAMINO_DESDE, hasta: LISO_DESDE, z0: -8, z1: PROFUNDIDAD + 8, alto: 0.02, color: PLAYA.arena }),
  ...rizosDeArena(CAMINO_DESDE, LISO_DESDE, -8, PROFUNDIDAD + 8, PLAYA.rizo),
  // La duna, como pendiente de verdad y no como escalera.
  ...laderaDeDuna(),
  ...rizosDeArena(DUNA_HASTA, CAMINO_DESDE, -8, PROFUNDIDAD + 8, PLAYA.rizoDuna),
  // El reguero de sol va sobre el agua y antes que nada de lo que hay en tierra.
  ...caminoDeSol(),
  { malla: SOL_PLAYA.disco(), color: PLAYA.sol, emisivo: true, lejos: ALCANCE_CIELO },
  // LAS SOMBRAS ANTES QUE LO QUE LAS PROYECTA: van pegadas al suelo, y así el
  // orden por pintor no tiene que desempatar dos superficies casi coplanares.
  ...PROPS.filter(({ lejano }) => !lejano)
    .map(({ piezas }) => SOL_PLAYA.sombraDeProp(piezas))
    .filter(Boolean)
    .map((malla) => ({ malla, color: PLAYA.sombra })),
  ...cables(),
  // LA MALLA DEL PROP, no una caja rehecha a partir de su envolvente. Estaba
  // reconstruyendo `caja(centro, medidas)` y con eso un mástil de ocho lados se
  // dibujaba como un tablón cuadrado — la conicidad y las facetas que
  // `colocarProp` había calculado se tiraban a la basura en la última línea. Y
  // ahora además se llevaría por delante las UV, que es lo que texturarlo
  // necesita (#584).
  { malla: MALLA_ESTATUA, color: PLAYA.roca, textura: TEXTURA_ESTATUA },
  ...PROPS.flatMap(({ piezas }) => piezas).map(({ malla, color, textura }) => ({
    malla,
    color,
    textura,
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
  {
    id: "leon-al-lat",
    punto: [ESTATUA.x, ESTATUA.z - 2],
    orientacion: ESTATUA.giro,
    accion: { tipo: "cartela", pieza: "leon-al-lat" },
  },
]);

export const PLANTA_PLAYA = crearPlanta({
  ancho: ANCHO,
  profundidad: PROFUNDIDAD,
  obstaculos: [
    ...obstaculosDeTerreno(),
    // Los aerogeneradores están mar adentro, fuera de la planta: su huella no
    // llega. Se filtran para no meter obstáculos con coordenadas de otro mundo.
    ...PROPS.filter(({ lejano }) => !lejano)
      .flatMap(({ piezas }) => huellaDe(piezas))
      .filter((rect) => rect.x < ANCHO),
    HUELLA_ESTATUA,
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
    ...piezasReloj(segundos),
    ...monticuloDelReloj(),
    ...oleaje(segundos),
    lenguaDeOrilla(segundos),
    ...arenaVolando(segundos),
  ];

  // El horizonte va DELANTE de la lista y por eso se pinta primero: es el fondo
  // del todo, y sus capas ya vienen ordenadas de lejos a cerca.
  const horizonte = piezasHorizonte({ camara, segundos, texturas: TEXTURAS_MATTE }).map((capa) => ({
    malla: capa.malla,
    color: PLAYA.cielo,
    emisivo: true,
    lejos: ALCANCE_CIELO,
    textura: capa.textura,
  }));

  const partes = [...horizonte, ...PIEZAS, ...enMovimiento].map(({ malla, color, emisivo, lejos, textura }) =>
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
        // La textura de ESTA pieza. El motor admite una por llamada y funde
        // después, así que tres capas de matte con imágenes distintas no
        // necesitan ni atlas ni tocar el motor (#584).
        textura: textura ?? null,
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
