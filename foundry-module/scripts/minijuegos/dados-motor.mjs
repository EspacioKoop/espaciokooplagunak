// Motor puro de una ronda de DADOS DE CUBILETE (#413), segundo vertical del
// sistema de minijuegos sociales. Implementa la misma interfaz interna que fija
// docs/MINIJUEGOS_FOUNDRY.md y que ya cumple `poker-motor.mjs`:
//
//   crear(configuracion, semilla) -> estadoJuego
//   vistaPublica(estadoJuego) -> object
//   vistaPrivada(estadoJuego, userId) -> object
//   accionesPermitidas(estadoJuego, userId) -> [string]
//   aplicar(estadoJuego, accion) -> { ok, estado } | { ok:false, codigo }
//   haTerminado(estadoJuego) -> boolean
//   resultado(estadoJuego) -> object | null
//
// POR QUÉ ES UN MOTOR NUEVO Y NO UN PÓKER REPINTADO. Lo que se comparte entre
// minijuegos ya está fuera: identidad, época, nonces, lobby, espectadores,
// ausencias y cancelación segura viven en `sesion-motor.mjs`, y la aleatoriedad
// determinista en `aleatorio.mjs`. Lo que cambia son las REGLAS, y por eso este
// módulo es hermano de `poker-motor.mjs` y no una rama dentro de él: meter dos
// juegos en un reductor obligaría a cada regla a preguntar de qué juego habla.
//
// El motor juega UNA ronda —hasta que alguien pierde un dado—. Quién sigue con
// cuántos dados y si la partida continúa es de la capa de sesión, igual que en
// póker con las fichas: `crear` recibe los dados que cada asiento trae.
//
// Puro: ni Foundry, ni red, ni DOM, ni reloj, ni Math.random(). Toda la
// aleatoriedad entra por `semilla`.
//
// PRIVACIDAD. El cubilete es información privada de su dueño exactamente como
// una mano de cartas, con el mismo límite honesto del contrato: es privacidad de
// interfaz, no secreto criptográfico frente a un cliente con herramientas de
// desarrollo. Ningún cubilete vivo aparece en `vistaPublica` hasta el destape.

import { crearAleatorio } from "./aleatorio.mjs";

/** Caras de un dado de seis. La cara 1 es la que puede hacer de comodín. */
export const CARAS = Object.freeze([1, 2, 3, 4, 5, 6]);

export const FASES = Object.freeze(["apuestas", "terminada"]);

export const ERRORES = Object.freeze({
  FUERA_DE_TURNO: "fuera_de_turno",
  ACCION_NO_PERMITIDA: "accion_no_permitida",
  RONDA_TERMINADA: "ronda_terminada",
  PARAMETRO_INVALIDO: "parametro_invalido",
  APUESTA_NO_SUPERA: "apuesta_no_supera",
});

export const DADOS_POR_JUGADOR = 5;
const MAX_DADOS = 6;

// ---- Creación -------------------------------------------------------------

/**
 * `configuracion`:
 *   jugadores: [{ userId, dados, controlador }]  — `dados` es cuántos le quedan.
 *   turnoInicialIndice: quién abre la ronda (la capa de mesa lo rota).
 *   unosComodin: si los unos cuentan como cualquier cara (por defecto, sí).
 */
