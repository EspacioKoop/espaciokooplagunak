import assert from "node:assert/strict";
import test from "node:test";

import { crearRegistroJugadores } from "../scripts/nave-jugadores-red.mjs";

test("un jugador recién actualizado aparece en su estancia", () => {
  const registro = crearRegistroJugadores({ vencePasadoMs: 1000 });
  registro.actualizar("u1", { estancia: "cantina", x: 1, y: 0, z: 2, yaw: 0 }, 0);
  assert.deepEqual(registro.enEstancia("cantina", 0), [{ x: 1, y: 0, z: 2, yaw: 0 }]);
});

test("no aparece en una estancia distinta a la suya", () => {
  const registro = crearRegistroJugadores({ vencePasadoMs: 1000 });
  registro.actualizar("u1", { estancia: "a", x: 1, y: 0, z: 2, yaw: 0 }, 0);
  assert.deepEqual(registro.enEstancia("cantina", 0), []);
});

test("una muestra caducada deja de listarse: nunca se extrapola", () => {
  const registro = crearRegistroJugadores({ vencePasadoMs: 500 });
  registro.actualizar("u1", { estancia: "a", x: 1, y: 0, z: 2, yaw: 0 }, 0);
  assert.equal(registro.enEstancia("a", 400).length, 1, "todavía dentro de la ventana");
  assert.equal(registro.enEstancia("a", 600).length, 0, "ya caducada");
});

test("una muestra con campos no finitos se descarta entera", () => {
  const registro = crearRegistroJugadores();
  registro.actualizar("u1", { estancia: "a", x: NaN, y: 0, z: 2, yaw: 0 }, 0);
  assert.deepEqual(registro.enEstancia("a", 0), []);
});

test("sin estancia en el estado, se descarta", () => {
  const registro = crearRegistroJugadores();
  registro.actualizar("u1", { x: 1, y: 0, z: 2, yaw: 0 }, 0);
  assert.deepEqual(registro.enEstancia("a", 0), []);
});

test("quitar borra al jugador de inmediato, sin esperar a que caduque", () => {
  const registro = crearRegistroJugadores({ vencePasadoMs: 10000 });
  registro.actualizar("u1", { estancia: "a", x: 1, y: 0, z: 2, yaw: 0 }, 0);
  registro.quitar("u1");
  assert.deepEqual(registro.enEstancia("a", 0), []);
});

test("una actualización nueva sustituye a la anterior del mismo jugador", () => {
  const registro = crearRegistroJugadores({ vencePasadoMs: 1000 });
  registro.actualizar("u1", { estancia: "a", x: 1, y: 0, z: 2, yaw: 0 }, 0);
  registro.actualizar("u1", { estancia: "a", x: 5, y: 0, z: 5, yaw: 1 }, 100);
  assert.deepEqual(registro.enEstancia("a", 100), [{ x: 5, y: 0, z: 5, yaw: 1 }]);
});

test("varios jugadores en la misma estancia aparecen todos", () => {
  const registro = crearRegistroJugadores({ vencePasadoMs: 1000 });
  registro.actualizar("u1", { estancia: "a", x: 1, y: 0, z: 1, yaw: 0 }, 0);
  registro.actualizar("u2", { estancia: "a", x: 2, y: 0, z: 2, yaw: 0 }, 0);
  assert.equal(registro.enEstancia("a", 0).length, 2);
});
