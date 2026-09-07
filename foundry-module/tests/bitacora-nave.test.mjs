import test, { beforeEach, afterEach } from "node:test";
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

test("escapeHtml: escapa & < > \" ' a entidades numéricas", () => {
  assert.equal(escapeHtml("&"), "&#38;");
  assert.equal(escapeHtml("<"), "&#60;");
  assert.equal(escapeHtml(">"), "&#62;");
  assert.equal(escapeHtml('"'), "&#34;");
  assert.equal(escapeHtml("'"), "&#39;");
});

test("escapeHtml: text without special characters remains unchanged", () => {
  assert.equal(escapeHtml("hello world"), "hello world");
  assert.equal(escapeHtml(""), "");
  assert.equal(escapeHtml("123"), "123");
});

test("fechaLocal: with lang 'es' uses 'es-ES' locale", () => {
  const gameMock = createGameMock({ lang: "es" });
  global.game = gameMock;
  let localeUsed;
  const originalToLocaleString = Date.prototype.toLocaleString;
  Date.prototype.toLocaleString = function (locale) {
    localeUsed = locale;
    return "mocked date string";
  };
  try {
    const result = fechaLocal();
    assert.equal(result, "mocked date string");
    assert.equal(localeUsed, "es-ES");
  } finally {
    Date.prototype.toLocaleString = originalToLocaleString;
    delete global.game;
  }
});

