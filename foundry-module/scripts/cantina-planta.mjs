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
import { MUEBLES } from "./cantina-escena.mjs";

/** Cuánto sumar a una coordenada NATIVA de `cantina-escena.mjs` para caer
 *  dentro de la planta (siempre positivo). Ver la cabecera del archivo. */
export const DESPLAZAMIENTO_X = 5.0;
export const DESPLAZAMIENTO_Z = 2.35;

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

/**
 * Los obstáculos se DERIVAN de `MUEBLES`, no se transcriben (QA 2026-08-08).
 *
 * Antes eran tres rects escritos a mano —barra y dos mesas— mientras la sala
 * tenía decenas de piezas: estanterías, botellas, taburetes. Todo lo demás se
 * atravesaba, y peor aún, la planta se recortaba en z para «no arriesgarse» con
 * el fondo de la sala, dejando un tercio amueblado y visible al que no se podía
 * entrar. Eso es lo que el QA describió como «un vacío absurdo frente a la
 * pared»: no era un vacío, era la parte de la cantina que la colisión no dejaba
 * pisar.
 *
 * Ahora la regla es una y se aplica sola: una pieza estorba si ocupa el tramo
 * por el que pasa un CUERPO. Se necesitan las dos condiciones, y por separado
 * ninguna sirve:
 *
 *  - que llegue lo bastante alto para tropezar (si no, es una tarima o un
 *    rodapié y se pisa);
 *  - que empiece lo bastante bajo (si no, es una estantería alta, un neón o un
 *    dintel, y se pasa por DEBAJO). Sin esta segunda condición, las botellas de
 *    los estantes altos bloqueaban el paso desde el techo, y la sala andable
 *    caía al 45 %.
 *
 * Los muros y dinteles se excluyen aparte porque el límite de la sala ya lo pone
 * la propia planta, y una pieza contada dos veces solo la estrecha sin motivo.
 */
const SUELO = -2.0;
/** Por debajo de esto, se pisa y no estorba. */
const UMBRAL_TROPIEZO = 0.35;
/** Por encima de esto, se pasa por debajo. Altura de pecho, no de ojos: se
 *  agacha la cabeza, no el tronco. */
const UMBRAL_AGACHARSE = 1.15;

function esFrontera(nombre) {
  return /^(pared|dintel|muro|suelo|techo)/i.test(nombre ?? "");
}

function obstaculosDesdeMuebles(muebles) {
  const rects = [];
  for (const pieza of muebles ?? []) {
    if (esFrontera(pieza.nombre)) continue;
    if (pieza.colision === false) continue;
    const [cx, cy, cz] = pieza.centro;
    const [w, h, d] = pieza.medidas;
    if (cy + h / 2 < SUELO + UMBRAL_TROPIEZO) continue;
    if (cy - h / 2 > SUELO + UMBRAL_AGACHARSE) continue;
    rects.push(aPlanta({ x: cx - w / 2, z: cz - d / 2, ancho: w, profundidad: d }));
  }
  return rects;
}

export const PLANTA_CANTINA = crearPlanta({
  // Las caras interiores REALES de los muros de `cantina-escena.mjs`:
  // x de −5.0 a 5.0, z de −2.35 (cara interior de `paredEntrada`) a 9.5 (final
  // de `paredIzq5`/`paredDer5`). El margen para el radio de quien anda lo pone
  // ya el motor; recortarlo otra vez aquí es lo que dejó fuera un tercio de la
  // sala. Lo vigila `cantina-planta.test.mjs`, que compara estos números con la
  // geometría pintada en vez de confiar en que nadie los toque.
  ancho: 10.0,
  profundidad: 11.85,
  obstaculos: obstaculosDesdeMuebles(MUEBLES),
});
