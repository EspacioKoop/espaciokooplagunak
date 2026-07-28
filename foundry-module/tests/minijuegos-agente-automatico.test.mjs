import assert from "node:assert/strict";
import test from "node:test";

import {
  decidirAccionAutomatica,
  estimarFuerza,
} from "../scripts/minijuegos/agente-automatico.mjs";
import {
  crear,
  aplicar,
  vistaPrivada,
  accionesPermitidas,
  haTerminado,
  resultado,
} from "../scripts/minijuegos/poker-motor.mjs";

test("estimarFuerza puntúa mejor una pareja alta que dos cartas bajas", () => {
  const parejaAses = estimarFuerza({ tuMano: ["As", "Ah"], comunitarias: [] });
  const bajaSuelta = estimarFuerza({ tuMano: ["7s", "2d"], comunitarias: [] });
  assert.ok(parejaAses > bajaSuelta);
  assert.ok(parejaAses <= 1 && bajaSuelta >= 0);
});

test("con mano floja y coste alto, el NPC se retira", () => {
  const vista = {
    turno: "npc",
    apuestaActual: 40,
    subidaMinima: 2,
    comunitarias: [],
    tuMano: ["7s", "2d"],
    jugadores: [{ userId: "npc", stack: 100, apostadoRonda: 0 }],
  };
  const accion = decidirAccionAutomatica(vista, ["fold", "call", "raise"]);
  assert.equal(accion.tipo, "fold");
});

test("si puede pasar gratis con mano floja, pasa (no se retira)", () => {
  const vista = {
    turno: "npc",
    apuestaActual: 0,
    subidaMinima: 2,
    comunitarias: [],
    tuMano: ["7s", "2d"],
    jugadores: [{ userId: "npc", stack: 100, apostadoRonda: 0 }],
  };
  const accion = decidirAccionAutomatica(vista, ["fold", "check", "raise"]);
  assert.equal(accion.tipo, "check");
});

test("una subida automática nunca excede el máximo del jugador", () => {
  const vista = {
    turno: "npc",
    apuestaActual: 2,
    subidaMinima: 2,
    comunitarias: ["As", "Ah", "Ad"],
    tuMano: ["Ac", "Kd"],
    jugadores: [{ userId: "npc", stack: 5, apostadoRonda: 0 }],
  };
  const accion = decidirAccionAutomatica(vista, ["fold", "call", "raise"]);
  if (accion.tipo === "raise") {
    assert.ok(accion.parametros.hasta <= 5);
  }
});

test("una mesa 100% NPC se juega sola hasta el final de forma determinista", () => {
  function jugarConNpcs(semilla) {
    const jugadores = ["n0", "n1", "n2"].map((userId) => ({
      userId,
      stack: 100,
      controlador: "automatico",
    }));
    let estado = crear({ jugadores, ciegaPequena: 1, ciegaGrande: 2, botonIndice: 0 }, semilla);
    let guarda = 0;
    while (!haTerminado(estado) && guarda < 300) {
      const turno = estado.jugadores[estado.turnoIndice].userId;
      const acciones = accionesPermitidas(estado, turno);
      const accion = decidirAccionAutomatica(vistaPrivada(estado, turno), acciones);
      const res = aplicar(estado, { actorId: turno, ...accion });
      assert.equal(res.ok, true, `acción NPC rechazada: ${JSON.stringify(accion)}`);
      estado = res.estado;
      guarda += 1;
    }
    assert.equal(haTerminado(estado), true);
    return estado;
  }

  const a = jugarConNpcs(31415);
  const b = jugarConNpcs(31415);
  assert.deepEqual(resultado(a), resultado(b));
  // Fichas conservadas: 3 × 100.
  const total = Object.values(resultado(a).stacksFinales).reduce((s, v) => s + v, 0);
  assert.equal(total, 300);
});
