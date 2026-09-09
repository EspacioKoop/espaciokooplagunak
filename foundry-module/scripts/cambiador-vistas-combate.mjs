// El conmutador de las cuatro vistas de cámara de combate (#1024, sub-issue de
// #1013): táctica, POV, tercera persona y libre/foto, cambiables en cualquier
// momento.
//
// QUÉ ES Y QUÉ NO. Es ESTADO DE PRESENTACIÓN y nada más: entra un nombre de
// vista y unos números (metros, radianes, yaw 0 hacia +z) y sale dónde va la
// cámara. **No recibe entidades, ni permisos, ni estado de combate, y no puede
// concederlos.** Cambiar de cámara no revela lo que la capa de visibilidad
// oculta, no altera un turno y no mueve a nadie — lo que se ve por POV es lo
// mismo que ya se veía en táctica, desde otro sitio. Esa frontera es la razón
// de que este módulo no importe nada de Foundry ni del bucle: si algún día
// necesitara saber quién mira, se habría roto.
//
// UNA VISTA QUE NO SE PUEDE PINTAR NO SE OFRECE. `retro3d.mjs` proyecta en
// PERSPECTIVA y no tiene modo ortográfico todavía (es la otra mitad de #1020),
// así que la vista táctica declara `proyeccion: "ortografica"` sobre un motor
// que no sabe honrarla. Ofrecerla igualmente daría una cenital en perspectiva
// —con las casillas del fondo más pequeñas que las de delante—, o sea una
// rejilla de 5 ft que MIENTE sobre la medida que existe para dar. De ahí
// `vistasDisponibles(...)`: cada superficie declara qué sabe proyectar y el
// conmutador solo ofrece eso. El día que llegue el adaptador ortográfico, la
// arena pasa `ortografica: true` y la vista aparece sin tocar este módulo.
//
// Puro: solo aritmética y despacho. Ni Foundry, ni DOM, ni red.

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

/**
 * Qué vistas puede ofrecer una superficie, según lo que su motor sepa proyectar.
 *
 * Se declara por CAPACIDAD del renderer y no por rol de quien mira: es la misma
 * lista para el GM y para la tripulación, porque una cámara no es un permiso
 * (ver la cabecera). Sin `ortografica`, la táctica no entra.
 *
 * @param {{ortografica?: boolean}} capacidades
 * @returns {readonly string[]} en el mismo orden que `VISTAS_COMBATE`
 */
export function vistasDisponibles({ ortografica = false } = {}) {
  return Object.freeze(
    VISTAS_COMBATE.filter((vista) => vista !== "tactica" || ortografica === true),
  );
}

/**
 * Una vista válida DENTRO de las disponibles. Un nombre desconocido —o uno
 * conocido que esta superficie no sabe pintar— cae a la primera disponible en
 * vez de explotar, que es lo mismo que hace `nave-camara.mjs` con su modo.
 */
export function normalizarVista(view, disponibles = VISTAS_COMBATE) {
  const lista = disponibles.length > 0 ? disponibles : VISTAS_COMBATE;
  return lista.includes(view) ? view : lista[0];
}

/** La siguiente vista del ciclo, saltándose las que la superficie no ofrece. */
export function siguienteVista(view, disponibles = VISTAS_COMBATE) {
  const lista = disponibles.length > 0 ? disponibles : VISTAS_COMBATE;
  const current = normalizarVista(view, lista);
  const index = lista.indexOf(current);
  return lista[(index + 1) % lista.length];
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

/**
 * Dónde va la cámara para una vista dada.
 *
 * `entrada` son solo números de posición y orientación; ni una entidad, ni un
 * permiso. Devuelve congelado para que nadie escriba en el estado de vista
 * creyendo que así mueve la cámara — se pide otra vista, no se parchea esta.
 */
export function resolverVistaCombate(nombre, entrada = {}, disponibles = VISTAS_COMBATE) {
  const modo = normalizarVista(nombre, disponibles);
  const vista = CATALOGO[modo](entrada);
  return Object.freeze({ modo, ...vista, camara: Object.freeze(vista.camara) });
}
