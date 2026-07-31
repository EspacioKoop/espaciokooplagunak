// Pruebas del motor de dados de cubilete (#413). Mismo estilo que las del motor
// de póker: reductor puro, sembrado, sin Foundry.

import test from "node:test";
import assert from "node:assert/strict";

import {
  CARAS,
  DADOS_POR_JUGADOR,
  ERRORES,
  accionesPermitidas,
  aplicar,
  contarCara,
  crear,
  haTerminado,
  resultado,
  superaApuesta,
  vistaPrivada,
  vistaPublica,
} from "../scripts/minijuegos/dados-motor.mjs";

const MESA = {
  jugadores: [
    { userId: "ana" },
    { userId: "beto" },
    { userId: "auto:1", controlador: "automatico" },
  ],
};

const crearMesa = (extra = {}) => crear({ ...MESA, ...extra }, "semilla-fija");

// Estado con cubiletes forzados, para probar el recuento sin depender de la
// tirada: las reglas del destape no deben estar atadas a una semilla concreta.
function conCubiletes(cubiletes, extra = {}) {
  const estado = crear(
    {
      jugadores: Object.keys(cubiletes).map((userId) => ({
        userId,
        dados: cubiletes[userId].length,
      })),
      ...extra,
    },
    "semilla-fija",
  );
  estado.cubiletes = structuredClone(cubiletes);
  return estado;
}

test("crear reparte a cada asiento sus dados y abre la ronda sin apuesta", () => {
  const estado = crearMesa();
  assert.equal(estado.fase, "apuestas");
  assert.equal(estado.apuesta, null);
  assert.equal(estado.destape, null);
  for (const jugador of estado.jugadores) {
    assert.equal(jugador.dados, DADOS_POR_JUGADOR);
    assert.equal(estado.cubiletes[jugador.userId].length, DADOS_POR_JUGADOR);
    assert.ok(estado.cubiletes[jugador.userId].every((d) => CARAS.includes(d)));
  }
});

test("crear es determinista: misma semilla, mismos cubiletes", () => {
  assert.deepEqual(crearMesa().cubiletes, crearMesa().cubiletes);
  const otra = crear(MESA, "otra-semilla");
  assert.notDeepEqual(crearMesa().cubiletes, otra.cubiletes);
});

test("crear respeta los dados que trae cada asiento y salta a los eliminados", () => {
  const estado = crear(
    {
      jugadores: [{ userId: "ana", dados: 0 }, { userId: "beto", dados: 2 }, { userId: "cris", dados: 5 }],
      turnoInicialIndice: 0,
    },
    "s",
  );
  assert.equal(estado.jugadores[0].eliminado, true);
  assert.deepEqual(estado.cubiletes.ana, []);
  // El turno inicial apuntaba a quien no tiene dados: abre el siguiente vivo.
  assert.equal(vistaPublica(estado).turno, "beto");
});

test("crear rechaza configuraciones que romperían la vista privada o el turno", () => {
  assert.throws(() => crear({ jugadores: [{ userId: "ana" }] }, "s"), RangeError);
  assert.throws(
    () => crear({ jugadores: [{ userId: "ana" }, { userId: "ana" }] }, "s"),
    /identidad duplicada/,
  );
  assert.throws(
    () => crear({ jugadores: [{ userId: "ana" }, { userId: "" }] }, "s"),
    /identificador no vacío/,
  );
  assert.throws(
    () => crear({ ...MESA, turnoInicialIndice: 9 }, "s"),
    /turnoInicialIndice/,
  );
  assert.throws(
    () => crear({ jugadores: [{ userId: "ana", dados: 7 }, { userId: "beto" }] }, "s"),
    /dados/,
  );
  // Una ronda con un solo jugador con dados no tiene contra quién apostar.
  assert.throws(
    () => crear({ jugadores: [{ userId: "ana", dados: 0 }, { userId: "beto", dados: 3 }] }, "s"),
    /al menos dos jugadores con dados/,
  );
});

test("la vista pública no revela ningún cubilete y la privada solo el propio", () => {
  const estado = crearMesa();
  const publica = vistaPublica(estado);
  assert.equal(publica.destape, null);
  assert.equal(JSON.stringify(publica).includes("cubilete"), false);
  assert.equal(publica.dadosEnJuego, DADOS_POR_JUGADOR * 3);

  const deAna = vistaPrivada(estado, "ana");
  assert.deepEqual(deAna.tuCubilete, estado.cubiletes.ana);
  assert.equal(vistaPrivada(estado, "beto").tuCubilete.length, DADOS_POR_JUGADOR);
  // Quien no juega —un espectador— no tiene cubilete que ver.
  assert.equal(vistaPrivada(estado, "mirona").tuCubilete, null);
});

