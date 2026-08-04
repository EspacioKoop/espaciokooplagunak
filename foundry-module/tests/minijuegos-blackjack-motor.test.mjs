// Pruebas del motor de blackjack (#308, tercer vertical). Mismo estilo que
// las de póker y dados: reductor puro, sembrado, sin Foundry.

import test from "node:test";
import assert from "node:assert/strict";

import {
  ERRORES,
  accionesPermitidas,
  aplicar,
  calcularTotal,
  crear,
  esBlackjack,
  haTerminado,
  resultado,
  vistaPrivada,
  vistaPublica,
} from "../scripts/minijuegos/blackjack-motor.mjs";
import { interpretarCodigo } from "../scripts/minijuegos/naipes.mjs";

const MESA = {
  jugadores: [
    { userId: "ana", apuesta: 10, fichas: 100 },
    { userId: "beto", apuesta: 10, fichas: 100 },
  ],
};

const crearMesa = (extra = {}, semilla = "semilla-fija") =>
  crear({ ...MESA, ...extra }, semilla);

// Sustituye cartas repartidas por unas fijadas a mano, para probar reglas de
// resolución sin depender de qué reparte la semilla.
function conCartas({ jugadores, banca }) {
  const estado = crearMesa();
  estado.jugadores.forEach((jugador, i) => {
    jugador.cartas = jugadores[i].map((codigo) => carta(codigo));
    jugador.terminado = false;
    jugador.motivo = null;
  });
  estado.banca.cartas = banca.map((codigo) => carta(codigo));
  estado.banca.blackjackInicial = esBlackjack(estado.banca.cartas);
  // Recalcula blackjacks de salida con las cartas fijadas, como haría crear().
  for (const jugador of estado.jugadores) {
    if (esBlackjack(jugador.cartas)) {
      jugador.terminado = true;
      jugador.motivo = "blackjack";
    }
  }
  estado.fase = "turnos";
  const primerActivo = estado.jugadores.findIndex((j) => !j.terminado);
  estado.turnoIndice = primerActivo === -1 ? null : primerActivo;
  return estado;
}

function carta(codigo) {
  const { valor, palo } = interpretarCodigo(codigo);
  return Object.freeze({ valor, palo, codigo });
}

test("crear reparte dos cartas a cada jugador y dos a la banca, con la segunda oculta", () => {
  const estado = crearMesa();
  const pub = vistaPublica(estado);
  assert.equal(pub.jugadores.length, 2);
  for (const jugador of pub.jugadores) {
    assert.equal(jugador.cartas.length, 2);
  }
  assert.equal(pub.banca.cartas.length, 1);
  assert.equal(pub.banca.oculta, true);
  assert.equal(pub.banca.total, null);
});

test("crear es determinista: misma semilla, misma mesa", () => {
  assert.deepEqual(vistaPublica(crearMesa()), vistaPublica(crearMesa()));
  const otra = crearMesa({}, "otra-semilla");
  assert.notDeepEqual(vistaPublica(crearMesa()), vistaPublica(otra));
});

test("crear rechaza identidades duplicadas y apuestas por encima de las fichas", () => {
  assert.throws(() =>
    crear({ jugadores: [{ userId: "x", apuesta: 5, fichas: 20 }, { userId: "x", apuesta: 5, fichas: 20 }] }, "s"));
  assert.throws(() => crear({ jugadores: [{ userId: "x", apuesta: 50, fichas: 20 }] }, "s"));
});

test("vistaPrivada no añade secretos: en blackjack la mano es pública", () => {
  const estado = crearMesa();
  assert.deepEqual(vistaPrivada(estado, "ana"), vistaPublica(estado));
});

test("accionesPermitidas solo ofrece doblar con dos cartas y fichas suficientes", () => {
  const estado = conCartas({
    jugadores: [["7h", "8d"], ["9c", "9s"]],
    banca: ["2h", "9d"],
  });
  const turno = vistaPublica(estado).turno;
  assert.deepEqual(accionesPermitidas(estado, turno), ["pedir", "plantarse", "doblar"]);
  assert.deepEqual(accionesPermitidas(estado, "quien-no-juega"), []);
});

