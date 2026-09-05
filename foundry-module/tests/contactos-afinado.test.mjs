import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { aplicarAfina } from "../scripts/contactos-afinado.mjs";

describe("contactos-afinado", () => {
  it("sin afinado devuelve el mismo payload", () => {
    const payload = { contactos: [{ banda: "largo", distancia: 1000, rumboDeg: 45, precision: 1000, rumboPrecision: 15 }], alcance: { corto: 10, largo: 1000 } };
    const out = aplicarAfina(payload, null);
    assert.deepStrictEqual(out, payload);
  });

  it("fallo no cambia precision ni inventa identidad", () => {
    const payload = {
      contactos: [
        { banda: "largo", distancia: 1000, rumboDeg: 45, precision: 1000, rumboPrecision: 15, callsign: null, faction: null },
      ],
      alcance: { corto: 10, largo: 1000 },
    };
    const out = aplicarAfina(payload, { modificador: -10, cd: 5 });
    assert.strictEqual(out.contactos[0].precision, 1000);
    assert.strictEqual(out.contactos[0].callsign, null);
  });

  it("exito reduce incertidumbre un nivel", () => {
    const payload = {
      contactos: [
        { banda: "largo", distancia: 1000, rumboDeg: 45, precision: 1000, rumboPrecision: 15 },
      ],
      alcance: { corto: 10, largo: 1000 },
    };
    const out = aplicarAfina(payload, { modificador: 20, cd: 5 });
    assert.strictEqual(out.contactos[0].precision, 100);
    assert.strictEqual(out.contactos[0].rumboPrecision, 5);
  });

  it("contacto dentro de rango con fallo queda igual", () => {
    const payload = {
      contactos: [
        { banda: "corto", distancia: 50, rumboDeg: 45, precision: 10, rumboPrecision: 1 },
      ],
      alcance: { corto: 10, largo: 1000 },
    };
    const out = aplicarAfina(payload, { modificador: -10, cd: 5 });
    assert.deepStrictEqual(out.contactos, payload.contactos);
  });

  it("no muta el payload original", () => {
    const contacto = { banda: "largo", distancia: 1000, rumboDeg: 45, precision: 1000, rumboPrecision: 15 };
    const payload = { contactos: [contacto], alcance: { corto: 10, largo: 1000 } };
    aplicarAfina(payload, { modificador: 20, cd: 5 });
    assert.strictEqual(payload.contactos[0].precision, 1000);
  });
});