test("solo el jugador de turno tiene acciones, y al abrir no se puede dudar", () => {
  const estado = crearMesa();
  const turno = vistaPublica(estado).turno;
  assert.deepEqual(accionesPermitidas(estado, turno), ["apostar"]);
  assert.deepEqual(accionesPermitidas(estado, "mirona"), []);

  const { estado: tras } = aplicar(estado, {
    actorId: turno,
    tipo: "apostar",
    parametros: { cantidad: 2, cara: 3 },
  });
  const siguiente = vistaPublica(tras).turno;
  assert.notEqual(siguiente, turno);
  assert.deepEqual(accionesPermitidas(tras, siguiente), ["apostar", "dudar"]);
});

test("aplicar rechaza cerrado fuera de turno y con acciones no permitidas", () => {
  const estado = crearMesa();
  const turno = vistaPublica(estado).turno;
  const otro = estado.jugadores.find((j) => j.userId !== turno).userId;

  assert.deepEqual(
    aplicar(estado, { actorId: otro, tipo: "apostar", parametros: { cantidad: 1, cara: 2 } }),
    { ok: false, codigo: ERRORES.FUERA_DE_TURNO },
  );
  assert.deepEqual(
    aplicar(estado, { actorId: turno, tipo: "dudar" }),
    { ok: false, codigo: ERRORES.ACCION_NO_PERMITIDA },
  );
  assert.deepEqual(
    aplicar(estado, { actorId: turno, tipo: "bailar" }),
    { ok: false, codigo: ERRORES.ACCION_NO_PERMITIDA },
  );
});

test("una apuesta inválida no altera el estado", () => {
  const estado = crearMesa();
  const turno = vistaPublica(estado).turno;
  const antes = structuredClone(estado);
  const malas = [
    { cantidad: 0, cara: 3 },
    { cantidad: 1.5, cara: 3 },
    { cantidad: 2, cara: 7 },
    { cantidad: 2, cara: "tres" },
    // Más dados de los que hay sobre la mesa: no es un farol, es imposible.
    { cantidad: 16, cara: 3 },
    undefined,
  ];
  for (const parametros of malas) {
    const salida = aplicar(estado, { actorId: turno, tipo: "apostar", parametros });
    assert.equal(salida.ok, false, JSON.stringify(parametros));
    assert.equal(salida.codigo, ERRORES.PARAMETRO_INVALIDO);
  }
  assert.deepEqual(estado, antes);
});

test("superaApuesta: más dados, o los mismos de una cara más alta", () => {
  assert.equal(superaApuesta({ cantidad: 1, cara: 2 }, null), true);
  assert.equal(superaApuesta({ cantidad: 3, cara: 2 }, { cantidad: 2, cara: 6 }), true);
  assert.equal(superaApuesta({ cantidad: 2, cara: 5 }, { cantidad: 2, cara: 4 }), true);
  assert.equal(superaApuesta({ cantidad: 2, cara: 4 }, { cantidad: 2, cara: 4 }), false);
  assert.equal(superaApuesta({ cantidad: 2, cara: 3 }, { cantidad: 2, cara: 4 }), false);
  assert.equal(superaApuesta({ cantidad: 1, cara: 6 }, { cantidad: 2, cara: 2 }), false);
});

test("una apuesta que no supera la viva se rechaza y deja el turno donde estaba", () => {
  const estado = crearMesa();
  const primero = vistaPublica(estado).turno;
  const { estado: tras } = aplicar(estado, {
    actorId: primero,
    tipo: "apostar",
    parametros: { cantidad: 3, cara: 4 },
  });
  const segundo = vistaPublica(tras).turno;
  const salida = aplicar(tras, {
    actorId: segundo,
    tipo: "apostar",
    parametros: { cantidad: 3, cara: 2 },
  });
  assert.deepEqual(salida, { ok: false, codigo: ERRORES.APUESTA_NO_SUPERA });
  assert.equal(vistaPublica(tras).turno, segundo);
});

test("contarCara: los unos son comodines salvo cuando se apuesta a unos", () => {
  const cubiletes = { ana: [1, 1, 4], beto: [4, 5, 6] };
  assert.equal(contarCara(cubiletes, 4, true), 4);
  assert.equal(contarCara(cubiletes, 4, false), 2);
  // Apostando a unos no se suman dos veces: son solo los unos que hay.
  assert.equal(contarCara(cubiletes, 1, true), 2);
  assert.equal(contarCara(cubiletes, 6, true), 3);
});

test("dudar de una apuesta cumplida hace perder un dado a quien duda", () => {
  const estado = conCubiletes({ ana: [4, 4, 5], beto: [4, 2, 2] });
  estado.apuesta = { cantidad: 3, cara: 4, userId: "ana" };
  estado.turnoIndice = 1;

  const { ok, estado: tras } = aplicar(estado, { actorId: "beto", tipo: "dudar" });
  assert.equal(ok, true);
  assert.equal(haTerminado(tras), true);
  assert.equal(tras.destape.reales, 3);
  assert.equal(tras.destape.apuestaSostenida, true);
  assert.equal(resultado(tras).perdedorId, "beto");
  assert.equal(tras.jugadores[1].dados, 2);
  assert.equal(tras.jugadores[0].dados, 3);
});

