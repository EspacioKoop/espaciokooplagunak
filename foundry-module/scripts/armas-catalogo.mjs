// Catálogo de armas 3D por partes, una por cada una de las 12 clases del SRD
// Puro: ni Foundry, ni DOM, ni red.

import { AVATAR, CANTINA } from "./paleta.mjs";

function deepFreeze(obj) {
  Object.keys(obj).forEach(key => {
    const val = obj[key];
    if (typeof val === 'object' && val !== null) {
      deepFreeze(val);
    }
  });
  return Object.freeze(obj);
}

/** Armas por clase, cada una con nombre y lista de piezas (cajas). */
export const ARMAS_POR_CLASE = deepFreeze({
  barbaro: {
    nombre: "Hacha de batalla",
    piezas: [
      // mango
      { nombre: "Mango", color: AVATAR.acero, centro: [0, 0.15, 0], medidas: [0.09, 0.3, 0.09] },
      // hoja
      { nombre: "Hoja", color: AVATAR.acero, centro: [0, 0.9, 0], medidas: [0.09, 1.2, 0.09] },
    ],
  },
  bardo: {
    nombre: "Laúd",
    piezas: [
      // cuerpo
      { nombre: "Cuerpo", color: AVATAR.madera, centro: [0, 0.2, 0], medidas: [0.28, 0.4, 0.1] },
      // mástil
      { nombre: "Mástil", color: AVATAR.madera, centro: [0, 0.55, 0], medidas: [0.12, 0.3, 0.04] },
    ],
  },
  clerigo: {
    nombre: "Símbolo sagrado",
    piezas: [
      // base
      { nombre: "Base", color: AVATAR.simbolo, centro: [0, 0.03, 0], medidas: [0.16, 0.06, 0.06] },
      // símbolo
      { nombre: "Símbolo", color: AVATAR.simbolo, centro: [0, 0.14, 0], medidas: [0.16, 0.16, 0.06] },
    ],
  },
  druida: {
    nombre: "Báculo de madera",
    piezas: [
      // mango inferior
      { nombre: "Mango inferior", color: AVATAR.madera, centro: [0, 0.15, 0], medidas: [0.08, 0.3, 0.08] },
      // eje superior
      { nombre: "Eje superior", color: AVATAR.madera, centro: [0, 1.05, 0], medidas: [0.08, 1.5, 0.08] },
    ],
  },
  guerrero: {
    nombre: "Espada larga",
    piezas: [
      // empuñadura
      { nombre: "Empuñadura", color: AVATAR.acero, centro: [0, 0.15, 0], medidas: [0.09, 0.3, 0.09] },
      // lámina
      { nombre: "Lámina", color: AVATAR.acero, centro: [0, 0.9, 0], medidas: [0.09, 1.2, 0.09] },
    ],
  },
  monje: {
    nombre: "Vendas de nudillos",
    piezas: [
      // venda izquierda
      { nombre: "Venda izquierda", color: CANTINA.goblinRopa, centro: [-0.05, 0.05, 0], medidas: [0.1, 0.1, 0.1] },
      // venta derecha
      { nombre: "Venda derecha", color: CANTINA.goblinRopa, centro: [0.05, 0.05, 0], medidas: [0.1, 0.1, 0.1] },
    ],
  },
  paladin: {
    nombre: "Espada sagrada",
    piezas: [
      // empuñadura
      { nombre: "Empuñadura", color: AVATAR.acero, centro: [0, 0.15, 0], medidas: [0.09, 0.3, 0.09] },
      // lámina
      { nombre: "Lámina", color: AVATAR.acero, centro: [0, 0.9, 0], medidas: [0.09, 1.2, 0.09] },
    ],
  },
  explorador: {
    nombre: "Espada corta",
    piezas: [
      // empuñadura
      { nombre: "Empuñadura", color: AVATAR.acero, centro: [0, 0.1, 0], medidas: [0.07, 0.2, 0.07] },
      // lámina
      { nombre: "Lámina", color: AVATAR.acero, centro: [0, 0.55, 0], medidas: [0.07, 0.7, 0.07] },
    ],
  },
  picaro: {
    nombre: "Daga",
    piezas: [
      // empuñadura
      { nombre: "Empuñadura", color: AVATAR.acero, centro: [0, 0.1, 0], medidas: [0.07, 0.2, 0.07] },
      // lámina
      { nombre: "Lámina", color: AVATAR.acero, centro: [0, 0.55, 0], medidas: [0.07, 0.7, 0.07] },
    ],
  },
  hechicero: {
    nombre: "Báculo de hechicero",
    piezas: [
      // mango inferior
      { nombre: "Mango inferior", color: AVATAR.madera, centro: [0, 0.15, 0], medidas: [0.08, 0.3, 0.08] },
      // eje superior
      { nombre: "Eje superior", color: AVATAR.madera, centro: [0, 1.05, 0], medidas: [0.08, 1.5, 0.08] },
    ],
  },
  brujo: {
    nombre: "Báculo de brujo",
    piezas: [
      // mango inferior
      { nombre: "Mango inferior", color: AVATAR.madera, centro: [0, 0.15, 0], medidas: [0.08, 0.3, 0.08] },
      // eje superior
      { nombre: "Eje superior", color: AVATAR.madera, centro: [0, 1.05, 0], medidas: [0.08, 1.5, 0.08] },
    ],
  },
  mago: {
    nombre: "Báculo de mago",
    piezas: [
      // mango inferior
      { nombre: "Mango inferior", color: AVATAR.madera, centro: [0, 0.15, 0], medidas: [0.08, 0.3, 0.08] },
      // eje superior
      { nombre: "Eje superior", color: AVATAR.madera, centro: [0, 1.05, 0], medidas: [0.08, 1.5, 0.08] },
    ],
  },
});

/**
 * Devuelve las piezas de un arma trasladadas al punto dado.
 * @param {string} claseId - clave de la clase (debe estar en CLASES)
 * @param {[number, number, number]} punto - desplazamiento [x, y, z]
 * @returns {Array<{nombre:string, color:string, centro:[number,number,number], medidas:[number,number,number]}>}
 */
export function piezasArma(claseId, punto = [0, 0, 0]) {
  const arma = ARMAS_POR_CLASE[claseId];
  if (!arma) throw new Error(`Clase desconocida: ${claseId}`);
  return arma.piezas.map(pieza => ({
    ...pieza,
    centro: [
      pieza.centro[0] + punto[0],
      pieza.centro[1] + punto[1],
      pieza.centro[2] + punto[2],
    ],
  }));
}