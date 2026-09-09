import assert from "node:assert/strict";
import test from "node:test";

import { resolverInteraccion } from "../scripts/interaccion-3d/contrato.mjs";
import {
  ESTADOS_TERMINAL,
  TERMINAL_DETERIORADO,
  aplicarResultadoTerminal,
} from "../scripts/interaccion-3d/terminal-deteriorado.mjs";

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

test("efecto desconocido no convierte el estado serializable en una propiedad heredada", () => {
  for (const tipo of ["constructor", "__proto__", "toString", "desconocido"]) {
    const sala = { terminal: ESTADOS_TERMINAL.PARCIAL, id: "sala-1" };
    assert.deepEqual(aplicarResultadoTerminal(sala, { efecto: { tipo } }), sala);
  }
});

test("el contrato completo es determinista y preserva el estado fuente", () => {
  const entrada = { objeto: TERMINAL_DETERIORADO, aproximacionId: "forzar-el-panel", tirada: 0.1 };
  const sala = Object.freeze({ terminal: ESTADOS_TERMINAL.ORIGINAL });
  const a = resolverInteraccion(entrada);
  const b = resolverInteraccion(entrada);
  assert.deepEqual(a, b);
  assert.deepEqual(aplicarResultadoTerminal(sala, a), aplicarResultadoTerminal(sala, b));
  assert.equal(sala.terminal, ESTADOS_TERMINAL.ORIGINAL);
});

test("aplicarResultadoTerminal observa las tres transiciones del terminal", () => {
  const salaInicial = Object.freeze({ id: "sala-1", terminal: ESTADOS_TERMINAL.ORIGINAL });

  const critico = resolverInteraccion({
    objeto: TERMINAL_DETERIORADO,
    aproximacionId: "recablear-con-cuidado",
    tirada: 0.05,
  });
  const salaReparada = aplicarResultadoTerminal(salaInicial, critico);
  assert.equal(salaReparada.terminal, ESTADOS_TERMINAL.REPARADO);
  assert.equal(salaInicial.terminal, ESTADOS_TERMINAL.ORIGINAL, "no debe mutar la sala recibida");

  const exito = resolverInteraccion({
    objeto: TERMINAL_DETERIORADO,
    aproximacionId: "recablear-con-cuidado",
    tirada: 0.5,
  });
  assert.equal(exito.banda, "exito");
  const salaParcial = aplicarResultadoTerminal(salaInicial, exito);
  assert.equal(salaParcial.terminal, ESTADOS_TERMINAL.PARCIAL);

  const pifia = resolverInteraccion({
    objeto: TERMINAL_DETERIORADO,
    aproximacionId: "golpe-seco",
    tirada: 0.98,
  });
  const salaEmpeorada = aplicarResultadoTerminal(salaInicial, pifia);
  assert.equal(salaEmpeorada.terminal, ESTADOS_TERMINAL.EMPEORADO);

  const fallo = resolverInteraccion({
    objeto: TERMINAL_DETERIORADO,
    aproximacionId: "forzar-el-panel",
    tirada: 0.6,
  });
  const salaSinCambio = aplicarResultadoTerminal(salaInicial, fallo);
  assert.equal(salaSinCambio.terminal, ESTADOS_TERMINAL.ORIGINAL);
});
