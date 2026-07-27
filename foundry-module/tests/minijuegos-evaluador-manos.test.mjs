import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluarMano,
  compararManos,
  CATEGORIAS,
} from "../scripts/minijuegos/evaluador-manos.mjs";

// Construye cartas a partir de códigos "As", "Td", "2c"… para vectores legibles.
const RANGO = { T: 10, J: 11, Q: 12, K: 13, A: 14 };
function carta(codigo) {
  const r = codigo.slice(0, -1);
  const palo = codigo.slice(-1);
  const valor = RANGO[r] ?? Number(r);
  return { valor, palo, codigo };
}
function mano(...codigos) {
  return evaluarMano(codigos.map(carta));
}

test("clasifica cada categoría con 7 cartas", () => {
  assert.equal(mano("As", "Ks", "Qs", "Js", "Ts", "2c", "3d").categoria, CATEGORIAS.ESCALERA_COLOR);
  assert.equal(mano("9h", "9d", "9s", "9c", "Kd", "2c", "3d").categoria, CATEGORIAS.POKER);
  assert.equal(mano("9h", "9d", "9s", "Kc", "Kd", "2c", "3d").categoria, CATEGORIAS.FULL);
  assert.equal(mano("2s", "5s", "7s", "9s", "Js", "Ac", "Kd").categoria, CATEGORIAS.COLOR);
  assert.equal(mano("5h", "6d", "7s", "8c", "9d", "2c", "Kd").categoria, CATEGORIAS.ESCALERA);
  assert.equal(mano("9h", "9d", "9s", "Kc", "Qd", "2c", "3d").categoria, CATEGORIAS.TRIO);
  assert.equal(mano("9h", "9d", "Ks", "Kc", "Qd", "2c", "3d").categoria, CATEGORIAS.DOBLE_PAREJA);
  assert.equal(mano("9h", "9d", "Ks", "5c", "Qd", "2c", "3d").categoria, CATEGORIAS.PAREJA);
  assert.equal(mano("9h", "7d", "Ks", "5c", "Qd", "2c", "3d").categoria, CATEGORIAS.CARTA_ALTA);
});

test("la rueda A-2-3-4-5 es escalera con 5 alto, no con As alto", () => {
  const rueda = mano("Ah", "2d", "3s", "4c", "5d", "Kd", "Qc");
  assert.equal(rueda.categoria, CATEGORIAS.ESCALERA);
  assert.deepEqual(rueda.desempate, [5]);
});

test("la escalera de color real supera a otra escalera de color menor", () => {
  const real = mano("As", "Ks", "Qs", "Js", "Ts", "2c", "3d");
  const menor = mano("9s", "8s", "7s", "6s", "5s", "2c", "3d");
  assert.equal(compararManos(real, menor), 1);
});

test("desempata por kicker cuando la categoría coincide", () => {
  const parAsK = mano("Ah", "Ad", "Ks", "9c", "4d", "2c", "3s");
  const parAsQ = mano("Ac", "As", "Qs", "9d", "4h", "2d", "3c");
  assert.equal(compararManos(parAsK, parAsQ), 1);
});

test("manos idénticas en valor empatan (bote dividido)", () => {
  const a = mano("Ah", "Ad", "Ks", "Qc", "Jd", "2c", "3s");
  const b = mano("Ac", "As", "Kd", "Qh", "Jc", "2d", "3c");
  assert.equal(compararManos(a, b), 0);
});

test("el full supera al color y el color a la escalera", () => {
  const full = mano("9h", "9d", "9s", "Kc", "Kd", "2c", "3d");
  const color = mano("2s", "5s", "7s", "9s", "Js", "Ac", "Kd");
  const escalera = mano("5h", "6d", "7s", "8c", "9d", "2c", "Kd");
  assert.equal(compararManos(full, color), 1);
  assert.equal(compararManos(color, escalera), 1);
});

test("exige al menos 5 cartas", () => {
  assert.throws(() => evaluarMano([carta("As"), carta("Ks")]), RangeError);
});
