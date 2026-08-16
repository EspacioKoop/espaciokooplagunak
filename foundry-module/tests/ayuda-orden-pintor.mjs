// Qué se le exige al orden por pintor, escrito UNA vez (#510).
//
// Antes de #510 media docena de suites comprobaba lo mismo a mano: que la lista
// de polígonos saliera monótona en `profundidad`. Esa comprobación describía la
// implementación de entonces (ordenar por el centroide de cada cara) y no la
// propiedad que de verdad importa, y por eso pasaba en verde mientras QA veía
// caras parpadeando: dos centroides casi iguales pueden ordenarse en cualquier
// orden y la lista sigue siendo monótona.
//
// Lo que sí es una garantía del motor: NADA QUE ESTÉ ENTERAMENTE DETRÁS DE
// ALGO QUE TAPA SE PINTA DESPUÉS. Las dos condiciones cuentan. Si dos
// polígonos no comparten ni un píxel en pantalla, su orden relativo no cambia
// nada de lo que se ve y el motor no lo fija a propósito —fijarlo obligaría a
// comparar pares que nunca se tapan, que es justo el coste que el presupuesto
// de `ordenarPorPintor` existe para no pagar—. Y los pares que se CRUZAN en
// profundidad tampoco tienen un orden deducible de la profundidad: quién tapa
// a quién lo decide la geometría, no un número resumen.

import assert from "node:assert/strict";
import { seSolapanEnPantalla } from "../scripts/retro3d.mjs";

/** Rango [zMin, zMax] de un polígono, de su geometría de cámara. */
function rango(poligono) {
  const camara = Array.isArray(poligono?.camara) ? poligono.camara : [];
  if (camara.length === 0) {
    const z = Number(poligono?.profundidad) || 0;
    return [z, z];
  }
  const zs = camara.map((v) => Number(v?.[2]) || 0);
  return [Math.min(...zs), Math.max(...zs)];
}

/**
 * Cuántos pares rompen la garantía en una lista ya ordenada para pintar.
 *
 * Cero es lo que debería salir siempre. No siempre sale: el orden por centroide
 * que el motor usa hoy deja unos pocos pares mal en escenas con mucho mueble
 * (#510), y esa es exactamente la deuda que el issue documenta.
 */
export function paresMalOrdenados(poligonos) {
  const rangos = poligonos.map(rango);
  let malos = 0;
  for (let i = 0; i < rangos.length; i += 1) {
    for (let j = i + 1; j < rangos.length; j += 1) {
      if (!(rangos[j][0] >= rangos[i][1])) continue;
      if (seSolapanEnPantalla(poligonos[i], poligonos[j])) malos += 1;
    }
  }
  return malos;
}

/**
 * Comprueba la garantía sobre una lista ya ordenada para pintar.
 *
 * `tolerados` es una CAPTURA del estado actual, no un permiso: con el orden por
 * centroide de hoy algunas escenas dejan pares mal (#510), y el número está
 * aquí para que empeorar se note. Bajarlo cuando el orden mejore es parte del
 * arreglo; subirlo sin decir por qué es la regresión que esto vigila.
 *
 * @param {Array} poligonos lista tal y como sale del motor.
 * @param {string} contexto para que el fallo diga de qué escena hablamos.
 * @param {number} tolerados pares mal ordenados admitidos hoy.
 */
export function afirmarOrdenPorPintor(poligonos, contexto = "la escena", tolerados = 0) {
  assert.ok(Array.isArray(poligonos) && poligonos.length > 0, `${contexto} no pinta nada`);
  const malos = paresMalOrdenados(poligonos);
  assert.ok(
    malos <= tolerados,
    `${contexto}: ${malos} pares con una cara enteramente detrás de otra, tapándola y pintada después (tolerados hoy: ${tolerados})`,
  );
}
