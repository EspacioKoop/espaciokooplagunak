// Motor puro de una mano de BLACKJACK, tercer vertical del sistema de
// minijuegos sociales (#308). Implementa la misma interfaz interna que fija
// docs/MINIJUEGOS_FOUNDRY.md y que ya cumplen `poker-motor.mjs` y
// `dados-motor.mjs`:
//
//   crear(configuracion, semilla) -> estadoJuego
//   vistaPublica(estadoJuego) -> object
//   vistaPrivada(estadoJuego, userId) -> object
//   accionesPermitidas(estadoJuego, userId) -> [string]
//   aplicar(estadoJuego, accion) -> { ok, estado } | { ok:false, codigo }
//   haTerminado(estadoJuego) -> boolean
//   resultado(estadoJuego) -> object | null
//
// Lo que ya está fuera de este módulo: identidad, época, nonces, lobby,
// espectadores, ausencias y cancelación segura viven en `sesion-motor.mjs`;
// la baraja y la aleatoriedad determinista viven en `naipes.mjs` y
// `aleatorio.mjs`. Este motor solo conoce las reglas de UNA mano.
//
// Puro: ni Foundry, ni red, ni DOM, ni reloj, ni Math.random(). Toda la
// aleatoriedad entra por `semilla`.
//
// A diferencia del póker, en blackjack la mano de cada jugador es pública
// desde el reparto — es la banca (el crupier) quien esconde una carta hasta
// el destape. Por eso `vistaPrivada` no añade ningún secreto: existe solo
// para cumplir la interfaz común.
//
// Sin recompras ni economía externa: cada jugador trae `fichas` (lo que
// dejó la mano anterior, igual que en póker) y arriesga `apuesta` de ellas.
// Quien se queda a cero fichas sigue sentado viendo la mesa, pero eso lo
// decide la capa de sesión, no este motor.

import { barajaMezclada, repartir } from "./naipes.mjs";

export const FASES = Object.freeze(["turnos", "terminada"]);

export const ERRORES = Object.freeze({
  FUERA_DE_TURNO: "fuera_de_turno",
  ACCION_NO_PERMITIDA: "accion_no_permitida",
  MANO_TERMINADA: "mano_terminada",
});

/**
 * Reglas de la casa que este motor APLICA, exportadas para que quien las
 * escriba en pantalla las lea de aquí (#553).
 *
 * Un cartel de reglas escrito a mano al lado del tapete es peor que no tener
 * cartel: no falla, se desincroniza — sigue diciendo cómo se jugaba antes del
 * último cambio de motor, y nadie se entera hasta que alguien pierde una mano
 * por creérselo. Con las constantes exportadas, el cartel no puede divergir del
 * juego y hay un test que lo sujeta.
 */
export const LIMITE_PLANTADO_BANCA = 17;
/** Lo que paga un blackjack sobre la apuesta, redondeando hacia abajo. */
export const PAGO_BLACKJACK = 1.5;
/** Con cuántas cartas se puede doblar: solo con la mano de salida. */
export const CARTAS_PARA_DOBLAR = 2;

// ---- Valor de cartas --------------------------------------------------------

// As (14 en naipes.mjs) vale 11 salvo que se reduzca más abajo; figuras
// (11..13) valen 10; el resto, su valor nominal.
function valorBlackjack(carta) {
  if (carta.valor === 14) return 11;
  if (carta.valor >= 10) return 10;
  return carta.valor;
}

// Suma cartas tratando cada As como 11 y bajándolo a 1 uno a uno mientras el
// total pase de 21 y queden ases que reducir. Es la regla estándar del "as
// blando".
export function calcularTotal(cartas) {
  let total = 0;
  let ases = 0;
  for (const carta of cartas) {
    total += valorBlackjack(carta);
    if (carta.valor === 14) ases += 1;
  }
  while (total > 21 && ases > 0) {
    total -= 10;
    ases -= 1;
  }
  return total;
}

export function esBlackjack(cartas) {
  return cartas.length === 2 && calcularTotal(cartas) === 21;
}

// ---- Creación ---------------------------------------------------------------

/**
 * `configuracion`:
 *   jugadores: [{ userId, apuesta, fichas, controlador }]
 *     — `apuesta` es lo que se arriesga esta mano, ya decidido fuera del
 *       motor (la capa de mesa resuelve cuánto apostar antes de repartir,
 *       igual que las ciegas en póker); `fichas` es lo que trae de antes.
 */
