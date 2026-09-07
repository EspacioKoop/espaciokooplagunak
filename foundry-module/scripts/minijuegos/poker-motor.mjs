// Motor puro de una mano de Texas Hold'em simplificado (#308). Implementa la
// interfaz interna que fija docs/MINIJUEGOS_FOUNDRY.md, de modo que la capa de
// sesión (identidad, revisión, época, transporte) pueda alojarlo sin conocer sus
// reglas:
//
//   crear(configuracion, semilla) -> estadoJuego
//   vistaPublica(estadoJuego) -> object
//   vistaPrivada(estadoJuego, userId) -> object
//   accionesPermitidas(estadoJuego, userId) -> [string]
//   aplicar(estadoJuego, accion) -> { ok, estado } | { ok:false, codigo }
//   haTerminado(estadoJuego) -> boolean
//   resultado(estadoJuego) -> object | null
//
// No toca Foundry, red, DOM, reloj ni Math.random(). Toda la aleatoriedad entra
// por `semilla`. El motor juega UNA mano: la mano siguiente es un nuevo `crear`
// con los stacks resultantes, responsabilidad de la capa de sesión.
//
// Simplificación consciente respecto a un casino: un all-in por debajo de la
// subida mínima reabre la ronda igual que una subida completa. Es coherente y
// termina siempre (los stacks son finitos); se documenta para no venderlo como
// póker de torneo reglado.

import { barajaMezclada, repartir } from "./naipes.mjs";
import { evaluarMano } from "./evaluador-manos.mjs";
import { repartirBotes } from "./pozos.mjs";

export const FASES = Object.freeze(["preflop", "flop", "turn", "river", "showdown", "terminada"]);
const CARTAS_POR_FASE = Object.freeze({ flop: 3, turn: 1, river: 1 });

export const ERRORES = Object.freeze({
  FUERA_DE_TURNO: "fuera_de_turno",
  ACCION_NO_PERMITIDA: "accion_no_permitida",
  MANO_TERMINADA: "mano_terminada",
  PARAMETRO_INVALIDO: "parametro_invalido",
  CARTA_YA_MOSTRADA: "carta_ya_mostrada",
});

// ---- Creación -------------------------------------------------------------

export function crear(configuracion, semilla) {
  const jugadoresConfig = configuracion?.jugadores ?? [];
  if (jugadoresConfig.length < 2 || jugadoresConfig.length > 6) {
    throw new RangeError("crear: se admiten de 2 a 6 jugadores");
  }
  const ciegaPequena = enteroPositivo(configuracion.ciegaPequena ?? 1, "ciegaPequena");
  const ciegaGrande = enteroPositivo(configuracion.ciegaGrande ?? ciegaPequena * 2, "ciegaGrande");
  const botonIndice = configuracion.botonIndice ?? 0;
  if (!Number.isInteger(botonIndice) || botonIndice < 0 || botonIndice >= jugadoresConfig.length) {
    throw new RangeError("botonIndice: debe ser el índice de un asiento de la mesa");
  }

  // La identidad de cada asiento sostiene la vista privada y la asociación
  // identidad↔asiento de la capa de sesión: sin unicidad, dos asientos
  // compartirían mano y actor.
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

  const jugadores = jugadoresConfig.map((j, indice) => {
    enteroPositivo(j.stack, "stack");
    return {
      userId: j.userId,
      asiento: indice,
      // "humano" (PC de un jugador) o "automatico" (NPC que resuelve su turno
      // solo, vía el agente automático). El motor trata a ambos igual; la
      // distinción la usa la capa de sesión para saber qué turnos automatizar.
      controlador: j.controlador === "automatico" ? "automatico" : "humano",
      stack: j.stack,
      apostadoRonda: 0,
      apostadoTotal: 0,
      retirado: false,
      allIn: false,
      haActuado: false,
    };
  });

  let mazo = barajaMezclada(semilla);
  const manos = {};
  for (const jugador of jugadores) {
    const { repartidas, resto } = repartir(mazo, 2);
    manos[jugador.userId] = repartidas;
    mazo = resto;
  }

  const estado = {
    version: 1,
    fase: "preflop",
    jugadores,
    botonIndice,
    ciegaPequena,
    ciegaGrande,
    comunitarias: [],
    apuestaActual: 0,
    subidaMinima: ciegaGrande,
    turnoIndice: null,
    mazo,
    manos,
    // Cartas de mano que su dueño ha mostrado voluntariamente (#458): no es una
    // acción de turno, es una revelación pública de una carta privada que el
    // motor sigue siendo el único autorizado a conceder — así una proyección de
    // escena nunca puede inventarse que una carta es visible.
    cartasMostradas: {},
    resultado: null,
  };

  // Ciegas. Con 2 jugadores el botón es la ciega pequeña (heads-up).
  const indiceSb = jugadores.length === 2 ? botonIndice : siguienteAsiento(estado, botonIndice);
  const indiceBb = siguienteAsiento(estado, indiceSb);
  apostar(estado, indiceSb, ciegaPequena);
  apostar(estado, indiceBb, ciegaGrande);
  estado.apuestaActual = ciegaGrande;

  // Primero en hablar en preflop: el siguiente a la ciega grande.
  estado.turnoIndice = siguientePuedeActuar(estado, indiceBb);
  // Si las ciegas ya han dejado a todo el mundo all-in, no hay acción posible:
  // se corre el tablero y se resuelve en el acto en vez de dejar la mano
  // congelada (turno null y sin terminar).
  if (estado.turnoIndice == null) {
    correrTableroYResolver(estado);
  }
  return estado;
}

