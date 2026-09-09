// La arena de combate (#1013, #1020): 30 × 20 casillas de cinco pies.
//
// QUÉ ES. El sitio donde se mira si un combate en rejilla se puede JUGAR
// andando por dentro, y no solo desde arriba. Treinta por veinte casillas de
// 5 ft son 45,7 × 30,5 m: más grande que la playa entera, y esa medida es el
// contenido. Un tablero se dibuja de un vistazo; cruzarlo a pie tarda, y esa
// diferencia entre verlo y recorrerlo es justo lo que ninguna vista cenital
// puede enseñar.
//
// EL PRESUPUESTO, MEDIDO. Desde la entrada, con el cierre de arboleda y una
// población de 4 / 8 / 16 / 32 cuerpos: 2106 / 2165 / 2294 / 2559 polígonos,
// 65–87 ms por fotograma en el runner de pruebas. Lo que importa de esos
// números es el reparto, no el total: el claro cuesta ~2100 polígonos LO MISMO
// con 4 que con 32, y cada cuerpo añade unos 16. O sea que la población no es
// el gasto —doblarla es lineal, y `arena-poblacion.test.mjs` lo vigila—; el
// gasto es el claro, y si algún día hay que recortar, se recorta ahí: densidad
// de arboleda antes que cuerpos. Es un banco de pruebas solo-GM, así que ese
// coste no lo paga ninguna mesa en partida.
//
// EL BORDE SE DECLARA, NO SE DISIMULA. Un exterior con un límite por el que no
// se pasa necesita que ese límite sea algo que el sitio ya tendría —arboleda en
// un claro, muros en una mazmorra—, y por eso el cierre es un DATO
// (`CIERRES`) y no un `if` dentro del compositor: cambiar de bosque a mazmorra
// es cambiar qué props se colocan y de qué color es el suelo, no tocar la
// escena. Una nube puesta solo para tapar el vacío sería un parche, y además no
// explicaría nada del lugar. La niebla del motor hace el resto, que es
// literalmente para lo que la PSX la usaba: que la geometría no aparezca de
// golpe en el borde.
//
// LA REJILLA NO SE PINTA EN EL SUELO. Es la regla de #526 en la superficie
// donde más fácil sería saltársela: unas líneas pintadas en la hierba serían
// una medida que el sitio no tiene, y quien anda por dentro no tiene cómo saber
// que esas líneas son de la interfaz y no del mundo. La rejilla existe —está en
// `combate-rejilla.mjs`, con sus casillas y sus rangos— y se enseña en la vista
// táctica, que es donde una medida sí es una lectura.
//
// LAS FIGURAS SON PLACEHOLDER Y LO DICEN. Los combatientes de esta arena son
// mallas escaneadas del catálogo del museo —el Doríforo, el Hércules Farnesio,
// la Venus de Melos y un jabalí—, teñidas por bando. Modelos de verdad, con su
// procedencia ya verificada, que nadie va a confundir con el arte final de un
// enemigo: es preferible a modelar un guerrero provisional que luego cueste
// tirar.
//
// TODAVÍA SIN POSE DE COMBATE. `estatua-rig.mjs` (#603 fase 4) dobla una malla
// que declare su `rig`, pero los PESOS por vértice los calcula
// `tools/pesar-despiezar.mjs`, que es una herramienta de construcción y no algo
// que el módulo pueda importar. Ponerlos aquí en caliente sería duplicar esa
// herramienta dentro del juego. Lo que falta es el paso de la fase 2: generar
// los pesos una vez y guardarlos como dato, igual que las mallas están
// guardadas en `data/mallas/`. Hasta entonces estas figuras están de pie, que es
// como salieron del escaneo — y decirlo aquí es preferible a que la cabecera
// prometa una pose que el código no hace.
//
// EL PRESUPUESTO, MEDIDO — segunda pasada, tras añadir árboles más ramificados,
// cuatro árboles DENTRO del claro, maleza de helechos y fauna animada
// (insectos, hojas, algún pájaro). Peor rumbo desde la entrada —mirando los
// 45 m a lo largo, con la linde a ambos lados y los cuatro combatientes
// delante—: 2065 polígonos y 44,2 ms. Desde el centro del claro, 27 ms; junto
// al árbol grande, 32 ms. El punto de comparación sigue siendo el otro
// exterior del módulo: la playa cuesta 35,6 ms. Esta vez SÍ queda por encima,
// y solo en ese único punto de vista más caro — en el resto del claro va por
// debajo. Se deja así, medido y dicho, en vez de perseguir la paridad exacta
// con la playa: la densidad que se pidió (más árboles, más ramas, maleza,
// fauna) tiene un coste real, y fingir que no lo tiene sería peor que
// declararlo.
//
// UN FALLO SILENCIOSO QUE SÍ SE ARREGLÓ: la maleza sembraba helechos en las
// dos casillas de la entrada, y una pieza de medio metro a metro y medio de la
// cámara ocupa media pantalla — no una anomalía, geometría correcta vista de
// cerca. `malezaDelSuelo` excluye ahora la fila de aparición.
//
// De dónde sale el coste, por si algún día hay que recortar más: los cuatro
// combatientes son ~9 ms ellos solos (mallas de escaneo, 900 caras cada una);
// la linde y el bosque de fondo son el grueso del resto —más ahora que cada
// "arbol" lleva dos ramas propias—. Las palancas ya usadas: alcance de dibujo
// de 60 m en vez de 420 (a esa distancia la niebla ya lo funde todo), descarte
// por rumbo y distancia ANTES de llamar al motor, y `arbol-lejano` para el
// bosque de fondo. La maleza y la fauna, ya recortadas una vez cada una
// (helechos de 1 en 6 casillas a 1 en 25; la fauna se autodescarta por
// distancia antes de construir su malla), pesan poco por sí solas. Sin usar
// queda decimar las mallas de los combatientes — son placeholders, y eso es
// un paso de herramienta, no algo para hacer en caliente.
//
// Puro y sin color propio (#351): los colores salen de `BOSQUE` y `MUSEO` en
// `paleta.mjs`.

