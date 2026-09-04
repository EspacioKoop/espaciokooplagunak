// Las luminarias del techo de una sala (#555).
//
// SUSTITUYEN A UNA LÁMPARA QUE CRECÍA CON LA HABITACIÓN. `lamparaTecho` medía
// `min(ancho, profundidad) * 0.22`, así que en el reactor (22x22 m) colgaba una
// losa de 4,84 m de lado: el trapecio enorme que domina todas las capturas de
// #551. Una luminaria es una PIEZA de medida fija que se repite, exactamente
// igual que una plancha de casco mide 1,6 m mida lo que mida el muro. Que un
// objeto escale con la sala que lo contiene es el mismo error que #540 corrigió
// en la planta, sobrevivido en el techo.
//
// La consecuencia práctica es que ahora una sala grande tiene MÁS luminarias, no
// una más grande — que además es lo que hace que se lea grande.
//
// UNA LUMINARIA ILUMINA, NO SEÑALA. Va en `LUZ_CALIDA` y no en el turquesa de
// `SECCION.entrable`, que es lo que usaba antes: ese acento marca ventanas,
// consolas y salas entrables, y gastarlo en un adorno del techo deja a la
// tripulación sin la única señal que tiene para encontrar lo accionable. Es la
// misma regla que el mural se impone a sí mismo (#548) y que aquí se había
// colado.
//
// EL DIFUSOR ES EMISIVO, Y ES LA ÚNICA FORMA DE QUE PAREZCA ENCENDIDO.
// `intensidadCara` deja un suelo de luz ambiente de 0,35 y la luz del motor
// viene de arriba, así que TODA cara que mire hacia abajo está en el mínimo: en
// este motor el techo es estructuralmente la superficie más oscura de la sala.
// Pintado con sombreado normal, un difusor ámbar llega al ojo como un marrón
// sucio — se probó, y las luminarias parecían fundidas. `componerEscena` acepta
// `emisivo` (#555): esa malla se pinta a intensidad plena, que es exactamente lo
// que hacía la máquina de referencia con las luces y las pantallas.
//
// EMISIVO NO ES UNA LUZ. El difusor no alumbra a nadie: el muro de enfrente no
// se aclara por tener una luminaria delante, y la sombra de una sala sigue
// saliendo de una única direccional fija. Poner luces de verdad —puntuales, con
// caída— es otra decisión: cambia el aspecto de TODAS las superficies y cuesta
// por cara y por lámpara. Va en #556, no de tapadillo aquí.
//
// Nada que se pueda leer (#526): carcasa y difusor. Ningún piloto que cambie de
// color, porque un piloto afirma un estado.
//
// Puro y sin color propio (#351). Se prueba desde Node.

import { LUZ_CALIDA, MURAL, ALERTA } from "./paleta.mjs";
import { normalizarAviso } from "./alerta-escena.mjs";

/**
 * Medidas de una luminaria, en metros. Fijas, que es todo el punto.
 *
 * 1,2 x 0,3 m: el tamaño de una pantalla fluorescente de las de siempre, que es
 * la referencia que hace que el techo dé escala en vez de quitarla.
 */
export const LARGO = 1.2;
export const ANCHO = 0.3;
/** Cuánto baja del techo: lo justo para que se lea colgada y no pintada. */
export const CAIDA = 0.18;

/**
 * Cada cuántos metros va una. 4 m es la cadencia a la que un pasillo queda
 * iluminado sin que las luminarias se toquen: por debajo se convierten en una
 * línea continua (que es otra cosa, y más cara), por encima la sala se lee a
 * oscuras entre una y otra.
 */
export const PASO = 4;

/**
 * Cuánto queda el difusor por debajo del eje de la carcasa, en metros.
 *
 * Estaba escrito tres veces —la carcasa, el foco y el test— con un comentario
 * pidiendo que coincidieran. Nada lo obligaba: si una cambiaba, el foco se iba
 * del difusor en silencio y el test seguía verde, porque repetía el mismo
 * número en vez de leerlo. Ahora sale de aquí, y desalinearlas exige editar
 * esta línea.
 */
export const CAIDA_DIFUSOR = 0.055;