// ---- Interfaz de vistas ---------------------------------------------------

export function vistaPublica(estado) {
  return {
    version: estado.version,
    fase: estado.fase,
    // El botón es público en cualquier mesa: se ve el disco. Y hace falta
    // fuera del motor, porque quien decide dónde empieza la mano SIGUIENTE es
    // la capa de mesa, y sin esto no tenía forma de saber dónde estaba en la
    // anterior — el botón se quedaba clavado y el mismo asiento pagaba la
    // ciega pequeña siempre.
    botonIndice: estado.botonIndice,
    comunitarias: estado.comunitarias.map(codigo),
    bote: bote(estado),
    apuestaActual: estado.apuestaActual,
    subidaMinima: estado.subidaMinima,
    turno: estado.turnoIndice == null ? null : estado.jugadores[estado.turnoIndice].userId,
    jugadores: estado.jugadores.map((j) => ({
      userId: j.userId,
      asiento: j.asiento,
      controlador: j.controlador,
      stack: j.stack,
      apostadoRonda: j.apostadoRonda,
      apostadoTotal: j.apostadoTotal,
      retirado: j.retirado,
      allIn: j.allIn,
    })),
    // Códigos reales: mostrar una carta la hace pública para todo el mundo, no
    // solo para quien la enseña — por eso vive en la vista pública y no en la
    // privada.
    cartasMostradas: cartasMostradasPublicas(estado),
    resultado: estado.resultado,
  };
}

function cartasMostradasPublicas(estado) {
  const salida = {};
  for (const [userId, indices] of Object.entries(estado.cartasMostradas)) {
    salida[userId] = indices.map((indice) => codigo(estado.manos[userId][indice]));
  }
  return salida;
}

export function vistaPrivada(estado, userId) {
  const publica = vistaPublica(estado);
  const mano = estado.manos[userId];
  return { ...publica, tuMano: mano ? mano.map(codigo) : null };
}

export function accionesPermitidas(estado, userId) {
  const acciones = [];
  if (puedeMostrar(estado, userId)) {
    acciones.push("mostrar");
  }
  if (haTerminado(estado) || estado.turnoIndice == null) {
    return acciones;
  }
  const jugador = estado.jugadores[estado.turnoIndice];
  if (jugador.userId !== userId) {
    return acciones;
  }
  acciones.push("fold");
  if (jugador.apostadoRonda === estado.apuestaActual) {
    acciones.push("check");
  } else if (jugador.stack > 0) {
    acciones.push("call");
  }
  // Se puede subir mientras queden fichas para superar la apuesta actual.
  if (jugador.stack > 0 && jugador.stack + jugador.apostadoRonda > estado.apuestaActual) {
    acciones.push("raise");
  }
  return acciones;
}

// "mostrar" es voluntaria y no de turno: cualquier jugador con cartas en la
// mano puede enseñarlas en cualquier momento, no solo el que actúa. Solo se
// cierra cuando la mano termina (ya no hay una mesa a la que enseñar nada) o
// cuando el jugador se ha retirado (mostraría una mano que ya no compite).
function puedeMostrar(estado, userId) {
  if (haTerminado(estado)) {
    return false;
  }
  const jugador = estado.jugadores.find((j) => j.userId === userId);
  return Boolean(jugador && !jugador.retirado);
}

export function haTerminado(estado) {
  return estado.fase === "terminada";
}

export function resultado(estado) {
  return estado.resultado ?? null;
}

// ---- Aplicación de acciones ----------------------------------------------

