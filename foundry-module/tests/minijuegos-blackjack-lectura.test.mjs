// Lectura de la mesa de blackjack (#553, del QA #449).
//
// Lo que se defiende aquí es que la mesa no MIENTA: que el cartel de reglas
// salga del motor, que la lectura no adelante un desenlace y que no explique
// permisos que no ha concedido.

import test from "node:test";
import assert from "node:assert/strict";

import {
  estadoDeJugador,
  lecturaBlackjack,
  porQueNoPuedesDoblar,
  reglasDeLaCasa,
  situacion,
} from "../scripts/minijuegos/blackjack-lectura.mjs";
import {
  CARTAS_PARA_DOBLAR,
  LIMITE_PLANTADO_BANCA,
  PAGO_BLACKJACK,
} from "../scripts/minijuegos/blackjack-motor.mjs";
import { normalizarMesaBlackjack } from "../scripts/minijuegos/mesa-config.mjs";

const MESA = normalizarMesaBlackjack({ apuesta: 5, fichasIniciales: 100 });

const enCurso = (extra = {}) => ({
  hayMesa: true,
  manoEnCurso: true,
  manoCancelada: false,
  esTuTurno: false,
  jugadores: [],
  acciones: [],
  ...extra,
});

test("el cartel de reglas sale del MOTOR, no de un texto escrito al lado", () => {
  // La regla que hace que este módulo no pueda mentir. Si mañana la banca se
  // planta en 18 o el blackjack paga 6:5, el cartel cambia solo — y si alguien
  // añade una regla que el motor no aplica, este test no la avala.
  const reglas = reglasDeLaCasa(MESA);
  const porClave = new Map(reglas.map((r) => [r.clave.split(".").pop(), r.datos]));
  assert.equal(porClave.get("Banca").limite, LIMITE_PLANTADO_BANCA);
  assert.equal(porClave.get("Blackjack").pago, PAGO_BLACKJACK);
  assert.equal(porClave.get("Doblar").cartas, CARTAS_PARA_DOBLAR);
  assert.equal(porClave.get("Apuesta").apuesta, 5);
});

test("una mesa sin apuesta fijada no anuncia apuesta", () => {
  // Un cartel que diga «apuesta: 0» es peor que uno que no hable de la apuesta.
  const claves = reglasDeLaCasa({}).map((r) => r.clave);
  assert.ok(!claves.some((c) => c.endsWith("Apuesta")));
});

test("todo lo que devuelve son claves de i18n, nunca texto", () => {
  // Quien pinta traduce: así esto se prueba sin cargar idiomas y una mesa en
  // euskera no necesita otro módulo.
  const lectura = lecturaBlackjack(enCurso({ esTuTurno: true, jugadores: [] }), MESA);
  const claves = [lectura.situacion.clave, ...lectura.reglas.map((r) => r.clave)];
  for (const clave of claves) assert.match(clave, /^LAGUNAK\.Blackjack\.Lectura\./);
});

test("lo primero que se dice es si te toca a ti", () => {
  const mia = situacion(enCurso({ esTuTurno: true, jugadores: [{ eresTu: true, total: 15 }] }));
  assert.ok(mia.esTuTurno);
  assert.ok(mia.clave.endsWith("TuTurno"));
  assert.equal(mia.datos.total, 15, "con el total delante, que es lo que se decide");
});

test("si le toca a otro se dice de quién es el turno", () => {
  const ajena = situacion(enCurso({ jugadores: [{ userId: "u2", esTurno: true }] }));
  assert.ok(ajena.clave.endsWith("TurnoDeOtro"));
  assert.equal(ajena.datos.userId, "u2");
});

test("sin nadie en turno y con la mano viva, juega la banca", () => {
  // Es el hueco que dejaba la vista cruda: los jugadores han terminado, la mano
  // no, y en pantalla no pasaba nada — parecía que se había colgado.
  const banca = situacion(enCurso({ jugadores: [{ userId: "u1", terminado: true }] }));
  assert.ok(banca.clave.endsWith("JuegaLaBanca"));
  assert.equal(banca.datos.limite, LIMITE_PLANTADO_BANCA);
});

