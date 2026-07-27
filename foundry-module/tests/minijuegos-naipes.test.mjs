import assert from "node:assert/strict";
import test from "node:test";

import {
  barajaOrdenada,
  barajaMezclada,
  repartir,
  codigoCarta,
  interpretarCodigo,
  PALOS,
} from "../scripts/minijuegos/naipes.mjs";
import { crearAleatorio } from "../scripts/minijuegos/aleatorio.mjs";

test("la baraja ordenada tiene 52 cartas únicas", () => {
  const baraja = barajaOrdenada();
  assert.equal(baraja.length, 52);
  const codigos = new Set(baraja.map((c) => c.codigo));
  assert.equal(codigos.size, 52);
  assert.equal(PALOS.length, 4);
});

test("las cartas exponen valor numérico y código estable", () => {
  assert.equal(codigoCarta(14, "s"), "As");
  assert.equal(codigoCarta(10, "d"), "Td");
  const baraja = barajaOrdenada();
  for (const carta of baraja) {
    assert.ok(carta.valor >= 2 && carta.valor <= 14);
    assert.equal(Object.isFrozen(carta), true);
  }
});

test("barajaMezclada es determinista por semilla y conserva las 52", () => {
  const a = barajaMezclada(2026).map((c) => c.codigo);
  const b = barajaMezclada(2026).map((c) => c.codigo);
  assert.deepEqual(a, b);
  assert.equal(new Set(a).size, 52);
  // Con una semilla distinta el orden cambia.
  const c = barajaMezclada(2027).map((c) => c.codigo);
  assert.notDeepEqual(a, c);
});

test("barajaMezclada acepta un generador ya existente", () => {
  const gen = crearAleatorio(5);
  const baraja = barajaMezclada(gen);
  assert.equal(baraja.length, 52);
});

test("repartir no muta el mazo y separa repartidas/resto", () => {
  const mazo = barajaOrdenada();
  const { repartidas, resto } = repartir(mazo, 5);
  assert.equal(repartidas.length, 5);
  assert.equal(resto.length, 47);
  assert.equal(mazo.length, 52);
  assert.deepEqual(repartidas, mazo.slice(0, 5));
});

test("repartir falla si no hay cartas suficientes", () => {
  assert.throws(() => repartir(barajaOrdenada(), 53), RangeError);
  assert.throws(() => repartir(barajaOrdenada(), -1), RangeError);
});

test("interpretarCodigo es la inversa exacta de codigoCarta en las 52 cartas", () => {
  for (const carta of barajaOrdenada()) {
    assert.deepEqual(interpretarCodigo(carta.codigo), { valor: carta.valor, palo: carta.palo });
  }
});

test("interpretarCodigo falla cerrado ante cualquier otra forma", () => {
  // El par valor+palo en crudo ("14s", "10s") no es un código de carta.
  for (const malo of ["14s", "10s", "1c", "15s", "Tx", "as", "AS", "T", "", "Ts ", null, 7]) {
    assert.throws(() => interpretarCodigo(malo), RangeError, `esperaba rechazo de ${malo}`);
  }
});
