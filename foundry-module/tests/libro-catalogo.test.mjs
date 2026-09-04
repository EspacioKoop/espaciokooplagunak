import assert from "node:assert/strict";
import test from "node:test";

import { validarCatalogoPiezas, NATURALEZAS, cartelaDe, piezaPorId } from "../scripts/catalogo-piezas.mjs";
import { CATALOGO_LIBROS, MALLAS_LIBRO, ID_LIBRO_CLASICO } from "../scripts/libro-catalogo.mjs";

test("el catálogo de libros es válido por el MISMO validador que el de piezas", () => {
  assert.equal(validarCatalogoPiezas(CATALOGO_LIBROS, { mallasDisponibles: MALLAS_LIBRO }), true);
});

test("una sola obra, la disciplina de #590 aplicada aquí", () => {
  assert.equal(CATALOGO_LIBROS.piezas.length, 1);
});

test("la naturaleza declarada es una de las admitidas por catalogo-piezas.mjs", () => {
  const pieza = CATALOGO_LIBROS.piezas[0];
  assert.ok(NATURALEZAS.includes(pieza.naturaleza), `naturaleza ${pieza.naturaleza} no está en NATURALEZAS`);
  // No se inventa "interpretacion" aunque encajaría mejor: no existe hoy en el
  // validador, y este catálogo no se salta la regla para tener un nombre más
  // bonito (ver la cabecera de libro-catalogo.mjs).
  assert.equal(pieza.naturaleza, "obra-propia");
});

test("la malla declarada existe en el registro que este catálogo aporta", () => {
  assert.ok(MALLAS_LIBRO.has(CATALOGO_LIBROS.piezas[0].malla));
});

test("piezaPorId encuentra la obra por su id estable", () => {
  const pieza = piezaPorId(CATALOGO_LIBROS, ID_LIBRO_CLASICO);
  assert.ok(pieza);
  assert.equal(pieza.id, ID_LIBRO_CLASICO);
});

test("cartelaDe funciona igual que para una pieza de museo: mismo camino, sin reescribirlo", () => {
  const pieza = piezaPorId(CATALOGO_LIBROS, ID_LIBRO_CLASICO);
  const cartela = cartelaDe(pieza, "es");
  assert.equal(cartela.id, ID_LIBRO_CLASICO);
  assert.match(cartela.credito, /GPL-2\.0/);
  // Sin fuente externa: es obra propia del módulo, no un archivo de terceros.
  assert.equal(cartela.fuente, null);
});
