import assert from "node:assert/strict";
import test from "node:test";
import { repartirBotes } from "../scripts/minijuegos/pozos.mjs";

// Una evaluación NO es un número: `compararManos` lee `{categoria, desempate}`
// (evaluador-manos.mjs). Se fabrican a mano a propósito —no se evalúan cartas
// de verdad— porque lo que se prueba aquí es el REPARTO, no el evaluador, que
// tiene su propia suite.
const mano = (categoria, desempate = []) => ({ categoria, desempate });



test("un solo bote: el ganador se lo lleva entero", () => {
  const jugadores = [
    { userId: "a", apostadoTotal: 100, retirado: false },
    { userId: "b", apostadoTotal: 100, retirado: false },
  ];
  const evaluaciones = new Map([
    ["a", mano(2)],
    ["b", mano(1)],
  ]);

  const { ganancias } = repartirBotes(jugadores, evaluaciones);
  assert.equal(ganancias.get("a"), 200);
  assert.equal(ganancias.get("b"), 0);
});

// El caso que existe por algo: un all-in corto no cubre las subidas, pero SI
// tiene derecho al bote principal. Es lo que una rama descartada rompia al
// filtrar la elegibilidad por `apostadoTotal === maxContribution` (ver #667).

test("un all-in corto cobra del bote principal aunque no cubra las subidas posteriores", () => {
  // c va all-in con 50 y tiene la mejor mano; a y b siguen subiendo por encima.
  const jugadores = [
    { userId: "a", apostadoTotal: 100, retirado: false },
    { userId: "b", apostadoTotal: 200, retirado: false },
    { userId: "c", apostadoTotal: 50, retirado: false },
  ];
  const evaluaciones = new Map([
    ["a", mano(1)],
    ["b", mano(2)],
    ["c", mano(3)],
  ]);

  const { ganancias } = repartirBotes(jugadores, evaluaciones);
  // c apostó 50 y se lleva 150: los 50 de cada uno de los tres. Que cobre MAS
  // de lo que puso es justamente el punto — lo contrario seria no tener botes
  // laterales.
  assert.equal(ganancias.get("c"), 150);
  // b gana las dos capas que c no pudo cubrir: 50x2 y 100x1.
  assert.equal(ganancias.get("b"), 200);
  assert.equal(ganancias.get("a"), 0);
  const apostado = jugadores.reduce((s, j) => s + j.apostadoTotal, 0);
  const repartido = [...ganancias.values()].reduce((s, v) => s + v, 0);
  assert.equal(repartido, apostado);
});

// El sobrante tiene que ser DETERMINISTA: 75 entre dos no es exacto, y la ficha
// que sobra va por orden de asiento, no al azar. Un reparto que la sortee da
// resultados distintos con las mismas cartas.

test("en un empate el sobrante de fichas impares va al asiento anterior, no al azar", () => {
  const jugadores = [
    { userId: "a", apostadoTotal: 25, retirado: false },
    { userId: "b", apostadoTotal: 25, retirado: false },
    { userId: "c", apostadoTotal: 25, retirado: false },
  ];
  const evaluaciones = new Map([
    ["a", mano(3)],
    ["b", mano(3)],
    ["c", mano(1)],
  ]);

  const { ganancias } = repartirBotes(jugadores, evaluaciones);
  // 75 entre dos: 37 cada uno y la ficha suelta al primer asiento.
  assert.equal(ganancias.get("a"), 38);
  assert.equal(ganancias.get("b"), 37);
  assert.equal(ganancias.get("c"), 0);
});


test("quien se retira no cobra, y lo que puso se queda en el bote", () => {
  const jugadores = [
    { userId: "a", apostadoTotal: 100, retirado: false },
    { userId: "b", apostadoTotal: 100, retirado: false },
    { userId: "c", apostadoTotal: 100, retirado: true },
  ];
  const evaluaciones = new Map([
    ["a", mano(2)],
    ["b", mano(1)],
  ]);

  const { ganancias } = repartirBotes(jugadores, evaluaciones);
  // 300 y no 200: las fichas de c ya estaban en el bote cuando se retiro, y
  // retirarse no las recupera. Es la mitad de la regla que se olvida.
  assert.equal(ganancias.get("a"), 300);
  assert.equal(ganancias.get("b"), 0);
  assert.equal(ganancias.get("c"), 0);
});

test("no se crean ni se pierden fichas: lo repartido cuadra con lo apostado", () => {
  const jugadores = [
    { userId: "a", apostadoTotal: 30, retirado: false },
    { userId: "b", apostadoTotal: 40, retirado: false },
    { userId: "c", apostadoTotal: 50, retirado: false },
  ];
  const evaluaciones = new Map([
    ["a", mano(2)],
    ["b", mano(3)],
    ["c", mano(1)],
  ]);

  const { ganancias } = repartirBotes(jugadores, evaluaciones);
  const totalBet = jugadores.reduce((s, j) => s + j.apostadoTotal, 0);
  const totalWin = Array.from(ganancias.values()).reduce((s, v) => s + v, 0);
  assert.equal(totalWin, totalBet);
});
