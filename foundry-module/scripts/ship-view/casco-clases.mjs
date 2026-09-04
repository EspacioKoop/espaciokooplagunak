// Medidas de casco por clase de nave (#362, rebanada 4).
//
// De dónde salen las clases. No son inventadas: el puente ya publica `class` de
// cada contacto, tomado de `ShipTemplate:setClass()` del juego —EmptyEpsilon la
// copia al componente `docking_port`—. Así que esto no añade un catálogo
// paralelo, traduce el que ya existe.
//
// Qué hace. Cada clase se convierte en las cuatro medidas que `mallaDesdeCasco`
// necesita. Es la decisión 3 de #362: la forma sale de medidas y no de mallas
// dibujadas a mano, porque con mallas a mano un carguero y un caza son la misma
// nave repintada.
//
// LO IMPORTANTE ES EL DESCONOCIDO. Un escenario puede traer una clase que aquí
// no esté —y traerá, porque el catálogo del juego crece sin avisar a este
// módulo—. Ese caso NO es un error: se dibuja el casco de serie. Una nave
// genérica es información («hay algo ahí»); un hueco donde debería haber una
// nave se lee como que el módulo está roto.
//
// Puro: ni Foundry, ni DOM, ni red.

import { CASCO_POR_DEFECTO, mallaDesdeCasco } from "../retro3d.mjs";

/**
 * Clase de nave → proporciones. Se describen en palabras porque los números
 * solos no dicen nada dentro de un año:
 *
 * - un caza es corto, estrecho y casi todo ala;
 * - una fragata es la nave «normal», la referencia contra la que se leen las demás;
 * - una corbeta es más larga y con menos ala: aguanta, no baila;
 * - un acorazado es largo, ancho y de quilla profunda, sin ala que valga;
 * - un transporte es una caja: ancho y hondo, con lo mínimo para volar;
 * - una estación no vuela, así que no tiene morro ni alas, solo volumen.
 */
export const CASCOS_POR_CLASE = Object.freeze({
  starfighter: Object.freeze({ eslora: 1.4, manga: 0.55, envergadura: 2.0, quilla: 0.25 }),
  frigate: Object.freeze({ eslora: 1.8, manga: 0.85, envergadura: 1.4, quilla: 0.45 }),
  corvette: Object.freeze({ eslora: 2.4, manga: 0.95, envergadura: 1.1, quilla: 0.55 }),
  cruiser: Object.freeze({ eslora: 2.6, manga: 1.1, envergadura: 1.2, quilla: 0.6 }),
  dreadnought: Object.freeze({ eslora: 3.0, manga: 1.4, envergadura: 1.0, quilla: 0.9 }),
  transport: Object.freeze({ eslora: 1.9, manga: 1.3, envergadura: 0.8, quilla: 0.85 }),
  freighter: Object.freeze({ eslora: 2.1, manga: 1.35, envergadura: 0.75, quilla: 0.9 }),
  station: Object.freeze({ eslora: 1.1, manga: 1.5, envergadura: 1.5, quilla: 1.2 }),
});

/**
 * Normaliza el nombre de clase que llega del juego. Viene con la caja que le
 * puso quien escribió la plantilla —«Starfighter», «starfighter», «Star Fighter»—
 * y compararlo tal cual convertiría cada plantilla nueva en un desconocido por
 * una mayúscula.
 */
export function claveDeClase(clase) {
  if (typeof clase !== "string") return null;
  const limpia = clase.trim().toLowerCase().replace(/[\s_-]+/g, "");
  return limpia === "" ? null : limpia;
}

/**
 * Medidas para una clase. Devuelve también `conocida`, porque quien pinta puede
 * querer decirlo —una silueta genérica sin avisar se lee como un dato— y quien
 * no quiera decirlo simplemente lo ignora.
 */
export function cascoDeClase(clase) {
  const clave = claveDeClase(clase);
  const medidas = clave ? CASCOS_POR_CLASE[clave] : null;
  return {
    clave,
    conocida: Boolean(medidas),
    medidas: { ...(medidas ?? CASCO_POR_DEFECTO) },
  };
}

/** Malla lista para pintar a partir de la clase. */
export function mallaDeClase(clase) {
  const { medidas, conocida, clave } = cascoDeClase(clase);
  return { malla: mallaDesdeCasco(medidas), conocida, clave };
}
