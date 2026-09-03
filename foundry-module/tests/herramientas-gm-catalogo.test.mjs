import assert from "node:assert/strict";
import test from "node:test";

import { construirHerramientasGM } from "../scripts/herramientas-gm-catalogo.mjs";

function manejadores() {
  const llamadas = [];
  return {
    llamadas,
    abrirPanelGM: () => llamadas.push(["panel-gm"]),
    abrirAndarNave: (estancia) => llamadas.push(["andar-nave", estancia]),
  };
}

test("devuelve las tres herramientas solo-GM, en orden, con name/title/icon/button", () => {
  const herramientas = construirHerramientasGM(manejadores());
  assert.deepEqual(
    herramientas.map((h) => h.name),
    ["lagunak-panel-gm", "lagunak-playa", "lagunak-museo"],
  );
  for (const h of herramientas) {
    assert.equal(typeof h.title, "string");
    assert.equal(typeof h.icon, "string");
    assert.equal(h.button, true);
    assert.equal(typeof h.onClick, "function");
  }
});

test("lagunak-panel-gm llama a abrirPanelGM()", () => {
  const m = manejadores();
  const herramientas = construirHerramientasGM(m);
  herramientas.find((h) => h.name === "lagunak-panel-gm").onClick();
  assert.deepEqual(m.llamadas, [["panel-gm"]]);
});

test("lagunak-playa y lagunak-museo llaman a abrirAndarNave con su estancia", () => {
  const m = manejadores();
  const herramientas = construirHerramientasGM(m);
  herramientas.find((h) => h.name === "lagunak-playa").onClick();
  herramientas.find((h) => h.name === "lagunak-museo").onClick();
  assert.deepEqual(m.llamadas, [
    ["andar-nave", "playa"],
    ["andar-nave", "museo"],
  ]);
});

test("no reusa el mismo manejador entre dos llamadas al catálogo", () => {
  const primero = manejadores();
  const segundo = manejadores();
  construirHerramientasGM(primero)
    .find((h) => h.name === "lagunak-museo")
    .onClick();
  assert.deepEqual(primero.llamadas, [["andar-nave", "museo"]]);
  assert.deepEqual(segundo.llamadas, []);
});
