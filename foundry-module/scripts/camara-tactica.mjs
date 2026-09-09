const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;
const DEFAULT_CELL_SIZE = 5;

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeCenter(value) {
  return {
    x: finite(value?.x),
    y: finite(value?.y),
  };
}

export function crearCamaraTactica(options = {}) {
  return {
    modo: "tactica",
    proyeccion: "ortografica",
    centro: normalizeCenter(options.centro),
    zoom: clamp(finite(options.zoom, 1), ZOOM_MIN, ZOOM_MAX),
    cuadricula: options.cuadricula === true,
    tamanoCasilla: finite(options.tamanoCasilla, DEFAULT_CELL_SIZE),
  };
}

export function zoomCamara(camera, delta) {
  const current = crearCamaraTactica(camera);
  return {
    ...current,
    zoom: clamp(current.zoom + finite(delta), ZOOM_MIN, ZOOM_MAX),
  };
}

export function desplazarCamara(camera, offset = {}) {
  const current = crearCamaraTactica(camera);
  return {
    ...current,
    centro: {
      x: current.centro.x + finite(offset.x),
      y: current.centro.y + finite(offset.y),
    },
  };
}

export function alternarCuadricula(camera, enabled = !camera?.cuadricula) {
  return {
    ...crearCamaraTactica(camera),
    cuadricula: enabled === true,
  };
}

function gridCoordinates(center, extent, cellSize) {
  const start = Math.ceil((center - extent / 2) / cellSize) * cellSize;
  const end = center + extent / 2;
  const values = [];
  for (let value = start; value <= end; value += cellSize) {
    values.push(Number(value.toFixed(6)));
  }
  return values;
}

export function lineasCuadricula(camera, viewport = {}) {
  const current = crearCamaraTactica(camera);
  if (!current.cuadricula) return { vertical: [], horizontal: [] };
  const width = Math.max(0, finite(viewport.ancho));
  const height = Math.max(0, finite(viewport.alto));
  const cellSize = current.tamanoCasilla;
  if (cellSize <= 0) return { vertical: [], horizontal: [] };

  return {
    vertical: gridCoordinates(current.centro.x, width, cellSize),
    horizontal: gridCoordinates(current.centro.y, height, cellSize),
  };
}
