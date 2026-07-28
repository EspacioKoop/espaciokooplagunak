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

test("REGRESIÓN: la segunda mano hereda las fichas — repartir no es una recompra", () => {
  // El motor de póker lo dice en su cabecera: «la mano siguiente es un nuevo
  // `crear` con los stacks resultantes». Si la configuración volviera a repartir
  // la entrada, cada mano devolvería a todos a 100 y las fichas dejarían de ser
  // efímeras: ganar y perder no significaría nada más allá de la mano en curso.
  let sesion = crearSesion({ id: "s", juego: "poker", anfitrionId: "gm", coordinadorId: "gm" });
  let nonce = 0;
  const paso = (actorId, tipo, parametros, configuracionJuego) => {
    const res = aplicar(sesion, {
      sobre: sobre(sesion, tipo, parametros, `n${(nonce += 1)}`),
      actorId,
      juego: poker,
      semilla: 99,
      configuracionJuego,
    });
    if (res.ok) sesion = res.sesion;
    return res;
  };

  paso("p1", "join", {});
  paso("p2", "join", {});
  assert.equal(paso("gm", "start", {}, configuracionPoker(sesion.publico)).ok, true);

  const total = (publica) =>
    publica.juegoPublico.jugadores.reduce((suma, j) => suma + j.stack, 0) + publica.juegoPublico.bote;
  const totalPrimera = total(vistaPublicaSesion(sesion));
  assert.equal(totalPrimera, 200, "dos entradas de 100");

  // Se termina la mano por retirada: quien tiene el turno se va.
  const enTurno = vistaPublicaSesion(sesion).juegoPublico.turno;
  assert.equal(paso(enTurno, "act", { tipo: "fold" }).ok, true);
  assert.equal(vistaPublicaSesion(sesion).manoEnCurso, false, "la mano ha terminado");

  const trasPrimera = sesion.publico.resultado?.stacksFinales;
  assert.ok(trasPrimera, "la mano terminada publica sus stacks finales");
  const suma = Object.values(trasPrimera).reduce((a, b) => a + b, 0);
  assert.equal(suma, 200, "una mano no crea ni destruye fichas");
  assert.notDeepEqual(
    Object.values(trasPrimera).sort(),
    [100, 100],
    "la mano tiene que haber movido fichas para que la prueba pruebe algo",
  );

  // Y aquí está lo que se rompía: la configuración de la SEGUNDA mano.
  const segunda = configuracionPoker(sesion.publico);
  for (const jugador of segunda.jugadores) {
    assert.equal(
      jugador.stack,
      trasPrimera[jugador.userId],
      `${jugador.userId} entra a la segunda mano con las fichas de la primera`,
    );
  }
  assert.equal(
    segunda.jugadores.reduce((suma, j) => suma + j.stack, 0),
    200,
    "el total no cambia entre manos: nadie recompra",
  );

  assert.equal(paso("gm", "start", {}, segunda).ok, true);
  assert.equal(total(vistaPublicaSesion(sesion)), 200, "tampoco al repartir de nuevo");
});

test("quien se queda a cero se queda fuera de la MANO, no de la mesa", () => {
  // `poker.crear` exige stack entero positivo, así que la regla había que
  // cerrarla. Sin recompras (#308), un asiento sin fichas no entra al reparto;
  // sigue sentado en la mesa, que es la capa social y no el juego.
  const publico = {
    jugadores: [{ userId: "p1" }, { userId: "p2" }, { userId: "p3" }],
    resultado: { stacksFinales: { p1: 150, p2: 0, p3: 50 } },
  };
  const config = configuracionPoker(publico);
  assert.deepEqual(
    config.jugadores.map((j) => j.userId),
    ["p1", "p3"],
    "p2 no entra a repartir",
  );
  assert.deepEqual(
    config.jugadores.map((j) => j.stack),
    [150, 50],
    "y a nadie se le repone la entrada",
  );
  // El orden de los que quedan se conserva: el asiento es posicional y
  // reordenarlo movería el botón y las ciegas sin que nadie lo pidiera.
  assert.equal(config.jugadores[0].userId, "p1");
});

test("la primera mano sí usa la entrada configurada", () => {
  // Sin mano previa no hay nada que heredar, y ahí la entrada de la mesa es la
  // que manda: es la diferencia entre «primera mano» y «recompra».
  const publico = { jugadores: [{ userId: "p1" }, { userId: "p2" }] };
  assert.deepEqual(
    configuracionPoker(publico, { fichasIniciales: 250 }).jugadores.map((j) => j.stack),
    [250, 250],
  );
  // Y con una mano EN CURSO (aún sin resultado) se toman los stacks vivos, no
  // la entrada: es el caso de una mano interrumpida y vuelta a arrancar.
  const enCurso = {
    jugadores: [{ userId: "p1" }, { userId: "p2" }],
    juegoPublico: { jugadores: [{ userId: "p1", stack: 80 }, { userId: "p2", stack: 120 }] },
  };
  assert.deepEqual(
    configuracionPoker(enCurso).jugadores.map((j) => j.stack),
    [80, 120],
  );
});

// ---- El botón rota (hallazgo abierto de PR #360) ---------------------------

