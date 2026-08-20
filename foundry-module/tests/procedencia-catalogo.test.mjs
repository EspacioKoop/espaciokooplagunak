import assert from "node:assert/strict";
import test from "node:test";

import {
  PATRON_ID,
  ErrorDeCatalogo,
  fallo,
  esObjetoSimple,
  clavesExactas,
  textoPlano,
  textoLocalizado,
  validarProcedencia,
  tamanoSerializado,
} from "../scripts/procedencia-catalogo.mjs";

/** Una procedencia mínima válida, para deformarla en cada caso. */
function procedenciaValida() {
  return {
    kind: "cc",
    source: "Un museo",
    license: "CC0 1.0",
    source_url: "https://commons.wikimedia.org/wiki/Category:Algo",
  };
}

function esperarCodigo(fn, code, path) {
  assert.throws(
    fn,
    (error) => {
      assert.equal(error.code, code);
      assert.equal(error.path, path);
      return true;
    },
  );
}

// 1. PATRON_ID: validar IDs portables

test("PATRON_ID acepta IDs válidos y rechaza los inválidos", () => {
  const validos = [
    "a",
    "a1",
    "a_b",
    "a-b",
    "abc123",
    "a-b-c_123",
    "a".repeat(64),
  ];
  for (const id of validos) {
    assert.ok(PATRON_ID.test(id), `ID válido: ${id}`);
  }

  const invalidos = [
    "",
    "A",
    "a b",
    "a.b",
    "a@b",
    "a".repeat(65),
    "a\n",
    "a\t",
  ];
  for (const id of invalidos) {
    assert.ok(!PATRON_ID.test(id), `ID inválido: ${id}`);
  }
});

// 2. ErrorDeCatalogo: verificar estructura

test("ErrorDeCatalogo tiene code, path y message", () => {
  const error = new ErrorDeCatalogo("test_code", "test.path", "mensaje de prueba");
  assert.equal(error.code, "test_code");
  assert.equal(error.path, "test.path");
  assert.equal(error.message, "test.path: mensaje de prueba");
  assert.equal(error.name, "ErrorDeCatalogo");
});

// 3. fallo: lanza ErrorDeCatalogo

test("fallo lanza ErrorDeCatalogo con los parámetros correctos", () => {
  assert.throws(
    () => fallo("test_code", "test.path", "mensaje de prueba"),
    (error) => {
      assert.equal(error.code, "test_code");
      assert.equal(error.path, "test.path");
      assert.equal(error.message, "test.path: mensaje de prueba");
      return true;
    },
  );
});

// 4. esObjetoSimple: validar objetos literales

test("esObjetoSimple distingue objetos literales de arrays e instancias", () => {
  assert.ok(esObjetoSimple({}), "objeto vacío");
  assert.ok(esObjetoSimple({ a: 1 }), "objeto con propiedades");
  assert.ok(!esObjetoSimple(null), "null");
  assert.ok(!esObjetoSimple([]), "array");
  assert.ok(!esObjetoSimple("string"), "string");
  assert.ok(!esObjetoSimple(42), "número");
  assert.ok(!esObjetoSimple(new Date()), "instancia con prototipo");
});

// 5. clavesExactas: validar claves permitidas y obligatorias

test("clavesExactas rechaza claves desconocidas y exige las obligatorias", () => {
  const permitidas = new Set(["a", "b", "c"]);
  const obligatorias = new Set(["a", "b"]);

  // Caso bueno: claves exactas
  assert.doesNotThrow(() => clavesExactas({ a: 1, b: 2 }, permitidas, obligatorias, "$"));

  // Clave desconocida
  esperarCodigo(
    () => clavesExactas({ a: 1, b: 2, d: 3 }, permitidas, obligatorias, "$"),
    "unknown_field",
    "$.d",
  );

  // Clave obligatoria ausente
  esperarCodigo(
    () => clavesExactas({ a: 1 }, permitidas, obligatorias, "$"),
    "missing_field",
    "$.b",
  );

  // No es objeto simple
  esperarCodigo(
    () => clavesExactas([], permitidas, obligatorias, "$"),
    "invalid_object",
    "$",
  );
});

// 6. textoPlano: validar texto sin controles ni etiquetas

test("textoPlano rechaza controles, etiquetas, espacios exteriores y texto vacío", () => {
  // Caso bueno
  assert.doesNotThrow(() => textoPlano("texto válido", "$", 100));

  // Texto vacío
  esperarCodigo(() => textoPlano("", "$", 100), "invalid_text", "$");

  // Espacios exteriores
  esperarCodigo(() => textoPlano(" texto", "$", 100), "invalid_text", "$");
  esperarCodigo(() => textoPlano("texto ", "$", 100), "invalid_text", "$");

  // Controles
  esperarCodigo(() => textoPlano("texto\x00", "$", 100), "unsafe_text", "$");
  esperarCodigo(() => textoPlano("texto\x1f", "$", 100), "unsafe_text", "$");

  // Etiquetas
  esperarCodigo(() => textoPlano("texto<tag>", "$", 100), "unsafe_text", "$");

  // Demasiado largo
  esperarCodigo(
    () => textoPlano("a".repeat(101), "$", 100),
    "invalid_text",
    "$",
  );
});

// 7. textoLocalizado: validar los dos idiomas