import { BOSQUE, FACCIONES, MUSEO, PLAYA } from "./paleta.mjs";
import { caja, losa } from "./escena-primitivas.mjs";
import { componerEscena, fundirEscenas, mezclar } from "./retro3d.mjs";
import { resolverCamara } from "./nave-camara.mjs";
import { poligonosOtrosJugadores } from "./nave-avatares-render.mjs";
import { crearPlanta } from "./nave-movimiento.mjs";
import { colocarProp, mezclarVocabularios } from "./nave-props.mjs";
import { VARIANTES_ARBOL, VOCABULARIO_BOSQUE, VOCABULARIO_COSTA } from "./props-exteriores.mjs";
import { declararInteracciones } from "./nave-interaccion.mjs";
import { ciclo, declararSol, franja, huellaDe } from "./escena-exteriores.mjs";
import { rngSemilla } from "./ventana-nave.mjs";
import { piezasHorizonte, texturasHorizonte } from "./horizonte-matte.mjs";
import { GRID_UNIT_FT } from "./pathfinding-core.mjs";
import { claveCasilla } from "./combate-rejilla.mjs";
import { DORIFORO } from "../data/mallas/doriforo.mjs";
import { HERAKLES_FARNESE } from "../data/mallas/herakles-farnese.mjs";
import { VENUS_DE_MILO } from "../data/mallas/venus-de-milo.mjs";
import { JABALI } from "../data/mallas/jabali.mjs";

/* ---- la medida ------------------------------------------------------------- */

/** Un pie en metros. La casilla de 5 ft del core en la unidad de la escena. */
const METROS_POR_PIE = 0.3048;

/** El lado de una casilla, en metros: 5 ft = 1,524 m. */
export const LADO_CASILLA = GRID_UNIT_FT * METROS_POR_PIE;

export const CASILLAS_ANCHO = 30;
export const CASILLAS_FONDO = 20;

/** 45,72 × 30,48 m. La arena entera es jugable: no hay tablero dentro de otro. */
export const ANCHO = CASILLAS_ANCHO * LADO_CASILLA;
export const PROFUNDIDAD = CASILLAS_FONDO * LADO_CASILLA;

/** Cuánto claro sobra alrededor antes de que empiece el cierre. Poco: el borde
 *  tiene que estar donde se acaba la casilla treinta, no a diez metros. */
const MARGEN = LADO_CASILLA * 0.9;

/* ---- la luz ---------------------------------------------------------------- */

// Sol de tarde alto, no rasante como el de la playa: en una arena hay que ver
// las figuras y el suelo a la vez, y un sol bajo alarga las sombras hasta
// convertirlas en el dibujo principal.
const SOL = declararSol([0.55, 0.62, 0.38]);
const AMBIENTE_EXTERIOR = 0.78;
/**
 * Alcance de dibujo: 110 m, no los 420 de la playa.
 *
 * NO es una optimización disfrazada de arte: es que en un claro de bosque no se
 * ve a cuatrocientos metros. La playa necesita ese alcance porque tiene un mar
 * que llega al horizonte; aquí lo que hay a esa distancia son árboles detrás de
 * árboles, y la propia arboleda tapa mucho antes. Con 110 m la niebla cierra el
 * mundo justo pasada la linde, que es exactamente lo que este nivel quiere
 * enseñar, y de paso deja de haber que dibujar lo que no se distingue.
 *
 * Medido: bajarlo de 420 a 110 y quitar los dos anillos de arbolado más lejanos
 * —los que la niebla ya había fundido con el cielo— llevó el peor rumbo de 49 ms
 * a lo que dice la cabecera de abajo, sin que el horizonte se abra.
 */
const ALCANCE = 60;
const ALCANCE_CIELO = 4000;
const TEXTURAS_MATTE = texturasHorizonte();

/* ---- los cierres ----------------------------------------------------------- */

/**
 * Cómo se cierra el borde, por ambiente.
 *
 * Cada cierre declara TRES cosas y ninguna es geometría: de qué color es el
 * suelo, qué props forman la linde y con qué densidad. El compositor no sabe
 * qué es un árbol ni qué es un muro — coloca lo que el cierre le diga, y por eso
 * añadir «cripta» o «ruinas» es escribir otra entrada aquí.
 */
