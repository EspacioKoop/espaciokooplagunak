import assert from "node:assert/strict";
import test from "node:test";

import {
  crearAleatorio,
  normalizarSemilla,
  mezclar,
} from "../scripts/minijuegos/aleatorio.mjs";

test("la misma semilla produce exactamente la misma secuencia", () => {
  const a = crearAleatorio(12345);
  const b = crearAleatorio(12345);
  const seqA = Array.from({ length: 10 }, () => a.siguiente());
  const seqB = Array.from({ length: 10 }, () => b.siguiente());
  assert.deepEqual(seqA, seqB);
});

test("semillas distintas divergen", () => {
  const a = crearAleatorio(1);
  const b = crearAleatorio(2);
  assert.notEqual(a.siguiente(), b.siguiente());
});

test("siguiente() está en [0, 1)", () => {
  const r = crearAleatorio("sesion-x");
  for (let i = 0; i < 1000; i += 1) {
    const v = r.siguiente();
    assert.ok(v >= 0 && v < 1);
  }
});

test("enteroEntre respeta límites inclusive y valida el rango", () => {
  const r = crearAleatorio(99);
  for (let i = 0; i < 500; i += 1) {
    const v = r.enteroEntre(3, 7);
    assert.ok(v >= 3 && v <= 7 && Number.isInteger(v));
  }
  assert.throws(() => r.enteroEntre(5, 4), RangeError);
});

test("exportar/importar estado reanuda la misma secuencia", () => {
  const r = crearAleatorio(7);
  r.siguiente();
  r.siguiente();
  const snapshot = r.exportarEstado();
  const esperado = [r.siguiente(), r.siguiente(), r.siguiente()];

  const r2 = crearAleatorio(0);
  r2.importarEstado(snapshot);
  const obtenido = [r2.siguiente(), r2.siguiente(), r2.siguiente()];
  assert.deepEqual(obtenido, esperado);
});

test("normalizarSemilla es estable y evita el cero", () => {
  assert.equal(normalizarSemilla("abc"), normalizarSemilla("abc"));
  assert.equal(normalizarSemilla(0), 1);
  assert.notEqual(normalizarSemilla("abc"), normalizarSemilla("abd"));
});

test("mezclar no muta la entrada y es determinista por semilla", () => {
  const base = [1, 2, 3, 4, 5, 6, 7, 8];
  const m1 = mezclar(base, crearAleatorio(42));
  const m2 = mezclar(base, crearAleatorio(42));
  assert.deepEqual(base, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(m1, m2);
  assert.deepEqual([...m1].sort((a, b) => a - b), base);
});
