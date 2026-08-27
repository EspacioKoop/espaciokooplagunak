import assert from "node:assert/strict";
import test from "node:test";

// `registrarRelevoPuestos` devuelve un RETIRADOR, y lo que hay que demostrar es
// que ese retirador limpia de verdad. Comprobar solo que devuelve una función
// no prueba nada: con `Hooks.off` como no-op, un retirador que no hiciera
// absolutamente nada pasaría igual esa aserción.
//
// Así que se registran los argumentos de `Hooks.on` y de `Hooks.off`, y se
// exige que el listener retirado sea EL MISMO objeto que se entregó al
// registrar. La igualdad por identidad es el punto: `Hooks.off` con una función
// equivalente pero distinta no desengancha nada en Foundry, y el módulo se
// quedaría escuchando `updateUser` para siempre después de decir que ha
// limpiado.

function hooksFalso() {
  const registrados = [];
  const retirados = [];
  return {
    registrados,
    retirados,
    on: (evento, fn) => registrados.push({ evento, fn }),
    off: (evento, fn) => retirados.push({ evento, fn }),
  };
}

async function cargarModulo() {
  // Cache-busting: cada test necesita el módulo con SU mock de Hooks, y un
  // import cacheado se quedaría con el `globalThis.Hooks` del test anterior.
  return import(`../scripts/station-handover.mjs?t=${Math.random()}`);
}

test("registra un único listener sobre updateUser", async () => {
  const Hooks = hooksFalso();
  globalThis.Hooks = Hooks;
  globalThis.foundry = { utils: { randomID: () => "abc" } };

  const { registrarRelevoPuestos } = await cargarModulo();
  registrarRelevoPuestos("espaciokoop-lagunak");

  assert.equal(Hooks.registrados.length, 1);
  assert.equal(Hooks.registrados[0].evento, "updateUser");
  assert.equal(typeof Hooks.registrados[0].fn, "function");
});

test("el retirador desengancha EL MISMO listener que se registró", async () => {
  const Hooks = hooksFalso();
  globalThis.Hooks = Hooks;
  globalThis.foundry = { utils: { randomID: () => "abc" } };

  const { registrarRelevoPuestos } = await cargarModulo();
  const retirar = registrarRelevoPuestos("espaciokoop-lagunak");

  assert.equal(Hooks.retirados.length, 0, "no retira nada hasta que se le pide");
  retirar();

  assert.equal(Hooks.retirados.length, 1, "el retirador llama a Hooks.off");
  assert.equal(Hooks.retirados[0].evento, "updateUser");
  assert.strictEqual(
    Hooks.retirados[0].fn,
    Hooks.registrados[0].fn,
    "Hooks.off con una función distinta no desengancha nada: tiene que ser la misma referencia",
  );
});

test("cada registro trae su propio listener, así que retirar uno no desengancha el otro", async () => {
  const Hooks = hooksFalso();
  globalThis.Hooks = Hooks;
  globalThis.foundry = { utils: { randomID: () => "abc" } };

  const { registrarRelevoPuestos } = await cargarModulo();
  const retirarA = registrarRelevoPuestos("espaciokoop-lagunak");
  registrarRelevoPuestos("otro-modulo");

  assert.equal(Hooks.registrados.length, 2);
  assert.notStrictEqual(Hooks.registrados[0].fn, Hooks.registrados[1].fn);

  retirarA();
  assert.strictEqual(Hooks.retirados[0].fn, Hooks.registrados[0].fn);
});
