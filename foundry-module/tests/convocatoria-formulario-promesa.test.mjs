import test from "node:test";
import assert from "node:assert/strict";
import { crearClaseConvocatoriaV1, crearClaseConvocatoriaV2 } from "../scripts/convocatoria-app.mjs";

for (const version of ["V1", "V2"]) {
  test(`${version}: el formulario espera persistencia y no cierra cuando se rechaza`, async () => {
    const saved = { Application: globalThis.Application, foundry: globalThis.foundry };
    let handler;
    class Base { activateListeners() {} close() { this.closed = true; } }
    globalThis.Application = Base;
    globalThis.foundry = { applications: { api: { ApplicationV2: Base, HandlebarsApplicationMixin: b => b } } };
    const form = { on(event, fn) { handler = fn; }, addEventListener(event, fn) { handler = fn; } };
    const field = selector => selector.includes("idEstancia") ? "playa" : "GM";
    const html = { find(selector) { return selector === "form" ? form : { val: () => field(selector), trigger() {}, focus() {} }; } };
    try {
      for (const resultado of [null, { estancia: "playa" }]) {
        let finish;
        const create = version === "V1" ? crearClaseConvocatoriaV1 : crearClaseConvocatoriaV2;
        const App = create({ onSubmit: () => new Promise(resolve => { finish = resolve; }) });
        const app = new App();
        app.element = { querySelector: selector => selector === "form" ? form : { value: field(selector) } };
        if (version === "V1") app.activateListeners(html); else app._onRender({}, {});
        const submitted = handler({ preventDefault() {} });
        assert.notEqual(app.closed, true);
        finish(resultado);
        await submitted;
        assert.equal(app.closed === true, resultado !== null);
      }
    } finally { Object.assign(globalThis, saved); }
  });
}
