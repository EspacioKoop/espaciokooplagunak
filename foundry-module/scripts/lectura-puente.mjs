// Lecturas de telemetría del puente: ausencia y cero NO son lo mismo (#331).
//
// Por qué existe este módulo y no cada uno la suya. La conversión correcta ya
// estaba escrita —bien— en `barras-estado.mjs` y en `ship-view.mjs`, y cada
// módulo nuevo que leía telemetría la volvía a escribir. Dos de los escritos en
// #331 la escribieron MAL, y del mismo modo las dos veces:
//
//   const n = Number(valor);            // Number(null) === 0
//   return Number.isFinite(n) ? n : null;
//
// `Number(null)` es 0, y 0 es finito, así que un dato que el puente NO PUBLICA
// se cuela como una lectura válida de cero. Las consecuencias reales, las dos
// cazadas por sus pruebas antes de llegar a una mesa: una calidad de sensores
// ausente dejaba la nave CIEGA, y una energía ausente anunciaba «ENERGÍA
// CRÍTICA» a toda la tripulación.
//
// La regla, escrita una vez y para siempre: **lo que no se sabe se devuelve como
// `null`, y quien lo reciba decide cómo lo cuenta.** Un cero real sigue siendo
// información —el sistema está a cero— y tiene que poder distinguirse de «no ha
// llegado la lectura», porque en una consola de mando esas dos cosas se dicen y
// se pintan distinto.
//
// La cadena vacía también es ausencia: el puente serializa así algún campo sin
// valor, y `Number("")` es 0 — la misma trampa por otra puerta.
//
// Puro: ni Foundry, ni DOM, ni red.

/** ¿Es esto la ausencia de un dato, y no un dato con valor? */
export function esAusente(valor) {
  return valor === null || valor === undefined || valor === "";
}

/**
 * Número leído del puente, o `null` si no había lectura.
 * NUNCA devuelve 0 por ausencia: ese es el bug que este módulo existe para
 * hacer imposible.
 */
export function leerNumero(valor) {
  if (esAusente(valor)) return null;
  // Solo números y cadenas numéricas. `Number([])` es 0 y `Number(true)` es 1:
  // sin esta puerta, un array vacío o un booleano se colarían como medidas, que
  // es la misma familia de sorpresa que `Number(null)`.
  if (typeof valor !== "number" && typeof valor !== "string") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

/**
 * Fracción `valor / max` en [0,1] sin acotar por arriba, o `null` si falta
 * cualquiera de los dos o el máximo no sirve como divisor.
 */
export function leerFraccion(valor, max) {
  const v = leerNumero(valor);
  const m = leerNumero(max);
  if (v === null || m === null || m <= 0) return null;
  return v / m;
}

/** La misma fracción como porcentaje entero acotado a [0,100]. */
export function leerPorcentaje(valor, max) {
  const f = leerFraccion(valor, max);
  return f === null ? null : Math.max(0, Math.min(100, Math.round(f * 100)));
}

/**
 * Lectura que el puente ya publica normalizada en [0,1] —salud, calor, potencia
 * y refrigerante por sistema— convertida a porcentaje entero.
 */
export function leerNormalizado(valor) {
  const n = leerNumero(valor);
  return n === null ? null : Math.round(n * 100);
}

/** Entero leído, con valor de reserva explícito para cuando no hay lectura. */
export function leerEntero(valor, porDefecto = null) {
  const n = leerNumero(valor);
  return n === null ? porDefecto : Math.round(n);
}
