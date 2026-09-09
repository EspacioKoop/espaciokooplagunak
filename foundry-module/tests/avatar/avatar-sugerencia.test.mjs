import assert from "node:assert/strict";
import test from "node:test";

import { sugerirAvatarDesdeActor } from "../../scripts/avatar/avatar-sugerencia.mjs";

test("sin actor no hay sugerencia", () => {
  assert.deepEqual(sugerirAvatarDesdeActor(null, {}), {});
});

test("dnd5e v3: clase y raza como items tipados", () => {
  const actor = {
    items: [
      { type: "class", system: { identifier: "wizard" } },
      { type: "race", system: { identifier: "elf" } },
    ],
  };
  assert.deepEqual(sugerirAvatarDesdeActor(actor, {}), { clase: "mago", raza: "elfo" });
});

test("dnd5e v3: clase vía actor.classes cuando existe", () => {
  const actor = { classes: { fighter: {} }, items: [] };
  assert.deepEqual(sugerirAvatarDesdeActor(actor, {}), { clase: "guerrero" });
});

test("raza no licenciable cae en 'otra', nunca se inventa", () => {
  const actor = { items: [{ type: "race", system: { identifier: "tiefling" } }] };
  assert.deepEqual(sugerirAvatarDesdeActor(actor, {}), { raza: "otra" });
});

test("clase desconocida o multiclase rara no rompe: simplemente no sugiere clase", () => {
  const actor = { items: [{ type: "class", system: { identifier: "artificer" } }] };
  assert.deepEqual(sugerirAvatarDesdeActor(actor, {}), {});
});

test("ficha vacía no lanza y no sugiere nada", () => {
  assert.deepEqual(sugerirAvatarDesdeActor({ items: [] }, {}), {});
});
