import assert from "node:assert/strict";
import test from "node:test";

import { describirFoco, restaurarFoco } from "../scripts/foco-render.mjs";

function elemento(atributos) {
  return {
    getAttribute: (nombre) => atributos[nombre] ?? null,
  };
}

test("describirFoco no inventa descriptor sin elemento ni atributos identificadores", () => {
  assert.equal(describirFoco(null), null);
  assert.equal(describirFoco(elemento({ class: "solo-visual" })), null);
});

test("describirFoco prioriza data-field sobre id y name cuando coexisten", () => {
  const descriptor = describirFoco(elemento({ "data-field": "ingenieria-nivel", id: "otro-id", name: "otro-name" }));
  assert.deepEqual(descriptor, { atributo: "data-field", valor: "ingenieria-nivel" });
});

test("describirFoco cae a id cuando no hay data-field/data-action", () => {
  const descriptor = describirFoco(elemento({ id: "lagunak-bridge-token" }));
  assert.deepEqual(descriptor, { atributo: "id", valor: "lagunak-bridge-token" });
});

test("restaurarFoco reencuentra el control equivalente en la nueva raíz y lo enfoca", () => {
  let enfocado = false;
  const nuevoElemento = { focus: () => { enfocado = true; } };
  const raiz = {
    querySelector: (selector) => (selector === '[data-field="ingenieria-nivel"]' ? nuevoElemento : null),
  };
  restaurarFoco(raiz, { atributo: "data-field", valor: "ingenieria-nivel" });
  assert.equal(enfocado, true);
});

test("restaurarFoco no revienta sin descriptor, sin raíz o sin coincidencia", () => {
  assert.doesNotThrow(() => restaurarFoco(null, { atributo: "id", valor: "x" }));
  assert.doesNotThrow(() => restaurarFoco({ querySelector: () => null }, null));
  assert.doesNotThrow(() => restaurarFoco({ querySelector: () => null }, { atributo: "id", valor: "no-existe" }));
});
