import assert from "node:assert/strict";
import test from "node:test";

import {
  REJILLA,
  SALAS,
  componerSeccion,
  salaDePuesto,
  salaEnCelda,
  salaPorId,
  salasSeccion,
  sistemasDeSala,
  tripulacionPorSala,
} from "../scripts/seccion-nave.mjs";
import { CATALOGO_ANDAR } from "../scripts/nave-catalogo-andar.mjs";

test("la planta cabe dentro de la rejilla y ninguna sala pisa a otra", () => {
  // Una sección con salas solapadas no es un plano, es un error de dibujo que
  // además haría que un clic abriera una sala distinta de la que se ve.
  const ocupadas = new Set();
  for (const sala of SALAS) {
    const { x, y, ancho, alto } = sala.caja;
    assert.ok(x >= 0 && y >= 0, `${sala.id} empieza fuera de la rejilla`);
    assert.ok(x + ancho <= REJILLA.columnas, `${sala.id} se sale por la derecha`);
    assert.ok(y + alto <= REJILLA.filas, `${sala.id} se sale por abajo`);
    for (let i = x; i < x + ancho; i += 1) {
      for (let j = y; j < y + alto; j += 1) {
        const celda = `${i},${j}`;
        assert.ok(!ocupadas.has(celda), `${sala.id} pisa otra sala en ${celda}`);
        ocupadas.add(celda);
      }
    }
  }
});

test("cada sala se puede nombrar y las entrables dicen adónde llevan", () => {
  for (const sala of salasSeccion()) {
    assert.match(sala.tituloClave, /^LAGUNAK\.Seccion\.Sala\./, `${sala.id} sin clave de idioma`);
    if (sala.destino === "puesto") {
      assert.ok(sala.puesto, `${sala.id} lleva a un puesto pero no dice a cuál`);
    }
  }
  assert.equal(salaPorId("cantina")?.destino, "cantina");
  assert.equal(salaPorId("bodega")?.destino, null, "la bodega es de mirar, no de entrar");
  assert.equal(salaPorId("no-existe"), undefined);
});

test("las salas que se entran andando existen de verdad en el catálogo de andar", () => {
  // #508: el puente y la ingeniería ya no abren su consola desde la sección,
  // se entra en ellas ANDANDO. Una `estancia` que el catálogo no conociera
  // dejaría un clic muerto que ningún test de este archivo vería —por eso se
  // comprueba contra el catálogo real y no contra una lista repetida aquí.
  let alguna = false;
  for (const sala of salasSeccion()) {
    if (sala.destino !== "andar") continue;
    alguna = true;
    assert.ok(
      CATALOGO_ANDAR.tiene(sala.estancia),
      `${sala.id} lleva a la estancia "${sala.estancia}", que no existe en el catálogo de andar`,
    );
  }
  assert.ok(alguna, "ninguna sala de la sección se entra andando");
  assert.equal(salaPorId("puente")?.estancia, "pasillo-puente");
  assert.equal(salaPorId("ingenieria")?.estancia, "ingenieria");
});

test("componerSeccion transporta la estancia, y null donde no hay ninguna", () => {
  const seccion = componerSeccion([]);
  const puente = seccion.salas.find((sala) => sala.id === "puente");
  const bodega = seccion.salas.find((sala) => sala.id === "bodega");
  assert.equal(puente.estancia, "pasillo-puente");
  assert.equal(bodega.estancia, null, "una sala que no se entra no inventa estancia");
});

test("una celda de mamparo no es ninguna sala", () => {
  const cantina = salaPorId("cantina");
  assert.equal(salaEnCelda(cantina.caja.x, cantina.caja.y)?.id, "cantina");
  // La fila 0 es casco: por ahí no se anda.
  assert.equal(salaEnCelda(5, 0), null);
  assert.equal(salaEnCelda(NaN, 2), null);
});

test("sin lectura de sistemas la salud es null, y NO cero", () => {
  // Es la diferencia entre «no sé» y «está reventada». Pintar la segunda
  // cuando pasa la primera es la peor mentira que puede contar un plano.
  const seccion = componerSeccion([]);
  for (const sala of seccion.salas) {
    assert.equal(sala.salud, null, `${sala.id} se inventó una lectura`);
  }
});

test("la salud de una sala sale de los sistemas de su región", () => {
  // El reactor vive en el lomo, y el lomo es el puente.
  const seccion = componerSeccion([{ id: "reactor", health: 40 }]);
  const porId = Object.fromEntries(seccion.salas.map((sala) => [sala.id, sala]));
  assert.equal(porId.puente.salud, 40);
  // Una sala interior no tiene región y sigue sin lectura aunque el resto sí.
  assert.equal(porId.cantina.salud, null);
  assert.deepEqual(sistemasDeSala("puente"), ["reactor"]);
  assert.deepEqual(sistemasDeSala("cantina"), [], "una sala sin región no explica nada");
});

test("la presencia se reparte por sala y descarta la que no cae en ninguna", () => {
  const reparto = tripulacionPorSala([
    { id: "u1", nombre: "Ane", sala: "puente" },
    { id: "u2", nombre: "Jon", sala: "puente" },
    { id: "u3", nombre: "Nadie", sala: "invernadero" },
    null,
  ]);
  assert.deepEqual(reparto.puente.map((p) => p.nombre), ["Ane", "Jon"]);
  assert.deepEqual(reparto.bodega, []);
  assert.ok(!("invernadero" in reparto), "una sala que no existe no se inventa");
});

test("el puesto dice dónde estás, y un puesto desconocido no te coloca en ningún sitio", () => {
  assert.equal(salaDePuesto("engineering"), "ingenieria");
  assert.equal(salaDePuesto("captain"), "puente");
  assert.equal(salaDePuesto("relations"), null);
  assert.equal(salaDePuesto(undefined), null);
});
