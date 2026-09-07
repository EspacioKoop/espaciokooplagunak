import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// Guarda de forma de las acciones de interacción.
//
// POR QUE EXISTE. Una escena declara puntos de interacción con una `accion`, y
// `andar-nave-app.mjs` es el único sitio que las interpreta. Las dos mitades no
// se comprueban entre sí: quien declara escribe un objeto literal y quien
// consume lee los campos que espera. Cuando no coinciden **no pasa nada** —no
// hay excepción, no hay aviso, no hay traza— y el punto de interacción queda
// mudo. Un `tipo` que nadie atiende cae en el `else` final; un campo con el
// nombre equivocado llega como `undefined` a un consumidor que lo trata como
// «no hay dato» y esconde la pantalla.
//
// Es el fallo más caro de detectar del módulo porque su síntoma es la AUSENCIA
// de síntoma: la suite sigue verde, el punto existe, la geometría es correcta y
// acercarse simplemente no hace nada. Está medido: en un solo día aparecieron
// cuatro variantes del mismo error (#689 en la convocatoria, #770 declarando
// `cartela:` donde el consumidor lee `accion.pieza`, la colocación del museo, y
// un rótulo de sala con `alCruzarSala` que nadie pasaba).
//
// QUE COMPRUEBA, y por qué así. El contrato NO se escribe aquí: se DERIVA del
// consumidor, leyendo qué campos usa para cada `tipo`. Una tabla escrita al
// lado sería una tercera copia que también puede desincronizarse — la misma
// regla que el cartel de reglas del blackjack (#553) o la planta del Phobos
// comparada con su `.lua` (#540).
//
// LO QUE NO PROHIBE. Un `tipo` sin consumidor es legítimo mientras no lleve
// datos: `terraza-cantina.mjs` declara `{ tipo: "pesca" }` a propósito y su
// cabecera dice que no se pesca. Declarar un tipo inerte es una decisión;
// declarar CAMPOS para un tipo que nadie lee es el error de #770.

const aqui = dirname(fileURLToPath(import.meta.url));
const raizModulo = resolve(aqui, "..");
const directorioScripts = join(raizModulo, "scripts");
const rutaConsumidor = join(directorioScripts, "andar-nave-app.mjs");

/** Todos los `.mjs` bajo `scripts/`, en rutas relativas con separador POSIX. */
function modulosDeScripts(directorio = directorioScripts) {
  const encontrados = [];
  for (const entrada of readdirSync(directorio, { withFileTypes: true })) {
    const completa = join(directorio, entrada.name);
    if (entrada.isDirectory()) encontrados.push(...modulosDeScripts(completa));
    else if (entrada.name.endsWith(".mjs")) encontrados.push(completa);
  }
  return encontrados;
}

/**
 * Qué campos lee el consumidor para cada `tipo`.
 *
 * Se recorta al cuerpo de `alAlcanzarInteraccion`, que es donde vive el
 * despacho, y de cada rama `accion?.tipo === "X"` se toman los `accion.<campo>`
 * que aparecen hasta la siguiente rama. Es un recorte deliberadamente estrecho:
 * fuera de ese bloque hay otros usos de `accion` que no son despacho.
 */
function camposQueLeeElConsumidor(fuente) {
  const inicio = fuente.indexOf("alAlcanzarInteraccion:");
  assert.notEqual(
    inicio,
    -1,
    "no se encontró `alAlcanzarInteraccion` en andar-nave-app.mjs: si el despacho se ha movido, " +
      "esta guarda hay que reapuntarla, no borrarla",
  );
  const fin = fuente.indexOf("alSalirDeInteraccion", inicio);
  assert.notEqual(fin, -1, "no se encontró el final del bloque de despacho");
  const bloque = fuente.slice(inicio, fin);

  // Cada rama empieza donde se compara el tipo y termina donde empieza la
  // siguiente comparación (o al acabar el bloque).
  const ramas = [...bloque.matchAll(/accion\?\.tipo === "([a-z-]+)"/g)];
  const porTipo = new Map();
  for (const [indice, rama] of ramas.entries()) {
    const desde = rama.index;
    const hasta = indice + 1 < ramas.length ? ramas[indice + 1].index : bloque.length;
    const cuerpo = bloque.slice(desde, hasta);
    const campos = new Set(
      [...cuerpo.matchAll(/accion\.([A-Za-z_$][\w$]*)/g)]
        .map((m) => m[1])
        .filter((campo) => campo !== "tipo"),
    );
    porTipo.set(rama[1], campos);
  }
  return porTipo;
}

