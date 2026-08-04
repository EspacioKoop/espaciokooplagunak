// Pruebas del modelo de presentación de la mesa de blackjack (#308, tercer
// vertical), hermano de las de póker y dados.

import assert from "node:assert/strict";
import test from "node:test";

import { accionesVisibles, blackjackVista } from "../scripts/minijuegos/blackjack-vista.mjs";

const VISTA = Object.freeze({
  id: "mesa-bj",
  juego: "blackjack",
  fase: "en_curso",
  manoEnCurso: true,
  jugadores: [
    { userId: "u1", asiento: 0, estado: "activo" },
    { userId: "u2", asiento: 1, estado: "activo" },
  ],
  espectadores: ["mirona"],
  juegoPublico: {
    turno: "u1",
    banca: { cartas: ["2h"], oculta: true, total: null },
    jugadores: [
      { userId: "u1", fichas: 90, apuesta: 10, cartas: ["7h", "8d"], total: 15, terminado: false, motivo: null, desenlace: null, controlador: "humano" },
      { userId: "u2", fichas: 90, apuesta: 10, cartas: ["9c", "9s"], total: 18, terminado: true, motivo: "plantado", desenlace: null, controlador: "humano" },
    ],
  },
});

test("sin vista no hay mesa, y no se inventa ninguna", () => {
  for (const nada of [null, undefined, 7, "mesa"]) {
    const modelo = blackjackVista(nada, { userId: "u1" });
    assert.equal(modelo.hayMesa, false);
    assert.deepEqual(modelo.jugadores, []);
    assert.deepEqual(modelo.acciones, []);
  }
});

test("TRAMPAS NO: mientras la banca está tapada solo se ve su primera carta", () => {
  const modelo = blackjackVista(VISTA, { userId: "u1" });
  assert.equal(modelo.banca.oculta, true);
  assert.equal(modelo.banca.cartas.length, 2);
  assert.equal(modelo.banca.cartas[0].codigo, "2h");
  assert.equal(modelo.banca.cartas[1].codigo, null, "la segunda es un dorso, no un código");
  assert.equal(modelo.banca.total, null);
});

test("revelada, la banca enseña todas sus cartas y su total", () => {
  const revelada = {
    ...VISTA,
    manoEnCurso: false,
    juegoPublico: {
      ...VISTA.juegoPublico,
      turno: null,
      banca: { cartas: ["2h", "9d", "5c"], oculta: false, total: 16 },
    },
  };
  const modelo = blackjackVista(revelada, { userId: "u1" });
  assert.equal(modelo.banca.oculta, false);
  assert.deepEqual(modelo.banca.cartas.map((c) => c.codigo), ["2h", "9d", "5c"]);
  assert.equal(modelo.banca.total, 16);
});

test("la mano de cada jugador es pública: no hay dorso que pintar sobre ella", () => {
  const modelo = blackjackVista(VISTA, { userId: "u1" });
  const otro = modelo.jugadores.find((j) => j.userId === "u2");
  assert.deepEqual(otro.cartas.map((c) => c.codigo), ["9c", "9s"]);
  assert.equal(otro.total, 18);
  assert.equal(otro.motivo, "plantado");
});

test("un espectador ve la mesa igual que cualquiera: no hay secretos que filtrar", () => {
  const modelo = blackjackVista(VISTA, { userId: "mirona" });
  assert.equal(modelo.eresJugador, false);
  assert.equal(modelo.eresEspectador, true);
  assert.equal(modelo.jugadores.find((j) => j.userId === "u1").total, 15);
  assert.equal(modelo.banca.oculta, true);
});

test("el turno y la identidad salen de la vista, no se adivinan", () => {
  assert.equal(blackjackVista(VISTA, { userId: "u1" }).esTuTurno, true);
  assert.equal(blackjackVista(VISTA, { userId: "u2" }).esTuTurno, false);
  assert.equal(blackjackVista(VISTA, {}).esTuTurno, false);
});

test("fichas y apuesta viajan por jugador, con su montón de fichas", () => {
  const modelo = blackjackVista(VISTA, { userId: "u1" });
  const yo = modelo.jugadores.find((j) => j.userId === "u1");
  assert.equal(yo.fichas, 90);
  assert.equal(yo.apuesta, 10);
  assert.ok(Array.isArray(yo.pila));
  assert.ok(Array.isArray(yo.apuestaPila));
});

test("el desenlace y la ganancia salen del resultado de la sesión, sin inventarlos antes", () => {
  const sinResolver = blackjackVista(VISTA, { userId: "u1" });
  assert.equal(sinResolver.jugadores.find((j) => j.userId === "u1").ganancia, null);

  const terminada = {
    ...VISTA,
    manoEnCurso: false,
    resultado: {
      bancaTotal: 20,
      bancaBust: false,
      bancaCartas: ["2h", "9d", "9c"],
      jugadores: [
        { userId: "u1", desenlace: "pierde", ganancia: -10, fichas: 80, total: 15, apuesta: 10 },
        { userId: "u2", desenlace: "gana", ganancia: 10, fichas: 100, total: 18, apuesta: 10 },
      ],
    },
  };
  const modelo = blackjackVista(terminada, { userId: "u1" });
  assert.equal(modelo.jugadores.find((j) => j.userId === "u1").ganancia, -10);
  assert.equal(modelo.jugadores.find((j) => j.userId === "u2").ganancia, 10);
  assert.equal(modelo.resultado.bancaTotal, 20);
});

test("las acciones se etiquetan, y las que no se sepan nombrar no se pintan", () => {
  const acciones = accionesVisibles(["join", "act:pedir", "act:plantarse", "act:doblar", "act:bailar", 7]);
  assert.deepEqual(acciones.map((a) => a.tipo), ["join", "act:pedir", "act:plantarse", "act:doblar"]);
  assert.equal(acciones.find((a) => a.tipo === "act:doblar").esDeJuego, true);
  assert.equal(acciones.find((a) => a.tipo === "join").esDeJuego, false);
});

test("las acciones vienen de quien tiene la autoridad, con respaldo para el forastero", () => {
  const propias = blackjackVista(VISTA, { userId: "u1", acciones: ["act:pedir", "act:plantarse"] });
  assert.deepEqual(propias.acciones.map((a) => a.tipo), ["act:pedir", "act:plantarse"]);

  const forastera = { ...VISTA, accionesForastero: ["join", "watch"] };
  const fuera = blackjackVista(forastera, { userId: "nadie" });
  assert.deepEqual(fuera.acciones.map((a) => a.tipo), ["join", "watch"]);

  const sentado = blackjackVista(forastera, { userId: "u1" });
  assert.deepEqual(sentado.acciones, []);
});

// El catálogo ES/EN no se comprueba aquí: `localization.test.mjs` ya recorre
// todos los scripts y plantillas del módulo y exige que cada clave exista en
// los dos idiomas.