export const CIERRES = Object.freeze({
  arboleda: Object.freeze({
    id: "arboleda",
    nombre: { es: "Claro de bosque", en: "Forest clearing" },
    suelo: BOSQUE.suelo,
    sueloAlterno: BOSQUE.sueloClaro,
    // Lo de más allá de la linde: el mismo bosque, más apagado. No es otro
    // material, es el mismo visto a través de aire.
    terreno: BOSQUE.lejania,
    // Vertical alto que tapa, y sotobosque bajo que rompe el suelo entre medias.
    linde: Object.freeze(["arbol", "arbol", "arbol", "tocon", "helecho", "helecho"]),
    // Cada cuántos metros de perímetro cae una pieza. Dos filas: la de dentro
    // clarea y la de fuera se cierra, que es como se ve una linde de verdad.
    paso: 3.1,
    cielo: PLAYA.cielo,
  }),
  mazmorra: Object.freeze({
    id: "mazmorra",
    nombre: { es: "Sala de mazmorra", en: "Dungeon hall" },
    suelo: MUSEO.zocalo,
    sueloAlterno: MUSEO.muro,
    terreno: MUSEO.suelo,
    // Una mazmorra no tiene linde: tiene muro. Se declara igual —props en el
    // perímetro— y lo que cambia es que el prop es piedra y va pegado.
    linde: Object.freeze(["roca", "roca", "roca"]),
    paso: 2.2,
    cielo: MUSEO.muro,
  }),
});

const VOCABULARIO_ARENA = mezclarVocabularios(VOCABULARIO_BOSQUE, VOCABULARIO_COSTA);

/** El cierre por defecto. La arboleda porque es la que prueba lo difícil: tapar
 *  sin muro, con piezas sueltas y niebla. */
export const CIERRE_POR_DEFECTO = "arboleda";

export function cierreDe(id) {
  return CIERRES[id] ?? CIERRES[CIERRE_POR_DEFECTO];
}

/* ---- los combatientes ------------------------------------------------------ */

/**
 * Quién está en el tablero y en qué casilla.
 *
 * En CASILLAS y no en metros: es la unidad en la que se juega, y la que entiende
 * `combate-rejilla.mjs`. La escena la traduce a metros al colocar, que es la
 * única traducción que hace falta y ocurre en un solo sitio.
 */
export const COMBATIENTES = Object.freeze([
  Object.freeze({ id: "doriforo", malla: DORIFORO, bando: "aliado", x: 12, y: 8 }),
  Object.freeze({ id: "venus", malla: VENUS_DE_MILO, bando: "aliado", x: 10, y: 11 }),
  Object.freeze({ id: "herakles", malla: HERAKLES_FARNESE, bando: "enemigo", x: 19, y: 7 }),
  Object.freeze({ id: "jabali", malla: JABALI, bando: "bestia", x: 21, y: 12 }),
]);

/**
 * El tinte de cada bando: PIEDRA teñida, no el color de facción a pelo.
 *
 * Los colores de `FACCIONES` son acentos de interfaz —pensados para un punto de
 * radar de cuatro píxeles— y a tamaño de figura gritan: una estatua en azul puro
 * se lee como un icono, no como algo que está en el campo. Mezclada un tercio
 * hacia el yeso del museo se lee como una figura de piedra que ADEMÁS tiene
 * bando, que es lo que hace falta: distinguir de un vistazo sin que el tablero
 * parezca un menú.
 */
const COLOR_BANDO = Object.freeze({
  aliado: mezclar(MUSEO.yeso, FACCIONES[6], 0.42), // azul
  enemigo: mezclar(MUSEO.yeso, FACCIONES[5], 0.42), // rojo
  bestia: mezclar(MUSEO.yeso, FACCIONES[3], 0.42), // verde
});

/** La caja que ocupa una malla, para poder apoyarla en el suelo y medir su huella. */
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

/** El centro en metros de una casilla. */
function centroDeCasilla(x, y) {
  return [(x + 0.5) * LADO_CASILLA, (y + 0.5) * LADO_CASILLA];
}

function piezasCombatientes() {
  return COMBATIENTES.map((quien) => {
    const limites = limitesDe(quien.malla);
    const [cx, cz] = centroDeCasilla(quien.x, quien.y);
    const medioX = (limites.x0 + limites.x1) / 2;
    const medioZ = (limites.z0 + limites.z1) / 2;
    return {
      malla: {
        ...quien.malla,
        // Centrada en su casilla y apoyada en el suelo: una malla de escaneo
        // trae su propio origen, y darlo por bueno deja figuras flotando.
        vertices: quien.malla.vertices.map(([vx, vy, vz]) => [
          vx - medioX + cx,
          vy - limites.y0,
          vz - medioZ + cz,
        ]),
      },
      color: COLOR_BANDO[quien.bando] ?? COLOR_BANDO.enemigo,
    };
  });
}

/** La huella de cada figura, para no poder atravesarla al andar.
 *
 *  OJO A LA DISTINCIÓN: al ANDAR una figura es un obstáculo sólido; en la
 *  rejilla táctica es `ocupacion` y no obstáculo, porque se puede atravesar la
 *  casilla de un aliado (ver `combate-rejilla.mjs`). Son dos capas distintas
 *  respondiendo a dos preguntas distintas sobre la misma figura. */
function huellasCombatientes() {
  return COMBATIENTES.map((quien) => {
    const [cx, cz] = centroDeCasilla(quien.x, quien.y);
    const lado = LADO_CASILLA * 0.55;
    return { x: cx - lado / 2, z: cz - lado / 2, ancho: lado, profundidad: lado };
  });
}

/* ---- árboles dentro de la arena --------------------------------------------- */

/**
 * Árboles DENTRO del claro y no solo en su borde: cuatro, uno grande ocupando
 * un bloque de 2×2 casillas y tres normales bien repartidos. Alejados entre sí
 * y de los combatientes de sobra para que ninguno tape una línea de visión
 * entera ni se confunda con un obstáculo puesto para una emboscada.
 *
 * En CASILLAS, como los combatientes: la escena es quien traduce a metros.
 */
