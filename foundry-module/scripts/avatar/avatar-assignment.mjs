// Quién elige su propio avatar de cantina (#450 sobre #423).
//
// Vive en un flag del `User`, igual que `station` (station-assignment.mjs):
// es "cómo me veo yo", no un dato de partida ni estado de nave, y por eso no
// pasa por el puente. La forma que se guarda es exactamente la que ya espera
// `normalizarAvatar()` en `cantina-avatar.mjs` — este módulo no reinventa esa
// validación, la reutiliza.

import { normalizarAvatar } from "../cantina-avatar.mjs";

const FLAG_KEY = "avatar";

export const AVATAR_ASSIGNMENT_ERRORS = Object.freeze({
  NOT_ALLOWED: "not-allowed",
});

/** Mismo criterio que `canAssignStation`: el GM o quien es dueño de sí mismo. */
export function canAssignAvatar(actor, target) {
  return Boolean(actor?.isGM || (actor?.id && actor.id === target?.id));
}

/** El avatar guardado de alguien, ya normalizado — nunca a medio rellenar ni
 * roto por un flag corrupto, porque `normalizarAvatar` no rechaza nada. */
export function avatarDeUsuario(user, moduleId) {
  return normalizarAvatar(user?.getFlag?.(moduleId, FLAG_KEY) ?? {});
}

export async function assignAvatar({ actor, target, descripcion, moduleId }) {
  if (!canAssignAvatar(actor, target)) {
    const error = new Error("Not allowed to assign this avatar");
    error.code = AVATAR_ASSIGNMENT_ERRORS.NOT_ALLOWED;
    throw error;
  }
  const normalizado = normalizarAvatar({ ...descripcion, nombre: target?.name ?? "" });
  await target.setFlag(moduleId, FLAG_KEY, normalizado);
  return normalizado;
}
