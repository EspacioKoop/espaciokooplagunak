import assert from "node:assert/strict";
import test from "node:test";

import { mesaVista, accionesVisibles } from "../scripts/minijuegos/mesa-vista.mjs";
import * as poker from "../scripts/minijuegos/poker-motor.mjs";
import { configuracionPoker } from "../scripts/minijuegos/mesa-config.mjs";
import {
  accionesPermitidas,
  aplicar,
  crearSesion,
  vistaPrivadaSesion,
  vistaPublicaSesion,
} from "../scripts/minijuegos/sesion-motor.mjs";

// Las pruebas usan el motor de verdad, no vistas inventadas a mano: lo que se
// quiere fijar es que la mesa pinta lo que el motor produce, y una vista
// falsificada no detectaría un cambio de forma en el motor.
function mesaConDosJugadores() {
  let sesion = crearSesion({ id: "s1", juego: "poker", anfitrionId: "gm", coordinadorId: "gm" });
  let n = 0;
  const proponer = (actorId, tipo, parametros = {}) => {
    n += 1;
    const res = aplicar(sesion, {
      sobre: {
        sessionId: "s1",
        revision: sesion.publico.revision,
        epocaCoordinador: sesion.publico.epocaCoordinador,
        nonce: `n${n}`,
        tipo,
        parametros,
      },
      actorId,
      juego: poker,
      semilla: 1234,
      configuracionJuego: configuracionPoker(sesion.publico),
    });
    if (res.ok) sesion = res.sesion;
    return res;
  };
  return { get sesion() { return sesion; }, proponer };
}

test("sin mesa no se inventa una mesa", () => {
  for (const nada of [null, undefined, "", 0, "mesa"]) {
    const vista = mesaVista(nada, { userId: "p1" });
    assert.equal(vista.hayMesa, false);
    assert.deepEqual(vista.jugadores, []);
    assert.deepEqual(vista.acciones, []);
  }
});

test("en el lobby hay mesa pero todavía no hay mano", () => {
  const mesa = mesaConDosJugadores();
  mesa.proponer("p1", "join");
  mesa.proponer("p2", "join");

  const vista = mesaVista(vistaPublicaSesion(mesa.sesion), { userId: "p1" });
  assert.equal(vista.hayMesa, true);
  assert.equal(vista.fase, "lobby");
  assert.equal(vista.manoEnCurso, false);
  assert.equal(vista.eresJugador, true);
  assert.equal(vista.jugadores.length, 2);
  // Antes del reparto no hay stack ni bote: null, no cero. Cero sería decir
  // «sin fichas», que es una información distinta y falsa.
  assert.equal(vista.bote, null);
  assert.equal(vista.jugadores[0].stack, null);
});

test("quien no tiene la vista privada ve dorsos, nunca cartas ajenas", () => {
  const mesa = mesaConDosJugadores();
  mesa.proponer("p1", "join");
  mesa.proponer("p2", "join");
  mesa.proponer("gm", "start");

  // p1 recibe SU vista privada.
  const suya = mesaVista(vistaPrivadaSesion(mesa.sesion, "p1", poker), { userId: "p1" });
  assert.equal(suya.tuMano.length, 2, "un jugador sentado ve su mano");
  assert.deepEqual(suya.dorsosPropios, []);
  for (const c of suya.tuMano) assert.match(c.imagen, /^data:image\/svg\+xml,/);

  // Un espectador recibe solo la pública: dorsos, y ni rastro de las cartas.
  const publica = vistaPublicaSesion(mesa.sesion);
  const mirando = mesaVista(publica, { userId: "curioso" });
  assert.equal(mirando.tuMano, null);
  assert.equal(mirando.dorsosPropios.length, 2);
  // Y la prueba que de verdad importa: la vista pública no contiene las manos.
  assert.equal(JSON.stringify(publica).includes("tuMano"), false);
});

test("la vista pública que se difunde no lleva secretos", () => {
  const mesa = mesaConDosJugadores();
  mesa.proponer("p1", "join");
  mesa.proponer("p2", "join");
  mesa.proponer("gm", "start");

  const serializada = JSON.stringify(vistaPublicaSesion(mesa.sesion));
  assert.equal(serializada.includes("mazo"), false, "el mazo no puede viajar");
  assert.equal(serializada.includes("semilla"), false, "la semilla no puede viajar");
  assert.equal(serializada.includes("manos"), false);
});

