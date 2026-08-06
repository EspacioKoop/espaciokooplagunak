import assert from "node:assert/strict";
import test from "node:test";

import { TIPOS_HABILIDAD, modificadorDeFicha } from "../scripts/asistencia/ficha-dnd5e.mjs";

const FICHA = Object.freeze({
  abilities: Object.freeze({ str: Object.freeze({ mod: 3 }), int: Object.freeze({ mod: -1 }) }),
  skills: Object.freeze({ arc: Object.freeze({ total: 7 }), prc: Object.freeze({ total: 2 }) }),
  tools: Object.freeze({ tinker: Object.freeze({ total: 5 }) }),
});

test("lee el total de una habilidad", () => {
  assert.equal(modificadorDeFicha(FICHA, "skill:arc"), 7);
});

test("lee el total de una herramienta", () => {
  assert.equal(modificadorDeFicha(FICHA, "tool:tinker"), 5);
});

test("lee el modificador puro de una característica, no su total de tirada", () => {
  assert.equal(modificadorDeFicha(FICHA, "ability:str"), 3);
  assert.equal(modificadorDeFicha(FICHA, "ability:int"), -1);
});

test("sin ficha no hay modificador que leer: null, no 0", () => {
  // 0 sería un número plausible que escondería que no se pudo leer nada.
  assert.equal(modificadorDeFicha(null, "skill:arc"), null);
});

test("sin habilidad declarada por el enfoque, tampoco hay nada que leer", () => {
  assert.equal(modificadorDeFicha(FICHA, null), null);
  assert.equal(modificadorDeFicha(FICHA, undefined), null);
});

test("una clave que la ficha no tiene (sin competencia) da null, no revienta", () => {
  assert.equal(modificadorDeFicha(FICHA, "skill:ste"), null);
  assert.equal(modificadorDeFicha(FICHA, "tool:disguise"), null);
  assert.equal(modificadorDeFicha(FICHA, "ability:cha"), null);
});

test("un tipo de habilidad inventado no se lee de ningún sitio", () => {
  assert.equal(modificadorDeFicha(FICHA, "hechizo:bola-de-fuego"), null);
  assert.equal(modificadorDeFicha(FICHA, "sin-tipo-ni-dos-puntos"), null);
});

test("los tres tipos declarados son exactamente skill, tool y ability", () => {
  assert.deepEqual(TIPOS_HABILIDAD, ["skill", "tool", "ability"]);
});

test("un total no numérico (ficha corrupta o a medio cargar) da null en vez de NaN", () => {
  const rota = { skills: { arc: { total: "no-es-un-numero" } } };
  assert.equal(modificadorDeFicha(rota, "skill:arc"), null);
});
