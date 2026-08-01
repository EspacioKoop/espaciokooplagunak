import assert from "node:assert/strict";
import test from "node:test";

import { resolverLoteMapa } from "../scripts/mapa-lote.mjs";

const ok = (value) => ({ status: "fulfilled", value });
const ko = (reason) => ({ status: "rejected", reason });

const ESTADO = { ship: { position: { x: 10, y: 20 }, heading: 30 } };
const CONTACTOS = { contacts: [{ callsign: "K-7" }] };

test("con las dos ramas buenas, pasan las dos", () => {
  const lote = resolverLoteMapa(ok(ESTADO), ok(CONTACTOS));
  assert.equal(lote.estado, ESTADO);
  assert.deepEqual(lote.contactosCrudos, CONTACTOS.contacts);
  assert.equal(lote.falloContactos, null);
});

test("EL BUENO SE USA: un `contacts` caído no tira el `state` que llegó bien", () => {
  // El fallo de #276 paso 0. Antes esto era un `throw` y la ventana entera se
  // iba a error de conexión: se perdían posición, rumbo y destino —y la nave
  // que alimenta las vistas por puesto— por una lista que no llegó.
  const motivo = new Error("contacts inaccesible");
  const lote = resolverLoteMapa(ok(ESTADO), ko(motivo));
  assert.equal(lote.estado, ESTADO, "la lectura de la nave propia sobrevive");
  assert.equal(lote.falloContactos, motivo);
});

test("NO SE RELLENA CON LO VIEJO: sin contactos, la lista va vacía", () => {
  // Unos contactos de hace tres sondeos pintados como si fueran de ahora no se
  // distinguen de los buenos, y esa es la única forma de que el GM dirija
  // sobre algo que ya no está ahí. Vacío es honesto; el aviso lo explica.
  const lote = resolverLoteMapa(ok(ESTADO), ko(new Error("nope")));
  assert.deepEqual(lote.contactosCrudos, []);
});

test("SIN CENTRO NO HAY MAPA: un `state` caído sí tumba la vuelta", () => {
  // La jerarquía no es simétrica: los contactos se dibujan RELATIVOS a la nave
  // propia, así que unos contactos huérfanos no son media verdad, son
  // coordenadas sin origen.
  const motivo = new Error("state inaccesible");
  assert.throws(() => resolverLoteMapa(ko(motivo), ok(CONTACTOS)), (err) => err === motivo);
});

test("si caen las dos, manda el motivo de `state`", () => {
  const motivoEstado = new Error("state inaccesible");
  assert.throws(
    () => resolverLoteMapa(ko(motivoEstado), ko(new Error("contacts inaccesible"))),
    (err) => err === motivoEstado,
  );
});

test("un `contacts` sin lista no es un fallo, es una lista vacía", () => {
  // 200 sin `contacts` es una respuesta válida del puente: no hay nadie cerca.
  // Distinguirlo de un fallo importa, porque uno enciende el aviso y el otro no.
  for (const cuerpo of [{}, { contacts: [] }, null]) {
    const lote = resolverLoteMapa(ok(ESTADO), ok(cuerpo));
    assert.deepEqual(lote.contactosCrudos, []);
    assert.equal(lote.falloContactos, null, `${JSON.stringify(cuerpo)} no es un fallo`);
  }
});
