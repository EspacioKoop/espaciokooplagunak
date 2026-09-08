import assert from "node:assert/strict";
import test from "node:test";

import { crear, vistaPublica, vistaPrivada, aplicar } from "../scripts/minijuegos/poker-motor.mjs";
import { proyectarCartasVisibles } from "../scripts/minijuegos/carta-proyeccion.mjs";

function mesa(numJugadores = 2, stack = 100, semilla = 2026) {
  const jugadores = Array.from({ length: numJugadores }, (_, i) => ({
    userId: `u${i}`,
    stack,
  }));
  return crear({ jugadores, ciegaPequena: 1, ciegaGrande: 2, botonIndice: 0 }, semilla);
}

test("sin comunitarias y sin mostrar nada, un espectador no ve ninguna carta", () => {
  const estado = mesa();
  const pub = vistaPublica(estado);
  assert.deepEqual(proyectarCartasVisibles(pub, null), []);
});

test("el propio jugador ve su mano boca arriba, nunca la ajena", () => {
  const estado = mesa();
  const privadaU0 = vistaPrivada(estado, "u0");
  const cartas = proyectarCartasVisibles(privadaU0, "u0");
  assert.equal(cartas.length, 2);
  assert.ok(cartas.every((c) => c.zona === "mano-propia" && c.bocaArriba === true));
  assert.ok(cartas.every((c) => typeof c.codigo === "string"));
});

test("mostrar una carta la hace visible para todo el mundo, no solo para su dueño", () => {
  let estado = mesa();
  const propiaAntes = vistaPrivada(estado, "u0").tuMano[0];

  const res = aplicar(estado, { actorId: "u0", tipo: "mostrar", parametros: { indice: 0 } });
  assert.equal(res.ok, true);
  estado = res.estado;

  const pub = vistaPublica(estado);
  const comoEspectador = proyectarCartasVisibles(pub, null);
  assert.equal(comoEspectador.length, 1);
  assert.equal(comoEspectador[0].zona, "mano-ajena:u0");
  assert.equal(comoEspectador[0].codigo, propiaAntes);

  // La otra carta de u0 sigue sin poder proyectarse para nadie más.
  const comoOtroJugador = proyectarCartasVisibles(vistaPrivada(estado, "u1"), "u1");
  assert.equal(comoOtroJugador.length, 3); // su propia mano (2) + la mostrada de u0.
});

test("las comunitarias se proyectan a la zona mesa boca arriba en cuanto existen", () => {
  const estado = mesa();
  const pub = vistaPublica(estado);
  // preflop: sin comunitarias todavía.
  assert.deepEqual(
    proyectarCartasVisibles(pub, null).filter((c) => c.zona === "mesa"),
    [],
  );
});