/**
 * Dónde va cada luminaria de una sala. Se expone aparte de la geometría para
 * poder comprobar el REPARTO sin montar mallas: que sean de medida fija y que
 * una sala grande tenga más, no una mayor, es justo lo que se rompió antes.
 *
 * Van centradas en su celda de rejilla y no a partir de una esquina: con el
 * reparto por esquina, una sala cuyo ancho no es múltiplo del paso se queda con
 * una banda oscura en un lado y las luminarias pegadas al otro.
 *
 * @returns {{x:number, z:number}[]}
 */
export function reparto(ancho, profundidad, paso = PASO) {
  const columnas = Math.max(1, Math.round(ancho / paso));
  const filas = Math.max(1, Math.round(profundidad / paso));
  const puntos = [];
  for (let fila = 0; fila < filas; fila += 1) {
    for (let columna = 0; columna < columnas; columna += 1) {
      puntos.push({
        x: (ancho * (columna + 0.5)) / columnas,
        z: (profundidad * (fila + 0.5)) / filas,
      });
    }
  }
  return puntos;
}

/**
 * Caja SIN TAPA SUPERIOR, con el mismo giro de caras que el resto del módulo
 * (antihorario vistas desde fuera).
 *
 * Una luminaria cuelga del techo y solo se mira desde abajo: su cara de arriba
 * está contra el mamparo y no se ve NUNCA. Emitirla cuesta lo mismo que
 * cualquier otra —`componerEscena` la transforma y la proyecta antes de
 * descartarla por estar de espaldas—, y en el reactor son 36 luminarias. Quitar
 * lo que no puede verse es el único recorte de este módulo que no le quita nada
 * a nadie.
 */
function cajaColgada([cx, cy, cz], [ancho, alto, fondo], soloCostados = false) {
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
    caras: soloCostados
      ? [
          [0, 3, 2, 1], // frente
          [4, 5, 6, 7], // fondo
          [0, 4, 7, 3], // izquierda
          [1, 2, 6, 5], // derecha
        ]
      : [[0, 1, 5, 4]], // solo el fondo, que es por donde se mira
  };
}

/** El difusor: UNA cara mirando hacia abajo. Sus costados quedan dentro de la
 *  carcasa, así que dibujarlos sería pintar debajo de una tapa. */
function difusorHaciaAbajo([cx, cy, cz], [ancho, fondo]) {
  const x = ancho / 2;
  const z = fondo / 2;
  return {
    vertices: [
      [cx - x, cy, cz - z],
      [cx + x, cy, cz - z],
      [cx + x, cy, cz + z],
      [cx - x, cy, cz + z],
    ],
    caras: [[0, 1, 2, 3]],
  };
}

/** Junta varias cajas del mismo color en UNA malla, por lo mismo que
 *  `chapasDeRejilla` agrupa por color: `componerEscena` cobra por llamada, no
 *  por polígono, y un techo tiene muchas luminarias iguales. */
function fundir(mallas) {
  const malla = { vertices: [], caras: [] };
  for (const pieza of mallas) {
    const desde = malla.vertices.length;
    malla.vertices.push(...pieza.vertices);
    malla.caras.push(...pieza.caras.map((cara) => cara.map((i) => desde + i)));
  }
  return malla;
}

/** Medidas compartidas por la carcasa y el difusor, orientadas a lo LARGO del
 *  eje mayor de la sala — una pantalla cruzada respecto al pasillo se ve de
 *  canto desde donde se anda. */
function medidas(ancho, profundidad) {
  const alLargoDeX = ancho >= profundidad;
  return {
    carcasa: alLargoDeX ? [LARGO, 0.1, ANCHO] : [ANCHO, 0.1, LARGO],
    difusor: alLargoDeX ? [LARGO - 0.16, ANCHO - 0.08] : [ANCHO - 0.08, LARGO - 0.16],
  };
}

/**
 * Las luminarias de una sala, listas para la lista de piezas de `crearSalaCaja`.
 *
 * Solo la carcasa: metal normal, sin color propio ni parpadeo — recibe la luz
 * como cualquier otra pieza. El difusor NO está aquí (ver `mallaDifusorLuminarias`
 * y `colorDifusorLuminaria`): esta lista se congela una sola vez, en la
 * construcción de la sala (#765), y el difusor necesita repintarse cada
 * fotograma según la alerta y la salud del sistema — lo que #765 encontró
 * horneado aquí no podía funcionar, porque para cuando llega la telemetría la
 * sala ya está hecha.
 *
 * Llevó tapas en los extremos y se quitaron al medir: a 3,6 m de altura son
 * dos rebordes de 8 cm que nadie resuelve, y costaban un tercio de todas las
 * caras del techo.
 *
 * @param {{ancho:number, profundidad:number, altura:number}} sala
 * @returns {{malla:object, color:string}[]}
 */
