import assert from "node:assert/strict";
import test from "node:test";

import {
  STATION_ORDER_FLAG,
  buildStationOrder,
  extractOrderFromChange,
  handleStationOrder,
  dispatchUserUpdate,
} from "../scripts/station-order-relay.mjs";
import { STATION_ACTION_ERRORS } from "../scripts/station-actions.mjs";

const MOD = "espaciokoop-lagunak";

function fakeBridge() {
  return {
    calls: [],
    async setTargetHeading(heading) { this.calls.push(["setTargetHeading", heading]); return { ok: true }; },
    // Las dos acciones con parámetro continuo, que son las únicas donde una
    // ayuda (#309) tiene dónde colocar el grado de éxito.
    async setImpulse(value) { this.calls.push(["setImpulse", value]); return { ok: true }; },
    async setSystemCoolant(system, level) { this.calls.push(["setSystemCoolant", system, level]); return { ok: true }; },
  };
}

test("buildStationOrder guarda acción, params y nonce, nunca el puesto ni el userId", () => {
  const order = buildStationOrder({ action: "set_target_heading", params: { heading: 90 }, nonce: "n1" });
  assert.deepEqual(order, { action: "set_target_heading", params: { heading: 90 }, nonce: "n1" });
  assert.ok(!("station" in order), "el cliente no declara su puesto");
  assert.ok(!("userId" in order), "el cliente no declara su identidad");
});

test("buildStationOrder exige action y nonce", () => {
  assert.throws(() => buildStationOrder({ action: "x" }), TypeError);
  assert.throws(() => buildStationOrder({ nonce: "n1" }), TypeError);
});

test("extractOrderFromChange devuelve la orden solo si el cambio toca nuestro flag", () => {
  const changes = { flags: { [MOD]: { [STATION_ORDER_FLAG]: { action: "set_target_heading", params: { heading: 42 }, nonce: "n" } } } };
  assert.deepEqual(extractOrderFromChange({ changes, moduleId: MOD }), { action: "set_target_heading", params: { heading: 42 }, nonce: "n" });
});

test("extractOrderFromChange ignora cambios ajenos al flag", () => {
  assert.equal(extractOrderFromChange({ changes: { name: "otra cosa" }, moduleId: MOD }), null);
  assert.equal(extractOrderFromChange({ changes: { flags: { otroModulo: { x: 1 } } }, moduleId: MOD }), null);
  assert.equal(extractOrderFromChange({ changes: {}, moduleId: MOD }), null);
});

test("handleStationOrder resuelve el puesto del emisor autenticado y despacha al puente", async () => {
  const bridge = fakeBridge();
  const result = await handleStationOrder({
    userId: "u1",
    order: { action: "set_target_heading", params: { heading: 42 } },
    resolveUserStation: () => "navigation",
    bridge,
  });
  assert.deepEqual(bridge.calls, [["setTargetHeading", 42]]);
  assert.deepEqual(result, { ok: true });
});

test("SEGURIDAD: la identidad la fija el emisor autenticado, no un campo dentro de la orden", async () => {
  // La orden lleva embebido el userId de una víctima de navegación intentando
  // suplantarla; el emisor real autenticado (userDoc.id) es de ingeniería, que
  // NO puede fijar rumbo. Debe resolverse por el emisor real y rechazarse.
  const bridge = fakeBridge();
  const resolveUserStation = (id) => (id === "engineer" ? "engineering" : "navigation");
  await assert.rejects(
    () => handleStationOrder({
      userId: "engineer",
      order: { action: "set_target_heading", params: { heading: 270 }, userId: "navigator", station: "navigation" },
      resolveUserStation,
      bridge,
    }),
    (error) => error.code === STATION_ACTION_ERRORS.ACTION_NOT_ALLOWED,
  );
  assert.deepEqual(bridge.calls, [], "no toca el puente: el campo userId embebido se ignora");
});

test("handleStationOrder rechaza si no hay emisor autenticado", async () => {
  const bridge = fakeBridge();
  await assert.rejects(
    () => handleStationOrder({ userId: undefined, order: { action: "set_target_heading" }, resolveUserStation: () => "navigation", bridge }),
    TypeError,
  );
  assert.deepEqual(bridge.calls, []);
});

test("handleStationOrder rechaza a un emisor sin puesto asignado", async () => {
  const bridge = fakeBridge();
  await assert.rejects(
    () => handleStationOrder({
      userId: "u1",
      order: { action: "set_target_heading", params: { heading: 10 } },
      resolveUserStation: () => null,
      bridge,
    }),
    (error) => error.code === STATION_ACTION_ERRORS.UNKNOWN_STATION,
  );
  assert.deepEqual(bridge.calls, [], "no toca el puente si no hay puesto");
});

