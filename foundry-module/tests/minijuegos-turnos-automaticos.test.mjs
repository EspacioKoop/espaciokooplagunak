import assert from "node:assert/strict";
import test from "node:test";

import {
  LIMITE_JUGADAS,
  resolverTurnosAutomaticos,
} from "../scripts/minijuegos/turnos-automaticos.mjs";
import { decidirAccionAutomatica } from "../scripts/minijuegos/agente-automatico.mjs";
import { configuracionPoker } from "../scripts/minijuegos/mesa-config.mjs";
import * as poker from "../scripts/minijuegos/poker-motor.mjs";
import {
  PREFIJO_AUTOMATICO,
  aplicar,
  crearSesion,
  vistaPublicaSesion,
} from "../scripts/minijuegos/sesion-motor.mjs";

// Mesa con una persona y los automáticos que se pidan, ya repartida.
function mesaConAutomaticos(cuantos, { semilla = 4242 } = {}) {
  let sesion = crearSesion({ id: "s", juego: "poker", anfitrionId: "gm", coordinadorId: "gm" });
  let n = 0;
  const paso = (actorId, tipo, configuracionJuego, parametros) => {
    const res = aplicar(sesion, {
      sobre: {
        sessionId: "s",
        epocaCoordinador: sesion.publico.epocaCoordinador,
        nonce: `n${(n += 1)}`,
        tipo,
        ...(parametros ? { parametros } : {}),
      },
      actorId,
      juego: poker,
      semilla,
      configuracionJuego,
    });
    if (res.ok) sesion = res.sesion;
    return res;
  };
  paso("gm", "join");
  for (let i = 0; i < cuantos; i += 1) assert.equal(paso("gm", "botAdd").ok, true);
  assert.equal(paso("gm", "start", configuracionPoker(vistaPublicaSesion(sesion))).ok, true);
  // En hold'em el primero en hablar preflop es la persona (el botón arranca en
  // el asiento 0, que es el suyo). Para probar los turnos de la máquina hay que
  // dejar que le toque: iguala y cede el turno.
  const cederTurno = () => {
    assert.equal(sesion.publico.juegoPublico.turno, "gm", "arranca hablando la persona");
    assert.equal(paso("gm", "act", undefined, { tipo: "call", parametros: {} }).ok, true);
    assert.ok(
      sesion.publico.juegoPublico.turno.startsWith(PREFIJO_AUTOMATICO),
      "ahora le toca a una máquina",
    );
  };
  return { get sesion() { return sesion; }, paso, cederTurno };
}

test("REGRESIÓN: un asiento automático juega su turno en vez de colgar la mano", () => {
  // El motor no tiene reloj y el agente no sabe de sesiones: sin esta pieza, la
  // mano se quedaba parada para siempre esperando a un jugador que no existe.
  const mesa = mesaConAutomaticos(1);
  mesa.cederTurno();
  const turnoInicial = mesa.sesion.publico.juegoPublico.turno;
  const resultado = resolverTurnosAutomaticos(mesa.sesion, {
    juego: poker,
    decidir: decidirAccionAutomatica,
  });

  // O le toca a la persona, o la mano ha terminado: lo que no puede es seguir
  // esperando a la máquina.
  const publico = resultado.sesion.publico;
  const turno = publico.juegoPublico?.turno ?? null;
  assert.ok(
    !publico.manoEnCurso || turno === "gm",
    `la mano avanza hasta la persona (turno: ${turno})`,
  );
  if (turnoInicial.startsWith(PREFIJO_AUTOMATICO)) {
    assert.ok(resultado.jugadas.length > 0, "y el automático ha jugado de verdad");
    for (const jugada of resultado.jugadas) {
      assert.ok(jugada.userId.startsWith(PREFIJO_AUTOMATICO), "solo juegan los automáticos");
    }
  }
});

test("no toca el turno de una persona", () => {
  const mesa = mesaConAutomaticos(1);
  mesa.cederTurno();
  // Se avanza hasta que le toque a la persona y se vuelve a llamar: no debe
  // pasar nada en absoluto.
  const { sesion } = resolverTurnosAutomaticos(mesa.sesion, {
    juego: poker,
    decidir: decidirAccionAutomatica,
  });
  if (sesion.publico.juegoPublico?.turno !== "gm") return; // la mano ya terminó
  const segunda = resolverTurnosAutomaticos(sesion, {
    juego: poker,
    decidir: decidirAccionAutomatica,
  });
  assert.equal(segunda.sesion, sesion, "ni una revisión de más");
  assert.deepEqual(segunda.jugadas, []);
});

