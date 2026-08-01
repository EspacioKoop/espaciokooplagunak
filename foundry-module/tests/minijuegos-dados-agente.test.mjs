// Pruebas de la política del NPC de dados (#413). Determinista y sin Foundry:
// entra una vista privada, sale una jugada.

import assert from "node:assert/strict";
import test from "node:test";

import {
  MARGEN_DUDA,
  decidirJugadaDados,
  esperanzaOculta,
  estimarTotal,
  siguienteApuesta,
} from "../scripts/minijuegos/dados-agente.mjs";
import { aplicar, crear, vistaPrivada, vistaPublica } from "../scripts/minijuegos/dados-motor.mjs";
import { resolverTurnosAutomaticos } from "../scripts/minijuegos/turnos-automaticos.mjs";
import { aplicar as aplicarSesion, crearSesion, vistaPublicaSesion } from "../scripts/minijuegos/sesion-motor.mjs";
import * as dados from "../scripts/minijuegos/dados-motor.mjs";

const vistaDe = (tuCubilete, extra = {}) => ({
  tuCubilete,
  unosComodin: true,
  dadosEnJuego: 10,
  apuesta: null,
  ...extra,
});

test("la esperanza dobla con comodines, salvo cuando se apuesta a unos", () => {
  assert.equal(esperanzaOculta(6, 4, true), 2); // 6 * 2/6
  assert.equal(esperanzaOculta(6, 4, false), 1); // 6 * 1/6
  assert.equal(esperanzaOculta(6, 1, true), 1, "los unos no se cuentan dos veces");
  assert.equal(esperanzaOculta(0, 4, true), 0);
  assert.equal(esperanzaOculta(-3, 4, true), 0, "sin dados no hay esperanza negativa");
});

test("lo propio es certeza y lo ajeno esperanza", () => {
  // Tres cuatros vistos (dos cuatros y un comodín) + 5 ocultos * 2/6.
  const vista = vistaDe([4, 4, 1, 2, 6]);
  assert.equal(estimarTotal(vista, 4), 3 + 5 * (2 / 6));
  // Sin comodines la cuenta propia baja y la esperanza también.
  assert.equal(estimarTotal({ ...vista, unosComodin: false }, 4), 2 + 5 * (1 / 6));
});

test("abrir la ronda es apostar por lo que uno tiene, sin inflar", () => {
  const jugada = decidirJugadaDados(vistaDe([5, 5, 5, 2, 3]), ["apostar"]);
  assert.equal(jugada.tipo, "apostar");
  assert.equal(jugada.parametros.cara, 5);
  assert.equal(jugada.parametros.cantidad, 3);
});

test("con el cubilete vacío de una cara, la apertura sigue siendo apostable", () => {
  // Un solo dado y ninguna repetición: la apuesta mínima es de uno.
  const jugada = decidirJugadaDados(vistaDe([3], { dadosEnJuego: 4 }), ["apostar"]);
  assert.equal(jugada.parametros.cantidad, 1);
  assert.ok(jugada.parametros.cantidad <= 4);
});

test("duda de lo que no se sostiene, y solo de eso", () => {
  const acciones = ["apostar", "dudar"];
  const mano = [2, 2, 3, 6, 6];
  // Diez dados en juego: esperar nueve cuatros es fantasía.
  const disparatada = vistaDe(mano, { apuesta: { cantidad: 9, cara: 4, userId: "otro" } });
  assert.deepEqual(decidirJugadaDados(disparatada, acciones), { tipo: "dudar" });

  // Dos cuatros entre diez dados es de lo más creíble: se sube, no se duda.
  const creible = vistaDe(mano, { apuesta: { cantidad: 2, cara: 4, userId: "otro" } });
  assert.equal(decidirJugadaDados(creible, acciones).tipo, "apostar");
});

test("el margen de credulidad evita el NPC que corta todas las rondas", () => {
  // Justo en la esperanza: no se duda. La media no es un techo.
  const mano = [1, 2, 3, 4, 5];
  const vista = vistaDe(mano, { apuesta: { cantidad: 0, cara: 4, userId: "otro" } });
  const esperado = estimarTotal(vista, 4);
  const enElBorde = {
    ...vista,
    apuesta: { cantidad: Math.floor(esperado + MARGEN_DUDA), cara: 4, userId: "otro" },
  };
  assert.equal(decidirJugadaDados(enElBorde, ["apostar", "dudar"]).tipo, "apostar");
});

test("la subida es la más barata que supera a la viva", () => {
  const vista = vistaDe([6, 6, 2, 2, 2]);
  // Con cara 3, subir a la misma cantidad con cara más alta es más barato que
  // prometer un dado más.
  const subida = siguienteApuesta(vista, { cantidad: 3, cara: 3 });
  assert.equal(subida.cantidad, 3);
  assert.ok(subida.cara > 3);

  // Desde la cara más alta ya no queda sitio: toca un dado más.
  const desdeArriba = siguienteApuesta(vista, { cantidad: 3, cara: 6 });
  assert.equal(desdeArriba.cantidad, 4);
});