/**
 * Las acciones declaradas por las escenas: `{ ruta, tipo, campos }`.
 *
 * Solo se acreditan objetos literales de una línea, que es como se escriben las
 * cinco que hay. Una declaración construida —extendida con spread, o con el
 * tipo en una variable— no se puede demostrar leyendo el texto y NO se acredita
 * en silencio: se lista aparte y la prueba avisa, porque una guarda que se cree
 * lo que no puede probar deja de ser una guarda.
 */
/**
 * Los campos de un literal `{ ... }`, o `null` si alguno no se puede demostrar.
 *
 * Se parte por comas de primer nivel y cada trozo tiene que ser una de dos
 * formas reconocibles: `clave: valor` o la **abreviada** `clave` a secas. La
 * abreviada es un campo igual que la otra —`{ tipo: "cartela", pieza }` declara
 * `pieza`— y no verla fue un falso negativo real de la primera versión: el
 * regex solo miraba `clave:`, así que acreditaba esa acción como si no tuviera
 * campos y la guarda la dejaba pasar.
 *
 * Cualquier otra cosa —`...spread`, una clave calculada, una coma dentro de un
 * valor— devuelve `null` y la declaración se lista como no demostrable en vez
 * de acreditarse a medias. Es la regla de `check_orphan_modules.py`: ante lo
 * que el lexer no pueda probar, no se afirma.
 */
function camposDelLiteral(cuerpo) {
  const campos = [];
  for (const trozo of cuerpo.split(",")) {
    const limpio = trozo.trim();
    if (limpio === "") continue;
    const conValor = limpio.match(/^([A-Za-z_$][\w$]*)\s*:\s*(.+)$/);
    if (conValor) {
      campos.push(conValor[1]);
      continue;
    }
    const abreviada = limpio.match(/^([A-Za-z_$][\w$]*)$/);
    if (abreviada) {
      campos.push(abreviada[1]);
      continue;
    }
    return null;
  }
  return campos.filter((campo) => campo !== "tipo");
}