test("una mesa solo de automáticos resuelve la mano entera y PARA", () => {
  // El caso que puede colgar el navegador del que lleva la mesa: nadie humano
  // que devuelva el control. Tiene que terminar por sí sola.
  const mesa = mesaConAutomaticos(2);
  mesa.cederTurno();
  // La persona se retira en cuanto le vuelva a tocar; el resto son máquinas.
  let sesion = mesa.sesion;
  const avanzar = () =>
    resolverTurnosAutomaticos(sesion, { juego: poker, decidir: decidirAccionAutomatica });
  let vueltas = 0;
  while (sesion.publico.manoEnCurso && vueltas < 20) {
    const paso = avanzar();
    sesion = paso.sesion;
    if (!sesion.publico.manoEnCurso) break;
    assert.notEqual(paso.cortadoPor, "limite", "no debería agotar el límite");
    if (sesion.publico.juegoPublico?.turno === "gm") {
      const res = aplicar(sesion, {
        sobre: {
          sessionId: "s",
          epocaCoordinador: sesion.publico.epocaCoordinador,
          nonce: `humano${vueltas}`,
          tipo: "act",
          parametros: { tipo: "fold", parametros: {} },
        },
        actorId: "gm",
        juego: poker,
      });
      assert.equal(res.ok, true);
      sesion = res.sesion;
    }
    vueltas += 1;
  }
  assert.equal(sesion.publico.manoEnCurso, false, "la mano termina sola");
  assert.ok(sesion.publico.resultado, "y publica su resultado");
});

test("un agente que devuelve basura no deja la mesa dando vueltas", () => {
  // Insistir con una jugada que el motor rechaza sería discutir con las reglas;
  // el bucle se corta y el turno lo desatasca una persona.
  const mesa = mesaConAutomaticos(1);
  mesa.cederTurno();
  const conBasura = resolverTurnosAutomaticos(mesa.sesion, {
    juego: poker,
    decidir: () => ({ tipo: "bailar" }),
  });
  assert.deepEqual(conBasura.jugadas, []);
  assert.equal(conBasura.sesion, mesa.sesion, "la sesión se queda como estaba");
  assert.ok(conBasura.cortadoPor, "y se dice por qué se paró");

  // Lo mismo si la política revienta.
  const rota = resolverTurnosAutomaticos(mesa.sesion, {
    juego: poker,
    decidir: () => {
      throw new Error("política rota");
    },
  });
  assert.equal(rota.cortadoPor, "agente_roto");
  assert.equal(rota.sesion, mesa.sesion);

  // Y si no hay agente, no se inventa uno.
  assert.equal(
    resolverTurnosAutomaticos(mesa.sesion, { juego: poker }).cortadoPor,
    "sin_agente",
  );
});

test("el límite es finito y se dice cuando se alcanza", () => {
  assert.ok(Number.isInteger(LIMITE_JUGADAS) && LIMITE_JUGADAS > 0);
  const mesa = mesaConAutomaticos(2);
  mesa.cederTurno();
  const cortado = resolverTurnosAutomaticos(mesa.sesion, {
    juego: poker,
    decidir: decidirAccionAutomatica,
    limite: 1,
  });
  assert.equal(cortado.jugadas.length, 1);
  assert.equal(cortado.cortadoPor, "limite");
});

test("sin mano en curso no juega nadie", () => {
  const sesion = crearSesion({ id: "x", juego: "poker", anfitrionId: "gm", coordinadorId: "gm" });
  const res = resolverTurnosAutomaticos(sesion, {
    juego: poker,
    decidir: decidirAccionAutomatica,
  });
  assert.equal(res.sesion, sesion);
  assert.deepEqual(res.jugadas, []);
});

test("REGRESIÓN: un automático nuevo no hereda las fichas del que se levantó", () => {
  // Las fichas se arrastran entre manos POR IDENTIDAD. Si el número se
  // reutilizara, un asiento recién sentado empezaría con el montón de un
  // muerto: ni las fichas cuadrarían ni la mesa sería justa.
  let sesion = crearSesion({ id: "f", juego: "poker", anfitrionId: "gm", coordinadorId: "gm" });
  let n = 0;
  const paso = (tipo) => {
    const res = aplicar(sesion, {
      sobre: {
        sessionId: "f",
        epocaCoordinador: sesion.publico.epocaCoordinador,
        nonce: `n${(n += 1)}`,
        tipo,
      },
      actorId: "gm",
      juego: poker,
    });
    if (res.ok) sesion = res.sesion;
    return res;
  };
  paso("botAdd");
  const primero = sesion.publico.jugadores.at(-1).userId;
  paso("botRemove");
  paso("botAdd");
  const segundo = sesion.publico.jugadores.at(-1).userId;
  assert.notEqual(segundo, primero, "identidad nueva para un asiento nuevo");

  // Con fichas del primero publicadas, el segundo NO las hereda.
  const publico = {
    jugadores: sesion.publico.jugadores,
    resultado: { stacksFinales: { [primero]: 7 } },
  };
  const config = configuracionPoker(publico, { fichasIniciales: 100 });
  const entrada = config.jugadores.find((j) => j.userId === segundo);
  assert.equal(entrada.stack, 100, "entra con la entrada de la mesa, no con lo del anterior");
});
