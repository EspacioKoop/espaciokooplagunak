import assert from "node:assert/strict";
import test from "node:test";

import { probarConexion, RESULTADOS_DIAGNOSTICO } from "../scripts/diagnostico-conexion.mjs";

function response(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async json() {
      return body;
    },
  };
}

function fetchPorRuta(rutas) {
  const calls = [];
  const impl = async (url, options) => {
    calls.push({ url, options });
    for (const [sufijo, respuesta] of Object.entries(rutas)) {
      if (url.endsWith(sufijo)) return respuesta();
    }
    throw new Error(`ruta inesperada: ${url}`);
  };
  return { impl, calls };
}

test("sin URL configurada no toca la red", async () => {
  const { impl, calls } = fetchPorRuta({});
  const res = await probarConexion({ url: "", token: "x", fetchImpl: impl });
  assert.equal(res.codigo, "sin-url");
  assert.equal(res.exito, false);
  assert.equal(calls.length, 0);
});

test("puente accesible y token autorizado devuelve ok", async () => {
  const { impl, calls } = fetchPorRuta({
    "/healthz": () => response({ status: "ok" }),
    "/v1/state": () => response({ ship: {} }),
  });
  const res = await probarConexion({ url: "http://bridge.test", token: "secreto", fetchImpl: impl });
  assert.equal(res.codigo, "ok");
  assert.equal(res.exito, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.headers.Authorization, undefined);
  assert.equal(calls[1].options.headers.Authorization, "Bearer secreto");
});

test("puente accesible con token rechazado (401) distingue token-invalido", async () => {
  const { impl } = fetchPorRuta({
    "/healthz": () => response({ status: "ok" }),
    "/v1/state": () => response({ detail: "no" }, { ok: false, status: 401 }),
  });
  const res = await probarConexion({ url: "http://bridge.test", token: "malo", fetchImpl: impl });
  assert.equal(res.codigo, "token-invalido");
  assert.equal(res.exito, false);
});

test("403 tambien se reporta como token-invalido", async () => {
  const { impl } = fetchPorRuta({
    "/healthz": () => response({ status: "ok" }),
    "/v1/state": () => response({}, { ok: false, status: 403 }),
  });
  const res = await probarConexion({ url: "http://bridge.test", token: "malo", fetchImpl: impl });
  assert.equal(res.codigo, "token-invalido");
});

test("puente caido devuelve inaccesible sin intentar /v1/state", async () => {
  const calls = [];
  const res = await probarConexion({
    url: "http://bridge.test",
    token: "secreto",
    fetchImpl: async (url) => {
      calls.push(url);
      throw new TypeError("failed to fetch");
    },
  });
  assert.equal(res.codigo, "inaccesible");
  assert.equal(calls.length, 1);
  assert.ok(calls[0].endsWith("/healthz"));
});

test("puente accesible pero token vacio devuelve sin-token sin llamar a /v1/state", async () => {
  const { impl, calls } = fetchPorRuta({
    "/healthz": () => response({ status: "ok" }),
  });
  const res = await probarConexion({ url: "http://bridge.test", token: "", fetchImpl: impl });
  assert.equal(res.codigo, "sin-token");
  assert.equal(calls.length, 1);
});

test("revocar durante healthz impide iniciar /v1/state", async () => {
  let authorized = true;
  const calls = [];
  const res = await probarConexion({
    url: "http://bridge.test",
    token: "secreto",
    canUseToken: () => authorized,
    fetchImpl: async (url) => {
      calls.push(url);
      authorized = false;
      return response({ status: "ok" });
    },
  });
  assert.equal(res.codigo, "sin-token");
  assert.equal(calls.length, 1);
  assert.ok(calls[0].endsWith("/healthz"));
});

test("fallo no-auth en /v1/state se reporta como error-puente", async () => {
  const { impl } = fetchPorRuta({
    "/healthz": () => response({ status: "ok" }),
    "/v1/state": () => response({}, { ok: false, status: 502 }),
  });
  const res = await probarConexion({ url: "http://bridge.test", token: "secreto", fetchImpl: impl });
  assert.equal(res.codigo, "error-puente");
});

test("los resultados nunca contienen el token", async () => {
  const token = "secreto-operativo-183";
  const { impl } = fetchPorRuta({
    "/healthz": () => response({ status: "ok" }),
    "/v1/state": () => response({}, { ok: false, status: 401 }),
  });
  const res = await probarConexion({ url: "http://bridge.test", token, fetchImpl: impl });
  assert.ok(!JSON.stringify(res).includes(token));
});

test("cada codigo declarado tiene clave i18n y bandera de exito", () => {
  for (const [codigo, info] of Object.entries(RESULTADOS_DIAGNOSTICO)) {
    assert.equal(typeof info.exito, "boolean", codigo);
    assert.match(info.claveI18n, /^LAGUNAK\.Diagnostico\./);
  }
});