const ARBOLES_INTERIORES = Object.freeze([
  Object.freeze({ clave: "arbol-grande", col: 15, fila: 14, ocupa: 2 }),
  Object.freeze({ clave: "arbol-b", col: 5, fila: 4, ocupa: 1 }),
  Object.freeze({ clave: "arbol-c", col: 25, fila: 5, ocupa: 1 }),
  Object.freeze({ clave: "arbol", col: 6, fila: 17, ocupa: 1 }),
]);

function piezasArbolesInteriores(cierre) {
  // Solo en la arboleda: una mazmorra no tiene árboles creciendo en la sala.
  if (cierre.id !== "arboleda") return [];
  return ARBOLES_INTERIORES.flatMap(({ clave, col, fila, ocupa }) => {
    // El centro de un árbol de 2×2 cae en la esquina que comparten sus cuatro
    // casillas, no en el centro de una de ellas.
    const cx = (col + ocupa / 2) * LADO_CASILLA;
    const cz = (fila + ocupa / 2) * LADO_CASILLA;
    return [colocarProp(clave, { x: cx, z: cz, cuartos: 0, nombre: `interior-${col}-${fila}`, vocabulario: VOCABULARIO_ARENA })];
  });
}

/** El bloque de casillas que cada árbol interior bloquea al andar. */
function huellasArbolesInteriores(cierre) {
  if (cierre.id !== "arboleda") return [];
  return ARBOLES_INTERIORES.map(({ col, fila, ocupa }) => ({
    x: col * LADO_CASILLA,
    z: fila * LADO_CASILLA,
    ancho: ocupa * LADO_CASILLA,
    profundidad: ocupa * LADO_CASILLA,
  }));
}

/* ---- maleza del suelo -------------------------------------------------------- */

/**
 * Helechos sueltos por el claro jugable, no solo en la linde.
 *
 * Deliberadamente disperso y no denso: esto es hierba alta rompiendo el plano
 * del suelo, no sotobosque — un claro de combate tiene que seguir leyéndose
 * caminable de un vistazo, que es justo lo que la linde (mucho más tupida) no
 * necesita respetar. Nunca sobre una casilla ocupada por un obstáculo, un
 * árbol interior o un combatiente: la maleza decora el suelo, no lo esconde.
 */
function malezaDelSuelo(cierre) {
  if (cierre.id !== "arboleda") return [];
  const ocupadas = new Set(COMBATIENTES.map((k) => claveCasilla(k.x, k.y)));
  for (const { col, fila, ocupa } of ARBOLES_INTERIORES) {
    for (let dc = 0; dc < ocupa; dc += 1) for (let df = 0; df < ocupa; df += 1) ocupadas.add(claveCasilla(col + dc, fila + df));
  }
  const rng = rngSemilla(0x4d414c45);
  const piezas = [];
  // MEDIDO: una de cada seis casillas (80 helechos, 28 caras cada uno) subía el
  // peor rumbo de 25 a 90 ms — más que todo lo demás junto. Una de cada
  // veinticinco sigue leyéndose como suelo roto sin dejar de caber en el
  // presupuesto de un exterior (ver la cabecera de más abajo).
  //
  // SIN LAS DOS FILAS DE LA ENTRADA. Un helecho a metro y medio de la cámara
  // ocupa media pantalla —es geometría de medio metro vista de cerca, no un
  // fallo de escala— y lo primero que se vería al entrar sería una mata negra
  // tapando la arena entera. Lo mismo vale para cualquier punto de aparición:
  // el suelo cede alrededor de donde se llega.
  const filaEntrada = Math.floor(ENTRADA.z / LADO_CASILLA);
  for (let f = 1; f < CASILLAS_FONDO - 1; f += 1) {
    if (Math.abs(f - filaEntrada) <= 1) continue;
    for (let c = 1; c < CASILLAS_ANCHO - 1; c += 1) {
      if (ocupadas.has(claveCasilla(c, f))) continue;
      if (rng() > 0.04) continue;
      const [cx, cz] = centroDeCasilla(c, f);
      const x = cx + (rng() - 0.5) * LADO_CASILLA * 0.6;
      const z = cz + (rng() - 0.5) * LADO_CASILLA * 0.6;
      piezas.push(colocarProp("helecho", { x, z, cuartos: Math.floor(rng() * 4), nombre: `maleza-${c}-${f}`, vocabulario: VOCABULARIO_ARENA }));
    }
  }
  return piezas;
}

/* ---- el suelo -------------------------------------------------------------- */

/**
 * El TERRENO de fuera: una losa grande bajo todo lo demás.
 *
 * Sin esto el mundo se acaba en el borde jugable, y lo que se ve detrás de la
 * arboleda —y entre tronco y tronco— es el cielo a ras de suelo: el horizonte
 * se lee como un vacío azul en vez de como un sitio que sigue. Es exactamente
 * el mismo fallo que la playa evita con su mar, que llega hasta el alcance de
 * dibujo y ahí se lo come la niebla.
 *
 * No es jugable ni pretende serlo: la planta sigue midiendo 30 × 20 casillas y
 * la linde sigue frenando. Esto es solo lo que hay MÁS ALLÁ, y por eso va un
 * tono más apagado que el claro y sin franjas — las franjas dan escala, y dar
 * escala a algo por lo que no se puede andar sería anunciar un tablero que no
 * existe.
 *
 * Llega hasta el alcance de dibujo, no hasta un número redondo: es la distancia
 * a la que la niebla ya lo ha fundido del todo con el cielo, así que ampliarlo
 * más sería pintar polígonos que nadie puede distinguir del fondo.
 */
