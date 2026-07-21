// Preservación de foco entre reconstrucciones del DOM (issue #227: "las dos
// rutas de aplicación conservan listeners, foco y estado accesible tras
// re-render/cierre/reapertura"). ApplicationV2 y Application v1 reconstruyen
// el árbol entero al reprocesar la plantilla — sin esto, cualquier render()
// disparado mientras el usuario tiene foco en un control (un <select>, un
// <input>, un botón) lo devuelve a document.body, un salto de foco confuso
// con lector de pantalla o solo teclado.

const ATRIBUTOS_IDENTIDAD = ["data-field", "data-action", "data-workspace-action", "id", "name"];

/**
 * Describe el elemento con foco mediante el primer atributo identificador
 * presente (en orden de prioridad), para poder reencontrar el control
 * equivalente tras reconstruir el DOM. `null` si no hay elemento o no tiene
 * ninguno de esos atributos (p. ej. el propio contenedor de la ventana).
 */
export function describirFoco(elemento) {
  if (!elemento?.getAttribute) return null;
  for (const atributo of ATRIBUTOS_IDENTIDAD) {
    const valor = elemento.getAttribute(atributo);
    if (valor) return { atributo, valor };
  }
  return null;
}

/** Reencuentra y enfoca el control descrito por `describirFoco` en la nueva raíz. */
export function restaurarFoco(raiz, descriptor) {
  if (!descriptor || !raiz?.querySelector) return;
  const elemento = raiz.querySelector(`[${descriptor.atributo}="${descriptor.valor}"]`);
  elemento?.focus?.();
}
