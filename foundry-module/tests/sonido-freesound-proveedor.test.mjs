import assert from "node:assert/strict";
import test from "node:test";
import { FreesoundError, crearProveedorFreesound } from "../scripts/sonido-freesound/proveedor-freesound.mjs";

function proveedor({ apiKey = () => "clave-de-prueba", fetchImpl } = {}) {
  return crearProveedorFreesound({ apiKey, fetchImpl });
}

test("sin clave lanza FreesoundError de tipo sin-clave, sin llamar a fetch", async () => {
  let llamado = false;
  const p = proveedor({ apiKey: () => "", fetchImpl: async () => { llamado = true; } });
  await assert.rejects(() => p.buscar("lluvia"), (err) => {
    assert.ok(err instanceof FreesoundError);
    assert.equal(err.kind, "sin-clave");
    return true;
  });
  assert.equal(llamado, false);
});

test("consulta vacía no llama a la red", async () => {
  let llamado = false;
  const p = proveedor({ fetchImpl: async () => { llamado = true; } });
  const r = await p.buscar("   ");
  assert.deepEqual(r, { total: 0, resultados: [] });
  assert.equal(llamado, false);
});

test("usa /apiv2/search/ y no el endpoint deprecado /search/text/", async () => {
  let urlPedida = null;
  let cabeceras = null;
  const p = proveedor({
    fetchImpl: async (url, opts) => {
      urlPedida = url;
      cabeceras = opts.headers;
      return { ok: true, status: 200, async json() { return { count: 1, results: [{ id: 1 }] }; } };
    },
  });
  await p.buscar("viento");
  assert.match(urlPedida, /^https:\/\/freesound\.org\/apiv2\/search\/\?/);
  assert.doesNotMatch(urlPedida, /\/search\/text/);
  assert.equal(cabeceras.Authorization, "Token clave-de-prueba");
});

test("401 se convierte en FreesoundError http/401", async () => {
  const p = proveedor({
    fetchImpl: async () => ({ ok: false, status: 401, async json() { return {}; } }),
  });
  await assert.rejects(() => p.buscar("puerta"), (err) => {
    assert.ok(err instanceof FreesoundError);
    assert.equal(err.kind, "http");
    assert.equal(err.status, 401);
    return true;
  });
});

test("otro error HTTP se propaga con su status", async () => {
  const p = proveedor({
    fetchImpl: async () => ({ ok: false, status: 503, async json() { return {}; } }),
  });
  await assert.rejects(() => p.buscar("mar"), (err) => err.kind === "http" && err.status === 503);
});

test("un fetch que rechaza da un error de red", async () => {
  const p = proveedor({ fetchImpl: async () => { throw new Error("boom"); } });
  await assert.rejects(() => p.buscar("mar"), (err) => err.kind === "network");
});

test("un JSON inválido da un error de parseo", async () => {
  const p = proveedor({
    fetchImpl: async () => ({ ok: true, status: 200, async json() { throw new Error("bad json"); } }),
  });
  await assert.rejects(() => p.buscar("mar"), (err) => err.kind === "parse");
});

test("devuelve los resultados crudos de la API tal cual", async () => {
  const crudos = [{ id: 1, name: "Lluvia" }, { id: 2, name: "Viento" }];
  const p = proveedor({
    fetchImpl: async () => ({ ok: true, status: 200, async json() { return { count: 2, results: crudos }; } }),
  });
  const r = await p.buscar("ambiente");
  assert.equal(r.total, 2);
  assert.deepEqual(r.resultados, crudos);
});
