const PITCH_LIMIT = Math.PI / 2 - 0.01;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;
const ZOOM_DEFAULT = 1;

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function vector(value = {}) {
  return {
    x: finite(value.x),
    y: finite(value.y),
    z: finite(value.z),
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function controlesCamaraFoto({ esGM = false } = {}) {
  return {
    mover: esGM,
    orbitar: esGM,
    zoom: esGM,
    capturar: true,
  };
}

function normalizarZoom(valor) {
  return clamp(finite(valor, ZOOM_DEFAULT), ZOOM_MIN, ZOOM_MAX);
}

export function crearCamaraFoto({ esGM = false, posicion, orbita, zoom } = {}) {
  return {
    modo: "foto",
    esGM: esGM === true,
    posicion: vector(posicion),
    orbita: {
      yaw: finite(orbita?.yaw),
      pitch: clamp(finite(orbita?.pitch), -PITCH_LIMIT, PITCH_LIMIT),
    },
    // El zoom existente se conserva al renormalizar (p.ej. desde
    // moverCamaraFoto/orbitarCamaraFoto): crearCamaraFoto no es solo el
    // constructor inicial, también se usa para volver a validar el estado
    // tras cada movimiento, y machacarlo a 1 cada vez perdía el zoom del GM.
    zoom: normalizarZoom(zoom),
  };
}

export function moverCamaraFoto(camera, delta = {}) {
  if (camera?.esGM !== true) return camera;
  const current = crearCamaraFoto(camera);
  const movement = vector(delta);
  return {
    ...current,
    posicion: {
      x: current.posicion.x + movement.x,
      y: current.posicion.y + movement.y,
      z: current.posicion.z + movement.z,
    },
  };
}

export function zoomCamaraFoto(camera, delta = 0) {
  if (camera?.esGM !== true) return camera;
  const current = crearCamaraFoto(camera);
  return {
    ...current,
    zoom: normalizarZoom(current.zoom + finite(delta)),
  };
}

export function orbitarCamaraFoto(camera, delta = {}) {
  if (camera?.esGM !== true) return camera;
  const current = crearCamaraFoto(camera);
  return {
    ...current,
    orbita: {
      yaw: current.orbita.yaw + finite(delta.yaw),
      pitch: clamp(current.orbita.pitch + finite(delta.pitch), -PITCH_LIMIT, PITCH_LIMIT),
    },
  };
}
