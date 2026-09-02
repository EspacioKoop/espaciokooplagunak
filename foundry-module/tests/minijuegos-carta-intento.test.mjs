import assert from "node:assert/strict";
import test from "node:test";

import { intentoDesdeArrastre } from "../scripts/minijuegos/carta-intento.mjs";

test("un arrastre válido se normaliza a la forma que espera el motor", () => {
  assert.deepEqual(intentoDesdeArrastre({ tipo: "mostrar", indice: 1 }), {
    tipo: "mostrar",
    parametros: { indice: 1 },
  });
});

test("rechaza cualquier tipo fuera del catálogo cerrado", () => {
  assert.equal(intentoDesdeArrastre({ tipo: "raise", indice: 0 }), null);
  assert.equal(intentoDesdeArrastre({ tipo: "fold", indice: 0 }), null);
});

test("rechaza payloads con forma incorrecta sin lanzar", () => {
  assert.equal(intentoDesdeArrastre(null), null);
  assert.equal(intentoDesdeArrastre(undefined), null);
  assert.equal(intentoDesdeArrastre({}), null);
  assert.equal(intentoDesdeArrastre({ tipo: "mostrar", indice: -1 }), null);
  assert.equal(intentoDesdeArrastre({ tipo: "mostrar", indice: "0" }), null);
  assert.equal(intentoDesdeArrastre({ tipo: "mostrar" }), null);
});