test("dudar de un farol hace perder un dado a quien apostó", () => {
  const estado = conCubiletes({ ana: [4, 5, 5], beto: [2, 2, 3] });
  estado.apuesta = { cantidad: 4, cara: 4, userId: "ana" };
  estado.turnoIndice = 1;

  const { estado: tras } = aplicar(estado, { actorId: "beto", tipo: "dudar" });
  assert.equal(tras.destape.apuestaSostenida, false);
  assert.equal(resultado(tras).perdedorId, "ana");
  assert.equal(tras.jugadores[0].dados, 2);
  assert.equal(tras.jugadores[1].dados, 3);
});

test("el destape publica todos los cubiletes y el resultado, comprobable por la mesa", () => {
  const estado = conCubiletes({ ana: [1, 4, 5], beto: [4, 2, 2] });
  estado.apuesta = { cantidad: 3, cara: 4, userId: "ana" };
  estado.turnoIndice = 1;

  const { estado: tras } = aplicar(estado, { actorId: "beto", tipo: "dudar" });
  const publica = vistaPublica(tras);
  // Con el uno de comodín hay 3 cuatros: la apuesta se sostiene.
  assert.equal(publica.destape.reales, 3);
  assert.deepEqual(publica.destape.cubiletes, { ana: [1, 4, 5], beto: [4, 2, 2] });
  assert.equal(publica.destape.dudadorId, "beto");
  assert.equal(publica.turno, null);
  assert.deepEqual(resultado(tras).dados, { ana: 3, beto: 2 });
  assert.deepEqual(resultado(tras).vivos, ["ana", "beto"]);
});

test("quien pierde su último dado queda eliminado y fuera de los vivos", () => {
  const estado = conCubiletes({ ana: [3], beto: [2, 2] });
  estado.apuesta = { cantidad: 2, cara: 3, userId: "ana" };
  estado.turnoIndice = 1;

  // No hay dos treses: el farol de Ana cae y se queda sin dados.
  const { estado: tras } = aplicar(estado, { actorId: "beto", tipo: "dudar" });
  assert.equal(tras.jugadores[0].dados, 0);
  assert.equal(tras.jugadores[0].eliminado, true);
  assert.deepEqual(resultado(tras).vivos, ["beto"]);
});

test("con la ronda terminada no se admite ninguna acción más", () => {
  const estado = conCubiletes({ ana: [4, 4, 5], beto: [4, 2, 2] });
  estado.apuesta = { cantidad: 3, cara: 4, userId: "ana" };
  estado.turnoIndice = 1;
  const { estado: tras } = aplicar(estado, { actorId: "beto", tipo: "dudar" });

  assert.deepEqual(accionesPermitidas(tras, "ana"), []);
  assert.deepEqual(
    aplicar(tras, { actorId: "ana", tipo: "apostar", parametros: { cantidad: 9, cara: 6 } }),
    { ok: false, codigo: ERRORES.RONDA_TERMINADA },
  );
});

test("el turno da la vuelta a la mesa saltando a los eliminados", () => {
  const estado = crear(
    {
      jugadores: [{ userId: "ana" }, { userId: "beto", dados: 0 }, { userId: "cris" }],
      turnoInicialIndice: 0,
    },
    "s",
  );
  const { estado: tras } = aplicar(estado, {
    actorId: "ana",
    tipo: "apostar",
    parametros: { cantidad: 2, cara: 2 },
  });
  assert.equal(vistaPublica(tras).turno, "cris");
  const { estado: vuelta } = aplicar(tras, {
    actorId: "cris",
    tipo: "apostar",
    parametros: { cantidad: 3, cara: 2 },
  });
  assert.equal(vistaPublica(vuelta).turno, "ana");
});

test("sin comodines, los unos no cuentan para otra cara", () => {
  const estado = conCubiletes({ ana: [1, 1, 4], beto: [2, 2, 3] }, { unosComodin: false });
  estado.apuesta = { cantidad: 3, cara: 4, userId: "ana" };
  estado.turnoIndice = 1;
  const { estado: tras } = aplicar(estado, { actorId: "beto", tipo: "dudar" });
  assert.equal(tras.destape.reales, 1);
  assert.equal(resultado(tras).perdedorId, "ana");
});

test("aplicar no muta el estado que recibe", () => {
  const estado = crearMesa();
  const turno = vistaPublica(estado).turno;
  const antes = structuredClone(estado);
  const { estado: tras } = aplicar(estado, {
    actorId: turno,
    tipo: "apostar",
    parametros: { cantidad: 2, cara: 6 },
  });
  assert.deepEqual(estado, antes);
  assert.notDeepEqual(tras.apuesta, null);
});
