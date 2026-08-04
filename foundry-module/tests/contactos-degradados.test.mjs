// Pruebas de la degradación de contactos (#331, paso 3).
//
// Lo que se protege no es un formato: es que por este canal no se escape lo que
// el puesto de ciencia tiene que ganarse. Las pruebas que más valen son las de
// lo que NO sale — el indicativo lejano, el contacto fuera de alcance, y el caso
// en que no se sabe hasta dónde llegan los sensores.

import test from "node:test";
import assert from "node:assert/strict";

import { alcancesDe, degradarContactos } from "../scripts/contactos-degradados.mjs";

const RADAR = Object.freeze({ short_range: 5000, long_range: 30000 });
const CENTRO = Object.freeze({ x: 0, y: 0 });

const PAYLOAD = Object.freeze({
  contacts: [
    { callsign: "Lagunak", faction: "Humanos", is_player: true, position: { x: 3, y: 7 } },
    // scan_state "full" (#462): identificado por escaneo real, no por cercanía
    // — el eje que decide indicativo/facción ya no es la banda de distancia.
    {
      callsign: "Argia",
      faction: "Humanos",
      is_player: false,
      position: { x: 1234, y: 0 },
      scan_state: "full",
    },
    {
      callsign: "Kraylor Uno",
      faction: "Kraylor",
      is_player: false,
      position: { x: 20456, y: 0 },
      scan_state: "none",
    },
    {
      callsign: "Muy Lejos",
      faction: "Kraylor",
      is_player: false,
      position: { x: 99000, y: 0 },
      scan_state: "full",
    },
  ],
});

test("sin lectura de radar no se publica NINGÚN contacto", () => {
  // Falla cerrada, y la diferencia importa: `null` es «no se puede decidir qué
  // se ve», que no es lo mismo que «no se ve nada». Abrir de par en par «por si
  // acaso» es justo lo que este módulo existe para no hacer.
  for (const radar of [null, undefined, {}, { short_range: 5000 }, { long_range: 30000 }]) {
    assert.equal(degradarContactos(PAYLOAD, CENTRO, radar), null);
  }
  // Y sin saber dónde está la nave propia, tampoco hay distancias que medir.
  assert.equal(degradarContactos(PAYLOAD, null, RADAR), null);
  assert.equal(degradarContactos(PAYLOAD, { x: 0 }, RADAR), null);
});

test("un radar incoherente se rechaza en vez de corregirse a la brava", () => {
  // Adivinar cuál de los dos alcances quiso decir el escenario sería inventar.
  assert.equal(alcancesDe({ short_range: 30000, long_range: 5000 }), null);
  assert.equal(alcancesDe({ short_range: 0, long_range: 30000 }), null);
  assert.equal(alcancesDe({ short_range: -5, long_range: 30000 }), null);
  assert.deepEqual(alcancesDe(RADAR), { corto: 5000, largo: 30000 });
});

test("lo que está fuera de alcance no sale, y tampoco se cuenta", () => {
  const { contactos } = degradarContactos(PAYLOAD, CENTRO, RADAR);
  assert.equal(contactos.length, 3, "el contacto a 99000 no aparece");
  assert.ok(!contactos.some((c) => c.callsign === "Muy Lejos"));
  // Un total que incluyera lo invisible diría «hay algo más ahí fuera», que es
  // exactamente el dato que el puesto de ciencia tiene que ganarse.
  assert.equal(JSON.stringify(contactos).includes("99000"), false);
});

test("sin escaneo se pierde quién es, no solo dónde está", () => {
  // "Kraylor Uno" no tiene scan_state "simple"/"full" (#462): sin importar la
  // banda de distancia, no hay indicativo ni facción que enseñar.
  const { contactos } = degradarContactos(PAYLOAD, CENTRO, RADAR);
  const lejano = contactos.find((c) => c.banda === "largo" && c.distancia === 20000);
  assert.equal(lejano.callsign, null, "un eco no tiene nombre");
  assert.equal(lejano.faction, null, "ni bandera");
  assert.equal(lejano.distancia, 20000, "distancia redondeada a la rejilla gruesa");
  assert.equal(lejano.precision, 1000);
  // Un eco lejano tampoco se sabe fino de marcación: publicarlo con un grado
  // sería fingir una lectura que no se tiene.
  assert.equal(lejano.rumboPrecision, 15);
  assert.equal(lejano.rumboDeg % 15, 0);
});

