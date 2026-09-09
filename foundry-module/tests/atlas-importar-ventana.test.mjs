import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  addImportadorAtlasControl,
  importarTextoAtlas,
  registrarImportadorAtlas,
} from "../scripts/atlas-importar-ventana.mjs";

const ejemplo = await readFile(
  new URL("../data/cosmografia.example.json", import.meta.url),
  "utf8",
);

test("el consumidor GM valida un atlas y devuelve un resumen", async () => {
  const resumen = await importarTextoAtlas(ejemplo);
  assert.deepEqual(resumen, {
    entradas: 3,
    formato: "espaciokoop-cosmography",
    version: 1,
  });
});

test("el consumidor añade una herramienta solo al GM", () => {
  const originalGame = globalThis.game;
  try {
    registrarImportadorAtlas("espaciokoop-lagunak");
    globalThis.game = { user: { isGM: true } };
    const controls = [{ name: "lagunak", tools: [] }];

    addImportadorAtlasControl(controls);

    assert.equal(controls[0].tools[0].name, "lagunak-importar-atlas");
  } finally {
    globalThis.game = originalGame;
  }
});

test("el consumidor no añade la herramienta a jugadores", () => {
  const originalGame = globalThis.game;
  try {
    globalThis.game = { user: { isGM: false } };
    const controls = [{ name: "lagunak", tools: [] }];

    addImportadorAtlasControl(controls);

    assert.deepEqual(controls[0].tools, []);
  } finally {
    globalThis.game = originalGame;
  }
});
