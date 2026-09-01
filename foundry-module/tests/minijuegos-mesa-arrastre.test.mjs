import assert from "node:assert/strict";
import test from "node:test";

import {
  ARRASTRE_ERRORES,
  ARRASTRE_FLAG,
  construirIntentoArrastre,
  extraerIntentoDeCambio,
  resolverIntentoArrastre,
} from "../scripts/minijuegos/mesa-arrastre.mjs";
import { proyectarMesa } from "../scripts/minijuegos/mesa-proyeccion.mjs";

test("construirIntentoArrastre exige cartaId, nonce y destino numérico", () => {
  assert.throws(() => construirIntentoArrastre({ destino: { x: 1, y: 1 }, nonce: "n" }), TypeError);
  assert.throws(() => construirIntentoArrastre({ cartaId: "c", destino: { x: 1, y: 1 } }), TypeError);
  assert.throws(
    () => construirIntentoArrastre({ cartaId: "c", destino: { x: "a", y: 1 }, nonce: "n" }),
    TypeError,
  );
  const intento = construirIntentoArrastre({ cartaId: "m1:comunitaria:0", destino: { x: 10, y: 20 }, nonce: "n1" });
  assert.deepEqual(intento, { cartaId: "m1:comunitaria:0", destino: { x: 10, y: 20 }, nonce: "n1" });
});

test("round-trip: lo que construye el arrastrador se extrae igual del cambio", () => {
  const intento = construirIntentoArrastre({ cartaId: "m1:comunitaria:0", destino: { x: 10, y: 20 }, nonce: "n1" });
  const moduleId = "espaciokoop-lagunak";
  const userDoc = { flags: { [moduleId]: { [ARRASTRE_FLAG]: intento } } };
  const changes = { flags: { [moduleId]: { [ARRASTRE_FLAG]: intento } } };
  const extraido = extraerIntentoDeCambio({ changes, moduleId, userDoc });
  assert.deepEqual(extraido, intento);
});

test("extraerIntentoDeCambio ignora cambios que no tocan el flag de arrastre", () => {
  const moduleId = "espaciokoop-lagunak";
  assert.equal(extraerIntentoDeCambio({ changes: {}, moduleId, userDoc: {} }), null);
  assert.equal(
    extraerIntentoDeCambio({ changes: { flags: { [moduleId]: { otraCosa: 1 } } }, moduleId, userDoc: {} }),
    null,
  );
});

test("extraerIntentoDeCambio usa el documento actualizado, no el diferencial parcial", () => {
  // Mismo cuidado que station-order-relay/relevo: `changes` solo dice QUE el
  // flag se tocó; un reenvío con menos claves en `changes` no debe perder el
  // resto del intento, que sigue entero en `userDoc`.
  const moduleId = "espaciokoop-lagunak";
  const intentoCompleto = { cartaId: "m1:comunitaria:0", destino: { x: 5, y: 5 }, nonce: "n2" };
  const userDoc = { flags: { [moduleId]: { [ARRASTRE_FLAG]: intentoCompleto } } };
  const changesParciales = { flags: { [moduleId]: { [ARRASTRE_FLAG]: { nonce: "n2" } } } };
  const extraido = extraerIntentoDeCambio({ changes: changesParciales, moduleId, userDoc });
  assert.deepEqual(extraido, intentoCompleto);
});

test("resolverIntentoArrastre: carta vigente en la proyección se resuelve ok", () => {
  const proyeccion = proyectarMesa({ id: "m1", comunitarias: ["As", "Kd"], resultado: null });
  const intento = { cartaId: "m1:comunitaria:0", destino: { x: 3, y: 4 } };
  const resultado = resolverIntentoArrastre({ proyeccion, intento });
  assert.equal(resultado.ok, true);
  assert.equal(resultado.carta.id, "m1:comunitaria:0");
  assert.deepEqual(resultado.destino, { x: 3, y: 4 });
});

test("resolverIntentoArrastre: staleness — la carta ya no está en la proyección vigente", () => {
  // La mano avanzó o terminó entre el arrastre y su resolución: la carta que
  // se quería mover ya no representa nada real. No es un rechazo de regla de
  // póker, es que el objeto de escena ya no tiene detrás qué representar.
  const proyeccion = proyectarMesa({ id: "m1", comunitarias: [], resultado: null });
  const intento = { cartaId: "m1:comunitaria:0", destino: { x: 3, y: 4 } };
  const resultado = resolverIntentoArrastre({ proyeccion, intento });
  assert.deepEqual(resultado, { ok: false, codigo: ARRASTRE_ERRORES.CARTA_OBSOLETA });
});

test("resolverIntentoArrastre: acota el destino a los límites declarados", () => {
  const proyeccion = proyectarMesa({ id: "m1", comunitarias: ["As"], resultado: null });
  const intento = { cartaId: "m1:comunitaria:0", destino: { x: 1000, y: -50 } };
  const resultado = resolverIntentoArrastre({
    proyeccion,
    intento,
    limites: { minX: 0, minY: 0, maxX: 500, maxY: 500 },
  });
  assert.equal(resultado.ok, true);
  assert.deepEqual(resultado.destino, { x: 500, y: 0 });
});

test("resolverIntentoArrastre: límites imposibles rechazan por fuera-de-límites", () => {
  const proyeccion = proyectarMesa({ id: "m1", comunitarias: ["As"], resultado: null });
  const intento = { cartaId: "m1:comunitaria:0", destino: { x: 10, y: 10 } };
  const resultado = resolverIntentoArrastre({
    proyeccion,
    intento,
    limites: { minX: 100, maxX: 0, minY: 0, maxY: 100 },
  });
  assert.deepEqual(resultado, { ok: false, codigo: ARRASTRE_ERRORES.FUERA_DE_LIMITES });
});
