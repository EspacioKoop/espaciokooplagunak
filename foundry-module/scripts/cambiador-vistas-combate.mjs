import { crearCamaraTactica } from "./camara-tactica.mjs";
import { resolverCamaraPov } from "./camara-pov-combate.mjs";
import { resolverCamaraTerceraCombate } from "./camara-tercera-combate.mjs";
import { crearCamaraFoto } from "./camara-foto.mjs";

export const VISTAS_COMBATE = Object.freeze(["tactica", "pov", "tercera", "libre"]);

const ATAJOS = Object.freeze({
  "1": "tactica",
  "2": "pov",
  "3": "tercera",
  "4": "libre",
});

export function normalizarVista(view) {
  return VISTAS_COMBATE.includes(view) ? view : VISTAS_COMBATE[0];
}

export function siguienteVista(view) {
  const current = normalizarVista(view);
  const index = VISTAS_COMBATE.indexOf(current);
  return VISTAS_COMBATE[(index + 1) % VISTAS_COMBATE.length];
}

export function atajoVista(key) {
  if (typeof key !== "string") return null;
  const lower = key.toLowerCase();
  return Object.hasOwn(ATAJOS, lower) ? ATAJOS[lower] : null;
}

// Costura de presentación: metros, radianes, yaw 0 hacia +z.
// No recibe entidades ni permisos. No concede visibilidad ni aplica combate.
// La proyección es una declaración: falta el adaptador ortográfico del renderer.
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const CATALOGO = Object.freeze({
  tactica: (entrada) => {
    const vista = crearCamaraTactica(entrada);
    return { camara: [vista.centro.x, 10, vista.centro.y], yaw: 0,
      pitch: -Math.PI / 2, zoom: vista.zoom, proyeccion: "ortografica", dibujarPropio: true };
  },
  pov: (entrada) => ({ ...resolverCamaraPov(entrada), pitch: 0, zoom: 1, proyeccion: "perspectiva" }),
  tercera: (entrada) => {
    const vista = resolverCamaraTerceraCombate(entrada);
    return { camara: vista.camara, yaw: finite(entrada.yaw), pitch: 0, zoom: 1,
      proyeccion: "perspectiva", dibujarPropio: vista.dibujarPropio };
  },
  libre: (entrada) => {
    const vista = crearCamaraFoto(entrada);
    return { camara: [vista.posicion.x, vista.posicion.y, vista.posicion.z],
      yaw: vista.orbita.yaw, pitch: vista.orbita.pitch, zoom: vista.zoom,
      proyeccion: "perspectiva", dibujarPropio: true };
  },
});

export function resolverVistaCombate(nombre, entrada = {}) {
  const modo = normalizarVista(nombre);
  const vista = CATALOGO[modo](entrada);
  return Object.freeze({ modo, ...vista, camara: Object.freeze(vista.camara) });
}
