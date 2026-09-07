// Consumidor real de la deformación por huesos (#603, fase 4).
//
// La fase 1 (rig-esqueleto.mjs) dio el formato de rig y la deformación de
// malla; la fase 2 (tools/pesar-despiezar.mjs) los pesos automáticos. Esto es
// lo que el issue pide en la fase 4: un punto de la partida donde una pieza se
// dobla según su rig ANTES de entrar en `componerEscena`. La malla ya deformada
// es lo que el rasterizador pinta, igual que cualquier otra — el motor no se
// toca, solo se le pasa la malla ya doblada.
//
// Sin dependencias nuevas: reusa rig-esqueleto.mjs (puro). Solo compone sus
// primitivas (`crearRig` + `normalizarPesos` + `deformarMalla`) en el paso que
// la escena necesitaba y que hasta ahora no existía.
//
// Una pieza SIN rig pasa tal cual: este módulo no cambia el aspecto actual del
// museo, solo lo habilita para cuando una pieza declare su rig (la decisión de
// arte «todo escaneado» de #603 ya está tomada, así que el cableado es lícito).

import { crearRig, normalizarPesos, deformarMalla } from "./rig-esqueleto.mjs";

/**
 * Deforma la malla de una pieza según su rig.
 *
 * @param {{vertices:number[][], caras:number[][]}} malla
 * @param {object} def `{ rig: huesos[], pesos: pesosPorVertice[], pose? }`.
 *   `rig` es la lista de huesos que espera `crearRig`; `pesos[v]` es la lista de
 *   `{hueso, peso}` que espera `normalizarPesos`; `pose` es la del issue (#603),
 *   parcial y declarable hueso a hueso.
 * @returns malla nueva ya deformada, lista para `componerEscena`.
 */
export function deformarPieza(malla, { rig, pesos, pose = {} }) {
  const r = crearRig(rig);
  const p = normalizarPesos(r, pesos, malla.vertices.length);
  return deformarMalla(malla, r, p, pose);
}
