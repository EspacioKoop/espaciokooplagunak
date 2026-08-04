// Colisión aproximada de la cantina real (#427): la primera sala REAL
// conectada al motor de andar, no de pruebas.
//
// ES UNA APROXIMACIÓN, Y A PROPÓSITO. `cantina-escena.mjs` tiene más de cien
// piezas —taburetes, botellas, cajas, la tele, el goblin...— y modelar cada
// una como obstáculo de colisión sería trabajo de mucho tiempo para un
// beneficio mínimo: a nadie le importa poder atravesar una botella. Esta
// planta cubre lo que de verdad para el paso —la barra y las dos mesas— y
// unos LÍMITES CONSERVADORES, más pequeños que el hueco real de la sala, para
// no arriesgar dejar caminar a través del ventanal por un margen mal medido a
// mano. Ensanchar los límites o añadir un obstáculo más adelante es seguro:
// solo hace la sala más precisa, nunca menos — lo peligroso sería lo
// contrario, y por eso se pecó de corto.
//
// DOS SISTEMAS DE COORDENADAS, UNA SOLA TRADUCCIÓN. `cantina-escena.mjs`
// coloca sus muebles en coordenadas NATIVAS, centradas en el origen como el
// resto de la sala (`MUEBLES` tiene piezas con `centro.x` negativo). Pero
// `crearPlanta` exige `ancho`/`profundidad` positivos desde `(0, 0)`. El
// desplazamiento de abajo es la ÚNICA traducción entre los dos sistemas: se
// suma para entrar en la planta, se resta para volver a nativas al componer
// la escena (`cantina-andar.mjs`). Que viva en un solo sitio es lo que evita
// que la planta y el render se desincronicen por un signo cambiado a mano en
// dos archivos distintos.
//
// Puro: ni Foundry, ni DOM, ni reloj, ni Math.random().

import { crearPlanta } from "./nave-movimiento.mjs";

/** Cuánto sumar a una coordenada NATIVA de `cantina-escena.mjs` para caer
 *  dentro de la planta (siempre positivo). Ver la cabecera del archivo. */
export const DESPLAZAMIENTO_X = 4.8;
export const DESPLAZAMIENTO_Z = 2.0;

/** Traduce una posición de la PLANTA a coordenadas nativas de la cantina. */
export function aNativo(x, z) {
  return { x: x - DESPLAZAMIENTO_X, z: z - DESPLAZAMIENTO_Z };
}

/** Y al revés: de coordenadas nativas (las que se leen directamente en
 *  `cantina-escena.mjs`) a la planta. Útil para declarar puertas mirando la
 *  sala en su propio sistema, que es como está escrita y comentada. */
export function desdeNativo(x, z) {
  return { x: x + DESPLAZAMIENTO_X, z: z + DESPLAZAMIENTO_Z };
}

function aPlanta({ x, z, ancho, profundidad }) {
  const esquina = desdeNativo(x, z);
  return { x: esquina.x, z: esquina.z, ancho, profundidad };
}

// Cada obstáculo cita la pieza de `MUEBLES` (cantina-escena.mjs) que
// aproxima, con su centro/medidas nativos, para que corregirlo sea cotejar
// dos archivos y no adivinar de dónde salió el número.

/** `barra`: centro [0, -1.45, 4.2], medidas [6.4, 0.9, 1.2]. */
const BARRA = { x: -3.2, z: 3.6, ancho: 6.4, profundidad: 1.2 };
/** `mesaIzq`: centro [-3.4, -1.2, 5.2], medidas [1.6, 0.2, 1.6]. */
const MESA_IZQ = { x: -4.2, z: 4.4, ancho: 1.6, profundidad: 1.6 };
/** `mesaDer`: centro [3.9, -1.2, 3.9], medidas [1.6, 0.2, 1.6]. */
const MESA_DER = { x: 3.1, z: 3.1, ancho: 1.6, profundidad: 1.6 };

/**
 * La planta. Límites conservadores en coordenadas NATIVAS: x de −4.8 a 4.8
 * (dentro de las caras interiores de `paredIzq`/`paredDer`, en ±5.0, con
 * margen para el radio de quien anda) y z de −2.0 a 6.3 (dentro del hueco de
 * la entrada por un lado y ANTES del ventanal por el otro —el ventanal es
 * justo lo que no se puede arriesgar a atravesar por error de margen—).
 */
export const PLANTA_CANTINA = crearPlanta({
  ancho: 9.6,
  profundidad: 8.3,
  obstaculos: [BARRA, MESA_IZQ, MESA_DER].map(aPlanta),
});
