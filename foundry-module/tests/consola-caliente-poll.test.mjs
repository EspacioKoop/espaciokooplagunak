import assert from "node:assert/strict";
import test from "node:test";

import {
  calcularIntervaloMs,
  resolverCicloConsola,
  resolverPestana,
  siguienteFallosSeguidos,
} from "../scripts/consola-caliente-poll.mjs";

const ok = (value) => ({ status: "fulfilled", value });
const ko = (reason) => ({ status: "rejected", reason });

test("calcularIntervaloMs: sin fallos usa la base", () => {
  assert.equal(calcularIntervaloMs(1000, 0, 30000), 1000);
});

test("calcularIntervaloMs: backoff exponencial acotado", () => {
  assert.equal(calcularIntervaloMs(1000, 1, 30000), 2000);
  assert.equal(calcularIntervaloMs(1000, 3, 30000), 8000);
  assert.equal(calcularIntervaloMs(1000, 10, 30000), 30000, "no supera el tope");
});

test("siguienteFallosSeguidos: sube con fallo y se rearma al éxito", () => {
  assert.equal(siguienteFallosSeguidos(0, true), 1);
  assert.equal(siguienteFallosSeguidos(3, true), 4);
  assert.equal(siguienteFallosSeguidos(9, true), 10, "se acota en 10");
  assert.equal(siguienteFallosSeguidos(10, true), 10);
  assert.equal(siguienteFallosSeguidos(5, false), 0);
});

test("resolverPestana: no pedida es sin-datos, no error", () => {
  assert.deepEqual(resolverPestana(null), { status: "sin-datos", dato: null, motivo: null });
});

test("resolverPestana: éxito y fallo", () => {
  assert.deepEqual(resolverPestana(ok({ a: 1 })), { status: "ok", dato: { a: 1 }, motivo: null });
  const motivo = new Error("boom");
  assert.deepEqual(resolverPestana(ko(motivo)), { status: "error", dato: null, motivo });
});

test("resolverCicloConsola: healthz caído es la ÚNICA condición global", () => {
  const motivo = new Error("sin puente");
  const ciclo = resolverCicloConsola({
    healthz: ko(motivo),
    state: ok({ ship: {} }),
    extras: { scenario: ok({}), contacts: ok({ contacts: [] }) },
    dependeDeState: ["contacts"],
  });
  assert.equal(ciclo.conexion, "error");
  assert.equal(ciclo.detalleErrorConexion, motivo);
  // Con el puente caído ninguna pestaña "inventa" un dato fresco.
  assert.equal(ciclo.state.status, "sin-datos");
  assert.equal(ciclo.extras.scenario.status, "sin-datos");
  assert.equal(ciclo.extras.contacts.status, "sin-datos");
});

test("resolverCicloConsola: healthz null (no pedido) también es error de conexión", () => {
  const ciclo = resolverCicloConsola({ healthz: null, state: null, extras: {} });
  assert.equal(ciclo.conexion, "error");
  assert.equal(ciclo.detalleErrorConexion, null);
});

test("resolverCicloConsola: contacts falla, Estado sigue COMPLETAMENTE operativo", () => {
  const motivoContactos = new Error("contacts inaccesible");
  const ciclo = resolverCicloConsola({
    healthz: ok(undefined),
    state: ok({ ship: { hull: 90 } }),
    extras: {
      scenario: ok({ paused: false }),
      events: ok({ events: [] }),
      contacts: ko(motivoContactos),
    },
    dependeDeState: ["contacts"],
  });
  assert.equal(ciclo.conexion, "ok");
  assert.equal(ciclo.state.status, "ok");
  assert.equal(ciclo.extras.scenario.status, "ok");
  assert.equal(ciclo.extras.events.status, "ok");
  assert.equal(ciclo.extras.contacts.status, "error");
  assert.equal(ciclo.extras.contacts.motivo, motivoContactos);
});

test("resolverCicloConsola: state cae, las pestañas dependientes heredan el motivo pero conexion sigue ok", () => {
  const motivoState = new Error("state inaccesible");
  const ciclo = resolverCicloConsola({
    healthz: ok(undefined),
    state: ko(motivoState),
    extras: { scenario: ok({ paused: true }), contacts: ok({ contacts: [] }) },
    dependeDeState: ["contacts"],
  });
  assert.equal(ciclo.conexion, "ok", "el puente respondió a healthz");
  assert.equal(ciclo.state.status, "error");
  // `scenario` no depende de `state`, así que un `contacts` con éxito hipotético
  // igual se habría usado si NO dependiera; aquí sí depende y hereda el fallo.
  assert.equal(ciclo.extras.contacts.status, "error");
  assert.equal(ciclo.extras.contacts.motivo, motivoState);
  // `scenario` no está en `dependeDeState`: un dato bueno se usa igual.
  assert.equal(ciclo.extras.scenario.status, "ok");
});

test("resolverCicloConsola: una pestaña oculta que no se pidió queda sin-datos, no error", () => {
  const ciclo = resolverCicloConsola({
    healthz: ok(undefined),
    state: ok({ ship: {} }),
    extras: { scenario: ok({}), contacts: null },
    dependeDeState: ["contacts"],
  });
  assert.equal(ciclo.extras.contacts.status, "sin-datos");
});

test("resolverCicloConsola: backoff no lo dispara un extra suelto (se mide fuera, por conexion)", () => {
  // El backoff lo calcula la clase Foundry a partir de `conexion`/`state`, no
  // de un extra: esto documenta que la señal que expone este módulo para esa
  // decisión es `conexion`, que un `contacts` caído no toca.
  const ciclo = resolverCicloConsola({
    healthz: ok(undefined),
    state: ok({ ship: {} }),
    extras: { contacts: ko(new Error("hipo")) },
    dependeDeState: [],
  });
  assert.equal(ciclo.conexion, "ok");
});