test("handleStationOrder rechaza una acción fuera del permiso del puesto", async () => {
  const bridge = fakeBridge();
  await assert.rejects(
    () => handleStationOrder({
      userId: "u1",
      order: { action: "set_system_power", params: {} },
      resolveUserStation: () => "navigation",
      bridge,
    }),
    (error) => error.code === STATION_ACTION_ERRORS.ACTION_NOT_ALLOWED,
  );
  assert.deepEqual(bridge.calls, []);
});

test("dispatchUserUpdate ignora updateUser que no toca el flag de orden", async () => {
  const bridge = fakeBridge();
  const result = dispatchUserUpdate({
    userDoc: { id: "u1" },
    changes: { name: "renombrado" },
    moduleId: MOD,
    resolveUserStation: () => "navigation",
    bridge,
  });
  assert.equal(result, null);
  assert.deepEqual(bridge.calls, []);
});

test("dispatchUserUpdate usa userDoc.id como identidad autenticada y despacha", async () => {
  const bridge = fakeBridge();
  const resultados = [];
  await dispatchUserUpdate({
    userDoc: { id: "u1" },
    changes: { flags: { [MOD]: { [STATION_ORDER_FLAG]: { action: "set_target_heading", params: { heading: 7 }, nonce: "n" } } } },
    moduleId: MOD,
    resolveUserStation: (id) => (id === "u1" ? "navigation" : null),
    bridge,
    onResult: (r) => resultados.push(r),
  });
  assert.deepEqual(bridge.calls, [["setTargetHeading", 7]]);
  assert.deepEqual(resultados, [{ ok: true }]);
});

test("dispatchUserUpdate solo ejecuta si canHandle() es cierto (GM primario)", async () => {
  const bridge = fakeBridge();
  let esPrimario = false;
  const changes = { flags: { [MOD]: { [STATION_ORDER_FLAG]: { action: "set_target_heading", params: { heading: 5 }, nonce: "n" } } } };

  const r1 = dispatchUserUpdate({
    userDoc: { id: "u1" }, changes, moduleId: MOD,
    canHandle: () => esPrimario, resolveUserStation: () => "navigation", bridge,
  });
  assert.equal(r1, null, "un GM no primario no ejecuta la orden");
  assert.deepEqual(bridge.calls, []);

  esPrimario = true;
  await dispatchUserUpdate({
    userDoc: { id: "u1" }, changes, moduleId: MOD,
    canHandle: () => esPrimario, resolveUserStation: () => "navigation", bridge,
  });
  assert.deepEqual(bridge.calls, [["setTargetHeading", 5]], "el GM primario sí la ejecuta");
});

test("dispatchUserUpdate encamina el error del puente a onError sin propagar", async () => {
  const errores = [];
  const bridge = { async setTargetHeading() { throw new Error("boom"); } };
  const result = await dispatchUserUpdate({
    userDoc: { id: "u1" },
    changes: { flags: { [MOD]: { [STATION_ORDER_FLAG]: { action: "set_target_heading", params: { heading: 1 }, nonce: "n" } } } },
    moduleId: MOD,
    resolveUserStation: () => "navigation",
    bridge,
    onError: (e) => errores.push(e.message),
  });
  assert.equal(result, null);
  assert.deepEqual(errores, ["boom"]);
});

test("REGRESIÓN: la segunda orden llega como diferencial y se lee del documento", () => {
  // Mismo fallo que en la mesa de minijuegos (#308): Foundry entrega en
  // `updateUser` el DIFERENCIAL, no el flag completo. Repetir la misma orden
  // con otro valor deja fuera del cambio todo lo que no cambió —incluida
  // `action`—, y la orden llegaba coja o se descartaba en silencio.
  const orden = { action: "set_target_heading", params: { heading: 90 }, nonce: "n2" };
  const soloLoQueCambia = {
    flags: { [MOD]: { [STATION_ORDER_FLAG]: { params: { heading: 90 }, nonce: "n2" } } },
  };
  const userDoc = { id: "u1", flags: { [MOD]: { [STATION_ORDER_FLAG]: orden } } };

  assert.deepEqual(
    extractOrderFromChange({ changes: soloLoQueCambia, moduleId: MOD, userDoc }),
    orden,
    "la orden se lee del documento, no del diferencial",
  );

  // Y un cambio ajeno sigue sin despachar nada, aunque el documento guarde una
  // orden vieja: si no, cualquier cambio del User la reejecutaría.
  assert.equal(extractOrderFromChange({ changes: { name: "otro" }, moduleId: MOD, userDoc }), null);
});

