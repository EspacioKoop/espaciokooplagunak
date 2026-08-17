// La terraza de la cantina (#579): una plataforma exterior con mesa, sillas y
// un soporte de cañas, colgada del muro norte de la cantina.
//
// ## Por qué es una estancia y no una escena
//
// La jerarquía decidida en #577 es que **andar es la navegación principal**, la
// sección es el mapa y la cantina un atajo. Una terraza que fuese su propia
// ventana sería una cuarta geografía: dos sitios donde el jugador «está», y
// ninguna forma de decir cuál es el de verdad. Aquí es una estancia más del
// catálogo de andar, con su puerta, su planta y su colisión, y se llega a ella
// andando desde la cantina como se llega a cualquier otra sala.
//
// ## Por qué se construye con la misma fábrica
//
// Ser un caso especial le costó a la cantina tres rondas de QA (#540): puertas
// que no daban a ninguna parte, suelo visible por el que no se podía andar y
// una escala propia. Todo eso venía de que el dibujo y la colisión salían de
// declaraciones distintas. La terraza pasa por `crearSalaCaja` como las otras
// catorce estancias; lo único que necesita de nuevo es no tener techo y que sus
// tres muros exteriores sean un antepecho, y eso son dos parámetros de la
// fábrica, no una fábrica aparte.
//
// ## Qué es esto y qué no
//
// Es un sitio donde la tripulación sale a sentarse. No hay mecánica de pesca:
// hay un puesto de pesca DECLARADO (`PUNTO_PESCA`), para que el minijuego que
// venga después pueda encontrarlo por nombre en vez de traerse las coordenadas
// escritas a mano, que es como se acaba con dos verdades sobre dónde está una
// cosa.
//
// Puro: compone datos y devuelve `{planta, componer}`.

import { crearSalaCaja } from "./nave-sala-caja.mjs";
import { CANTINA, SECCION } from "./paleta.mjs";
import { barandilla, mesa, silla, soporteCanas } from "./nave-props.mjs";

/** Medidas de la plataforma. Cabe una mesa con cuatro sillas y se anda alrededor. */
export const ANCHO = 7.2;
export const PROFUNDIDAD = 5.4;

/**
 * Hueco de paso hacia la cantina, en el muro ESTE de la terraza.
 *
 * Al este porque la terraza cuelga del costado de babor de la cantina: su
 * puerta es el muro oeste de aquella (ver `PUERTA_TERRAZA` en
 * `cantina-sala.mjs`, que explica por qué no puede ir en el norte).
 */
const ANCHO_PUERTA = 2.4;
export const PUERTA_CANTINA = Object.freeze({
  x: ANCHO - 1.2,
  z: (PROFUNDIDAD - ANCHO_PUERTA) / 2,
  ancho: 1.2,
  profundidad: ANCHO_PUERTA,
});

/**
 * El puesto de pesca: dónde se pone quien pesque, y hacia dónde mira.
 *
 * Se exporta como dato y no se deduce de la posición del soporte porque es lo
 * que el futuro minijuego va a necesitar localizar. La condición que pone #579
 * es literalmente esta: que la interacción pueda encontrar algo equivalente a
 * `punto-pesca` sin coordenadas incrustadas en la escena.
 *
 * `yaw` 0 mira a +z (ver `nave-movimiento.mjs`), así que π mira al norte, que
 * es por donde la terraza se abre al espacio.
 */
export const PUNTO_PESCA = Object.freeze({
  id: "punto-pesca",
  x: ANCHO - 1.9,
  z: 1.25,
  yaw: 0,
});

/** Donde se apoyan las cañas: junto al borde, al alcance del puesto de pesca. */
const SOPORTE = Object.freeze({ x: ANCHO - 1.9, z: 0.62 });

/**
 * El mobiliario de la terraza, todo del vocabulario de props (#579) y nada
 * modelado a medida para este sitio.
 *
 * Los colores son los de la CANTINA y no los del casco: la terraza es su
 * extensión, y una mesa de chapa gris al lado de una barra de madera se lee
 * como otro local. La barandilla sí es del casco — es estructura, no mueble.
 */
function mobiliario() {
  // La mesa va al OESTE y no en el centro: el eje de la puerta tiene que quedar
  // despejado, o se aparece encima de una silla al entrar (lo caza la prueba de
  // llegadas de `nave-planta-phobos.test.mjs`).
  const centroMesaX = 2.0;
  const centroMesaZ = PROFUNDIDAD / 2;
  return [
    ...mesa({ x: centroMesaX, z: centroMesaZ, color: CANTINA.mesa, colorPie: CANTINA.taburete }),
    // Cuatro sillas encaradas a la mesa: cada una girada para mirarla, que es lo
    // que hace que el conjunto se lea como una mesa ocupada y no como muebles
    // aparcados. `yaw` 0 mira a +z, así que la que está al norte de la mesa
    // (z menor) mira a +z y la de enfrente a -z.
    ...silla({ x: centroMesaX, z: centroMesaZ - 1.0, yaw: 0, color: CANTINA.mesa, colorRespaldo: CANTINA.estante }),
    ...silla({ x: centroMesaX, z: centroMesaZ + 1.0, yaw: Math.PI, color: CANTINA.mesa, colorRespaldo: CANTINA.estante }),
    ...silla({ x: centroMesaX - 1.05, z: centroMesaZ, yaw: Math.PI / 2, color: CANTINA.mesa, colorRespaldo: CANTINA.estante }),
    ...silla({ x: centroMesaX + 1.05, z: centroMesaZ, yaw: -Math.PI / 2, color: CANTINA.mesa, colorRespaldo: CANTINA.estante }),
    // El soporte mira al borde, con las cañas asomando por encima del antepecho.
    ...soporteCanas({ ...SOPORTE, yaw: 0, color: CANTINA.taburete, colorCana: CANTINA.estante }),
    // Barandilla por dentro del antepecho del muro norte: el antepecho dice
    // dónde acaba el suelo y la barandilla dice que ahí no se pasa.
    ...barandilla({ x: ANCHO / 2, z: 0.28, largo: ANCHO - 1.2, eje: "x", color: SECCION.mamparo }),
  ];
}

const SALA = crearSalaCaja({
  ancho: ANCHO,
  profundidad: PROFUNDIDAD,
  puertas: [{ rect: PUERTA_CANTINA }],
  mobiliario: mobiliario(),
  // Sin techo, y con los tres muros exteriores a la altura de un antepecho: por
  // encima de ellos se ve el espacio. El muro ESTE se queda a altura completa
  // porque es el que comparte con la cantina y el que lleva la puerta.
  alAireLibre: true,
  alturaMuros: { norte: 1.0, sur: 1.0, oeste: 1.0 },
  colorMuro: CANTINA.mamparo,
  colorColumna: CANTINA.nervio,
  // Sin piel de chapa remachada en los muebles, por lo mismo que la cantina: la
  // madera no lleva remaches. El antepecho sí la conserva, que es casco.
  pielObjetos: false,
});

export const PLANTA_TERRAZA = SALA.planta;
export const componerTerraza = SALA.componer;

/**
 * Dónde aparece quien entra desde la cantina: dentro, separado de la puerta para
 * no reactivarla de vuelta, y mirando hacia dentro de la terraza. `yaw` 0 mira a
 * +z, así que -π/2 mira a -x, que desde el muro este es el interior.
 */
export const ENTRADA = Object.freeze({
  x: ANCHO - 2.6,
  z: PROFUNDIDAD / 2,
  yaw: -Math.PI / 2,
});
