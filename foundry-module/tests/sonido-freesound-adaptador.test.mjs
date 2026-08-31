import assert from "node:assert/strict";
import test from "node:test";
import { borradorProcedencia, crearAdaptadorBusquedaSonido } from "../scripts/sonido-freesound/adaptador.mjs";

function bruto(overrides = {}) {
  return {
    id: 101,
    name: "Lluvia sobre metal",
    username: "algún-autor",
    duration: 12.5,
    license: "http://creativecommons.org/publicdomain/zero/1.0/",
    previews: { "preview-hq-mp3": "https://cdn.example/hq.mp3", "preview-lq-mp3": "https://cdn.example/lq.mp3" },
    url: "https://freesound.org/people/x/sounds/101/",
    ...overrides,
  };
}

test("normaliza un resultado CC0 utilizable al contrato del adaptador", async () => {
  const proveedor = { buscar: async () => ({ total: 1, resultados: [bruto()] }) };
  const adaptador = crearAdaptadorBusquedaSonido({ proveedor });
  const { resultados, error } = await adaptador.buscar("lluvia");
  assert.equal(error, null);
  assert.equal(resultados.length, 1);
  const [r] = resultados;
  assert.equal(r.id, 101);
  assert.equal(r.title, "Lluvia sobre metal");
  assert.equal(r.author, "algún-autor");
  assert.equal(r.duration, 12.5);
  assert.equal(r.license.codigo, "CC0");
  assert.equal(r.previewUrl, "https://cdn.example/hq.mp3");
  assert.equal(r.sourceUrl, "https://freesound.org/people/x/sounds/101/");
});

test("un resultado CC-BY-NC se descarta (fail-closed), aunque venga de la API", async () => {
  const proveedor = {
    buscar: async () => ({
      total: 1,
      resultados: [bruto({ license: "https://creativecommons.org/licenses/by-nc/4.0/" })],
    }),
  };
  const adaptador = crearAdaptadorBusquedaSonido({ proveedor });
  const { resultados } = await adaptador.buscar("lluvia");
  assert.deepEqual(resultados, []);
});

test("un resultado con licencia irreconocible se descarta", async () => {
  const proveedor = { buscar: async () => ({ total: 1, resultados: [bruto({ license: "quién sabe" })] }) };
  const adaptador = crearAdaptadorBusquedaSonido({ proveedor });
  const { resultados } = await adaptador.buscar("lluvia");
  assert.deepEqual(resultados, []);
});

test("un resultado sin preview se descarta, aunque la licencia sea libre", async () => {
  const proveedor = { buscar: async () => ({ total: 1, resultados: [bruto({ previews: {} })] }) };
  const adaptador = crearAdaptadorBusquedaSonido({ proveedor });
  const { resultados } = await adaptador.buscar("lluvia");
  assert.deepEqual(resultados, []);
});

test("usa el preview de baja calidad si falta el de alta", async () => {
  const proveedor = {
    buscar: async () => ({
      total: 1,
      resultados: [bruto({ previews: { "preview-lq-mp3": "https://cdn.example/lq.mp3" } })],
    }),
  };
  const adaptador = crearAdaptadorBusquedaSonido({ proveedor });
  const { resultados } = await adaptador.buscar("lluvia");
  assert.equal(resultados[0].previewUrl, "https://cdn.example/lq.mp3");
});

test("un proveedor que lanza se convierte en { resultados: [], error } sin propagar la excepción", async () => {
  const proveedor = { buscar: async () => { throw Object.assign(new Error("caído"), { kind: "network" }); } };
  const adaptador = crearAdaptadorBusquedaSonido({ proveedor });
  const { resultados, error, total } = await adaptador.buscar("lluvia");
  assert.deepEqual(resultados, []);
  assert.equal(total, 0);
  assert.equal(error, "network");
});

test("sin proveedor, buscar no revienta y responde vacío", async () => {
  const adaptador = crearAdaptadorBusquedaSonido({});
  const { resultados, error } = await adaptador.buscar("lluvia");
  assert.deepEqual(resultados, []);
  assert.equal(error, "sin-proveedor");
});

test("el borrador de procedencia nunca incluye un sha256 calculado, solo el pendiente", async () => {
  const proveedor = { buscar: async () => ({ total: 1, resultados: [bruto()] }) };
  const adaptador = crearAdaptadorBusquedaSonido({ proveedor });
  const { resultados } = await adaptador.buscar("lluvia");
  const ficha = borradorProcedencia(resultados[0]);
  assert.match(ficha, /^source: Freesound$/m);
  assert.match(ficha, /^source_id: 101$/m);
  assert.match(ficha, /^license: CC0$/m);
  assert.match(ficha, /^sha256: PENDIENTE/m);
});