export function crear(configuracion, semilla) {
  const jugadoresConfig = configuracion?.jugadores ?? [];
  if (jugadoresConfig.length < 1 || jugadoresConfig.length > 6) {
    throw new RangeError("crear: se admite entre 1 y 6 jugadores contra la banca");
  }

  // Misma invariante que en póker y dados, y por la misma razón: la vista se
  // entrega por identidad, así que dos asientos con el mismo userId
  // compartirían turno.
  const vistos = new Set();
  for (const j of jugadoresConfig) {
    if (typeof j?.userId !== "string" || j.userId === "") {
      throw new RangeError("userId: cada jugador necesita un identificador no vacío");
    }
    if (vistos.has(j.userId)) {
      throw new RangeError(`userId: identidad duplicada en la mesa (${j.userId})`);
    }
    if (!Number.isInteger(j.apuesta) || j.apuesta < 1) {
      throw new RangeError(`apuesta: ${j.userId} necesita una apuesta entera positiva`);
    }
    if (!Number.isInteger(j.fichas) || j.fichas < j.apuesta) {
      throw new RangeError(`fichas: ${j.userId} no tiene suficientes fichas para su apuesta`);
    }
    vistos.add(j.userId);
  }

  let mazo = barajaMezclada(semilla);
  const jugadores = jugadoresConfig.map((j, indice) => {
    const { repartidas, resto } = repartir(mazo, 2);
    mazo = resto;
    return {
      userId: j.userId,
      asiento: indice,
      controlador: j.controlador === "automatico" ? "automatico" : "humano",
      fichas: j.fichas,
      apuesta: j.apuesta,
      cartas: repartidas,
      terminado: false,
      motivo: null, // null | "bust" | "blackjack" | "plantado" | "doblado"
      desenlace: null, // se rellena al resolver la mano
    };
  });

  const repartoBanca = repartir(mazo, 2);
  mazo = repartoBanca.resto;

  const estado = {
    version: 1,
    fase: "turnos",
    jugadores,
    banca: {
      cartas: repartoBanca.repartidas,
      oculta: true,
      blackjackInicial: esBlackjack(repartoBanca.repartidas),
    },
    mazo,
    turnoIndice: null,
    resultado: null,
  };

  // Un blackjack de la jugador se resuelve solo (no hay más decisiones que
  // tomar con 21 en dos cartas): se marca terminado antes de abrir turnos.
  for (const jugador of estado.jugadores) {
    if (esBlackjack(jugador.cartas)) {
      jugador.terminado = true;
      jugador.motivo = "blackjack";
    }
  }

  if (estado.banca.blackjackInicial) {
    // La banca con blackjack cierra la mano en el acto: nadie más juega.
    finalizarMano(estado);
  } else {
    estado.turnoIndice = siguienteActivo(estado.jugadores, -1);
    if (estado.turnoIndice === null) {
      // Todos los jugadores salieron con blackjack: no hay turnos que abrir,
      // pero la banca igualmente tiene que jugar su mano para saber si iguala.
      finalizarMano(estado);
    }
  }

  return estado;
}

// ---- Vistas -------------------------------------------------------------

function vistaBanca(estado) {
  if (estado.banca.oculta) {
    return { cartas: [estado.banca.cartas[0].codigo], oculta: true, total: null };
  }
  return {
    cartas: estado.banca.cartas.map((c) => c.codigo),
    oculta: false,
    total: calcularTotal(estado.banca.cartas),
  };
}

export function vistaPublica(estado) {
  return {
    version: estado.version,
    fase: estado.fase,
    turno: estado.turnoIndice == null ? null : estado.jugadores[estado.turnoIndice].userId,
    banca: vistaBanca(estado),
    jugadores: estado.jugadores.map((j) => ({
      userId: j.userId,
      asiento: j.asiento,
      controlador: j.controlador,
      fichas: j.fichas,
      apuesta: j.apuesta,
      cartas: j.cartas.map((c) => c.codigo),
      total: calcularTotal(j.cartas),
      terminado: j.terminado,
      motivo: j.motivo,
      desenlace: j.desenlace,
    })),
    resultado: estado.resultado,
  };
}

// Sin secretos por jugador (la mano es pública en blackjack): se mantiene
// por simetría con el resto de verticales, que sí la necesitan.
export function vistaPrivada(estado, _userId) {
  return vistaPublica(estado);
}

export function accionesPermitidas(estado, userId) {
  if (haTerminado(estado) || estado.turnoIndice == null) return [];
  const jugador = estado.jugadores[estado.turnoIndice];
  if (jugador.userId !== userId) return [];
  const acciones = ["pedir", "plantarse"];
  const puedeDoblar =
    jugador.cartas.length === CARTAS_PARA_DOBLAR && jugador.fichas >= jugador.apuesta * 2;
  if (puedeDoblar) acciones.push("doblar");
  return acciones;
}

export function haTerminado(estado) {
  return estado.fase === "terminada";
}

export function resultado(estado) {
  return estado.resultado ?? null;
}

// ---- Aplicación de acciones -----------------------------------------------

