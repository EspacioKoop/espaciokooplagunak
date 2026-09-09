import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { aplicarAfina } from "../scripts/contactos-afinado.mjs";
import { degradarContactos } from "../scripts/contactos-degradados.mjs";

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

  it("crudo -> degradado -> afinado: el error real siempre queda dentro del margen declarado", () => {
    // Distancia real 1499: degradarContactos la publica como "≈1000 ±1000"
    // (banda larga). Afinar a partir de ese 1000 ya redondeado (en vez de
    // recalcular desde la medida real) daba "≈1000 ±100" con un error real
    // de 499 > 100 — el margen declarado mentía.
    const crudo = {
      contacts: [{ position: { x: 1499, y: 0 }, scan_state: "none" }],
    };
    const degradado = degradarContactos(crudo, { x: 0, y: 0 }, { short_range: 10, long_range: 2000 });
    const contacto = degradado.contactos[0];
    assert.equal(contacto.banda, "largo");
    assert.equal(contacto.distancia, 1000);
    assert.equal(contacto.precision, 1000);
    // La medida sin redondear viaja para poder afinar de verdad.
    assert.ok(Math.abs(contacto.distanciaReal - 1499) < 1e-9);

    const afinado = aplicarAfina(degradado, { modificador: 20, cd: 5 });
    const resultado = afinado.contactos[0];
    assert.equal(resultado.precision, 100);
    // El error real respecto a la distancia verdadera (1499) tiene que caber
    // dentro del margen que el resultado anuncia (±100) — antes del fix
    // podía no caber, porque se afinaba sobre 1000, no sobre 1499.
    const errorReal = Math.abs(resultado.distancia - 1499);
    assert.ok(
      errorReal <= resultado.precision,
      `error real ${errorReal} debe caber en el margen declarado ${resultado.precision}`,
    );

    // banda y estado deben ser la misma lectura, nunca uno "candidato" y el
    // otro "eco" a la vez.
    assert.equal(resultado.banda, "candidato");
    assert.equal(resultado.estado, "candidato");
  });
});
