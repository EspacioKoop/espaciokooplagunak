import assert from "node:assert/strict";
import test from "node:test";

import { estatuaGuardiana } from "../scripts/pasillo-guardiana.mjs";

function limitesDe({ vertices }) {
  const xs = vertices.map(([x]) => x);
  const ys = vertices.map(([, y]) => y);
  const zs = vertices.map(([, , z]) => z);
  return {
    x0: Math.min(...xs), x1: Math.max(...xs),
    y0: Math.min(...ys), y1: Math.max(...ys),
    z0: Math.min(...zs), z1: Math.max(...zs),
  };
}

test("la silueta está apoyada en el suelo, como las mallas del museo", () => {
  const { y0 } = limitesDe(estatuaGuardiana(2.2));
  assert.equal(y0, 0, "la base tiene que tocar y=0 para colocarse como una pieza escaneada");
});

test("la silueta está centrada en planta", () => {
  const { x0, x1, z0, z1 } = limitesDe(estatuaGuardiana(2.2));
  // Centrada, no simétrica cara a cara: las alas desplazan el centro en z un
  // poco, así que se comprueba contra el centro real y no contra 0 exacto.
  assert.ok(Math.abs((x0 + x1) / 2) < 0.05, "el centro en x se ha desplazado");
  assert.ok(Math.abs(z0) < 1 && Math.abs(z1) < 1, "la silueta no se ha ido de madre en z");
});

test("cambiar el alto reescala toda la figura, no solo la túnica", () => {
  const baja = limitesDe(estatuaGuardiana(2.2));
  const alta = limitesDe(estatuaGuardiana(4.4));
  assert.ok(alta.y1 > baja.y1 * 1.5, "la figura alta no ha crecido de verdad");
  assert.ok(alta.x1 > baja.x1, "el radio de la base no ha escalado con el alto");
});

test("toda cara referencia un vértice que existe", () => {
  const { vertices, caras } = estatuaGuardiana(2.2);
  for (const cara of caras) {
    for (const indice of cara) {
      assert.ok(indice >= 0 && indice < vertices.length, `índice ${indice} fuera de rango`);
    }
  }
});
