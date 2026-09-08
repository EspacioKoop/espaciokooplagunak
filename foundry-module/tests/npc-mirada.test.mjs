import assert from "node:assert/strict";
import test from "node:test";

import {
  POLITICAS_MIRADA,
  calcularVectorMirada,
  resolverMirada,
  resolverObjetivoMirada,
} from "../scripts/npc-mirada.mjs";

const casiIgual = (actual, esperado, epsilon = 1e-10) => {
  assert.equal(actual.length, esperado.length);
  actual.forEach((valor, indice) => {
    assert.ok(Math.abs(valor - esperado[indice]) <= epsilon,
      `${actual} no coincide con ${esperado}`);
  });
};

const modulo = ([x, y, z]) => Math.hypot(x, y, z);
const angulo = (a, b) => {
  const producto = a.reduce((suma, valor, indice) => suma + valor * b[indice], 0);
  return Math.acos(Math.max(-1, Math.min(1, producto / (modulo(a) * modulo(b)))));
};

test("un objetivo dentro del cono conserva su dirección y acota el alcance", () => {
  casiIgual(calcularVectorMirada({
    personaje: [1, 2, 3],
    objetivo: [4, 2, 7],
    frente: [0, 0, 1],
    semiangulo: Math.PI / 3,
    alcance: 2,
  }), [1.2, 0, 1.6]);
});

test("un objetivo fuera del cono queda exactamente en su borde", () => {
  const semiangulo = Math.PI / 6;
  const mirada = calcularVectorMirada({
    personaje: [0, 0, 0],
    objetivo: [10, 0, 0],
    frente: [0, 0, 1],
    semiangulo,
    alcance: 1,
  });

  assert.ok(Math.abs(angulo(mirada, [0, 0, 1]) - semiangulo) <= 1e-10);
  assert.ok(Math.abs(modulo(mirada) - 1) <= 1e-10);
});

test("el límite opuesto del cono elige un borde estable", () => {
  const entrada = {
    personaje: [0, 0, 0],
    objetivo: [0, 0, -8],
    frente: [0, 0, 1],
    semiangulo: Math.PI / 4,
    alcance: 3,
  };
  const primera = calcularVectorMirada(entrada);
  const segunda = calcularVectorMirada(entrada);

  assert.deepEqual(primera, segunda);
  assert.ok(Math.abs(angulo(primera, entrada.frente) - entrada.semiangulo) <= 1e-10);
  assert.ok(Math.abs(modulo(primera) - entrada.alcance) <= 1e-10);
});

test("personaje y objetivo coincidentes producen mirada neutra", () => {
  assert.deepEqual(calcularVectorMirada({
    personaje: [2, -1, 5],
    objetivo: [2, -1, 5],
  }), [0, 0, 0]);
});

test("una resta desbordada entre coordenadas finitas se rechaza", () => {
  assert.throws(() => calcularVectorMirada({
    personaje: [Number.MAX_VALUE, 0, 0],
    objetivo: [-Number.MAX_VALUE, 0, 0],
  }), { name: "TypeError" });
});

test("una distancia desbordada entre coordenadas finitas se rechaza", () => {
  assert.throws(() => calcularVectorMirada({
    personaje: [0, 0, 0],
    objetivo: [Number.MAX_VALUE, Number.MAX_VALUE, 0],
  }), { name: "TypeError" });
});

test("una magnitud frontal desbordada se rechaza", () => {
  assert.throws(() => calcularVectorMirada({
    personaje: [0, 0, 0],
    objetivo: [0, 0, 1],
    frente: [Number.MAX_VALUE, Number.MAX_VALUE, 0],
  }), { name: "TypeError" });
});

test("una mirada extrema válida solo contiene componentes finitos", () => {
  const mirada = calcularVectorMirada({
    personaje: [Number.MAX_VALUE, 0, 0],
    objetivo: [0, 0, 0],
    alcance: Number.MAX_VALUE,
  });
  assert.ok(mirada.every(Number.isFinite));
});

test("las seis políticas están declaradas por nombre", () => {
  assert.deepEqual(Object.keys(POLITICAS_MIRADA).sort(), [
    "alarma",
    "contagio",
    "evitar",
    "jugador",
    "ronda-interes",
    "tarea",
  ]);
  assert.ok(Object.isFrozen(POLITICAS_MIRADA));
});

