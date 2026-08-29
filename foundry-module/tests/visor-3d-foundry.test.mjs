import assert from "node:assert/strict";
import test from "node:test";

import {
  ID_BOTON,
  herramientaVisor3D,
  registrarVisorSistema3D,
} from "../scripts/visor-3d-sistema-app.mjs";
import { SISTEMA_EJEMPLO, aplanarSistema } from "../standalone/visor-3d-sistema/datos.mjs";

// --- Tests del registro en la barra de escena, sin Foundry real ---

function dobleHooks() {
  const listeners = [];
  return {
    listeners,
    on(_nombre, handler) {
      listeners.push(handler);
    },
    disparar(controls) {
      for (const fn of listeners) fn(controls);
    },
  };
}

test("la herramienta exportada tiene el id, título, icono y un onClick", () => {
  assert.equal(herramientaVisor3D.name, ID_BOTON);
  assert.equal(herramientaVisor3D.title, "LAGUNAK.Controles.AbrirVisor3DSistema");
  assert.equal(herramientaVisor3D.icon, "fa-solid fa-satellite");
  assert.equal(typeof herramientaVisor3D.onClick, "function");
});

test("registrarVisorSistema3D con hooks nulo no registra nada (Node sin Foundry)", () => {
  const hooks = dobleHooks();
  registrarVisorSistema3D(null); // no debe lanzar ni registrar
  assert.equal(hooks.listeners.length, 0);
});

test("el botón se añade al grupo lagunak en la forma v11 (array)", () => {
  globalThis.game = { user: { isGM: true } };
  const hooks = dobleHooks();
  registrarVisorSistema3D(hooks);

  const controles = [
    { name: "token", tools: [] },
    { name: "lagunak", tools: [] },
  ];
  hooks.disparar(controles);

  const grupo = controles.find((g) => g.name === "lagunak");
  const herr = grupo.tools.find((t) => t.name === ID_BOTON);
  assert.ok(herr, "el botón está en el grupo lagunak");
  assert.equal(herr.title, herramientaVisor3D.title);
});

test("el botón se añade al grupo lagunak en la forma v13 (record)", () => {
  globalThis.game = { user: { isGM: true } };
  const hooks = dobleHooks();
  registrarVisorSistema3D(hooks);

  const controles = { token: { tools: {} }, lagunak: { tools: {}, order: 0 } };
  hooks.disparar(controles);

  const herr = controles.lagunak.tools[ID_BOTON];
  assert.ok(herr, "el botón está en el grupo lagunak (record)");
  assert.equal(herr.name, ID_BOTON);
});

test("un jugador no recibe el botón (solo-GM)", () => {
  globalThis.game = { user: { isGM: false } };
  const hooks = dobleHooks();
  registrarVisorSistema3D(hooks);

  const controles = [{ name: "lagunak", tools: [] }];
  hooks.disparar(controles);

  const grupo = controles.find((g) => g.name === "lagunak");
  assert.equal(grupo.tools.find((t) => t.name === ID_BOTON), undefined, "sin botón para jugador");
});

// --- Tests de datos (sistema de ejemplo) ---

test("aplanarSistema incluye la estrella, los planetas y las lunas", () => {
  const planos = aplanarSistema(SISTEMA_EJEMPLO);
  // Argia: estrella + 3 planetas; Bihotz tiene 1 luna -> 5 en total.
  assert.equal(planos.length, 5);
  const ids = planos.map((p) => p.cuerpo.id);
  assert.deepEqual([...new Set(ids)].sort(), ids.sort(), "ids únicos");
  assert.ok(ids.includes("argia-a") && ids.includes("argia-b") && ids.includes("argia-b1"));
});

test("aplanarSistema marca el padre de cada luna", () => {
  const planos = aplanarSistema(SISTEMA_EJEMPLO);
  const ilaz = planos.find((p) => p.cuerpo.id === "argia-b1");
  assert.equal(ilaz.padre, "argia-b", "la luna cuelga de su planeta");
  const estrella = planos.find((p) => p.cuerpo.tipo === "estrella");
  assert.equal(estrella.padre, null, "la estrella no tiene padre");
});

test("aplanarSistema con sistema sin lunas no añade nada extra", () => {
  const sistema = {
    id: "x",
    nombre: "X",
    cuerpos: [
      { id: "s", tipo: "estrella", orbita: {} },
      { id: "p", tipo: "planeta", orbita: {} },
    ],
  };
  assert.equal(aplanarSistema(sistema).length, 2);
});