test("el turno se dice, no se adivina", () => {
  const mesa = mesaConDosJugadores();
  mesa.proponer("p1", "join");
  mesa.proponer("p2", "join");
  mesa.proponer("gm", "start");

  const publica = vistaPublicaSesion(mesa.sesion);
  const turno = publica.juegoPublico.turno;
  assert.ok(turno, "el motor publica de quién es el turno");

  const delQueLeToca = mesaVista(publica, { userId: turno });
  assert.equal(delQueLeToca.esTuTurno, true);
  assert.equal(delQueLeToca.jugadores.find((j) => j.userId === turno).esTurno, true);

  const otro = mesaVista(publica, { userId: "curioso" });
  assert.equal(otro.esTuTurno, false);
  // Sin identidad no le toca a nadie: un cliente sin userId no puede acabar
  // creyendo que la mesa le espera.
  assert.equal(mesaVista(publica, {}).esTuTurno, false);
});

test("las acciones que se pintan son las que el motor permite, con su etiqueta", () => {
  const mesa = mesaConDosJugadores();
  mesa.proponer("p1", "join");
  mesa.proponer("p2", "join");
  mesa.proponer("gm", "start");

  const publica = vistaPublicaSesion(mesa.sesion);
  const turno = publica.juegoPublico.turno;
  const permitidas = accionesPermitidas(mesa.sesion, turno, poker);
  const vista = mesaVista(publica, { userId: turno, acciones: permitidas });

  const tipos = vista.acciones.map((a) => a.tipo);
  assert.ok(tipos.includes("act:fold"), `esperaba poder retirarse, hay ${tipos.join(",")}`);
  for (const accion of vista.acciones) {
    assert.match(accion.etiqueta, /^LAGUNAK\./, "toda acción va con clave de traducción");
  }
  // Subir es la única que pide importe: el resto son de un clic.
  const subir = vista.acciones.find((a) => a.tipo === "act:raise");
  if (subir) assert.equal(subir.requiereImporte, true);
  for (const a of vista.acciones.filter((x) => x.tipo !== "act:raise")) {
    assert.equal(a.requiereImporte, false);
  }
});

test("una acción que la mesa no sabe nombrar no se pinta", () => {
  // Fallar cerrado: un botón sin etiqueta sería un botón que nadie entiende, y
  // el motor lo rechazaría igual. Mejor no ofrecerlo.
  const pintadas = accionesVisibles(["join", "act:inventada", "", null, 7, "act:fold"]);
  assert.deepEqual(pintadas.map((a) => a.tipo), ["join", "act:fold"]);
});

test("las acciones del juego se distinguen de las del marco", () => {
  const pintadas = accionesVisibles(["join", "start", "act:call"]);
  assert.deepEqual(pintadas.map((a) => a.esDeJuego), [false, false, true]);
});

test("quien se retira sigue en la mesa, marcado", () => {
  const mesa = mesaConDosJugadores();
  mesa.proponer("p1", "join");
  mesa.proponer("p2", "join");
  mesa.proponer("gm", "start");
  const turno = vistaPublicaSesion(mesa.sesion).juegoPublico.turno;
  mesa.proponer(turno, "act", { tipo: "fold" });

  const vista = mesaVista(vistaPublicaSesion(mesa.sesion), { userId: turno });
  const jugador = vista.jugadores.find((j) => j.userId === turno);
  assert.equal(jugador.retirado, true, "retirarse se ve; el asiento no desaparece");
});

test("el disco se pinta en el asiento que lleva el botón", () => {
  // Se marca por identidad: los asientos de la MANO son solo los que juegan,
  // así que comparar posiciones con los de la MESA pondría el disco en el
  // asiento equivocado en cuanto alguien se quede sin fichas.
  const vista = {
    jugadores: [{ userId: "p1" }, { userId: "p2" }, { userId: "p3" }],
    juegoPublico: {
      botonIndice: 1,
      jugadores: [
        { userId: "p1", stack: 100 },
        { userId: "p3", stack: 100 },
      ],
    },
  };
  const modelo = mesaVista(vista, { userId: "p1" });
  assert.deepEqual(
    modelo.jugadores.map((j) => j.esBoton),
    [false, false, true],
    "el disco es de p3, no del asiento 1 de la mesa",
  );
});

test("antes del reparto no hay disco que enseñar", () => {
  const modelo = mesaVista({ jugadores: [{ userId: "p1" }, { userId: "p2" }] }, { userId: "p1" });
  assert.equal(modelo.jugadores.some((j) => j.esBoton), false);
});
