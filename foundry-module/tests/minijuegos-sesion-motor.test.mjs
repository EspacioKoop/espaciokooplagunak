import assert from "node:assert/strict";
import test from "node:test";

import {
  crearSesion,
  aplicar,
  vistaPublicaSesion,
  vistaPrivadaSesion,
  accionesPermitidas,
  sustituirCoordinador,
  reconectar,
  marcarAusente,
  ERRORES,
} from "../scripts/minijuegos/sesion-motor.mjs";

// Juego falso con la interfaz interna del contrato (#308). No es póker: sirve
// justo para comprobar que la sesión aloja CUALQUIER vertical por su interfaz.
// Cada jugador tiene un secreto derivado de la semilla; la mano termina cuando
// todos han jugado.
const juegoFalso = {
  crear(configuracion, semilla) {
    if (configuracion.fallar) throw new RangeError("configuración inválida");
    return {
      semilla,
      jugadores: configuracion.jugadores.map((j) => j.userId),
      secretos: Object.fromEntries(configuracion.jugadores.map((j, i) => [j.userId, semilla + i])),
      jugadas: {},
    };
  },
  vistaPublica(estado) {
    return { jugadores: estado.jugadores, jugadas: { ...estado.jugadas } };
  },
  vistaPrivada(estado, userId) {
    return { secreto: estado.secretos[userId] ?? null };
  },
  accionesPermitidas(estado, userId) {
    return estado.jugadas[userId] == null ? ["jugar"] : [];
  },
  aplicar(estado, { actorId, tipo, parametros }) {
    if (tipo !== "jugar") return { ok: false, codigo: "accion_no_permitida" };
    if (estado.jugadas[actorId] != null) return { ok: false, codigo: "ya_jugo" };
    return {
      ok: true,
      estado: { ...estado, jugadas: { ...estado.jugadas, [actorId]: parametros?.valor ?? 0 } },
    };
  },
  haTerminado(estado) {
    return estado.jugadores.every((u) => estado.jugadas[u] != null);
  },
  resultado(estado) {
    return this.haTerminado(estado) ? { jugadas: { ...estado.jugadas } } : null;
  },
};

function sesionNueva(limites = {}) {
  return crearSesion({
    id: "mesa-1",
    juego: "falso",
    anfitrionId: "gm",
    coordinadorId: "gm",
    limites,
  });
}

let contadorNonce = 0;
function sobre(tipo, sesion, extra = {}) {
  contadorNonce += 1;
  return {
    sessionId: sesion.publico.id,
    epocaCoordinador: sesion.publico.epocaCoordinador,
    revisionEsperada: sesion.publico.revision,
    tipo,
    nonce: `n${contadorNonce}`,
    ...extra,
  };
}

// Aplica y exige éxito, devolviendo la sesión nueva.
function ok(sesion, tipo, actorId, extra = {}, opciones = {}) {
  const res = aplicar(sesion, { sobre: sobre(tipo, sesion, extra), actorId, juego: juegoFalso, ...opciones });
  assert.equal(res.ok, true, `esperaba ok en ${tipo}: ${res.codigo}`);
  return res.sesion;
}

// Mesa con dos jugadores sentados y una mano en curso.
function mesaEnCurso(semilla = 10) {
  let s = sesionNueva();
  s = ok(s, "join", "u1");
  s = ok(s, "join", "u2");
  return ok(s, "start", "gm", {}, { semilla });
}

test("crearSesion parte en lobby, sin secretos y sin revisión", () => {
  const pub = vistaPublicaSesion(sesionNueva());
  assert.equal(pub.fase, "lobby");
  assert.equal(pub.revision, 0);
  assert.equal(pub.epocaCoordinador, 0);
  assert.deepEqual(pub.jugadores, []);
  assert.equal(pub.juegoPublico, null);
  assert.equal("privado" in pub, false);
});

test("join sienta al actor autenticado y watch añade espectador", () => {
  let s = ok(sesionNueva(), "join", "u1");
  s = ok(s, "watch", "u2");
  const pub = vistaPublicaSesion(s);
  assert.deepEqual(pub.jugadores, [{ userId: "u1", asiento: 0, estado: "activo" }]);
  assert.deepEqual(pub.espectadores, ["u2"]);
  assert.equal(pub.revision, 2); // una revisión por acción aceptada
});

test("la identidad del sobre nunca sustituye a la autenticada", () => {
  // El sobre miente descaradamente: declara ser u9. El motor sienta a u1.
  const s = ok(sesionNueva(), "join", "u1", { userId: "u9", actorId: "u9" });
  assert.deepEqual(
    vistaPublicaSesion(s).jugadores.map((j) => j.userId),
    ["u1"],
  );
});