export function piezasLuminarias({ ancho, profundidad, altura }) {
  const puntos = reparto(ancho, profundidad);
  if (puntos.length === 0) return [];
  const { carcasa: medidasCarcasa } = medidas(ancho, profundidad);

  const costados = [];
  const bajos = [];
  for (const { x, z } of puntos) {
    const yCarcasa = altura - CAIDA;
    costados.push(cajaColgada([x, yCarcasa, z], medidasCarcasa, true));
    bajos.push(cajaColgada([x, yCarcasa, z], medidasCarcasa, false));
  }

  return [
    { malla: fundir(bajos), color: MURAL.sombra },
    { malla: fundir(costados), color: MURAL.medio },
  ];
}

/**
 * La malla fundida de todos los difusores de una sala — SOLO geometría, sin
 * color. Se calcula una vez en la construcción (igual que `piezasLuminarias`)
 * y se reutiliza en cada `componer(...)`: lo que cambia por fotograma es el
 * color que le da `colorDifusorLuminaria`, nunca el vértice.
 *
 * @param {{ancho:number, profundidad:number, altura:number}} sala
 * @returns {object|null} malla fundida, o `null` si la sala no tiene luminarias.
 */
export function mallaDifusorLuminarias({ ancho, profundidad, altura }) {
  const puntos = reparto(ancho, profundidad);
  if (puntos.length === 0) return null;
  const { difusor: medidasDifusor } = medidas(ancho, profundidad);
  const yCarcasa = altura - CAIDA;
  const difusores = puntos.map(({ x, z }) => difusorHaciaAbajo([x, yCarcasa - CAIDA_DIFUSOR, z], medidasDifusor));
  return fundir(difusores);
}

/**
 * El color del difusor para este fotograma: la alerta de la nave, más un
 * parpadeo cuando el sistema que aloja la sala está dañado.
 *
 * `aviso` decide el tono base vía `tonoLuminaria` (verde/sin lectura = luz
 * cálida de siempre). `health` es la fracción [0,1] del sistema de la sala —
 * `null` cuando la sala no aloja sistema o no hay telemetría, y entonces no
 * hay parpadeo posible: un dato que no ha llegado no puede afirmar avería.
 * Por debajo de salud plena (1) se considera dañado y el difusor alterna
 * entre el tono base y apagado cada 500 ms — la misma cadencia que ya median
 * los tests de #765.
 *
 * El DIFUSOR es lo único emisivo de la nave (#555): se pinta a intensidad
 * plena, sin sombreado por normal. Apagado se emite en negro por el mismo
 * motivo — sombrearlo dejaría un marrón sucio en vez de un difusor apagado.
 *
 * @param {{aviso?:*, health?:number|null, timeMs?:number}} estado
 * @returns {{color:string, emisivo:true}}
 */
export function colorDifusorLuminaria({ aviso = null, health = null, timeMs = 0 } = {}) {
  const colorBase = tonoLuminaria(aviso);
  const dañado = typeof health === "number" && Number.isFinite(health) && health < 1;
  if (!dañado) return { color: colorBase, emisivo: true };
  const encendido = Math.floor(timeMs / 500) % 2 === 0;
  return { color: encendido ? colorBase : 0x000000, emisivo: true };
}

