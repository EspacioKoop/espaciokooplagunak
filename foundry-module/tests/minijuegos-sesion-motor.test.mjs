import assert from "node:assert/strict";
import test from "node:test";

import {
  PREFIJO_AUTOMATICO,
  crearSesion,
  aplicar,
  esAutomatico,
  vistaPublicaSesion,
  vistaPrivadaSesion,
  accionesPermitidas,
  sustituirCoordinador,
  reconectar,
  marcarAusente,
  sesionAgotada,
  ERRORES,
} from "../scripts/minijuegos/sesion-motor.mjs";

// Una mesa terminada no ofrece acciones: si además cuenta como mesa viva, deja
// a la sala en un callejón sin salida. Las dos mitades de esa regla van juntas.
test("sesionAgotada: terminada o inexistente cuentan igual; lobby y en_curso no", () => {
  assert.equal(sesionAgotada(null), true);
  assert.equal(sesionAgotada(undefined), true);
  assert.equal(sesionAgotada({ fase: "terminada" }), true);
  assert.equal(sesionAgotada({ fase: "lobby" }), false);
  assert.equal(sesionAgotada({ fase: "en_curso" }), false);
});

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

test("reutilizar un nonce para otra acción se rechaza, no se traga en silencio", () => {
  let s = sesionNueva();
  const observar = sobre("watch", s);
  const primera = aplicar(s, { sobre: observar, actorId: "u", juego: juegoFalso });
  assert.equal(primera.ok, true);
  s = primera.sesion;

  // Mismo actor, mismo nonce, PETICIÓN DISTINTA: si esto pasara por idempotente,
  // el `leave` se descartaría en silencio devolviendo éxito.
  const colado = aplicar(s, {
    sobre: { ...observar, tipo: "leave" },
    actorId: "u",
    juego: juegoFalso,
  });
  assert.equal(colado.ok, false);
  assert.equal(colado.codigo, ERRORES.NONCE_REUTILIZADO);
  assert.deepEqual(vistaPublicaSesion(s).espectadores, ["u"]);
  assert.equal(vistaPublicaSesion(s).revision, 1);
});

test("la huella del nonce ignora el orden de claves de los parámetros", () => {
  let s = mesaEnCurso();
  const jugar = sobre("act", s, { parametros: { tipo: "jugar", valor: 1, extra: "x" } });
  const primera = aplicar(s, { sobre: jugar, actorId: "u1", juego: juegoFalso });
  assert.equal(primera.ok, true);
  s = primera.sesion;

  // El mismo sobre reserializado con otro orden de claves sigue siendo el mismo
  // reenvío: idempotente, no un rechazo espurio.
  const reenvio = {
    ...jugar,
    parametros: { extra: "x", valor: 1, tipo: "jugar" },
  };
  const repetida = aplicar(s, { sobre: reenvio, actorId: "u1", juego: juegoFalso });
  assert.equal(repetida.ok, true);
  assert.equal(repetida.idempotente, true);

  // Cambiar un valor sí es otra petición.
  const distinta = aplicar(s, {
    sobre: { ...jugar, parametros: { tipo: "jugar", valor: 2, extra: "x" } },
    actorId: "u1",
    juego: juegoFalso,
  });
  assert.equal(distinta.ok, false);
  assert.equal(distinta.codigo, ERRORES.NONCE_REUTILIZADO);
});

