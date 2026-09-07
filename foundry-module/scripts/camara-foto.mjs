const PITCH_LIMIT = Math.PI / 2 - 0.01;

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

export function crearCamaraFoto({ esGM = false, posicion, orbita } = {}) {
  return {
    modo: "foto",
    esGM: esGM === true,
    posicion: vector(posicion),
    orbita: {
      yaw: finite(orbita?.yaw),
      pitch: clamp(finite(orbita?.pitch), -PITCH_LIMIT, PITCH_LIMIT),
    },
    zoom: 1,
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
