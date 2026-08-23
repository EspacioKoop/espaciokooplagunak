import assert from "node:assert/strict";
import test from "node:test";
import { encenderSala, crearClaseCantinaV2, elegir, gentePresente } from "../scripts/cantina-app.mjs";

// Helper mock for comando
function crearMandoMock() {
  return { cortarA: () => {}, opciones: () => [] };
}

test("encenderSala returns null when raiz lacks sala", () => {
  const fakeRaiz = { querySelector: () => null, querySelectorAll: () => [] };
  const result = encenderSala(fakeRaiz, () => {});
  assert.equal(result, null);
});

test("crearClaseCantinaV2 graceful with undefined alSeleccionar", () => {
  const Clase = crearClaseCantinaV2({});
  const inst = new Clase();
  inst._onRender({});
});

test("elegir handles tipo 'ir' correctly", () => {
  const mando = crearMandoMock();
  const opcion = { tipo: "ir", destino: "x" };
  elegir(opcion, mando, () => {});
});

test("elegir handles tipo 'jugar' correctly", () => {
  const mando = crearMandoMock();
  const opcion = { tipo: "jugar", puerta: "poker" };
  let selected = null;
  elegir(opcion, mando, id => selected = id);
  assert.equal(selected, "poker");
});

// Test gentePresente excludes GM and inactive users

test("gentePresente excludes GM and inactive users", () => {
  globalThis.game = { users: [
    { id: "gm", isGM: true, active: true },
    { id: "offline", isGM: false, active: false },
    { id: "player", isGM: false, active: true },
  ] };
  const gente = gentePresente("lagunak");
  assert.deepEqual(gente.map(u => u.id), ["player"]);
});