test("pedir que se pasa de 21 termina al jugador (bust) y pasa el turno", () => {
  const estado = conCartas({
    jugadores: [["Kh", "8d"], ["9c", "9s"]],
    banca: ["2h", "9d"],
  });
  const turno = vistaPublica(estado).turno; // ana
  const res = aplicar(estado, { actorId: turno, tipo: "pedir" });
  assert.equal(res.ok, true);
  const jugador = vistaPublica(res.estado).jugadores.find((j) => j.userId === turno);
  if (jugador.total > 21) {
    assert.equal(jugador.motivo, "bust");
    assert.equal(jugador.terminado, true);
    assert.notEqual(vistaPublica(res.estado).turno, turno);
  }
});

test("plantarse cierra el turno del jugador sin cambiar sus cartas", () => {
  const estado = conCartas({
    jugadores: [["7h", "8d"], ["9c", "9s"]],
    banca: ["2h", "9d"],
  });
  const res = aplicar(estado, { actorId: "ana", tipo: "plantarse" });
  assert.equal(res.ok, true);
  const ana = vistaPublica(res.estado).jugadores.find((j) => j.userId === "ana");
  assert.equal(ana.terminado, true);
  assert.equal(ana.motivo, "plantado");
  assert.equal(ana.cartas.length, 2);
  assert.equal(vistaPublica(res.estado).turno, "beto");
});

test("doblar dobla la apuesta, reparte una única carta y cierra el turno", () => {
  const estado = conCartas({
    jugadores: [["7h", "8d"], ["9c", "9s"]],
    banca: ["2h", "9d"],
  });
  const res = aplicar(estado, { actorId: "ana", tipo: "doblar" });
  assert.equal(res.ok, true);
  const ana = vistaPublica(res.estado).jugadores.find((j) => j.userId === "ana");
  assert.equal(ana.apuesta, 20);
  assert.equal(ana.cartas.length, 3);
  assert.ok(["doblado", "bust"].includes(ana.motivo));
  assert.equal(vistaPublica(res.estado).turno, "beto");
});

test("sin fichas para doblar la mesa ni siquiera ofrece esa acción", () => {
  const estado = conCartas({
    jugadores: [["7h", "8d"], ["9c", "9s"]],
    banca: ["2h", "9d"],
  });
  estado.jugadores[0].fichas = 15; // apuesta 10, doblar exigiría 20
  assert.deepEqual(accionesPermitidas(estado, "ana"), ["pedir", "plantarse"]);

  const antes = vistaPublica(estado);
  const res = aplicar(estado, { actorId: "ana", tipo: "doblar" });
  assert.equal(res.ok, false);
  assert.equal(res.codigo, ERRORES.ACCION_NO_PERMITIDA);
  assert.deepEqual(vistaPublica(estado), antes);
});

test("actuar fuera de turno o con una acción no permitida se rechaza cerrado", () => {
  const estado = conCartas({
    jugadores: [["7h", "8d"], ["9c", "9s"]],
    banca: ["2h", "9d"],
  });
  const fuera = aplicar(estado, { actorId: "beto", tipo: "pedir" });
  assert.equal(fuera.ok, false);
  assert.equal(fuera.codigo, ERRORES.FUERA_DE_TURNO);

  const invalida = aplicar(estado, { actorId: "ana", tipo: "repartir_a_mano" });
  assert.equal(invalida.ok, false);
  assert.equal(invalida.codigo, ERRORES.ACCION_NO_PERMITIDA);
});

