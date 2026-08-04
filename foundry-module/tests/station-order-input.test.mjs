import assert from "node:assert/strict";
import test from "node:test";

import { ORDER_FORMS, parseOrderValue } from "../scripts/station-order-forms.mjs";

// Regresión del input vacío: Number("") === 0 hacía que un envío sin dato pasara
// como orden válida a cero (rumbo/impulso/warp/nivel). parseOrderValue comprueba
// la presencia ANTES de convertir, y los predicados de rango ya rechazan null.

// Root DOM falso: devuelve el valor indicado por id de input.
function fakeRoot(values = {}) {
  return {
    querySelector(sel) {
      const id = sel.replace(/^#/, "");
      return id in values ? { value: values[id] } : null;
    },
  };
}

test("parseOrderValue rechaza ausencia y vacío (nunca lo trata como 0)", () => {
  assert.equal(parseOrderValue(null), null);
  assert.equal(parseOrderValue(undefined), null);
  assert.equal(parseOrderValue(""), null);
  assert.equal(parseOrderValue("   "), null);
  assert.equal(parseOrderValue("abc"), null);
});

test("parseOrderValue convierte texto numérico válido, incluido el cero explícito", () => {
  assert.equal(parseOrderValue("0"), 0);
  assert.equal(parseOrderValue("270"), 270);
  assert.equal(parseOrderValue(" -1 "), -1);
  assert.equal(parseOrderValue("3.5"), 3.5);
});

test("read() con input vacío NO devuelve params en rumbo, impulso y warp", () => {
  const inputs = {
    "orden-rumbo": "lagunak-orden-rumbo",
    "orden-impulso": "lagunak-orden-impulso",
    "orden-warp": "lagunak-orden-warp",
  };
  for (const [form, inputId] of Object.entries(inputs)) {
    const spec = ORDER_FORMS[form];
    assert.equal(spec.read(fakeRoot({ [inputId]: "" })), null, `${form} vacío no debe emitir`);
    assert.equal(spec.read(fakeRoot({ [inputId]: "   " })), null, `${form} espacios no debe emitir`);
    assert.equal(spec.read(fakeRoot({})), null, `${form} sin input no debe emitir`);
  }
});

test("read() de potencia rechaza el nivel vacío aunque el sistema sea válido", () => {
  const spec = ORDER_FORMS["orden-potencia"];
  assert.equal(
    spec.read(fakeRoot({ "lagunak-orden-sistema": "reactor", "lagunak-orden-nivel": "" })),
    null,
    "nivel vacío no debe emitir",
  );
});

test("read() de refrigerante valida sistema y nivel 0..10 entero (#301)", () => {
  const spec = ORDER_FORMS["orden-refrigerante"];
  // Válido, incluido el cero explícito.
  assert.deepEqual(
    spec.read(fakeRoot({ "lagunak-orden-sistema-refrig": "impulse", "lagunak-orden-nivel-refrig": "0" })),
    { system: "impulse", level: 0 },
  );
  assert.deepEqual(
    spec.read(fakeRoot({ "lagunak-orden-sistema-refrig": "reactor", "lagunak-orden-nivel-refrig": "10" })),
    { system: "reactor", level: 10 },
  );
  // Nivel vacío, fuera de rango o no entero → no emite.
  assert.equal(spec.read(fakeRoot({ "lagunak-orden-sistema-refrig": "reactor", "lagunak-orden-nivel-refrig": "" })), null);
  assert.equal(spec.read(fakeRoot({ "lagunak-orden-sistema-refrig": "reactor", "lagunak-orden-nivel-refrig": "11" })), null);
  assert.equal(spec.read(fakeRoot({ "lagunak-orden-sistema-refrig": "reactor", "lagunak-orden-nivel-refrig": "5.5" })), null);
  // Sistema inválido con nivel válido → no emite.
  assert.equal(spec.read(fakeRoot({ "lagunak-orden-sistema-refrig": "inventado", "lagunak-orden-nivel-refrig": "3" })), null);
});

test("read() admite el cero explícito donde el rango lo permite", () => {
  assert.deepEqual(ORDER_FORMS["orden-rumbo"].read(fakeRoot({ "lagunak-orden-rumbo": "0" })), { heading: 0 });
  assert.deepEqual(ORDER_FORMS["orden-impulso"].read(fakeRoot({ "lagunak-orden-impulso": "0" })), { value: 0 });
  assert.deepEqual(ORDER_FORMS["orden-warp"].read(fakeRoot({ "lagunak-orden-warp": "0" })), { level: 0 });
});

test("read() rechaza valores fuera de rango de cada spec", () => {
  assert.equal(ORDER_FORMS["orden-rumbo"].read(fakeRoot({ "lagunak-orden-rumbo": "360" })), null);
  assert.equal(ORDER_FORMS["orden-impulso"].read(fakeRoot({ "lagunak-orden-impulso": "2" })), null);
  assert.equal(ORDER_FORMS["orden-warp"].read(fakeRoot({ "lagunak-orden-warp": "5" })), null);
  assert.equal(ORDER_FORMS["orden-warp"].read(fakeRoot({ "lagunak-orden-warp": "1.5" })), null);
});

test("read() de escaneo decodifica la lectura JSON del <select> (#462)", () => {
  const spec = ORDER_FORMS["orden-escanear"];
  const lectura = { distancia: 20000, rumboDeg: 90, precision: 1000, rumboPrecision: 15 };
  assert.deepEqual(
    spec.read(fakeRoot({ "lagunak-orden-objetivo-escaneo": JSON.stringify(lectura) })),
    lectura,
  );
});

test("read() de escaneo rellena precisión/rumboPrecision ausentes a 0", () => {
  const spec = ORDER_FORMS["orden-escanear"];
  const lectura = { distancia: 1230, rumboDeg: 90 };
  assert.deepEqual(
    spec.read(fakeRoot({ "lagunak-orden-objetivo-escaneo": JSON.stringify(lectura) })),
    { distancia: 1230, rumboDeg: 90, precision: 0, rumboPrecision: 0 },
  );
});

test("read() de escaneo no emite sin selección, con JSON roto, o sin distancia/rumbo", () => {
  const spec = ORDER_FORMS["orden-escanear"];
  assert.equal(spec.read(fakeRoot({})), null, "sin <select> no debe emitir");
  assert.equal(spec.read(fakeRoot({ "lagunak-orden-objetivo-escaneo": "" })), null, "vacío no debe emitir");
  assert.equal(
    spec.read(fakeRoot({ "lagunak-orden-objetivo-escaneo": "{no es json" })),
    null,
    "JSON roto no debe emitir",
  );
  assert.equal(
    spec.read(fakeRoot({ "lagunak-orden-objetivo-escaneo": JSON.stringify({ rumboDeg: 90 }) })),
    null,
    "sin distancia no debe emitir",
  );
  assert.equal(
    spec.read(fakeRoot({ "lagunak-orden-objetivo-escaneo": JSON.stringify({ distancia: 100 }) })),
    null,
    "sin rumbo no debe emitir",
  );
});

test("read() de fijar objetivo de armas decodifica la lectura JSON del <select> (#465)", () => {
  const spec = ORDER_FORMS["orden-fijar-objetivo-armas"];
  const lectura = { distancia: 20000, rumboDeg: 90, precision: 1000, rumboPrecision: 15 };
  assert.deepEqual(
    spec.read(fakeRoot({ "lagunak-orden-objetivo-armas": JSON.stringify(lectura) })),
    lectura,
  );
  assert.equal(spec.read(fakeRoot({})), null, "sin selección no debe emitir");
});

test("read() de disparar tubo exige objetivo Y tubo válido (#465)", () => {
  const spec = ORDER_FORMS["orden-disparar-tubo"];
  const lectura = { distancia: 20000, rumboDeg: 90 };
  const conObjetivo = (tubo) =>
    fakeRoot({ "lagunak-orden-objetivo-armas": JSON.stringify(lectura), "lagunak-orden-tubo": tubo });

  assert.deepEqual(spec.read(conObjetivo("2")), {
    distancia: 20000,
    rumboDeg: 90,
    precision: 0,
    rumboPrecision: 0,
    index: 2,
  });
  assert.equal(spec.read(conObjetivo("")), null, "tubo vacío no debe emitir");
  assert.equal(spec.read(conObjetivo("-1")), null, "tubo negativo no debe emitir");
  assert.equal(spec.read(conObjetivo("16")), null, "tubo fuera de la cota defensiva no debe emitir");
  assert.equal(spec.read(conObjetivo("1.5")), null, "tubo no entero no debe emitir");
  assert.equal(
    spec.read(fakeRoot({ "lagunak-orden-tubo": "0" })),
    null,
    "sin objetivo seleccionado no debe emitir aunque el tubo sea válido",
  );
});
