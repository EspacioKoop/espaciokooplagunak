import assert from "node:assert/strict";
import test from "node:test";

import { CATALOGO_ANDAR } from "../scripts/nave-catalogo-andar.mjs";

// Regresión: el selector de estancias construía Object.keys(CATALOGO_ANDAR),
// que enumera los TRES métodos del catálogo (tiene/obtener/ids), no los ids
// de estancia reales. crearCatalogoEstancias expone `ids` como la lista real.
test("CATALOGO_ANDAR.ids son los ids de estancia reales, no los métodos del catálogo", () => {
  assert.ok(Array.isArray(CATALOGO_ANDAR.ids));
  assert.ok(CATALOGO_ANDAR.ids.length > 0);
  assert.ok(CATALOGO_ANDAR.ids.includes("cantina"), "cantina es una estancia real del catálogo");
  assert.ok(!CATALOGO_ANDAR.ids.includes("tiene"), "no debe colarse el nombre de un método");
  assert.ok(!CATALOGO_ANDAR.ids.includes("obtener"), "no debe colarse el nombre de un método");
  assert.deepEqual(
    Object.keys(CATALOGO_ANDAR).sort(),
    ["ids", "obtener", "tiene"],
    "Object.keys(CATALOGO_ANDAR) es justo la trampa: los métodos, no las salas",
  );
  for (const id of CATALOGO_ANDAR.ids) {
    assert.ok(CATALOGO_ANDAR.tiene(id), `cada id de la lista debe resolver contra el catálogo: ${id}`);
  }
});

test("_prepareContext (v2) y getData (v1) listan estancias reales del catálogo", async () => {
  const { crearClaseConvocatoriaV1, crearClaseConvocatoriaV2 } = await import(
    `../scripts/convocatoria-app.mjs?convocatoria-app-test=${Math.random()}`
  );

  const originales = { Application: globalThis.Application, foundry: globalThis.foundry };
  globalThis.Application = class {
    static get defaultOptions() {
      return {};
    }
  };
  globalThis.foundry = {
    applications: {
      api: {
        ApplicationV2: class {
          static DEFAULT_OPTIONS = {};
        },
        HandlebarsApplicationMixin: (Base) => class extends Base {},
      },
    },
    utils: { mergeObject: (a, b) => ({ ...a, ...b }) },
  };

  try {
    const ClaseV2 = crearClaseConvocatoriaV2({ onSubmit: () => {} });
    const v2 = new ClaseV2();
    const contextoV2 = await v2._prepareContext();
    const idsV2 = contextoV2.estancias.map((e) => e.id);
    assert.deepEqual(idsV2.sort(), [...CATALOGO_ANDAR.ids].sort());

    const ClaseV1 = crearClaseConvocatoriaV1({ onSubmit: () => {} });
    const v1 = new ClaseV1();
    const contextoV1 = await v1.getData();
    const idsV1 = contextoV1.estancias.map((e) => e.id);
    assert.deepEqual(idsV1.sort(), [...CATALOGO_ANDAR.ids].sort());
  } finally {
    Object.assign(globalThis, originales);
  }
});
