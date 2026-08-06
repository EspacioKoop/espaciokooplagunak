import assert from "node:assert/strict";
import test from "node:test";

import { colisiona, puertaTocada } from "../scripts/nave-movimiento.mjs";
import { puntoDeLlegada } from "../scripts/nave-estancias.mjs";
import { PLANTA_PRUEBA } from "../scripts/nave-movimiento-sala-prueba.mjs";
import { PLANTA_CANTINA } from "../scripts/cantina-planta.mjs";
import { CATALOGO_ANDAR } from "../scripts/nave-catalogo-andar.mjs";

test("CATALOGO_ANDAR conoce las diez estancias", () => {
  assert.deepEqual(CATALOGO_ANDAR.ids, [
    "a",
    "b",
    "cantina",
    "ingenieria",
    "pasillo-puente",
    "mando",
    "navegacion",
    "sensores",
    "comunicaciones",
    "armas",
  ]);
});

test("la sala 'a' tiene cuatro puertas: a 'b', a la cantina, a ingeniería y al pasillo del puente", () => {
  const destinos = CATALOGO_ANDAR.obtener("a").puertas.map((p) => p.destino.estancia);
  assert.deepEqual(destinos.sort(), ["b", "cantina", "ingenieria", "pasillo-puente"]);
});

test("el pasillo del puente tiene una puerta a 'a' y una por cada una de las cinco estaciones", () => {
  const destinos = CATALOGO_ANDAR.obtener("pasillo-puente").puertas.map((p) => p.destino.estancia);
  assert.deepEqual(destinos.sort(), ["a", "armas", "comunicaciones", "mando", "navegacion", "sensores"]);
});

test("se puede ir y volver entre 'a' y el pasillo del puente sin colisionar ni reactivar la puerta", () => {
  const puerta = CATALOGO_ANDAR.obtener("a").puertas.find((p) => p.destino.estancia === "pasillo-puente");
  const llegada = puntoDeLlegada(CATALOGO_ANDAR, puerta.destino);
  assert.equal(llegada.estancia, "pasillo-puente");
  assert.equal(colisiona(llegada.x, llegada.z, 0.35, llegada.planta), false);

  const puertaDeVuelta = CATALOGO_ANDAR.obtener("pasillo-puente").puertas.find((p) => p.destino.estancia === "a");
  assert.equal(puertaTocada(llegada.x, llegada.z, 0.35, [puertaDeVuelta]), null);

  const vuelta = puntoDeLlegada(CATALOGO_ANDAR, puertaDeVuelta.destino);
  assert.equal(vuelta.estancia, "a");
  assert.equal(colisiona(vuelta.x, vuelta.z, 0.35, vuelta.planta), false);
});

test("se puede ir y volver entre el pasillo del puente y cada sala de estación", () => {
  for (const id of ["mando", "navegacion", "sensores", "comunicaciones", "armas"]) {
    const puerta = CATALOGO_ANDAR.obtener("pasillo-puente").puertas.find((p) => p.destino.estancia === id);
    const llegada = puntoDeLlegada(CATALOGO_ANDAR, puerta.destino);
    assert.equal(llegada.estancia, id);
    assert.equal(colisiona(llegada.x, llegada.z, 0.35, llegada.planta), false, `${id}: colisiona al llegar`);

    const puertaDeVuelta = CATALOGO_ANDAR.obtener(id).puertas[0];
    assert.equal(puertaTocada(llegada.x, llegada.z, 0.35, [puertaDeVuelta]), null, `${id}: reactiva su puerta`);

    const vuelta = puntoDeLlegada(CATALOGO_ANDAR, puertaDeVuelta.destino);
    assert.equal(vuelta.estancia, "pasillo-puente");
    assert.equal(colisiona(vuelta.x, vuelta.z, 0.35, vuelta.planta), false, `${id}: colisiona al volver`);
  }
});

test("cruzar de 'a' a ingeniería no colisiona con nada al llegar, y se puede volver", () => {
  const puerta = CATALOGO_ANDAR.obtener("a").puertas.find((p) => p.destino.estancia === "ingenieria");
  const llegada = puntoDeLlegada(CATALOGO_ANDAR, puerta.destino);
  assert.equal(llegada.estancia, "ingenieria");
  assert.equal(colisiona(llegada.x, llegada.z, 0.35, llegada.planta), false);

  const puertaDeVuelta = CATALOGO_ANDAR.obtener("ingenieria").puertas[0];
  assert.equal(puertaTocada(llegada.x, llegada.z, 0.35, [puertaDeVuelta]), null);

  const vuelta = puntoDeLlegada(CATALOGO_ANDAR, puertaDeVuelta.destino);
  assert.equal(vuelta.estancia, "a");
  assert.equal(colisiona(vuelta.x, vuelta.z, 0.35, vuelta.planta), false);
});

test("cruzar de 'a' a la cantina no colisiona con nada al llegar", () => {
  const puerta = CATALOGO_ANDAR.obtener("a").puertas.find((p) => p.destino.estancia === "cantina");
  const llegada = puntoDeLlegada(CATALOGO_ANDAR, puerta.destino);
  assert.equal(llegada.estancia, "cantina");
  assert.equal(colisiona(llegada.x, llegada.z, 0.35, PLANTA_CANTINA), false);
});

test("al llegar a la cantina no se reactiva enseguida su propia puerta de vuelta", () => {
  const puerta = CATALOGO_ANDAR.obtener("a").puertas.find((p) => p.destino.estancia === "cantina");
  const llegada = puntoDeLlegada(CATALOGO_ANDAR, puerta.destino);
  const puertaDeVuelta = CATALOGO_ANDAR.obtener("cantina").puertas[0];
  assert.equal(puertaTocada(llegada.x, llegada.z, 0.35, [puertaDeVuelta]), null);
});

test("cruzar de la cantina de vuelta a 'a' tampoco colisiona ni reactiva su puerta", () => {
  const puertaDeVuelta = CATALOGO_ANDAR.obtener("cantina").puertas[0];
  const llegada = puntoDeLlegada(CATALOGO_ANDAR, puertaDeVuelta.destino);
  assert.equal(llegada.estancia, "a");
  assert.equal(colisiona(llegada.x, llegada.z, 0.35, PLANTA_PRUEBA), false);
  const puertaHaciaCantina = CATALOGO_ANDAR
    .obtener("a")
    .puertas.find((p) => p.destino.estancia === "cantina");
  assert.equal(puertaTocada(llegada.x, llegada.z, 0.35, [puertaHaciaCantina]), null);
});

test("la puerta hacia la cantina no se solapa con la puerta hacia 'b' en la misma sala", () => {
  const [puertaB, puertaCantina] = ["b", "cantina"].map((id) =>
    CATALOGO_ANDAR.obtener("a").puertas.find((p) => p.destino.estancia === id),
  );
  // Cada rectángulo, evaluado contra la posición del otro, no debe tocarlo:
  // dos puertas que se solapasen dejarían ambigua cuál se cruza.
  const centro = (rect) => ({ x: rect.x + rect.ancho / 2, z: rect.z + rect.profundidad / 2 });
  const centroB = centro(puertaB.rect);
  assert.equal(puertaTocada(centroB.x, centroB.z, 0.1, [puertaCantina]), null);
});
