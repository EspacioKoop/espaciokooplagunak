import assert from "node:assert/strict";
import test from "node:test";

import { prepararVistaPausa, resolverPausa } from "../scripts/pausa-control.mjs";

const i18n = { localize: (key) => key };

test("sin lectura confirmada: conectando, ambas órdenes deshabilitadas", () => {
  const r = resolverPausa({ conexion: "conectando", paused: null });
  assert.deepEqual(r, { estado: "conectando", puedePausar: false, puedeReanudar: false });
});

test("sondeo en error: desconectado, no se ordena a ciegas", () => {
  const r = resolverPausa({ conexion: "error", paused: false });
  assert.deepEqual(r, { estado: "desconectado", puedePausar: false, puedeReanudar: false });
});

test("en marcha: solo se puede pausar", () => {
  const r = resolverPausa({ conexion: "ok", paused: false });
  assert.deepEqual(r, { estado: "en_marcha", puedePausar: true, puedeReanudar: false });
});

test("pausado: solo se puede reanudar", () => {
  const r = resolverPausa({ conexion: "ok", paused: true });
  assert.deepEqual(r, { estado: "pausado", puedePausar: false, puedeReanudar: true });
});

test("orden de pausa en vuelo: pausando y NADA habilitado (una orden cada vez)", () => {
  const r = resolverPausa({ conexion: "ok", paused: false, pendiente: true });
  assert.deepEqual(r, { estado: "pausando", puedePausar: false, puedeReanudar: false });
});

test("orden de reanudación en vuelo gana incluso si el sondeo falla a la vez", () => {
  const r = resolverPausa({ conexion: "error", paused: true, pendiente: false });
  assert.deepEqual(r, { estado: "reanudando", puedePausar: false, puedeReanudar: false });
});

test("orden fallida: error y solo se ofrece reintentar la acción coherente", () => {
  const enMarcha = resolverPausa({ conexion: "ok", paused: false, falloOrden: true });
  assert.deepEqual(enMarcha, { estado: "error", puedePausar: true, puedeReanudar: false });
  const pausado = resolverPausa({ conexion: "ok", paused: true, falloOrden: true });
  assert.deepEqual(pausado, { estado: "error", puedePausar: false, puedeReanudar: true });
});

test("nunca hay dos órdenes habilitadas a la vez", () => {
  for (const conexion of ["ok", "error", "conectando"]) {
    for (const paused of [null, true, false]) {
      for (const pendiente of [null, true, false]) {
        for (const falloOrden of [false, true]) {
          const r = resolverPausa({ conexion, paused, pendiente, falloOrden });
          assert.equal(r.puedePausar && r.puedeReanudar, false,
            `pausar y reanudar activas a la vez con ${JSON.stringify({ conexion, paused, pendiente, falloOrden })}`);
        }
      }
    }
  }
});

test("la vista traduce el estado y refleja la pausa de Foundry como dato aparte", () => {
  const vista = prepararVistaPausa({ conexion: "ok", paused: true, foundryPausado: true, i18n });
  assert.equal(vista.estado, "pausado");
  assert.equal(vista.etiqueta, "LAGUNAK.Pausa.Pausado");
  assert.equal(vista.puedeReanudar, true);
  assert.equal(vista.foundryPausado, true);
});

test("la pausa de Foundry no altera el estado del simulador (sin sincronización)", () => {
  const conFoundry = prepararVistaPausa({ conexion: "ok", paused: false, foundryPausado: true, i18n });
  const sinFoundry = prepararVistaPausa({ conexion: "ok", paused: false, foundryPausado: false, i18n });
  assert.equal(conFoundry.estado, sinFoundry.estado);
  assert.equal(conFoundry.puedePausar, sinFoundry.puedePausar);
});