/**
 * Cuánto suma una luminaria a la cara que tiene debajo, y hasta dónde llega.
 *
 * NO SON CIFRAS FÍSICAS y no hay que buscarles unidades. `POTENCIA` se suma al
 * término direccional dentro de `intensidadCara`, donde el suelo ambiente es
 * 0,35 y el techo es 1: con 1 —el valor por defecto del motor— toda cara bajo
 * una lámpara se va al tope y la sala se queda plana y blanca, que es el
 * resultado contrario al que se busca.
 *
 * EL ALCANCE TIENE UN TECHO DURO Y NO ES ESTÉTICO. Las luminarias van cada
 * `PASO` = 4 m y el difusor cuelga a unos 3,5 m del suelo, así que un punto del
 * suelo a medio camino entre dos lámparas está a 4,03 m de CADA UNA, mientras
 * que el punto justo debajo de una está a 3,5 m de UNA sola. Con la caída lineal
 * de `contribucionFoco`, en cuanto el alcance crece lo suficiente para que las
 * dos lleguen al punto de en medio, ese punto recibe DOS aportaciones y acaba
 * más claro que el que está bajo la lámpara. Medido, con potencia 0,45:
 *
 *     alcance 3,9  →  bajo la lámpara 0,046   entre lámparas 0,000
 *     alcance 4,5  →  bajo la lámpara 0,100   entre lámparas 0,094
 *     alcance 5,0  →  bajo la lámpara 0,135   entre lámparas 0,174  ← invertido
 *     alcance 6,0  →  bajo la lámpara 0,188   entre lámparas 0,295  ← invertido
 *
 * Una sala iluminada al revés —oscura bajo las lámparas y clara entre ellas— no
 * se lee como un fallo de iluminación: se lee como que las lámparas no son
 * lámparas. Por eso `ALCANCE_FOCO` se queda por debajo de `PASO`, y hay una
 * prueba que lo exige en vez de confiar en este comentario.
 *
 * El precio de ese techo es que el charco en el SUELO es pequeño: a 3,9 m de
 * alcance, el punto bajo la lámpara sólo gana 0,046. Donde esto se lee de verdad
 * es en los MUROS, que están mucho más cerca de la luminaria que el suelo. Que
 * las luminarias se vean emitiendo es trabajo del cono de luz, no del sombreado.
 *
 * Estas dos cifras son ARTE y están para tocarlas mirando la sala.
 */
export const POTENCIA_FOCO = 0.45;
export const ALCANCE_FOCO = 3.9;

/**
 * Las luces de punto de las luminarias de una sala (#556).
 *
 * Devuelve un foco por luminaria, en el MISMO espacio de sala que
 * `piezasLuminarias` y `mallaDifusorLuminarias` — quien componga la escena es
 * responsable de trasladarlos igual que traslada la malla, porque
 * `intensidadCara` exige que focos y normales vivan en el mismo espacio.
 *
 * OJO A LA DIFERENCIA CON `emisivo`. El difusor es emisivo desde #555: eso dice
 * cómo se ve la propia luminaria, a intensidad plena y sin sombrear. Esto otro
 * dice cómo modifica a las DEMÁS caras. Son cosas distintas y por eso conviven:
 * hasta ahora la luminaria se veía encendida y no alumbraba nada.
 *
 * El motor se queda con los `TOPE_FOCOS` más cercanos al observador, así que
 * declarar los de una sala grande no cuesta por cara lo que cuesta declararlos.
 */
/**
 * El haz: cuánto se abre, cuánto pesa y de cuántas capas está hecho.
 *
 * LLEGA AL SUELO. Cortarlo en el aire evitaba dibujar un borde duro donde nada
 * lo produce, pero con el haz difuminado y a baja opacidad ese problema no
 * existe: lo que se ve es cómo se apaga, no dónde acaba. Y un haz que muere a
 * media altura deja el suelo sin decir nada, que era peor.
 *
 * BORDES DIFUMINADOS SIN ALFA POR VÉRTICE. El motor pinta cada cara de un color
 * plano con una opacidad, así que no hay degradado dentro de una cara. Se hace
 * como se hacía cuando tampoco lo había: CAPAS concéntricas, cada una más ancha
 * y con la misma opacidad baja. Donde se solapan todas —el eje del haz— la
 * opacidad se acumula; en el borde sólo queda la de fuera. El resultado es un
 * degradado escalonado, que es exactamente el lenguaje del resto del módulo.
 *
 * `ALFA_CONO` es por CAPA, no del haz entero: con `CAPAS_CONO` capas el núcleo
 * llega a ~1−(1−α)^n y el borde se queda en α. Por eso este número es mucho más
 * bajo que el de una sola capa opaca.
 *
 * CUÁNTAS CAPAS ES LA FINURA DEL DEGRADADO, no su forma. Con alfa igual en todas
 * la opacidad acumulada crece casi linealmente del borde al eje, que es la forma
 * que se quiere; lo que cambia al añadir capas es el tamaño del ESCALÓN entre
 * una y otra, que es lo único que se ve como banda. Medido, del borde al núcleo:
 *
 *     3 capas α 0,055  →  borde 0,055   núcleo 0,156   escalón 0,051
 *     6 capas α 0,016  →  borde 0,016   núcleo 0,092   escalón 0,015
 *
 * O sea: seis capas a 0,016 pesan la mitad que tres a 0,055 y el escalón se
 * queda en un tercio. Más capas cuestan caras, y por eso no son doce.
 */
