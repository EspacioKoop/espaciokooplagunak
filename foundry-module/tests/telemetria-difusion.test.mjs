import assert from "node:assert/strict";
import test from "node:test";

import {
  TIPO_TELEMETRIA,
  aceptarTelemetria,
  canalTelemetria,
  difundirTelemetria,
  esMasReciente,
  sobreTelemetria,
} from "../scripts/telemetria-difusion.mjs";

const estado = {
  ship: { callsign: "Itsaso 1", hull: 80, hull_max: 100, heading: 214 },
  contacts: [{ callsign: "Kestrel", faction: "Hostil", position: { x: 100, y: 200 } }],
};

test("EL TOKEN NO VIAJA: el sobre lleva la nave y nada más", () => {
  // Es la garantía de fondo de #331. El GM sigue siendo el único que habla con
  // el puente; lo que reparte es el resultado, nunca la credencial.
  const sobre = sobreTelemetria({ ...estado, token: "secreto", bridgeUrl: "http://x" });
  const serializado = JSON.stringify(sobre);
  assert.doesNotMatch(serializado, /secreto/);
  assert.doesNotMatch(serializado, /bridgeUrl|Bearer|token/i);
  assert.deepEqual(Object.keys(sobre).sort(), ["contactos", "sello", "ship", "tipo"]);
});

test("LOS CONTACTOS VIAJAN DEGRADADOS, nunca crudos (paso 4)", () => {
  // Este es el único punto por el que el mapa completo del GM podría escaparse.
  // Un contacto lejano no puede llevar ni nombre ni coordenadas: con eso, un
  // cliente reconstruiría la partida entera y la degradación no habría servido.
  const lejano = {
    ship: { callsign: "Itsaso 1", position: { x: 0, y: 0 } },
    contacts: [{ callsign: "Kestrel", faction: "Hostil", position: { x: 20000, y: 0 } }],
  };
  const sobre = sobreTelemetria(lejano, { contacts: lejano.contacts });
  assert.equal(sobre.contactos.length, 1, "se detecta que hay algo");
  assert.equal(sobre.contactos[0].callsign, null, "pero no quién es");
  assert.equal(sobre.contactos[0].position, null, "ni dónde exactamente");
  assert.doesNotMatch(JSON.stringify(sobre), /Kestrel/, "el nombre no sale del cliente del GM");

  // De cerca sí, que para eso se acerca uno.
  const cerca = sobreTelemetria(lejano, {
    contacts: [{ callsign: "Kestrel", faction: "Hostil", position: { x: 1000, y: 0 } }],
  });
  assert.equal(cerca.contactos[0].callsign, "Kestrel");

  // Sin contactos que difundir, la lista va vacía y no falta la clave.
  assert.deepEqual(sobreTelemetria(estado).contactos, []);
});

test("un sondeo sin nave no difunde: no se borra la última lectura buena", () => {
  // Un fallo puntual del puente no debe vaciar las consolas de toda la mesa.
  for (const vacio of [null, undefined, {}, { ship: null }]) {
    assert.equal(sobreTelemetria(vacio), null);
    let emitido = false;
    assert.equal(difundirTelemetria({ statePayload: vacio, emitir: () => (emitido = true) }), null);
    assert.equal(emitido, false);
  }
});

test("difundir emite el sobre por el canal del módulo", () => {
  const enviados = [];
  const sobre = difundirTelemetria({ statePayload: estado, emitir: (s) => enviados.push(s) });
  assert.equal(enviados.length, 1);
  assert.deepEqual(enviados[0], sobre);
  assert.equal(sobre.tipo, TIPO_TELEMETRIA);
  assert.equal(canalTelemetria("mi-modulo"), "module.mi-modulo");
  // Sin emisor no revienta: devuelve null y ya está.
  assert.equal(difundirTelemetria({ statePayload: estado }), null);
});

test("se filtra por tipo: por este canal viajan también las manos del póker", () => {
  // Aceptar «lo que venga» haría que una vista privada de minijuego acabara
  // interpretada como telemetría de la nave.
  assert.equal(aceptarTelemetria({ tipo: "minijuego:vista-privada", vista: {} }), null);
  assert.equal(aceptarTelemetria({ tipo: TIPO_TELEMETRIA, ship: null }), null);
  assert.equal(aceptarTelemetria({ tipo: TIPO_TELEMETRIA, ship: "no-es-objeto" }), null);
  assert.equal(aceptarTelemetria(null), null);
  const recibido = aceptarTelemetria(sobreTelemetria(estado));
  assert.deepEqual(recibido.ship, estado.ship);
  assert.deepEqual(recibido.contactos, [], "sin contactos difundidos, lista vacía y no undefined");
});

test("un sobre viejo no pisa a uno nuevo: el socket no garantiza orden", () => {
  // Dos sondeos seguidos pueden llegar cruzados. Sin esto la consola parpadearía
  // hacia atrás, y en una lectura de rumbo eso se ve como una sacudida.
  assert.equal(esMasReciente({ sello: 100 }, null), true, "el primero siempre entra");
  assert.equal(esMasReciente({ sello: 200 }, 100), true);
  assert.equal(esMasReciente({ sello: 100 }, 200), false);
  assert.equal(esMasReciente({ sello: 100 }, 100), true, "un reenvío del mismo sello no estorba");
  assert.equal(esMasReciente({}, 100), false, "un sobre sin sello no se cuela");
  assert.equal(esMasReciente({ sello: "ayer" }, 100), false);
});
