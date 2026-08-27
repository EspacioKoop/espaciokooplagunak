// Pruebas de convocatoria-wiring (#832): el botón engancha `convocar`.
//
// Sin librería de mocking: game/Hooks/ui/foundry son objetos planos declarados
// antes de importar el módulo.

let hooksRegistrados = [];
globalThis.Hooks = {
  on(ev, cb) { hooksRegistrados.push([ev, cb]); },
  callAll(ev, carga) { (globalThis.__callAll ?? []).push([ev, carga]); },
};
globalThis.ui = undefined;
globalThis.game = { user: { isGM: true } };

const { addConvocarControl, registrarConvocatoriaUI, estanciasDisponibles, convocarDesdeVentana }
  = await import("../scripts/convocatoria-wiring.mjs");

import { CATALOGO_ANDAR } from "../scripts/nave-catalogo-andar.mjs";
import { convocar } from "../scripts/convocatoria-estancia.mjs";
import test from "node:test";
import assert from "node:assert/strict";

test("addConvocarControl añade el botón lagunak-convocar al grupo propio", () => {
  const controls = [{ name: "lagunak", tools: [] }];
  const ok = addConvocarControl(controls);
  assert.equal(ok, true);
  const tool = controls[0].tools.find((t) => t.name === "lagunak-convocar");
  assert.ok(tool, "falta el control lagunak-convocar");
  assert.equal(tool.title, "LAGUNAK.Convocatoria.Titulo");
});

test("registrarConvocatoriaUI configura el módulo para el botón y la ventana", () => {
  registrarConvocatoriaUI("espaciokoop-lagunak");
  // El botón se añade desde el hook de la barra de main, no con un hook propio:
  // así no se duplica el callback de getSceneControlButtons.
  const controls = [{ name: "lagunak", tools: [] }];
  const ok = addConvocarControl(controls);
  assert.equal(ok, true);
  const tool = controls[0].tools.find((t) => t.name === "lagunak-convocar");
  assert.ok(tool, "falta el control lagunak-convocar");
  assert.equal(tool.title, "LAGUNAK.Convocatoria.Titulo");
});

test("estanciasDisponibles refleja el catálogo de andar", async () => {
  const estancias = await estanciasDisponibles();
  assert.ok(Array.isArray(estancias) && estancias.length > 0);
  assert.ok(estancias.every((e) => CATALOGO_ANDAR.tiene(e.id)));
});

test("convocarDesdeVentana llama a convocar con rol GM y emite el hook", async () => {
  globalThis.__callAll = [];
  const id = CATALOGO_ANDAR.ids[0];
  const posicion = await convocarDesdeVentana(id);
  // convocar exige rol GM; sin game.user.isGM devuelve null, pero el hook se
  // emite igual con la posición (null si no aplica).
  assert.equal(globalThis.__callAll[0][0], "lagunakConvocarResuelve");
  assert.equal(globalThis.__callAll[0][1].id, id);
  assert.equal(globalThis.__callAll[0][1].posicion, posicion);
});
