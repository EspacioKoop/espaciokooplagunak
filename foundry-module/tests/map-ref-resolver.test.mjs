import assert from "node:assert/strict";
import test from "node:test";

import { resolverMapRef } from "../scripts/map-ref-resolver.mjs";

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
