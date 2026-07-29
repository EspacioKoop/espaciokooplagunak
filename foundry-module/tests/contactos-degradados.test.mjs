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
    { callsign: "Argia", faction: "Humanos", is_player: false, position: { x: 1234, y: 0 } },
    { callsign: "Kraylor Uno", faction: "Kraylor", is_player: false, position: { x: 20456, y: 0 } },
    { callsign: "Muy Lejos", faction: "Kraylor", is_player: false, position: { x: 99000, y: 0 } },
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

test("en banda larga se pierde quién es, no solo dónde está", () => {
  const { contactos } = degradarContactos(PAYLOAD, CENTRO, RADAR);
  const lejano = contactos.find((c) => c.banda === "largo");
  assert.equal(lejano.callsign, null, "un eco no tiene nombre");
  assert.equal(lejano.faction, null, "ni bandera");
  assert.equal(lejano.position.x, 20000, "posición redondeada a la rejilla gruesa");
  assert.equal(lejano.precision, 1000);
});

test("dentro del alcance corto sí se identifica", () => {
  const { contactos } = degradarContactos(PAYLOAD, CENTRO, RADAR);
  const cerca = contactos.find((c) => c.banda === "corto");
  assert.equal(cerca.callsign, "Argia");
  assert.equal(cerca.faction, "Humanos");
  assert.equal(cerca.position.x, 1230, "redondeado a la rejilla fina");
  assert.equal(cerca.precision, 10);
});

test("la precisión viaja con el punto para poder dibujar el margen", () => {
  // Sin esto, la vista pintaría un punto fino sobre un dato grueso, que sí sería
  // mentir. Decir «está por aquí, con este margen» no lo es.
  const { contactos } = degradarContactos(PAYLOAD, CENTRO, RADAR);
  for (const contacto of contactos) {
    assert.equal(typeof contacto.precision, "number");
    assert.ok(contacto.precision >= 0);
  }
});

test("la nave propia se publica entera y sin mirar distancia", () => {
  // La tripulación está dentro de ella: degradarla no protege nada.
  const { contactos } = degradarContactos(PAYLOAD, { x: 90000, y: 90000 }, RADAR);
  const propia = contactos.find((c) => c.esJugador);
  assert.equal(propia.callsign, "Lagunak");
  assert.equal(propia.faction, "Humanos");
  assert.deepEqual(propia.position, { x: 3, y: 7 });
  assert.equal(propia.precision, 0, "sin redondeo: es su propia posición");
});

test("el borde exacto del alcance corto cuenta como identificado", () => {
  // Un contacto justo en el límite tiene que caer en una banda concreta y
  // siempre la misma, o el mismo objeto parpadearía entre identificado y eco.
  const enElBorde = {
    contacts: [{ callsign: "Justa", faction: "Humanos", is_player: false, position: { x: 5000, y: 0 } }],
  };
  const { contactos } = degradarContactos(enElBorde, CENTRO, RADAR);
  assert.equal(contactos[0].banda, "corto");
  assert.equal(contactos[0].callsign, "Justa");

  const justoFuera = {
    contacts: [{ callsign: "Justa", faction: "Humanos", is_player: false, position: { x: 30000, y: 0 } }],
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
      { callsign: "Buena", faction: "Humanos", is_player: false, position: { x: 100, y: 0 } },
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
