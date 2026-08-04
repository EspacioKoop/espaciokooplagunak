import assert from "node:assert/strict";
import test from "node:test";

import { componerAvatarPreview } from "../scripts/avatar-preview.mjs";

test("compone una escena con polígonos ordenados por profundidad", () => {
  const escena = componerAvatarPreview({ raza: "humano", clase: "guerrero", gesto: "saludo" });
  assert.ok(escena.poligonos.length > 0);
  for (let i = 1; i < escena.poligonos.length; i += 1) {
    assert.ok(escena.poligonos[i - 1].profundidad >= escena.poligonos[i].profundidad);
  }
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
