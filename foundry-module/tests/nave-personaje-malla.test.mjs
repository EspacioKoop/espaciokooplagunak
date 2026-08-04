import assert from "node:assert/strict";
import test from "node:test";

import { mallaPersonaje } from "../scripts/nave-personaje-malla.mjs";

function alturaMaxima(malla) {
  return Math.max(...malla.vertices.map(([, y]) => y));
}

function extensionZ(malla) {
  const zs = malla.vertices.map(([, , z]) => z);
  return Math.max(...zs) - Math.min(...zs);
}

test("de pie devuelve una malla válida con caras cerradas", () => {
  const malla = mallaPersonaje();
  assert.ok(malla.vertices.length > 0);
  assert.ok(malla.caras.every((cara) => cara.length >= 3));
  assert.ok(malla.caras.flat().every((indice) => indice < malla.vertices.length));
});

test("agachado es más bajo que de pie", () => {
  const dePie = mallaPersonaje();
  const agachado = mallaPersonaje({ agachado: true });
  assert.ok(alturaMaxima(agachado) < alturaMaxima(dePie));
});

test("saltando también es más bajo que de pie (piernas recogidas)", () => {
  const dePie = mallaPersonaje();
  const saltando = mallaPersonaje({ saltando: true });
  assert.ok(alturaMaxima(saltando) < alturaMaxima(dePie));
});

test("con fase de zancada, andar separa las piernas en Z más que quieto", () => {
  const quieto = mallaPersonaje({ faseCaminar: 0 });
  const andando = mallaPersonaje({ faseCaminar: Math.PI / 2 });
  assert.ok(extensionZ(andando) > extensionZ(quieto), "con la fase en su máximo, las piernas se separan");
});

test("agachado ignora la fase de zancada: no hay vaivén a media sentadilla", () => {
  const agachadoQuieto = mallaPersonaje({ agachado: true, faseCaminar: 0 });
  const agachadoAndando = mallaPersonaje({ agachado: true, faseCaminar: Math.PI / 2 });
  assert.equal(extensionZ(agachadoAndando), extensionZ(agachadoQuieto));
});
