import test from "node:test";
import assert from "node:assert/strict";

import { GRUPO, anadirHerramienta, crearGrupo } from "../scripts/control-escena.mjs";

const GRUPO_ARGS = Object.freeze({
  activeTool: "lagunak-panel-gm",
  title: "LAGUNAK.Controles.Grupo",
  icon: "fa-solid fa-shuttle-space",
});

function herramienta(name, onClick = () => {}) {
  return { name, title: `T.${name}`, icon: "fa-solid fa-x", button: true, onClick };
}

/* --- v11/v12: array de grupos, array de herramientas --- */

test("v11: crea el grupo como elemento del array, con sus herramientas en orden", () => {
  const controls = [{ name: "token", tools: [] }];
  assert.equal(crearGrupo(controls, { ...GRUPO_ARGS, tools: [herramienta("a"), herramienta("b")] }), true);

  const grupo = controls.find((g) => g.name === GRUPO);
  assert.equal(grupo.layer, "controls");
  assert.equal(grupo.visible, true);
  assert.equal(grupo.activeTool, "lagunak-panel-gm");
  assert.deepEqual(grupo.tools.map((t) => t.name), ["a", "b"]);
});

test("v11: la herramienta se añade al final del grupo, tal cual", () => {
  const controls = [];
  crearGrupo(controls, { ...GRUPO_ARGS, tools: [herramienta("a")] });
  assert.equal(anadirHerramienta(controls, herramienta("b")), true);

  const grupo = controls.find((g) => g.name === GRUPO);
  assert.deepEqual(grupo.tools.map((t) => t.name), ["a", "b"]);
  // En v11 el orden ES la posición: no se inventa un `order` que la barra no lee.
  assert.equal("order" in grupo.tools[1], false);
});

test("v11: no toca otros grupos del anfitrión", () => {
  const controls = [{ name: "token", tools: [herramienta("select")] }];
  crearGrupo(controls, { ...GRUPO_ARGS, tools: [] });
  anadirHerramienta(controls, herramienta("a"));
  assert.deepEqual(controls[0].tools.map((t) => t.name), ["select"]);
});

/* --- v13: record de grupos, record de herramientas --- */

test("v13: crea el grupo como clave del record, con `order` explícito por herramienta", () => {
  const controls = { token: { name: "token", tools: {} } };
  assert.equal(crearGrupo(controls, { ...GRUPO_ARGS, tools: [herramienta("a"), herramienta("b")] }), true);

  const grupo = controls[GRUPO];
  assert.equal(grupo.order, 1, "va después de los grupos que ya había");
  assert.equal(grupo.tools.a.order, 0);
  assert.equal(grupo.tools.b.order, 1);
  assert.equal(typeof grupo.onChange, "function");
  assert.equal(typeof grupo.onToolChange, "function");
});

test("v13: el clic viaja como `onChange`, que es como lo llama esta generación", () => {
  const controls = {};
  let clics = 0;
  crearGrupo(controls, { ...GRUPO_ARGS, tools: [] });
  anadirHerramienta(controls, herramienta("a", () => { clics += 1; }));

  const tool = controls[GRUPO].tools.a;
  tool.onChange();
  assert.equal(clics, 1);
  // `onClick` se conserva: quien lo lea en cualquier generación encuentra lo mismo.
  assert.equal(tool.onClick, tool.onChange);
});

test("v13: cada herramienta añadida hereda el `order` siguiente", () => {
  const controls = {};
  crearGrupo(controls, { ...GRUPO_ARGS, tools: [herramienta("a")] });
  anadirHerramienta(controls, herramienta("b"));
  anadirHerramienta(controls, herramienta("c"));
  assert.deepEqual(
    Object.values(controls[GRUPO].tools).map((t) => [t.name, t.order]),
    [["a", 0], ["b", 1], ["c", 2]],
  );
});

/* --- Bordes: lo que NO debe pasar --- */

test("sin grupo creado no se añade nada, ni se inventa un grupo", () => {
  // Es la propiedad que justifica que `anadirHerramienta` no cree el grupo: un
  // botón en un grupo inventado saldría en la barra sin el candado de
  // visibilidad que declara el grupo de verdad.
  const arrayVacio = [];
  assert.equal(anadirHerramienta(arrayVacio, herramienta("a")), false);
  assert.deepEqual(arrayVacio, []);

  const recordVacio = {};
  assert.equal(anadirHerramienta(recordVacio, herramienta("a")), false);
  assert.deepEqual(recordVacio, {});
});

test("una herramienta sin nombre se rechaza en las dos formas", () => {
  for (const controls of [[], {}]) {
    crearGrupo(controls, { ...GRUPO_ARGS, tools: [] });
    assert.equal(anadirHerramienta(controls, { title: "sin nombre" }), false);
  }
});

test("no se cuela una forma en la otra: tools de forma inesperada se rechaza", () => {
  // Un anfitrión que diese `tools` en la forma de la OTRA generación es un
  // cambio de contrato: mejor no pintar el botón que corromper el grupo.
  assert.equal(anadirHerramienta([{ name: GRUPO, tools: {} }], herramienta("a")), false);
  assert.equal(anadirHerramienta({ [GRUPO]: { name: GRUPO, tools: [] } }, herramienta("a")), false);
});

test("crearGrupo rechaza un `controls` que no es ni array ni objeto", () => {
  assert.equal(crearGrupo(null, { ...GRUPO_ARGS, tools: [] }), false);
  assert.equal(crearGrupo(undefined, { ...GRUPO_ARGS, tools: [] }), false);
});

test("las herramientas iniciales se copian: mutar el grupo no toca la lista de quien llamó", () => {
  const tools = [herramienta("a")];
  const controls = [];
  crearGrupo(controls, { ...GRUPO_ARGS, tools });
  anadirHerramienta(controls, herramienta("b"));
  assert.deepEqual(tools.map((t) => t.name), ["a"]);
});