test("identidad y posición se degradan por ejes independientes (#462)", () => {
  // Antes de #462 "cerca" e "identificado" eran la misma cosa (aproximación
  // por banda). Ahora un objeto ya escaneado sigue identificado aunque se
  // aleje, y uno sin escanear sigue siendo un eco aunque esté al lado.
  const payload = {
    contacts: [
      {
        callsign: "Escaneada Lejos",
        faction: "Kraylor",
        is_player: false,
        position: { x: 20000, y: 0 }, // banda larga
        scan_state: "full",
      },
      {
        callsign: "Sin Escanear Cerca",
        faction: "Kraylor",
        is_player: false,
        position: { x: 1000, y: 0 }, // banda corta
        scan_state: "none",
      },
    ],
  };
  const { contactos } = degradarContactos(payload, CENTRO, RADAR);

  const lejosEscaneada = contactos.find((c) => c.banda === "largo");
  assert.equal(lejosEscaneada.callsign, "Escaneada Lejos", "lejos, pero identificada");
  assert.equal(lejosEscaneada.faction, "Kraylor");

  const cercaSinEscanear = contactos.find((c) => c.banda === "corto");
  assert.equal(cercaSinEscanear.callsign, null, "cerca, pero sin escanear sigue siendo un eco");
  assert.equal(cercaSinEscanear.faction, null);
});

test("la identificación acepta 'simple' además de 'full', pero no 'fof' ni 'none'", () => {
  const base = { is_player: false, position: { x: 1000, y: 0 } };
  const casos = [
    { scan_state: "none", identificado: false },
    { scan_state: "fof", identificado: false },
    { scan_state: "simple", identificado: true },
    { scan_state: "full", identificado: true },
    { scan_state: undefined, identificado: false }, // sin campo, falla cerrado
  ];
  for (const { scan_state, identificado } of casos) {
    const payload = { contacts: [{ ...base, callsign: "X", faction: "Kraylor", scan_state }] };
    const [contacto] = degradarContactos(payload, CENTRO, RADAR).contactos;
    assert.equal(contacto.callsign, identificado ? "X" : null, `scan_state=${scan_state}`);
  }
});

test("NO se difunden coordenadas absolutas de nada", () => {
  // Es la fuga que este módulo existe para cerrar: la posición exacta de cada
  // objeto del sector iría a un ajuste que toda la mesa puede leer. Y además la
  // tripulación no recibe su propia posición, así que no le servirían de nada.
  const salida = degradarContactos(PAYLOAD, { x: 4000, y: 9000 }, RADAR);
  const texto = JSON.stringify(salida);
  assert.doesNotMatch(texto, /"position"/);
  assert.doesNotMatch(texto, /"x"|"y"/);
  for (const contacto of salida.contactos) {
    assert.equal(contacto.position, undefined);
    assert.equal(typeof contacto.distancia, "number");
    assert.equal(typeof contacto.rumboDeg, "number");
  }
});

test("dentro del alcance corto sí se identifica", () => {
  const { contactos } = degradarContactos(PAYLOAD, CENTRO, RADAR);
  const cerca = contactos.find((c) => c.banda === "corto");
  assert.equal(cerca.callsign, "Argia");
  assert.equal(cerca.faction, "Humanos");
  assert.equal(cerca.distancia, 1230, "redondeada a la rejilla fina");
  assert.equal(cerca.precision, 10);
  assert.equal(cerca.rumboPrecision, 1);
  // A proa del mundo: el contacto está en +x, que es marcación 90.
  assert.equal(cerca.rumboDeg, 90);
});

test("los márgenes viajan con el dato para poder enseñarlos", () => {
  // Sin esto, la consola escribiría un número fino sobre una lectura gruesa, que
  // sí sería mentir. Decir «a unos 20.000, con este margen» no lo es.
  const { contactos } = degradarContactos(PAYLOAD, CENTRO, RADAR);
  for (const contacto of contactos) {
    assert.equal(typeof contacto.precision, "number");
    assert.equal(typeof contacto.rumboPrecision, "number");
    assert.ok(contacto.precision >= 0 && contacto.rumboPrecision >= 0);
  }
});

test("la nave propia se publica entera y sin mirar distancia", () => {
  // La tripulación está dentro de ella: degradarla no protege nada.
  const { contactos } = degradarContactos(PAYLOAD, { x: 90000, y: 90000 }, RADAR);
  const propia = contactos.find((c) => c.esJugador);
  assert.equal(propia.callsign, "Lagunak");
  assert.equal(propia.faction, "Humanos");
  assert.equal(propia.distancia, 0, "de sí misma no hay distancia que medir");
  assert.equal(propia.precision, 0, "y por tanto tampoco margen");
});

test("el borde exacto del alcance corto cuenta como identificado", () => {
  // Un contacto justo en el límite tiene que caer en una banda concreta y
  // siempre la misma, o el mismo objeto parpadearía entre identificado y eco.
  const enElBorde = {
    contacts: [
      {
        callsign: "Justa",
        faction: "Humanos",
        is_player: false,
        position: { x: 5000, y: 0 },
        scan_state: "full",
      },
    ],
  };
  const { contactos } = degradarContactos(enElBorde, CENTRO, RADAR);
  assert.equal(contactos[0].banda, "corto");
  assert.equal(contactos[0].callsign, "Justa");

  const justoFuera = {
    contacts: [
      {
        callsign: "Justa",
        faction: "Humanos",
        is_player: false,
        position: { x: 30000, y: 0 },
        scan_state: "full",
      },
    ],
  };
  assert.equal(degradarContactos(justoFuera, CENTRO, RADAR).contactos[0].banda, "largo");
});