function faldon(cierre) {
  const lejos = ALCANCE;
  return {
    // Un pelo por debajo del claro para que no peleen dos superficies en el
    // mismo plano: con el ajuste a rejilla de la PSX, un empate de profundidad
    // parpadea al andar.
    // OJO AL GIRO. `losa` no orienta nada: hace una cara con los puntos en el
    // orden que le den, y el motor descarta las que miran para el otro lado
    // (`areaFirmada <= 0`). Escrita en el orden "natural" —esquina mínima
    // primero, dando la vuelta— esta losa mira hacia ABAJO y desaparece entera,
    // sin error ni aviso: el mundo simplemente sigue sin suelo. Se midió
    // componiendo las dos versiones: 0 polígonos contra 1.
    malla: losa(
      [
        [-lejos, PROFUNDIDAD + lejos],
        [ANCHO + lejos, PROFUNDIDAD + lejos],
        [ANCHO + lejos, -lejos],
        [-lejos, -lejos],
      ],
      -0.04,
    ),
    color: cierre.terreno,
  };
}

/**
 * El suelo, a franjas de una casilla de ancho y en dos tonos.
 *
 * DOS TONOS, PERO NO UNA REJILLA. Las franjas van en una sola dirección y miden
 * una casilla: dan escala —se ve cuánto es cinco pies sin que nadie lo diga— sin
 * dibujar una cuadrícula, que sería una medida pintada en la hierba. Es la misma
 * diferencia que hay entre las juntas del suelo de la nave y unas líneas guía,
 * que #552 prohíbe expresamente.
 */
function suelo(cierre) {
  const franjas = [];
  for (let i = 0; i < CASILLAS_FONDO; i += 1) {
    const z0 = i * LADO_CASILLA;
    franjas.push(
      franja({
        desde: -MARGEN,
        hasta: ANCHO + MARGEN,
        z0,
        z1: z0 + LADO_CASILLA,
        alto: 0,
        color: i % 2 === 0 ? cierre.suelo : cierre.sueloAlterno,
      }),
    );
  }
  return franjas;
}

/* ---- la linde -------------------------------------------------------------- */

/**
 * Coloca el cierre alrededor de la arena, en dos filas.
 *
 * La de dentro va justo en el borde jugable y clarea; la de fuera va un paso
 * más allá y se cierra. Dos filas y no una porque una sola deja ver el hueco
 * entre pieza y pieza en cuanto te acercas, y tres serían coste sin lectura: lo
 * que hay detrás de la segunda ya se lo come la niebla.
 */
