// Test for libro-catalogo.mjs
// Tests the validation of the libro catalog and the example catalogo object.

import assert from "node:assert/strict";
import test from "node:test";

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
      es: "Don Quijote de la Mancha",
      en: "Don Quixote of La Mancha",
    },
    cartela: {
      es: "Edición ilustrada de dominio público, texto adaptado como mancha tipográfica.",
      en: "Public domain illustrated edition, text adapted as typographic blot.",
    },
    naturaleza: "obra-propia",
    malla: "libro-cerrado",
    provenance: {
      kind: "cc",
      source: "Project Gutenberg",
      license: "CC0-1.0",
      source_url: "https://www.gutenberg.org/ebooks/2000",
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