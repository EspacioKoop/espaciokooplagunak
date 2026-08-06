import assert from "node:assert/strict";
import test from "node:test";

import { crearCatalogoPuertas } from "../scripts/puerta-catalogo.mjs";

test("todas() devuelve siempre la misma referencia congelada, no una copia", () => {
  const catalogo = crearCatalogoPuertas([Object.freeze({ id: "a" }), Object.freeze({ id: "b" })]);
  assert.equal(catalogo.todas(), catalogo.congelado);
  assert.throws(() => {
    catalogo.congelado.push({ id: "intruso" });
  });
});

test("porId encuentra la entrada existente y no inventa una para ids ajenos", () => {
  const catalogo = crearCatalogoPuertas([
    Object.freeze({ id: "poker", juego: "poker" }),
    Object.freeze({ id: "dados", juego: "dados" }),
  ]);
  assert.equal(catalogo.porId("poker")?.juego, "poker");
  assert.equal(catalogo.porId("dados")?.juego, "dados");
  assert.equal(catalogo.porId("tragaperras"), undefined);
  assert.equal(catalogo.porId(""), undefined);
  assert.equal(catalogo.porId(undefined), undefined);
});

test("dos catálogos distintos no se contaminan entre sí", () => {
  const uno = crearCatalogoPuertas([Object.freeze({ id: "x" })]);
  const otro = crearCatalogoPuertas([Object.freeze({ id: "y" })]);
  assert.equal(uno.porId("y"), undefined);
  assert.equal(otro.porId("x"), undefined);
});

test("preserva campos propios de cada entrada, más allá de id", () => {
  const catalogo = crearCatalogoPuertas([
    Object.freeze({ id: "poker", juego: "poker", objeto: "poker", icono: "fa-solid fa-diamond" }),
  ]);
  const entrada = catalogo.porId("poker");
  assert.equal(entrada.objeto, "poker");
  assert.equal(entrada.icono, "fa-solid fa-diamond");
});
