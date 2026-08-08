// Marco grabado del mapa vivo (#526).
//
// El único consumidor de `laminas-clasicas.mjs`, que llevaba escrito, probado y
// sin pintar desde #318. Su propia cabecera decía que la cartografía es
// «material de INTERFAZ, no ilustración de escena — de ahí que sea el de mayor
// rendimiento inmediato para el mapa vivo»; esto es ese rendimiento.
//
// ## Ornamento, no dato
//
// El mapa vivo tiene una regla dura: interpola solo muestras confirmadas y NUNCA
// extrapola. Adornarlo no puede abrir por la puerta de atrás la lectura falsa que
// esa regla cierra por delante, así que el marco renuncia a los dos elementos del
// registro clásico que se leerían como instrumento:
//
//   - los **tics** del limbo, que sobre un mapa táctico son una escala, y aquí
//     no corresponderían a ninguna distancia calculada;
//   - la **rosa de los vientos**, que sería una marcación. La marcación real del
//     mapa la da el rumbo en texto, y una rosa decorativa en la esquina
//     compite con ella diciendo algo que nadie ha medido.
//
// Queda el encuadre: doble filete y cartela con el título. Eso es lo que hace
// que parezca una lámina impresa, y no dice nada que se pueda confundir con una
// lectura.
//
// ## Y no toca el mapa
//
// Esto no se pinta DENTRO del lienzo: es una imagen de fondo del contenedor, con
// el interior hueco, así que ni un píxel del mapa cambia de sitio ni de color.
// Va `aria-hidden` (ya lo pone `cartografiaSvg`) porque un lector de pantalla no
// gana nada anunciando un filete.
//
// Puro: devuelve una cadena data URI. Ni Foundry, ni DOM, ni red.

import { cartografiaDataUri } from "./laminas-clasicas.mjs";

/** Divisiones del limbo. No se ven (los tics van apagados) pero fijan la semilla. */
const DIVISIONES = 8;

/**
 * Marco para un lienzo de mapa de `ancho` × `alto`.
 *
 * @param {object} [opciones]
 * @param {number} [opciones.ancho]
 * @param {number} [opciones.alto]
 * @param {string} [opciones.titulo] Normalmente el distintivo de la nave. Se
 *   escapa aguas abajo, en `cartografiaSvg`.
 * @returns {string} data URI de un SVG con el interior hueco.
 */
export function marcoMapaDataUri({ ancho = 320, alto = 320, titulo = "" } = {}) {
  return cartografiaDataUri({
    ancho,
    alto,
    divisiones: DIVISIONES,
    titulo,
    // Las dos renuncias de arriba. Explícitas y no por defecto: quien lea esta
    // llamada tiene que ver que se están apagando a propósito.
    tics: false,
    rosa: false,
  });
}

/**
 * Estilo en línea para el contenedor del mapa.
 *
 * Se devuelve como cadena de estilo en vez de tocar el DOM para que esto siga
 * siendo puro y probable desde Node: la ventana solo lo pega en un atributo.
 * `100% 100%` sin repetición porque el SVG ya viene con las medidas del lienzo,
 * y `no-repeat` para que un redondeo no lo azuleje.
 */
export function estiloMarcoMapa(opciones = {}) {
  return `background-image:url("${marcoMapaDataUri(opciones)}");background-size:100% 100%;background-repeat:no-repeat`;
}
