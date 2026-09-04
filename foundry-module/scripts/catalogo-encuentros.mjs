// Catálogo de encuentros conversacionales del parlamento (#810).
//
// Es CONTENIDO, no lógica: la misma forma que `asistencia/catalogo.mjs`. Cada
// encuentro es un contexto narrativo que siembra un interlocutor y ofrece unos
// enfoques ya declarados en `parlamento.mjs` (Persuasión, Engaño, Perspicacia,
// Intimidación, con su CD). Añadir un encuentro nuevo NO toca el motor de
// `parlamento.mjs`; si algún día un encuentro necesitara una mecánica propia,
// esa mecánica es otro issue.
//
// La semilla del interlocutor se deriva del `id` del encuentro (identidad
// estable), no del `User` ni de nada variable entre clientes (#810 / Odiseo):
// el mismo encuentro da el mismo NPC en todas las mesas, sin transmitir la ficha
// (#676).
//
// Puro: ni Foundry, ni DOM, ni red.

import { interlocutorDelContacto, semillaDeContacto } from "./parlamento.mjs";

/**
 * Encuentros base del parlamento. Congelados y validados al final del archivo:
 * la semilla tiene que derivar de un contacto estable, así que un encuentro sin
 * id (o con uno vacío) revienta al importar, no cuando alguien abra canal.
 *
 * `desafio` fija la dificultad del interlocutor; `tono` es solo ambiente para la
 * ventana (no mecánica). Los `enfoques` son los del parlamento; un encuentro
 * podría ofrecer un subconjunto, pero el repertorio base los trae todos.
 */
const BASE = Object.freeze([
  {
    id: "saludo-de-faccion",
    desafio: 1,
    tono: "Una voz tranquila responde al canal abierto. Quien sea, conoce el protocolo.",
  },
  {
    id: "ultimatum-comercial",
    desafio: 3,
    tono: "Exigen cuentas por una carga que juran haber entregado. El tono no admite dudas.",
  },
  {
    id: "solicitud-de-asilo",
    desafio: 5,
    tono: "Piden amparo y dan poco a cambio. El silencio al otro lado pesa más que las palabras.",
  },
  {
    id: "engano-de-contrabandista",
    desafio: 7,
    tono: "Ofrecen un trato demasiado limpio. Casi nadie sonríe así sin motivo.",
  },
]);

/**
 * Construye un catálogo consultable de encuentros.
 *
 * Se construye en vez de exportarse un objeto suelto para que una mesa pueda
 * tener el suyo —`crearCatalogoEncuentros([...BASE, ...mios])`— sin que el
 * motor se entere de que existe más de uno.
 */
export function crearCatalogoEncuentros(encuentros = BASE) {
  const validados = encuentros.map(validarEncuentro);
  const porId = new Map(validados.map((e) => [e.id, e]));
  if (porId.size !== validados.length) {
    throw new TypeError("crearCatalogoEncuentros: hay dos encuentros con el mismo id");
  }
  return Object.freeze({
    encuentros: Object.freeze(validados),
    buscar: (id) => porId.get(id) ?? null,
  });
}

/** Valida y congela un encuentro: id estable y semilla derivable. */
export function validarEncuentro(encuentro) {
  if (!encuentro?.id) throw new TypeError("encuentro sin id");
  // Fuerza la derivación de la semilla aquí: si el id no sirve, revienta en
  // carga y no en mitad de un parlamento abierto.
  semillaDeContacto({ id: encuentro.id }, encuentro.desafio ?? 1);
  interlocutorDelContacto({ id: encuentro.id }, encuentro.desafio ?? 1);
  return Object.freeze({ ...encuentro });
}

/** El catálogo base, ya validado. Importarlo es la comprobación. */
export const CATALOGO_ENCUENTROS_BASE = crearCatalogoEncuentros();

/** Los encuentros base sin validar, para quien quiera partir de ellos y añadir. */
export const ENCUENTROS_BASE = Object.freeze(BASE.map((e) => Object.freeze({ ...e })));
