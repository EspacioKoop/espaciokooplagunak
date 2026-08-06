import assert from "node:assert/strict";
import test from "node:test";

import {
  entradaPorId,
  hijosDe,
  migasDe,
  normalizarBaseDatos,
} from "../scripts/base-datos-cientifica.mjs";

const PAYLOAD = {
  entries: [
    { id: "Naves", name: "Naves", parent: null, description: "Clasificación", values: [] },
    { id: "Naves/Exuari", name: "Exuari", parent: "Naves", values: [] },
    {
      id: "Naves/Exuari/Cazador",
      name: "Cazador",
      parent: "Naves/Exuari",
      description: "Rápido y frágil",
      values: [{ key: "Casco", value: 70 }],
    },
    { id: "Facciones", name: "Facciones", parent: null, values: [] },
  ],
  total: 4,
  truncated: false,
};

test("sin payload no hay base de datos, que no es una base de datos vacía", () => {
  // La distinción que sostiene la regla de "sin sondeo no se inventa nada": una
  // lista vacía es la respuesta a una consulta; null es no haber consultado.
  assert.equal(normalizarBaseDatos(null), null);
  assert.equal(normalizarBaseDatos(undefined), null);
  assert.equal(normalizarBaseDatos({}), null);
  assert.deepEqual(normalizarBaseDatos({ entries: [], total: 0 }).entradas, []);
});

test("normaliza nombres, padres, descripciones y pares", () => {
  const base = normalizarBaseDatos(PAYLOAD);
  const hoja = entradaPorId(base, "Naves/Exuari/Cazador");
  assert.equal(hoja.nombre, "Cazador");
  assert.equal(hoja.padre, "Naves/Exuari");
  assert.deepEqual(hoja.valores, [{ clave: "Casco", valor: "70" }]);
  // Sin descripción va null, no cadena vacía: "no tiene ficha" y "tiene una
  // ficha en blanco" son cosas distintas.
  assert.equal(entradaPorId(base, "Naves/Exuari").descripcion, null);
});

test("una entrada sin id o sin nombre se descarta en vez de colarse a medias", () => {
  const base = normalizarBaseDatos({
    entries: [
      { id: "", name: "Anónima" },
      { name: "Sin id" },
      { id: "Suelta" },
      { id: "Buena", name: "Buena" },
    ],
  });
  assert.deepEqual(base.entradas.map((e) => e.id), ["Buena"]);
});

test("se navega por niveles y en orden alfabético", () => {
  const base = normalizarBaseDatos(PAYLOAD);
  assert.deepEqual(hijosDe(base, null).map((e) => e.nombre), ["Facciones", "Naves"]);
  assert.deepEqual(hijosDe(base, "Naves").map((e) => e.nombre), ["Exuari"]);
  assert.deepEqual(hijosDe(base, "Naves/Exuari/Cazador"), []);
});

test("las migas se siguen por padre, no partiendo el id por barras", () => {
  // Un nombre con una barra dentro rompería ese atajo y dejaría migas que no
  // llevan a ningún sitio.
  const base = normalizarBaseDatos({
    entries: [
      { id: "Sector A/B", name: "Sector A/B", parent: null },
      { id: "Sector A/B/Baliza", name: "Baliza", parent: "Sector A/B" },
    ],
  });
  assert.deepEqual(
    migasDe(base, "Sector A/B/Baliza").map((e) => e.nombre),
    ["Sector A/B", "Baliza"],
  );
});

test("un padre en ciclo no cuelga las migas", () => {
  // El puente ya corta los ciclos, pero esto no depende de que lo haya hecho:
  // un payload manipulado no debe congelar el navegador de nadie.
  const base = normalizarBaseDatos({
    entries: [
      { id: "A", name: "A", parent: "B" },
      { id: "B", name: "B", parent: "A" },
    ],
  });
  assert.ok(migasDe(base, "A").length <= 32);
});

test("el truncamiento del puente se conserva en vez de disimularse", () => {
  const base = normalizarBaseDatos({ entries: [], total: 900, truncated: true });
  assert.equal(base.truncada, true);
  assert.equal(base.total, 900);
});
