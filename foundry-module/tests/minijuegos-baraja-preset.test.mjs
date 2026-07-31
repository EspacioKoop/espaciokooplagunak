import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { barajaOrdenada } from "../scripts/minijuegos/naipes.mjs";
import { cartaSvg } from "../scripts/minijuegos/cartas-pixelart.mjs";
import {
  CLAVE_PRESET,
  DIRECTORIO_CARTAS,
  barajaFoundry,
  cartaFoundry,
  entradaPreset,
  ficherosBaraja,
  nombreCarta,
  registrarPreset,
  rutaCarta,
} from "../scripts/minijuegos/baraja-preset.mjs";

const publicado = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "data",
  "cartas",
);

test("el mazo exportado tiene las 52 cartas con el vocabulario de Foundry", () => {
  const mazo = barajaFoundry();
  assert.equal(mazo.type, "deck");
  assert.equal(mazo.cards.length, 52);
  for (const carta of mazo.cards) {
    // `face: null` = boca abajo: el JSON de una baraja no reparte información.
    assert.equal(carta.face, null);
    assert.equal(carta.faces.length, 1);
    assert.match(carta.faces[0].img, /\.svg$/);
    assert.ok(carta.value >= 2 && carta.value <= 14);
    assert.ok("♣♦♥♠".includes(carta.suit));
  }
  const nombres = new Set(mazo.cards.map((c) => c.name));
  assert.equal(nombres.size, 52);
});

test("el nombre y la ruta de cada carta salen del código estable de la baraja", () => {
  const as = barajaOrdenada().find((c) => c.codigo === "As");
  assert.equal(nombreCarta("As"), "A♠");
  assert.equal(rutaCarta("As"), `${DIRECTORIO_CARTAS}/As.svg`);
  assert.equal(cartaFoundry(as).faces[0].img, rutaCarta("As"));
});

test("un código inválido no produce una carta aproximada", () => {
  assert.throws(() => nombreCarta("14s"), RangeError);
});

// El arte es la fuente; `data/cartas/` es derivado. Esta prueba es la que impide
// que se separen sin que nadie se entere.
test("lo publicado en data/cartas coincide con lo que genera el arte", async () => {
  const esperado = ficherosBaraja();
  const enDisco = await readdir(publicado);
  assert.deepEqual(
    enDisco.slice().sort(),
    [...esperado.keys()].sort(),
    "sobra o falta algún fichero: ejecuta tools/generar-baraja-preset.mjs",
  );
  for (const [nombre, contenido] of esperado) {
    const leido = await readFile(path.join(publicado, nombre), "utf8");
    assert.equal(
      leido,
      contenido,
      `${nombre} está desfasado: ejecuta tools/generar-baraja-preset.mjs`,
    );
  }
});

test("el SVG publicado de una carta es el que dibuja el arte", async () => {
  const leido = await readFile(path.join(publicado, "As.svg"), "utf8");
  assert.equal(leido.trim(), cartaSvg("As"));
});

test("el preset se registra con etiqueta de i18n y ruta al JSON publicado", () => {
  const entrada = entradaPreset();
  assert.equal(entrada.type, "deck");
  assert.match(entrada.label, /^LAGUNAK\./);
  assert.equal(entrada.src, `${DIRECTORIO_CARTAS}/baraja-lagunak.json`);

  const config = { Cards: { presets: {} } };
  assert.equal(registrarPreset(config), true);
  assert.deepEqual(config.Cards.presets[CLAVE_PRESET], entrada);
});

test("sin registro de presets no revienta el arranque del módulo", () => {
  assert.equal(registrarPreset({}), false);
  assert.equal(registrarPreset(undefined), false);
});
