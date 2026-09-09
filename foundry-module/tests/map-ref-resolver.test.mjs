import assert from "node:assert/strict";
import test from "node:test";

import { resolverMapRef } from "../scripts/map-ref-resolver.mjs";
import { readFile } from "node:fs/promises";
import { validateCosmography } from "../scripts/catalogo-cosmografico.mjs";

// Fixture del formato serializado de ContentResource::Map v3
// (src/content/contentResource.cpp); no es una sesión ni un test del motor C++.
const mapa = {
  format: "espaciokoop-content", version: 3, type: "map", id: "map-port",
  name: "Puerto", description: "Fixture original de resolución",
  fields: { scenario_file: "scenario_00_basic.lua", recommended_players: "4", objects: [] },
};
const atlas = JSON.parse(await readFile(new URL("../data/cosmografia.example.json", import.meta.url), "utf8"));

test("JSON de atlas → validador productor → resolver conserva la referencia débil", () => {
  for (const ref of [undefined, "map-port", "map-ausente"]) {
    const entrada = structuredClone(atlas);
    const planeta = entrada.entries.find(e => e.type === "planet");
    if (ref !== undefined) planeta.map_ref = ref;
    const cargado = JSON.parse(JSON.stringify(entrada));
    assert.equal(validateCosmography(cargado), true);
    const nodo = cargado.entries.find(e => e.type === "planet");
    const documento = JSON.parse(JSON.stringify(mapa));
    const previo = JSON.stringify([cargado, documento]);
    assert.equal(resolverMapRef(nodo, [documento]), ref === "map-port" ? documento : null);
    assert.equal(JSON.stringify([cargado, documento]), previo);
    assert.equal(resolverMapRef(nodo, []), null);
    assert.equal(validateCosmography(cargado), true);
  }
});

const documents = [
  { id: "map-ruins", name: "Ruinas", width: 30, height: 20 },
  { id: "map-port", name: "Puerto", width: 40, height: 30 },
];

test("resolverMapRef devuelve el MapDocument que corresponde a map_ref", () => {
  const node = { id: "encounter-1", map_ref: "map-port" };

  assert.deepEqual(resolverMapRef(node, documents), documents[1]);
});

test("una referencia ausente significa sin mapa y no bloquea el nodo", () => {
  assert.equal(resolverMapRef({ id: "encounter-2" }, documents), null);
  assert.equal(resolverMapRef({ id: "encounter-3", map_ref: null }, documents), null);
});

test("una referencia desconocida es sin mapa y no lanza", () => {
  assert.equal(resolverMapRef({ id: "encounter-4", map_ref: "missing" }, documents), null);
  assert.equal(resolverMapRef({ id: "encounter-5", map_ref: "map-port" }, []), null);
});
