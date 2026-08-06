import assert from "node:assert/strict";
import test from "node:test";

import {
  AJUSTE_TELEMETRIA,
  recortarNave,
  TIPO_TELEMETRIA,
  aceptarTelemetria,
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
  // El sobre lleva ahora también `sensores` (#331 paso 3): contactos YA
  // degradados en el origen. La lista es cerrada a propósito —si aparece una
  // clave nueva, esta prueba obliga a justificarla— porque este canal acaba en
  // un ajuste de mundo que toda la mesa puede leer.
  assert.deepEqual(Object.keys(sobre).sort(), ["sello", "sensores", "ship", "tipo"]);
});

test("LOS CONTACTOS NO VIAJAN: es la excepción del issue, no un olvido", () => {
  // Callsign, facción y coordenadas exactas son lo que el sistema de sensores
  // debería decidir cuánto revela. Difundirlos crudos regalaría el trabajo de
  // ese puesto. El sobre lleva `ship` y no el payload entero justamente para que
  // añadirlos sea una decisión y no un descuido.
  const sobre = sobreTelemetria(estado);
  assert.equal(sobre.ship.callsign, "Itsaso 1");
  assert.equal(sobre.contacts, undefined);
  assert.doesNotMatch(JSON.stringify(sobre), /Kestrel/);
});

test("un sondeo sin nave no difunde: no se borra la última lectura buena", () => {
  // Un fallo puntual del puente no debe vaciar las consolas de toda la mesa.
  for (const vacio of [null, undefined, {}, { ship: null }]) {
    assert.equal(sobreTelemetria(vacio), null);
    let emitido = false;
    assert.equal(difundirTelemetria({ statePayload: vacio, publicar: () => (emitido = true) }), null);
    assert.equal(emitido, false);
  }
});

test("difundir emite el sobre por el canal del módulo", () => {
  const enviados = [];
  const sobre = difundirTelemetria({ statePayload: estado, publicar: (s) => enviados.push(s) });
  assert.equal(enviados.length, 1);
  assert.deepEqual(enviados[0], sobre);
  assert.equal(sobre.tipo, TIPO_TELEMETRIA);
  assert.equal(AJUSTE_TELEMETRIA, "telemetriaNave");
  // Sin emisor no revienta: devuelve null y ya está.
  assert.equal(difundirTelemetria({ statePayload: estado }), null);
});

test("se filtra por tipo: en el ajuste solo vale un sobre de telemetría", () => {
  // Aceptar «lo que venga» haría que cualquier objeto guardado ahí acabara
  // interpretado como telemetría de la nave.
  assert.equal(aceptarTelemetria({ tipo: "minijuego:vista-privada", vista: {} }), null);
  assert.equal(aceptarTelemetria({ tipo: TIPO_TELEMETRIA, ship: null }), null);
  assert.equal(aceptarTelemetria({ tipo: TIPO_TELEMETRIA, ship: "no-es-objeto" }), null);
  assert.equal(aceptarTelemetria(null), null);
  // Lo que sale es la nave RECORTADA, no la cruda: lo que no se copia no puede
  // escaparse por un canal que lee toda la mesa.
  assert.deepEqual(aceptarTelemetria(sobreTelemetria(estado)), recortarNave(estado.ship));
});

test("un sobre viejo no pisa a uno nuevo: dos escrituras pueden cruzarse", () => {
  // Dos sondeos seguidos pueden llegar cruzados. Sin esto la consola parpadearía
  // hacia atrás, y en una lectura de rumbo eso se ve como una sacudida.
  assert.equal(esMasReciente({ sello: 100 }, null), true, "el primero siempre entra");
  assert.equal(esMasReciente({ sello: 200 }, 100), true);
  assert.equal(esMasReciente({ sello: 100 }, 200), false);
  assert.equal(esMasReciente({ sello: 100 }, 100), true, "un reenvío del mismo sello no estorba");
  assert.equal(esMasReciente({}, 100), false, "un sobre sin sello no se cuela");
  assert.equal(esMasReciente({ sello: "ayer" }, 100), false);
});

test("REGRESIÓN: la telemetría no se publica si nada ha cambiado", () => {
  // El precio del ajuste de mundo es la persistencia, y se paga aquí: con la
  // nave quieta no se escribe nada. Sin el recorte y el redondeo, el ruido del
  // último decimal escribiría en cada sondeo.
  const publicados = [];
  const primera = difundirTelemetria({
    statePayload: estado,
    publicar: (sobre) => publicados.push(sobre),
    anterior: null,
    ahora: 1000,
  });
  assert.ok(primera, "la primera lectura siempre se publica");
  assert.equal(publicados.length, 1);

  const repetida = difundirTelemetria({
    statePayload: estado,
    publicar: (sobre) => publicados.push(sobre),
    anterior: primera,
    ahora: 2000,
  });
  assert.equal(repetida, null, "la misma lectura no se reescribe");
  assert.equal(publicados.length, 1);

  // Un cambio real sí escribe.
  const movida = {
    ship: { ...estado.ship, heading: (Number(estado.ship.heading) || 0) + 5 },
  };
  const tercera = difundirTelemetria({
    statePayload: movida,
    publicar: (sobre) => publicados.push(sobre),
    anterior: primera,
    ahora: 3000,
  });
  assert.ok(tercera, "moverse sí publica");
  assert.equal(publicados.length, 2);
});

// --- Carga de maniobra en el sobre (#519) -------------------------------------

test("la carga de maniobra llega a la tripulación y conserva el cero", () => {
  // `recortarNave` es una lista blanca: sin esta copia, la consola de pilotaje
  // no vería nunca la carga y el control aparecería sin lectura para siempre.
  assert.deepEqual(
    recortarNave({ callsign: "Lagunak", systems: {}, combat_maneuver: { charge: 0.4237 } })
      .combat_maneuver,
    { charge: 0.424 },
  );
  assert.deepEqual(
    recortarNave({ callsign: "Lagunak", systems: {}, combat_maneuver: { charge: 0 } })
      .combat_maneuver,
    { charge: 0 },
  );
  // Sin componente no hay lectura, que no es lo mismo que estar a cero.
  assert.equal(recortarNave({ callsign: "Lagunak", systems: {} }).combat_maneuver, null);
});

test("una carga mal tipada no se convierte en un número inventado", () => {
  assert.equal(
    recortarNave({ callsign: "Lagunak", systems: {}, combat_maneuver: { charge: "media" } })
      .combat_maneuver,
    null,
  );
});