export const APERTURA_CONO = 0.34;
export const ALFA_CONO = 0.016;
export const CAPAS_CONO = 6;

/** Cuántos lados tiene el haz. Seis y no ocho: son tres capas, así que cada
 *  lado se paga tres veces, y a esta resolución no se distingue un hexágono
 *  difuminado de un octógono difuminado. */
const LADOS_CONO = 6;

/** Lo que el haz se queda por encima del suelo. Sólo lo justo para no pelearse
 *  con la losa por el mismo plano, que es un parpadeo, no un borde. */
const POSO_CONO = 0.02;

/**
 * El haz de luz de una luminaria, en capas concéntricas de dentro a fuera.
 *
 * POR QUÉ HACE FALTA, si ya hay luces de punto. Porque en esta nave el sombreado
 * por foco casi no se lee en el suelo: con las luminarias cada `PASO` = 4 m y el
 * difusor a 3,5 m, el alcance está topado por debajo de 4 (ver `ALCANCE_FOCO`) y
 * el punto bajo la lámpara sólo gana 0,046 de intensidad. El sombreado dice que
 * hay luz; el haz es lo que hace que se VEA que la luminaria la está emitiendo.
 *
 * Es geometría barata y honesta, no volumétrico: unas cuantas caras traslúcidas
 * que se pintan con el resto y se ordenan con el resto. Nada de acumulación por
 * rayo.
 *
 * Sale en el MISMO espacio de sala que `piezasLuminarias`.
 *
 * @returns {Array<{alpha:number, porLuminaria:Array<{centro:number[], malla:object}>}>}
 *   una entrada por capa, de la interior a la exterior. Vacío si la sala no
 *   tiene luminarias.
 */
export function capasConoLuminarias({ ancho, profundidad, altura, apertura = APERTURA_CONO, capas = CAPAS_CONO }) {
  const puntos = reparto(ancho, profundidad);
  if (puntos.length === 0) return [];
  const { difusor: medidasDifusor } = medidas(ancho, profundidad);
  const yArriba = altura - CAIDA - CAIDA_DIFUSOR;
  const yAbajo = POSO_CONO;
  const caida = yArriba - yAbajo;
  if (caida <= 0) return [];
  // Arranca del tamaño del propio difusor, no de un punto: un haz que nace en un
  // vértice sale de un sitio donde no hay lámpara, y se ve. `difusor` viene en
  // DOS medidas (largo y ancho del panel), no en tres: es una placa, no una caja.
  const rArriba = Math.max(medidasDifusor[0], medidasDifusor[1]) / 2;
  const rAbajo = rArriba + apertura * caida;

  const salida = [];
  for (let capa = 1; capa <= capas; capa += 1) {
    // De dentro a fuera. La capa exterior es el haz completo; las de dentro son
    // fracciones de su radio, y la de arriba se estrecha igual para que todas
    // salgan de la lámpara y no de un anillo alrededor.
    const escala = capa / capas;
    salida.push({
      alpha: ALFA_CONO,
      // Por luminaria y NO fundido: quien componga elige cuáles pinta (ver
      // `fundirCercanas`). Fundirlo aquí obligaría a pagar las 36 luminarias de
      // una sala grande para ver las tres que se tienen delante.
      porLuminaria: puntos.map(({ x, z }) => ({
        centro: [x, z],
        malla: troncoDeCono([x, yArriba, z], rArriba * escala, [x, yAbajo, z], rAbajo * escala),
      })),
    });
  }
  return salida;
}

/**
 * Cuántas luminarias aportan haz o polvo a la vez.
 *
 * Es la misma regla que el motor ya aplica a los focos con `TOPE_FOCOS`, y por
 * el mismo motivo: el reactor tiene 36 luminarias y desde cualquier punto se
 * ven unas pocas. Sin este recorte, la prueba de #584 —que exige que texturar
 * quite la mayor parte de la geometría de una sala— deja de pasar, porque el
 * haz pasa a ser un tercio de los polígonos de una sala ya optimizada.
 */
