import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  cargarAtlasStandalone,
  consultarEntrada,
  consultarHijos,
} from "../scripts/atlas-standalone.mjs";

const source = await readFile(
  new URL("../data/cosmografia.example.json", import.meta.url),
  "utf8",
);

test("cargarAtlasStandalone acepta el mismo JSON sin Foundry", async () => {
  const atlas = cargarAtlasStandalone(source);

  assert.equal(atlas.format, "espaciokoop-cosmography");
  assert.equal(atlas.entries.length, 3);
  assert.equal(consultarEntrada(atlas, "mundo-auzolan")?.type, "planet");
});

test("consultarHijos conserva la jerarquía plano-sistema-planeta", () => {
  const atlas = cargarAtlasStandalone(JSON.parse(source));

  assert.deepEqual(
    consultarHijos(atlas, "sistema-laguna").map((entry) => entry.id),
    ["mundo-auzolan"],
  );
});

test("consultas ausentes son estados vacíos y el JSON inválido falla", () => {
  const atlas = cargarAtlasStandalone(source);

  assert.equal(consultarEntrada(atlas, "missing"), null);
  assert.deepEqual(consultarHijos(atlas, "missing"), []);
  assert.throws(() => cargarAtlasStandalone("{}"));
});
