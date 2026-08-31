import assert from "node:assert/strict";
import test from "node:test";

let importNonce = 0;

async function loadSession({ isGM = true } = {}) {
  globalThis.game = { user: { isGM } };
  return import(`../scripts/sonido-freesound/session.mjs?test=${importNonce++}`);
}

test("la clave vive solo en memoria y se puede borrar", async () => {
  const m = await loadSession();
  assert.equal(m.getFreesoundKey(), "");
  assert.equal(m.setFreesoundKey("  clave-de-sesion  "), true);
  assert.equal(m.getFreesoundKey(), "clave-de-sesion");
  m.clearFreesoundKey();
  assert.equal(m.getFreesoundKey(), "");
});

test("un valor en blanco no se guarda como configurado", async () => {
  const m = await loadSession();
  assert.equal(m.setFreesoundKey("   "), false);
  assert.equal(m.getFreesoundKey(), "");
});

test("quien no es GM nunca lee la clave, aunque esté cargada", async () => {
  const m = await loadSession({ isGM: true });
  m.setFreesoundKey("clave-secreta");
  game.user.isGM = false;
  assert.equal(m.getFreesoundKey(), "");
  game.user.isGM = true;
  assert.equal(m.getFreesoundKey(), "clave-secreta");
});
