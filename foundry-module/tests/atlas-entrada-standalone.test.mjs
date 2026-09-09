import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { importarAtlas } from "../scripts/importador-atlas.mjs";
import { validateCosmography } from "../scripts/catalogo-cosmografico.mjs";
const cli = fileURLToPath(new URL("../../tools/importar-atlas.mjs", import.meta.url));
const csv = "id,hip,proper,ra,dec,dist,mag,absmag,spect,ci\n0,,Sol,0,0,0,-26.7,4.85,G2V,0.656\n";
function run(input, args = []) {
  return spawnSync(process.execPath, [cli, ...args], { input, encoding: "utf8", timeout: 10000, maxBuffer: 10 * 1024 * 1024 });
}
test("la entrada standalone ejecuta HYG → importador → JSON y conserva toda la procedencia", async () => {
  const expected = await importarAtlas(csv);
  const result = run(csv);
  assert.equal(result.status, 0, result.stderr);
  const actual = JSON.parse(result.stdout);
  assert.deepEqual(actual, expected);
  assert.equal(validateCosmography(actual), true);
  const star = actual.entries.find(e => e.type === "star_system");
  assert.equal(star.provenance.license, "CC BY-SA-4.0");
  assert.match(star.provenance.source, /HYG/);
});
test("el mismo consumidor acepta JSON sin perder atribución ni relaciones", async () => {
  const expected = await importarAtlas(csv);
  const result = run(JSON.stringify(expected));
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), expected);
});
test("la entrada rechaza basura y exceso sin publicar un catálogo parcial", () => {
  for (const input of ["dato-privado-invalido", "x".repeat(8 * 1024 * 1024 + 1)]) {
    const result = run(input);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.doesNotMatch(result.stderr, /dato-privado-invalido|\/home\//);
  }
  assert.equal(run("", ["--opcion-inexistente"]).status, 2);
});
