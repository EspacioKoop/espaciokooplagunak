import assert from "node:assert/strict";
import test from "node:test";

import { describirFoco, restaurarFoco } from "../scripts/foco-render.mjs";

function elemento(atributos) {
  return {
    getAttribute: (nombre) => atributos[nombre] ?? null,
  };
}

// Raíz falsa mínima: querySelectorAll devuelve, para un selector dado, la
// lista de elementos configurada (por identidad, no por atributos reales).
function raizConGrupos(grupos) {
  return {
    querySelectorAll: (selector) => grupos[selector] ?? [],
  };
}

test("describirFoco no inventa descriptor sin elemento ni atributos identificadores", () => {
  assert.equal(describirFoco(null), null);
  assert.equal(describirFoco(elemento({ class: "solo-visual" })), null);
});

test("describirFoco prioriza data-field sobre id y name cuando coexisten", () => {
  const descriptor = describirFoco(elemento({ "data-field": "ingenieria-nivel", id: "otro-id", name: "otro-name" }));
  assert.deepEqual(descriptor, { atributo: "data-field", valor: "ingenieria-nivel", indice: 0 });
});

test("describirFoco cae a id cuando no hay data-field/data-action", () => {
  const descriptor = describirFoco(elemento({ id: "lagunak-bridge-token" }));
  assert.deepEqual(descriptor, { atributo: "id", valor: "lagunak-bridge-token", indice: 0 });
});

test("restaurarFoco reencuentra el control equivalente en la nueva raíz y lo enfoca", () => {
  let enfocado = false;
  const nuevoElemento = { focus: () => { enfocado = true; } };
  const raiz = raizConGrupos({
    '[data-field="ingenieria-nivel"]': [nuevoElemento],
  });
  restaurarFoco(raiz, { atributo: "data-field", valor: "ingenieria-nivel", indice: 0 });
  assert.equal(enfocado, true);
});

test("restaurarFoco no revienta sin descriptor, sin raíz o sin coincidencia", () => {
  assert.doesNotThrow(() => restaurarFoco(null, { atributo: "id", valor: "x", indice: 0 }));
  assert.doesNotThrow(() => restaurarFoco({ querySelectorAll: () => [] }, null));
  assert.doesNotThrow(() => restaurarFoco({ querySelectorAll: () => [] }, { atributo: "id", valor: "no-existe", indice: 0 }));
});

// Regresión #227 (review de #282): dos botones de escudos comparten
// data-action="ordenarEscudos" (subir/bajar), distinguidos solo por
// data-value. Antes del índice, describirFoco()/restaurarFoco() siempre
// devolvían el foco al primero de la lista aunque el foco real estuviera en
// el segundo.
test("describirFoco + restaurarFoco distinguen dos controles con el mismo atributo identificador", () => {
  const botonSubir = elemento({ "data-action": "ordenarEscudos", "data-value": "true" });
  const botonBajar = elemento({ "data-action": "ordenarEscudos", "data-value": "false" });
  const raizAntes = raizConGrupos({
    '[data-action="ordenarEscudos"]': [botonSubir, botonBajar],
  });

  const descriptor = describirFoco(botonBajar, raizAntes);
  assert.deepEqual(descriptor, { atributo: "data-action", valor: "ordenarEscudos", indice: 1 });

  let enfocadoSubir = false;
  let enfocadoBajar = false;
  const nuevoBotonSubir = { focus: () => { enfocadoSubir = true; } };
  const nuevoBotonBajar = { focus: () => { enfocadoBajar = true; } };
  const raizDespues = raizConGrupos({
    '[data-action="ordenarEscudos"]': [nuevoBotonSubir, nuevoBotonBajar],
  });

  restaurarFoco(raizDespues, descriptor);
  assert.equal(enfocadoBajar, true);
  assert.equal(enfocadoSubir, false);
});

test("describirFoco sin raíz previa (o elemento ausente de la lista) asume índice 0", () => {
  const boton = elemento({ "data-action": "ordenarEscudos", "data-value": "true" });
  assert.deepEqual(describirFoco(boton), { atributo: "data-action", valor: "ordenarEscudos", indice: 0 });

  const raizSinElemento = raizConGrupos({ '[data-action="ordenarEscudos"]': [] });
  assert.deepEqual(describirFoco(boton, raizSinElemento), {
    atributo: "data-action",
    valor: "ordenarEscudos",
    indice: 0,
  });
});