function accionesDeclaradas(fuentes = null) {
  const acreditadas = [];
  const noDemostrables = [];
  const entradas =
    fuentes ??
    modulosDeScripts()
      .filter((ruta) => ruta !== rutaConsumidor)
      .map((ruta) => [ruta, readFileSync(ruta, "utf8")]);
  for (const [ruta, fuente] of entradas) {
    for (const linea of fuente.split("\n")) {
      if (!/\baccion:\s*\{/.test(linea)) continue;
      const literal = linea.match(/\baccion:\s*\{([^{}]*)\}/);
      const tipo = literal?.[1].match(/tipo:\s*"([a-z-]+)"/);
      const campos = literal ? camposDelLiteral(literal[1]) : null;
      if (!literal || !tipo || campos === null) {
        noDemostrables.push({ ruta, linea: linea.trim() });
        continue;
      }
      acreditadas.push({ ruta, tipo: tipo[1], campos });
    }
  }
  return { acreditadas, noDemostrables };
}

const consumidor = camposQueLeeElConsumidor(readFileSync(rutaConsumidor, "utf8"));
const { acreditadas, noDemostrables } = accionesDeclaradas();

test("el consumidor declara al menos un tipo de acción", () => {
  // Si esto falla, el recorte del bloque de despacho ha dejado de encontrar
  // nada y las demás pruebas pasarían por vacías, que es el fallo silencioso
  // que esta guarda existe para impedir.
  assert.ok(consumidor.size > 0, "no se extrajo ningún tipo de `alAlcanzarInteraccion`");
});

test("las escenas declaran acciones y todas se pueden leer del texto", () => {
  assert.ok(acreditadas.length > 0, "no se encontró ninguna `accion:` declarada en scripts/");
  assert.deepEqual(
    noDemostrables,
    [],
    "hay declaraciones de `accion` que esta guarda no puede comprobar leyendo el texto. " +
      "Escríbelas como objeto literal en una línea, o amplía la guarda a propósito",
  );
});

test("todo campo declarado en una acción lo lee su consumidor", () => {
  const huerfanos = [];
  for (const { ruta, tipo, campos } of acreditadas) {
    const leidos = consumidor.get(tipo);
    if (!leidos) continue; // Tipo sin consumidor: lo cubre la prueba siguiente.
    for (const campo of campos) {
      if (!leidos.has(campo)) {
        huerfanos.push(
          `${ruta.replace(raizModulo, "")}: { tipo: "${tipo}", ${campo}: … } — ` +
            `el consumidor lee ${[...leidos].map((c) => `accion.${c}`).join(", ") || "ningún campo"}`,
        );
      }
    }
  }
  assert.deepEqual(
    huerfanos,
    [],
    "un campo que el consumidor no lee llega como `undefined` y el punto de interacción se queda mudo, " +
      "sin excepción ni aviso: exactamente el fallo de #770",
  );
});

test("un tipo sin consumidor no lleva datos: o es inerte a propósito, o está roto", () => {
  const conDatosYSinConsumidor = acreditadas
    .filter(({ tipo, campos }) => !consumidor.has(tipo) && campos.length > 0)
    .map(({ ruta, tipo, campos }) => `${ruta.replace(raizModulo, "")}: tipo "${tipo}" con ${campos.join(", ")}`);
  assert.deepEqual(
    conDatosYSinConsumidor,
    [],
    "declarar campos para un tipo que nadie atiende es escribir la mitad de una feature. " +
      'Un tipo inerte SÍ vale —`{ tipo: "pesca" }` de la terraza es deliberado— pero entonces va sin datos',
  );
});

/* ---- regresiones del extractor (falso negativo encontrado en revisión) ----
 *
 * El fixture de abajo es literalmente el que Varo usó para romper la primera
 * versión: `{ tipo: "cartela", pieza }` con la propiedad abreviada. Pasaba las
 * cuatro pruebas porque el extractor solo veía `clave:`, así que acreditaba la
 * acción como si no declarara ningún campo — el caso contrario al que la guarda
 * existe para cazar.
 */

test("la propiedad abreviada cuenta como campo, no como su ausencia", () => {
  const fuente = 'const pieza = "x";\nexport const punto = { accion: { tipo: "cartela", pieza } };';
  const { acreditadas, noDemostrables } = accionesDeclaradas([["ficticio.mjs", fuente]]);
  assert.deepEqual(noDemostrables, []);
  assert.deepEqual(acreditadas, [{ ruta: "ficticio.mjs", tipo: "cartela", campos: ["pieza"] }]);
});

test("una abreviada con el nombre equivocado la caza la guarda", () => {
  // La misma forma, pero con el nombre que el consumidor NO lee: es el fallo de
  // #770 escrito en abreviado, y tiene que salir igual de rojo.
  const fuente = 'export const punto = { accion: { tipo: "cartela", cartela } };';
  const { acreditadas } = accionesDeclaradas([["ficticio.mjs", fuente]]);
  const leidos = consumidor.get("cartela");
  assert.deepEqual(acreditadas[0].campos, ["cartela"]);
  assert.equal(leidos.has("cartela"), false, "el consumidor lee accion.pieza, no accion.cartela");
});

test("lo que el extractor no puede demostrar no se acredita", () => {
  // Un spread puede meter cualquier campo, y una clave calculada no se sabe cuál
  // es. Ninguna de las dos se acredita a medias: se listan como no demostrables.
  const casos = [
    'export const a = { accion: { tipo: "cartela", ...extra } };',
    'export const b = { accion: { tipo: "cartela", [clave]: 1 } };',
  ];
  for (const fuente of casos) {
    const { acreditadas, noDemostrables } = accionesDeclaradas([["ficticio.mjs", fuente]]);
    assert.deepEqual(acreditadas, [], `no debería acreditarse: ${fuente}`);
    assert.equal(noDemostrables.length, 1, `debería listarse como no demostrable: ${fuente}`);
  }
});
