import assert from "node:assert/strict";
import test from "node:test";

import { crearSesion, aplicar, vistaPublicaSesion } from "../scripts/minijuegos/sesion-motor.mjs";
import {
  FLAG_PROPUESTA,
  construirPropuesta,
  extraerPropuesta,
  procesarPropuesta,
  vistasPrivadas,
  despacharCambioDeUsuario,
  adoptarSesionPublicada,
  aceptarVistaPrivada,
} from "../scripts/minijuegos/adaptador-sesion.mjs";

const MODULO = "espaciokoop-lagunak";

// Mismo juego falso que en las pruebas del motor: el adaptador tampoco sabe de
// póker, aloja lo que le den por la interfaz del contrato.
const juegoFalso = {
  crear(configuracion, semilla) {
    return {
      jugadores: configuracion.jugadores.map((j) => j.userId),
      secretos: Object.fromEntries(configuracion.jugadores.map((j, i) => [j.userId, semilla + i])),
      jugadas: {},
    };
  },
  vistaPublica(estado) {
    return { jugadas: { ...estado.jugadas } };
  },
  vistaPrivada(estado, userId) {
    return { secreto: estado.secretos[userId] ?? null };
  },
  accionesPermitidas(estado, userId) {
    return estado.jugadas[userId] == null ? ["jugar"] : [];
  },
  aplicar(estado, { actorId, tipo, parametros }) {
    if (tipo !== "jugar") return { ok: false, codigo: "accion_no_permitida" };
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

let contador = 0;
function nonce() {
  contador += 1;
  return `n${contador}`;
}

function sesionConDos() {
  let sesion = crearSesion({ id: "mesa", juego: "falso", anfitrionId: "gm", coordinadorId: "gm" });
  for (const userId of ["u1", "u2"]) {
    const sobre = construirPropuesta({
      publico: vistaPublicaSesion(sesion),
      tipo: "join",
      nonce: nonce(),
    });
    sesion = aplicar(sesion, { sobre, actorId: userId, juego: juegoFalso }).sesion;
  }
  return sesion;
}

// Simula el cambio que Foundry entrega al hook updateUser.
function cambioConPropuesta(sobre) {
  return { flags: { [MODULO]: { [FLAG_PROPUESTA]: sobre } } };
}

test("la propuesta se construye del estado público conocido y sin identidad", () => {
  const sesion = sesionConDos();
  const publico = vistaPublicaSesion(sesion);
  const sobre = construirPropuesta({ publico, tipo: "act", parametros: { tipo: "jugar" }, nonce: "n" });
  assert.deepEqual(sobre, {
    sessionId: "mesa",
    epocaCoordinador: publico.epocaCoordinador,
    revisionEsperada: publico.revision,
    tipo: "act",
    nonce: "n",
    parametros: { tipo: "jugar" },
  });
  // Ningún campo de identidad: el coordinador la toma del documento User.
  assert.equal("userId" in sobre, false);
  assert.equal("actorId" in sobre, false);
});

test("extraerPropuesta ignora cambios ajenos al flag", () => {
  const sobre = { sessionId: "mesa", tipo: "join", nonce: "n", epocaCoordinador: 0 };
  assert.deepEqual(extraerPropuesta({ changes: cambioConPropuesta(sobre), moduleId: MODULO }), sobre);
  assert.equal(extraerPropuesta({ changes: { name: "otro" }, moduleId: MODULO }), null);
  assert.equal(extraerPropuesta({ changes: cambioConPropuesta(sobre), moduleId: "otro" }), null);
  assert.equal(extraerPropuesta({ changes: cambioConPropuesta({ tipo: "join" }), moduleId: MODULO }), null);
});

test("el coordinador aplica con la identidad del documento, no con la del sobre", () => {
  const sesion = sesionConDos();
  const sobre = {
    ...construirPropuesta({ publico: vistaPublicaSesion(sesion), tipo: "start", nonce: nonce() }),
    userId: "u1", // mentira descarada del cliente
    actorId: "u1",
  };
  const publicados = [];
  const privadas = [];
  const res = despacharCambioDeUsuario({
    userDoc: { id: "gm" }, // identidad autenticada: el GM anfitrión
    changes: cambioConPropuesta(sobre),
    moduleId: MODULO,
    obtenerSesion: () => sesion,
    juego: juegoFalso,
    semillaNueva: () => 10,
    publicar: (publico) => publicados.push(publico),
    enviarPrivada: (userId, vista) => privadas.push([userId, vista]),
  });
  assert.equal(res.ok, true);
  assert.equal(publicados.length, 1);
  assert.equal(publicados[0].manoEnCurso, true);
  // Vistas privadas: una por jugador sentado, dirigida a su userId.
  assert.deepEqual(
    privadas.map(([userId, vista]) => [userId, vista.juegoPrivado.secreto]),
    [
      ["u1", 10],
      ["u2", 11],
    ],
  );
  // Y el estado publicado no lleva secretos.
  assert.equal(JSON.stringify(publicados[0]).includes("secreto"), false);
});

test("un cambio que no es propuesta, o sin coordinar, no hace nada", () => {
  const sesion = sesionConDos();
  const comun = {
    userDoc: { id: "gm" },
    moduleId: MODULO,
    obtenerSesion: () => sesion,
    juego: juegoFalso,
  };
  assert.equal(despacharCambioDeUsuario({ ...comun, changes: { name: "x" } }), null);
  const sobre = construirPropuesta({ publico: vistaPublicaSesion(sesion), tipo: "start", nonce: nonce() });
  assert.equal(
    despacharCambioDeUsuario({
      ...comun,
      changes: cambioConPropuesta(sobre),
      puedeCoordinar: () => false, // este cliente no es el coordinador
    }),
    null,
  );
  // Sin sesión viva tampoco se inventa una.
  assert.equal(
    despacharCambioDeUsuario({
      ...comun,
      changes: cambioConPropuesta(sobre),
      obtenerSesion: () => null,
    }),
    null,
  );
});

test("un rechazo se notifica y no publica nada", () => {
  const sesion = sesionConDos();
  const sobre = construirPropuesta({
    publico: { ...vistaPublicaSesion(sesion), epocaCoordinador: 7 },
    tipo: "start",
    nonce: nonce(),
  });
  const publicados = [];
  const rechazos = [];
  const res = despacharCambioDeUsuario({
    userDoc: { id: "gm" },
    changes: cambioConPropuesta(sobre),
    moduleId: MODULO,
    obtenerSesion: () => sesion,
    juego: juegoFalso,
    semillaNueva: () => 10,
    publicar: (publico) => publicados.push(publico),
    alRechazar: (info) => rechazos.push(info),
  });
  assert.equal(res.ok, false);
  assert.equal(publicados.length, 0);
  assert.deepEqual(rechazos, [{ actorId: "gm", codigo: "epoca_obsoleta" }]);
});

test("el reenvío idempotente no republica el estado", () => {
  let sesion = sesionConDos();
  const sobre = construirPropuesta({
    publico: vistaPublicaSesion(sesion),
    tipo: "start",
    nonce: nonce(),
  });
  const publicados = [];
  const despachar = () =>
    despacharCambioDeUsuario({
      userDoc: { id: "gm" },
      changes: cambioConPropuesta(sobre),
      moduleId: MODULO,
      obtenerSesion: () => sesion,
      juego: juegoFalso,
      semillaNueva: () => 10,
      publicar: (publico) => publicados.push(publico),
    });
  sesion = despachar().sesion;
  const repetido = despachar();
  assert.equal(repetido.idempotente, true);
  assert.equal(publicados.length, 1); // solo la primera vez
});

test("la semilla solo se pide para arrancar mano y nunca sale al sobre", () => {
  const sesion = sesionConDos();
  let veces = 0;
  const sobreJoin = construirPropuesta({
    publico: vistaPublicaSesion(sesion),
    tipo: "watch",
    nonce: nonce(),
  });
  despacharCambioDeUsuario({
    userDoc: { id: "mirón" },
    changes: cambioConPropuesta(sobreJoin),
    moduleId: MODULO,
    obtenerSesion: () => sesion,
    juego: juegoFalso,
    semillaNueva: () => {
      veces += 1;
      return 10;
    },
  });
  assert.equal(veces, 0);
  assert.equal(JSON.stringify(sobreJoin).includes("semilla"), false);
});

test("las vistas privadas no se reparten a espectadores ni a ausentes", () => {
  let sesion = sesionConDos();
  const arrancar = construirPropuesta({
    publico: vistaPublicaSesion(sesion),
    tipo: "start",
    nonce: nonce(),
  });
  sesion = aplicar(sesion, { sobre: arrancar, actorId: "gm", juego: juegoFalso, semilla: 10 }).sesion;
  const mirando = construirPropuesta({
    publico: vistaPublicaSesion(sesion),
    tipo: "watch",
    nonce: nonce(),
  });
  sesion = aplicar(sesion, { sobre: mirando, actorId: "mirón", juego: juegoFalso }).sesion;
  const yendose = construirPropuesta({
    publico: vistaPublicaSesion(sesion),
    tipo: "leave",
    nonce: nonce(),
  });
  sesion = aplicar(sesion, { sobre: yendose, actorId: "u2", juego: juegoFalso }).sesion;

  assert.deepEqual(
    vistasPrivadas(sesion, juegoFalso).map((p) => p.userId),
    ["u1"], // u2 quedó ausente; el espectador nunca recibe privada
  );
});

test("procesarPropuesta no escribe: solo devuelve qué publicar", () => {
  const sesion = sesionConDos();
  const antes = JSON.stringify(vistaPublicaSesion(sesion));
  const sobre = construirPropuesta({
    publico: vistaPublicaSesion(sesion),
    tipo: "start",
    nonce: nonce(),
  });
  const res = procesarPropuesta({ sesion, sobre, actorId: "gm", juego: juegoFalso, semilla: 10 });
  assert.equal(res.ok, true);
  assert.equal(JSON.stringify(vistaPublicaSesion(sesion)), antes); // la original intacta
  assert.notEqual(res.sesion, sesion);
});

test("un cliente descarta la vista privada que no va dirigida a él", () => {
  assert.equal(aceptarVistaPrivada({ destinatarioId: "u1", userId: "u1" }), true);
  assert.equal(aceptarVistaPrivada({ destinatarioId: "u2", userId: "u1" }), false);
  assert.equal(aceptarVistaPrivada({ destinatarioId: undefined, userId: "u1" }), false);
});

// ---- Relevo de coordinador -------------------------------------------------
// El GM que toma el relevo solo dispone del estado público: los secretos vivían
// en la memoria del anterior. Estas pruebas fijan lo que el contrato promete.

test("adoptar el estado público sube la época e invalida los sobres en vuelo", () => {
  let sesion = sesionConDos();
  const publicado = vistaPublicaSesion(sesion);

  const adopcion = adoptarSesionPublicada({ publico: publicado, coordinadorId: "gm2" });
  assert.equal(adopcion.publico.coordinadorId, "gm2");
  assert.equal(adopcion.publico.epocaCoordinador, publicado.epocaCoordinador + 1);

  // Un sobre construido contra la época anterior ya no se aplica.
  const viejo = construirPropuesta({ publico: publicado, tipo: "start", nonce: nonce() });
  const res = aplicar(adopcion.sesion, {
    sobre: viejo,
    actorId: "gm",
    juego: juegoFalso,
    semilla: 10,
  });
  assert.equal(res.ok, false);
  assert.equal(res.codigo, "epoca_obsoleta");
});

test("el relevo cancela la mano en curso y restaura el checkpoint", () => {
  let sesion = sesionConDos();
  const arrancar = construirPropuesta({
    publico: vistaPublicaSesion(sesion),
    tipo: "start",
    nonce: nonce(),
  });
  sesion = aplicar(sesion, { sobre: arrancar, actorId: "gm", juego: juegoFalso, semilla: 10 }).sesion;
  assert.equal(sesion.publico.manoEnCurso, true);

  const adopcion = adoptarSesionPublicada({
    publico: vistaPublicaSesion(sesion),
    coordinadorId: "gm2",
  });
  assert.equal(adopcion.publico.manoEnCurso, false);
  assert.equal(adopcion.publico.manoCancelada, true);
  assert.equal(adopcion.publico.juegoPublico, null);
  // Sin semilla no se reanuda nada: el privado queda limpio.
  assert.equal(adopcion.sesion.privado.semilla, null);
  assert.equal(adopcion.sesion.privado.estadoJuego, null);
  assert.deepEqual(adopcion.sesion.privado.nonces, []);
  // Los asientos sobreviven a la cancelación.
  assert.deepEqual(
    adopcion.publico.jugadores.map((j) => j.userId),
    ["u1", "u2"],
  );
});

test("la adopción no publica nada cuando no hay mesa adoptable", () => {
  assert.equal(adoptarSesionPublicada({ publico: null, coordinadorId: "gm2" }), null);
  assert.equal(adoptarSesionPublicada({ publico: { id: "mesa" }, coordinadorId: "" }), null);
  const terminada = { ...vistaPublicaSesion(sesionConDos()), fase: "terminada" };
  assert.equal(adoptarSesionPublicada({ publico: terminada, coordinadorId: "gm2" }), null);
});

test("tras el relevo el nuevo coordinador ya procesa propuestas", () => {
  const sesion = sesionConDos();
  const adopcion = adoptarSesionPublicada({
    publico: vistaPublicaSesion(sesion),
    coordinadorId: "gm2",
  });
  let viva = adopcion.sesion;
  let publicado = null;

  const sobre = construirPropuesta({
    publico: adopcion.publico,
    tipo: "start",
    nonce: nonce(),
  });
  const resultado = despacharCambioDeUsuario({
    userDoc: { id: "gm2" },
    changes: cambioConPropuesta(sobre),
    moduleId: MODULO,
    obtenerSesion: () => viva,
    puedeCoordinar: () => true,
    juego: juegoFalso,
    semillaNueva: () => 77,
    publicar: (publico) => {
      publicado = publico;
    },
  });
  assert.equal(resultado.ok, true);
  assert.equal(publicado.manoEnCurso, true);
  assert.equal(publicado.coordinadorId, "gm2");
});

// ---- Lo que necesita la ventana (#308, paso 4) -----------------------------

test("cada vista repartida lleva las acciones de SU destinatario", () => {
  // Es lo que hacía imposible la interfaz: `accionesPermitidas` necesita la
  // sesión viva —con la mano en curso—, y esa solo existe en el coordinador. Un
  // cliente que quisiera deducir sus botones estaría reimplementando las reglas.
  let sesion = sesionConDos();
  const arrancar = construirPropuesta({
    publico: vistaPublicaSesion(sesion),
    tipo: "start",
    nonce: nonce(),
  });
  sesion = aplicar(sesion, { sobre: arrancar, actorId: "gm", juego: juegoFalso, semilla: 10 }).sesion;

  for (const parte of vistasPrivadas(sesion, juegoFalso)) {
    assert.ok(Array.isArray(parte.acciones), `${parte.userId} recibe su lista de acciones`);
  }
});

test("con destinatarios se reparte también a quien no está sentado, sin secretos", () => {
  // Quien mira desde fuera necesita su vista para que la ventana pueda
  // ofrecerle sentarse o mirar; lo que NO puede recibir es la parte privada.
  let sesion = sesionConDos();
  const arrancar = construirPropuesta({
    publico: vistaPublicaSesion(sesion),
    tipo: "start",
    nonce: nonce(),
  });
  sesion = aplicar(sesion, { sobre: arrancar, actorId: "gm", juego: juegoFalso, semilla: 10 }).sesion;

  const repartidas = vistasPrivadas(sesion, juegoFalso, ["u1", "u2", "ajeno", "ajeno", ""]);
  assert.deepEqual(
    repartidas.map((p) => p.userId),
    ["u1", "u2", "ajeno"],
    "sin duplicados ni identidades vacías",
  );
  const ajeno = repartidas.find((p) => p.userId === "ajeno");
  assert.equal("juegoPrivado" in ajeno.vista, false, "el de fuera no recibe parte privada");
  assert.equal(
    JSON.stringify(ajeno.vista).includes("secreto"),
    false,
    "ni rastro de secretos en lo que se le manda",
  );
  const sentado = repartidas.find((p) => p.userId === "u1");
  assert.ok(sentado.vista.juegoPrivado, "el sentado sí recibe la suya");
});

test("despacharCambioDeUsuario entrega acciones junto a cada vista", () => {
  let sesion = sesionConDos();
  const entregas = [];
  const sobre = construirPropuesta({
    publico: vistaPublicaSesion(sesion),
    tipo: "start",
    nonce: nonce(),
  });
  despacharCambioDeUsuario({
    userDoc: { id: "gm" },
    changes: cambioConPropuesta(sobre),
    moduleId: MODULO,
    obtenerSesion: () => sesion,
    juego: juegoFalso,
    semillaNueva: () => 10,
    destinatarios: () => ["u1", "u2", "ajeno"],
    enviarPrivada: (userId, vista, acciones) => entregas.push({ userId, vista, acciones }),
  });
  assert.deepEqual(entregas.map((e) => e.userId), ["u1", "u2", "ajeno"]);
  for (const entrega of entregas) {
    assert.ok(Array.isArray(entrega.acciones));
  }
});

test("REGRESIÓN: el coordinador que recarga readopta SU PROPIA mesa", () => {
  // Lo que decide el relevo es no tener los secretos, no quién figure en el
  // estado público. El GM que recarga la página sigue figurando como
  // coordinador —un ajuste de mundo no se entera de un F5— pero ha perdido
  // semilla, mazo y manos, que solo vivían en su memoria. Si no readopta,
  // descarta en silencio todo lo que le propongan y la mesa queda muerta.
  let sesion = sesionConDos();
  const arrancar = construirPropuesta({
    publico: vistaPublicaSesion(sesion),
    tipo: "start",
    nonce: nonce(),
  });
  sesion = aplicar(sesion, { sobre: arrancar, actorId: "gm", juego: juegoFalso, semilla: 10 }).sesion;
  const antes = vistaPublicaSesion(sesion);
  assert.equal(antes.manoEnCurso, true);

  const readoptada = adoptarSesionPublicada({ publico: antes, coordinadorId: "gm" });
  assert.ok(readoptada, "readoptar la propia mesa es posible");
  assert.equal(readoptada.publico.coordinadorId, "gm");
  assert.equal(
    readoptada.publico.epocaCoordinador,
    antes.epocaCoordinador + 1,
    "sube la época: los sobres en vuelo de antes del F5 ya no valen",
  );
  assert.equal(readoptada.publico.manoEnCurso, false, "la mano no se reanuda sin semilla");
  assert.equal(readoptada.publico.manoCancelada, true, "y se dice que se canceló");
  assert.equal(readoptada.sesion.privado.estadoJuego, null, "sin secretos inventados");
  // Los asientos siguen ahí: se cancela la mano, no se disuelve la mesa.
  assert.deepEqual(
    readoptada.publico.jugadores.map((j) => j.userId),
    antes.jugadores.map((j) => j.userId),
  );
});

test("REGRESIÓN: la segunda propuesta llega como diferencial y no puede rechazarse", () => {
  // Lo que se veía en mesa: la primera jugada iba y las siguientes salían con
  // «payload_invalido». Foundry entrega en `updateUser` el DIFERENCIAL del
  // documento, no el valor completo: la segunda propuesta del mismo cliente
  // solo trae las claves que cambiaron, así que el sobre llegaba sin
  // `sessionId` ni `epocaCoordinador`.
  let sesion = sesionConDos();
  const publico = vistaPublicaSesion(sesion);
  const sobre = construirPropuesta({ publico, tipo: "start", nonce: nonce() });

  // El diferencial: solo el nonce, como haría Foundry al reescribir el flag.
  const soloElNonce = { flags: { [MODULO]: { [FLAG_PROPUESTA]: { nonce: sobre.nonce } } } };
  // Y el documento, ya actualizado, con el sobre entero.
  const userDoc = { id: "gm", flags: { [MODULO]: { [FLAG_PROPUESTA]: sobre } } };

  assert.equal(
    extraerPropuesta({ changes: soloElNonce, moduleId: MODULO, userDoc })?.sessionId,
    publico.id,
    "el sobre se lee del documento, no del diferencial",
  );

  const rechazos = [];
  const resultado = despacharCambioDeUsuario({
    userDoc,
    changes: soloElNonce,
    moduleId: MODULO,
    obtenerSesion: () => sesion,
    juego: juegoFalso,
    semillaNueva: () => 10,
    alRechazar: ({ codigo }) => rechazos.push(codigo),
  });
  assert.deepEqual(rechazos, [], "ya no se rechaza por payload_invalido");
  assert.equal(resultado?.ok, true);

  // Y un cambio que no toca nuestro flag sigue sin despacharse, aunque el
  // documento tenga un sobre viejo guardado: si no, cualquier cambio ajeno del
  // User reejecutaría la última propuesta.
  assert.equal(
    extraerPropuesta({ changes: { name: "otro nombre" }, moduleId: MODULO, userDoc }),
    null,
  );
});

test("sin sesión viva el coordinador lo dice, no descarta en silencio", () => {
  // Es el caso del GM que abrió la mesa en otra sesión del navegador: el ajuste
  // de mundo sigue ahí, pero los secretos no. Callarse deja al que propuso
  // mirando un botón que no hace nada, que es el peor de los diagnósticos.
  const rechazos = [];
  const sobre = construirPropuesta({
    publico: vistaPublicaSesion(sesionConDos()),
    tipo: "join",
    nonce: nonce(),
  });
  const resultado = despacharCambioDeUsuario({
    userDoc: { id: "p1", flags: { [MODULO]: { [FLAG_PROPUESTA]: sobre } } },
    changes: cambioConPropuesta(sobre),
    moduleId: MODULO,
    obtenerSesion: () => null,
    juego: juegoFalso,
    alRechazar: ({ actorId, codigo }) => rechazos.push({ actorId, codigo }),
  });
  assert.equal(resultado, null);
  assert.deepEqual(rechazos, [{ actorId: "p1", codigo: "sesion_desconocida" }]);
});
