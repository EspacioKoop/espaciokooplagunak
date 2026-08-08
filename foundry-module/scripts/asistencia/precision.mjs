// Minijuego de precisión: el tercer camino de asistencia que NO necesita
// dnd5e (issue #500, ampliación de #309), junto a `temporizacion.mjs`
// (reflejos: cuándo pulsar) y `secuencia.mjs` (memoria: en qué orden).
//
// Este es el eje que faltaba: puntería sin reloj. La zona objetivo se ve
// entera y quieta desde el principio —no hay cursor que perseguir, no hay
// nada que memorizar—; el reto es acertar en una franja estrecha con UN
// único intento. El límite de tiempo no mide reflejos: solo evita que una
// asistencia se quede abierta para siempre ocupando el presupuesto del
// puesto, igual que en los otros dos minijuegos.
//
// Determinista y puro: la zona sale de la semilla del coordinador (contrato
// de #308: nada de `Math.random()`); la posición pulsada entra como
// parámetro, no se lee de ningún DOM aquí. Quien pinte esto decide cómo
// convertir un clic en una coordenada de [0, 1]; el resultado no depende de
// esa conversión.

import { bandaDesdeDestreza } from "./bandas.mjs";
import { crearAleatorio } from "../minijuegos/aleatorio.mjs";

/**
 * Dificultades. `tolerancia` es la mitad del ancho de la zona en fracción de
 * la franja: más estrecha es más difícil, igual que en temporización, pero
 * aquí es la ÚNICA variable de dificultad —no hay velocidad que subir
 * porque no hay nada que se mueva—. `limiteMs` es solo el tiempo para
 * decidir y pulsar, no una ventana de reflejos.
 */
export const DIFICULTADES = Object.freeze({
  facil: Object.freeze({ tolerancia: 0.12, limiteMs: 8_000 }),
  normal: Object.freeze({ tolerancia: 0.07, limiteMs: 6_000 }),
  dificil: Object.freeze({ tolerancia: 0.04, limiteMs: 5_000 }),
});

/** Margen de los bordes: la zona nunca aparece pegada al extremo de la franja. */
const MARGEN_BORDE = 0.12;

/**
 * Rango donde puede caer el CENTRO de la zona. Mismo razonamiento que
 * `temporizacion.mjs`: el margen se aplica al borde de la zona y no a su
 * centro, para que `[objetivo - tolerancia, objetivo + tolerancia]` quepa
 * siempre en `[0, 1]` y el ancho alcanzable no dependa de la semilla.
 */
function rangoObjetivo(tolerancia) {
  const minimo = MARGEN_BORDE + tolerancia;
  const maximo = 1 - MARGEN_BORDE - tolerancia;
  return { minimo, maximo };
}

/**
 * Prepara un reto. La zona sale de la semilla del coordinador, así que la
 * misma semilla da la misma zona: se puede reproducir una asistencia sin
 * haberla grabado, igual que en los otros dos minijuegos de destreza.
 */
export function crearReto({ semilla, dificultad = "normal", inicioMs = 0 }) {
  const ajuste = DIFICULTADES[dificultad];
  if (!ajuste) throw new RangeError(`dificultad desconocida: ${dificultad}`);
  const azar = crearAleatorio(semilla);
  const { minimo, maximo } = rangoObjetivo(ajuste.tolerancia);
  const objetivo = minimo + azar.siguiente() * (maximo - minimo);
  return Object.freeze({
    dificultad,
    objetivo,
    tolerancia: ajuste.tolerancia,
    limiteMs: ajuste.limiteMs,
    inicioMs,
    finMs: inicioMs + ajuste.limiteMs,
  });
}

/** Estado observable del reto en un instante: solo cuenta atrás, sin cursor. */
export function estadoEn(reto, tMs) {
  const restanteMs = Math.max(0, reto.finMs - Number(tMs));
  return Object.freeze({ restanteMs, expirado: restanteMs <= 0 });
}

/**
 * Resuelve un clic en `posicion` (en [0, 1], ya traducida desde donde sea que
 * se haya pulsado). Devuelve la precisión lograda y su banda.
 *
 * Fuera de la zona la precisión es 0: no se «casi acierta» un poco, igual
 * que en temporización. Un clic después del límite no puntúa.
 */
export function resolverClic(reto, posicion, tMs) {
  const estado = estadoEn(reto, tMs);
  if (estado.expirado) {
    return Object.freeze({ precision: 0, banda: bandaDesdeDestreza({ precision: 0 }), dentro: false, expirado: true });
  }
  const p = Math.min(1, Math.max(0, Number(posicion)));
  const distancia = Math.abs(p - reto.objetivo);
  const dentro = distancia <= reto.tolerancia;
  const precision = dentro ? 1 - distancia / reto.tolerancia : 0;
  return Object.freeze({
    precision,
    banda: bandaDesdeDestreza({ precision }),
    dentro,
    expirado: false,
  });
}

/** Resultado de dejar que el reto expire sin pulsar: cuenta como intento fallido. */
export function resolverExpiracion() {
  return Object.freeze({ precision: 0, banda: bandaDesdeDestreza({ precision: 0 }), dentro: false, expirado: true });
}

/**
 * Lectura por TEXTO del estado, para que el reto no dependa solo de VER la
 * zona (contrato de accesibilidad heredado de #308). A diferencia de
 * temporización, aquí no hay nada que describir sobre una posición propia
 * —no hay cursor hasta que se pulsa—: solo el tiempo restante para decidir.
 */
export function lecturaAccesible(reto, tMs) {
  const estado = estadoEn(reto, tMs);
  return Object.freeze({
    segundosRestantes: Math.round(estado.restanteMs / 100) / 10,
    expirado: estado.expirado,
  });
}
