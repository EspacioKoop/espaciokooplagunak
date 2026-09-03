// El adjuntador genérico de props (#897).

import assert from "node:assert/strict";
import test from "node:test";

import { PROPS, piezasProp } from "../scripts/avatar-props.mjs";

test("cada prop del catálogo dibuja algo en el punto dado", () => {
  for (const prop of PROPS) {
    const piezas = piezasProp(prop, [1, 2, 3], { prefijo: "x" });
    assert.ok(piezas.length > 0, `${prop} no dibuja nada`);
  }
});

test("un prop desconocido no dibuja nada y no revienta", () => {
  assert.deepEqual(piezasProp("bazuca", [0, 0, 0]), []);
});

test("un punto mal formado no dibuja nada y no revienta", () => {
  assert.deepEqual(piezasProp("jarra", null), []);
  assert.deepEqual(piezasProp("jarra", [1, 2]), []);
  assert.deepEqual(piezasProp("jarra", undefined), []);
});

test("el prefijo nombra las piezas igual que el resto del cuerpo", () => {
  const piezas = piezasProp("jarra", [0, 0, 0], { prefijo: "avatar3" });
  assert.ok(piezas.every((p) => p.nombre.startsWith("avatar3")));
});

test("la brasa del cigarro sube de brillo con la calada, igual que en el avatar", () => {
  const apagada = piezasProp("cigarro", [0, 0, 0], { tiempo: 3000, indice: 0, prefijo: "p" });
  const encendida = piezasProp("cigarro", [0, 0, 0], { tiempo: 260, indice: 0, prefijo: "p" });
  const brasa = (piezas) => piezas.find((p) => p.nombre.endsWith("Brasa"));
  assert.notEqual(brasa(apagada).color, brasa(encendida).color);
});

test("la brasa cae exactamente en el punto de anclaje, el cigarro un poco retirado", () => {
  const piezas = piezasProp("cigarro", [1, 2, 3], { prefijo: "p" });
  const brasa = piezas.find((p) => p.nombre.endsWith("Brasa"));
  assert.deepEqual(brasa.centro, [1, 2, 3]);
  const cigarro = piezas.find((p) => p.nombre.endsWith("Cigarro"));
  assert.notDeepEqual(cigarro.centro, [1, 2, 3]);
});
