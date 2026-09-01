import assert from "node:assert/strict";
import test from "node:test";

import { resolverInteraccion } from "../scripts/interaccion-3d/contrato.mjs";
import { TERMINAL_DETERIORADO } from "../scripts/interaccion-3d/terminal-deteriorado.mjs";

test("el terminal deteriorado declara tres aproximaciones con dificultad creciente", () => {
  const dificultades = TERMINAL_DETERIORADO.aproximaciones.map((a) => a.dificultad);
  assert.deepEqual(dificultades, [0.75, 0.5, 0.25]);
});

test("recablear con cuidado, con suerte, repara el terminal sin ninguna regla de D&D", () => {
  const resultado = resolverInteraccion({
    objeto: TERMINAL_DETERIORADO,
    aproximacionId: "recablear-con-cuidado",
    tirada: 0.05,
  });
  assert.equal(resultado.banda, "critico");
  assert.equal(resultado.efecto.tipo, "reparado");
});

test("el golpe seco, con mala suerte, deja el terminal peor de lo que estaba", () => {
  const resultado = resolverInteraccion({
    objeto: TERMINAL_DETERIORADO,
    aproximacionId: "golpe-seco",
    tirada: 0.98,
  });
  assert.equal(resultado.banda, "pifia");
  assert.equal(resultado.efecto.tipo, "empeorado");
});

test("un fallo raso no cambia nada observable en la sala", () => {
  // dificultad 0.5, tirada 0.6 -> margen -0.1, dentro del margen de pifia -> fallo.
  const resultado = resolverInteraccion({
    objeto: TERMINAL_DETERIORADO,
    aproximacionId: "forzar-el-panel",
    tirada: 0.6,
  });
  assert.equal(resultado.banda, "fallo");
  assert.equal(resultado.efecto, null);
});