export function aplicar(estado, accion) {
  if (haTerminado(estado)) {
    return { ok: false, codigo: ERRORES.MANO_TERMINADA };
  }
  const { actorId, tipo, parametros } = accion ?? {};

  if (tipo === "mostrar") {
    return aplicarMostrar(estado, actorId, parametros);
  }

  if (estado.turnoIndice == null || estado.jugadores[estado.turnoIndice].userId !== actorId) {
    return { ok: false, codigo: ERRORES.FUERA_DE_TURNO };
  }
  if (!accionesPermitidas(estado, actorId).includes(tipo)) {
    return { ok: false, codigo: ERRORES.ACCION_NO_PERMITIDA };
  }

  const siguiente = clonar(estado);
  const jugador = siguiente.jugadores[siguiente.turnoIndice];

  if (tipo === "fold") {
    jugador.retirado = true;
    jugador.haActuado = true;
  } else if (tipo === "check") {
    jugador.haActuado = true;
  } else if (tipo === "call") {
    apostar(siguiente, jugador.asiento, siguiente.apuestaActual - jugador.apostadoRonda);
    jugador.haActuado = true;
  } else if (tipo === "raise") {
    const error = aplicarSubida(siguiente, jugador, parametros);
    if (error) {
      return { ok: false, codigo: error };
    }
  }

  avanzar(siguiente);
  return { ok: true, estado: siguiente };
}

// Revelación voluntaria de una carta de mano (#458). No pasa por `clonar` +
// `avanzar` como las acciones de turno: no consume el turno de nadie ni cierra
// ronda, así que el estado devuelto conserva el turno que hubiera.
function aplicarMostrar(estado, actorId, parametros) {
  if (!puedeMostrar(estado, actorId)) {
    return { ok: false, codigo: ERRORES.ACCION_NO_PERMITIDA };
  }
  const indice = Number(parametros?.indice);
  const mano = estado.manos[actorId];
  if (!Number.isInteger(indice) || indice < 0 || indice >= mano.length) {
    return { ok: false, codigo: ERRORES.PARAMETRO_INVALIDO };
  }
  const yaMostradas = estado.cartasMostradas[actorId] ?? [];
  if (yaMostradas.includes(indice)) {
    return { ok: false, codigo: ERRORES.CARTA_YA_MOSTRADA };
  }
  const siguiente = clonar(estado);
  siguiente.cartasMostradas[actorId] = [...yaMostradas, indice];
  return { ok: true, estado: siguiente };
}

function aplicarSubida(estado, jugador, parametros) {
  const maximo = jugador.stack + jugador.apostadoRonda;
  let hasta = Number(parametros?.hasta);
  if (!Number.isInteger(hasta) || hasta <= estado.apuestaActual) {
    return ERRORES.PARAMETRO_INVALIDO;
  }
  const esAllIn = hasta >= maximo;
  if (esAllIn) {
    hasta = maximo;
  } else if (hasta < estado.apuestaActual + estado.subidaMinima) {
    // Subida por debajo del mínimo y sin ser all-in: no permitida.
    return ERRORES.PARAMETRO_INVALIDO;
  }

  const incremento = hasta - estado.apuestaActual;
  apostar(estado, jugador.asiento, hasta - jugador.apostadoRonda);
  estado.subidaMinima = Math.max(estado.subidaMinima, incremento);
  estado.apuestaActual = hasta;
  // Una subida reabre la ronda: los demás activos deben responder.
  for (const otro of estado.jugadores) {
    if (!otro.retirado && !otro.allIn && otro !== jugador) {
      otro.haActuado = false;
    }
  }
  jugador.haActuado = true;
  return null;
}

// Hace avanzar la mano tras una acción: cierra por abandono, pasa de calle o
// llega al showdown.
function avanzar(estado) {
  const enMano = estado.jugadores.filter((j) => !j.retirado);
  if (enMano.length === 1) {
    cerrarPorAbandono(estado, enMano[0]);
    return;
  }
  if (!rondaCompleta(estado)) {
    estado.turnoIndice = siguientePuedeActuar(estado, estado.turnoIndice);
    return;
  }

  // Ronda cerrada. Si ya nadie puede seguir apostando, se reparte el resto del
  // tablero sin más apuestas hasta el showdown.
  const puedenActuar = estado.jugadores.filter((j) => !j.retirado && !j.allIn);
  if (estado.fase === "river" || puedenActuar.length <= 1) {
    correrTableroYResolver(estado);
    return;
  }
  pasarDeCalle(estado);
}

// Reparte lo que falte del tablero sin abrir más rondas y resuelve el showdown.
function correrTableroYResolver(estado) {
  while (estado.fase !== "river" && estado.comunitarias.length < 5) {
    repartirCalleSilenciosa(estado);
  }
  showdown(estado);
}

function pasarDeCalle(estado) {
  const orden = ["preflop", "flop", "turn", "river"];
  const nuevaFase = orden[orden.indexOf(estado.fase) + 1];
  entregarComunitarias(estado, nuevaFase);
  estado.fase = nuevaFase;
  estado.apuestaActual = 0;
  estado.subidaMinima = estado.ciegaGrande;
  for (const jugador of estado.jugadores) {
    jugador.apostadoRonda = 0;
    jugador.haActuado = false;
  }
  // Postflop habla primero el primer activo tras el botón.
  estado.turnoIndice = siguientePuedeActuar(estado, estado.botonIndice);
}

