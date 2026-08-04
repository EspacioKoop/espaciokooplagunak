import { test } from "node:test";
import assert from "node:assert/strict";

import {
  resolverCriaturas,
  resolverObjetos,
  resolverHechizos,
} from "../scripts/plutonium-adaptador.mjs";

// Datos inventados para este test, no copiados de ningún sourcebook real.

const CRIATURA_2014 = {
  id: "actor-1",
  name: "Bicho inventado",
  system: { source: { rules: "2014", book: "MM" } },
};
const CRIATURA_2024 = {
  id: "actor-2",
  name: "Bicho remasterizado inventado",
  system: { source: { rules: "2024", book: "XMM" } },
};
const OBJETO_2014 = {
  id: "item-1",
  type: "weapon",
  name: "Espada inventada",
  system: { source: { book: "DMG" } },
};
const HECHIZO_2014 = {
  id: "item-2",
  type: "spell",
  name: "Hechizo inventado",
  system: { source: { book: "PHB" } },
};
const HECHIZO_DESCONOCIDO = {
  id: "item-3",
  type: "spell",
  name: "Hechizo sin marcar",
  system: { source: { book: "NOSE" } },
};

test("resolverCriaturas acepta 2014 y descarta 2024 sin lanzar", () => {
  const resultado = resolverCriaturas([CRIATURA_2014, CRIATURA_2024]);
  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].id, "actor-1");
  assert.equal(resultado[0].tipo, "criatura");
  assert.equal(resultado[0].origen, "plutonium");
  assert.equal(resultado[0].edicion, "2014");
});

test("resolverObjetos excluye hechizos y aplica el mismo filtro 2014", () => {
  const resultado = resolverObjetos([OBJETO_2014, HECHIZO_2014]);
  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].id, "item-1");
  assert.equal(resultado[0].tipo, "objeto");
});

test("resolverHechizos solo toma items tipo spell", () => {
  const resultado = resolverHechizos([OBJETO_2014, HECHIZO_2014]);
  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].id, "item-2");
  assert.equal(resultado[0].tipo, "hechizo");
});

test("con plutonium ausente (colecciones vacías) no hay regresión: listas vacías, no error", () => {
  assert.deepEqual(resolverCriaturas([]), []);
  assert.deepEqual(resolverObjetos([]), []);
  assert.deepEqual(resolverHechizos([]), []);
  assert.deepEqual(resolverCriaturas(undefined), []);
});

test("registrarRechazo recibe motivo diagnosticable sin relajar el filtro", () => {
  const rechazos = [];
  const resultado = resolverHechizos([HECHIZO_DESCONOCIDO], {
    registrarRechazo: (r) => rechazos.push(r),
  });
  assert.equal(resultado.length, 0);
  assert.equal(rechazos.length, 1);
  assert.equal(rechazos[0].id, "item-3");
  assert.equal(rechazos[0].motivo, "fuente-desconocida");
});

test("el modelo interno es el mismo shape para criaturas, objetos y hechizos", () => {
  const [criatura] = resolverCriaturas([CRIATURA_2014]);
  const [objeto] = resolverObjetos([OBJETO_2014]);
  const [hechizo] = resolverHechizos([HECHIZO_2014]);
  for (const modelo of [criatura, objeto, hechizo]) {
    assert.deepEqual(Object.keys(modelo).sort(), [
      "datos",
      "edicion",
      "id",
      "nombre",
      "origen",
      "tipo",
    ]);
  }
});
