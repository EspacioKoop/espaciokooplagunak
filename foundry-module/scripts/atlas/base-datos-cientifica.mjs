// Base de datos científica: del árbol crudo del puente a lo que se pinta (#520).
//
// QUÉ ES Y QUÉ NO. Es la consulta que la pantalla nativa de Science deja hacer:
// fichas de naves, facciones y objetos, encadenadas por padre. No es una orden y
// no toca la autoridad de nadie — es **información asimétrica pura**, que es el
// pilar 1 del roadmap de producto sin necesidad de abrir una sola puerta.
//
// LA REGLA QUE HEREDA DEL RESTO DE LECTURAS: sin sondeo no se inventa nada. Una
// base de datos vacía y "no la he pedido todavía" son estados distintos y se
// dicen distinto; lo que no se puede hacer es enseñar una lista vacía como si
// fuera la respuesta a una consulta que nunca se hizo.
//
// Puro: ni Foundry, ni DOM, ni red. Recibe el payload y devuelve datos.

/** Una entrada utilizable: con id y nombre. El resto es opcional. */
function esEntrada(entrada) {
  return (
    entrada
    && typeof entrada === "object"
    && typeof entrada.id === "string"
    && entrada.id !== ""
    && typeof entrada.name === "string"
    && entrada.name !== ""
  );
}

/**
 * Normaliza el payload de `/v1/database` a una lista de entradas limpias.
 *
 * Devuelve `null` —y no una lista vacía— cuando no hay payload: la ventana
 * necesita distinguir "no he consultado" de "he consultado y no hay nada".
 *
 * @returns {{entradas: Array, total: number, truncada: boolean}|null}
 */
export function normalizarBaseDatos(payload) {
  if (!payload || typeof payload !== "object") return null;
  const crudas = Array.isArray(payload.entries) ? payload.entries : null;
  if (crudas === null) return null;
  const entradas = crudas.filter(esEntrada).map((entrada) => ({
    id: entrada.id,
    nombre: entrada.name,
    padre: typeof entrada.parent === "string" && entrada.parent !== "" ? entrada.parent : null,
    descripcion:
      typeof entrada.description === "string" && entrada.description !== ""
        ? entrada.description
        : null,
    valores: Array.isArray(entrada.values)
      ? entrada.values
          .filter((par) => par && typeof par.key === "string" && par.key !== "")
          .map((par) => ({ clave: par.key, valor: String(par.value ?? "") }))
      : [],
  }));
  const total = Number.isFinite(Number(payload.total)) ? Number(payload.total) : entradas.length;
  return { entradas, total, truncada: Boolean(payload.truncated) };
}

/**
 * Hijos directos de `padre` (o las raíces con `null`), en orden alfabético.
 *
 * Se navega por niveles y no con el árbol entero desplegado porque así es como
 * está pensada la consulta: se baja por categorías, no se lee de arriba abajo.
 */
export function hijosDe(base, padre = null) {
  const entradas = base?.entradas ?? [];
  return entradas
    .filter((entrada) => entrada.padre === padre)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/** La entrada con ese id, o `null`. */
export function entradaPorId(base, id) {
  return (base?.entradas ?? []).find((entrada) => entrada.id === id) ?? null;
}

/**
 * Migas de pan hasta una entrada, de la raíz a ella misma.
 *
 * Se reconstruyen siguiendo `padre` y NO partiendo el id por "/": un nombre con
 * una barra dentro rompería ese atajo y dejaría migas que no llevan a ningún
 * sitio. El tope de saltos evita colgarse si un `parent` viniera en ciclo — el
 * puente ya corta los ciclos, pero esto no depende de que lo haya hecho.
 */
export function migasDe(base, id) {
  const migas = [];
  let actual = entradaPorId(base, id);
  for (let salto = 0; salto < 32 && actual !== null; salto += 1) {
    migas.unshift(actual);
    actual = actual.padre === null ? null : entradaPorId(base, actual.padre);
  }
  return migas;
}
