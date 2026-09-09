import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const IDIOMA = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "lang", "es.json"), "utf8"),
);

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
} from "../../scripts/seccion-nave/seccion-nave.mjs";
import { CATALOGO_ANDAR } from "../../scripts/nave-catalogo-andar.mjs";

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
    // #542: la sección reusa los nombres de la ventana de andar. Una sala tiene
    // UN nombre, y tener dos claves para la misma sala es cómo acaban llamándose
    // distinto en dos pantallas. Se comprueba que la clave EXISTA, que es más
    // fuerte que comprobar su prefijo — lo anterior pasaba con claves inventadas.
    assert.ok(IDIOMA[sala.tituloClave], `${sala.id} sin traducción (${sala.tituloClave})`);
    if (sala.destino === "puesto") {
      assert.ok(sala.puesto, `${sala.id} lleva a un puesto pero no dice a cuál`);
    }
  }
  assert.equal(salaPorId("cantina")?.destino, "cantina");
  // #542: la planta pasó a ser la REAL del Phobos, y todas sus salas son
  // estancias recorribles. Ya no hay salas «de mirar y no entrar» —eran las
  // inventadas (bodega, enfermería), que no existen en la nave.
  assert.equal(salaPorId("bodega") ?? null, null, "la bodega era inventada: no existe en el Phobos");
  assert.equal(salaPorId("enfermeria") ?? null, null, "la enfermería era inventada");
  assert.equal(salaPorId("reactor")?.destino, "andar");
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
  // #542: `estancia` es el propio id. La traducción a mano que hizo falta en
  // #540 (`puente → pasarela-proa`) desapareció con las salas inventadas.
  assert.equal(salaPorId("reactor")?.estancia, "reactor");
  assert.equal(salaPorId("maniobra")?.estancia, "maniobra");
  assert.equal(salaPorId("cantina")?.estancia, null, "la cantina abre su ventana propia");
});

test("componerSeccion transporta la estancia, y null donde no hay ninguna", () => {
  const seccion = componerSeccion([]);
  const reactor = seccion.salas.find((sala) => sala.id === "reactor");
  const cantina = seccion.salas.find((sala) => sala.id === "cantina");
  assert.equal(reactor.estancia, "reactor");
  assert.equal(cantina.estancia, null, "la cantina no se entra andando: abre su ventana propia");
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
  // #542: la salud de una sala es la de SU sistema. Antes se agrupaba por
  // regiones de casco inventadas y una sala podía teñirse por una avería que no
  // estaba en ella.
  const seccion = componerSeccion([{ id: "reactor", health: 40 }]);
  const porId = Object.fromEntries(seccion.salas.map((sala) => [sala.id, sala]));
  assert.equal(porId.reactor.salud, 40);
  // Una sala interior no tiene región y sigue sin lectura aunque el resto sí.
  assert.equal(porId.cantina.salud, null);
  assert.deepEqual(sistemasDeSala("reactor"), ["reactor"]);
  assert.deepEqual(sistemasDeSala("cantina"), [], "una sala sin sistema no explica nada");
});

test("la presencia se reparte por sala y descarta la que no cae en ninguna", () => {
  const reparto = tripulacionPorSala([
    { id: "u1", nombre: "Ane", sala: "reactor" },
    { id: "u2", nombre: "Jon", sala: "reactor" },
    { id: "u3", nombre: "Nadie", sala: "invernadero" },
    null,
  ]);
  assert.deepEqual(reparto.reactor.map((p) => p.nombre), ["Ane", "Jon"]);
  assert.deepEqual(reparto.camarotes, []);
  assert.ok(!("invernadero" in reparto), "una sala que no existe no se inventa");
});

test("el puesto dice dónde estás, y un puesto desconocido no te coloca en ningún sitio", () => {
  assert.equal(salaDePuesto("engineering"), "reactor");
  // Mando no tiene sala: no es un sistema del Phobos. Antes se le daba «puente»,
  // una sala que no existe — decir null es más honesto que inventarle un sitio.
  assert.equal(salaDePuesto("captain"), null);
  assert.equal(salaDePuesto("relations"), null);
  assert.equal(salaDePuesto(undefined), null);
});