test("sin identidad autenticada no se aplica nada", () => {
  const s = sesionNueva();
  for (const actorId of [undefined, null, "", 7]) {
    const res = aplicar(s, { sobre: sobre("join", s), actorId, juego: juegoFalso });
    assert.equal(res.ok, false);
    assert.equal(res.codigo, ERRORES.SIN_IDENTIDAD);
  }
});

test("un rechazo no toca estado, revisión ni nonces", () => {
  const s = ok(sesionNueva(), "join", "u1");
  const antes = JSON.stringify(vistaPublicaSesion(s));
  const casos = [
    [sobre("join", s, { sessionId: "otra" }), "u2", ERRORES.SESION_DESCONOCIDA],
    [sobre("join", s, { epocaCoordinador: 5 }), "u2", ERRORES.EPOCA_OBSOLETA],
    [sobre("join", s, { revisionEsperada: 0 }), "u2", ERRORES.REVISION_OBSOLETA],
    [sobre("bailar", s), "u2", ERRORES.ACCION_DESCONOCIDA],
    [sobre("join", s, { nonce: "" }), "u2", ERRORES.PAYLOAD_INVALIDO],
    [sobre("join", s, { parametros: [1, 2] }), "u2", ERRORES.PAYLOAD_INVALIDO],
    [sobre("start", s), "u1", ERRORES.NO_AUTORIZADO], // u1 no es anfitrión ni coordinador
  ];
  for (const [envio, actorId, codigo] of casos) {
    const res = aplicar(s, { sobre: envio, actorId, juego: juegoFalso });
    assert.equal(res.ok, false, `esperaba rechazo con ${codigo}`);
    assert.equal(res.codigo, codigo);
  }
  assert.equal(JSON.stringify(vistaPublicaSesion(s)), antes);
  assert.equal(s.privado.nonces.length, 1);
});

test("repetir el mismo nonce del mismo actor es idempotente", () => {
  let s = sesionNueva();
  const envio = sobre("join", s);
  const primera = aplicar(s, { sobre: envio, actorId: "u1", juego: juegoFalso });
  assert.equal(primera.ok, true);
  s = primera.sesion;
  // Reenvío exacto tras una desconexión: ni duplica asiento ni sube revisión.
  const repetida = aplicar(s, { sobre: envio, actorId: "u1", juego: juegoFalso });
  assert.equal(repetida.ok, true);
  assert.equal(repetida.idempotente, true);
  assert.equal(vistaPublicaSesion(repetida.sesion).revision, 1);
  assert.equal(vistaPublicaSesion(repetida.sesion).jugadores.length, 1);
  // El mismo nonce de OTRO actor sí es una acción nueva.
  const otro = aplicar(s, { sobre: { ...envio, revisionEsperada: 1 }, actorId: "u2", juego: juegoFalso });
  assert.equal(otro.ok, true);
  assert.equal(otro.idempotente, undefined);
});

test("los nonces se acotan y nunca salen al estado público", () => {
  let s = sesionNueva({ maxNonces: 3 });
  for (let i = 0; i < 5; i += 1) {
    s = ok(s, "watch", `e${i}`);
  }
  assert.equal(s.privado.nonces.length, 3);
  assert.equal(JSON.stringify(vistaPublicaSesion(s)).includes("nonce"), false);
});

test("start reparte secretos que no salen al estado público", () => {
  const s = mesaEnCurso(10);
  const pub = vistaPublicaSesion(s);
  assert.equal(pub.fase, "en_curso");
  assert.equal(pub.manoEnCurso, true);
  assert.equal(JSON.stringify(pub).includes("secreto"), false);
  // Cada jugador ve solo lo suyo; el espectador y el ajeno, solo lo público.
  assert.equal(vistaPrivadaSesion(s, "u1", juegoFalso).juegoPrivado.secreto, 10);
  assert.equal(vistaPrivadaSesion(s, "u2", juegoFalso).juegoPrivado.secreto, 11);
  assert.equal("juegoPrivado" in vistaPrivadaSesion(s, "mirón", juegoFalso), false);
});

test("start exige anfitrión/coordinador, mínimo de jugadores y semilla", () => {
  let s = sesionNueva();
  s = ok(s, "join", "u1");
  assert.equal(
    aplicar(s, { sobre: sobre("start", s), actorId: "gm", juego: juegoFalso, semilla: 1 }).codigo,
    ERRORES.FASE_INVALIDA, // un solo jugador
  );
  s = ok(s, "join", "u2");
  assert.equal(
    aplicar(s, { sobre: sobre("start", s), actorId: "u1", juego: juegoFalso, semilla: 1 }).codigo,
    ERRORES.NO_AUTORIZADO,
  );
  assert.equal(
    aplicar(s, { sobre: sobre("start", s), actorId: "gm", juego: juegoFalso }).codigo,
    ERRORES.SIN_SEMILLA,
  );
});