export function crear(configuracion, semilla) {
  const jugadoresConfig = configuracion?.jugadores ?? [];
  if (jugadoresConfig.length < 2 || jugadoresConfig.length > 6) {
    throw new RangeError("crear: se admiten de 2 a 6 jugadores");
  }

  // Misma invariante que en póker, y por la misma razón: la vista privada se
  // entrega POR IDENTIDAD, así que dos asientos con el mismo `userId`
  // compartirían cubilete y turno.
  const vistos = new Set();
  for (const j of jugadoresConfig) {
    if (typeof j?.userId !== "string" || j.userId === "") {
      throw new RangeError("userId: cada jugador necesita un identificador no vacío");
    }
    if (vistos.has(j.userId)) {
      throw new RangeError(`userId: identidad duplicada en la mesa (${j.userId})`);
    }
    vistos.add(j.userId);
  }

  const turnoInicialIndice = configuracion?.turnoInicialIndice ?? 0;
  if (
    !Number.isInteger(turnoInicialIndice)
    || turnoInicialIndice < 0
    || turnoInicialIndice >= jugadoresConfig.length
  ) {
    throw new RangeError("turnoInicialIndice: debe ser el índice de un asiento de la mesa");
  }

  const unosComodin = configuracion?.unosComodin !== false;

  const jugadores = jugadoresConfig.map((j, indice) => {
    const dados = j.dados ?? DADOS_POR_JUGADOR;
    if (!Number.isInteger(dados) || dados < 0 || dados > MAX_DADOS) {
      throw new RangeError(`dados: ${j.userId} necesita un entero entre 0 y ${MAX_DADOS}`);
    }
    return {
      userId: j.userId,
      asiento: indice,
      // Misma distinción que en póker: al motor le da igual, la usa la capa de
      // sesión para saber qué turnos resuelve la máquina.
      controlador: j.controlador === "automatico" ? "automatico" : "humano",
      dados,
      // Sin dados no se tira ni se habla: se sigue sentado mirando, que es lo
      // que hace esta capa social con quien se queda a cero en póker.
      eliminado: dados === 0,
    };
  });

  if (jugadores.filter((j) => !j.eliminado).length < 2) {
    throw new RangeError("crear: hacen falta al menos dos jugadores con dados");
  }

  const aleatorio = crearAleatorio(semilla);
  const cubiletes = {};
  for (const jugador of jugadores) {
    // El orden de tirada es el de asiento y no el del turno: así la misma
    // semilla da la misma mesa aunque la ronda la abra otro, que es lo que hace
    // reproducible una partida sembrada de principio a fin.
    cubiletes[jugador.userId] = Array.from(
      { length: jugador.dados },
      () => aleatorio.enteroEntre(1, 6),
    );
  }

  const estado = {
    version: 1,
    fase: "apuestas",
    jugadores,
    unosComodin,
    cubiletes,
    // La apuesta viva: `{ cantidad, cara, userId }`. Nula al abrir la ronda.
    apuesta: null,
    turnoIndice: siguienteVivo(jugadores, turnoInicialIndice - 1),
    // Solo se rellena al destapar; hasta entonces nadie ve un cubilete ajeno.
    destape: null,
    resultado: null,
  };

  return estado;
}

// ---- Vistas ---------------------------------------------------------------

export function vistaPublica(estado) {
  return {
    version: estado.version,
    fase: estado.fase,
    unosComodin: estado.unosComodin,
    apuesta: estado.apuesta ? { ...estado.apuesta } : null,
    turno: estado.turnoIndice == null ? null : estado.jugadores[estado.turnoIndice].userId,
    // Cuántos dados hay sobre la mesa es público —de ahí sale si una apuesta es
    // creíble— pero QUÉ dados hay no lo es hasta el destape.
    dadosEnJuego: estado.jugadores.reduce((suma, j) => suma + j.dados, 0),
    jugadores: estado.jugadores.map((j) => ({
      userId: j.userId,
      asiento: j.asiento,
      controlador: j.controlador,
      dados: j.dados,
      eliminado: j.eliminado,
    })),
    destape: estado.destape ? estructuraClonada(estado.destape) : null,
    resultado: estado.resultado,
  };
}

export function vistaPrivada(estado, userId) {
  const publica = vistaPublica(estado);
  const cubilete = estado.cubiletes[userId];
  return { ...publica, tuCubilete: cubilete ? [...cubilete] : null };
}

export function accionesPermitidas(estado, userId) {
  if (haTerminado(estado) || estado.turnoIndice == null) return [];
  const jugador = estado.jugadores[estado.turnoIndice];
  if (jugador.userId !== userId) return [];
  // Abrir la ronda solo permite apostar: dudar de una apuesta que no existe no
  // significa nada, y devolverlo como acción obligaría a la UI a pintar un botón
  // que siempre falla.
  return estado.apuesta ? ["apostar", "dudar"] : ["apostar"];
}

export function haTerminado(estado) {
  return estado.fase === "terminada";
}

export function resultado(estado) {
  return estado.resultado ?? null;
}

// ---- Reglas de la apuesta -------------------------------------------------

/**
 * Una apuesta sube si promete MÁS dados de una cara, o los mismos de una cara
 * más alta. Es la regla que hace que la ronda termine: la escalada es finita
 * porque el número de dados sobre la mesa lo es.
 */
export function superaApuesta(nueva, previa) {
  if (!previa) return true;
  if (nueva.cantidad > previa.cantidad) return true;
  return nueva.cantidad === previa.cantidad && nueva.cara > previa.cara;
}

/**
 * Cuántos dados de una cara hay de verdad. Con `unosComodin`, los unos valen por
 * cualquier cara —salvo cuando la apuesta ES de unos, que entonces ya se están
 * contando ellos mismos y sumarlos dos veces sería contar de más—.
 */
export function contarCara(cubiletes, cara, unosComodin) {
  let total = 0;
  for (const dados of Object.values(cubiletes)) {
    for (const dado of dados) {
      if (dado === cara || (unosComodin && cara !== 1 && dado === 1)) total += 1;
    }
  }
  return total;
}

