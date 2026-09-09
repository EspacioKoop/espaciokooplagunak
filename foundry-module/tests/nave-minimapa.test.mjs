import assert from "node:assert/strict";
import test from "node:test";

import { celdasMinimapa, estaEnElPlano, modeloMinimapa } from "../scripts/nave-minimapa.mjs";
import { SALAS_PHOBOS } from "../scripts/nave-planta-phobos.mjs";
import { CATALOGO_ANDAR } from "../scripts/nave-catalogo-andar.mjs";

test("el plano son las salas REALES del Phobos, más la cantina", () => {
  // La razón de que este módulo exista en vez de reusar `seccion-nave.mjs`: la
  // sección declara seis salas inventadas y la nave que se recorre tiene catorce.
  // Un minimapa sacado de la sección te situaría en un plano que no es el tuyo.
  const celdas = celdasMinimapa();
  assert.equal(
    celdas.length,
    SALAS_PHOBOS.length + 2,
    "las trece del interior nativo, más la cantina y su terraza",
  );
  assert.ok(celdas.some((c) => c.id === "cantina"));
  // La terraza (#579) también: se anda por ella, y un plano que no dibuja un
  // sitio por el que se anda miente justo al perderse.
  assert.ok(celdas.some((c) => c.id === "terraza"));
});

/**
 * Estancias que son NAVE. La playa de pruebas (#587) y la sala del museo (#598)
 * no lo son: se entra por herramienta de GM, no anda por ellas la tripulación, y
 * el minimapa se apaga mientras se está fuera en vez de enseñar un plano del
 * Phobos sin nadie marcado en él (ver `pintarSituacion` en `andar-nave-app.mjs`).
 */
const FUERA_DE_LA_NAVE = new Set(["playa", "museo", "pasillo-recuerdos"]);
const ESTANCIAS_DE_LA_NAVE = CATALOGO_ANDAR.ids.filter((id) => !FUERA_DE_LA_NAVE.has(id));

test("toda estancia de la nave por la que se anda aparece en el plano", () => {
  // Si se pudiera entrar en una sala que el minimapa no dibuja, el minimapa
  // mentiría justo cuando más se necesita: al perderse.
  for (const id of ESTANCIAS_DE_LA_NAVE) {
    assert.ok(estaEnElPlano(id), `se puede andar por "${id}" y no sale en el minimapa`);
  }
});

test("lo que NO es la nave no sale en el plano, y por eso el minimapa se apaga", () => {
  for (const id of FUERA_DE_LA_NAVE) {
    assert.ok(CATALOGO_ANDAR.tiene(id), `${id} debería seguir existiendo como estancia`);
    assert.equal(estaEnElPlano(id), false);
  }
});

test("la cantina se dibuja PEGADA a la sala de la que cuelga", () => {
  // No está en la rejilla nativa: cuelga del muro norte de `acceso-cantina`.
  // Colocarla en cualquier otro sitio del plano sería dibujar una nave que no es.
  const celdas = celdasMinimapa();
  const cantina = celdas.find((c) => c.id === "cantina");
  const acceso = celdas.find((c) => c.id === "acceso-cantina");
  assert.equal(cantina.y + cantina.h, acceso.y, "la cantina va justo encima de su acceso");
  assert.equal(cantina.x, acceso.x, "y alineada con él");
});

test("ninguna celda queda en negativo: la rejilla empieza en (0,0)", () => {
  // La cantina mete una fila por encima de la rejilla nativa. Sin normalizar,
  // el pintor tendría que saber de ese caso raro.
  for (const celda of celdasMinimapa()) {
    assert.ok(celda.x >= 0 && celda.y >= 0, `${celda.id} en negativo: ${celda.x},${celda.y}`);
  }
});

test("ninguna sala del plano se solapa con otra", () => {
  const celdas = celdasMinimapa();
  for (const a of celdas) {
    for (const b of celdas) {
      if (a === b) continue;
      const solapa = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      assert.equal(solapa, false, `${a.id} y ${b.id} se pisan en el minimapa`);
    }
  }
});

test("marca UNA sala como actual, y ninguna si no estás en el plano", () => {
  const enReactor = modeloMinimapa("reactor");
  assert.deepEqual(enReactor.salas.filter((s) => s.actual).map((s) => s.id), ["reactor"]);

  // Las salas de prueba del motor no están en la nave: el minimapa no debe
  // inventar una posición para ellas.
  const enSalaDePrueba = modeloMinimapa("a");
  assert.deepEqual(enSalaDePrueba.salas.filter((s) => s.actual), []);
});

test("distingue sala con sistema de sala de tránsito", () => {
  const modelo = modeloMinimapa(null);
  const reactor = modelo.salas.find((s) => s.id === "reactor");
  const pasarela = modelo.salas.find((s) => s.id === "pasarela-proa");
  assert.equal(reactor.conSistema, true);
  assert.equal(pasarela.conSistema, false);
});

test("la rejilla declara su tamaño y cubre todas las salas", () => {
  const modelo = modeloMinimapa(null);
  for (const sala of modelo.salas) {
    assert.ok(sala.caja.x + sala.caja.ancho <= modelo.columnas, `${sala.id} se sale por la derecha`);
    assert.ok(sala.caja.y + sala.caja.alto <= modelo.filas, `${sala.id} se sale por abajo`);
  }
});

test("con presencia vacía el modelo sale SIN marcas", () => {
  const modelo = modeloMinimapa(null, SALAS_PHOBOS, []);
  assert.deepEqual(modelo.marcas, []);
});

test("con dos tripulantes salen dos marcas en las salas correctas", () => {
  const presencia = [
    { userId: "tripulante1", estancia: "reactor" },
    { userId: "tripulante2", estancia: "cantina" }
  ];
  const modelo = modeloMinimapa(null, SALAS_PHOBOS, presencia);
  assert.equal(modelo.marcas.length, 2);
  const marca1 = modelo.marcas.find(m => m.userId === "tripulante1");
  const marca2 = modelo.marcas.find(m => m.userId === "tripulante2");
  assert.ok(marca1, "falta la marca de tripulante1");
  assert.ok(marca2, "falta la marca de tripulante2");
  assert.equal(marca1.sala, "reactor");
  assert.equal(marca2.sala, "cantina");
});

test("a quien este fuera del plano no se le pinta marca", () => {
  // Una sala de prueba no esta en la rejilla: una marca ahi no se puede dibujar.
  const inventada = "sala-que-no-esta-en-el-plano";
  assert.equal(estaEnElPlano(inventada, SALAS_PHOBOS), false, "premisa del test");

  const modelo = modeloMinimapa(null, SALAS_PHOBOS, [
    { userId: "dentro", estancia: "cantina" },
    { userId: "fuera", estancia: inventada },
  ]);

  assert.deepEqual(modelo.marcas.map((m) => m.userId), ["dentro"]);
});
