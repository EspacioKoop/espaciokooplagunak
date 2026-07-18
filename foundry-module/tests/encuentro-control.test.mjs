import assert from "node:assert/strict";
import test from "node:test";

import { BridgeError } from "../scripts/bridge-client.mjs";
import {
  claveResultadoEncuentro,
  introducirEncuentro,
  normalizarCatalogoEncuentros,
  prepararVistaEncuentros,
} from "../scripts/encuentro-control.mjs";

const CATALOGO = { archetypes: ["derelict"], bearings: ["ahead", "astern", "port", "starboard"] };

test("normaliza el catálogo descartando basura de red", () => {
  const catalogo = normalizarCatalogoEncuentros({
    archetypes: ["derelict", "", 7, null, "derelict"],
    bearings: ["port", {}, "port"],
  });
  assert.deepEqual(catalogo, { archetypes: ["derelict"], bearings: ["port"] });
  assert.deepEqual(normalizarCatalogoEncuentros(null), { archetypes: [], bearings: [] });
});

test("un usuario no GM no emite órdenes de encuentro", async () => {
  let calls = 0;
  const respuesta = await introducirEncuentro({
    archetype: "derelict",
    isGM: false,
    catalogo: CATALOGO,
    client: { async spawnEncounter() { calls += 1; } },
  });
  assert.equal(respuesta, null);
  assert.equal(calls, 0);
});

test("rechaza arquetipos y rumbos fuera de catálogo sin tocar la red", async () => {
  let calls = 0;
  const client = { async spawnEncounter() { calls += 1; } };
  await assert.rejects(
    introducirEncuentro({ archetype: "kraken", isGM: true, catalogo: CATALOGO, client }),
    (err) => err instanceof BridgeError && /catálogo/.test(err.message),
  );
  await assert.rejects(
    introducirEncuentro({ archetype: "derelict", bearing: "up", isGM: true, catalogo: CATALOGO, client }),
    (err) => err instanceof BridgeError && /catálogo/.test(err.message),
  );
  assert.equal(calls, 0);
});

test("un GM ordena un encuentro válido, con y sin rumbo", async () => {
  const llamadas = [];
  const client = {
    async spawnEncounter(archetype, bearing) {
      llamadas.push([archetype, bearing]);
      return { op: "spawn_encounter", result: { ok: true } };
    },
  };
  await introducirEncuentro({ archetype: "derelict", bearing: "port", isGM: true, catalogo: CATALOGO, client });
  await introducirEncuentro({ archetype: "derelict", isGM: true, catalogo: CATALOGO, client });
  assert.deepEqual(llamadas, [["derelict", "port"], ["derelict", null]]);
});

test("traduce el resultado del puente a claves i18n", () => {
  assert.deepEqual(claveResultadoEncuentro({ result: { ok: true } }), {
    ok: true,
    clave: "LAGUNAK.Encuentros.Introducido",
  });
  assert.deepEqual(claveResultadoEncuentro({ result: { ok: false, reason: "no_ship" } }), {
    ok: false,
    clave: "LAGUNAK.Encuentros.SinNave",
  });
  assert.deepEqual(claveResultadoEncuentro({ result: { ok: false, reason: "not_supported" } }), {
    ok: false,
    clave: "LAGUNAK.Encuentros.NoSoportado",
  });
  assert.deepEqual(claveResultadoEncuentro(undefined), {
    ok: false,
    clave: "LAGUNAK.Encuentros.Fallo",
  });
});

test("la vista localiza etiquetas conocidas y degrada al identificador crudo", () => {
  const i18n = {
    has: (key) => key === "LAGUNAK.Encuentros.Arquetipo.derelict",
    localize: (key) => `loc:${key}`,
  };
  const vista = prepararVistaEncuentros({
    conexion: "ok",
    catalogo: { archetypes: ["derelict", "nuevo"], bearings: ["port"] },
    seleccionArquetipo: "nuevo",
    seleccionRumbo: "port",
    i18n,
  });
  assert.equal(vista.disponible, true);
  assert.equal(vista.puedeIntroducir, true);
  assert.deepEqual(vista.arquetipos, [
    { id: "derelict", etiqueta: "loc:LAGUNAK.Encuentros.Arquetipo.derelict", seleccionado: false },
    { id: "nuevo", etiqueta: "nuevo", seleccionado: true },
  ]);
  assert.deepEqual(vista.rumbos, [{ id: "port", etiqueta: "port", seleccionado: true }]);
});

test("la vista deshabilita el botón sin conexión, sin catálogo o con orden en vuelo", () => {
  const i18n = { has: () => false, localize: (k) => k };
  assert.equal(prepararVistaEncuentros({ conexion: "error", catalogo: CATALOGO, i18n }).puedeIntroducir, false);
  const sinCatalogo = prepararVistaEncuentros({ conexion: "ok", catalogo: null, i18n });
  assert.equal(sinCatalogo.disponible, false);
  assert.equal(sinCatalogo.puedeIntroducir, false);
  const enVuelo = prepararVistaEncuentros({ conexion: "ok", catalogo: CATALOGO, pendiente: true, i18n });
  assert.equal(enVuelo.puedeIntroducir, false);
  assert.equal(enVuelo.pendiente, true);
});
