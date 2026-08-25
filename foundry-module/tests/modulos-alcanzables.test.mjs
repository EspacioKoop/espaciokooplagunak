import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// Guarda de alcanzabilidad (#523) delegada en el inventario conservador de #701.
//
// Un módulo con suite en verde y sin ningún importador está VIVO en CI y MUERTO
// en la partida. El script Python es la única implementación del contrato:
// `connected` exige un import literal completo, `declared-orphan` exige la
// decisión registrada y cualquier ambigüedad legítima queda como `unknown`.

const aqui = dirname(fileURLToPath(import.meta.url));
const raizModulo = resolve(aqui, "..");
const raizRepositorio = resolve(raizModulo, "..");
const rutaDeclaraciones = join(raizRepositorio, "docs", "orphan-declarations.json");
const rutaInventario = join(raizRepositorio, "scripts", "check_orphan_modules.py");

/** Recorre `scripts/` y devuelve rutas relativas con separador POSIX. */
function modulosDeScripts(directorio = join(raizModulo, "scripts")) {
  const encontrados = [];
  for (const entrada of readdirSync(directorio, { withFileTypes: true })) {
    const completa = join(directorio, entrada.name);
    if (entrada.isDirectory()) {
      encontrados.push(...modulosDeScripts(completa));
      continue;
    }
    if (entrada.name.endsWith(".mjs")) {
      encontrados.push(relative(join(raizModulo, "scripts"), completa).split("\\").join("/"));
    }
  }
  return encontrados.sort();
}

function ejecutarInventario({ root = raizModulo, declarations = rutaDeclaraciones } = {}) {
  return spawnSync(
    "python3",
    [
      rutaInventario,
      "--root",
      root,
      "--declarations",
      declarations,
      "--format",
      "json",
      "--check",
    ],
    { cwd: raizRepositorio, encoding: "utf8" },
  );
}

let inventarioCanonico;
function leerInventarioCanonico() {
  if (inventarioCanonico) return inventarioCanonico;
  const resultado = ejecutarInventario();
  assert.equal(
    resultado.status,
    0,
    "El inventario conservador no es válido. Corrige docs/orphan-declarations.json " +
      `o su consumidor scripts/check_orphan_modules.py:\n${resultado.stderr}`,
  );
  try {
    inventarioCanonico = JSON.parse(resultado.stdout);
    return inventarioCanonico;
  } catch (error) {
    assert.fail(`La salida derivada de docs/orphan-declarations.json no es JSON válido: ${error.message}`);
  }
}

test("docs/orphan-declarations.json produce exactamente un estado por módulo", () => {
  const inventario = leerInventarioCanonico();
  assert.deepEqual(
    inventario.map(({ module }) => module).sort(),
    modulosDeScripts(),
    "docs/orphan-declarations.json debe inventariar todos los módulos de foundry-module/scripts/",
  );
  assert.equal(new Set(inventario.map(({ module }) => module)).size, inventario.length);
});

test("cada huérfano declarado conserva decisión, procedencia y evidencia", () => {
  const inventario = leerInventarioCanonico();
  const declarados = inventario.filter(({ status }) => status === "declared-orphan");
  assert.ok(declarados.length > 0, "docs/orphan-declarations.json no conserva ningún huérfano declarado");
  for (const entrada of declarados) {
    assert.ok(
      typeof entrada.reason === "string" && entrada.reason.length > 40,
      `docs/orphan-declarations.json: el motivo de scripts/${entrada.module} es demasiado corto`,
    );
    assert.equal(
      typeof entrada.foundation,
      "boolean",
      `docs/orphan-declarations.json: scripts/${entrada.module} no decide si es cimiento`,
    );
    assert.ok(
      entrada.evidence,
      `docs/orphan-declarations.json: scripts/${entrada.module} no conserva evidencia`,
    );
  }
});

test("el grafo conservador alcanza el manifiesto y una hoja contractual", () => {
  const inventario = new Map(leerInventarioCanonico().map((entrada) => [entrada.module, entrada]));
  assert.equal(inventario.get("main.mjs")?.status, "connected");
  assert.equal(
    inventario.get("station-actions.mjs")?.status,
    "connected",
    "station-actions.mjs es la matriz de autoridad y tiene que estar cableada",
  );
  assert.ok(
    [...inventario.values()].filter(({ status }) => status === "connected").length > 50,
    "el grafo derivado de docs/orphan-declarations.json parece roto",
  );
});

test("la suite Node acepta unknown cuando solo hay registro dinámico ambiguo", () => {
  const temporal = mkdtempSync(join(tmpdir(), "inventario-node-"));
  try {
    const root = join(temporal, "foundry-module");
    const scripts = join(root, "scripts");
    const declarations = join(temporal, "docs", "orphan-declarations.json");
    mkdirSync(scripts, { recursive: true });
    mkdirSync(dirname(declarations), { recursive: true });
    writeFileSync(join(root, "module.json"), '{"esmodules":["scripts/main.mjs"]}');
    writeFileSync(
      join(scripts, "main.mjs"),
      'registerModule("./dynamic.mjs", () => globalThis.dynamicFactory);\n',
    );
    writeFileSync(join(scripts, "dynamic.mjs"), "export const dynamic = true;\n");
    writeFileSync(
      declarations,
      '{"schemaVersion":1,"declarations":[],"artModules":[]}\n',
    );

    const resultado = ejecutarInventario({ root, declarations });
    assert.equal(
      resultado.status,
      0,
      `Un unknown legítimo no debe invalidar docs/orphan-declarations.json: ${resultado.stderr}`,
    );
    const inventario = JSON.parse(resultado.stdout);
    assert.equal(inventario.find(({ module }) => module === "dynamic.mjs")?.status, "unknown");
  } finally {
    rmSync(temporal, { recursive: true, force: true });
  }
});