test("act delega en el juego con la identidad autenticada", () => {
  let s = mesaEnCurso();
  // El sobre pide jugar declarando ser u2; el motor aplica la jugada de u1.
  s = ok(s, "act", "u1", { parametros: { tipo: "jugar", parametros: { valor: 3 } }, actorId: "u2" });
  assert.deepEqual(vistaPublicaSesion(s).juegoPublico.jugadas, { u1: 3 });
});

test("act rechaza a quien no está sentado y propaga el código del juego", () => {
  const s = mesaEnCurso();
  const ajeno = aplicar(s, {
    sobre: sobre("act", s, { parametros: { tipo: "jugar" } }),
    actorId: "mirón",
    juego: juegoFalso,
  });
  assert.equal(ajeno.codigo, ERRORES.NO_AUTORIZADO);
  const invalida = aplicar(s, {
    sobre: sobre("act", s, { parametros: { tipo: "saltar" } }),
    actorId: "u1",
    juego: juegoFalso,
  });
  assert.equal(invalida.codigo, "accion_no_permitida"); // código cerrado del juego
});

test("al terminar la mano se publica resultado y se olvidan los secretos", () => {
  let s = mesaEnCurso();
  s = ok(s, "act", "u1", { parametros: { tipo: "jugar", parametros: { valor: 1 } } });
  s = ok(s, "act", "u2", { parametros: { tipo: "jugar", parametros: { valor: 2 } } });
  const pub = vistaPublicaSesion(s);
  assert.equal(pub.manoEnCurso, false);
  assert.deepEqual(pub.resultado.jugadas, { u1: 1, u2: 2 });
  assert.equal(s.privado.estadoJuego, null);
  assert.equal(s.privado.semilla, null);
  // La mano siguiente es decisión explícita del anfitrión.
  assert.equal(accionesPermitidas(s, "gm", juegoFalso).includes("start"), true);
});

test("abandonar en lobby libera asiento; en partida solo marca ausente", () => {
  let s = sesionNueva();
  s = ok(s, "join", "u1");
  s = ok(s, "join", "u2");
  s = ok(s, "leave", "u1");
  assert.deepEqual(
    vistaPublicaSesion(s).jugadores,
    [{ userId: "u2", asiento: 0, estado: "activo" }], // asientos recompactados
  );
  let enCurso = mesaEnCurso();
  enCurso = ok(enCurso, "leave", "u1");
  const jugador = vistaPublicaSesion(enCurso).jugadores.find((j) => j.userId === "u1");
  assert.equal(jugador.estado, "ausente"); // el asiento NO se libera
  assert.equal(vistaPublicaSesion(enCurso).jugadores.length, 2);
});

test("reconectar devuelve asiento y vista al mismo userId, no a otro", () => {
  const ausente = marcarAusente(mesaEnCurso(), "u1");
  assert.equal(vistaPublicaSesion(ausente).jugadores[0].estado, "ausente");
  const vuelta = reconectar(ausente, "u1");
  assert.equal(vistaPublicaSesion(vuelta).jugadores[0].estado, "activo");
  assert.equal(vistaPrivadaSesion(vuelta, "u1", juegoFalso).juegoPrivado.secreto, 10);
  // Un usuario ajeno no puede reclamar el asiento ausente.
  const intruso = reconectar(ausente, "otro");
  assert.equal(vistaPublicaSesion(intruso).jugadores[0].estado, "ausente");
  assert.equal("juegoPrivado" in vistaPrivadaSesion(ausente, "otro", juegoFalso), false);
});

test("perder el coordinador cancela la mano sin resultado y sube de época", () => {
  let s = mesaEnCurso();
  s = ok(s, "act", "u1", { parametros: { tipo: "jugar", parametros: { valor: 1 } } });
  const nueva = sustituirCoordinador(s, { coordinadorId: "gm2" });
  const pub = vistaPublicaSesion(nueva);
  assert.equal(pub.coordinadorId, "gm2");
  assert.equal(pub.epocaCoordinador, 1);
  assert.equal(pub.manoEnCurso, false);
  assert.equal(pub.manoCancelada, true);
  assert.equal(pub.resultado, null); // se cancela SIN resultado
  assert.equal(pub.juegoPublico, null); // no se reconstruye desde datos públicos
  assert.equal(nueva.privado.estadoJuego, null);
  assert.equal(nueva.privado.semilla, null);
});

