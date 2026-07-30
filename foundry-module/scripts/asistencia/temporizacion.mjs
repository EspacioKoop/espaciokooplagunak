// Minijuego de temporización: el camino de asistencia que NO necesita dnd5e.
//
// Es la otra mitad de la rebanada mínima de #309. Cuando el ayudante no tiene
// ficha —o el mundo corre con otro sistema de juego—, la asistencia no
// desaparece: se resuelve con destreza, y produce EXACTAMENTE las mismas bandas
// que una tirada de habilidad. Ese es el motivo de que el mapeo banda→efecto
// viva en `bandas.mjs` y no aquí: la autoridad y el balance no pueden depender
// de qué sistema tenga instalado la mesa.
//
// Forma del reto: un cursor barre una franja de ida y vuelta y hay que soltarlo
// dentro de una zona. Cuanto más centrado, mejor banda. Es corto por diseño
// (la ayuda es sal, no peaje) y se cierra solo al agotarse el límite, para que
// nadie pueda dejar una asistencia abierta ocupando el presupuesto del puesto.
//
// Determinista y puro: la posición de la zona sale de la semilla del
// coordinador (contrato de #308: nada de `Math.random()`), y el tiempo entra
// como parámetro. Ni Foundry, ni DOM, ni `Date.now()`, ni animación: quien pinte
// esto decidirá cómo, pero el resultado ya no depende del pintado.

import { bandaDesdeDestreza } from "./bandas.mjs";
import { crearAleatorio } from "../minijuegos/aleatorio.mjs";

/**
 * Dificultades. `tolerancia` es la mitad del ancho de la zona en fracción de la
 * franja, y `periodoMs` lo que tarda el cursor en un barrido de ida y vuelta:
 * una zona más estrecha y un cursor más rápido es lo mismo que subir la CD.
 *
 * `limiteMs` mantiene el reto corto. Son valores de mesa, sustituibles.
 */
export const DIFICULTADES = Object.freeze({
  facil: Object.freeze({ tolerancia: 0.22, periodoMs: 2400, limiteMs: 12_000 }),
  normal: Object.freeze({ tolerancia: 0.14, periodoMs: 1800, limiteMs: 10_000 }),
  dificil: Object.freeze({ tolerancia: 0.08, periodoMs: 1300, limiteMs: 8_000 }),
});

/** Margen de los bordes: la zona nunca aparece pegada al extremo de la franja. */
const MARGEN_BORDE = 0.12;

/**
 * Prepara un reto. La zona se coloca con la semilla del coordinador, así que la
 * misma semilla da el mismo reto: se puede reproducir una asistencia sin haberla
 * grabado, igual que una mano de póker de #308.
 */
export function crearReto({ semilla, dificultad = "normal", inicioMs = 0 }) {
  const ajuste = DIFICULTADES[dificultad];
  if (!ajuste) throw new RangeError(`dificultad desconocida: ${dificultad}`);
  const azar = crearAleatorio(semilla);
  const libre = 1 - 2 * MARGEN_BORDE;
  const objetivo = MARGEN_BORDE + azar.siguiente() * libre;
  return Object.freeze({
    dificultad,
    objetivo,
    tolerancia: ajuste.tolerancia,
    periodoMs: ajuste.periodoMs,
    limiteMs: ajuste.limiteMs,
    inicioMs,
    // El cursor no arranca siempre en el mismo sitio: si no, se aprende el
    // reto de memoria y deja de ser destreza.
    desfase: azar.siguiente(),
  });
}

/** Posición del cursor en [0, 1]: barrido triangular (ida y vuelta, sin salto). */
export function posicionEn(reto, tMs) {
  const transcurrido = Math.max(0, Number(tMs) - reto.inicioMs);
  const fase = (transcurrido / reto.periodoMs + reto.desfase) % 1;
  return fase < 0.5 ? fase * 2 : 2 - fase * 2;
}

/** Estado observable del reto en un instante. Lo que pintaría una interfaz. */
export function estadoEn(reto, tMs) {
  const transcurrido = Math.max(0, Number(tMs) - reto.inicioMs);
  const restanteMs = Math.max(0, reto.limiteMs - transcurrido);
  return Object.freeze({
    posicion: posicionEn(reto, tMs),
    objetivo: reto.objetivo,
    tolerancia: reto.tolerancia,
    restanteMs,
    expirado: restanteMs <= 0,
  });
}

/**
 * Resuelve una pulsación. Devuelve la precisión lograda en [0, 1] y su banda.
 *
 * Fuera de la zona la precisión es 0: no se «casi acierta» un poco. Dentro,
 * decae linealmente desde el centro, que es lo que convierte el reto en
 * temporización y no en pulsar a ciegas.
 *
 * Una pulsación después del límite no puntúa. El reto se cierra solo.
 */
export function resolverPulsacion(reto, tMs) {
  const estado = estadoEn(reto, tMs);
  if (estado.expirado) {
    return Object.freeze({ precision: 0, banda: bandaDesdeDestreza({ precision: 0 }), dentro: false, expirado: true, posicion: estado.posicion });
  }
  const distancia = Math.abs(estado.posicion - reto.objetivo);
  const dentro = distancia <= reto.tolerancia;
  const precision = dentro ? 1 - distancia / reto.tolerancia : 0;
  return Object.freeze({
    precision,
    banda: bandaDesdeDestreza({ precision }),
    dentro,
    expirado: false,
    posicion: estado.posicion,
  });
}

/** Resultado de dejar que el reto expire sin pulsar: cuenta como intento fallido. */
export function resolverExpiracion() {
  return Object.freeze({
    precision: 0,
    banda: bandaDesdeDestreza({ precision: 0 }),
    dentro: false,
    expirado: true,
    posicion: null,
  });
}

/**
 * Lectura por TEXTO del estado, para que el reto no dependa solo del color ni
 * de ver la barra (contrato de accesibilidad heredado de #308). Devuelve claves
 * y números; la traducción la pone quien pinte, con su i18n.
 */
export function lecturaAccesible(reto, tMs) {
  const estado = estadoEn(reto, tMs);
  const distancia = Math.abs(estado.posicion - reto.objetivo);
  let zona = "lejos";
  if (distancia <= reto.tolerancia * 0.34) zona = "centro";
  else if (distancia <= reto.tolerancia) zona = "dentro";
  else if (distancia <= reto.tolerancia * 2) zona = "cerca";
  return Object.freeze({
    zona,
    // Redondeado a décimas de segundo: un contador al milisegundo es ruido para
    // un lector de pantalla.
    segundosRestantes: Math.round(estado.restanteMs / 100) / 10,
    expirado: estado.expirado,
  });
}