test("entradas rotas se descartan sin tumbar la lista", () => {
  const sucio = {
    contacts: [
      null,
      { callsign: "Sin sitio", is_player: false },
      { callsign: "Coordenada mala", is_player: false, position: { x: "cerca", y: 0 } },
      { callsign: "Propia sin sitio", is_player: true },
      {
        callsign: "Buena",
        faction: "Humanos",
        is_player: false,
        position: { x: 100, y: 0 },
        scan_state: "full",
      },
    ],
  };
  const { contactos } = degradarContactos(sucio, CENTRO, RADAR);
  assert.deepEqual(contactos.map((c) => c.callsign), ["Buena"]);
});

test("sin contactos devuelve lista vacía, que no es lo mismo que null", () => {
  const salida = degradarContactos({ contacts: [] }, CENTRO, RADAR);
  assert.deepEqual(salida.contactos, []);
  assert.deepEqual(salida.alcance, { corto: 5000, largo: 30000 });
});

// ---- La lista que se ve en la consola --------------------------------------

import { ESPACIO_FINO, filasCrudas, filasDegradadas } from "../scripts/sensores-lista.mjs";

const i18nFalso = { localize: (clave) => clave };

test("un eco se llama eco, no «desconocido»", () => {
  // «Desconocido» suena a que hay un nombre y no se ha averiguado. Un eco es que
  // el sensor solo devuelve un retorno, y esa diferencia ES el trabajo del puesto.
  const [fila] = filasDegradadas(
    { contactos: [{ banda: "largo", callsign: null, faction: null, distancia: 20000, rumboDeg: 75, precision: 1000, rumboPrecision: 15 }] },
    i18nFalso,
  );
  assert.equal(fila.callsign, "LAGUNAK.Espacios.Sensores.Eco");
  assert.equal(fila.faction, "LAGUNAK.Espacios.Sensores.SinIdentificar");
  assert.equal(fila.eco, true);
});

test("el margen se escribe, no se insinúa", () => {
  // «20 000» se lee como una medición; «≈20 000 ±1 000» se lee como lo que es.
  const [fila] = filasDegradadas(
    { contactos: [{ banda: "largo", distancia: 20000, rumboDeg: 75, precision: 1000, rumboPrecision: 15 }] },
    i18nFalso,
  );
  // El separador de miles es U+202F, no un espacio normal: se compara contra la
  // misma constante que usa el módulo para que nadie tenga que adivinarlo
  // mirando dos caracteres invisibles distintos.
  assert.equal(fila.lectura, `≈20${ESPACIO_FINO}000 ±1${ESPACIO_FINO}000 · ≈75° ±15°`);

  // Y una lectura exacta NO lleva `±`: si no, todo parecería aproximado.
  const [cerca] = filasDegradadas(
    { contactos: [{ banda: "corto", callsign: "Argia", faction: "Humanos", distancia: 1230, rumboDeg: 90, precision: 0, rumboPrecision: 0 }] },
    i18nFalso,
  );
  assert.doesNotMatch(cerca.lectura, /[≈±]/);
});

test("la lista ordena por cercanía y no enseña la nave propia", () => {
  const filas = filasDegradadas(
    {
      contactos: [
        { banda: "largo", distancia: 20000, rumboDeg: 0, precision: 1000, rumboPrecision: 15 },
        { banda: "propia", esJugador: true, callsign: "Lagunak", distancia: 0, rumboDeg: 0 },
        { banda: "corto", callsign: "Argia", faction: "Humanos", distancia: 1230, rumboDeg: 90, precision: 10, rumboPrecision: 1 },
      ],
    },
    i18nFalso,
  );
  assert.equal(filas.length, 2, "la propia no es un contacto que seguir");
  assert.equal(filas[0].callsign, "Argia", "lo más cercano primero");
});

test("sin lectura no se inventa un cero", () => {
  // Un cero se leería como «está encima de nosotros» y «va al norte».
  const [fila] = filasDegradadas({ contactos: [{ banda: "largo" }] }, i18nFalso);
  assert.equal(fila.lectura, "LAGUNAK.Espacios.Sensores.SinLectura");
});

test("el GM sigue leyendo coordenadas exactas, sin márgenes", () => {
  const filas = filasCrudas(
    { contacts: [{ callsign: "Argia", faction: "Humanos", position: { x: 1234, y: -56 } }] },
    i18nFalso,
    (f) => f,
  );
  assert.equal(filas[0].lectura, "1234, -56");
  assert.equal(filas[0].eco, false);
});