test("las acciones de la época cancelada se descartan", () => {
  const s = mesaEnCurso();
  const pendiente = sobre("act", s, { parametros: { tipo: "jugar" } }); // época 0
  const nueva = sustituirCoordinador(s, { coordinadorId: "gm2" });
  const res = aplicar(nueva, { sobre: pendiente, actorId: "u1", juego: juegoFalso });
  assert.equal(res.ok, false);
  assert.equal(res.codigo, ERRORES.EPOCA_OBSOLETA);
});

test("la mano nueva tras el relevo usa semilla nueva y secretos nuevos", () => {
  const s = mesaEnCurso(10);
  const nueva = sustituirCoordinador(s, { coordinadorId: "gm2", juego: juegoFalso, semilla: 99 });
  assert.equal(vistaPublicaSesion(nueva).manoEnCurso, true);
  assert.equal(vistaPrivadaSesion(nueva, "u1", juegoFalso).juegoPrivado.secreto, 99);
  assert.notEqual(nueva.privado.semilla, s.privado.semilla);
});

test("finish y close solo fuera de una mano y solo para anfitrión o GM", () => {
  let s = mesaEnCurso();
  assert.equal(
    aplicar(s, { sobre: sobre("finish", s), actorId: "gm", juego: juegoFalso }).codigo,
    ERRORES.FASE_INVALIDA, // hay mano en curso
  );
  s = ok(s, "act", "u1", { parametros: { tipo: "jugar", parametros: { valor: 1 } } });
  s = ok(s, "act", "u2", { parametros: { tipo: "jugar", parametros: { valor: 2 } } });
  assert.equal(
    aplicar(s, { sobre: sobre("close", s), actorId: "u1", juego: juegoFalso }).codigo,
    ERRORES.NO_AUTORIZADO,
  );
  const cerrada = ok(s, "close", "gm");
  assert.equal(vistaPublicaSesion(cerrada).fase, "terminada");
  assert.equal(cerrada.privado.estadoJuego, null); // sin secretos residuales
  assert.equal(cerrada.privado.semilla, null);
  // Una sesión terminada no acepta más acciones.
  assert.equal(
    aplicar(cerrada, { sobre: sobre("join", cerrada), actorId: "u3", juego: juegoFalso }).codigo,
    ERRORES.FASE_INVALIDA,
  );
});

test("se respetan los aforos de mesa y de espectadores", () => {
  let s = sesionNueva({ maxJugadores: 2, maxEspectadores: 1 });
  s = ok(s, "join", "u1");
  s = ok(s, "join", "u2");
  assert.equal(
    aplicar(s, { sobre: sobre("join", s), actorId: "u3", juego: juegoFalso }).codigo,
    ERRORES.MESA_LLENA,
  );
  s = ok(s, "watch", "e1");
  assert.equal(
    aplicar(s, { sobre: sobre("watch", s), actorId: "e2", juego: juegoFalso }).codigo,
    ERRORES.AFORO_COMPLETO,
  );
  assert.equal(
    aplicar(s, { sobre: sobre("watch", s), actorId: "u1", juego: juegoFalso }).codigo,
    ERRORES.YA_EN_MESA,
  );
});

test("accionesPermitidas describe el estado sin filtrar secretos", () => {
  const s = mesaEnCurso();
  assert.deepEqual(accionesPermitidas(s, "u1", juegoFalso).sort(), ["act:jugar", "leave"].sort());
  assert.deepEqual(accionesPermitidas(s, "mirón", juegoFalso), ["watch"]);
  const lobby = ok(sesionNueva(), "join", "u1");
  assert.equal(accionesPermitidas(lobby, "u2", juegoFalso).includes("join"), true);
  assert.equal(accionesPermitidas(lobby, "gm", juegoFalso).includes("start"), false); // falta gente
});

test("si el juego rechaza la configuración, la sesión no queda a medias", () => {
  let s = sesionNueva();
  s = ok(s, "join", "u1");
  s = ok(s, "join", "u2");
  const res = aplicar(s, {
    sobre: sobre("start", s),
    actorId: "gm",
    juego: juegoFalso,
    semilla: 1,
    configuracionJuego: { fallar: true },
  });
  assert.equal(res.ok, false);
  assert.equal(res.codigo, ERRORES.JUEGO_RECHAZO);
  assert.equal(vistaPublicaSesion(s).fase, "lobby");
  assert.equal(s.privado.estadoJuego, null);
});
