// Minijuego de secuencia: el segundo camino de asistencia que NO necesita
// dnd5e (issue #500, ampliación de #309).
//
// Mismo contrato que `temporizacion.mjs`: motor puro, determinista por
// semilla, el tiempo entra como parámetro, y el resultado se traduce a las
// MISMAS bandas (`bandas.mjs`) para que el balance no dependa de qué reto le
// tocó a cada asistencia ni de si la mesa tiene dnd5e instalado.
//
// Forma del reto: la mesa muestra una secuencia corta de símbolos, uno a uno,
// y el jugador tiene que repetirla en orden dentro de una ventana de tiempo.
// Es la contrapartida de memoria/orden a la temporización, que es destreza de
// precisión — dos maneras distintas de jugar la misma ayuda.
//
// Determinista y puro: la secuencia sale de la semilla del coordinador
// (contrato de #308: nada de `Math.random()`); quien pinte esto decide cómo
// animar la muestra y cómo capturar la pulsación, el resultado no depende de
// ninguna de las dos.

import { bandaDesdeDestreza } from "./bandas.mjs";
import { crearAleatorio } from "../minijuegos/aleatorio.mjs";

/**
 * Dificultades. `longitud` es el número de símbolos a repetir, `simbolos` el
 * tamaño del alfabeto (subir esto también sube la dificultad: hay más
 * opciones donde equivocarse), `duracionSimboloMs` cuánto se muestra cada
 * símbolo de la secuencia, y `limiteEntradaMs` la ventana para repetirla
 * entera una vez termina de mostrarse. Son valores de mesa, sustituibles.
 */
export const DIFICULTADES = Object.freeze({
  facil: Object.freeze({ longitud: 3, simbolos: 4, duracionSimboloMs: 700, limiteEntradaMs: 8000 }),
  normal: Object.freeze({ longitud: 4, simbolos: 4, duracionSimboloMs: 550, limiteEntradaMs: 6500 }),
  dificil: Object.freeze({ longitud: 5, simbolos: 5, duracionSimboloMs: 450, limiteEntradaMs: 5000 }),
});

/**
 * Prepara un reto. La secuencia sale de la semilla del coordinador, así que
 * la misma semilla da la misma secuencia: se puede reproducir una asistencia
 * sin haberla grabado, igual que un reto de temporización o una mano de
 * póker de #308.
 */
export function crearReto({ semilla, dificultad = "normal", inicioMs = 0 }) {
  const ajuste = DIFICULTADES[dificultad];
  if (!ajuste) throw new RangeError(`dificultad desconocida: ${dificultad}`);
  const azar = crearAleatorio(semilla);
  const secuencia = Object.freeze(
    Array.from({ length: ajuste.longitud }, () => azar.enteroEntre(0, ajuste.simbolos - 1)),
  );
  const finMuestraMs = inicioMs + ajuste.longitud * ajuste.duracionSimboloMs;
  return Object.freeze({
    dificultad,
    secuencia,
    simbolos: ajuste.simbolos,
    duracionSimboloMs: ajuste.duracionSimboloMs,
    limiteEntradaMs: ajuste.limiteEntradaMs,
    inicioMs,
    finMuestraMs,
    finEntradaMs: finMuestraMs + ajuste.limiteEntradaMs,
  });
}

/**
 * Estado observable del reto en un instante. Lo que pintaría una interfaz:
 * en fase «muestra» qué símbolo está activo, en fase «entrada» cuánto tiempo
 * queda para repetir la secuencia entera.
 */
export function estadoEn(reto, tMs) {
  const t = Number(tMs);
  if (t < reto.finMuestraMs) {
    const indice = Math.min(
      reto.secuencia.length - 1,
      Math.max(0, Math.floor((t - reto.inicioMs) / reto.duracionSimboloMs)),
    );
    return Object.freeze({
      fase: "muestra",
      simboloActivo: reto.secuencia[indice],
      indice,
      restanteMs: reto.finEntradaMs - t,
      expirado: false,
    });
  }
  const restanteMs = Math.max(0, reto.finEntradaMs - t);
  return Object.freeze({
    fase: restanteMs > 0 ? "entrada" : "cerrado",
    simboloActivo: null,
    indice: null,
    restanteMs,
    expirado: restanteMs <= 0,
  });
}

/**
 * Resuelve los intentos acumulados hasta `tMs`. `intentos` es el arreglo de
 * símbolos pulsados en orden (crece con cada pulsación del jugador); esta
 * función es pura respecto a él, no lo muta ni lo recuerda.
 *
 * Un fallo en cualquier posición corta la cadena ahí: no hay «casi acierto»
 * más allá del símbolo equivocado, igual que la zona de temporización no
 * puntúa fuera de su tolerancia. Completar la secuencia entera da precisión
 * alta con un bono por rapidez; fallar o agotar el tiempo da crédito parcial
 * por lo avanzado ANTES de romper la cadena, a mitad de valor — un fallo a
 * mitad de secuencia no es lo mismo que fallar el primer símbolo, pero
 * tampoco vale lo que completarla.
 */
export function resolverIntentos(reto, intentos, tMs) {
  const estado = estadoEn(reto, tMs);
  const longitud = reto.secuencia.length;
  let aciertos = 0;
  let fallado = false;
  for (let i = 0; i < intentos.length && !fallado; i += 1) {
    if (intentos[i] === reto.secuencia[i]) aciertos += 1;
    else fallado = true;
  }
  const completado = !fallado && aciertos === longitud;
  const agotado = estado.expirado && !completado;
  const cerrado = completado || fallado || agotado;

  let precision = 0;
  if (completado) {
    const usadoMs = Math.max(0, Number(tMs) - reto.finMuestraMs);
    const bono = 1 - Math.min(1, usadoMs / reto.limiteEntradaMs) * 0.4;
    precision = Math.max(0.6, bono);
  } else if (fallado || agotado) {
    precision = (aciertos / longitud) * 0.5;
  }

  return Object.freeze({
    aciertos,
    longitud,
    fallado,
    completado,
    cerrado,
    expirado: agotado,
    precision,
    banda: cerrado ? bandaDesdeDestreza({ precision }) : null,
  });
}

/** Resultado de dejar que el reto expire sin completar la entrada. */
export function resolverExpiracion(reto) {
  return resolverIntentos(reto, [], reto.finEntradaMs);
}

/**
 * Lectura por TEXTO del estado, para que el reto no dependa solo de ver los
 * símbolos parpadear (contrato de accesibilidad heredado de #308). Devuelve
 * claves y números; la traducción la pone quien pinte, con su i18n.
 */
export function lecturaAccesible(reto, tMs) {
  const estado = estadoEn(reto, tMs);
  if (estado.fase === "muestra") {
    return Object.freeze({
      fase: "muestra",
      posicion: estado.indice + 1,
      deSecuencia: reto.secuencia.length,
      expirado: false,
    });
  }
  return Object.freeze({
    fase: estado.fase,
    segundosRestantes: Math.round(estado.restanteMs / 100) / 10,
    expirado: estado.expirado,
  });
}
