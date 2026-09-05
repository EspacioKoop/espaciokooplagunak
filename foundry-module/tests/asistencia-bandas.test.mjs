import assert from "node:assert/strict";
import test from "node:test";

import {
  BANDAS,
  MARGEN_CRITICO,
  aplicarReglaCasaNatural,
  bandaDesdeDestreza,
  bandaDesdeMargen,
  bandaEsFavorable,
  margenContraObjetivo,
  margenContraSalvacion,
  subirBanda,
} from "../scripts/asistencia/bandas.mjs";

test("el margen de una prueba es cuánto se pasa el ayudante de la CD", () => {
  assert.equal(margenContraObjetivo({ total: 18, dificultad: 13 }), 5);
  assert.equal(margenContraObjetivo({ total: 9, dificultad: 13 }), -4);
});

test("la salvación invierte el margen: tira el objetivo y su éxito es tu fallo", () => {
  // Lo más fácil de equivocar del módulo. Una salvación ALTA debe dejar al
  // ayudante en banda mala, no premiarle justo cuando el objetivo resiste.
  const resiste = margenContraSalvacion({ cdSalvacion: 14, totalSalvacion: 21 });
  assert.equal(resiste, -7);
  assert.equal(bandaDesdeMargen({ margen: resiste, salvacion: true }), BANDAS.PIFIA);

  const falla = margenContraSalvacion({ cdSalvacion: 14, totalSalvacion: 8 });
  assert.equal(bandaDesdeMargen({ margen: falla, salvacion: true }), BANDAS.CRITICO);
});

test("el empate lo gana quien salva: margen 0 es éxito en (a) y fallo en salvación", () => {
  assert.equal(bandaDesdeMargen({ margen: 0 }), BANDAS.EXITO);
  assert.equal(bandaDesdeMargen({ margen: 0, salvacion: true }), BANDAS.FALLO);
  // Y justo por encima del empate la salvación ya sí da éxito.
  assert.equal(bandaDesdeMargen({ margen: 1, salvacion: true }), BANDAS.EXITO);
});

test("las fronteras del crítico y la pifia están en ±5", () => {
  assert.equal(bandaDesdeMargen({ margen: MARGEN_CRITICO }), BANDAS.CRITICO);
  assert.equal(bandaDesdeMargen({ margen: MARGEN_CRITICO - 1 }), BANDAS.EXITO);
  assert.equal(bandaDesdeMargen({ margen: -MARGEN_CRITICO }), BANDAS.PIFIA);
  assert.equal(bandaDesdeMargen({ margen: -MARGEN_CRITICO + 1 }), BANDAS.FALLO);
});

test("el 20 natural NO es crítico por sí solo en una prueba de característica", () => {
  // dnd5e (2014) reserva crítico y pifia automáticos a las tiradas de ataque.
  // Darlos por base en pruebas sería vender como 5e una regla que 5e no dice.
  const margen = margenContraObjetivo({ total: 20 + 1, dificultad: 25 });
  const banda = bandaDesdeMargen({ margen });
  assert.equal(banda, BANDAS.FALLO);
  assert.equal(aplicarReglaCasaNatural({ banda, natural: 20 }), BANDAS.FALLO);
});

test("la regla de la casa 1/20 existe, pero solo si la mesa la enciende", () => {
  const fallo = BANDAS.FALLO;
  assert.equal(aplicarReglaCasaNatural({ banda: fallo, natural: 20, activa: true }), BANDAS.CRITICO);
  assert.equal(
    aplicarReglaCasaNatural({ banda: BANDAS.CRITICO, natural: 1, activa: true }),
    BANDAS.PIFIA,
  );
  assert.equal(aplicarReglaCasaNatural({ banda: fallo, natural: 13, activa: true }), fallo);
});

test("el minijuego de destreza produce LAS MISMAS bandas que la tirada", () => {
  // Es la garantía de que el módulo funciona sin dnd5e sin cambiar el balance:
  // los dos caminos comparten el mapeo banda→efecto.
  assert.equal(bandaDesdeDestreza({ precision: 1 }), BANDAS.CRITICO);
  assert.equal(bandaDesdeDestreza({ precision: 0.7 }), BANDAS.EXITO);
  assert.equal(bandaDesdeDestreza({ precision: 0.3 }), BANDAS.FALLO);
  assert.equal(bandaDesdeDestreza({ precision: 0 }), BANDAS.PIFIA);
  // Fuera de rango se acota en vez de romper.
  assert.equal(bandaDesdeDestreza({ precision: 4 }), BANDAS.CRITICO);
  assert.equal(bandaDesdeDestreza({ precision: -2 }), BANDAS.PIFIA);
});

test("solo éxito y crítico dan fruto", () => {
  assert.equal(bandaEsFavorable(BANDAS.EXITO), true);
  assert.equal(bandaEsFavorable(BANDAS.CRITICO), true);
  assert.equal(bandaEsFavorable(BANDAS.FALLO), false);
  assert.equal(bandaEsFavorable(BANDAS.PIFIA), false);
});

test("una orden de mando sube exactamente una banda y no rebasa crítico", () => {
  assert.equal(subirBanda(BANDAS.PIFIA), BANDAS.FALLO);
  assert.equal(subirBanda(BANDAS.FALLO), BANDAS.EXITO);
  assert.equal(subirBanda(BANDAS.EXITO), BANDAS.CRITICO);
  assert.equal(subirBanda(BANDAS.CRITICO), BANDAS.CRITICO);
  assert.throws(() => subirBanda("inventada"), TypeError);
});
