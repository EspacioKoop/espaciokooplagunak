/**
 * Presencia de tripulantes al andar por la nave: "quién está aquí y dónde"
 * (#498, revisión externa de Odiseo en el issue).
 *
 * El dato ya existía —`posicionesVisibles()` de `nave-movimiento-red.mjs`—
 * pero no existía como CONCEPTO con nombre propio: el único accesor era
 * `jugadoresVisibles()` de `andar-nave-app.mjs`, que devolvía la posición ya
 * fusionada con el `avatar` de cada cual. Eso es presencia y representación
 * en la misma forma, y hacía que cualquier consumidor futuro —indicadores en
 * el minimapa, listas de ocupación de una sala, interacción por proximidad,
 * o simplemente otro efecto visual que no sea el avatar de #450— tuviera que
 * aceptar una estructura con forma de "avatar 3D" para preguntar algo que no
 * tiene nada que ver con cómo se dibuja nadie.
 *
 * Este módulo es esa frontera: responde SOLO a "quién está aquí y dónde".
 * Pintar un avatar (`nave-avatares-render.mjs`) es UNA de las vistas
 * posibles de esta información, no su forma canónica. Quien quiera dibujar
 * decora el resultado por su cuenta, como hace `andar-nave-app.mjs`.
 *
 * No reimplementa el filtrado ni la interpolación: eso sigue viviendo en
 * `nave-movimiento-red.mjs`, cuyo contrato de red pasó revisión externa en
 * #453 y no se reabre aquí. Esto es la capa de LECTURA de ese estado, no
 * otro protocolo.
 *
 * Puro: ni Foundry, ni DOM, ni red, ni reloj (el instante se inyecta).
 */

import { posicionesVisibles } from "./nave-movimiento-red.mjs";

/** Los campos que SON presencia. Todo lo demás es representación y no entra
 *  en esta forma — si algún día hace falta uno nuevo (agachado, por
 *  ejemplo), se añade aquí y no colándolo desde el render hacia atrás. */
const CAMPOS = Object.freeze(["userId", "x", "y", "z", "yaw", "estancia"]);

/**
 * Quién está presente AHORA en la misma estancia que uno mismo, ya
 * interpolado y sin uno mismo.
 *
 * Devuelve exactamente `{userId, x, y, z, yaw, estancia}` por tripulante: la
 * misma información que `posicionesVisibles()` ya calculaba, pero recortada
 * a los campos de presencia a propósito. Si un día `posicionesVisibles()`
 * empezara a arrastrar algo de representación, este recorte lo dejaría
 * fuera en vez de propagarlo a todos los consumidores.
 *
 * Ausencia de muestra fresca se traduce en ausencia de la lista, no en un
 * tripulante congelado en su último sitio conocido — el mismo principio de
 * "nunca extrapola" que ya aplica la capa de red.
 *
 * @param {Map} estadosPorUsuario `Map<userId, {prev, actual}>`, tal cual lo
 *   acumula `programarMuestra` en cada `updateUser`.
 * @returns {Array<{userId:string, x:number, y:number, z:number, yaw:number, estancia:string}>}
 */
export function presentesEn(estadosPorUsuario, opciones) {
  return posicionesVisibles(estadosPorUsuario, opciones).map((jugador) => {
    const presencia = {};
    for (const campo of CAMPOS) presencia[campo] = jugador[campo];
    return presencia;
  });
}

/**
 * Cuántos tripulantes hay presentes, sin construir ni recorrer la lista de
 * posiciones desde fuera. Es la pregunta que hacen una lista de ocupación o
 * un indicador de minimapa, y no necesitan saber dónde está cada cual para
 * responderla.
 */
export function cuantosPresentes(estadosPorUsuario, opciones) {
  return presentesEn(estadosPorUsuario, opciones).length;
}