export const TOPE_HACES = 4;

/**
 * Funde sólo las `cuantas` luminarias más cercanas a un punto del suelo.
 *
 * El recorte es por DISTANCIA EN PLANTA y no en 3D: todas las luminarias están
 * a la misma altura, así que la componente vertical es una constante que sólo
 * gastaría una raíz por lámpara.
 */
export function fundirCercanas(porLuminaria, [x, z] = [0, 0], cuantas = TOPE_HACES) {
  if (!Array.isArray(porLuminaria) || porLuminaria.length === 0) return null;
  const elegidas = porLuminaria
    .map((entrada) => ({ entrada, d: (entrada.centro[0] - x) ** 2 + (entrada.centro[1] - z) ** 2 }))
    .sort((a, b) => a.d - b.d)
    .slice(0, Math.max(1, cuantas))
    .map(({ entrada }) => entrada.malla);
  return fundir(elegidas);
}

/** Un tronco de cono vertical, tapado por abajo: la tapa es el charco de luz en
 *  el suelo, y sin ella el haz se ve hueco justo desde donde más se mira. */
function troncoDeCono([xa, ya, za], radioArriba, [xb, yb, zb], radioAbajo) {
  const vertices = [];
  for (let i = 0; i < LADOS_CONO; i += 1) {
    const a = (i / LADOS_CONO) * Math.PI * 2;
    vertices.push([xa + Math.cos(a) * radioArriba, ya, za + Math.sin(a) * radioArriba]);
  }
  for (let i = 0; i < LADOS_CONO; i += 1) {
    const a = (i / LADOS_CONO) * Math.PI * 2;
    vertices.push([xb + Math.cos(a) * radioAbajo, yb, zb + Math.sin(a) * radioAbajo]);
  }
  const caras = [];
  for (let i = 0; i < LADOS_CONO; i += 1) {
    const j = (i + 1) % LADOS_CONO;
    caras.push([i, j, LADOS_CONO + j, LADOS_CONO + i]);
  }
  caras.push(Array.from({ length: LADOS_CONO }, (_, i) => LADOS_CONO + i).reverse());
  return { vertices, caras };
}

/* ---- las motas de polvo ---------------------------------------------------- */

/** Cuántas motas por luminaria, su tamaño, y en qué tramo del haz viven. */
export const MOTAS_POR_LUMINARIA = 5;
const LADO_MOTA = 0.075;
/** Sólo en lo alto del haz, cerca del foco: es donde la luz rasante las
 *  encendería de verdad. Repartidas por todo el cono serían niebla, y la nave
 *  no tiene niebla dentro. */
const TRAMO_MOTAS = 0.9;
/**
 * CASI OPACAS, y ésta es la corrección de QA (Eloy: «no he visto las motas»).
 *
 * Iban a 0,5 y medían 3,5 cm, o sea unos 12 px² en pantalla, DEL MISMO COLOR que
 * el haz en el que flotan. Dos cosas a la vez: demasiado pequeñas y sin
 * contraste contra su propio fondo. Una mota de polvo iluminada no es un velo:
 * es un punto brillante y sólido, y con el haz al 9 % en su eje sólo se lee si
 * la mota está muy por encima de eso.
 *
 * Sigue sin ser 1 del todo para que se note que está dentro de la luz y no
 * pegada al cristal de la pantalla.
 */
export const ALFA_MOTAS = 0.9;

/**
 * Un ruido determinista en [0, 1) a partir de tres enteros/reales.
 *
 * Determinista Y SIN SEMILLA DE RELOJ a propósito: las motas de una sala tienen
 * que caer siempre en el mismo sitio, o parpadearían de fotograma en fotograma
 * como un error de render. Es la misma regla que la piel del muro (#548), sólo
 * que aquí la semilla es la propia posición de la luminaria.
 */
