// Puntos de anclaje de un avatar (#897).

import assert from "node:assert/strict";
import test from "node:test";

import { PUNTOS_ANCLA, anclasAvatar } from "../scripts/avatar-anclas.mjs";
import { piezasAvatar } from "../scripts/cantina-avatar.mjs";

test("declara los cuatro anclajes, cada uno con tres coordenadas", () => {
  const anclas = anclasAvatar({}, { pies: [0, 0, 0] });
  assert.equal(Object.keys(anclas).length, PUNTOS_ANCLA.length);
  for (const nombre of PUNTOS_ANCLA) {
    assert.ok(Array.isArray(anclas[nombre]), `falta el anclaje ${nombre}`);
    assert.equal(anclas[nombre].length, 3);
  }
});

test("los anclajes se mueven con los pies, no quedan fijos en el origen", () => {
  const enOrigen = anclasAvatar({}, { pies: [0, 0, 0] });
  const desplazado = anclasAvatar({}, { pies: [5, 0, -3] });
  assert.notEqual(enOrigen.manoDerecha[0], desplazado.manoDerecha[0]);
  assert.equal(desplazado.manoDerecha[0] - enOrigen.manoDerecha[0], 5);
});

test("una descripción rota da igualmente cuatro anclajes válidos", () => {
  const anclas = anclasAvatar({ raza: "no-existe" }, { pies: [0, 0, 0] });
  for (const nombre of PUNTOS_ANCLA) {
    assert.ok(anclas[nombre].every(Number.isFinite), `${nombre} no es un punto válido`);
  }
});

test("la raza cambia el anclaje igual que cambia el cuerpo", () => {
  const humano = anclasAvatar({ raza: "humano" }, { pies: [0, 0, 0] });
  const mediano = anclasAvatar({ raza: "mediano" }, { pies: [0, 0, 0] });
  assert.notEqual(humano.boca[1], mediano.boca[1], "un mediano no debería tener la boca a la misma altura");
});

test("el anclaje de boca coincide con la punta del cigarro que ya dibuja el avatar", () => {
  // No es casualidad: es la misma cuenta, extraída a un único sitio (#897).
  // Si un día divergen, el humo del cigarro (#439) dejaría de salir de la
  // brasa que se ve.
  const piezas = piezasAvatar({ gesto: "fumar" }, { pies: [1, 0, 2] });
  const brasa = piezas.find((p) => p.nombre.endsWith("Brasa"));
  const anclas = anclasAvatar({ gesto: "fumar" }, { pies: [1, 0, 2] });
  assert.deepEqual(brasa.centro, anclas.boca);
});
