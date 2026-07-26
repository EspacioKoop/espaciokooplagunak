import assert from "node:assert/strict";
import test from "node:test";

import {
  crear,
  aplicar,
  vistaPublica,
  vistaPrivada,
  accionesPermitidas,
  haTerminado,
  resultado,
} from "../scripts/minijuegos/poker-motor.mjs";

function mesa(numJugadores, stack = 100, semilla = 2026) {
  const jugadores = Array.from({ length: numJugadores }, (_, i) => ({
    userId: `u${i}`,
    stack,
  }));
  return crear({ jugadores, ciegaPequena: 1, ciegaGrande: 2, botonIndice: 0 }, semilla);
}

function fichasTotales(estado) {
  const pub = vistaPublica(estado);
  const enStacks = pub.jugadores.reduce((s, j) => s + j.stack, 0);
  return enStacks + pub.bote;
}

// Conduce la mano con una política simple: pasa si puede, si no iguala; nunca
// sube. Sirve para llevar cualquier mesa hasta el final de forma determinista.
function jugarPasivo(estadoInicial) {
  let estado = estadoInicial;
  let guarda = 0;
  while (!haTerminado(estado) && guarda < 200) {
    const pub = vistaPublica(estado);
    const acciones = accionesPermitidas(estado, pub.turno);
    const tipo = acciones.includes("check") ? "check" : "call";
    const res = aplicar(estado, { actorId: pub.turno, tipo });
    assert.equal(res.ok, true);
    estado = res.estado;
    guarda += 1;
  }
  return estado;
}

test("crear coloca ciegas, reparte dos cartas y fija el turno inicial", () => {
  const estado = mesa(4);
  const pub = vistaPublica(estado);
  assert.equal(pub.bote, 3); // 1 + 2
  assert.equal(pub.apuestaActual, 2);
  assert.equal(pub.fase, "preflop");
  // UTG (asiento 3, siguiente a la ciega grande en asiento 2) habla primero.
  assert.equal(pub.turno, "u3");
  for (const j of ["u0", "u1", "u2", "u3"]) {
    assert.equal(vistaPrivada(estado, j).tuMano.length, 2);
  }
});

test("la vista pública no filtra las cartas privadas de nadie", () => {
  const estado = mesa(3);
  const pub = vistaPublica(estado);
  assert.equal("tuMano" in pub, false);
  assert.equal(JSON.stringify(pub).includes('"tuMano"'), false);
});

test("misma semilla produce una mano idéntica (determinismo)", () => {
  const a = jugarPasivo(mesa(4, 100, 777));
  const b = jugarPasivo(mesa(4, 100, 777));
  assert.deepEqual(resultado(a), resultado(b));
});

test("las fichas se conservan a lo largo de toda la mano", () => {
  const inicial = mesa(5, 100, 123);
  assert.equal(fichasTotales(inicial), 500);
  const final = jugarPasivo(inicial);
  assert.equal(fichasTotales(final), 500);
  assert.equal(haTerminado(final), true);
});

test("si todos se retiran, gana el último en pie sin showdown", () => {
  let estado = mesa(4, 100, 55);
  // u3, u0, u1 se retiran; queda u2 (ciega grande).
  for (const quien of ["u3", "u0", "u1"]) {
    const pub = vistaPublica(estado);
    assert.equal(pub.turno, quien);
    estado = aplicar(estado, { actorId: quien, tipo: "fold" }).estado;
  }
  const res = resultado(estado);
  assert.equal(res.tipo, "sin-rival");
  assert.equal(res.ganadorId, "u2");
  assert.equal(fichasTotales(estado), 400);
  // El ganador recupera su ciega y se lleva las ajenas: 100 + (1 SB de u1).
  assert.equal(res.stacksFinales.u2, 101);
});

test("un showdown reparte todo el bote y conserva las fichas", () => {
  const final = jugarPasivo(mesa(3, 100, 999));
  const res = resultado(final);
  assert.equal(res.tipo, "showdown");
  const repartido = Object.values(res.ganancias).reduce((s, v) => s + v, 0);
  const bote = vistaPublica(mesa(3, 100, 999)).bote; // solo ciegas al inicio
  assert.ok(repartido > 0);
  assert.ok(bote > 0);
  assert.equal(fichasTotales(final), 300);
  // Todas las manos en pie quedan reveladas.
  assert.ok(Object.keys(res.manos).length >= 2);
});

test("acciones permitidas: check solo si nada que igualar; call si hay apuesta", () => {
  const estado = mesa(4);
  // UTG debe igualar la ciega grande: no puede check.
  assert.deepEqual(accionesPermitidas(estado, "u3").sort(), ["call", "fold", "raise"].sort());
  // Un jugador que no está de turno no tiene acciones.
  assert.deepEqual(accionesPermitidas(estado, "u0"), []);
});

test("aplicar rechaza acciones fuera de turno y no permitidas", () => {
  const estado = mesa(4);
  assert.equal(aplicar(estado, { actorId: "u0", tipo: "check" }).ok, false);
  assert.equal(aplicar(estado, { actorId: "u3", tipo: "check" }).ok, false); // hay apuesta
  const raiseInvalida = aplicar(estado, { actorId: "u3", tipo: "raise", parametros: { hasta: 2 } });
  assert.equal(raiseInvalida.ok, false); // no supera la apuesta actual
});

test("una subida reabre la ronda para los demás", () => {
  let estado = mesa(4, 100, 321);
  // u3 sube a 6.
  const res = aplicar(estado, { actorId: "u3", tipo: "raise", parametros: { hasta: 6 } });
  assert.equal(res.ok, true);
  estado = res.estado;
  const pub = vistaPublica(estado);
  assert.equal(pub.apuestaActual, 6);
  assert.equal(pub.turno, "u0"); // sigue la acción tras la subida
});

test("heads-up: el botón es la ciega pequeña y actúa primero en preflop", () => {
  const estado = mesa(2, 100, 42);
  const pub = vistaPublica(estado);
  assert.equal(pub.bote, 3);
  assert.equal(pub.turno, "u0"); // botón/SB habla primero heads-up
});

test("no se puede actuar tras terminar la mano", () => {
  const final = jugarPasivo(mesa(3, 100, 8));
  const res = aplicar(final, { actorId: "u0", tipo: "check" });
  assert.equal(res.ok, false);
  assert.equal(res.codigo, "mano_terminada");
});
