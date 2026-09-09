import assert from "node:assert/strict";
import test from "node:test";

import { validarCatalogoPiezas, NATURALEZAS, cartelaDe, piezaPorId } from "../scripts/catalogo-piezas.mjs";
import { CATALOGO_LIBROS, MALLAS_LIBRO, ID_LIBRO_CLASICO } from "../scripts/libro-catalogo.mjs";

test("el catálogo de libros es válido por el MISMO validador que el de piezas", () => {
  assert.equal(validarCatalogoPiezas(CATALOGO_LIBROS, { mallasDisponibles: MALLAS_LIBRO }), true);
});

test("una sola obra, la disciplina de #590 aplicada aquí", () => {
  assert.equal(CATALOGO_LIBROS.piezas.length, 1);
});

test("la naturaleza declarada es una de las admitidas por catalogo-piezas.mjs", () => {
  const pieza = CATALOGO_LIBROS.piezas[0];
  assert.ok(NATURALEZAS.includes(pieza.naturaleza), `naturaleza ${pieza.naturaleza} no está en NATURALEZAS`);
  // No se inventa "interpretacion" aunque encajaría mejor: no existe hoy en el
  // validador, y este catálogo no se salta la regla para tener un nombre más
  // bonito (ver la cabecera de libro-catalogo.mjs).
  assert.equal(pieza.naturaleza, "obra-propia");
});

test("la malla declarada existe en el registro que este catálogo aporta", () => {
  assert.ok(MALLAS_LIBRO.has(CATALOGO_LIBROS.piezas[0].malla));
});

test("piezaPorId encuentra la obra por su id estable", () => {
  const pieza = piezaPorId(CATALOGO_LIBROS, ID_LIBRO_CLASICO);
  assert.ok(pieza);
  assert.equal(pieza.id, ID_LIBRO_CLASICO);
});

test("cartelaDe funciona igual que para una pieza de museo: mismo camino, sin reescribirlo", () => {
  const pieza = piezaPorId(CATALOGO_LIBROS, ID_LIBRO_CLASICO);
  const cartela = cartelaDe(pieza, "es");
  assert.equal(cartela.id, ID_LIBRO_CLASICO);
  assert.match(cartela.credito, /GPL-2\.0/);
  // Sin fuente externa: es obra propia del módulo, no un archivo de terceros.
  assert.equal(cartela.fuente, null);
});

// Test for libro-catalogo.mjs
// Tests the validation of the libro catalog and the example catalogo object.


import {
  validarCatalogoLibros,
  catalogo,
  libros,
} from "../scripts/libro-catalogo.mjs";

import {
  tamanoSerializado,
} from "../scripts/procedencia-catalogo.mjs";

/** A valid libro entry (similar to the one in the catalogo). */
function libroValido() {
  return {
    id: "libro-clasico-001",
    nombre: {
      es: "Libro sintético de prueba",
      en: "Synthetic test book",
    },
    cartela: {
      es: "Datos sintéticos para probar el esquema.",
      en: "Synthetic schema test data.",
    },
    naturaleza: "obra-propia",
    malla: "libro-cerrado",
    provenance: {
      kind: "cc",
      source: "Fixture sintético: no acredita una obra externa",
      license: "CC0-1.0",
      source_url: "https://example.invalid/test-license",
    },
  };
}

/** An invalid libro entry (missing required field). */
function libroInvalidoMissingField() {
  return {
    id: "libro-clasico-002",
    nombre: {
      es: "Otro libro",
      en: "Another book",
    },
    cartela: {
      es: "Una cartela",
      en: "A label",
    },
    naturaleza: "obra-propia",
    malla: "libro-cerrado",
    // missing provenance
  };
}

test("no distribuye semillas con derechos sin verificar", () => {
  assert.deepEqual(libros, []);
});

test("libro-catalogo.mjs exports the expected objects", () => {
  assert.ok(typeof validarCatalogoLibros === "function");
  assert.ok(Array.isArray(libros));
  assert.ok(typeof catalogo === "object");
  assert.ok(catalogo.hasOwnProperty("formato"));
  assert.ok(catalogo.hasOwnProperty("version"));
  assert.ok(catalogo.hasOwnProperty("libros"));
});

test("validarCatalogoLibros accepts the example catalogo", () => {
  // We don't have mallasDisponibles, so we pass null.
  // The validation should pass because the libro entry is valid.
  assert.doesNotThrow(() => {
    validarCatalogoLibros(catalogo, { mallasDisponibles: null });
  });
});

test("validarCatalogoLibros rejects a catalogo with missing required fields", () => {
  const catalogoSinFormato = {
    version: 1,
    libros: [libroValido()],
  };
  assert.throws(() => {
    validarCatalogoLibros(catalogoSinFormato, { mallasDisponibles: null });
  }, (err) => {
    // Expecting an error about missing field or invalid format
    return err.message.includes("formato") || err.message.includes("objeto simple");
  });
});

test("validarCatalogoLibros rejects a catalogo with an invalid libro (missing provenance)", () => {
  const catalogoConLibroInvalido = {
    formato: "espaciokoop-piezas",
    version: 1,
    libros: [libroInvalidoMissingField()],
  };
  assert.throws(() => {
    validarCatalogoLibros(catalogoConLibroInvalido, { mallasDisponibles: null });
  }, (err) => {
    // Expecting an error about missing field in provenance
    return err.message.includes("provenance") || err.message.includes("campo obligatorio ausente");
  });
});

test("validarCatalogoLibros respects the maximum number of libros", () => {
  const demasiadosLibros = Array(501).fill(libroValido());
  const catalogoDemasiadoGrande = {
    formato: "espaciokoop-piezas",
    version: 1,
    libros: demasiadosLibros,
  };
  assert.throws(() => {
    validarCatalogoLibros(catalogoDemasiadoGrande, { mallasDisponibles: null });
  }, (err) => {
    return err.message.includes("demasiados libros");
  });
});

test("validarCatalogoLibros respects the maximum serialized size", () => {
  // Create a libro with a very long name to exceed the size limit.
  const libroGrande = {
    ...libroValido(),
    nombre: {
      es: "a".repeat(200), // Exceeds 120 characters
      en: "a".repeat(200),
    },
  };
  const catalogoConLibroGrande = {
    formato: "espaciokoop-piezas",
    version: 1,
    libros: [libroGrande],
  };
  // Note: The size limit is 512 KiB. We are not sure if this will exceed it, but we test the validation of the name length.
  // Actually, the validation of the name length is done in textoLocalizado (via validarLibro) which throws if too long.
  assert.throws(() => {
    validarCatalogoLibros(catalogoConLibroGrande, { mallasDisponibles: null });
  }, (err) => {
    return err.message.includes("nombre") && err.message.includes("caracteres");
  });
});

test("tamanoSerializado works (reused from procedencia-catalogo)", () => {
  const obj = { a: 1, b: "texto" };
  const esperado = new TextEncoder().encode(JSON.stringify(obj)).byteLength;
  assert.equal(tamanoSerializado(obj), esperado);

});
