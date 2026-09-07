import { ALTURA_OJOS } from "./nave-camara.mjs";

// La casilla táctica de dnd5e mide 5 PIES (no metros): nave-camara.mjs razona
// enteramente en metros (ALTURA_OJOS, retiro), así que hay que convertir
// antes de usar esta medida como límite de posición.
const PIES_A_METROS = 0.3048;

export const CASILLA_COMBATE = 5;
export const CASILLA_COMBATE_METROS = CASILLA_COMBATE * PIES_A_METROS;
export const ALTURA_OJOS_COMBATE = ALTURA_OJOS;

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function limitarMovimientoCasilla(position = {}) {
  return {
    x: clamp(finite(position.x), 0, CASILLA_COMBATE_METROS),
    z: clamp(finite(position.z), 0, CASILLA_COMBATE_METROS),
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