test("textoLocalizado exige los dos idiomas y valida su contenido", () => {
  // Caso bueno
  assert.doesNotThrow(() =>
    textoLocalizado({ es: "texto", en: "text" }, "$", 100),
  );

  // Falta un idioma
  esperarCodigo(
    () => textoLocalizado({ es: "texto" }, "$", 100),
    "missing_field",
    "$.en",
  );

  // Campo desconocido
  esperarCodigo(
    () => textoLocalizado({ es: "texto", en: "text", fr: "texte" }, "$", 100),
    "unknown_field",
    "$.fr",
  );

  // Texto inválido en español
  esperarCodigo(
    () => textoLocalizado({ es: "<texto>", en: "text" }, "$", 100),
    "unsafe_text",
    "$.es",
  );

  // Texto inválido en inglés
  esperarCodigo(
    () => textoLocalizado({ es: "texto", en: "<text>" }, "$", 100),
    "unsafe_text",
    "$.en",
  );
});

// 8. validarProcedencia: validar el bloque de procedencia

test("validarProcedencia exige kind, source y license, y valida source_url cuando kind es 'cc'", () => {
  // Caso bueno: kind 'cc' con source_url
  assert.doesNotThrow(() =>
    validarProcedencia(procedenciaValida(), "$"),
  );

  // Caso bueno: kind 'original' sin source_url
  assert.doesNotThrow(() =>
    validarProcedencia(
      { kind: "original", source: "Un museo", license: "CC0 1.0" },
      "$",
    ),
  );

  // Caso bueno: kind 'user_supplied' sin source_url
  assert.doesNotThrow(() =>
    validarProcedencia(
      { kind: "user_supplied", source: "Un usuario", license: "CC-BY-SA" },
      "$",
    ),
  );

  // Falta kind
  esperarCodigo(
    () => validarProcedencia({ source: "Un museo", license: "CC0 1.0" }, "$"),
    "missing_field",
    "$.kind",
  );

  // Falta source
  esperarCodigo(
    () =>
      validarProcedencia(
        { kind: "cc", license: "CC0 1.0", source_url: "https://ejemplo.test" },
        "$",
      ),
    "missing_field",
    "$.source",
  );

  // Falta license
  esperarCodigo(
    () =>
      validarProcedencia(
        { kind: "cc", source: "Un museo", source_url: "https://ejemplo.test" },
        "$",
      ),
    "missing_field",
    "$.license",
  );

  // kind desconocido
  esperarCodigo(
    () =>
      validarProcedencia(
        { kind: "desconocido", source: "Un museo", license: "CC0 1.0" },
        "$",
      ),
    "invalid_provenance",
    "$.kind",
  );

  // Campo desconocido
  esperarCodigo(
    () =>
      validarProcedencia(
        { kind: "cc", source: "Un museo", license: "CC0 1.0", extra: "valor" },
        "$",
      ),
    "unknown_field",
    "$.extra",
  );
});

test("validarProcedencia exige HTTPS y rechaza credenciales embebidas en source_url", () => {
  // HTTP en vez de HTTPS
  esperarCodigo(
    () =>
      validarProcedencia(
        {
          kind: "cc",
          source: "Un museo",
          license: "CC0 1.0",
          source_url: "http://ejemplo.test",
        },
        "$",
      ),
    "invalid_url",
    "$.source_url",
  );

  // URL inválida
  esperarCodigo(
    () =>
      validarProcedencia(
        {
          kind: "cc",
          source: "Un museo",
          license: "CC0 1.0",
          source_url: "no-es-una-url",
        },
        "$",
      ),
    "invalid_url",
    "$.source_url",
  );

  // Credenciales embebidas
  esperarCodigo(
    () =>
      validarProcedencia(
        {
          kind: "cc",
          source: "Un museo",
          license: "CC0 1.0",
          source_url: "https://usuario:contrasena@ejemplo.test",
        },
        "$",
      ),
    "invalid_url",
    "$.source_url",
  );

  // kind 'cc' sin source_url
  esperarCodigo(
    () =>
      validarProcedencia(
        { kind: "cc", source: "Un museo", license: "CC0 1.0" },
        "$",
      ),
    "missing_field",
    "$.source_url",
  );
});

test("validarProcedencia valida longitudes máximas", () => {
  // source demasiado largo
  esperarCodigo(
    () =>
      validarProcedencia(
        {
          kind: "cc",
          source: "a".repeat(161),
          license: "CC0 1.0",
          source_url: "https://ejemplo.test",
        },
        "$",
      ),
    "invalid_text",
    "$.source",
  );

  // license demasiado largo
  esperarCodigo(
    () =>
      validarProcedencia(
        {
          kind: "cc",
          source: "Un museo",
          license: "a".repeat(81),
          source_url: "https://ejemplo.test",
        },
        "$",
      ),
    "invalid_text",
    "$.license",
  );

  // source_url demasiado largo
  esperarCodigo(
    () =>
      validarProcedencia(
        {
          kind: "cc",
          source: "Un museo",
          license: "CC0 1.0",
          source_url: "https://" + "a".repeat(495),
        },
        "$",
      ),
    "invalid_text",
    "$.source_url",
  );
});

// 9. tamanoSerializado: calcular tamaño en bytes

test("tamanoSerializado devuelve el tamaño en bytes de la serialización JSON", () => {
  const objeto = { a: 1, b: "texto" };
  const serializado = JSON.stringify(objeto);
  const esperado = new TextEncoder().encode(serializado).byteLength;
  assert.equal(tamanoSerializado(objeto), esperado);

  // Error si no es serializable
  const noSerializable = { a: 1 };
  noSerializable.b = noSerializable; // Circular reference
  assert.throws(
    () => tamanoSerializado(noSerializable),
    (error) => {
      assert.equal(error.code, "not_serializable");
      return true;
    },
  );
});