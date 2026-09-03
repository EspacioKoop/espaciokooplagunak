import assert from "node:assert/strict";
import test from "node:test";

import { componerAvatarPreview } from "../../scripts/avatar/avatar-preview.mjs";
import { afirmarOrdenPorPintor } from "../ayuda-orden-pintor.mjs";

test("compone una escena con polígonos ordenados por profundidad", () => {
  const escena = componerAvatarPreview({ raza: "humano", clase: "guerrero", gesto: "saludo" });
  afirmarOrdenPorPintor(escena.poligonos, "el avatar de previsualización");
});

test("cada polígono trae un color de la paleta, no un literal", () => {
  const escena = componerAvatarPreview({});
  for (const poligono of escena.poligonos) {
    assert.equal(typeof poligono.color, "string");
    assert.ok(poligono.color.length > 0);
  }
});

test("una descripción distinta compone una escena distinta", () => {
  const a = componerAvatarPreview({ raza: "enano", silueta: "ancha" });
  const b = componerAvatarPreview({ raza: "elfo", silueta: "estrecha" });
  assert.notDeepEqual(a.poligonos, b.poligonos);
});

test("tolera una descripción vacía o corrupta sin lanzar", () => {
  assert.doesNotThrow(() => componerAvatarPreview({}));
  assert.doesNotThrow(() => componerAvatarPreview({ raza: 123, clase: null }));
});