// ---- Aplicación de acciones ----------------------------------------------

export function aplicar(estado, accion) {
  if (haTerminado(estado)) return { ok: false, codigo: ERRORES.RONDA_TERMINADA };

  const { actorId, tipo, parametros } = accion ?? {};
  if (estado.turnoIndice == null || estado.jugadores[estado.turnoIndice].userId !== actorId) {
    return { ok: false, codigo: ERRORES.FUERA_DE_TURNO };
  }
  if (!accionesPermitidas(estado, actorId).includes(tipo)) {
    return { ok: false, codigo: ERRORES.ACCION_NO_PERMITIDA };
  }

  // Se trabaja sobre una copia: un reductor que muta su entrada deja al
  // coordinador sin el estado anterior al que volver cuando el motor rechaza.
  const siguiente = estructuraClonada(estado);
  if (tipo === "apostar") return apostar(siguiente, actorId, parametros);
  return dudar(siguiente, actorId);
}

function apostar(estado, actorId, parametros) {
  const cantidad = parametros?.cantidad;
  const cara = parametros?.cara;
  if (!Number.isInteger(cantidad) || cantidad < 1) {
    return { ok: false, codigo: ERRORES.PARAMETRO_INVALIDO };
  }
  if (!CARAS.includes(cara)) {
    return { ok: false, codigo: ERRORES.PARAMETRO_INVALIDO };
  }
  // Prometer más dados de los que hay no es un farol, es una apuesta que nadie
  // puede ganar: se rechaza cerrada en vez de dejar que alguien se suicide por
  // erratas de teclado.
  const enJuego = estado.jugadores.reduce((suma, j) => suma + j.dados, 0);
  if (cantidad > enJuego) return { ok: false, codigo: ERRORES.PARAMETRO_INVALIDO };

  const nueva = { cantidad, cara, userId: actorId };
  if (!superaApuesta(nueva, estado.apuesta)) {
    return { ok: false, codigo: ERRORES.APUESTA_NO_SUPERA };
  }

  estado.apuesta = nueva;
  estado.turnoIndice = siguienteVivo(estado.jugadores, estado.turnoIndice);
  return { ok: true, estado };
}

function dudar(estado, actorId) {
  const apuesta = estado.apuesta;
  const reales = contarCara(estado.cubiletes, apuesta.cara, estado.unosComodin);
  // La apuesta se sostiene si hay AL MENOS lo prometido: quien duda de una
  // apuesta cumplida paga él.
  const apuestaSostenida = reales >= apuesta.cantidad;
  const perdedorId = apuestaSostenida ? actorId : apuesta.userId;

  estado.destape = {
    apuesta: { ...apuesta },
    reales,
    apuestaSostenida,
    dudadorId: actorId,
    perdedorId,
    // Todos los cubiletes, ya sin secreto: la ronda ha terminado y el destape es
    // lo que hace comprobable el resultado para la mesa y para los espectadores.
    cubiletes: Object.fromEntries(
      Object.entries(estado.cubiletes).map(([userId, dados]) => [userId, [...dados]]),
    ),
  };

  const perdedor = estado.jugadores.find((j) => j.userId === perdedorId);
  perdedor.dados -= 1;
  if (perdedor.dados === 0) perdedor.eliminado = true;

  estado.fase = "terminada";
  estado.turnoIndice = null;
  estado.resultado = {
    perdedorId,
    dudadorId: actorId,
    apuesta: { ...apuesta },
    reales,
    apuestaSostenida,
    // Con quién sigue vivo, la capa de mesa sabe si monta otra ronda o si la
    // partida ha terminado; el motor no decide eso porque no ve más que su ronda.
    dados: Object.fromEntries(estado.jugadores.map((j) => [j.userId, j.dados])),
    vivos: estado.jugadores.filter((j) => !j.eliminado).map((j) => j.userId),
  };
  return { ok: true, estado };
}

// ---- Utilidades -----------------------------------------------------------

/**
 * Siguiente asiento con dados, dando la vuelta a la mesa. Devuelve `null` si no
 * queda ninguno, que en una ronda válida no puede pasar —`crear` exige dos— pero
 * se contempla antes que devolver un índice inventado.
 */
function siguienteVivo(jugadores, desde) {
  for (let paso = 1; paso <= jugadores.length; paso += 1) {
    const indice = (desde + paso + jugadores.length) % jugadores.length;
    if (!jugadores[indice].eliminado) return indice;
  }
  return null;
}

function estructuraClonada(valor) {
  return structuredClone(valor);
}
