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
import { caja } from "./escena-primitivas.mjs";

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
 * El HAZ visible y el polvo en suspensión (#556, "El haz de las luminarias").
 *
 * Medido con el motor real, no imaginado: tres capas de cono concéntricas de
 * opacidad 0,055 cada una —donde se solapan las tres, en el eje, se acumula un
 * 16%; en el borde del charco queda solo un 5%—, porque el motor pinta cada
 * cara de un color plano y este es cómo se fingía un degradado cuando tampoco
 * existía uno de verdad: capas. El alfa sale del propio polígono —un color
 * `rgba(...)` con `emisivo:true`— y el pintor lo compone solo, porque ya
 * dibuja de lejos a cerca; no hace falta tocar el motor para esto.
 *
 * SOLO LAS LUMINARIAS MÁS CERCANAS A LA CÁMARA, nunca todas las de la sala:
 * pintar las 36 del reactor de golpe costaba un +41% medido, y el motor de
 * FOCOS ya resuelve exactamente este mismo problema (`TOPE_FOCOS`) — aquí se
 * aplica la misma regla a la geometría del haz, con el mismo tope.
 */
const RADIOS_HAZ = [0.6, 1.15, 1.7]; // m — el charco mide 3,4 m de diámetro
const OPACIDAD_CAPA_HAZ = 0.055;
const LADOS_HAZ = 10;
const SEPARACION_SUELO_HAZ = 0.02; // no comparte plano con la losa: eso es un parpadeo
const MOTAS_POR_LUMINARIA = 5;
const LADO_MOTA = 0.035;
export const TOPE_LUMINARIAS_CON_HAZ = 4;

function conoDeHaz([x, yApice, z], radioBase, ySuelo) {
  const vertices = [[x, yApice, z]];
  for (let i = 0; i < LADOS_HAZ; i += 1) {
    const ang = (i / LADOS_HAZ) * Math.PI * 2;
    vertices.push([x + Math.cos(ang) * radioBase, ySuelo, z + Math.sin(ang) * radioBase]);
  }
  const caras = [];
  for (let i = 0; i < LADOS_HAZ; i += 1) {
    const j = (i + 1) % LADOS_HAZ;
    caras.push([0, 1 + i, 1 + j]);
  }
  return { vertices, caras };
}

/** Un azar determinista por posición: la misma luminaria da siempre las
 *  mismas motas — sin esto saltarían de sitio en cada fotograma. */
function azarDe(x, z) {
  let semilla = (Math.round(x * 1000) * 7919 + Math.round(z * 1000) * 104729) >>> 0;
  return () => {
    semilla = (semilla + 0x6d2b79f5) >>> 0;
    let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function motasDeLuminaria([x, yFoco, z]) {
  const azar = azarDe(x, z);
  const piezas = [];
  for (let i = 0; i < MOTAS_POR_LUMINARIA; i += 1) {
    const ang = azar() * Math.PI * 2;
    const radio = azar() * 0.45;
    const y = yFoco - azar() * 0.14; // cerca del difusor: es ahí donde la luz rasante lo enciende
    piezas.push({
      malla: caja([x + Math.cos(ang) * radio, y, z + Math.sin(ang) * radio], [LADO_MOTA, LADO_MOTA, LADO_MOTA]),
      color: "rgba(255, 219, 168, 0.55)",
      emisivo: true,
    });
  }
  return piezas;
}

/**
 * El haz y el polvo de las luminarias más cercanas a `[camX,,camZ]` — nunca
 * todas las de la sala. `focos` ya trae la posición exacta de cada difusor
 * (`focosLuminarias`), así que esto solo ordena por distancia, se queda con
 * las `tope` primeras y dibuja.
 */
export function piezasHazLuminarias({ ancho, profundidad, altura }, [camX, , camZ], tope = TOPE_LUMINARIAS_CON_HAZ) {
  const focos = focosLuminarias({ ancho, profundidad, altura });
  if (focos.length === 0) return [];
  const cercanas = [...focos]
    .sort((a, b) => {
      const da = (a.posicion[0]-camX)**2 + (a.posicion[2]-camZ)**2;
      const db = (b.posicion[0]-camX)**2 + (b.posicion[2]-camZ)**2;
      return da - db;
    })
    .slice(0, Math.max(0, tope));

  const piezas = [];
  for (const { posicion } of cercanas) {
    for (const radio of RADIOS_HAZ) {
      piezas.push({ malla: conoDeHaz(posicion, radio, SEPARACION_SUELO_HAZ), color: `rgba(255, 215, 150, ${OPACIDAD_CAPA_HAZ})`, emisivo: true });
    }
    piezas.push(...motasDeLuminaria(posicion));
  }
  return piezas;
}

export function focosLuminarias({ ancho, profundidad, altura }) {
  const puntos = reparto(ancho, profundidad);
  if (puntos.length === 0) return [];
  const yCarcasa = altura - CAIDA;
  // A la altura exacta del difusor: el foco alumbra desde donde se ve la luz.
  const yFoco = yCarcasa - CAIDA_DIFUSOR;

  const focos = [];
  for (const { x, z } of puntos) {
    focos.push({ posicion: [x, yFoco, z] });
  }
  return focos;
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
