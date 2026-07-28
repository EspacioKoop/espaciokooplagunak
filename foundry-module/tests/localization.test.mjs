import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { ERRORES } from "../scripts/minijuegos/sesion-motor.mjs";

const moduleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function catalog(language) {
  return JSON.parse(await readFile(path.join(moduleRoot, "lang", `${language}.json`), "utf8"));
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(target));
    else if (entry.name.endsWith(".mjs") || entry.name.endsWith(".hbs")) files.push(target);
  }
  return files;
}

test("los catálogos español e inglés mantienen paridad exacta", async () => {
  const [es, en] = await Promise.all([catalog("es"), catalog("en")]);
  assert.deepEqual(Object.keys(es).sort(), Object.keys(en).sort());
});

test("todas las claves estáticas usadas por scripts y plantillas existen", async () => {
  const [es, en, files] = await Promise.all([
    catalog("es"),
    catalog("en"),
    sourceFiles(moduleRoot),
  ]);
  const used = new Set();
  const expression = /["'](LAGUNAK\.[A-Za-z0-9_.]+)["']/g;
  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(expression)) used.add(match[1]);
  }
  const missingEs = [...used].filter((key) => !Object.hasOwn(es, key)).sort();
  const missingEn = [...used].filter((key) => !Object.hasOwn(en, key)).sort();
  assert.deepEqual(missingEs, [], `Faltan claves en es.json: ${missingEs.join(", ")}`);
  assert.deepEqual(missingEn, [], `Faltan claves en en.json: ${missingEn.join(", ")}`);
});

test("ninguna clave es a la vez hoja y rama (colisión que rompe expandObject de Foundry)", async () => {
  // Foundry expande las claves con puntos vía expandObject al cargar el catálogo.
  // Si una ruta existe como hoja ("A.B": "x") y como rama ("A.B.C": "y"), Foundry
  // intenta convertir el string en objeto, aborta el fichero entero y cae TODA la
  // i18n del módulo (regresión #258). Guardamos ambos idiomas.
  for (const language of ["es", "en"]) {
    const keys = Object.keys(await catalog(language));
    const colisiones = keys
      .filter((key) => keys.some((other) => other !== key && other.startsWith(`${key}.`)))
      .sort();
    assert.deepEqual(
      colisiones,
      [],
      `Claves hoja que también son rama en ${language}.json: ${colisiones.join(", ")}`,
    );
  }
});

test("el catálogo es-ES traduce sistemas, facciones y códigos visibles", async () => {
  const es = await catalog("es");
  assert.equal(es["LAGUNAK.Sistemas.beamweapons"], "Armas de haz");
  assert.equal(es["LAGUNAK.Sistemas.jumpdrive"], "Motor de salto");
  assert.equal(es["LAGUNAK.Facciones.HumanNavy"], "Armada Humana");
  assert.equal(es["LAGUNAK.Facciones.Ghosts"], "Fantasmas");
  assert.equal(es["LAGUNAK.Espacios.engineering.Codigo"], "ING");
  assert.equal(es["LAGUNAK.Espacios.weapons.Codigo"], "ARM");
});

test("las plantillas no exponen identificadores internos ingleses", async () => {
  const templates = await sourceFiles(path.join(moduleRoot, "templates"));
  const source = (await Promise.all(templates.map((file) => readFile(file, "utf8")))).join("\n");
  assert.doesNotMatch(source, /\b(?:beamweapons|missilesystem|jumpdrive|frontshield|rearshield|Human Navy|Independent)\b/);
});

test("todo motivo de rechazo de la mesa tiene texto en ES y EN", async () => {
  const [es, en] = await Promise.all([catalog("es"), catalog("en")]);
  // La clave se compone en tiempo de ejecución (`Rechazo.${codigo}`), así que
  // el rastreo de literales no la ve: un motivo nuevo en el motor se colaría
  // hasta la pantalla como clave cruda. Aquí se comprueba contra el motor.
  const codigos = [...Object.values(ERRORES), "desconocido"];
  for (const catalogo of [{ nombre: "es", claves: es }, { nombre: "en", claves: en }]) {
    const faltan = codigos.filter(
      (codigo) => !(`LAGUNAK.Minijuegos.Rechazo.${codigo}` in catalogo.claves),
    );
    assert.deepEqual(faltan, [], `Faltan motivos en ${catalogo.nombre}.json`);
  }
});
