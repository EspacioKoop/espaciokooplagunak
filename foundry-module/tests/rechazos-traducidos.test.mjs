// Todo rechazo que una mesa pueda emitir tiene que estar traducido (#426).
//
// EL FALLO QUE ESTO IMPIDE. Los códigos de rechazo viajan como cadenas
// (`parametro_invalido`) y se pintan con `game.i18n.localize`. Foundry, cuando no
// encuentra una clave, NO falla: devuelve la clave. Así que un código sin
// traducir no rompe nada y no se ve en ninguna prueba — se ve en la mesa, en
// mitad de una partida, como un aviso que dice
// «LAGUNAK.Minijuegos.Rechazo.parametro_invalido».
//
// Pasó de verdad: los cinco códigos de la sesión estaban traducidos y los seis
// de los motores no, porque cada vertical añadió los suyos y nadie tenía la
// lista entera delante. Esta prueba ES esa lista.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { ERRORES as ERRORES_SESION } from "../scripts/minijuegos/sesion-motor.mjs";
import { ERRORES as ERRORES_POKER } from "../scripts/minijuegos/poker-motor.mjs";
import { ERRORES as ERRORES_DADOS } from "../scripts/minijuegos/dados-motor.mjs";

// El prefijo se compone en vez de escribirse entero: `localization.test.mjs`
// escanea las fuentes buscando literales `"LAGUNAK.*"` y tomaría esta cadena por
// una clave de verdad, que no existe y nunca existirá.
const PREFIJO = ["LAGUNAK", "Minijuegos", "Rechazo", ""].join(".");

const leer = (lang) =>
  JSON.parse(readFileSync(new URL(`../lang/${lang}.json`, import.meta.url), "utf8"));

// Todo lo que puede acabar en pantalla como motivo de rechazo. Un vertical
// nuevo añade su `ERRORES` aquí, y esa es toda la ceremonia.
const CODIGOS = [
  ...Object.values(ERRORES_SESION),
  ...Object.values(ERRORES_POKER),
  ...Object.values(ERRORES_DADOS),
];

for (const lang of ["es", "en"]) {
  test(`${lang}: cada código de rechazo tiene su texto`, () => {
    const textos = leer(lang);
    const sinTraducir = [...new Set(CODIGOS)].filter(
      (codigo) => !textos[`${PREFIJO}${codigo}`],
    );
    assert.deepEqual(sinTraducir, [], `códigos sin traducir en ${lang}`);
  });
}

test("los dos idiomas cubren exactamente los mismos rechazos", () => {
  // Traducir solo uno deja la mesa en inglés a medias sin que nadie se entere,
  // porque el que falta se ve igual de bien... en la clave cruda.
  const clavesDe = (lang) =>
    Object.keys(leer(lang))
      .filter((clave) => clave.startsWith(PREFIJO))
      .sort();
  assert.deepEqual(clavesDe("es"), clavesDe("en"));
});

test("ningún texto de rechazo se ha quedado vacío", () => {
  for (const lang of ["es", "en"]) {
    const textos = leer(lang);
    for (const [clave, valor] of Object.entries(textos)) {
      if (!clave.startsWith(PREFIJO)) continue;
      assert.ok(valor.trim().length > 0, `${lang}: ${clave} está vacío`);
    }
  }
});
