// Contrato standalone de interacción con objetos 3D (#868).
//
// objeto → opciones contextuales → resolución (motor propio) → efecto en el
// estado. Nada de este archivo sabe qué es un Actor, una habilidad o una
// tirada de d20 — eso es el adaptador opcional de #869, que traduce ESTE
// contrato hacia Foundry/dnd5e y no al revés. Sin ese adaptador, el juego
// tiene que poder resolver la interacción de principio a fin igual, y eso es
// justo lo que prueba el vertical de `terminal-deteriorado.mjs`.
//
// Sigue la misma disciplina que `nave-interaccion.mjs` (#582): un id estable
// y direccionable, y una carga opaca (`efectosPorBanda`) que interpreta quien
// recibe el resultado, no este módulo.
//
// Puro: ni Foundry, ni DOM, ni red. Se prueba desde Node.

import { BANDAS, resolverAproximacion } from "./resolucion.mjs";

/**
 * Declara una aproximación: una de las formas contextuales de intentar la
 * interacción («recablear con cuidado», «forzar el panel»...).
 *
 * @param {object} definicion
 * @param {string} definicion.id estable dentro de su objeto.
 * @param {number} definicion.dificultad en [0, 1]: probabilidad de serie de
 *   que esta aproximación baste, sin ventaja/desventaja ni modificador de
 *   ficha — esos son vocabulario de sistema de reglas y viven en el adaptador.
 * @param {string} [definicion.etiqueta] texto para presentar la opción; no lo
 *   usa la resolución, solo viaja para quien pinte la interfaz.
 */
export function declararAproximacion({ id, dificultad, etiqueta = null } = {}) {
  if (typeof id !== "string" || id === "") {
    throw new TypeError("declararAproximacion requiere un `id` no vacío");
  }
  const numero = Number(dificultad);
  if (!Number.isFinite(numero) || numero < 0 || numero > 1) {
    throw new RangeError(`declararAproximacion("${id}"): \`dificultad\` debe estar en [0, 1]`);
  }
  return Object.freeze({ id, dificultad: numero, etiqueta });
}

/**
 * Declara un objeto interactivo: sus aproximaciones y, por banda de
 * resultado, el efecto opaco que produce. `efectosPorBanda` no necesita cubrir
 * las cuatro bandas — una banda sin efecto declarado resuelve a `null`, que es
 * "sin cambio observable" y una respuesta legítima (p. ej. un fallo raso que
 * no empeora nada).
 */
export function declararObjetoInteractivo({ id, aproximaciones = [], efectosPorBanda = {} } = {}) {
  if (typeof id !== "string" || id === "") {
    throw new TypeError("declararObjetoInteractivo requiere un `id` no vacío");
  }
  if (!Array.isArray(aproximaciones) || aproximaciones.length === 0) {
    throw new RangeError(`declararObjetoInteractivo("${id}") requiere al menos una aproximación`);
  }
  const vistos = new Set();
  const lista = aproximaciones.map((definicion) => {
    const aproximacion = declararAproximacion(definicion);
    if (vistos.has(aproximacion.id)) {
      throw new RangeError(`declararObjetoInteractivo("${id}"): aproximación repetida "${aproximacion.id}"`);
    }
    vistos.add(aproximacion.id);
    return aproximacion;
  });
  for (const banda of Object.keys(efectosPorBanda)) {
    if (!Object.values(BANDAS).includes(banda)) {
      throw new RangeError(`declararObjetoInteractivo("${id}"): banda desconocida "${banda}"`);
    }
  }
  return Object.freeze({
    id,
    aproximaciones: Object.freeze(lista),
    efectosPorBanda: Object.freeze({ ...efectosPorBanda }),
  });
}

/** La aproximación de `objeto` con ese `id`, o `null`. */
export function buscarAproximacion(objeto, id) {
  return objeto.aproximaciones.find((aproximacion) => aproximacion.id === id) ?? null;
}

/**
 * Resuelve la interacción completa: objeto + aproximación elegida + tirada →
 * banda + efecto. `tirada` (0..1) la aporta quien llama — este contrato no
 * genera azar, así que la misma tirada produce siempre el mismo resultado.
 *
 * El efecto es OPACO: este módulo no sabe qué significa `{tipo: "reparado"}`
 * ni lo aplica a ningún estado. Eso es tarea de quien reciba el resultado
 * (la sala, la escena andable...), igual que `accion` en `nave-interaccion.mjs`.
 */
export function resolverInteraccion({ objeto, aproximacionId, tirada }) {
  const aproximacion = buscarAproximacion(objeto, aproximacionId);
  if (!aproximacion) {
    throw new RangeError(`resolverInteraccion("${objeto.id}"): aproximación desconocida "${aproximacionId}"`);
  }
  const { banda, margen } = resolverAproximacion({ dificultad: aproximacion.dificultad, tirada });
  const efecto = objeto.efectosPorBanda[banda] ?? null;
  return Object.freeze({ objetoId: objeto.id, aproximacionId, banda, margen, efecto });
}
