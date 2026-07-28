import assert from "node:assert/strict";
import test from "node:test";

import {
  MESA_POR_DEFECTO,
  configuracionPoker,
  normalizarMesa,
} from "../scripts/minijuegos/mesa-config.mjs";
import * as poker from "../scripts/minijuegos/poker-motor.mjs";
import { aplicar, crearSesion, vistaPublicaSesion } from "../scripts/minijuegos/sesion-motor.mjs";

function sobre(sesion, tipo, parametros, nonce) {
  return {
    sessionId: sesion.publico.id,
    revision: sesion.publico.revision,
    epocaCoordinador: sesion.publico.epocaCoordinador,
    nonce,
    tipo,
    parametros,
  };
}

test("REGRESIÓN: repartir funciona — antes fallaba siempre con juego_rechazo", () => {
  // El fallo que motivó este módulo. `sesion-motor` derivaba los asientos como
  // `{ userId }` cuando la tabla no los fijaba, y `poker-motor.crear` exige un
  // `stack` entero positivo: nadie rellenaba las fichas, así que NINGUNA mano
  // podía empezar desde el cableado de Foundry. Ninguno de los dos motores
  // estaba mal por separado; faltaba quien decidiera la entrada de la mesa.
  let sesion = crearSesion({ id: "s", juego: "poker", anfitrionId: "gm", coordinadorId: "gm" });
  const paso = (actorId, tipo, parametros, nonce, configuracionJuego) => {
    const res = aplicar(sesion, {
      sobre: sobre(sesion, tipo, parametros, nonce),
      actorId,
      juego: poker,
      semilla: 99,
      configuracionJuego,
    });
    if (res.ok) sesion = res.sesion;
    return res;
  };

  paso("p1", "join", {}, "a");
  paso("p2", "join", {}, "b");

  // Sin configuración de mesa: exactamente el fallo original.
  const sinFichas = paso("gm", "start", {}, "c", undefined);
  assert.equal(sinFichas.ok, false);
  assert.equal(sinFichas.codigo, "juego_rechazo");

  // Con ella: la mano arranca.
  const conFichas = paso("gm", "start", {}, "d", configuracionPoker(sesion.publico));
  assert.equal(conFichas.ok, true, `start seguía fallando: ${conFichas.codigo}`);
  const publica = vistaPublicaSesion(sesion);
  assert.equal(publica.manoEnCurso, true);
  assert.ok(publica.juegoPublico.turno, "alguien tiene el turno");
  for (const jugador of publica.juegoPublico.jugadores) {
    assert.ok(jugador.stack >= 0, "cada asiento tiene fichas");
  }
});

test("cada asiento recibe las fichas de entrada, en el orden que publica la sesión", () => {
  // El asiento es posicional: reordenarlos movería el botón y las ciegas sin
  // que nadie lo hubiera pedido.
  const publico = { jugadores: [{ userId: "b" }, { userId: "a" }, { userId: "c" }] };
  const config = configuracionPoker(publico, { fichasIniciales: 250 });
  assert.deepEqual(config.jugadores.map((j) => j.userId), ["b", "a", "c"]);
  for (const jugador of config.jugadores) assert.equal(jugador.stack, 250);
});

test("el controlador viaja tal cual: un asiento automático sigue siéndolo", () => {
  const publico = { jugadores: [{ userId: "a", controlador: "automatico" }, { userId: "b" }] };
  const config = configuracionPoker(publico);
  assert.equal(config.jugadores[0].controlador, "automatico");
  assert.equal(config.jugadores[1].controlador, "humano");
  // Cualquier otro valor cae en humano: fallar cerrado, que un NPC inesperado
  // jugaría solo.
  assert.equal(configuracionPoker({ jugadores: [{ userId: "x", controlador: "raro" }] }).jugadores[0].controlador, "humano");
});

test("una errata en el ajuste acota, no deja la mesa inarrancable", () => {
  // Esto sale de un ajuste de mundo que una persona edita a mano. Si el motor
  // fallara, el síntoma («juego_rechazo») aparecería muy lejos de la causa.
  for (const basura of [{}, null, undefined, { fichasIniciales: -5 }, { fichasIniciales: "cien" }]) {
    const mesa = normalizarMesa(basura ?? {});
    assert.ok(mesa.fichasIniciales >= 1);
    assert.ok(mesa.ciegaPequena >= 1);
    assert.ok(mesa.ciegaGrande >= mesa.ciegaPequena);
  }
  assert.deepEqual(normalizarMesa({}), MESA_POR_DEFECTO);
});

test("la ciega grande nunca queda por debajo de la pequeña", () => {
  // El motor lo aceptaría sin rechistar y la mesa jugaría con las reglas al
  // revés durante toda la escena.
  const mesa = normalizarMesa({ ciegaPequena: 10, ciegaGrande: 2 });
  assert.equal(mesa.ciegaGrande, 10);
  assert.equal(normalizarMesa({ ciegaPequena: 5 }).ciegaGrande, 10, "por defecto, el doble");
});

test("sin mesa publicada no se inventan asientos", () => {
  assert.deepEqual(configuracionPoker(null).jugadores, []);
  assert.deepEqual(configuracionPoker({}).jugadores, []);
});
