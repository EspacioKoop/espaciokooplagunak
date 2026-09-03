// El "adjuntador" genérico de props del sistema de anclajes (#897): dado un
// punto de anclaje ya resuelto (ver `avatar-anclas.mjs`) y qué prop se quiere
// colgar ahí, devuelve piezas listas para fundirse con las del cuerpo.
//
// Deliberadamente NO sabe nada de avatares, huesos ni proporción de cuerpo:
// solo recibe un punto en el mundo. Eso es lo que lo hace reutilizable entre
// la cantina sentada y quien anda por la nave sin que ninguno de los dos
// tenga que enseñarle cómo es un cuerpo — mismo reparto que ya separa
// `nave-avatares-render.mjs` (cómo se dibuja) de `cantina-avatar.mjs` (qué
// hay que dibujar).
//
// No trae una máquina de animación de pose ni un rig: un prop es una postura
// fija sobre un punto fijo, igual que los gestos de `cantina-avatar.mjs` son
// posturas y no animaciones (ver GESTOS ahí). Eso queda para una evolución
// futura si hace falta.
//
// Puro: ni Foundry, ni DOM, ni red, ni reloj.
//
// Frontera de arte (#351): no declara ni un color propio, todos salen de
// `paleta.mjs`.

import { AVATAR } from "./paleta.mjs";
import { mezclar } from "./retro3d.mjs";
import { intensidadCalada } from "./cantina-avatar.mjs";

/** El catálogo cerrado de props que este sistema sabe colgar. Un prop nuevo
 * es una entrada más aquí, nunca una rama nueva en quien lo consume. */
export const PROPS = Object.freeze(["cigarro", "jarra", "distintivo"]);

const DEFINICIONES = Object.freeze({
  // Cuelga de `boca` (#439): el cigarro en sí queda un poco retirado del
  // anclaje y la brasa justo en la punta, que es el propio anclaje — misma
  // separación que tenía el cálculo a mano que esto sustituye.
  cigarro(punto, { prefijo, tiempo = 0, indice = 0 }) {
    const [x, y, z] = punto;
    const calada = intensidadCalada(tiempo, indice);
    return [
      { nombre: `${prefijo}Cigarro`, color: AVATAR.cigarro, centro: [x, y, z - 0.1], medidas: [0.05, 0.05, 0.18] },
      {
        nombre: `${prefijo}Brasa`,
        color: mezclar(AVATAR.brasa, AVATAR.brasaCalada, calada),
        centro: [x, y, z],
        medidas: [0.06, 0.06, 0.06],
      },
    ];
  },
  // Cuelga de `manoDerecha`, en alto: una sola caja, sin animación propia.
  jarra(punto, { prefijo }) {
    const [x, y, z] = punto;
    return [{ nombre: `${prefijo}Jarra`, color: AVATAR.jarra, centro: [x, y, z], medidas: [0.18, 0.24, 0.18] }];
  },
  // Cuelga de `hombro`: una única pieza, no un equipo completo — lo que se
  // busca es reconocer a alguien al otro lado de la sala, no inventariar su
  // mochila. `color` y `medidas` los decide quien llama (#423: cada clase
  // lleva algo distinto), este prop solo sabe dónde ponerlo.
  distintivo(punto, { prefijo, color, medidas }) {
    const [x, y, z] = punto;
    return [{ nombre: `${prefijo}Distintivo`, color, centro: [x, y, z], medidas }];
  },
});

/**
 * Las piezas de un prop colgado de un punto de anclaje ya resuelto.
 *
 * @param {string} nombreProp uno de `PROPS`; cualquier otro valor no dibuja
 *   nada, no revienta — un estado lógico con un prop mal escrito no debe
 *   tirar la sala entera.
 * @param {[number, number, number]} punto el anclaje, en el mismo espacio de
 *   mundo que las piezas del cuerpo (ver `avatar-anclas.mjs`).
 * @param {{prefijo?: string, tiempo?: number, indice?: number, color?: string,
 *   medidas?: [number, number, number]}} opciones
 *   `prefijo` nombra las piezas igual que hace `piezasAvatar` (`avatar0…`);
 *   `tiempo`/`indice` solo los usa `cigarro`, para la calada (#439);
 *   `color`/`medidas` solo los usa `distintivo`, que no trae los suyos
 *   propios porque cambian por clase (#423).
 * @returns {Array<object>} mismo contrato `{nombre, color, centro, medidas}`
 *   que el resto de piezas de la escena.
 */
export function piezasProp(nombreProp, punto, opciones = {}) {
  const definicion = DEFINICIONES[nombreProp];
  if (!definicion || !Array.isArray(punto) || punto.length !== 3) return [];
  const { prefijo = "prop", tiempo = 0, indice = 0 } = opciones;
  return definicion(punto, { ...opciones, prefijo, tiempo, indice }).map((pieza) => Object.freeze(pieza));
}
