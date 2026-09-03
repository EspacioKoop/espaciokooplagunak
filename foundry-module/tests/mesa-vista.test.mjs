import assert from "node:assert/strict";
import test from "node:test";

import { lineasResultado, mesaVista, accionesVisibles } from "../scripts/minijuegos/mesa-vista.mjs";
import { ANCHO, altoDePila } from "../scripts/minijuegos/fichas-pixelart.mjs";
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

// ---- Resultado legible ----------------------------------------------------

test("lineasResultado lee las DOS formas del resultado del póker", () => {
  // Sin rival: el motor publica ganador y ganancia sueltos.
  assert.deepEqual(
    lineasResultado({ tipo: "sin-rival", ganadorId: "p2", ganancia: 3 }),
    [{ userId: "p2", fichas: 3 }],
  );
  // Showdown: un diccionario de ganancias, que con botes laterales puede tener
  // más de una entrada.
  assert.deepEqual(
    lineasResultado({ tipo: "showdown", ganancias: { p1: 12, p2: 0, p3: 4 } }),
    [
      { userId: "p1", fichas: 12 },
      { userId: "p3", fichas: 4 },
    ],
    "quien no gana nada no sale como ganador",
  );
});

test("sin resultado reconocible no se anuncia ganador", () => {
  for (const entrada of [null, undefined, {}, "gana p1", { ganadorId: "p1" }, { ganancias: 3 }]) {
    assert.deepEqual(lineasResultado(entrada), []);
  }
});

// ---- Respaldo cuando el envío dirigido no llega ----------------------------

test("REGRESIÓN: sin envío dirigido, quien está fuera aún puede sentarse", () => {
  // Lo que se veía en mesa: el cliente que se perdía su reparto —llega por
  // socket, y quien todavía no escuchaba se lo pierde entero— pintaba la mesa
  // sin un solo botón. Desde fuera es indistinguible de una mesa que no te deja
  // entrar. El respaldo son las acciones de forastero que publica el
  // coordinador en la vista pública, que llega por el ajuste de mundo.
  const vista = {
    jugadores: [{ userId: "gm" }],
    espectadores: [],
    accionesForastero: ["join", "watch"],
  };
  const modelo = mesaVista(vista, { userId: "p1", acciones: [] });
  assert.deepEqual(
    modelo.acciones.map((a) => a.tipo),
    ["join", "watch"],
  );
});

test("el respaldo NO se le ofrece a quien ya está en la mesa", () => {
  // Las acciones de un participante dependen de su sitio en la mano, y esas sí
  // exigen el envío dirigido: ofrecerle las de forastero sería enseñarle
  // botones que el coordinador va a rechazar.
  const vista = {
    jugadores: [{ userId: "p1" }],
    espectadores: [],
    accionesForastero: ["join", "watch"],
  };
  assert.deepEqual(mesaVista(vista, { userId: "p1", acciones: [] }).acciones, []);
  // Ni a quien está mirando.
  const mirando = { jugadores: [], espectadores: ["p2"], accionesForastero: ["join", "watch"] };
  assert.deepEqual(mesaVista(mirando, { userId: "p2", acciones: [] }).acciones, []);
});

test("lo dirigido manda sobre el respaldo", () => {
  const vista = {
    jugadores: [{ userId: "gm" }],
    espectadores: [],
    accionesForastero: ["join", "watch"],
  };
  assert.deepEqual(
    mesaVista(vista, { userId: "p1", acciones: ["watch"] }).acciones.map((a) => a.tipo),
    ["watch"],
  );
});

/* ---- Elementos visuales: fichas, cartas ajenas y huecos ------------------- */

test("el bote y cada pila llevan su montón de fichas, y suma lo mismo que la cifra", () => {
  const mesa = mesaConDosJugadores();
  mesa.proponer("p1", "join");
  mesa.proponer("p2", "join");
  mesa.proponer("gm", "start");

  const vista = mesaVista(vistaPublicaSesion(mesa.sesion), { userId: "p1" });
  const suma = (pila) => pila.reduce((t, m) => t + m.valor * m.cuenta, 0);
  assert.ok(vista.botePila.length > 0, "con ciegas puestas hay bote que dibujar");
  assert.equal(suma(vista.botePila), vista.bote, "el montón del bote miente sobre el bote");
  for (const jugador of vista.jugadores) {
    assert.equal(suma(jugador.pila), jugador.stack, `la pila de ${jugador.userId} no cuadra`);
    assert.equal(suma(jugador.apuestaPila), jugador.apostadoRonda);
    for (const monton of jugador.pila) assert.match(monton.imagen, /^data:image\/svg\+xml,/);
  }
});

test("cada montón lleva el tamaño de su lienzo, para que la fila no dé saltos", () => {
  // El `<img>` escribe estos dos como atributos: sin ellos el navegador no sabe
  // qué hueco reservar hasta decodificar el `data:` URI, y el asiento pega un
  // salto cada vez que una apuesta cambia la altura del montón. Y `alto` tiene
  // que ser el del dibujo de verdad: si mintiera, la ficha saldría estirada.
  const mesa = mesaConDosJugadores();
  mesa.proponer("p1", "join");
  mesa.proponer("p2", "join");
  mesa.proponer("gm", "start");

  const vista = mesaVista(vistaPublicaSesion(mesa.sesion), { userId: "p1" });
  const montones = [...vista.botePila, ...vista.jugadores.flatMap((j) => j.pila)];
  assert.ok(montones.length > 0, "no hay montones que comprobar");
  for (const monton of montones) {
    assert.equal(monton.ancho, ANCHO);
    assert.equal(monton.alto, altoDePila(monton.cuenta));
    const svg = decodeURIComponent(monton.imagen.replace(/^data:image\/svg\+xml,/, ""));
    assert.match(svg, new RegExp(`viewBox="0 0 ${monton.ancho} ${monton.alto}"`));
  }
});