function ruido(a, b, c) {
  const n = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * Las motas de polvo suspendidas en lo alto de cada haz.
 *
 * Cubos diminutos, no puntos: el motor pinta polígonos y no tiene primitiva de
 * punto, y a esta resolución un cubo de 3,5 cm ES un punto.
 *
 * No se mueven. Animarlas exigiría un bucle por fotograma para algo que ocupa
 * cuatro píxeles, y la nave ya decidió que su ambiente no se anima solo.
 */
export function motasLuminarias({ ancho, profundidad, altura, cuantas = MOTAS_POR_LUMINARIA, apertura = APERTURA_CONO }) {
  const puntos = reparto(ancho, profundidad);
  if (puntos.length === 0 || cuantas <= 0) return [];
  const { difusor: medidasDifusor } = medidas(ancho, profundidad);
  const yArriba = altura - CAIDA - CAIDA_DIFUSOR;
  const rArriba = Math.max(medidasDifusor[0], medidasDifusor[1]) / 2;

  return puntos.map(({ x, z }) => {
    const cubos = [];
    for (let i = 0; i < cuantas; i += 1) {
      // La altura primero, porque el radio del haz depende de ella: una mota
      // fuera del cono se vería flotando al lado de la luz, no dentro.
      const caida = ruido(x, z, i) * TRAMO_MOTAS;
      const radio = (rArriba + apertura * caida) * Math.sqrt(ruido(z, i, x));
      const angulo = ruido(i, x, z) * Math.PI * 2;
      cubos.push(cajaCentrada(
        [x + Math.cos(angulo) * radio, yArriba - caida, z + Math.sin(angulo) * radio],
        LADO_MOTA,
      ));
    }
    return { centro: [x, z], malla: fundir(cubos) };
  });
}

/** Un cubo por su centro. No se reusa `caja` de `escena-primitivas` para no
 *  arrastrar sus UV: una mota de tres centímetros no tiene textura que mapear. */
function cajaCentrada([cx, cy, cz], lado) {
  const h = lado / 2;
  return {
    vertices: [
      [cx - h, cy - h, cz - h], [cx + h, cy - h, cz - h], [cx + h, cy + h, cz - h], [cx - h, cy + h, cz - h],
      [cx - h, cy - h, cz + h], [cx + h, cy - h, cz + h], [cx + h, cy + h, cz + h], [cx - h, cy + h, cz + h],
    ],
    caras: [[0, 3, 2, 1], [4, 5, 6, 7], [0, 4, 7, 3], [1, 2, 6, 5], [3, 7, 6, 2], [0, 1, 5, 4]],
  };
}

export function focosLuminarias({ ancho, profundidad, altura, potencia = POTENCIA_FOCO, alcance = ALCANCE_FOCO }) {
  const puntos = reparto(ancho, profundidad);
  if (puntos.length === 0) return [];
  const yCarcasa = altura - CAIDA;
  // A la altura exacta del difusor: el foco alumbra desde donde se ve la luz.
  const yFoco = yCarcasa - CAIDA_DIFUSOR;

  return puntos.map(({ x, z }) => Object.freeze({
    posicion: Object.freeze([x, yFoco, z]),
    potencia,
    alcance,
  }));
}

/**
 * El tono de la luminaria segun el nivel de alerta.
 *
 * USA EL TONO DEL **BORDE**, y no el del texto, por la razon que ya dejo escrita
 * `filtros-escena.mjs` al teñir la escena: el rojo del texto esta ACLARADO para
 * leerse en tamaño pequeño sobre el fondo del aviso. Una luminaria es una
 * superficie ancha, igual que el tinte y que el borde, y con el tono aclarado
 * la nave en alerta roja se lava a rosa en vez de teñirse.
 *
 * Elegir el mismo campo que el tinte de escena no es solo consistencia: es que
 * las dos cosas se ven A LA VEZ, y con tonos distintos se pelearian.
 *
 * `verde` no lleva color a proposito (ver `ALERTA` en `paleta.mjs`): la nave sin
 * alerta no se tiñe de nada, asi que devuelve la luz calida de siempre. Y la
 * AUSENCIA de lectura tampoco es una alerta — un dato que no ha llegado no puede
 * pintar la nave de rojo.
 *
 * El nivel se normaliza con `normalizarAviso`, que es el unico sitio donde se
 * decide que significa un aviso mal formado.
 *
 * @param {string|{nivel:string}|null|undefined} aviso nivel o aviso completo.
 * @returns {string} color hexadecimal.
 */
export function tonoLuminaria(aviso) {
  const { nivel } = normalizarAviso(aviso);
  return ALERTA.niveles[nivel]?.borde ?? LUZ_CALIDA;
}
