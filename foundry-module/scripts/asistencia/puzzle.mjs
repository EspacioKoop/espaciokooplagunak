// Minijuego de puzzle: el cuarto camino de asistencia que NO necesita dnd5e
// (issue #500, ampliación de #309), junto a `temporizacion.mjs` (reflejos),
// `secuencia.mjs` (memoria de orden) y `precision.mjs` (puntería sin reloj).
//
// El eje que faltaba: deducción, no reflejos ni memoria ni puntería. Un
// panel de casillas empieza todo apagado; hay que encenderlas para que
// coincida con un patrón objetivo, y solo el patrón entero cuenta —una
// casilla de más o de menos no es «casi acierto», es un panel distinto—.
// Sin reloj que perseguir mientras se decide: el límite de tiempo, como en
// los otros tres, solo evita que una asistencia se quede abierta para
// siempre ocupando el presupuesto del puesto.
//
// Determinista y puro: el patrón objetivo sale de la semilla del
// coordinador (contrato de #308: nada de `Math.random()`), reutilizando la
// misma `mezclar()` que ya usa el póker para barajar sin sesgo. El estado
// del panel (qué casillas están encendidas AHORA) lo lleva quien pinte esto;
// aquí solo entra como parámetro al enviar.

import { bandaDesdeDestreza } from "./bandas.mjs";
import { crearAleatorio, mezclar } from "../minijuegos/aleatorio.mjs";

/**
 * Dificultades. `celdas` es el tamaño del panel y `encendidos` cuántas de
 * esas celdas forman el patrón objetivo — fijo, no «aproximadamente la
 * mitad», para que la dificultad no dependa de la semilla. Subir `celdas`
 * manteniendo `encendidos` bajo hace el patrón más disperso y más fácil de
 * confundir con ruido; son valores de mesa, sustituibles.
 */
export const DIFICULTADES = Object.freeze({
  facil: Object.freeze({ celdas: 4, encendidos: 2, limiteMs: 15_000 }),
  normal: Object.freeze({ celdas: 6, encendidos: 3, limiteMs: 12_000 }),
  dificil: Object.freeze({ celdas: 8, encendidos: 4, limiteMs: 10_000 }),
});

/**
 * Prepara un reto. El patrón sale de la semilla del coordinador, así que la
 * misma semilla da el mismo patrón: se puede reproducir una asistencia sin
 * haberla grabado, igual que en los otros tres minijuegos de destreza.
 */
export function crearReto({ semilla, dificultad = "normal", inicioMs = 0 }) {
  const ajuste = DIFICULTADES[dificultad];
  if (!ajuste) throw new RangeError(`dificultad desconocida: ${dificultad}`);
  const azar = crearAleatorio(semilla);
  const indices = mezclar(
    Array.from({ length: ajuste.celdas }, (_, i) => i),
    azar,
  ).slice(0, ajuste.encendidos);
  const encendidos = new Set(indices);
  const patronObjetivo = Object.freeze(
    Array.from({ length: ajuste.celdas }, (_, i) => encendidos.has(i)),
  );
  return Object.freeze({
    dificultad,
    patronObjetivo,
    celdas: ajuste.celdas,
    encendidosObjetivo: ajuste.encendidos,
    limiteMs: ajuste.limiteMs,
    inicioMs,
    finMs: inicioMs + ajuste.limiteMs,
  });
}

/** Estado observable del reto en un instante: solo cuenta atrás, como precisión. */
export function estadoEn(reto, tMs) {
  const restanteMs = Math.max(0, reto.finMs - Number(tMs));
  return Object.freeze({ restanteMs, expirado: restanteMs <= 0 });
}

/**
 * Resuelve un envío. `patronActual` es el estado del panel en el momento de
 * enviar —un array de valores truthy/falsy, del mismo largo que
 * `reto.celdas`—; posiciones ausentes cuentan como apagadas.
 *
 * Solo el acierto exacto (todas las celdas del objetivo encendidas, ninguna
 * de más) da banda favorable, con un bono por rapidez igual que en
 * secuencia. Cualquier otra combinación da crédito parcial a mitad de
 * valor, medido sobre las celdas encendidas del objetivo que sí se
 * acertaron menos las que sobran: encender casillas al azar no puntúa por
 * las que aciertan de pura chance, porque lo que resta son las que sobran.
 */
export function resolverEnvio(reto, patronActual, tMs) {
  const estado = estadoEn(reto, tMs);
  const actual = patronActual ?? [];
  let aciertos = 0;
  let sobrantes = 0;
  for (let i = 0; i < reto.celdas; i += 1) {
    const encendidaAhora = Boolean(actual[i]);
    const encendidaObjetivo = reto.patronObjetivo[i];
    if (encendidaObjetivo && encendidaAhora) aciertos += 1;
    else if (!encendidaObjetivo && encendidaAhora) sobrantes += 1;
  }
  const exacto = aciertos === reto.encendidosObjetivo && sobrantes === 0;
  const agotado = estado.expirado && !exacto;
  const cerrado = exacto || agotado;

  let precision = 0;
  if (exacto) {
    const usadoMs = Math.max(0, Number(tMs) - reto.inicioMs);
    const bono = 1 - Math.min(1, usadoMs / reto.limiteMs) * 0.4;
    precision = Math.max(0.6, bono);
  } else if (agotado) {
    const base = Math.max(0, (aciertos - sobrantes) / Math.max(1, reto.encendidosObjetivo));
    precision = base * 0.5;
  }

  return Object.freeze({
    aciertos,
    sobrantes,
    encendidosObjetivo: reto.encendidosObjetivo,
    exacto,
    cerrado,
    expirado: agotado,
    precision,
    banda: cerrado ? bandaDesdeDestreza({ precision }) : null,
  });
}

/** Resultado de dejar que el reto expire sin enviar: panel vacío, cuenta como intento fallido. */
export function resolverExpiracion(reto) {
  return resolverEnvio(reto, [], reto.finMs);
}

/**
 * Lectura por TEXTO del patrón objetivo, para que el reto no dependa solo de
 * VER qué casillas están encendidas (contrato de accesibilidad heredado de
 * #308). Describe exactamente lo mismo que ve quien mira el panel —las
 * posiciones a encender, en base 1— y no menos: ocultar el objetivo a quien
 * no ve haría un puzzle distinto, no el mismo puzzle accesible.
 */
export function lecturaAccesible(reto, tMs) {
  const estado = estadoEn(reto, tMs);
  const posiciones = reto.patronObjetivo.reduce((acc, encendida, i) => {
    if (encendida) acc.push(i + 1);
    return acc;
  }, []);
  return Object.freeze({
    posiciones: Object.freeze(posiciones),
    total: reto.celdas,
    segundosRestantes: Math.round(estado.restanteMs / 100) / 10,
    expirado: estado.expirado,
  });
}
