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
} from "../../scripts/ship-view/telemetria-difusion.mjs";

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
  // `sensoresSonda` (#520) es la MISMA lectura degradada centrada en la sonda
  // enlazada, no un dato nuevo: mismo alcance, mismo filtro, otro centro. La
  // posición exacta de la sonda NO viaja por aquí.
  assert.deepEqual(
    Object.keys(sobre).sort(),
    ["sello", "sensores", "sensoresSonda", "ship", "tipo"],
  );
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

// --- Autodestrucción y calibrado en el sobre (#518) ---------------------------

test("el sobre lleva si la secuencia está armada, pero JAMÁS un código", () => {
  // El sobre acaba en un ajuste de mundo que toda la mesa puede leer: un código
  // aquí sería un código público y el puzle de tres personas dejaría de existir.
  const nave = recortarNave({
    callsign: "Lagunak",
    systems: {},
    self_destruct: {
      active: true,
      countdown: 42.44,
      code: [1111, 2222, 3333],
      confirmed: [true, false, false],
    },
  });
  assert.deepEqual(nave.self_destruct, { active: true, countdown: 42.4 });
  const serializado = JSON.stringify(nave);
  assert.doesNotMatch(serializado, /1111/);
  assert.doesNotMatch(serializado, /confirmed/);
});

test("sin armar no viaja una cuenta atrás, y sin componente no viaja nada", () => {
  assert.deepEqual(
    recortarNave({ callsign: "Lagunak", systems: {}, self_destruct: { active: false, countdown: 0 } })
      .self_destruct,
    { active: false, countdown: null },
  );
  assert.equal(recortarNave({ callsign: "Lagunak", systems: {} }).self_destruct, null);
});

test("el calibrado de escudos viaja con su retardo", () => {
  const nave = recortarNave({
    callsign: "Lagunak",
    systems: {},
    shield_calibration: { frequency: 12, calibration_delay: 3.55 },
  });
  assert.deepEqual(nave.shield_calibration, { frequency: 12, calibration_delay: 3.6 });
  assert.equal(recortarNave({ callsign: "Lagunak", systems: {} }).shield_calibration, null);
});

// --- Condición de alerta y sondas en el sobre (#517) --------------------------

test("la condición declarada llega a toda la tripulación, no solo a Relay", () => {
  // Fijarla es de Relay (#237); saber que la nave está en roja es de todos.
  // `recortarNave` es una lista blanca: sin esta copia no llegaría a nadie.
  assert.equal(
    recortarNave({ callsign: "Lagunak", systems: {}, alert_level: "red" }).alert_level,
    "red",
  );
});

test("un nivel desconocido no se cae a 'normal'", () => {
  // Decir "normal" ante lo que no se entiende afirmaría que la nave está
  // tranquila justo cuando no se sabe si lo está.
  for (const crudo of ["azul", "RED ALERT", "", null, 5]) {
    assert.equal(
      recortarNave({ callsign: "Lagunak", systems: {}, alert_level: crudo }).alert_level,
      null,
      String(crudo),
    );
  }
});

test("las sondas viajan con su máximo, y cero es una lectura", () => {
  assert.deepEqual(
    recortarNave({ callsign: "Lagunak", systems: {}, probes: { stock: 3, max: 8 } }).probes,
    { stock: 3, max: 8 },
  );
  assert.deepEqual(
    recortarNave({ callsign: "Lagunak", systems: {}, probes: { stock: 0, max: 8 } }).probes,
    { stock: 0, max: 8 },
  );
  assert.equal(recortarNave({ callsign: "Lagunak", systems: {} }).probes, null);
});

// --- Vista de sonda y enlace a ciencia (#520) ---------------------------------

const CONTACTOS_LEJOS = {
  contacts: [
    { callsign: "Lapur 1", position: { x: 30000, y: 0 }, faction: "Exuari", scan_state: "none" },
  ],
};

