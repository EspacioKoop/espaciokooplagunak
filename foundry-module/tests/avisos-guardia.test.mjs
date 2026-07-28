import assert from "node:assert/strict";
import test from "node:test";

import {
  SEVERIDADES,
  UMBRALES_AVISO,
  avisosDeGuardia,
  avisosParaPuesto,
} from "../scripts/avisos-guardia.mjs";

const nave = (extra = {}) => ({
  hull: 100,
  hull_max: 100,
  energy: 1000,
  energy_max: 1000,
  systems: {},
  ...extra,
});

test("SIN TELEMETRÍA NO HAY AVISOS, ni siquiera tranquilizadores", () => {
  // Un «todo en orden» inventado es peor que un panel en blanco: el panel en
  // blanco no miente, y esta consola gobierna una nave.
  for (const vacio of [null, undefined, "", 0, "no-es-una-nave"]) {
    assert.deepEqual(avisosDeGuardia(vacio), []);
  }
  // Y una nave sana tampoco los tiene: la ausencia de aviso es la buena noticia.
  assert.deepEqual(avisosDeGuardia(nave()), []);
});

test("el aviso dice qué pasa AHORA, con el sistema y el número", () => {
  // Es la diferencia con la lista fija que sustituye: «Temperatura» no es
  // accionable; «maniobra al 91% de calor» sí.
  const avisos = avisosDeGuardia(nave({ systems: { maneuver: { heat: 0.91, health: 1 } } }));
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0].clave, "CalorCritico");
  assert.equal(avisos[0].datos.sistema, "maneuver");
  assert.equal(avisos[0].datos.valor, 91, "el porcentaje, no la fracción cruda");
});

test("los críticos van primero: lo que quema antes que lo que molesta", () => {
  const avisos = avisosDeGuardia(
    nave({
      hull: 50,
      systems: { impulse: { heat: 0.95, health: 1 }, warp: { heat: 0.75, health: 1 } },
    }),
  );
  const severidades = avisos.map((a) => a.severidad);
  const ordenadas = [...severidades].sort(
    (a, b) => SEVERIDADES.indexOf(a) - SEVERIDADES.indexOf(b),
  );
  assert.deepEqual(severidades, ordenadas);
  assert.equal(avisos[0].severidad, "critico");
});

test("el orden es estable entre sondeos: la lista no se reordena sola", () => {
  // Una lista que baila de posición se lee como ruido y obliga a releerla
  // entera cada vez.
  const estado = nave({
    energy: 100,
    systems: { impulse: { heat: 0.95 }, warp: { heat: 0.95 }, reactor: { health: 0.2 } },
  });
  const primera = JSON.stringify(avisosDeGuardia(estado));
  for (let i = 0; i < 10; i += 1) {
    assert.equal(JSON.stringify(avisosDeGuardia(estado)), primera);
  }
});

test("cada aviso va a quien puede atenderlo; el capitán los ve todos", () => {
  // Un aviso que no puedes atender es ruido: al piloto no le sirve el detalle
  // térmico que solo ingeniería puede tocar. El capitán sí lo necesita, porque
  // su trabajo es repartir la atención.
  const estado = nave({ systems: { maneuver: { heat: 0.95, health: 1 } } });
  assert.equal(avisosParaPuesto(estado, "engineering").length, 1);
  assert.equal(avisosParaPuesto(estado, "captain").length, 1);
  assert.equal(avisosParaPuesto(estado, "navigation").length, 0, "al piloto no le incumbe");
  assert.equal(avisosParaPuesto(estado, "communications").length, 0);
});

test("la energía crítica sí llega a navegación: sin energía no hay maniobra", () => {
  const estado = nave({ energy: 50 });
  assert.equal(avisosParaPuesto(estado, "navigation").length, 1);
  // Pero la energía solo baja no le hace falta: puede seguir pilotando.
  const floja = nave({ energy: 300 });
  assert.equal(avisosDeGuardia(floja)[0].clave, "EnergiaBaja");
  assert.equal(avisosParaPuesto(floja, "navigation").length, 0);
});

test("los umbrales separan crítico de aviso sin solaparse", () => {
  const justoCritico = nave({ hull: UMBRALES_AVISO.cascoCritico * 100, hull_max: 100 });
  assert.equal(avisosDeGuardia(justoCritico)[0].clave, "CascoCritico");
  const justoAviso = nave({ hull: UMBRALES_AVISO.cascoAviso * 100, hull_max: 100 });
  assert.equal(avisosDeGuardia(justoAviso)[0].clave, "CascoTocado");
  const sano = nave({ hull: UMBRALES_AVISO.cascoAviso * 100 + 1, hull_max: 100 });
  assert.deepEqual(avisosDeGuardia(sano), []);
});

test("una lectura ausente no dispara aviso, y cero sí", () => {
  // Ausencia y cero otra vez: un sistema que el puente no publica no está a
  // cero de salud, simplemente no se sabe.
  assert.deepEqual(avisosDeGuardia(nave({ systems: { impulse: {} } })), []);
  assert.deepEqual(avisosDeGuardia(nave({ hull: null, hull_max: null, energy: null })), []);
  const aCero = avisosDeGuardia(nave({ systems: { impulse: { health: 0 } } }));
  assert.equal(aCero[0].clave, "SistemaInutilizado", "cero sí es una lectura grave");
});

test("la lista se acota: una nave hecha trizas no tapa la consola", () => {
  const rota = nave({
    hull: 10,
    energy: 10,
    systems: Object.fromEntries(
      ["reactor", "impulse", "warp", "maneuver", "beamweapons"].map((s) => [s, { heat: 0.99, health: 0.1 }]),
    ),
  });
  assert.ok(avisosDeGuardia(rota).length > 3, "hay muchos avisos que dar");
  assert.equal(avisosParaPuesto(rota, "engineering").length, 3, "pero solo caben tres");
  assert.ok(
    avisosParaPuesto(rota, "engineering").every((a) => a.severidad === "critico"),
    "y los tres son los graves",
  );
});