test("cada estrategia selecciona su objetivo determinista", () => {
  const personaje = [1, 0, 1];
  const contexto = {
    personaje,
    objetivoTarea: [2, 0, 1],
    puntosInteres: [[3, 0, 1], [4, 0, 1]],
    pasoInteres: 3,
    objetivoContagio: [5, 0, 1],
    posicionJugador: [6, 0, 1],
    objetivoEvitar: [2, 0, 1],
    objetivoAlarma: [7, 0, 1],
  };

  assert.deepEqual(resolverObjetivoMirada({ politica: "tarea", contexto }), [2, 0, 1]);
  assert.deepEqual(resolverObjetivoMirada({ politica: "ronda-interes", contexto }), [4, 0, 1]);
  assert.deepEqual(resolverObjetivoMirada({ politica: "contagio", contexto }), [5, 0, 1]);
  assert.deepEqual(resolverObjetivoMirada({ politica: "jugador", contexto }), [6, 0, 1]);
  assert.deepEqual(resolverObjetivoMirada({ politica: "evitar", contexto }), [0, 0, 1]);
  assert.deepEqual(resolverObjetivoMirada({ politica: "alarma", contexto }), [7, 0, 1]);
});

test("la alarma activa prevalece sobre cualquier política", () => {
  const contexto = {
    personaje: [0, 0, 0],
    objetivoTarea: [1, 0, 0],
    objetivoAlarma: [0, 1, 0],
    alarmaActiva: true,
  };

  assert.deepEqual(resolverObjetivoMirada({ politica: "tarea", contexto }), [0, 1, 0]);
  assert.deepEqual(resolverMirada({ politica: "tarea", contexto }), [0, 1, 0]);
});

test("resolverMirada compone política y cono sin mutar entradas", () => {
  const contexto = {
    personaje: [0, 0, 0],
    posicionJugador: [4, 0, 0],
  };
  const limites = {
    frente: [0, 0, 1],
    semiangulo: Math.PI / 6,
    alcance: 0.5,
  };
  const copia = structuredClone({ contexto, limites });
  const mirada = resolverMirada({ politica: "jugador", contexto, limites });

  assert.deepEqual({ contexto, limites }, copia);
  assert.ok(Math.abs(angulo(mirada, limites.frente) - limites.semiangulo) <= 1e-10);
  assert.ok(Math.abs(modulo(mirada) - limites.alcance) <= 1e-10);
});

test("la ronda de interés no altera su lista y envuelve pasos", () => {
  const puntosInteres = [[1, 0, 0], [2, 0, 0], [3, 0, 0]];
  const copia = structuredClone(puntosInteres);

  assert.deepEqual(resolverObjetivoMirada({
    politica: "ronda-interes",
    contexto: { personaje: [0, 0, 0], puntosInteres, pasoInteres: 7 },
  }), [2, 0, 0]);
  assert.deepEqual(puntosInteres, copia);
});

test("posiciones y límites inválidos se rechazan fail-closed", () => {
  const base = { personaje: [0, 0, 0], objetivo: [0, 0, 1] };
  for (const entrada of [
    { ...base, personaje: null },
    { ...base, objetivo: [0, 1] },
    { ...base, objetivo: [0, Number.NaN, 1] },
    { ...base, frente: [0, 0, 0] },
    { ...base, semiangulo: -0.1 },
    { ...base, semiangulo: Math.PI + 0.1 },
    { ...base, alcance: 0 },
  ]) {
    assert.throws(() => calcularVectorMirada(entrada), { name: "TypeError" });
  }
});

test("políticas y contextos inválidos no eligen un objetivo por defecto", () => {
  assert.throws(() => resolverObjetivoMirada({
    politica: "desconocida",
    contexto: { personaje: [0, 0, 0] },
  }), { name: "RangeError" });
  assert.throws(() => resolverObjetivoMirada({
    politica: "constructor",
    contexto: { personaje: [0, 0, 0] },
  }), { name: "RangeError" });
  assert.throws(() => resolverObjetivoMirada({
    politica: "tarea",
    contexto: { personaje: [0, 0, 0] },
  }), { name: "TypeError" });
  assert.throws(() => resolverObjetivoMirada({
    politica: "ronda-interes",
    contexto: { personaje: [0, 0, 0], puntosInteres: [], pasoInteres: 0 },
  }), { name: "TypeError" });
  assert.throws(() => resolverObjetivoMirada({
    politica: "tarea",
    contexto: { personaje: [0, 0, 0], objetivoTarea: [1, 0, 0], alarmaActiva: true },
  }), { name: "TypeError" });
});

test("los límites no pueden sustituir personaje ni objetivo de la política", () => {
  assert.throws(() => resolverMirada({
    politica: "tarea",
    contexto: { personaje: [0, 0, 0], objetivoTarea: [0, 0, 2] },
    limites: { personaje: [9, 9, 9] },
  }), { name: "TypeError" });
  assert.throws(() => resolverMirada({
    politica: "tarea",
    contexto: { personaje: [0, 0, 0], objetivoTarea: [0, 0, 2] },
    limites: { objetivo: [9, 9, 9] },
  }), { name: "TypeError" });
});