// Reparte las comunitarias de una fase sin abrir ronda (cuando ya no hay
// apuestas posibles y se corre el tablero hasta el showdown).
function repartirCalleSilenciosa(estado) {
  const orden = ["preflop", "flop", "turn", "river"];
  const nuevaFase = orden[orden.indexOf(estado.fase) + 1];
  entregarComunitarias(estado, nuevaFase);
  estado.fase = nuevaFase;
}

function entregarComunitarias(estado, fase) {
  const cantidad = CARTAS_POR_FASE[fase] ?? 0;
  if (cantidad === 0) {
    return;
  }
  const { repartidas, resto } = repartir(estado.mazo, cantidad);
  estado.comunitarias.push(...repartidas);
  estado.mazo = resto;
}

function cerrarPorAbandono(estado, ganador) {
  const total = bote(estado);
  const jugadorGanador = estado.jugadores.find((j) => j.userId === ganador.userId);
  jugadorGanador.stack += total;
  vaciarComprometido(estado);
  estado.fase = "terminada";
  estado.turnoIndice = null;
  estado.resultado = {
    tipo: "sin-rival",
    ganadorId: ganador.userId,
    ganancia: total,
    stacksFinales: stacksFinales(estado),
  };
}

function showdown(estado) {
  const enMano = estado.jugadores.filter((j) => !j.retirado);
  const evaluaciones = new Map();
  const manosReveladas = {};
  for (const jugador of enMano) {
    const cartas = [...estado.manos[jugador.userId], ...estado.comunitarias];
    const punt = evaluarMano(cartas);
    evaluaciones.set(jugador.userId, punt);
    manosReveladas[jugador.userId] = {
      cartas: estado.manos[jugador.userId].map(codigo),
      mano: punt.nombre,
    };
  }

  const { ganancias, capas } = repartirBotes(estado.jugadores, evaluaciones);
  for (const jugador of estado.jugadores) {
    jugador.stack += ganancias.get(jugador.userId) ?? 0;
  }
  vaciarComprometido(estado);

  estado.fase = "terminada";
  estado.turnoIndice = null;
  estado.resultado = {
    tipo: "showdown",
    tablero: estado.comunitarias.map(codigo),
    manos: manosReveladas,
    ganancias: Object.fromEntries(ganancias),
    botes: capas,
    stacksFinales: stacksFinales(estado),
  };
}

// ---- Utilidades internas --------------------------------------------------

function rondaCompleta(estado) {
  const pendientes = estado.jugadores.filter(
    (j) => !j.retirado && !j.allIn && (!j.haActuado || j.apostadoRonda !== estado.apuestaActual),
  );
  return pendientes.length === 0;
}

function apostar(estado, indice, cantidad) {
  const jugador = estado.jugadores[indice];
  const real = Math.min(Math.max(cantidad, 0), jugador.stack);
  jugador.stack -= real;
  jugador.apostadoRonda += real;
  jugador.apostadoTotal += real;
  if (jugador.stack === 0) {
    jugador.allIn = true;
  }
  return real;
}

// Siguiente asiento ocupado (cíclico), esté o no activo. Para colocar ciegas.
function siguienteAsiento(estado, desde) {
  const n = estado.jugadores.length;
  return (desde + 1) % n;
}

// Siguiente jugador que puede actuar (no retirado, no all-in), o null si nadie.
function siguientePuedeActuar(estado, desde) {
  const n = estado.jugadores.length;
  for (let paso = 1; paso <= n; paso += 1) {
    const indice = (desde + paso) % n;
    const jugador = estado.jugadores[indice];
    if (!jugador.retirado && !jugador.allIn) {
      return indice;
    }
  }
  return null;
}

function bote(estado) {
  return estado.jugadores.reduce((suma, j) => suma + j.apostadoTotal, 0);
}

// Al resolver la mano, las fichas del bote pasan a los stacks; se pone a cero lo
// comprometido para que el bote quede vacío y no se contabilice dos veces.
function vaciarComprometido(estado) {
  for (const jugador of estado.jugadores) {
    jugador.apostadoRonda = 0;
    jugador.apostadoTotal = 0;
  }
}

function stacksFinales(estado) {
  return Object.fromEntries(estado.jugadores.map((j) => [j.userId, j.stack]));
}

function codigo(carta) {
  return carta.codigo;
}

function clonar(estado) {
  return structuredClone(estado);
}

function enteroPositivo(valor, nombre) {
  if (!Number.isInteger(valor) || valor <= 0) {
    throw new RangeError(`${nombre}: debe ser un entero positivo`);
  }
  return valor;
}
