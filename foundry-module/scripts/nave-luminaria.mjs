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
// LO CÁLIDO VA EN LOS COSTADOS, NO EN EL DIFUSOR, y esto no es una preferencia
// sino una consecuencia del motor. `intensidadCara` deja un suelo de luz
// ambiente de 0,35 y la luz viene de arriba, así que TODA cara que mire hacia
// abajo está en el mínimo: un difusor ámbar puesto boca abajo llega al ojo como
// un marrón sucio. En este motor el techo es estructuralmente la superficie más
// oscura de la sala y ninguna pieza suya puede parecer brillante por su color.
// Lo que sí funciona es que el resplandor salga por los costados de la carcasa
// —caras verticales, bien iluminadas—, que además es como se ve de verdad una
// pantalla empotrada. Es la misma lección que el suelo de #552, llevada al otro
// extremo: cada orientación tiene su tramo de rampa y copiar el del vecino apaga
// la superficie sin que nadie sepa por qué.
//
// Nada que se pueda leer (#526): carcasa y difusor. Ningún piloto que cambie de
// color, porque un piloto afirma un estado.
//
// Puro y sin color propio (#351). Se prueba desde Node.

import { LUZ_CALIDA, MURAL } from "./paleta.mjs";

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

/**
 * Las luminarias de una sala, listas para la lista de piezas de `crearSalaCaja`.
 *
 * Dos partes y ni una más: la carcasa que la cuelga y el difusor que se ve
 * encendido. Llevaron tapas en los extremos y se quitaron al medir: a 3,6 m de
 * altura son dos rebordes de 8 cm que nadie resuelve, y costaban un tercio de
 * todas las caras del techo.
 *
 * Se orientan a lo LARGO del eje mayor de la sala, como se montan de verdad —una
 * pantalla cruzada respecto al pasillo se ve de canto desde donde se anda.
 *
 * @param {{ancho:number, profundidad:number, altura:number}} sala
 * @returns {{malla:object, color:string}[]}
 */
export function piezasLuminarias({ ancho, profundidad, altura }) {
  const puntos = reparto(ancho, profundidad);
  if (puntos.length === 0) return [];
  const alLargoDeX = ancho >= profundidad;
  const medidasCarcasa = alLargoDeX ? [LARGO, 0.1, ANCHO] : [ANCHO, 0.1, LARGO];
  const medidasDifusor = alLargoDeX ? [LARGO - 0.16, ANCHO - 0.08] : [ANCHO - 0.08, LARGO - 0.16];

  const costados = [];
  const bajos = [];
  const difusores = [];
  for (const { x, z } of puntos) {
    const yCarcasa = altura - CAIDA;
    costados.push(cajaColgada([x, yCarcasa, z], medidasCarcasa, true));
    bajos.push(cajaColgada([x, yCarcasa, z], medidasCarcasa, false));
    difusores.push(difusorHaciaAbajo([x, yCarcasa - 0.055, z], medidasDifusor));
  }

  // El ORDEN de estas tres importa, y es donde está la decisión del módulo (ver
  // la cabecera): lo cálido va en los COSTADOS, que son las caras verticales y
  // las únicas que reciben luz de verdad. Lo que mira hacia abajo va en tonos de
  // metal, porque a esa orientación cualquier color llega apagado y pintarlo de
  // ámbar solo produce un marrón sucio.
  return [
    { malla: fundir(bajos), color: MURAL.sombra },
    { malla: fundir(difusores), color: MURAL.brillo },
    { malla: fundir(costados), color: LUZ_CALIDA },
  ];
}