test("con sonda enlazada se difunde una segunda lectura centrada en ella", () => {
  // Lo que hace útil la vista de sonda: ver lo que hay a su alrededor, lejos de
  // la nave, con el MISMO alcance y la MISMA degradación. Otro centro, nada más.
  const sobre = sobreTelemetria(
    {
      ship: {
        ...estado.ship,
        position: { x: 0, y: 0 },
        radar: { short_range: 5000, long_range: 30000 },
        science_link: { callsign: "P-1", position: { x: 29000, y: 0 } },
      },
    },
    1,
    CONTACTOS_LEJOS,
  );
  assert.ok(sobre.sensoresSonda, "hay lectura desde la sonda");
  assert.ok(
    sobre.sensoresSonda.contactos.length > 0,
    "el contacto lejano sí se ve desde la sonda",
  );
  // Desde la sonda el mismo contacto está a un palmo; desde la nave, al borde.
  const desdeSonda = sobre.sensoresSonda.contactos[0].distancia;
  const desdeNave = sobre.sensores.contactos[0]?.distancia ?? Infinity;
  assert.ok(desdeSonda < desdeNave, "la distancia se mide desde la sonda");
});

test("sin enlace no se difunde una vista de sonda vacía", () => {
  // `null` apaga la vista. Una lista vacía diría «he mirado desde la sonda y no
  // hay nada» sin haber sonda ninguna: el cuarto estado de #353 otra vez.
  const sobre = sobreTelemetria(estado, 1, CONTACTOS_LEJOS);
  assert.equal(sobre.sensoresSonda, null);
});

test("del enlace viaja el indicativo, nunca la posición de la sonda", () => {
  // Este sobre acaba en un ajuste de mundo que toda la mesa puede leer: una
  // coordenada exacta ahí sería una coordenada exacta para todos.
  const nave = recortarNave({
    callsign: "Lagunak",
    systems: {},
    science_link: { callsign: "P-1", position: { x: 12345, y: 6789 } },
  });
  assert.deepEqual(nave.science_link, { callsign: "P-1" });
  assert.doesNotMatch(JSON.stringify(nave), /12345/);
  assert.equal(recortarNave({ callsign: "Lagunak", systems: {} }).science_link, null);
});
// --- Interior de la nave en el sobre (#522) -----------------------------------

test("el plano y los equipos llegan a la tripulación", () => {
  // `recortarNave` es una lista blanca: sin esta copia, Damage Control no vería
  // nunca su propia nave y el control aparecería sin plano para siempre.
  const nave = recortarNave({
    callsign: "Lagunak",
    systems: {},
    internal: {
      rooms: [{ x: 0, y: 0, w: 2, h: 1, system: "reactor" }],
      crews: [{ position: { x: 0, y: 0 }, target: { x: 1, y: 0 } }],
    },
  });
  assert.deepEqual(nave.internal.rooms, [{ x: 0, y: 0, w: 2, h: 1, system: "reactor" }]);
  assert.deepEqual(nave.internal.crews, [
    { position: { x: 0, y: 0 }, target: { x: 1, y: 0 } },
  ]);
});

test("una sala a medias no pinta un plano mentiroso", () => {
  const nave = recortarNave({
    callsign: "Lagunak",
    systems: {},
    internal: {
      rooms: [{ x: 0, y: 0, w: 1 }, { x: 1, y: 1, w: 1, h: 1, system: null }],
      crews: [],
    },
  });
  assert.equal(nave.internal.rooms.length, 1);
  assert.equal(nave.internal.rooms[0].system, null);
});

test("sin salas no viaja un interior vacío", () => {
  assert.equal(recortarNave({ callsign: "Lagunak", systems: {} }).internal, null);
  assert.equal(
    recortarNave({ callsign: "Lagunak", systems: {}, internal: { rooms: [], crews: [] } }).internal,
    null,
  );
});
