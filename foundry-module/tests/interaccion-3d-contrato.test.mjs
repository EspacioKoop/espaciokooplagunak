import assert from "node:assert/strict";
import test from "node:test";

import {
  buscarAproximacion,
  declararAproximacion,
  declararObjetoInteractivo,
  resolverInteraccion,
} from "../scripts/interaccion-3d/contrato.mjs";
import { BANDAS } from "../scripts/interaccion-3d/resolucion.mjs";

function objetoDePrueba() {
  return declararObjetoInteractivo({
    id: "objeto-prueba",
    aproximaciones: [
      { id: "con-cuidado", dificultad: 0.8 },
      { id: "a-lo-bruto", dificultad: 0.2 },
    ],
    efectosPorBanda: {
      [BANDAS.CRITICO]: { tipo: "reparado" },
      [BANDAS.EXITO]: { tipo: "reparado-parcial" },
      [BANDAS.PIFIA]: { tipo: "empeorado" },
    },
  });
}

test("declararAproximacion exige id y dificultad en [0, 1]", () => {
  assert.throws(() => declararAproximacion({ id: "", dificultad: 0.5 }), TypeError);
  assert.throws(() => declararAproximacion({ id: "x", dificultad: 2 }), RangeError);
  const aproximacion = declararAproximacion({ id: "x", dificultad: 0.5, etiqueta: "X" });
  assert.equal(aproximacion.id, "x");
  assert.equal(aproximacion.etiqueta, "X");
  assert.ok(Object.isFrozen(aproximacion));
});

test("declararObjetoInteractivo rechaza aproximaciones repetidas", () => {
  assert.throws(
    () =>
      declararObjetoInteractivo({
        id: "x",
        aproximaciones: [
          { id: "a", dificultad: 0.5 },
          { id: "a", dificultad: 0.3 },
        ],
      }),
    RangeError,
  );
});

test("declararObjetoInteractivo rechaza una banda desconocida en efectosPorBanda", () => {
  assert.throws(
    () =>
      declararObjetoInteractivo({
        id: "x",
        aproximaciones: [{ id: "a", dificultad: 0.5 }],
        efectosPorBanda: { "gran-exito": { tipo: "x" } },
      }),
    RangeError,
  );
});

test("declararObjetoInteractivo exige al menos una aproximación", () => {
  assert.throws(() => declararObjetoInteractivo({ id: "x", aproximaciones: [] }), RangeError);
});

test("buscarAproximacion encuentra por id o devuelve null", () => {
  const objeto = objetoDePrueba();
  assert.equal(buscarAproximacion(objeto, "con-cuidado").dificultad, 0.8);
  assert.equal(buscarAproximacion(objeto, "no-existe"), null);
});

test("resolverInteraccion resuelve de principio a fin sin ningún adaptador externo", () => {
  const objeto = objetoDePrueba();
  const resultado = resolverInteraccion({ objeto, aproximacionId: "con-cuidado", tirada: 0.05 });
  assert.equal(resultado.objetoId, "objeto-prueba");
  assert.equal(resultado.aproximacionId, "con-cuidado");
  assert.equal(resultado.banda, BANDAS.CRITICO);
  assert.deepEqual(resultado.efecto, { tipo: "reparado" });
  assert.ok(Object.isFrozen(resultado));
});

test("una banda sin efecto declarado resuelve a null, no a un efecto inventado", () => {
  const objeto = objetoDePrueba();
  // dificultad 0.8, tirada 0.85 -> fallo raso (dentro del margen de pifia),
  // que este objeto no declara en efectosPorBanda.
  const resultado = resolverInteraccion({ objeto, aproximacionId: "con-cuidado", tirada: 0.85 });
  assert.equal(resultado.banda, BANDAS.FALLO);
  assert.equal(resultado.efecto, null);
});

test("resolverInteraccion rechaza una aproximación que el objeto no declara", () => {
  const objeto = objetoDePrueba();
  assert.throws(
    () => resolverInteraccion({ objeto, aproximacionId: "no-existe", tirada: 0.5 }),
    RangeError,
  );
});