test("la mesa recién abierta y la mano ya resuelta no dicen lo mismo", () => {
  const nueva = situacion({ hayMesa: true, manoEnCurso: false, resultado: null });
  const resuelta = situacion({ hayMesa: true, manoEnCurso: false, resultado: { jugadores: [] } });
  assert.ok(nueva.clave.endsWith("EsperandoReparto"));
  assert.ok(resuelta.clave.endsWith("ManoResuelta"));
  assert.notEqual(nueva.clave, resuelta.clave);
});

test("sin mesa, y con la mano cancelada, se dicen las dos cosas", () => {
  assert.ok(situacion({ hayMesa: false }).clave.endsWith("SinMesa"));
  assert.ok(situacion({ hayMesa: true, manoCancelada: true }).clave.endsWith("Cancelada"));
});

test("el estado de un jugador distingue cómo acabó de si ganó", () => {
  // `motivo` y `desenlace` son dos cosas y una mano tiene lo primero mucho antes
  // que lo segundo: plantarse no es ganar.
  assert.ok(estadoDeJugador({ motivo: "plantado", total: 19 }).clave.endsWith("Motivo.Plantado"));
  assert.ok(estadoDeJugador({ motivo: "bust", total: 23 }).clave.endsWith("Motivo.Bust"));
  const ganador = estadoDeJugador({ motivo: "plantado", desenlace: "gana", ganancia: 5 });
  assert.ok(ganador.clave.endsWith("Desenlace.Gana"), "con desenlace, manda el desenlace");
  assert.equal(ganador.datos.ganancia, 5);
});

test("un asiento sin cartas se distingue de uno que espera su turno", () => {
  // Quien no llegó a la apuesta se queda FUERA de la mano pero sigue sentado, y
  // eso tiene que verse distinto de estar esperando.
  assert.ok(estadoDeJugador({ total: null }).clave.endsWith("SinCartas"));
  assert.ok(estadoDeJugador({ total: 12 }).clave.endsWith("Espera"));
  assert.ok(estadoDeJugador({ total: 12, esTurno: true }).clave.endsWith("Decide"));
});

test("explica por qué no puedes doblar, que es la pregunta que nadie podía responder", () => {
  // Del QA: mirando la mesa no se sabía si doblar estaba apagado porque la mesa
  // no lo permite o porque no te llegan las fichas.
  const yaPidio = porQueNoPuedesDoblar(
    enCurso({ esTuTurno: true, jugadores: [{ eresTu: true, cartas: [1, 2, 3], fichas: 100 }] }),
    MESA,
  );
  assert.ok(yaPidio.clave.endsWith("YaPediste"));

  const sinFichas = porQueNoPuedesDoblar(
    enCurso({ esTuTurno: true, jugadores: [{ eresTu: true, cartas: [1, 2], fichas: 6 }] }),
    MESA,
  );
  assert.ok(sinFichas.clave.endsWith("SinFichas"));
  assert.equal(sinFichas.datos.necesarias, 10);
  assert.equal(sinFichas.datos.tienes, 6);
});

test("no explica una ausencia cuando doblar SÍ está concedido", () => {
  // La lectura no concede nada y tampoco contradice al motor: si el coordinador
  // dio la acción, aquí no se inventa un motivo para no usarla.
  const puede = enCurso({
    esTuTurno: true,
    acciones: [{ tipo: "act:doblar", etiqueta: "x", esDeJuego: true }],
    jugadores: [{ eresTu: true, cartas: [1, 2], fichas: 4 }],
  });
  assert.equal(porQueNoPuedesDoblar(puede, MESA), null);
});

test("no se explica nada cuando no es tu turno", () => {
  // Explicar una ausencia que nadie ha notado es ruido: sin turno, el botón de
  // doblar no está apagado, es que no viene al caso.
  assert.equal(porQueNoPuedesDoblar(enCurso({ jugadores: [{ eresTu: true, cartas: [1, 2], fichas: 4 }] }), MESA), null);
});

test("la lectura no adelanta un desenlace que el motor no ha resuelto", () => {
  // Con 20 en la mano y la banca destapando es tentador anticipar; el motor no
  // lo ha dicho, así que la lectura tampoco.
  const lectura = lecturaBlackjack(
    enCurso({ jugadores: [{ userId: "u1", eresTu: true, total: 20, motivo: "plantado", desenlace: null }] }),
    MESA,
  );
  assert.ok(lectura.jugadores[0].estado.clave.endsWith("Motivo.Plantado"));
  assert.ok(!JSON.stringify(lectura).includes("Desenlace"));
});
