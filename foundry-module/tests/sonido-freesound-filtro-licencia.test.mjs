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

test("un host ajeno con la misma ruta de licencia se rechaza (fail-closed real)", () => {
  // El clasificador original solo comprobaba la subcadena de RUTA en la URL
  // entera: un host cualquiera con "/licenses/by/4.0/" en su path clasificaba
  // como CC-BY aunque el dominio no fuera creativecommons.org.
  const r = clasificarLicencia("https://example.invalid/licenses/by/4.0/");
  assert.equal(r.codigo, CODIGOS.DESCONOCIDA);
  assert.equal(r.mostrable, false);
});

test("un subdominio o dominio parecido a creativecommons.org se rechaza", () => {
  for (const url of [
    "https://creativecommons.org.evil.example/licenses/by/4.0/",
    "https://not-creativecommons.org/licenses/by/4.0/",
    "https://sub.creativecommons.org/licenses/by/4.0/",
    "https://creativecommons.org.attacker.com/licenses/by/4.0/",
  ]) {
    const r = clasificarLicencia(url);
    assert.equal(r.codigo, CODIGOS.DESCONOCIDA, `debe rechazar: ${url}`);
    assert.equal(r.mostrable, false);
  }
});

test("una ruta ambigua o desconocida en el host correcto también falla cerrado", () => {
  for (const url of [
    "https://creativecommons.org/licenses/",
    "https://creativecommons.org/licenses/by",
    "https://creativecommons.org/licenses/by/4.0/legalcode/extra",
    "https://creativecommons.org/otra-cosa/",
  ]) {
    const r = clasificarLicencia(url);
    assert.equal(r.codigo, CODIGOS.DESCONOCIDA, `debe rechazar: ${url}`);
  }
});

test("una URL sin sintaxis válida no lanza y falla cerrado", () => {
  const r = clasificarLicencia("no-es-una-url");
  assert.equal(r.codigo, CODIGOS.DESCONOCIDA);
  assert.equal(r.mostrable, false);
});
