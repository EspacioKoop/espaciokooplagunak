// Prueba de extremo a extremo (#508): desde la cantina se puede llegar
// andando a cualquier sala de la nave, cruzando puertas reales del catálogo
// (nave-catalogo-andar.mjs), sin colisionar ni quedarse atascado en ninguna.
//
// No comprueba GEOGRAFÍA (si "a" debería o no ser el nudo que reparte hacia
// el resto de la nave, en vez de una conexión directa desde la cantina) —
// esa es una decisión de diseño pendiente, no algo que un test deba fijar.
// Comprueba CONECTIVIDAD: que el grafo de estancias no deja ninguna sala
// real aislada de la cantina.

import assert from "node:assert/strict";
import test from "node:test";

import { colisiona } from "../scripts/nave-movimiento.mjs";
import { puntoDeLlegada } from "../scripts/nave-estancias.mjs";
import { CATALOGO_ANDAR } from "../scripts/nave-catalogo-andar.mjs";

/** BFS sobre el catálogo de estancias, siguiendo cada puerta como una arista
 *  no dirigida (cruzarla y volver es, en la práctica, cómo se navega). */
function alcanzables(catalogo, desde) {
  const visitadas = new Set([desde]);
  const cola = [desde];
  while (cola.length > 0) {
    const id = cola.shift();
    for (const puerta of catalogo.obtener(id).puertas) {
      const destino = puerta.destino.estancia;
      if (!visitadas.has(destino)) {
        visitadas.add(destino);
        cola.push(destino);
      }
    }
  }
  return visitadas;
}

test("desde la cantina se puede llegar a todas las estancias del catálogo", () => {
  const alcanzadas = alcanzables(CATALOGO_ANDAR, "cantina");
  assert.deepEqual([...alcanzadas].sort(), [...CATALOGO_ANDAR.ids].sort());
});

test("recorrido real cantina -> a -> pasillo del puente -> mando, cruzando cada puerta", () => {
  const pasos = [
    { desde: "cantina", hacia: "a" },
    { desde: "a", hacia: "pasillo-puente" },
    { desde: "pasillo-puente", hacia: "mando" },
  ];
  let posicion = null;
  for (const { desde, hacia } of pasos) {
    const puerta = CATALOGO_ANDAR.obtener(desde).puertas.find((p) => p.destino.estancia === hacia);
    assert.ok(puerta, `falta una puerta de ${desde} a ${hacia}`);
    const llegada = puntoDeLlegada(CATALOGO_ANDAR, puerta.destino);
    assert.equal(llegada.estancia, hacia);
    assert.equal(colisiona(llegada.x, llegada.z, 0.35, llegada.planta), false, `colisiona al llegar a ${hacia}`);
    posicion = llegada;
  }
  assert.equal(posicion.estancia, "mando");
});

test("ninguna sala real queda a más de dos puertas de la cantina", () => {
  // No es un límite arbitrario: hoy el camino más largo (cantina -> a ->
  // pasillo -> estación) tiene tres tramos. Si algún día se sube por encima
  // de eso sin querer (una sala colgada de otra sala en vez del pasillo),
  // este test avisa antes que un jugador perdido.
  const distancias = new Map([["cantina", 0]]);
  const cola = ["cantina"];
  while (cola.length > 0) {
    const id = cola.shift();
    const base = distancias.get(id);
    for (const puerta of CATALOGO_ANDAR.obtener(id).puertas) {
      const destino = puerta.destino.estancia;
      if (!distancias.has(destino)) {
        distancias.set(destino, base + 1);
        cola.push(destino);
      }
    }
  }
  for (const id of CATALOGO_ANDAR.ids) {
    assert.ok(distancias.get(id) <= 3, `${id} está a ${distancias.get(id)} puertas de la cantina`);
  }
});
