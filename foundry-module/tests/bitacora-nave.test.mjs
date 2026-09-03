import test from "node:test";
import assert from "node:assert/strict";
import {
  escapeHtml,
  fechaLocal,
  numeroBitacora,
  contenidoEstadoBitacora,
} from "../scripts/bitacora-nave.mjs";

// Helper to mock game object
function createGameMock({ lang = "en", localizeFn = (key) => key } = {}) {
  return {
    i18n: {
      lang,
      localize: localizeFn,
    },
  };
}

test("escapeHtml: escape & < > \\\" ' to numeric entities", () => {
  assert.equal(escapeHtml("&"), "&#38;");
  assert.equal(escapeHtml("<"), "&#60;");
  assert.equal(escapeHtml(">"), "&#62;");
  assert.equal(escapeHtml('"'), "&#34;");
  assert.equal(escapeHtml("'"), "'");
});

test("escapeHtml: text without special characters remains unchanged", () => {
  assert.equal(escapeHtml("hello world"), "hello world");
  assert.equal(escapeHtml(""), "");
  assert.equal(escapeHtml("123"), "123");
});

test("fechaLocal: with lang 'es' uses 'es-ES' locale", () => {
  const gameMock = createGameMock({ lang: "es" });
  global.game = gameMock;
  try {
    const result = fechaLocal();
    assert.ok(typeof result === "string" && result.length > 0);
  } finally {
    delete global.game;
  }
});

test("fechaLocal: with lang other than 'es' uses that lang as locale", () => {
  const gameMock = createGameMock({ lang: "fr" });
  global.game = gameMock;
  try {
    const result = fechaLocal();
    assert.ok(typeof result === "string" && result.length > 0);
  } finally {
    delete global.game;
  }
});

test("numeroBitacora: rounds finite numbers", () => {
  assert.equal(numeroBitacora(3.2), 3);
  assert.equal(numeroBitacora(3.5), 4); // Math.round(3.5) = 4
  assert.equal(numeroBitacora(-3.2), -3); // Math.round(-3.2) = -3
  assert.equal(numeroBitacora(-3.5), -3); // Math.round(-3.5) = -3 (not -4!)
});

test("numeroBitacora: non-finite numbers return 0", () => {
  assert.equal(numeroBitacora(NaN), 0);
  assert.equal(numeroBitacora(Infinity), 0);
  assert.equal(numeroBitacora(-Infinity), 0);
});

test("numeroBitacora: undefined returns 0", () => {
  assert.equal(numeroBitacora(undefined), 0);
});

test("numeroBitacora: non-numeric string returns 0", () => {
  assert.equal(numeroBitacora("abc"), 0);
  assert.equal(numeroBitacora("12abc"), 0);
});

test("numeroBitacora: numeric string is converted and rounded", () => {
  assert.equal(numeroBitacora("3.2"), 3);
  assert.equal(numeroBitacora("3.5"), 4);
});

test("contenidoEstadoBitacora: with complete ship data returns correct HTML", () => {
  const gameMock = createGameMock({
    lang: "en",
    localizeFn: (key) => key, // return the key as the localized string
  });
  global.game = gameMock;
  try {
    const nave = {
      callsign: "Lagunak",
      position: { x: 10, y: 20 },
      heading: 45,
      hull: 50,
      hull_max: 100,
      energy: 200,
      energy_max: 300,
      shields_active: true,
    };
    const marca = "2023-01-01 12:00";

    const result = contenidoEstadoBitacora(nave, marca);
    // Check that the callsign is escaped (though it doesn't need escaping in this case)
    assert.ok(result.includes("<strong>Lagunak</strong>"));
    // Check that the position numbers are present
    assert.ok(result.includes("10, 20"));
    // Check that the heading is present
    assert.ok(result.includes("45°"));
    // Check that hull and energy ratios are present
    assert.ok(result.includes("50 / 100"));
    assert.ok(result.includes("200 / 300"));
    // Check that the shield active string is present (the key)
    assert.ok(result.includes("LAGUNAK.EstadoNave.EscudosActivos"));
  } finally {
    delete global.game;
  }
});

test("contenidoEstadoBitacora: missing fields in nave default to 0", () => {
  const gameMock = createGameMock({
    lang: "en",
    localizeFn: (key) => key,
  });
  global.game = gameMock;
  try {
    const nave = {
      callsign: "Test",
      // missing position, heading, hull, hull_max, energy, energy_max, shields_active
    };
    const marca = "marca";

    const result = contenidoEstadoBitacora(nave, marca);
    // All numeric fields should be 0
    assert.ok(result.includes("0, 0")); // position.x, position.y
    assert.ok(result.includes("0°")); // heading
    assert.ok(result.includes("0 / 0")); // hull / hull_max
    assert.ok(result.includes("0 / 0")); // energy / energy_max
    // shields_active is undefined -> false -> EscudosInactivos
    assert.ok(result.includes("LAGUNAK.EstadoNave.EscudosInactivos"));
  } finally {
    delete global.game;
  }
});

test("contenidoEstadoBitacora: shields_active true and false use correct localization key", () => {
  const gameMock = createGameMock({
    lang: "en",
    localizeFn: (key) => key,
  });
  global.game = gameMock;
  try {
    const baseNave = {
      callsign: "Test",
      position: { x: 0, y: 0 },
      heading: 0,
      hull: 100,
      hull_max: 100,
      energy: 100,
      energy_max: 100,
    };
    const marca = "marca";

    // Test shields_active = true
    const naveTrue = { ...baseNave, shields_active: true };
    let resultTrue = contenidoEstadoBitacora(naveTrue, marca);
    assert.ok(resultTrue.includes("LAGUNAK.EstadoNave.EscudosActivos"));

    // Test shields_active = false
    const naveFalse = { ...baseNave, shields_active: false };
    let resultFalse = contenidoEstadoBitacora(naveFalse, marca);
    assert.ok(resultFalse.includes("LAGUNAK.EstadoNave.EscudosInactivos"));

    // Test shields_active missing (undefined) -> false
    const naveMissing = { ...baseNave };
    let resultMissing = contenidoEstadoBitacora(naveMissing, marca);
    assert.ok(resultMissing.includes("LAGUNAK.EstadoNave.EscudosInactivos"));
  } finally {
    delete global.game;
  }
});