function lindeAlrededor(cierre) {
  const piezas = [];
  const rng = (n) => {
    // Determinista y sin `Math.random()`: la misma arena tiene siempre la misma
    // linde, que es lo que permite que una prueba hable de ella.
    const x = Math.sin(n * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };
  let n = 0;
  const colocar = (x, z, dentroFuera) => {
    let clave = cierre.linde[Math.floor(rng(n) * cierre.linde.length) % cierre.linde.length];
    n += 1;
    // La fila de fuera solo lleva lo que TAPA: un helecho a un paso por detrás
    // de otro helecho no cierra nada.
    if (dentroFuera === "fuera" && (clave === "helecho" || clave === "tocon")) return;
    // "arbol" no es una clave de verdad: es la señal de "pon un árbol normal",
    // y cuál de las tres iteraciones toca se decide aquí — así una arboleda no
    // es el mismo árbol clonado en cada hueco de la linde.
    if (clave === "arbol") clave = VARIANTES_ARBOL[Math.floor(rng(n) * VARIANTES_ARBOL.length)];
    n += 1;
    const cuartos = Math.floor(rng(n) * 4);
    n += 1;
    piezas.push(colocarProp(clave, { x, z, cuartos, nombre: `linde-${piezas.length}`, vocabulario: VOCABULARIO_ARENA }));
  };

  for (const [distancia, fila] of [[MARGEN * 0.55, "dentro"], [MARGEN * 0.55 + cierre.paso * 0.75, "fuera"]]) {
    const x0 = -distancia, x1 = ANCHO + distancia;
    const z0 = -distancia, z1 = PROFUNDIDAD + distancia;
    for (let x = x0; x <= x1; x += cierre.paso) {
      colocar(x, z0, fila);
      colocar(x, z1, fila);
    }
    for (let z = z0 + cierre.paso; z < z1; z += cierre.paso) {
      colocar(x0, z, fila);
      colocar(x1, z, fila);
    }
  }
  return piezas;
}

/**
 * Bosque de FONDO: manchas de arbolado más allá de la linde.
 *
 * La linde cierra el paso, pero por sí sola deja un horizonte de una sola fila
 * de árboles con cielo detrás — que es lo que delata que el mundo se acaba ahí.
 * Esto son cinco anillos de arbolado cada vez más lejos y más ralos, hasta
 * donde la niebla ya no deja distinguir un tronco de otro.
 *
 * Ralo a propósito según se aleja: un bosque uniforme hasta el horizonte cuesta
 * cientos de piezas y se ve peor —la niebla lo aplana todo al mismo tono— así
 * que lo que hay lejos es cada vez menos, no más pequeño.
 */
function bosqueDeFondo(cierre) {
  if (cierre.id !== "arboleda") return [];
  const piezas = [];
  const rng = (n) => {
    const v = Math.sin(n * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  let n = 500;
  // Tres anillos y no cinco: los dos que había a 40 y 58 m caían más allá de
  // donde la niebla ya lo ha fundido todo con el cielo, así que se pagaban
  // enteros y no se distinguían. Es el recorte que manda la regla de la casa
  // cuando el presupuesto no da: baja la densidad de lo anecdótico, nunca la
  // resolución de lo que se mira de cerca.
  // Con 60 m de alcance, un árbol más allá de la distancia media ya cae en la
  // niebla casi entera: el tercer anillo de antes (26 m más allá del borde) se
  // pagaba entero para enseñar un borrón. Dos anillos, más juntos.
  const anillos = [
    { distancia: 6, paso: 7 },
    { distancia: 13, paso: 10 },
  ];
  for (const { distancia, paso } of anillos) {
    const x0 = -distancia, x1 = ANCHO + distancia;
    const z0 = -distancia, z1 = PROFUNDIDAD + distancia;
    const puntos = [];
    for (let x = x0; x <= x1; x += paso) { puntos.push([x, z0]); puntos.push([x, z1]); }
    for (let z = z0 + paso; z < z1; z += paso) { puntos.push([x0, z]); puntos.push([x1, z]); }
    for (const [x, z] of puntos) {
      const jitter = paso * 0.35;
      piezas.push(
        colocarProp("arbol-lejano", {
          x: x + (rng(n++) - 0.5) * jitter,
          z: z + (rng(n++) - 0.5) * jitter,
          cuartos: Math.floor(rng(n++) * 4),
          nombre: `fondo-${piezas.length}`,
          vocabulario: VOCABULARIO_ARENA,
        }),
      );
    }
  }
  return piezas;
}

/* ---- vida en el claro -------------------------------------------------------
 *
 * Insectos, algún pájaro y hojas cayendo. Las tres funciones comparten una
 * regla: NO se paga nada por lo que no puede verse. `visiblesDesde` ya
 * descarta piezas fuera de rango o a la espalda; aquí el criterio adicional es
 * la DISTANCIA a la cámara, calculada antes de construir ni un vértice —un
 * insecto a 40 m no se distingue de un mosquito en el objetivo de la cámara, y
 * construir su malla para tirarla en el recorte sería exactamente el fallo que
 * `visiblesDesde` existe para evitar en el resto de la escena.
 *
 * Todas deterministas por semilla y por segundo, como `arenaVolando`/`oleaje`
 * de la playa: no hay estado que arrastrar entre fotogramas, así que la misma
 * captura del mismo instante da siempre el mismo resultado.
 */

const ALCANCE_INSECTOS = 9; // se leen solo de cerca: un punto de dos cm no llega más lejos
const ALCANCE_HOJAS = 22;
const ALCANCE_PAJAROS = 70; // siluetas grandes: se ven de lejos, y de lejos es donde deben estar

/** Un puñado de insectos en vuelo errático, cerca del observador. */
function insectosVolando(camara, segundos) {
  const rng = rngSemilla(0x1e5ec70);
  const [camX, , camZ] = camara;
  const piezas = [];
  for (let i = 0; i < 5; i += 1) {
    const cx = ciclo(rng() * ANCHO, ANCHO);
    const cz = ciclo(rng() * PROFUNDIDAD, PROFUNDIDAD);
    if (Math.hypot(cx - camX, cz - camZ) > ALCANCE_INSECTOS) continue;
    const fase = segundos * (2.2 + rng()) + i * 7.1;
    const x = cx + Math.sin(fase) * 0.35;
    const z = cz + Math.cos(fase * 1.3) * 0.35;
    const y = 0.5 + rng() * 0.9 + Math.sin(fase * 2.1) * 0.12;
    piezas.push({ malla: caja([x, y, z], [0.025, 0.025, 0.025]), color: BOSQUE.tronco });
  }
  return piezas;
}

/** Hojas cayendo, solo cerca de un árbol y solo cerca de la cámara. */
function hojasCayendo(camara, segundos) {
  const rng = rngSemilla(0x0eaf1a11);
  const [camX, , camZ] = camara;
  const origenes = [
    ...ARBOLES_INTERIORES.map(({ col, fila, ocupa }) => centroDeCasilla(col + ocupa / 2 - 0.5, fila + ocupa / 2 - 0.5)),
  ];
  const piezas = [];
  for (let i = 0; i < 10; i += 1) {
    const [ox, oz] = origenes[i % origenes.length];
    if (Math.hypot(ox - camX, oz - camZ) > ALCANCE_HOJAS) continue;
    const duracion = 5 + rng() * 2;
    const t = ciclo(segundos + rng() * duracion, duracion) / duracion; // 0 arriba, 1 en el suelo
    const deriva = 0.6 + rng() * 0.5;
    const x = ox + Math.sin(t * 6.3 + i) * deriva;
    const z = oz + Math.cos(t * 5.1 + i) * deriva;
    const y = 4.4 * (1 - t) + 0.05;
    piezas.push({
      malla: caja([x, y, z], [0.09, 0.01, 0.09]),
      color: rng() > 0.5 ? BOSQUE.follaje : BOSQUE.seco,
    });
  }
  return piezas;
}

/** Un pájaro, de tanto en tanto, cruzando el cielo lejos del claro. Silueta
 *  plana de dos caras en V: de lejos no hace falta más para leerse como ave. */
function pajarosLejanos(camara, segundos) {
  const rng = rngSemilla(0xb1d0);
  const [camX, , camZ] = camara;
  const piezas = [];
  for (let i = 0; i < 2; i += 1) {
    const duracionCiclo = 26 + i * 9;
    const fase = ciclo(segundos + i * 11, duracionCiclo) / duracionCiclo;
    if (fase > 0.4) continue; // vuela solo un tramo del ciclo: no siempre hay uno cruzando
    const recorrido = ALCANCE_PAJAROS * 1.6;
    const x = camX - ALCANCE_PAJAROS * 0.7 + fase * recorrido / 0.4;
    const z = camZ + (i === 0 ? -1 : 1) * (18 + rng() * 14);
    const y = 14 + rng() * 6 + Math.sin(fase * 40) * 0.4; // el aleteo, apenas insinuado
    const ala = 0.55;
    piezas.push({
      malla: {
        vertices: [[x - ala, y, z], [x, y - 0.12, z], [x + ala, y, z], [x, y + 0.03, z]],
        caras: [[0, 1, 3], [1, 2, 3]],
      },
      color: BOSQUE.tronco,
    });
  }
  return piezas;
}

/* ---- la escena ------------------------------------------------------------- */

function piezasDe(cierre) {
  const linde = [...lindeAlrededor(cierre), ...bosqueDeFondo(cierre), ...piezasArbolesInteriores(cierre), ...malezaDelSuelo(cierre)];
  const props = linde.flatMap(({ piezas }) =>
    piezas.map((pieza) => ({
      malla: pieza.malla ?? caja(pieza.centro, pieza.medidas),
      color: pieza.color,
      textura: pieza.textura ?? null,
    })),
  );
  return [faldon(cierre), ...suelo(cierre), ...props, ...piezasCombatientes()];
}

/** El lado de la zona en la que se agrupa, en metros. Ni una pieza por grupo
 *  (peaje por llamada) ni un grupo por color (envolvente del tamaño del mundo,
 *  que deja el descarte sin nada que tirar). Veinte metros: el orden de
 *  magnitud de lo que cabe en cuadro de una vez. */
const LADO_ZONA = 20;

/**
 * Funde piezas en mallas grandes, agrupando por COLOR y por ZONA.
 *
 * Las dos mitades son necesarias y se estorban si falta una:
 *
 * - Por COLOR porque `componerEscena` recibe un solo color por llamada, y tiene
 *   un peaje fijo por llamada (#551). MEDIDO aparte: agrupar solo por color no
 *   arregló nada aquí —57 ms antes, 56 después—, porque el coste de este claro
 *   está en el número de VÉRTICES y fundir no quita ninguno.
 * - Por ZONA porque el descarte de más abajo trabaja con la envolvente de cada
 *   grupo: fundir todos los árboles del mundo en una malla da una envolvente
 *   que cubre el mundo, y entonces no se puede descartar nada. Agrupado en
 *   zonas, lo que tienes a la espalda se cae entero antes de tocar el motor.
 */
function fundirPorColorYZona(piezas) {
  const grupos = new Map();
  const sueltas = [];
  for (const pieza of piezas) {
    const { malla, color, textura, emisivo } = pieza;
    // Lo que no es color plano no se puede fundir: textura y emisivo son
    // parámetros de la llamada, no de la cara.
    if (textura || emisivo) { sueltas.push(pieza); continue; }
    const primero = malla.vertices[0] ?? [0, 0, 0];
    const clave = `${color}|${Math.floor(primero[0] / LADO_ZONA)},${Math.floor(primero[2] / LADO_ZONA)}`;
    const grupo = grupos.get(clave) ?? { malla: { vertices: [], caras: [] }, color };
    const desplazamiento = grupo.malla.vertices.length;
    grupo.malla.vertices.push(...malla.vertices);
    grupo.malla.caras.push(...malla.caras.map((cara) => cara.map((i) => i + desplazamiento)));
    grupos.set(clave, grupo);
  }
  return [...grupos.values(), ...sueltas];
}

const CACHE_PIEZAS = new Map();
/**
 * La esfera que envuelve una malla, en coordenadas del mundo.
 *
 * Barata y suficiente: para decidir si un árbol entra en cuadro no hace falta
 * su silueta, hace falta dónde está y cuánto ocupa.
 */
function envolventeDe(malla) {
  let sx = 0, sy = 0, sz = 0;
  for (const [x, y, z] of malla.vertices) { sx += x; sy += y; sz += z; }
  const n = malla.vertices.length || 1;
  const centro = [sx / n, sy / n, sz / n];
  let radio = 0;
  for (const [x, y, z] of malla.vertices) {
    radio = Math.max(radio, Math.hypot(x - centro[0], y - centro[1], z - centro[2]));
  }
  return { centro, radio };
}

/**
 * Lo que de verdad hay que dibujar desde `(x, z)` mirando a `yaw`.
 *
 * EL DESCARTE VA ANTES DEL MOTOR, no dentro. `componerEscena` transforma TODOS
 * los vértices de la malla que recibe y solo después recorta: darle el bosque
 * entero significa girar cada árbol que tienes a la espalda, en cada fotograma,
 * para tirarlo justo después. Medido en este claro: 57 ms el peor rumbo, contra
 * los 4,2 ms de la peor sala de la nave.
 *
 * Dos criterios, los dos generosos a propósito —una pieza de más no se nota,
 * una de menos aparece de golpe—: fuera lo que queda más allá del alcance de
 * dibujo (ahí la niebla ya lo ha fundido con el cielo) y fuera lo que cae
 * claramente detrás del observador. El margen del cono es ancho: se compara
 * contra el radio de la pieza, así que un árbol que asoma por el borde entra.
 */
function visiblesDesde(piezas, x, z, yaw) {
  const frenteX = Math.sin(yaw), frenteZ = Math.cos(yaw);
  return piezas.filter(({ envolvente }) => {
    if (!envolvente) return true;
    const dx = envolvente.centro[0] - x;
    const dz = envolvente.centro[2] - z;
    const distancia = Math.hypot(dx, dz);
    if (distancia - envolvente.radio > ALCANCE) return false;
    // Muy cerca, cualquier cosa puede estar en cuadro: no se filtra por rumbo.
    if (distancia < envolvente.radio + 4) return true;
    // Detrás del observador, con el radio como colchón.
    return dx * frenteX + dz * frenteZ > -envolvente.radio;
  });
}

function piezasCacheadas(cierre) {
  if (!CACHE_PIEZAS.has(cierre.id)) {
    // El faldón y el suelo NO se funden con lo demás: son pocas piezas enormes,
    // y su envolvente cubriría medio mundo, así que agruparlas con los árboles
    // haría inútil el descarte. Cada grupo de color lleva la suya.
    const agrupadas = fundirPorColorYZona(piezasDe(cierre)).map((pieza) => ({
      ...pieza,
      envolvente: envolventeDe(pieza.malla),
    }));
    CACHE_PIEZAS.set(cierre.id, Object.freeze(agrupadas));
  }
  return CACHE_PIEZAS.get(cierre.id);
}

/** La huella de la linde, para que no se pueda andar a través de un árbol. */
function obstaculosDe(cierre) {
  return lindeAlrededor(cierre)
    .flatMap(({ piezas }) => huellaDe(piezas))
    // La linde está FUERA de la planta; solo interesan los rectángulos que
    // llegan a tocarla, que son los que de verdad frenan a alguien.
    .filter((rect) => rect.x + rect.ancho > 0 && rect.x < ANCHO && rect.z + rect.profundidad > 0 && rect.z < PROFUNDIDAD);
}

export const PLANTA_ARENA = crearPlanta({
  ancho: ANCHO,
  profundidad: PROFUNDIDAD,
  obstaculos: [...obstaculosDe(cierreDe(CIERRE_POR_DEFECTO)), ...huellasCombatientes(), ...huellasArbolesInteriores(cierreDe(CIERRE_POR_DEFECTO))],
});

/** Se entra por el borde corto, mirando al fondo: lo primero que se ve es la
 *  arena entera a lo largo, que es la lectura que este nivel existe para dar. */
export const ENTRADA = Object.freeze({ x: ANCHO / 2, z: LADO_CASILLA * 0.8, yaw: 0 });

export const INTERACCIONES = declararInteracciones([
  {
    id: "salida-arena",
    punto: [ANCHO / 2, LADO_CASILLA * 0.4],
    orientacion: Math.PI,
    accion: { tipo: "estancia", estancia: "cantina" },
  },
]);

/**
 * Compone la arena vista desde `(x, z)` mirando a `yaw`.
 *
 * Misma firma que la `componer` de la playa y de `crearSalaCaja`, que es lo que
 * el bucle de andar espera.
 */
export function componerArena(x, y, z, yaw, opciones = {}) {
  const {
    ancho: anchoLienzo = 480,
    alto: altoLienzo = 270,
    epoca,
    fov = 62,
    otrosJugadores = [],
    modoCamara,
    avatarPropio = {},
    tiempo = 0,
    cierre: idCierre = CIERRE_POR_DEFECTO,
  } = opciones;
  const cierre = cierreDe(idCierre);
  const segundos = Number.isFinite(tiempo) ? tiempo / 1000 : 0;
  const { camara, dibujarPropio } = resolverCamara({ x, z, y, yaw, modo: modoCamara });
  const yawCamara = -yaw;

  // SIN LA CAPA DE COSTA. `piezasHorizonte` devuelve las tres del preset, y la
  // primera es una línea de mar: detrás de una arboleda eso es literalmente un
  // mar donde no lo hay. Un claro se cierra con sus propios árboles y con la
  // niebla, así que aquí solo entran las capas de nubes. El matte propio de esta
  // escena —cuatro planos por punto cardinal, renderizados y guardados como
  // hace `horizonte-preset.mjs`— es el paso siguiente, no un parche de color.
  const horizonte = piezasHorizonte({ camara, segundos, texturas: TEXTURAS_MATTE })
    .filter((capa) => capa.nombre !== "costa")
    .map((capa) => ({
    malla: capa.malla,
    color: cierre.cielo,
    emisivo: true,
    lejos: ALCANCE_CIELO,
    textura: capa.textura,
  }));

  // El descarte, ANTES de tocar el motor: ver `visiblesDesde`.
  const enCuadro = visiblesDesde(piezasCacheadas(cierre), x, z, yaw);

  // Lo que se mueve: recalculado cada fotograma a partir de `segundos`, nunca
  // guardado. Las tres funciones ya descartan por distancia antes de construir
  // una sola malla, así que lejos de todo esto cuesta tres llamadas a
  // `Math.hypot` y nada más.
  const vivo = cierre.id === "arboleda"
    ? [...insectosVolando(camara, segundos), ...hojasCayendo(camara, segundos), ...pajarosLejanos(camara, segundos)]
    : [];

  const partes = [...horizonte, ...enCuadro, ...vivo].map(({ malla, color, emisivo, lejos, textura }) =>
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
        lejos: lejos ?? ALCANCE,
        textura: textura ?? null,
        ambiente: AMBIENTE_EXTERIOR,
        luz: SOL.direccion,
        fondo: cierre.cielo,
      },
    ),
  );

  // En tercera persona el propio cuerpo entra como un avatar más: el render de
  // presencia no sabe que uno de ellos eres tú.
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
