// Preservación de foco entre reconstrucciones del DOM (issue #227: "las dos
// rutas de aplicación conservan listeners, foco y estado accesible tras
// re-render/cierre/reapertura"). ApplicationV2 y Application v1 reconstruyen
// el árbol entero al reprocesar la plantilla — sin esto, cualquier render()
// disparado mientras el usuario tiene foco en un control (un <select>, un
// <input>, un botón) lo devuelve a document.body, un salto de foco confuso
// con lector de pantalla o solo teclado.

const ATRIBUTOS_IDENTIDAD = ["data-field", "data-action", "data-workspace-action", "id", "name"];

/**
 * Índice de `elemento` entre todos los que comparten el mismo par
 * atributo/valor dentro de `raiz` (p. ej. dos botones con
 * `data-action="ordenarEscudos"`, distinguidos solo por `data-value`). Sin
 * `raiz` —o si no aparece en la lista— asume 0: el caso habitual de un
 * atributo verdaderamente único.
 */
function indiceEntreCoincidencias(raiz, atributo, valor, elemento) {
  if (!raiz?.querySelectorAll) return 0;
  const coincidencias = Array.from(raiz.querySelectorAll(`[${atributo}="${valor}"]`));
  return Math.max(coincidencias.indexOf(elemento), 0);
}

/**
 * Describe el elemento con foco mediante el primer atributo identificador
 * presente (en orden de prioridad), para poder reencontrar el control
 * equivalente tras reconstruir el DOM. `null` si no hay elemento o no tiene
 * ninguno de esos atributos (p. ej. el propio contenedor de la ventana).
 *
 * `raiz` (opcional, el contenedor ANTES de reconstruir el DOM) desambigua
 * atributos repetidos en varios controles (issue #227 review): sin ella,
 * `restaurarFoco` siempre devolvería el foco al primero de la lista.
 */
export function describirFoco(elemento, raiz = null) {
  if (!elemento?.getAttribute) return null;
  for (const atributo of ATRIBUTOS_IDENTIDAD) {
    const valor = elemento.getAttribute(atributo);
    if (valor) {
      return { atributo, valor, indice: indiceEntreCoincidencias(raiz, atributo, valor, elemento) };
    }
  }
  return null;
}

/** Reencuentra y enfoca el control descrito por `describirFoco` en la nueva raíz. */
export function restaurarFoco(raiz, descriptor) {
  if (!descriptor || !raiz?.querySelectorAll) return;
  const coincidencias = raiz.querySelectorAll(`[${descriptor.atributo}="${descriptor.valor}"]`);
  const elemento = coincidencias[descriptor.indice ?? 0] ?? coincidencias[0];
  elemento?.focus?.();
}
