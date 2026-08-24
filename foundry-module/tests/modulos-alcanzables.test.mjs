import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, posix, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Guarda de alcanzabilidad (#523).
//
// Un módulo con suite en verde y sin ningún importador está VIVO en CI y MUERTO
// en la partida: nadie puede llegar a él jugando. Que las pruebas pasen no dice
// nada al respecto, porque una prueba importa el módulo directamente y le da
// exactamente el mismo verde que a uno cableado — así es como #523 encontró
// cinco módulos huérfanos de golpe, todos ellos escritos, documentados y
// probados.
//
// Esta prueba recorre el grafo de imports desde los puntos de entrada REALES
// (los `esmodules` que declara `module.json`, no una lista escrita a mano aquí)
// y falla si algún módulo de `scripts/` queda fuera del alcance sin estar
// declarado abajo con su motivo.
//
// No prohíbe tener cimientos sin consumidor. Prohíbe tenerlos SIN DECIRLO: la
// opción que #523 descartó explícitamente es «existir sin que nadie sepa que
// existe».

const aqui = dirname(fileURLToPath(import.meta.url));
const raizModulo = resolve(aqui, "..");
const raizScripts = join(raizModulo, "scripts");

/** El inventario machine-readable de #701 sustituye la lista compartida local. */
const inventarioModulos = JSON.parse(
  readFileSync(resolve(raizModulo, "..", "docs", "orphan-declarations.json"), "utf8"),
);
const HUERFANOS_DECLARADOS = Object.freeze(
  Object.fromEntries(
    inventarioModulos.declarations
      .filter(({ status }) => status === "declared-orphan")
      .map((declaracion) => [declaracion.module, Object.freeze(declaracion)]),
  ),
);

/** Recorre `scripts/` y devuelve rutas relativas con separador POSIX. */
function modulosDeScripts(directorio = raizScripts) {
  const encontrados = [];
  for (const entrada of readdirSync(directorio, { withFileTypes: true })) {
    const completa = join(directorio, entrada.name);
    if (entrada.isDirectory()) {
      encontrados.push(...modulosDeScripts(completa));
      continue;
    }
    if (entrada.name.endsWith(".mjs")) {
      encontrados.push(relative(raizScripts, completa).split("\\").join("/"));
    }
  }
  return encontrados;
}

/**
 * Extrae los especificadores relativos que importa un módulo.
 *
 * Deliberadamente léxico y no un parser: cubre `import ... from "x"`,
 * `export ... from "x"` e `import("x")` dinámico, que es todo lo que este
 * módulo usa. Un especificador que no empiece por `.` es de Foundry o de Node y
 * no participa del grafo.
 */
function importsDe(rutaRelativa) {
  const fuente = readFileSync(join(raizScripts, rutaRelativa), "utf8");
  const especificadores = [];
  const patron = /(?:\bfrom\s*|\bimport\s*\(\s*)["'](\.[^"']+)["']/g;
  for (const coincidencia of fuente.matchAll(patron)) {
    especificadores.push(coincidencia[1]);
  }
  return especificadores;
}

/** Resuelve un especificador relativo a ruta relativa a `scripts/`. */
function resolverEspecificador(desde, especificador) {
  return posix.normalize(posix.join(posix.dirname(desde), especificador));
}

/** Puntos de entrada según `module.json`: la verdad la declara el manifiesto. */
function puntosDeEntrada() {
  const manifiesto = JSON.parse(readFileSync(join(raizModulo, "module.json"), "utf8"));
  const declarados = manifiesto.esmodules ?? [];
  assert.ok(declarados.length > 0, "module.json no declara ningún esmodule: el grafo no tiene raíz");
  return declarados.map((ruta) => posix.relative("scripts", ruta.split("\\").join("/")));
}

/** Cierre transitivo de imports desde los puntos de entrada. */
function alcanzables() {
  const vistos = new Set();
  const pendientes = [...puntosDeEntrada()];
  while (pendientes.length > 0) {
    const actual = pendientes.pop();
    if (vistos.has(actual)) continue;
    vistos.add(actual);
    for (const especificador of importsDe(actual)) {
      pendientes.push(resolverEspecificador(actual, especificador));
    }
  }
  return vistos;
}

test("todo módulo de scripts/ es alcanzable desde el manifiesto, o está declarado", () => {
  const alcance = alcanzables();
  const huerfanos = modulosDeScripts().filter((modulo) => !alcance.has(modulo));
  const noDeclarados = huerfanos.filter((modulo) => !(modulo in HUERFANOS_DECLARADOS));

  assert.deepEqual(
    noDeclarados,
    [],
    "Estos módulos no los importa nadie y no están declarados:\n" +
      noDeclarados.map((modulo) => `  - scripts/${modulo}`).join("\n") +
      "\n\nCablea el módulo a un consumidor real, retíralo, o —si hace falta " +
      "dejarlo— añádelo a HUERFANOS_DECLARADOS en este archivo con su motivo y el " +
      "issue donde se decide (#523). NO lo enumeres ademas en CLAUDE.md: ese " +
      "documento dice expresamente que los huecos VIVOS se listan aqui, porque " +
      "alli se desincronizan en cuanto uno se cierra. Un comentario que nombre " +
      "el módulo NO cuenta como " +
      "consumidor: es justo lo que se le escapó al barrido manual de #523.",
  );
});

test("la lista de huérfanos declarados no acumula entradas ya cableadas", () => {
  // Sin esto la lista se convierte en un cementerio: un módulo que se cablea
  // seguiría exento para siempre, y el siguiente huérfano en ese archivo pasaría
  // sin que nadie se enterase.
  const alcance = alcanzables();
  for (const modulo of Object.keys(HUERFANOS_DECLARADOS)) {
    assert.equal(
      alcance.has(modulo),
      false,
      `scripts/${modulo} ya tiene importador: quítalo de HUERFANOS_DECLARADOS y de CLAUDE.md.`,
    );
  }
});

test("cada huérfano declarado existe, explica por qué y cita su issue", () => {
  const existentes = new Set(modulosDeScripts());
  for (const [modulo, entrada] of Object.entries(HUERFANOS_DECLARADOS)) {
    assert.ok(existentes.has(modulo), `HUERFANOS_DECLARADOS nombra scripts/${modulo}, que no existe`);
    assert.ok(
      typeof entrada.reason === "string" && entrada.reason.length > 40,
      `El motivo de scripts/${modulo} es demasiado corto para ser una decisión escrita`,
    );
    assert.match(
      entrada.evidence?.url ?? "",
      /^https:\/\/github\.com\/VaroTv7\/espaciokooplagunak\/issues\/[1-9]\d*$/,
      `scripts/${modulo} no cita issue: sin conversación abierta esto es esconder, no declarar`,
    );
    assert.equal(typeof entrada.foundation, "boolean", `scripts/${modulo} no dice si es cimiento o hueco`);
  }
});

test("el grafo se recorre de verdad: main.mjs y una hoja conocida están dentro", () => {
  // Si `importsDe` deja de reconocer la sintaxis de import, todo pasaría a ser
  // huérfano y la prueba de arriba fallaría a lo grande — pero si el patrón se
  // rompiese al revés (alcance vacío tratado como todo alcanzable), no. Este
  // caso ancla el otro extremo.
  const alcance = alcanzables();
  assert.ok(alcance.has("main.mjs"), "main.mjs debería ser un punto de entrada");
  assert.ok(alcance.size > 50, `el grafo solo alcanza ${alcance.size} módulos: el recorrido está roto`);
  assert.ok(
    alcance.has("station-actions.mjs"),
    "station-actions.mjs es la matriz de autoridad y tiene que estar cableada",
  );
});
