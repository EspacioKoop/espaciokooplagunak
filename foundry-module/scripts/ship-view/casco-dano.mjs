// Lectura espacial del daño para el casco de serie de la consola de ingeniería
// (#419). Este módulo es puro: declara dónde vive cada sistema y compone las
// caras mediante el motor 3D existente, sin tocar Canvas ni Foundry.

import { componerEscena, fundirEscenas } from "../retro3d.mjs";
import { FACCIONES, PIXEL, SISTEMA } from "../paleta.mjs";

/**
 * Regiones de la topología del casco de serie, por índice de cara de
 * `mallaDesdeCasco`. El mapa queda separado de la telemetría para poder
 * sustituirlo por una plantilla declarativa cuando #55 lo permita.
 */
export const CARAS_CASCO_SERIE = Object.freeze({
  lomo: Object.freeze([0]),
  costados: Object.freeze([1, 2]),
  popa: Object.freeze([3]),
  alaIzquierda: Object.freeze([4]),
  quilla: Object.freeze([5, 7]),
  alaDerecha: Object.freeze([6]),
});

/** Sistemas del DTO que contribuyen a cada región del casco de serie. */
export const SISTEMAS_POR_REGION_CASCO_SERIE = Object.freeze({
  lomo: Object.freeze(["reactor"]),
  costados: Object.freeze(["frontshield"]),
  popa: Object.freeze(["impulse", "warp", "jumpdrive", "rearshield"]),
  alaIzquierda: Object.freeze(["beamweapons", "maneuver"]),
  quilla: Object.freeze(["reactor", "maneuver"]),
  alaDerecha: Object.freeze(["missilesystem", "maneuver"]),
});

// Tres escalones, no un degradado: el lenguaje visual del módulo usa paleta
// corta. El canal accesible sigue siendo la lista textual de sistemas.
export const COLOR_REGION = Object.freeze({
  sinLectura: PIXEL.sinFaccion,
  estable: SISTEMA.nucleo,
  danada: PIXEL.motor,
  critica: FACCIONES[5],
  // Región dañada mientras la reparación automática está activa (#464/#466):
  // feedback 3D real de la orden `set_auto_repair`, no un valor abstracto.
  reparando: SISTEMA.reparando,
});

function saludLeida(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, value));
}

/**
 * La peor lectura conocida gobierna la región. Un sistema sin lectura se
 * ignora si otro sí responde; si no responde ninguno, la región queda neutral.
 */
export function saludPorRegion(sistemas = []) {
  const porId = new Map(
    (Array.isArray(sistemas) ? sistemas : [])
      .map((sistema) => [sistema?.id, saludLeida(sistema?.health)])
      .filter(([id]) => typeof id === "string"),
  );

  return Object.fromEntries(Object.entries(SISTEMAS_POR_REGION_CASCO_SERIE).map(([region, ids]) => {
    const lecturas = ids.map((id) => porId.get(id)).filter((value) => value !== null && value !== undefined);
    return [region, lecturas.length > 0 ? Math.min(...lecturas) : null];
  }));
}

/**
 * `reparando`: la reparación automática está activa (#464). Una región sana o
 * sin lectura no cambia — reparar algo que no está roto no pinta nada
 * distinto, y no hay dato no es cero (#353).
 */
export function colorParaSalud(salud, reparando = false) {
  if (!Number.isFinite(salud)) return COLOR_REGION.sinLectura;
  if (salud < 35) return reparando ? COLOR_REGION.reparando : COLOR_REGION.critica;
  if (salud < 70) return reparando ? COLOR_REGION.reparando : COLOR_REGION.danada;
  return COLOR_REGION.estable;
}

/**
 * Compone una única escena con color por región y orden de profundidad global.
 * Cada composición usa exactamente la misma cámara; después se mezclan sus
 * polígonos y se reordena el conjunto para no romper el algoritmo del pintor.
 *
 * `opciones.autoRepairActivo` (#464/#466): feedback 3D real de la orden de
 * ingeniería — las regiones dañadas cambian de color cuando la tripulación
 * activa la reparación automática, sin animación ni reloj propio (el motor no
 * lleva uno).
 */
export function componerCascoPorDano(malla, sistemas, opciones = {}) {
  const salud = saludPorRegion(sistemas);
  const reparando = opciones.autoRepairActivo === true;
  const poligonos = [];

  for (const [region, indices] of Object.entries(CARAS_CASCO_SERIE)) {
    const caras = indices.map((indice) => malla?.caras?.[indice]).filter(Array.isArray);
    if (caras.length === 0) continue;
    const escena = componerEscena(
      { vertices: malla?.vertices ?? [], caras },
      { ...opciones, color: colorParaSalud(salud[region], reparando) },
    );
    poligonos.push(...escena.poligonos.map((poligono) => ({ ...poligono, region })));
  }

  // `fundirEscenas` (#510) sobre una lista suelta: los polígonos ya llevan su
  // `region` colgada y el orden global es lo único que falta.
  return { salud, poligonos: fundirEscenas([poligonos]).poligonos };
}