// --- La costura de la asistencia (#309) --------------------------------------
//
// El relé no sabe nada de asistencia y estas pruebas no le enseñan: lo único que
// fijan es que no rompa por el camino lo que otro necesita, y que engancharse
// aquí no pueda dejar a nadie sin poder dar una orden que era suya.

test("la reclamación de ayuda sobrevive a la extracción, que si no no hay dónde cobrarla", () => {
  const orden = extractOrderFromChange({
    changes: { flags: { [MOD]: { [STATION_ORDER_FLAG]: { action: "set_system_coolant", params: { system: "reactor", level: 4 }, nonce: "n", asistencia: "a1" } } } },
    moduleId: MOD,
    userDoc: { flags: { [MOD]: { [STATION_ORDER_FLAG]: { action: "set_system_coolant", params: { system: "reactor", level: 4 }, nonce: "n", asistencia: "a1" } } } },
  });
  assert.equal(orden.asistencia, "a1");

  // Y una orden sin ayuda no se inventa el campo: `undefined` dentro del sobre
  // se leería como una reclamación vacía en cuanto alguien mirara la clave.
  const sinAyuda = extractOrderFromChange({
    changes: { flags: { [MOD]: { [STATION_ORDER_FLAG]: { action: "set_impulse", params: {}, nonce: "n" } } } },
    moduleId: MOD,
    userDoc: {},
  });
  assert.equal("asistencia" in sinAyuda, false);
});

test("prepareOrder puede mejorar el parámetro, y sin él la orden es la de siempre", async () => {
  const bridge = fakeBridge();
  const changes = { flags: { [MOD]: { [STATION_ORDER_FLAG]: { action: "set_system_coolant", params: { system: "reactor", level: 4 }, nonce: "n", asistencia: "a1" } } } };
  const avisos = [];
  await dispatchUserUpdate({
    userDoc: { id: "u1" }, changes, moduleId: MOD,
    resolveUserStation: () => "engineering",
    bridge,
    prepareOrder: ({ order }) => ({
      orden: { ...order, params: { ...order.params, level: 7 } },
      aviso: null,
    }),
    onResult: (_r, ctx) => avisos.push(ctx.aviso),
  });
  assert.deepEqual(bridge.calls, [["setSystemCoolant", "reactor", 7]], "sale el parámetro mejorado");
  assert.deepEqual(avisos, [null]);

  // Sin `prepareOrder`, ni un cambio: el camino por defecto es exactamente el de
  // antes de que la asistencia existiera.
  const limpio = fakeBridge();
  await dispatchUserUpdate({
    userDoc: { id: "u1" }, changes, moduleId: MOD,
    resolveUserStation: () => "engineering", bridge: limpio,
  });
  assert.deepEqual(limpio.calls, [["setSystemCoolant", "reactor", 4]]);
});

test("un prepareOrder que devuelve basura NO deja al titular sin su orden", async () => {
  // La regla entera de #309 en una prueba: la ayuda es sal, no un peaje. Nada de
  // lo que ocurra en esa costura puede impedir una orden que el puesto ya podía
  // dar por sí mismo, ni siquiera un error de programación nuestro.
  for (const roto of [() => null, () => undefined, () => ({})]) {
    const bridge = fakeBridge();
    await dispatchUserUpdate({
      userDoc: { id: "u1" },
      changes: { flags: { [MOD]: { [STATION_ORDER_FLAG]: { action: "set_impulse", params: { value: 0.5 }, nonce: "n" } } } },
      moduleId: MOD,
      resolveUserStation: () => "navigation",
      bridge,
      prepareOrder: roto,
    });
    assert.deepEqual(bridge.calls, [["setImpulse", 0.5]]);
  }
});

test("el aviso de una ayuda perdida llega a onResult sin frenar la orden", async () => {
  const bridge = fakeBridge();
  const vistos = [];
  await dispatchUserUpdate({
    userDoc: { id: "u1" },
    changes: { flags: { [MOD]: { [STATION_ORDER_FLAG]: { action: "set_impulse", params: { value: 0.5 }, nonce: "n", asistencia: "caducada" } } } },
    moduleId: MOD,
    resolveUserStation: () => "navigation",
    bridge,
    prepareOrder: ({ order }) => ({ orden: order, aviso: "asistencia-no-aplicada" }),
    onResult: (_r, ctx) => vistos.push(ctx.aviso),
  });
  assert.deepEqual(bridge.calls, [["setImpulse", 0.5]], "la orden sale igual");
  assert.deepEqual(vistos, ["asistencia-no-aplicada"], "y se puede contar que la ayuda se perdió");
});
