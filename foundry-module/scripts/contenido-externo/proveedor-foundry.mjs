// El único trozo de #332 que sabe qué es Foundry.
//
// Lee lo que YA está en el mundo del usuario: actores, objetos y hechizos que él
// importó por su cuenta. No importa nada, no descarga nada, no declara ninguna
// dependencia. Si no hay mundo (tests, arranque temprano), devuelve listas
// vacías y el adaptador degrada solo.
//
// A propósito tonto: filtrar y clasificar es trabajo de `edicion.mjs` y
// `adaptador.mjs`, que son puros y se prueban en Node. Aquí solo se recogen
// documentos.

/** Tipos de actor de dnd5e que cuentan como «criatura» para el módulo. */
const TIPOS_CRIATURA = Object.freeze(["npc", "character", "vehicle"]);

/** Tipos de ítem de dnd5e que cuentan como «objeto» (todo menos hechizo). */
const TIPOS_OBJETO = Object.freeze(["weapon", "equipment", "consumable", "tool", "loot", "backpack"]);

function coleccion(valor) {
  if (!valor) return [];
  if (Array.isArray(valor)) return valor;
  if (typeof valor.contents !== "undefined" && Array.isArray(valor.contents)) return valor.contents;
  if (typeof valor[Symbol.iterator] === "function") return [...valor];
  return [];
}

/**
 * Crea el proveedor sobre un `game` de Foundry.
 *
 * @param {object} [juego] Por defecto, el `game` global. Se inyecta en tests.
 * @returns {{criaturas: () => object[], objetos: () => object[], hechizos: () => object[]}}
 */
export function crearProveedorFoundry(juego = globalThis.game) {
  const actores = () => coleccion(juego?.actors);
  const items = () => coleccion(juego?.items);

  return Object.freeze({
    criaturas: () => actores().filter((actor) => TIPOS_CRIATURA.includes(actor?.type)),
    objetos: () => items().filter((item) => TIPOS_OBJETO.includes(item?.type)),
    hechizos: () => items().filter((item) => item?.type === "spell"),
  });
}

/**
 * ¿Está el sistema dnd5e activo? Es la única condición para siquiera mirar.
 * Nótese que NO se comprueba si plutonium está instalado: el módulo no depende
 * de él ni debe inducir a instalarlo; solo mira el contenido que encuentra.
 */
export function sistemaCompatible(juego = globalThis.game) {
  return juego?.system?.id === "dnd5e";
}
