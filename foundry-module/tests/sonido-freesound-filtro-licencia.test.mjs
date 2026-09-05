import assert from "node:assert/strict";
import test from "node:test";
import { CODIGOS, clasificarLicencia } from "../scripts/sonido-freesound/filtro-licencia.mjs";

test("CC0 se clasifica y se muestra", () => {
  const r = clasificarLicencia("http://creativecommons.org/publicdomain/zero/1.0/");
  assert.equal(r.codigo, CODIGOS.CC0);
  assert.equal(r.mostrable, true);
  assert.equal(r.requiereAtribucion, false);
});

test("CC-BY se clasifica, se muestra y exige atribución", () => {
  const r = clasificarLicencia("https://creativecommons.org/licenses/by/4.0/");
  assert.equal(r.codigo, CODIGOS.CC_BY);
  assert.equal(r.mostrable, true);
  assert.equal(r.requiereAtribucion, true);
});

test("CC-BY-NC se reconoce por su nombre y nunca se muestra", () => {
  const r = clasificarLicencia("https://creativecommons.org/licenses/by-nc/4.0/");
  assert.equal(r.codigo, CODIGOS.CC_BY_NC);
  assert.equal(r.mostrable, false);
});

test("una licencia irreconocible falla cerrado", () => {
  const r = clasificarLicencia("https://example.com/alguna-otra-cosa/");
  assert.equal(r.codigo, CODIGOS.DESCONOCIDA);
  assert.equal(r.mostrable, false);
});

test("ausente, null o no-cadena fallan cerrado sin lanzar", () => {
  for (const valor of [undefined, null, "", 42, {}]) {
    const r = clasificarLicencia(valor);
    assert.equal(r.codigo, CODIGOS.DESCONOCIDA);
    assert.equal(r.mostrable, false);
  }
});

test("by-nc no cuela como by por coincidencia parcial de prefijo", () => {
  // Guarda de regresión: /licenses/by/ no debe capturar /licenses/by-nc/.
  const r = clasificarLicencia("https://creativecommons.org/licenses/by-nc-sa/4.0/");
  assert.notEqual(r.codigo, CODIGOS.CC_BY);
  assert.equal(r.mostrable, false);
});
