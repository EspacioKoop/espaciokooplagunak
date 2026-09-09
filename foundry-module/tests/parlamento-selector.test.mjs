import assert from "node:assert/strict";
import test from "node:test";
import { CATALOGO_ENCUENTROS_BASE } from "../scripts/catalogo-encuentros.mjs";
import { crearClaseParlamentoSelectorV1, crearClaseParlamentoSelectorV2 } from "../scripts/parlamento-selector-app.mjs";

for (const version of ["V1", "V2"]) {
  test(`${version}: seleccionarEncuentro resuelve el ID exacto sin sustituir el encuentro`, () => {
    const saved = { Application: globalThis.Application, foundry: globalThis.foundry };
    class Base { close() { this.closed = true; } }
    globalThis.Application = Base;
    globalThis.foundry = { applications: { api: { ApplicationV2: Base, HandlebarsApplicationMixin: (base) => base } } };
    try {
      const received = [];
      const create = version === "V1" ? crearClaseParlamentoSelectorV1 : crearClaseParlamentoSelectorV2;
      const Selector = create({ alSeleccionarEncuentro: (entry) => received.push(entry) });
      const selector = new Selector();
      selector.seleccionarEncuentro("saludo-de-faccion");
      assert.equal(received.length, 1);
      assert.equal(received[0], CATALOGO_ENCUENTROS_BASE.buscar("saludo-de-faccion"));
      assert.equal(received[0].id, "saludo-de-faccion");
      assert.equal(selector.closed, true);
      selector.seleccionarEncuentro("no-existe");
      selector.seleccionarEncuentro("");
      assert.equal(received.length, 1);
    } finally { Object.assign(globalThis, saved); }
  });
}
