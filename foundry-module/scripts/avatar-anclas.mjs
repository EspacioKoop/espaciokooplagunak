// Puntos de anclaje de un avatar (#897): dónde va una mano, dónde está la
// boca, dónde cae el hombro — sin asumir un rig de huesos.
//
// Nació de #439 (cigarro): antes de esto, la posición del cigarro y la de su
// humo se calculaban por separado con la misma fórmula copiada dos veces, y
// era el enano del episodio de #603 esperando a pasar: dos copias que un día
// divergen. Cada anclaje nuevo (mano para sostener una bebida, un datapad, un
// arma) sería la tercera copia y no debe serlo.
//
// El contrato deliberado (issue #897): el avatar declara SUS puntos con
// posición ya resuelta en el mundo, y quien quiera colgar algo de uno no
// necesita saber nada de proporción de cuerpo, raza ni silueta. Esto NO es un
// rig — no hay huesos, ni jerarquía, ni pose que se propague; es geometría
// derivada de las mismas cajas que ya dibuja `cantina-avatar.mjs`, expuesta
// para que un prop se enganche sin repetir esa cuenta.
//
// Puro: ni Foundry, ni DOM, ni red, ni reloj.

import { dimensionesCuerpo } from "./cantina-avatar.mjs";

/** Los anclajes que un avatar declara hoy. Ampliar esta lista es lo que
 * habilita un prop nuevo — no hace falta tocar el cuerpo del avatar. */
export const PUNTOS_ANCLA = Object.freeze(["manoDerecha", "manoIzquierda", "boca", "hombro"]);

/**
 * Los puntos de anclaje de un avatar, ya resueltos en el mundo alrededor de
 * `pies`. Mismas coordenadas relativas que ya usaba `manosDelGesto` y
 * `distintivoDeClase` en `cantina-avatar.mjs` a mano: extraerlas aquí no
 * cambia un solo píxel de lo que ya se ve, solo les da un nombre y un sitio
 * único de dónde salir.
 */
export function anclasAvatar(descripcion, { pies = [0, 0, 0] } = {}) {
  const { px, pz, yTorso, altoTorso, yCabeza, ancho } = dimensionesCuerpo(descripcion, pies);
  const reposo = yTorso - altoTorso * 0.2;

  return Object.freeze({
    manoDerecha: [px + 0.3 * ancho, reposo, pz + 0.06],
    manoIzquierda: [px - 0.3 * ancho, reposo, pz + 0.06],
    // Junto a la boca, no en ella: no hay cara que perforar (#423 ya renunció
    // a ojos y boca a propósito), esto es solo dónde queda algo que se lleva
    // a la altura de la cabeza, como la punta de un cigarro.
    boca: [px + 0.26 * ancho, yCabeza - 0.06, pz + 0.4],
    hombro: [px + 0.34 * ancho, yTorso + altoTorso * 0.35, pz - 0.16],
  });
}
