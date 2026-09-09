import assert from "node:assert/strict";
import test from "node:test";

import { urlConHost } from "../scripts/sonido-freesound/url-host.mjs";

const FREESOUND = ["freesound.org"];

test("el host exacto pasa", () => {
  assert.equal(
    urlConHost("https://freesound.org/people/x/sounds/1/", FREESOUND)?.hostname,
    "freesound.org",
  );
});

test("un subdominio pasa por sufijo de punto", () => {
  assert.equal(
    urlConHost("https://cdn.freesound.org/previews/1/1-hq.mp3", FREESOUND)?.hostname,
    "cdn.freesound.org",
  );
});

test("un host que solo TERMINA en el dominio no pasa", () => {
  // La razón de que la comparación no sea `endsWith` a secas.
  assert.equal(urlConHost("https://evilfreesound.org/x", FREESOUND), null);
  assert.equal(urlConHost("https://freesound.org.evil.test/x", FREESOUND), null);
});

test("un host ajeno con la misma ruta no pasa", () => {
  assert.equal(urlConHost("https://example.invalid/previews/1/1-hq.mp3", FREESOUND), null);
});

test("el protocolo por defecto es solo https", () => {
  assert.equal(urlConHost("http://freesound.org/x", FREESOUND), null);
  assert.ok(urlConHost("http://freesound.org/x", FREESOUND, { protocolos: ["http:"] }));
});

test("javascript: y data: no pasan ni declarando su host", () => {
  assert.equal(urlConHost("javascript:alert(1)", FREESOUND), null);
  assert.equal(urlConHost("data:text/html,<script>", FREESOUND), null);
});

test("las credenciales embebidas descalifican la URL", () => {
  // Misma regla que `procedencia-catalogo.mjs`: una URL con usuario y
  // contraseña no es la fuente que dice ser.
  assert.equal(urlConHost("https://u:p@freesound.org/x", FREESOUND), null);
});

test("el host se compara sin distinguir mayúsculas", () => {
  assert.ok(urlConHost("https://CDN.FreeSound.ORG/previews/1/1.mp3", FREESOUND));
});

test("lo que no es una cadena, o no es una URL, devuelve null sin lanzar", () => {
  for (const valor of [null, undefined, 42, {}, "", "   ", "no-una-url"]) {
    assert.equal(urlConHost(valor, FREESOUND), null);
  }
});