test("REGRESIÓN: el botón rota entre manos — no siempre paga la ciega el mismo", () => {
  // El síntoma en mesa: `poker.crear` cae en `botonIndice: 0` si nadie se lo
  // dice, y la configuración no se lo decía. Con el disco clavado en el asiento
  // 0, ese jugador pagaba la ciega pequeña TODA la noche (y en heads-up, además,
  // actuaba primero siempre). La ventaja posicional dejaba de repartirse.
  const mesa = [{ userId: "p1" }, { userId: "p2" }, { userId: "p3" }];

  // Primera mano: sin nada anterior, el disco arranca en el asiento 0.
  assert.equal(configuracionPoker({ jugadores: mesa }).botonIndice, 0);

  // Segunda: la mano anterior lo tuvo en p1, así que le toca a p2.
  const trasP1 = {
    jugadores: mesa,
    juegoPublico: { botonIndice: 0, jugadores: mesa.map((j) => ({ ...j, stack: 100 })) },
  };
  assert.equal(configuracionPoker(trasP1).botonIndice, 1);

  // Y desde el último asiento vuelve al primero: da la vuelta a la mesa.
  const trasP3 = {
    jugadores: mesa,
    juegoPublico: { botonIndice: 2, jugadores: mesa.map((j) => ({ ...j, stack: 100 })) },
  };
  assert.equal(configuracionPoker(trasP3).botonIndice, 0);
});

test("el botón salta a quien SÍ juega, contando por el orden de la mesa", () => {
  // p2 sigue sentado pero sin fichas: no entra a la mano. El disco le
  // correspondería, y pasa al siguiente que reparte — sin que ese salto
  // desplace la cuenta para las manos posteriores, porque se cuenta por el
  // orden de la mesa y no por el de la mano.
  const publico = {
    jugadores: [{ userId: "p1" }, { userId: "p2" }, { userId: "p3" }],
    juegoPublico: {
      botonIndice: 0,
      jugadores: [
        { userId: "p1", stack: 100 },
        { userId: "p2", stack: 0 },
        { userId: "p3", stack: 100 },
      ],
    },
    resultado: { stacksFinales: { p1: 150, p2: 0, p3: 50 } },
  };
  const config = configuracionPoker(publico);
  assert.deepEqual(config.jugadores.map((j) => j.userId), ["p1", "p3"]);
  assert.equal(config.botonIndice, 1, "el disco va a p3, que es el índice 1 de la mano");
});

test("el botón es un índice válido de la mano que empieza, pase lo que pase", () => {
  // Lo que protege esta prueba es el motor: `crear` rechaza un `botonIndice`
  // fuera de rango con un RangeError, y ese fallo llegaría a la mesa como
  // «juego_rechazo», muy lejos de su causa. Entradas raras: quien tenía el
  // disco ya no está en la mesa, un índice imposible, o basura.
  const mesa = [{ userId: "p1" }, { userId: "p2" }];
  const casos = [
    { botonIndice: 0, jugadores: [{ userId: "quien-se-fue", stack: 10 }] },
    { botonIndice: 7, jugadores: mesa.map((j) => ({ ...j, stack: 10 })) },
    { botonIndice: "dos", jugadores: mesa.map((j) => ({ ...j, stack: 10 })) },
    { jugadores: mesa.map((j) => ({ ...j, stack: 10 })) },
  ];
  for (const juegoPublico of casos) {
    const config = configuracionPoker({ jugadores: mesa, juegoPublico });
    assert.ok(
      Number.isInteger(config.botonIndice) && config.botonIndice < config.jugadores.length,
      `botonIndice usable con ${JSON.stringify(juegoPublico.botonIndice)}`,
    );
    assert.doesNotThrow(() => poker.crear(config, 1));
  }
  // Y sin nadie sentado tampoco explota: no hay mano, pero la configuración se
  // construye igual.
  assert.equal(configuracionPoker({ jugadores: [] }).botonIndice, 0);
});

test("dos manos seguidas por el cableado real: la ciega pequeña cambia de dueño", () => {
  // La comprobación de mesa, extremo a extremo con tres asientos: quien pagó la
  // ciega pequeña en la primera mano NO la paga en la segunda.
  let sesion = crearSesion({ id: "s", juego: "poker", anfitrionId: "gm", coordinadorId: "gm" });
  let nonce = 0;
  const paso = (actorId, tipo, parametros, configuracionJuego) => {
    const res = aplicar(sesion, {
      sobre: sobre(sesion, tipo, parametros, `n${(nonce += 1)}`),
      actorId,
      juego: poker,
      semilla: 7,
      configuracionJuego,
    });
    if (res.ok) sesion = res.sesion;
    return res;
  };
  const ciegaPequenaDe = () => {
    const juego = vistaPublicaSesion(sesion).juegoPublico;
    // Con tres o más, la ciega pequeña es el asiento siguiente al botón.
    return juego.jugadores[(juego.botonIndice + 1) % juego.jugadores.length].userId;
  };

  paso("p1", "join", {});
  paso("p2", "join", {});
  paso("p3", "join", {});
  assert.equal(paso("gm", "start", {}, configuracionPoker(sesion.publico)).ok, true);
  const primera = ciegaPequenaDe();

  // Se cierra la mano a base de retiradas hasta que solo quede uno.
  while (vistaPublicaSesion(sesion).manoEnCurso) {
    const enTurno = vistaPublicaSesion(sesion).juegoPublico.turno;
    assert.ok(enTurno, "una mano en curso tiene turno");
    assert.equal(paso(enTurno, "act", { tipo: "fold" }).ok, true);
  }

  assert.equal(paso("gm", "start", {}, configuracionPoker(sesion.publico)).ok, true);
  assert.notEqual(ciegaPequenaDe(), primera, "la ciega pequeña ha cambiado de dueño");
});