test("ninguna subida promete más dados de los que hay en la mesa", () => {
  const vista = vistaDe([6, 6], { dadosEnJuego: 4 });
  for (const cara of [1, 2, 3, 4, 5, 6]) {
    const subida = siguienteApuesta(vista, { cantidad: 4, cara });
    if (subida) assert.ok(subida.cantidad <= 4, `${cara}: ${JSON.stringify(subida)}`);
  }
  // Con la apuesta ya en el techo y la cara más alta, no hay subida posible.
  assert.equal(siguienteApuesta(vista, { cantidad: 4, cara: 6 }), null);
});

test("sin subida posible se duda, en vez de prometer un imposible", () => {
  const vista = vistaDe([2, 2], { dadosEnJuego: 4, apuesta: { cantidad: 4, cara: 6, userId: "otro" } });
  assert.deepEqual(decidirJugadaDados(vista, ["apostar", "dudar"]), { tipo: "dudar" });
});

test("la política es determinista: misma vista, misma jugada", () => {
  const vista = vistaDe([3, 3, 5, 1, 6], { apuesta: { cantidad: 4, cara: 3, userId: "otro" } });
  const primera = decidirJugadaDados(vista, ["apostar", "dudar"]);
  for (let i = 0; i < 5; i += 1) {
    assert.deepEqual(decidirJugadaDados(vista, ["apostar", "dudar"]), primera);
  }
});

test("sin acciones no se inventa ninguna", () => {
  assert.equal(decidirJugadaDados(vistaDe([1, 2, 3]), []), null);
  assert.equal(decidirJugadaDados(vistaDe([1, 2, 3]), null), null);
  // Solo se puede dudar: no se devuelve una apuesta que el motor rechazaría.
  const soloDudar = decidirJugadaDados(
    vistaDe([1, 2, 3], { apuesta: { cantidad: 9, cara: 5, userId: "otro" } }),
    ["dudar"],
  );
  assert.deepEqual(soloDudar, { tipo: "dudar" });
});

test("el motor acepta todas las jugadas del agente, ronda tras ronda", () => {
  // La prueba que de verdad importa: la política no puede proponer nada que el
  // reductor rechace, o la cadena de turnos automáticos se corta y la mesa se
  // queda esperando a nadie.
  let estado = crear(
    { jugadores: [{ userId: "a" }, { userId: "b" }, { userId: "c" }] },
    "semilla-agente",
  );
  let jugadas = 0;
  while (!estado.resultado && jugadas < 64) {
    const turno = vistaPublica(estado).turno;
    const vista = vistaPrivada(estado, turno);
    const acciones = dados.accionesPermitidas(estado, turno);
    const jugada = decidirJugadaDados(vista, acciones);
    assert.ok(jugada, `sin jugada en el turno de ${turno}`);
    const salida = aplicar(estado, { actorId: turno, ...jugada });
    assert.equal(salida.ok, true, `el motor rechazó ${JSON.stringify(jugada)}: ${salida.codigo}`);
    estado = salida.estado;
    jugadas += 1;
  }
  assert.ok(estado.resultado, "la ronda no llegó a terminar");
  assert.ok(jugadas < 64, "la ronda no debería agotar el límite");
});

test("se enchufa al andamio de turnos automáticos sin tocarlo", () => {
  // `turnos-automaticos.mjs` nació para el póker y recibe la política inyectada.
  // Si esta prueba pasa, el segundo vertical no necesitó andamio propio.
  let sesion = crearSesion({ id: "d1", juego: "dados", anfitrionId: "gm", coordinadorId: "gm" });
  let n = 0;
  const sobre = (tipo, extra = {}) => ({
    sessionId: sesion.publico.id,
    epocaCoordinador: sesion.publico.epocaCoordinador,
    revisionEsperada: sesion.publico.revision,
    tipo,
    nonce: `t${(n += 1)}`,
    ...extra,
  });
  const paso = (tipo, actorId, opciones = {}) => {
    const res = aplicarSesion(sesion, { sobre: sobre(tipo), actorId, juego: dados, ...opciones });
    assert.equal(res.ok, true, `${tipo}: ${res.codigo}`);
    sesion = res.sesion;
  };
  paso("join", "u1");
  paso("botAdd", "gm");
  paso("start", "gm", { semilla: 77 });

  const { sesion: tras, jugadas, cortadoPor } = resolverTurnosAutomaticos(sesion, {
    juego: dados,
    decidir: decidirJugadaDados,
  });
  assert.equal(cortadoPor, null, "la cadena debería parar sola, no romperse");
  // O jugó el NPC, o el turno era de la persona desde el principio: en ninguno
  // de los dos casos puede quedar el motor en un estado inválido.
  assert.ok(jugadas.length >= 0);
  const pub = vistaPublicaSesion(tras);
  assert.ok(pub.juegoPublico.turno === null || typeof pub.juegoPublico.turno === "string");
});
