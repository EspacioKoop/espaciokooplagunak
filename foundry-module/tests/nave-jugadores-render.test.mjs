import assert from "node:assert/strict";
import test from "node:test";

import { componerConJugadores } from "../scripts/nave-jugadores-render.mjs";

const ESCENA_BASE = { ancho: 100, alto: 100, epoca: "psx", poligonos: [{ puntos: [], color: "#000000", profundidad: 5, niebla: 0 }] };

test("sin jugadores, la escena de la sala sale sin tocar", () => {
  const componer = componerConJugadores(
    () => ESCENA_BASE,
    () => [],
  );
  const escena = componer(0, 0, 0, 0);
  assert.equal(escena, ESCENA_BASE);
});

test("con un jugador presente, se añaden polígonos a la escena", () => {
  const componer = componerConJugadores(
    () => ESCENA_BASE,
    () => [{ x: 2, y: 0, z: 2, yaw: 0 }],
    { ahora: () => 0 },
  );
  const escena = componer(0, 0, 0, 0);
  assert.ok(escena.poligonos.length > ESCENA_BASE.poligonos.length);
  assert.equal(escena.ancho, ESCENA_BASE.ancho);
  assert.equal(escena.epoca, ESCENA_BASE.epoca);
});

test("la escena resultante sigue ordenada por profundidad descendente", () => {
  const componer = componerConJugadores(
    () => ESCENA_BASE,
    () => [
      { x: 2, y: 0, z: 2, yaw: 0 },
      { x: -2, y: 0, z: -2, yaw: Math.PI },
    ],
    { ahora: () => 0 },
  );
  const escena = componer(0, 0, 0, 0);
  for (let i = 1; i < escena.poligonos.length; i += 1) {
    assert.ok(escena.poligonos[i - 1].profundidad >= escena.poligonos[i].profundidad);
  }
});
