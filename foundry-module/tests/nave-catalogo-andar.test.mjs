import assert from "node:assert/strict";
import test from "node:test";

import { colisiona, puertaTocada } from "../scripts/nave-movimiento.mjs";
import { puntoDeLlegada } from "../scripts/nave-estancias.mjs";
import { PLANTA_PRUEBA } from "../scripts/nave-movimiento-sala-prueba.mjs";
import { PLANTA_CANTINA } from "../scripts/cantina-planta.mjs";
import { CATALOGO_ANDAR } from "../scripts/nave-catalogo-andar.mjs";

test("CATALOGO_ANDAR conoce las tres estancias", () => {
  assert.deepEqual(CATALOGO_ANDAR.ids, ["a", "b", "cantina"]);
});

test("la sala 'a' tiene dos puertas: a 'b' y a la cantina", () => {
  const destinos = CATALOGO_ANDAR.obtener("a").puertas.map((p) => p.destino.estancia);
  assert.deepEqual(destinos.sort(), ["b", "cantina"]);
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
