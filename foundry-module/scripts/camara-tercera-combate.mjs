import { resolverCamara, TERCERA } from "./nave-camara.mjs";

export const CASILLA_COMBATE = 5;

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function limitarPosicionCombate(position = {}) {
  return {
    x: clamp(finite(position.x), 0, CASILLA_COMBATE),
    z: clamp(finite(position.z), 0, CASILLA_COMBATE),
  };
}

export function resolverCamaraTerceraCombate({ x, z, yaw, y = 0 }) {
  const posicion = limitarPosicionCombate({ x, z });
  return {
    posicion,
    ...resolverCamara({ ...posicion, yaw: finite(yaw), y: finite(y), modo: TERCERA }),
  };
}