export function aplicar(estado, accion) {
  if (haTerminado(estado)) return { ok: false, codigo: ERRORES.MANO_TERMINADA };

  const { actorId, tipo } = accion ?? {};
  if (estado.turnoIndice == null || estado.jugadores[estado.turnoIndice].userId !== actorId) {
    return { ok: false, codigo: ERRORES.FUERA_DE_TURNO };
  }
  if (!accionesPermitidas(estado, actorId).includes(tipo)) {
    return { ok: false, codigo: ERRORES.ACCION_NO_PERMITIDA };
  }

  // Se trabaja sobre una copia: un reductor que muta su entrada deja al
  // coordinador sin el estado anterior al que volver cuando el motor rechaza.
  const siguiente = structuredClone(estado);
  if (tipo === "pedir") return pedir(siguiente);
  if (tipo === "plantarse") return plantarse(siguiente);
  return doblar(siguiente);
}

function pedir(estado) {
  const jugador = estado.jugadores[estado.turnoIndice];
  jugador.cartas.push(sacarCarta(estado));
  if (calcularTotal(jugador.cartas) > 21) {
    jugador.terminado = true;
    jugador.motivo = "bust";
    avanzarTurno(estado);
  }
  return { ok: true, estado };
}

function plantarse(estado) {
  const jugador = estado.jugadores[estado.turnoIndice];
  jugador.terminado = true;
  jugador.motivo = "plantado";
  avanzarTurno(estado);
  return { ok: true, estado };
}

function doblar(estado) {
  // `accionesPermitidas` ya exige fichas para el doble antes de ofrecer esta
  // acción: aquí no hace falta comprobarlo otra vez.
  const jugador = estado.jugadores[estado.turnoIndice];
  jugador.apuesta *= 2;
  jugador.cartas.push(sacarCarta(estado));
  jugador.terminado = true;
  jugador.motivo = calcularTotal(jugador.cartas) > 21 ? "bust" : "doblado";
  avanzarTurno(estado);
  return { ok: true, estado };
}

// ---- Resolución -------------------------------------------------------------

function siguienteActivo(jugadores, desde) {
  for (let indice = desde + 1; indice < jugadores.length; indice += 1) {
    if (!jugadores[indice].terminado) return indice;
  }
  return null;
}

function avanzarTurno(estado) {
  const siguiente = siguienteActivo(estado.jugadores, estado.turnoIndice);
  if (siguiente === null) {
    estado.turnoIndice = null;
    finalizarMano(estado);
  } else {
    estado.turnoIndice = siguiente;
  }
}

function sacarCarta(estado) {
  const { repartidas, resto } = repartir(estado.mazo, 1);
  estado.mazo = resto;
  return repartidas[0];
}

// Revela la banca y, salvo que ya tuviera blackjack de salida, la hace pedir
// hasta plantarse en 17 o más (regla fija: no vuelve a pedir con 17 blando).
// Determinista: la propia semilla de la mano decide qué cartas saca.
function finalizarMano(estado) {
  estado.banca.oculta = false;
  if (!estado.banca.blackjackInicial) {
    while (calcularTotal(estado.banca.cartas) < LIMITE_PLANTADO_BANCA) {
      estado.banca.cartas.push(sacarCarta(estado));
    }
  }
  estado.fase = "terminada";
  estado.turnoIndice = null;
  estado.resultado = calcularResultado(estado);
}

function calcularResultado(estado) {
  const bancaTotal = calcularTotal(estado.banca.cartas);
  const bancaBust = bancaTotal > 21;

  const jugadores = estado.jugadores.map((jugador) => {
    const total = calcularTotal(jugador.cartas);
    let desenlace;
    let ganancia;

    if (jugador.motivo === "bust") {
      desenlace = "pierde";
      ganancia = -jugador.apuesta;
    } else if (jugador.motivo === "blackjack" && estado.banca.blackjackInicial) {
      desenlace = "empate";
      ganancia = 0;
    } else if (jugador.motivo === "blackjack") {
      desenlace = "blackjack";
      ganancia = Math.floor(jugador.apuesta * PAGO_BLACKJACK);
    } else if (estado.banca.blackjackInicial) {
      desenlace = "pierde";
      ganancia = -jugador.apuesta;
    } else if (bancaBust) {
      desenlace = "gana";
      ganancia = jugador.apuesta;
    } else if (total > bancaTotal) {
      desenlace = "gana";
      ganancia = jugador.apuesta;
    } else if (total < bancaTotal) {
      desenlace = "pierde";
      ganancia = -jugador.apuesta;
    } else {
      desenlace = "empate";
      ganancia = 0;
    }

    jugador.fichas += ganancia;
    jugador.desenlace = desenlace;

    return {
      userId: jugador.userId,
      desenlace,
      ganancia,
      fichas: jugador.fichas,
      total,
      apuesta: jugador.apuesta,
    };
  });

  return {
    bancaTotal,
    bancaBust,
    bancaCartas: estado.banca.cartas.map((c) => c.codigo),
    jugadores,
  };
}
