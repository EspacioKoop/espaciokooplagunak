import assert from "node:assert/strict";
import test from "node:test";

import { colisiona, puertaTocada } from "../scripts/nave-movimiento.mjs";
import { puntoDeLlegada } from "../scripts/nave-estancias.mjs";
import { CATALOGO_ANDAR } from "../scripts/nave-catalogo-andar.mjs";

const ESTACIONES = ["mando", "navegacion", "sensores", "comunicaciones", "armas"];

test("CATALOGO_ANDAR conoce las nueve estancias, sin 'a' ni 'b' (banco de pruebas aparte)", () => {
  assert.deepEqual(CATALOGO_ANDAR.ids, ["cantina", "vestibulo", "ingenieria", "pasillo-puente", ...ESTACIONES]);
});

test("la cantina tiene una única puerta, al vestíbulo", () => {
  const destinos = CATALOGO_ANDAR.obtener("cantina").puertas.map((p) => p.destino.estancia);
  assert.deepEqual(destinos, ["vestibulo"]);
});

test("el vestíbulo tiene tres puertas: cantina, ingeniería y el pasillo del puente", () => {
  const destinos = CATALOGO_ANDAR.obtener("vestibulo").puertas.map((p) => p.destino.estancia);
  assert.deepEqual(destinos.sort(), ["cantina", "ingenieria", "pasillo-puente"]);
});

test("el pasillo del puente tiene una puerta al vestíbulo y una por cada una de las cinco estaciones", () => {
  const destinos = CATALOGO_ANDAR.obtener("pasillo-puente").puertas.map((p) => p.destino.estancia);
  assert.deepEqual(destinos.sort(), [...ESTACIONES, "vestibulo"].sort());
});

/** Cruza una puerta desde `desde` hasta `hacia` y comprueba que se llega sin
 *  colisionar y sin reactivar la propia puerta de vuelta. */
function cruzar(desde, hacia) {
  const puerta = CATALOGO_ANDAR.obtener(desde).puertas.find((p) => p.destino.estancia === hacia);
  assert.ok(puerta, `falta una puerta de ${desde} a ${hacia}`);
  const llegada = puntoDeLlegada(CATALOGO_ANDAR, puerta.destino);
  assert.equal(llegada.estancia, hacia);
  assert.equal(colisiona(llegada.x, llegada.z, 0.35, llegada.planta), false, `colisiona al llegar a ${hacia}`);

  const puertaDeVuelta = CATALOGO_ANDAR.obtener(hacia).puertas.find((p) => p.destino.estancia === desde);
  if (puertaDeVuelta) {
    assert.equal(
      puertaTocada(llegada.x, llegada.z, 0.35, [puertaDeVuelta]),
      null,
      `reactiva la puerta de ${hacia} a ${desde} al llegar`,
    );
  }
  return llegada;
}

test("se puede ir y volver entre la cantina y el vestíbulo", () => {
  cruzar("cantina", "vestibulo");
  cruzar("vestibulo", "cantina");
});

test("se puede ir y volver entre el vestíbulo e ingeniería", () => {
  cruzar("vestibulo", "ingenieria");
  cruzar("ingenieria", "vestibulo");
});

test("se puede ir y volver entre el vestíbulo y el pasillo del puente", () => {
  cruzar("vestibulo", "pasillo-puente");
  cruzar("pasillo-puente", "vestibulo");
});

test("se puede ir y volver entre el pasillo del puente y cada sala de estación", () => {
  for (const id of ESTACIONES) {
    cruzar("pasillo-puente", id);
    cruzar(id, "pasillo-puente");
  }
});
