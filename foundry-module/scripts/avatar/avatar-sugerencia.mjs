// Semilla de avatar a partir de la ficha de dnd5e, si el `User` tiene una
// asignada (#450). ES UNA SUGERENCIA, NO UNA VERDAD: el mapeo clase/raza de
// dnd5e al catálogo del SRD 5.1 que admite `cantina-avatar.mjs` es heurístico
// a propósito — falla en bordes razonables (multiclase, razas homebrew) y
// cuando falla cae a "sin cambios" o a `"otra"`, nunca a una adivinanza.
//
// Solo pone semilla en clase y raza: silueta, pelo, piel, ropa y gesto no
// tienen análogo en la ficha y se dejan como estaban en el borrador — tocarlos
// aquí sería inventar una preferencia que nadie ha expresado.
//
// Puro: recibe un actor (o `null`) y el borrador actual, devuelve solo los
// campos que cambian. Ni Foundry, ni DOM.

import { CLASES, RAZAS } from "../cantina-avatar.mjs";

/** Identificador de clase dnd5e (inglés, en minúsculas) → clave del SRD que
 * usa el avatar. Las doce coinciden 1 a 1 con las del SRD 5.1. */
const CLASE_DND5E_A_SRD = Object.freeze({
  barbarian: "barbaro",
  bard: "bardo",
  cleric: "clerigo",
  druid: "druida",
  fighter: "guerrero",
  monk: "monje",
  paladin: "paladin",
  ranger: "explorador",
  rogue: "picaro",
  sorcerer: "hechicero",
  warlock: "brujo",
  wizard: "mago",
});

/** Solo las razas que el catálogo puede nombrar por licencia (ver
 * `cantina-avatar.mjs`); cualquier otra cae en `"otra"`, no se inventa. */
const RAZA_DND5E_A_SRD = Object.freeze({
  human: "humano",
  dwarf: "enano",
  elf: "elfo",
  halfling: "mediano",
});

/** Identificador estable de un item de ficha, con reservas para las versiones
 * de dnd5e que no lo traen: el nombre visible, pasado por el mismo tamiz. */
function identificadorDe(item) {
  const identificador = item?.system?.identifier ?? item?.name ?? "";
  return String(identificador).toLowerCase().trim();
}

function primeraClase(actor) {
  // dnd5e v3 expone `actor.classes` como objeto {identificador: item}; es la
  // fuente más directa cuando existe.
  const claves = actor?.classes ? Object.keys(actor.classes) : [];
  if (claves.length > 0) return claves[0];

  // Sin eso (v2, o un actor de mentira en pruebas), se busca a mano entre los
  // items de tipo "class".
  const items = Array.isArray(actor?.items) ? actor.items : Array.from(actor?.items ?? []);
  const item = items.find((i) => i?.type === "class");
  return item ? identificadorDe(item) : "";
}

function primeraRaza(actor) {
  const items = Array.isArray(actor?.items) ? actor.items : Array.from(actor?.items ?? []);
  // dnd5e v3: la raza es un item de tipo "race". v2: un texto libre en
  // `system.details.race`, que aquí solo sirve si coincide literalmente con
  // una clave conocida — no hay diccionario razonable para texto libre.
  const item = items.find((i) => i?.type === "race");
  if (item) return identificadorDe(item);
  return String(actor?.system?.details?.race ?? "").toLowerCase().trim();
}

/**
 * @param {object|null} actor el actor asignado al `User` (`user.character`).
 * @param {object} borrador el avatar que se está editando ahora mismo.
 * @returns {{clase?: string, raza?: string}} solo lo que hay que cambiar.
 */
export function sugerirAvatarDesdeActor(actor, borrador = {}) {
  if (!actor) return {};
  const cambios = {};

  const clase = CLASE_DND5E_A_SRD[primeraClase(actor)];
  if (clase && CLASES.includes(clase)) cambios.clase = clase;

  const razaClave = primeraRaza(actor);
  const raza = RAZA_DND5E_A_SRD[razaClave] ?? (razaClave ? "otra" : undefined);
  if (raza && RAZAS.includes(raza)) cambios.raza = raza;

  return cambios;
}
