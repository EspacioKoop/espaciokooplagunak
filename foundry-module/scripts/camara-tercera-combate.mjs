import { resolverCamara, TERCERA } from "./nave-camara.mjs";

// La casilla táctica de dnd5e mide 5 PIES (no metros): nave-camara.mjs razona
// enteramente en metros (retiro 2.2 m, ojos 1.45 m), así que hay que convertir
// antes de usar esta medida como límite de posición.
const PIES_A_METROS = 0.3048;

export const CASILLA_COMBATE = 5;
export const CASILLA_COMBATE_METROS = CASILLA_COMBATE * PIES_A_METROS;

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function limitarPosicionCombate(position = {}) {
  return {
    x: clamp(finite(position.x), 0, CASILLA_COMBATE_METROS),
    z: clamp(finite(position.z), 0, CASILLA_COMBATE_METROS),
  };
}

export function resolverCamaraTerceraCombate({ x, z, yaw, y = 0 }) {
  const posicion = limitarPosicionCombate({ x, z });
  return {
    posicion,
    ...resolverCamara({ ...posicion, yaw: finite(yaw), y: finite(y), modo: TERCERA }),
  };
}