test("fechaLocal: with lang other than 'es' uses that lang as locale", () => {
  const gameMock = createGameMock({ lang: "fr" });
  global.game = gameMock;
  let localeUsed;
  const originalToLocaleString = Date.prototype.toLocaleString;
  Date.prototype.toLocaleString = function (locale) {
    localeUsed = locale;
    return "mocked date string";
  };
  try {
    const result = fechaLocal();
    assert.equal(result, "mocked date string");
    assert.equal(localeUsed, "fr");
  } finally {
    Date.prototype.toLocaleString = originalToLocaleString;
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

// ---- Cobertura de contenidoEstadoBitacora contra HTML hostil (#734) --------
//
// beforeEach/afterEach y NO una asignación de módulo: `node:test` difiere la
// ejecución de los `test()` hasta que termina de evaluar todo el fichero, así
// que un `globalThis.game = ...` a nivel de módulo se pisa con el `delete
// global.game` que los tests de `fechaLocal` (más abajo) hacen en su propio
// `finally` — mismo objeto, y esos tests corren antes que este bloque.
beforeEach(() => {
  globalThis.game = {
    i18n: {
      lang: "es",
      localize: (key) => key,
    },
  };
});

afterEach(() => {
  delete globalThis.game;
});

const simpleNave = {
  callsign: "LLAMA",
  position: { x: 10.2, y: -5.3 },
  heading: 123,
  hull: 75,
  hull_max: 100,
  energy: 500,
  energy_max: 500,
  shields_active: true,
};

test("la entrada abre con un párrafo de cabecera que lleva el indicativo y el motivo", () => {
  const html = contenidoEstadoBitacora(simpleNave, "EQUIPO EMPARATADO");
  // Aserción ESTRUCTURAL, no de indentación: `startsWith("\n      <p>")` fijaba
  // cuántos espacios lleva la plantilla, que es irrelevante y rompe el test en
  // cuanto alguien reindenta el literal sin cambiar nada de lo que importa.
  const cabecera = html.match(/<p>(.*?)<\/p>/s);
  assert.ok(cabecera, `no hay párrafo de cabecera en:\n${html}`);
  assert.match(cabecera[1], /<strong>LLAMA<\/strong>/, "el indicativo va destacado");
  assert.ok(cabecera[1].includes("EQUIPO EMPARATADO"), "el motivo va en la cabecera");
});

const hostilNave = {
  callsign: "<script>hack</script>",
  position: { x: 0, y: 0 },
  heading: 0,
  hull: 0,
  hull_max: 0,
  energy: 0,
  energy_max: 0,
  shields_active: false,
};

test("entrada con etiquetas HTML se escapa correctamente", () => {
  const html = contenidoEstadoBitacora(hostilNave, "TEST");
  assert.ok(html.includes("&#60;script&#62;hack&#60;/script&#62;"));
  assert.doesNotMatch(html, /<script|<\/script>/i);
});

test("entrada con atributos HTML no produce una etiqueta interpretable", () => {
  const html = contenidoEstadoBitacora(
    { ...hostilNave, callsign: '<img src=x onerror="alert(1)">' },
    "TEST",
  );
  assert.ok(html.includes("&#60;img"));
  assert.doesNotMatch(html, /<img\b/i);
});

const quotedNave = {
  callsign: "O'RLYNN \"DRACO\"",
  position: { x: 1, y: 2 },
  heading: 90,
  hull: 50,
  hull_max: 100,
  energy: 200,
  energy_max: 400,
  shields_active: false,
};

test("entrada con comillas especiales se escapa", () => {
  const html = contenidoEstadoBitacora(quotedNave, "TEST");
  assert.ok(html.includes("O&#39;RLYNN &#34;DRACO&#34;"));
});

const emptyNave = {
  callsign: undefined,
  position: {},
  heading: null,
  hull: null,
  hull_max: null,
  energy: null,
  energy_max: null,
  shields_active: undefined,
};

test("sin indicativo, el hueco del indicativo es el que lleva la interrogación", () => {
  const html = contenidoEstadoBitacora(emptyNave, "TEST");
  // `includes("?")` podía acertar en cualquier otra parte del documento. Lo que
  // hay que comprobar es el HUECO CONCRETO: el `<strong>` de la cabecera, que
  // es donde va el indicativo.
  const indicativo = html.match(/<strong>(.*?)<\/strong>/s);
  assert.ok(indicativo, `no hay indicativo en:\n${html}`);
  assert.equal(indicativo[1], "?");

  // Y el resto de campos ausentes caen a cero, no a "undefined" ni a "null"
  // impresos en la bitácora que lee la mesa.
  assert.doesNotMatch(html, /undefined|null|NaN/, "un valor ausente no se imprime crudo");
});

const longNave = {
  callsign: "LONGCALLSIGN" + "A".repeat(800),
  position: { x: 1234567890, y: 987654321 },
  heading: 999,
  hull: 123456789,
  hull_max: 987654321,
  energy: 1234567890,
  energy_max: 9876543210,
  shields_active: true,
};

test("una entrada con valores enormes sigue produciendo la misma estructura acotada", () => {
  const html = contenidoEstadoBitacora(longNave, "TEST");
  // `typeof html === "string"` solo demostraba que la función no lanzó. La
  // propiedad útil y acotada es que la FORMA no depende del tamaño del dato:
  // una cabecera, una lista, y sus cinco campos — ni uno más por ser el
  // indicativo de 800 caracteres.
  assert.equal((html.match(/<li>/g) ?? []).length, 5, "los cinco campos, ni más ni menos");
  assert.equal((html.match(/<ul>/g) ?? []).length, 1, "una sola lista");
  assert.equal((html.match(/<strong>/g) ?? []).length, 1, "un solo indicativo");

  // El indicativo entra entero y sin trocear la estructura: el riesgo de un
  // valor largo no es que se corte, es que se lleve por delante el marcado.
  const indicativo = html.match(/<strong>(.*?)<\/strong>/s)[1];
  assert.equal(indicativo, longNave.callsign);
  assert.doesNotMatch(indicativo, /[<>]/, "nada interpretable dentro del indicativo");
});

// Sin `delete` aquí a propósito: `node:test` difiere la ejecución de los
// `test()` hasta que termina de evaluarse todo el módulo, así que borrar
// `globalThis.game` en este punto lo haría ANTES de que corriera ningún test
// (el de arriba incluido). Los tres tests de abajo ya ponen y quitan su
// propio `global.game` con try/finally, así que dejarlo puesto no les afecta.
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
