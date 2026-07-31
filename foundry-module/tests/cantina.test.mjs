import assert from "node:assert/strict";
import test from "node:test";

import { PUERTAS, puertaPorId, puertasCantina } from "../scripts/cantina.mjs";

test("el catálogo tiene hoy las dos mesas: póker y dados", () => {
  const puertas = puertasCantina();
  assert.deepEqual(puertas.map((p) => p.id), ["poker", "dados"]);
  for (const puerta of puertas) {
    assert.ok(puerta.tituloClave.startsWith("LAGUNAK."));
    assert.ok(puerta.icono.startsWith("fa-"));
  }
});

// La puerta dice a qué juego lleva; quien la abre no lo adivina. Si esto se
// pierde, añadir una puerta nueva vuelve a abrir el póker en silencio.
test("cada puerta declara el juego al que lleva", () => {
  for (const puerta of puertasCantina()) {
    assert.equal(typeof puerta.juego, "string");
    assert.ok(puerta.juego.length > 0, `la puerta ${puerta.id} no declara juego`);
  }
  assert.equal(puertaPorId("poker").juego, "poker");
});

test("puertasCantina() devuelve el mismo catálogo congelado, no una copia mutable", () => {
  assert.equal(puertasCantina(), PUERTAS);
  assert.throws(() => {
    PUERTAS.push({ id: "intruso" });
  });
});

test("puertaPorId encuentra la puerta existente y no inventa una para ids ajenos", () => {
  assert.equal(puertaPorId("poker")?.id, "poker");
  assert.equal(puertaPorId("dados")?.id, "dados");
  assert.equal(puertaPorId("tragaperras"), undefined);
  assert.equal(puertaPorId(""), undefined);
  assert.equal(puertaPorId(undefined), undefined);
});