test("antes del reparto no hay fichas que dibujar", () => {
  // La mesa existe antes que la mano: un asiento sin stack no puede aparecer
  // con un montón inventado delante.
  const mesa = mesaConDosJugadores();
  mesa.proponer("p1", "join");

  const vista = mesaVista(vistaPublicaSesion(mesa.sesion), { userId: "p1" });
  assert.deepEqual(vista.botePila, []);
  assert.deepEqual(vista.jugadores[0].pila, []);
  assert.deepEqual(vista.jugadores[0].apuestaPila, []);
});

test("el asiento ajeno enseña dorsos, y solo mientras siga en la mano", () => {
  const mesa = mesaConDosJugadores();
  mesa.proponer("p1", "join");
  mesa.proponer("p2", "join");
  mesa.proponer("gm", "start");

  const vista = mesaVista(vistaPrivadaSesion(mesa.sesion, "p1", poker), { userId: "p1" });
  const yo = vista.jugadores.find((j) => j.userId === "p1");
  const otro = vista.jugadores.find((j) => j.userId === "p2");
  assert.deepEqual(yo.cartasOcultas, [], "la mano propia se ve entera abajo, no doblada aquí");
  assert.equal(otro.cartasOcultas.length, 2);
  for (const carta of otro.cartasOcultas) {
    assert.equal(carta.codigo, null, "un dorso no puede llevar código: sería filtrar la carta");
  }
});

test("quien se retira deja de tener cartas que enseñar", () => {
  const mesa = mesaConDosJugadores();
  mesa.proponer("p1", "join");
  mesa.proponer("p2", "join");
  mesa.proponer("gm", "start");
  const turno = vistaPublicaSesion(mesa.sesion).juegoPublico.turno;
  mesa.proponer(turno, "act", { tipo: "fold" });

  const vista = mesaVista(vistaPublicaSesion(mesa.sesion), { userId: "espectador" });
  const retirado = vista.jugadores.find((j) => j.userId === turno);
  assert.equal(retirado.retirado, true);
  assert.deepEqual(retirado.cartasOcultas, []);
});

test("los huecos completan las cinco comunitarias, y desaparecen según salen", () => {
  const mesa = mesaConDosJugadores();
  mesa.proponer("p1", "join");
  mesa.proponer("p2", "join");
  mesa.proponer("gm", "start");

  const vista = mesaVista(vistaPublicaSesion(mesa.sesion), { userId: "p1" });
  assert.equal(vista.comunitarias.length + vista.huecosComunitarios.length, 5);
  assert.equal(vista.huecosComunitarios.length, 5, "preflop no ha salido ninguna");
});

test("mostrar una carta (#458) es un gesto de la carta, no un botón de la lista", () => {
  const mesa = mesaConDosJugadores();
  mesa.proponer("p1", "join");
  mesa.proponer("p2", "join");
  mesa.proponer("gm", "start");

  const accionesP1 = accionesPermitidas(mesa.sesion, "p1", poker);
  assert.ok(accionesP1.includes("act:mostrar"));

  const suya = mesaVista(vistaPrivadaSesion(mesa.sesion, "p1", poker), {
    userId: "p1",
    acciones: accionesP1,
  });
  // No aparece en la lista de botones genéricos...
  assert.equal(suya.acciones.some((a) => a.tipo === "act:mostrar"), false);
  // ...pero cada carta de la mano propia lleva su índice y puede mostrarse.
  assert.deepEqual(suya.tuMano.map((c) => c.indice), [0, 1]);
  assert.ok(suya.tuMano.every((c) => c.puedeMostrar === true));

  // Tras mostrar la carta 0, esa carta deja de poder mostrarse otra vez.
  mesa.proponer("p1", "act", { tipo: "mostrar", parametros: { indice: 0 } });
  const accionesTrasMostrar = accionesPermitidas(mesa.sesion, "p1", poker);
  const trasMostrar = mesaVista(vistaPrivadaSesion(mesa.sesion, "p1", poker), {
    userId: "p1",
    acciones: accionesTrasMostrar,
  });
  assert.equal(trasMostrar.tuMano[0].puedeMostrar, false);
  assert.equal(trasMostrar.tuMano[1].puedeMostrar, true);

  // Y ya es visible para un espectador, boca arriba, como carta oculta ya no.
  const publica = vistaPublicaSesion(mesa.sesion);
  assert.deepEqual(publica.juegoPublico.cartasMostradas.p1, [suya.tuMano[0].codigo]);
});

test("una mesa que no es póker no se queda con huecos de póker de más", () => {
  // El modelo no puede inventar huecos donde ya hay cinco cartas ni números
  // negativos si algún día un juego reparte más.
  const conSeis = { juegoPublico: { comunitarias: ["As", "Kd", "Qc", "Jh", "Ts", "9d"] } };
  assert.deepEqual(mesaVista(conSeis, { userId: "p1" }).huecosComunitarios, []);
});
