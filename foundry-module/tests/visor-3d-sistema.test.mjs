import assert from "node:assert/strict";
import test from "node:test";

import {
  RADIO_ESTRELLA,
  anilloActivo,
  cuerpoMasCercanoAlRayo,
  normalizar,
  ordenarCuerpos,
  posicionOrbita,
  radioVisual,
} from "../standalone/visor-3d-sistema/logica.mjs";

test("normalizar devuelve el vector unitario y deja el nulo en cero", () => {
  assert.deepEqual(normalizar({ x: 0, y: 3, z: 4 }), { x: 0, y: 0.6, z: 0.8 });
  assert.deepEqual(normalizar({ x: 0, y: 0, z: 0 }), { x: 0, y: 0, z: 0 });
  // Idempotente: normalizar dos veces es igual que una.
  const v = { x: 1, y: -2, z: 2 };
  assert.deepEqual(normalizar(normalizar(v)), normalizar(v));
});

test("ordenarCuerpos pone la estrella primero y luego por semieje ascendente", () => {
  const cuerpos = [
    { id: "p7", tipo: "planeta", orbita: { semiEje: 7 } },
    { id: "sol", tipo: "estrella", orbita: { semiEje: 0 } },
    { id: "p3", tipo: "planeta", orbita: { semiEje: 3 } },
  ];
  assert.deepEqual(
    ordenarCuerpos(cuerpos).map((c) => c.id),
    ["sol", "p3", "p7"],
  );
});

test("posicionOrbita en t=0 coincide con la fase y la estrella se queda en el origen", () => {
  const planeta = { tipo: "planeta", orbita: { semiEje: 4, velocidadAngular: 0.3, fase: 1.2, inclinacion: 0.1 } };
  const p0 = posicionOrbita(planeta, 0);
  assert.ok(Math.abs(p0.x - 4 * Math.cos(1.2)) < 1e-9);
  assert.ok(Math.abs(p0.z - 4 * Math.sin(1.2) * Math.cos(0.1)) < 1e-9);

  const estrella = { tipo: "estrella", orbita: { semiEje: 0, velocidadAngular: 0, fase: 0, inclinacion: 0 } };
  assert.deepEqual(posicionOrbita(estrella, 123), { x: 0, y: 0, z: 0 });
});

test("posicionOrbita es periódica con el periodo 2π/velocidadAngular", () => {
  const c = { tipo: "planeta", orbita: { semiEje: 5, velocidadAngular: 0.5, fase: 0.3, inclinacion: 0.2 } };
  const t = 1.7;
  const periodo = (2 * Math.PI) / 0.5;
  const a = posicionOrbita(c, t);
  const b = posicionOrbita(c, t + periodo);
  assert.ok(Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.z - b.z) < 1e-9 && Math.abs(a.y - b.y) < 1e-9);
});

test("radioVisual: la estrella siempre supera a cualquier planeta y crece con radioRelativo", () => {
  const sol = { tipo: "estrella", radioRelativo: 8 };
  const pequeno = { tipo: "planeta", radioRelativo: 0.5 };
  const grande = { tipo: "planeta", radioRelativo: 3 };
  assert.ok(radioVisual(sol) > radioVisual(grande));
  assert.ok(radioVisual(grande) > radioVisual(pequeno));
  assert.ok(radioVisual(sol) === RADIO_ESTRELLA);
  assert.ok(radioVisual(pequeno) > 0);
});

test("anilloActivo: true solo en planetas con la bandera, nunca en la estrella", () => {
  assert.equal(anilloActivo({ tipo: "estrella" }), false);
  assert.equal(anilloActivo({ tipo: "planeta", anillo: false }), false);
  assert.equal(anilloActivo({ tipo: "planeta", anillo: true }), true);
});

test("cuerpoMasCercanoAlRayo elige el cuerpo delante de la cámara más próximo al rayo", () => {
  const cuerpos = [{ id: "A" }, { id: "B" }, { id: "C" }, { id: "D" }];
  const posiciones = [
    { x: 0, y: 0, z: 3 }, // A: sobre el rayo, dist 0
    { x: 5, y: 0, z: 5 }, // B: desviado, dist 5
    { x: 1, y: 0, z: 8 }, // C: desviado, dist 1
    { x: 0, y: 0, z: -2 }, // D: detrás, se ignora
  ];
  const r = cuerpoMasCercanoAlRayo(cuerpos, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, posiciones);
  assert.equal(r.indice, 0, "elige A, que está sobre el rayo");
  assert.ok(r.distancia < 1e-9, "distancia ~0 al estar centrado");
});

test("cuerpoMasCercanoAlRayo ignora los cuerpos por detrás del origen", () => {
  const cuerpos = [{ id: "X" }, { id: "Y" }];
  const posiciones = [
    { x: 0, y: 0, z: -5 }, // detrás: t negativo
    { x: 0, y: 0, z: 6 }, // delante, sobre el rayo
  ];
  const r = cuerpoMasCercanoAlRayo(cuerpos, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, posiciones);
  assert.equal(r.indice, 1, "elige el único cuerpo delante");
});

test("cuerpoMasCercanoAlRayo desempata por índice menor", () => {
  const cuerpos = [{ id: "X" }, { id: "Y" }];
  const posiciones = [
    { x: 3, y: 0, z: 4 }, // dist perpendicular 3
    { x: -3, y: 0, z: 4 }, // dist perpendicular 3 (empate)
  ];
  const r = cuerpoMasCercanoAlRayo(cuerpos, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, posiciones);
  assert.equal(r.indice, 0, "ante empate gana el de menor índice");
  assert.ok(Math.abs(r.distancia - 3) < 1e-9);
});
