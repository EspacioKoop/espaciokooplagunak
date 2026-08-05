import test from "node:test";
import assert from "node:assert/strict";

import { resolverObjetivoEscaneo } from "../scripts/resolver-objetivo-sensores.mjs";

const CENTRO = Object.freeze({ x: 0, y: 0 });

function contactsPayload(...contactos) {
  return { contacts: contactos };
}

test("resuelve al único candidato dentro del margen de la lectura", () => {
  const indicativo = resolverObjetivoEscaneo({
    contactsPayload: contactsPayload(
      { callsign: "Lagunak", is_player: true, position: { x: 0, y: 0 } },
      { callsign: "Lapur 1", is_player: false, position: { x: 0, y: -20000 } },
    ),
    centro: CENTRO,
    // Rumbo 0 = norte del mundo, que en la convención del módulo es -y.
    lectura: { distancia: 20000, rumboDeg: 0, precision: 1000, rumboPrecision: 15 },
  });
  assert.equal(indicativo, "Lapur 1");
});

test("sin ningún candidato dentro del margen, no inventa un objetivo", () => {
  const indicativo = resolverObjetivoEscaneo({
    contactsPayload: contactsPayload({ callsign: "Lapur 1", is_player: false, position: { x: 0, y: -20000 } }),
    centro: CENTRO,
    // Lectura de otro sitio del todo: nada encaja en su margen.
    lectura: { distancia: 5000, rumboDeg: 180, precision: 100, rumboPrecision: 1 },
  });
  assert.equal(indicativo, null);
});

test("entre dos candidatos en el margen, gana el más cercano a la lectura exacta", () => {
  const indicativo = resolverObjetivoEscaneo({
    contactsPayload: contactsPayload(
      { callsign: "Cerca del centro de la lectura", is_player: false, position: { x: 0, y: -20100 } },
      { callsign: "Al borde del margen", is_player: false, position: { x: 0, y: -20900 } },
    ),
    centro: CENTRO,
    lectura: { distancia: 20000, rumboDeg: 0, precision: 1000, rumboPrecision: 15 },
  });
  assert.equal(indicativo, "Cerca del centro de la lectura");
});

test("un candidato sin indicativo (el propio GM no debería mandarlo, pero por si acaso) se ignora", () => {
  const indicativo = resolverObjetivoEscaneo({
    contactsPayload: contactsPayload({ callsign: null, is_player: false, position: { x: 0, y: -20000 } }),
    centro: CENTRO,
    lectura: { distancia: 20000, rumboDeg: 0, precision: 1000, rumboPrecision: 15 },
  });
  assert.equal(indicativo, null);
});

test("la nave propia nunca se propone a sí misma como objetivo", () => {
  const indicativo = resolverObjetivoEscaneo({
    contactsPayload: contactsPayload({ callsign: "Lagunak", is_player: true, position: { x: 0, y: 0 } }),
    centro: CENTRO,
    lectura: { distancia: 0, rumboDeg: 0, precision: 0, rumboPrecision: 0 },
  });
  assert.equal(indicativo, null);
});

test("sin datos suficientes en la lectura o el centro, no revienta y devuelve null", () => {
  const payload = contactsPayload({ callsign: "Lapur 1", is_player: false, position: { x: 0, y: -20000 } });
  assert.equal(resolverObjetivoEscaneo({ contactsPayload: payload, centro: null, lectura: {} }), null);
  assert.equal(
    resolverObjetivoEscaneo({ contactsPayload: payload, centro: CENTRO, lectura: { distancia: 20000 } }),
    null,
  );
  assert.equal(resolverObjetivoEscaneo({ contactsPayload: null, centro: CENTRO, lectura: { distancia: 1, rumboDeg: 1 } }), null);
});

test("un margen de 0 (lectura exacta) no rechaza al propio contacto que la generó", () => {
  const indicativo = resolverObjetivoEscaneo({
    contactsPayload: contactsPayload({ callsign: "Justa", is_player: false, position: { x: 1230, y: 0 } }),
    centro: CENTRO,
    lectura: { distancia: 1230, rumboDeg: 90, precision: 0, rumboPrecision: 0 },
  });
  assert.equal(indicativo, "Justa");
});