test("una clave con significado especial no puede colisionar con el sobre vacío", () => {
  let s = sesionNueva();
  // `JSON.parse` y NO un literal a propósito: es como llegan los parámetros por
  // el socket, y es el único caso donde `__proto__` es una propiedad propia. Con
  // un literal, el motor lo trataría de otra forma y la prueba no probaría nada.
  const hostiles = JSON.parse('{"__proto__":{"contaminado":true}}');
  const envio = sobre("watch", s, { parametros: hostiles });
  const primera = aplicar(s, { sobre: envio, actorId: "u1", juego: juegoFalso });
  assert.equal(primera.ok, true);
  s = primera.sesion;

  // Antes, la huella de los parámetros hostiles y la de `{}` eran ambas iguales,
  // así que este segundo sobre —otra petición— se colaba como reenvío exacto.
  const colado = aplicar(s, {
    // Mismo nonce, misma revisión esperada, parámetros distintos.
    sobre: { ...envio, revisionEsperada: s.publico.revision, parametros: {} },
    actorId: "u1",
    juego: juegoFalso,
  });
  assert.equal(colado.idempotente, undefined, "dos sobres distintos no son el mismo reenvío");
  assert.equal(colado.ok, false);
  assert.equal(colado.codigo, ERRORES.NONCE_REUTILIZADO);

  // Y el prototipo sigue limpio: nadie ha contaminado Object.
  assert.equal({}.contaminado, undefined);
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

test("cancelar la mano no resucita a quien se desconectó durante ella", () => {
  let s = mesaEnCurso();
  s = marcarAusente(s, "u1");
  const nueva = sustituirCoordinador(s, { coordinadorId: "gm2" });
  const jugadores = vistaPublicaSesion(nueva).jugadores;
  assert.equal(jugadores.find((j) => j.userId === "u1").estado, "ausente");
  assert.equal(jugadores.find((j) => j.userId === "u2").estado, "activo");
  // Los asientos previos al reparto sí se recuperan.
  assert.deepEqual(
    jugadores.map((j) => [j.userId, j.asiento]),
    [
      ["u1", 0],
      ["u2", 1],
    ],
  );
});

test("el payload se acota: nada de anidamiento ni cadenas sin límite", () => {
  const s = mesaEnCurso();
  const rechazados = [
    { tipo: "jugar", parametros: { hondo: { mas: { aun: 1 } } } }, // demasiado anidado
    { tipo: "jugar", parametros: { valor: "x".repeat(65) } }, // cadena sobre maxCadena
    { tipo: "jugar", lista: [1, 2, 3] }, // arrays fuera
    { tipo: "jugar", raro: () => 1 }, // funciones fuera
  ];
  for (const parametros of rechazados) {
    const res = aplicar(s, { sobre: sobre("act", s, { parametros }), actorId: "u1", juego: juegoFalso });
    assert.equal(res.ok, false, `debería rechazar ${JSON.stringify(parametros)}`);
    assert.equal(res.codigo, ERRORES.PAYLOAD_INVALIDO);
  }
  // El anidamiento legítimo de `act` (tipo + parámetros del juego) sí pasa.
  const valida = ok(s, "act", "u1", { parametros: { tipo: "jugar", parametros: { valor: 7 } } });
  assert.deepEqual(vistaPublicaSesion(valida).juegoPublico.jugadas, { u1: 7 });
});

test("quien se ausenta en partida puede volver a SU asiento", () => {
  // `leave` en partida no libera el asiento a propósito: lo reserva y marca al
  // jugador ausente, para que su identidad no la reclame otro. Sin una acción
  // de vuelta esa reserva era una trampa —el asiento seguía siendo suyo y no
  // había forma de ocuparlo otra vez—, y quien se levantaba a media partida se
  // quedaba mirando con un botón que ya no hacía nada.
  let sesion = crearSesion({ id: "s", juego: "j", anfitrionId: "gm", coordinadorId: "gm" });
  let n = 0;
  const paso = (actorId, tipo) => {
    const res = aplicar(sesion, {
      sobre: {
        sessionId: "s",
        epocaCoordinador: sesion.publico.epocaCoordinador,
        nonce: `n${(n += 1)}`,
        tipo,
      },
      actorId,
      juego: juegoFalso,
      semilla: 7,
    });
    if (res.ok) sesion = res.sesion;
    return res;
  };
  paso("gm", "join");
  paso("p1", "join");
  assert.equal(paso("gm", "start").ok, true);

  assert.equal(paso("p1", "leave").ok, true);
  const ausente = sesion.publico.jugadores.find((j) => j.userId === "p1");
  assert.equal(ausente.estado, "ausente", "el asiento sigue siendo suyo");
  assert.ok(
    accionesPermitidas(sesion, "p1", juegoFalso).includes("return"),
    "y se le ofrece volver",
  );

  assert.equal(paso("p1", "return").ok, true);
  assert.equal(sesion.publico.jugadores.find((j) => j.userId === "p1").estado, "activo");
  // Volver dos veces no es volver: ya está en la mesa.
  assert.equal(paso("p1", "return").codigo, "ya_en_mesa");
  // Y quien no tiene asiento no puede «volver» a uno que no existe.
  assert.equal(paso("ajeno", "return").codigo, "no_participa");
});

test("solo al ausente se le ofrece volver", () => {
  let sesion = crearSesion({ id: "s2", juego: "j", anfitrionId: "gm", coordinadorId: "gm" });
  sesion = aplicar(sesion, {
    sobre: { sessionId: "s2", epocaCoordinador: 0, nonce: "a", tipo: "join" },
    actorId: "p1",
    juego: juegoFalso,
  }).sesion;
  assert.equal(accionesPermitidas(sesion, "p1", juegoFalso).includes("return"), false);
  assert.equal(accionesPermitidas(sesion, "ajeno", juegoFalso).includes("return"), false);
});

test("los asientos automáticos los sienta quien lleva la mesa, y solo en lobby", () => {
  let sesion = crearSesion({ id: "b", juego: "j", anfitrionId: "gm", coordinadorId: "gm" });
  let n = 0;
  const paso = (actorId, tipo) => {
    const res = aplicar(sesion, {
      sobre: {
        sessionId: "b",
        epocaCoordinador: sesion.publico.epocaCoordinador,
        nonce: `n${(n += 1)}`,
        tipo,
      },
      actorId,
      juego: juegoFalso,
      semilla: 3,
    });
    if (res.ok) sesion = res.sesion;
    return res;
  };

  // Un jugador cualquiera no puede poblar la mesa de máquinas.
  assert.equal(paso("p1", "botAdd").codigo, "no_autorizado");

  assert.equal(paso("gm", "botAdd").ok, true);
  assert.equal(paso("gm", "botAdd").ok, true);
  const automaticos = sesion.publico.jugadores.filter((j) => esAutomatico(j.userId));
  assert.equal(automaticos.length, 2);
  for (const asiento of automaticos) {
    assert.equal(asiento.controlador, "automatico", "el motor de juego necesita saberlo");
    // La identidad sintética lleva un prefijo que ningún id de Foundry puede
    // tener: no hay forma de confundir un NPC con una persona.
    assert.ok(asiento.userId.startsWith(PREFIJO_AUTOMATICO));
  }
  assert.equal(
    new Set(automaticos.map((j) => j.userId)).size,
    2,
    "dos asientos con el mismo nombre serían indistinguibles en la mesa",
  );

  // Quitar el último y volver a sentar: la numeración no se reutiliza.
  assert.equal(paso("gm", "botRemove").ok, true);
  assert.equal(paso("gm", "botAdd").ok, true);
  const nombres = sesion.publico.jugadores.filter((j) => esAutomatico(j.userId)).map((j) => j.userId);
  assert.deepEqual(nombres, [`${PREFIJO_AUTOMATICO}1`, `${PREFIJO_AUTOMATICO}3`]);

  // Con la mano en juego no se toca la composición de la mesa.
  paso("p1", "join");
  assert.equal(paso("gm", "start").ok, true);
  assert.equal(paso("gm", "botAdd").codigo, "fase_invalida");
  assert.equal(paso("gm", "botRemove").codigo, "fase_invalida");
});

test("sin automáticos en la mesa no se ofrece quitarlos", () => {
  const sesion = crearSesion({ id: "b2", juego: "j", anfitrionId: "gm", coordinadorId: "gm" });
  const acciones = accionesPermitidas(sesion, "gm", juegoFalso);
  assert.ok(acciones.includes("botAdd"));
  assert.equal(acciones.includes("botRemove"), false);
  // Y a quien no lleva la mesa no se le ofrece ninguna de las dos.
  const ajenas = accionesPermitidas(sesion, "p1", juegoFalso);
  assert.equal(ajenas.includes("botAdd"), false);
  assert.equal(ajenas.includes("botRemove"), false);
});