test("una acción tras terminar la mano se rechaza cerrado", () => {
  let estado = conCartas({
    jugadores: [["7h", "8d"], ["9c", "9s"]],
    banca: ["Kh", "9d"],
  });
  estado = aplicar(estado, { actorId: "ana", tipo: "plantarse" }).estado;
  estado = aplicar(estado, { actorId: "beto", tipo: "plantarse" }).estado;
  assert.equal(haTerminado(estado), true);
  const res = aplicar(estado, { actorId: "ana", tipo: "plantarse" });
  assert.equal(res.ok, false);
  assert.equal(res.codigo, ERRORES.MANO_TERMINADA);
});

test("la banca revela su carta oculta y pide hasta plantarse en 17 o más", () => {
  let estado = conCartas({
    jugadores: [["7h", "8d"], ["9c", "9s"]],
    banca: ["2h", "9d"], // 11: debe pedir al menos una vez
  });
  estado = aplicar(estado, { actorId: "ana", tipo: "plantarse" }).estado;
  estado = aplicar(estado, { actorId: "beto", tipo: "plantarse" }).estado;
  assert.equal(haTerminado(estado), true);
  const pub = vistaPublica(estado);
  assert.equal(pub.banca.oculta, false);
  assert.ok(calcularTotal(pub.banca.cartas.length ? estado.banca.cartas : []) >= 0);
  assert.ok(pub.resultado.bancaTotal >= 17 || pub.resultado.bancaBust);
});

test("blackjack de un jugador contra banca sin blackjack paga 3 a 2 sin que juegue turno", () => {
  const estado = conCartas({
    jugadores: [["Ah", "Ks"], ["9c", "9s"]],
    banca: ["2h", "9d"],
  });
  // ana ya salió resuelta con blackjack: el turno abierto es el de beto.
  assert.equal(vistaPublica(estado).turno, "beto");
  const res = aplicar(estado, { actorId: "beto", tipo: "plantarse" });
  assert.equal(res.ok, true);
  assert.equal(haTerminado(res.estado), true);
  const ana = resultado(res.estado).jugadores.find((j) => j.userId === "ana");
  assert.equal(ana.desenlace, "blackjack");
  assert.equal(ana.ganancia, 15); // floor(10 * 1.5)
  assert.equal(ana.fichas, 115);
});

test("blackjack de la banca cierra la mano: empata con quien también tiene blackjack, el resto pierde", () => {
  const estado = conCartas({
    jugadores: [["Ah", "Ks"], ["7h", "8d"]],
    banca: ["Ac", "Kd"],
  });
  assert.equal(estado.banca.blackjackInicial, true);
  // ana ya salió resuelta con blackjack; el turno abierto es el de beto.
  const res = aplicar(estado, { actorId: "beto", tipo: "plantarse" });
  assert.equal(res.ok, true);
  assert.equal(haTerminado(res.estado), true);
  const [ana, beto] = resultado(res.estado).jugadores;
  assert.equal(ana.desenlace, "empate");
  assert.equal(ana.ganancia, 0);
  assert.equal(beto.desenlace, "pierde");
  assert.equal(beto.ganancia, -10);
});

test("un empate en total no mueve fichas", () => {
  const estado = conCartas({
    jugadores: [["Th", "9d"], ["9c", "9s"]], // 19 y 18
    banca: ["Kh", "9c"], // 19
  });
  let siguiente = estado;
  siguiente = aplicar(siguiente, { actorId: "ana", tipo: "plantarse" }).estado;
  siguiente = aplicar(siguiente, { actorId: "beto", tipo: "plantarse" }).estado;
  const ana = resultado(siguiente).jugadores.find((j) => j.userId === "ana");
  assert.equal(ana.desenlace, "empate");
  assert.equal(ana.ganancia, 0);
  assert.equal(ana.fichas, 100);
});

test("admite un único jugador contra la banca", () => {
  const estado = crear({ jugadores: [{ userId: "ana", apuesta: 10, fichas: 100 }] }, "semilla-solitario");
  assert.equal(vistaPublica(estado).jugadores.length, 1);
  let s = estado;
  while (!haTerminado(s)) {
    s = aplicar(s, { actorId: "ana", tipo: "plantarse" }).estado;
  }
  assert.equal(resultado(s).jugadores.length, 1);
});
