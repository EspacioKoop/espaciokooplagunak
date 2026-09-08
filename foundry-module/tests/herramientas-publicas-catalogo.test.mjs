import assert from "node:assert/strict";
import test from "node:test";

import { construirHerramientasPublicas } from "../scripts/herramientas-publicas-catalogo.mjs";

test("el catálogo público conserva las cuatro herramientas y sus handlers", () => {
  const calls = [];
  const tools = construirHerramientasPublicas({
    abrirCantina: () => calls.push("cantina"),
    abrirSeccionNave: () => calls.push("seccion"),
    abrirAndarNave: () => calls.push("andar"),
    alternarAudioLocal: () => calls.push("audio"),
  });

  assert.deepEqual(tools.map(({ name }) => name), [
    "lagunak-cantina",
    "lagunak-seccion",
    "lagunak-andar-nave",
    "lagunak-musica-audio",
  ]);
  tools.forEach((tool) => tool.onClick());
  assert.deepEqual(calls, ["cantina", "seccion", "andar", "audio"]);
});
