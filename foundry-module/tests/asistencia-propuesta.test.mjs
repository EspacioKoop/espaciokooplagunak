import assert from "node:assert/strict";
import test from "node:test";

import { BANDAS } from "../scripts/asistencia/bandas.mjs";
import {
  PROPUESTA_ERRORES,
  TIERS,
  acotarPorTier,
  consumirPropuesta,
  crearPropuesta,
  propuestaVigente,
  puedeAsistir,
  tierDeBanda,
} from "../scripts/asistencia/propuesta.mjs";
import { buildStationOrder } from "../scripts/station-order-relay.mjs";

const T0 = 1_000_000;

const nueva = (extra = {}) =>
  crearPropuesta({
    tareaId: "estabilizar-sistema-caliente",
    puestoAsistido: "engineering",
    accion: "set_system_coolant",
    banda: BANDAS.EXITO,
    asistenteId: "ayudante-1",
    nonce: "n1",
    ahora: T0,
    ...extra,
  });

test("un éxito deja token; un fallo no deja nada (la ayuda es sal, no peaje)", () => {
  assert.equal(nueva().ok, true);
  assert.equal(nueva({ banda: BANDAS.FALLO }).error, PROPUESTA_ERRORES.BANDA_SIN_FRUTO);
  assert.equal(nueva({ banda: BANDAS.PIFIA }).error, PROPUESTA_ERRORES.BANDA_SIN_FRUTO);
});

test("ni el crítico puede proponer una orden fuera de STATION_ACTIONS", () => {
  // La línea roja de ADR-0002: el grado de éxito elige DÓNDE dentro de un rango
  // ya autorizado, nunca abre un rango nuevo.
  const fuera = nueva({ banda: BANDAS.CRITICO, accion: "set_shields" });
  assert.equal(fuera.error, PROPUESTA_ERRORES.ACCION_NO_AUTORIZADA);
});

test("el crítico sube de tier, no de rango", () => {
  assert.equal(tierDeBanda(BANDAS.EXITO), TIERS.BAJO);
  assert.equal(tierDeBanda(BANDAS.CRITICO), TIERS.ALTO);
  assert.equal(tierDeBanda(BANDAS.FALLO), null);

  const rango = [0, 10];
  const bajo = acotarPorTier({ base: 4, objetivo: 8, rango, tier: TIERS.BAJO });
  const alto = acotarPorTier({ base: 4, objetivo: 8, rango, tier: TIERS.ALTO });
  assert.equal(bajo, 6);
  assert.equal(alto, 8);
  // Y por mucho que se pida, el tope autorizado manda.
  assert.equal(acotarPorTier({ base: 4, objetivo: 99, rango, tier: TIERS.ALTO }), 10);
});

test("EL AYUDANTE NO EMITE: la orden solo sale si la gasta el titular", () => {
  // El corazón del issue. Un ayudante que pudiera emitir crearía una segunda
  // autoridad sobre la verdad de la nave.
  const { propuesta } = nueva();
  const intruso = consumirPropuesta({
    propuesta,
    emisorId: "ayudante-1",
    emisorPuesto: "weapons",
    ahora: T0,
  });
  assert.equal(intruso.ok, false);
  assert.equal(intruso.error, PROPUESTA_ERRORES.NO_ES_TITULAR);

  const titular = consumirPropuesta({
    propuesta,
    emisorId: "ingeniero-7",
    emisorPuesto: "engineering",
    params: { system: "reactor", level: 0.8 },
    ahora: T0,
  });
  assert.equal(titular.ok, true);
  // Y sale por el mismo camino que cualquier orden suya.
  const orden = buildStationOrder({ ...titular.orden, nonce: "n2" });
  assert.equal(orden.action, "set_system_coolant");
  assert.equal(orden.params.level, 0.8);
});

test("el crédito distingue quién decidió de quién apoyó", () => {
  // Al cerrar una crisis debe seguir claro quién tomó la decisión: la ayuda
  // amplifica al especialista, no diluye su identidad.
  const { propuesta } = nueva({ banda: BANDAS.CRITICO });
  const { credito } = consumirPropuesta({
    propuesta,
    emisorId: "ingeniero-7",
    emisorPuesto: "engineering",
    ahora: T0,
  });
  assert.equal(credito.asistenteId, "ayudante-1");
  assert.equal(credito.emisorId, "ingeniero-7");
  assert.equal(credito.tier, TIERS.ALTO);
});

test("el token es efímero: caduca y deja de gastarse", () => {
  const { propuesta } = nueva({ vigenciaMs: 60_000 });
  assert.equal(propuestaVigente(propuesta, T0 + 59_000), true);
  assert.equal(propuestaVigente(propuesta, T0 + 60_000), false);
  const tarde = consumirPropuesta({
    propuesta,
    emisorId: "ingeniero-7",
    emisorPuesto: "engineering",
    ahora: T0 + 120_000,
  });
  assert.equal(tarde.error, PROPUESTA_ERRORES.CADUCADA);
});

test("presupuesto de concurrencia: no todos ayudan siempre al ingeniero", () => {
  const { propuesta } = nueva();
  const vivas = [propuesta];
  assert.equal(
    puedeAsistir({ puestoAsistido: "engineering", asistenteId: "otro", propuestas: vivas, ahora: T0 })
      .error,
    PROPUESTA_ERRORES.PRESUPUESTO_AGOTADO,
  );
  // El mismo ayudante tampoco apila ayudas sobre el mismo puesto.
  assert.equal(
    puedeAsistir({
      puestoAsistido: "engineering",
      asistenteId: "ayudante-1",
      propuestas: vivas,
      ahora: T0,
    }).error,
    PROPUESTA_ERRORES.YA_ASISTE,
  );
  // Otro puesto sí está libre, y el presupuesto se libera al caducar.
  assert.equal(
    puedeAsistir({ puestoAsistido: "navigation", asistenteId: "otro", propuestas: vivas, ahora: T0 })
      .ok,
    true,
  );
  assert.equal(
    puedeAsistir({
      puestoAsistido: "engineering",
      asistenteId: "otro",
      propuestas: vivas,
      ahora: T0 + 999_999,
    }).ok,
    true,
  );
});
