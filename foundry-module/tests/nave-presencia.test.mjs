/* Presencia al andar por la nave (#498, revisión externa de Odiseo).
 *
 * Lo que se protege aquí no es el filtrado ni la interpolación —eso ya lo
 * cubre `nave-movimiento-red.test.mjs` y no se duplica— sino la FRONTERA:
 * que "quién está aquí y dónde" siga siendo una pregunta contestable sin
 * aceptar nada sobre cómo se dibuja nadie.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { presentesEn, cuantosPresentes } from "../scripts/nave-presencia.mjs";

const AHORA = 10_000;

/** Historial de un jugador con una sola muestra confirmada (sin interpolar). */
function historial(muestra) {
  return { prev: null, actual: { ...muestra, sello: AHORA } };
}

function estados(entradas) {
  return new Map(entradas.map(([id, muestra]) => [id, historial(muestra)]));
}

const EN_LA_CANTINA = { x: 3, z: 4, y: 1, yaw: 0.5, estancia: "cantina" };

const OPCIONES = { estanciaPropia: "cantina", miUserId: "yo", ahoraMs: AHORA };

test("presentesEn(): responde quién está aquí y dónde", () => {
  const presentes = presentesEn(estados([["otra", EN_LA_CANTINA]]), OPCIONES);

  assert.equal(presentes.length, 1);
  assert.deepEqual(presentes[0], {
    userId: "otra",
    x: 3,
    y: 1,
    z: 4,
    yaw: 0.5,
    estancia: "cantina",
  });
});

test("presentesEn(): no se incluye a uno mismo ni a quien está en otra sala", () => {
  const presentes = presentesEn(
    estados([
      ["yo", EN_LA_CANTINA],
      ["en-el-puente", { ...EN_LA_CANTINA, estancia: "puente-mando" }],
      ["otra", EN_LA_CANTINA],
    ]),
    OPCIONES,
  );

  assert.deepEqual(
    presentes.map((p) => p.userId),
    ["otra"],
  );
});

// El punto entero del módulo (revisión de Odiseo): presencia y representación
// son cosas distintas. Si algún día alguien "aprovecha" que este dato viaja
// hasta el pintor para colar aquí el avatar —o cualquier otra decisión de
// cómo se dibuja—, el resto de consumidores (minimapa, lista de ocupación,
// proximidad) heredarían una forma con la que no tienen nada que ver.
test("presentesEn(): la presencia NO arrastra nada de representación", () => {
  const conRuidoDeRender = estados([
    ["otra", { ...EN_LA_CANTINA, avatar: { raza: "elfo" }, color: "#ff0000" }],
  ]);

  const [presencia] = presentesEn(conRuidoDeRender, OPCIONES);

  assert.deepEqual(Object.keys(presencia).sort(), [
    "estancia",
    "userId",
    "x",
    "y",
    "yaw",
    "z",
  ]);
  assert.equal("avatar" in presencia, false, "el avatar es una vista, no presencia");
  assert.equal("color" in presencia, false, "el color es una vista, no presencia");
});

test("presentesEn(): una muestra obsoleta deja de estar presente, no se congela", () => {
  const viejo = new Map([
    ["otra", { prev: null, actual: { ...EN_LA_CANTINA, sello: AHORA - 5_000 } }],
  ]);

  assert.deepEqual(presentesEn(viejo, OPCIONES), []);
});

test("presentesEn(): sala vacía es lista vacía, no un hueco raro", () => {
  assert.deepEqual(presentesEn(new Map(), OPCIONES), []);
  assert.deepEqual(presentesEn(null, OPCIONES), []);
});

test("cuantosPresentes(): cuenta sin que quien pregunta tenga que saber dónde está nadie", () => {
  const dos = estados([
    ["otra", EN_LA_CANTINA],
    ["tercera", { ...EN_LA_CANTINA, x: 9 }],
    ["lejos", { ...EN_LA_CANTINA, estancia: "ingenieria" }],
  ]);

  assert.equal(cuantosPresentes(dos, OPCIONES), 2);
  assert.equal(cuantosPresentes(new Map(), OPCIONES), 0);
});
