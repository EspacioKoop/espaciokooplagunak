// Intención de arrastre de una carta (#458), segunda pieza del vertical
// mínimo: un arrastre en el lienzo NUNCA muta el estado del motor
// directamente. Se traduce primero a una intención con esta forma cerrada, y
// solo el motor (`poker-motor.aplicar`) decide si se acepta o se rechaza.
//
// Este módulo no conoce Foundry ni el DOM: toma el payload en bruto que
// mandaría un `drop` de lienzo y lo normaliza o lo rechaza. Es deliberadamente
// la única puerta: el relé de la mesa (#237, mismo patrón que
// `station-order-relay.mjs`) debe llamar a `intentoDesdeArrastre` antes de
// pasarle nada a `aplicar`, para que un payload con forma inesperada nunca
// llegue al motor como si fuera una acción válida.

// Catálogo cerrado de qué intenciones puede generar un arrastre de carta. Solo
// "mostrar" existe hoy: arrastrar una carta de la propia mano a la mesa para
// enseñarla. Ampliar esta lista es la única forma de que un drag habilite una
// acción nueva del motor — nunca un `tipo` suelto que llegue del lienzo.
const TIPOS_DE_ARRASTRE = Object.freeze(["mostrar"]);

/**
 * Normaliza un payload de arrastre en bruto a una intención `{ tipo,
 * parametros }` lista para `poker-motor.aplicar`, o `null` si el payload no
 * tiene forma de arrastre de carta válido. No comprueba autoridad (eso lo
 * hace el motor con el estado real): solo comprueba FORMA.
 *
 * @param {object} payload - `{ tipo, indice }` tal como lo manda el lienzo.
 */
export function intentoDesdeArrastre(payload) {
  if (!payload || typeof payload !== "object") return null;
  const { tipo, indice } = payload;
  if (!TIPOS_DE_ARRASTRE.includes(tipo)) return null;
  if (!Number.isInteger(indice) || indice < 0) return null;
  return { tipo, parametros: { indice } };
}
