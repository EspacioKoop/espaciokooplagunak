import { ALTURA_OJOS } from "./nave-camara.mjs";

export const CASILLA_COMBATE = 5;
export const ALTURA_OJOS_COMBATE = ALTURA_OJOS;

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function limitarMovimientoCasilla(position = {}) {
  return {
    x: clamp(finite(position.x), 0, CASILLA_COMBATE),
    z: clamp(finite(position.z), 0, CASILLA_COMBATE),
  };
}

export function moverEnCasilla(position, delta = {}) {
  return limitarMovimientoCasilla({
    x: finite(position?.x) + finite(delta.x),
    z: finite(position?.z) + finite(delta.z),
  });
}

export function resolverCamaraPov({ x, z, yaw, y = 0 }) {
  const position = limitarMovimientoCasilla({ x, z });
  return {
    camara: [position.x, ALTURA_OJOS_COMBATE + finite(y), position.z],
    yaw: finite(yaw),
    dibujarPropio: false,
  };
}
