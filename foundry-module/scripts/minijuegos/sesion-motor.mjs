// Motor puro de sesión de minijuegos sociales (#308), paso 1 del orden de
// implementación de docs/MINIJUEGOS_FOUNDRY.md. Resuelve lo que es común a
// cualquier vertical —identidad, revisión, época del coordinador, nonces,
// lobby, espectadores, ausencias y cancelación segura— y aloja el juego
// concreto POR SU INTERFAZ interna:
//
//   crear(configuracion, semilla) -> estadoJuego
//   vistaPublica(estadoJuego) -> object
//   vistaPrivada(estadoJuego, userId) -> object
//   accionesPermitidas(estadoJuego, userId) -> [string]
//   aplicar(estadoJuego, { actorId, tipo, parametros }) -> { ok, estado } | { ok:false, codigo }
//   haTerminado(estadoJuego) -> boolean
//   resultado(estadoJuego) -> object | null
//
// No conoce el póker ni ningún otro juego: recibe ese módulo como dependencia.
// No toca Foundry, red, DOM, reloj ni Math.random(); toda la aleatoriedad entra
// como `semilla` desde el coordinador.
//
// IDENTIDAD: `actorId` SIEMPRE llega como argumento separado, resuelto por el
// adaptador desde el evento autenticado de Foundry (el patrón de #237: el
// documento `User` que el servidor autorizó a escribir). Cualquier `userId` o
// `actorId` que viniera DENTRO del sobre de acción se ignora por diseño; este
// módulo nunca lo lee. Es la misma regla que en station-order-relay.mjs.

export const FASES_SESION = Object.freeze(["lobby", "en_curso", "terminada"]);

export const ACCIONES = Object.freeze([
  "join",
  "watch",
  "leave",
  "start",
  "act",
  "finish",
  "close",
]);

export const ERRORES = Object.freeze({
  SESION_DESCONOCIDA: "sesion_desconocida",
  EPOCA_OBSOLETA: "epoca_obsoleta",
  REVISION_OBSOLETA: "revision_obsoleta",
  ACCION_DESCONOCIDA: "accion_desconocida",
  PAYLOAD_INVALIDO: "payload_invalido",
  SIN_IDENTIDAD: "sin_identidad",
  NO_AUTORIZADO: "no_autorizado",
  FASE_INVALIDA: "fase_invalida",
  MESA_LLENA: "mesa_llena",
  AFORO_COMPLETO: "aforo_completo",
  YA_EN_MESA: "ya_en_mesa",
  NO_PARTICIPA: "no_participa",
  SIN_SEMILLA: "sin_semilla",
  NONCE_REUTILIZADO: "nonce_reutilizado",
  JUEGO_RECHAZO: "juego_rechazo",
});

export const LIMITES_POR_DEFECTO = Object.freeze({
  maxJugadores: 6,
  minJugadores: 2,
  maxEspectadores: 20,
  maxCadena: 64,
  maxClavesParametros: 16,
  maxNonces: 128,
});

// ---- Creación -------------------------------------------------------------

export function crearSesion({ id, juego, anfitrionId, coordinadorId, limites = {} } = {}) {
  cadenaObligatoria(id, "id");
  cadenaObligatoria(juego, "juego");
  cadenaObligatoria(anfitrionId, "anfitrionId");
  cadenaObligatoria(coordinadorId, "coordinadorId");
  const config = { ...LIMITES_POR_DEFECTO, ...limites };
  if (config.minJugadores < 1 || config.maxJugadores < config.minJugadores) {
    throw new RangeError("limites: rango de jugadores inválido");
  }

  return {
    publico: {
      version: 1,
      id,
      juego,
      fase: "lobby",
      revision: 0,
      epocaCoordinador: 0,
      coordinadorId,
      anfitrionId,
      jugadores: [],
      espectadores: [],
      checkpointMano: null,
      juegoPublico: null,
      resultado: null,
      manoEnCurso: false,
      limites: config,
    },
    // Solo vive en memoria del coordinador. El adaptador no lo escribe en
    // Documents, flags, ajustes ni sockets de difusión: contiene la semilla y,
    // dentro de `estadoJuego`, mazo y manos.
    privado: {
      epocaCoordinador: 0,
      semilla: null,
      estadoJuego: null,
      nonces: [],
    },
  };
}

// ---- Vistas ---------------------------------------------------------------

// Estado compartido: nunca incluye secretos. `juegoPublico` sale de la
// vistaPublica del juego alojado, no del estado interno.
export function vistaPublicaSesion(sesion) {
  return estructuraClonada(sesion.publico);
}

// Vista dirigida a un `userId` autenticado. Solo un jugador sentado recibe su
// parte privada; espectadores y ajenos reciben exactamente la pública.
export function vistaPrivadaSesion(sesion, userId, juego) {
  const publica = vistaPublicaSesion(sesion);
  const estadoJuego = sesion.privado.estadoJuego;
  if (!estadoJuego || !esJugador(sesion, userId)) {
    return publica;
  }
  return { ...publica, juegoPrivado: juego.vistaPrivada(estadoJuego, userId) };
}

export function accionesPermitidas(sesion, userId, juego) {
  const { publico } = sesion;
  if (publico.fase === "terminada") return [];
  const dentro = esParticipante(sesion, userId);
  const acciones = [
    ...(publico.fase === "lobby" && !dentro && hayAsiento(sesion) ? ["join"] : []),
    ...(!dentro && hayAforo(sesion) ? ["watch"] : []),
    ...(dentro ? ["leave"] : []),
    ...accionesDeJuego(sesion, userId, juego),
    ...(puedeIniciar(sesion, userId) ? ["start"] : []),
    ...(puedeCerrar(sesion, userId) ? ["finish", "close"] : []),
  ];
  // En lobby no hay nada que rematar: `finish` publica el resultado de una mano
  // que todavía no se ha jugado.
  return publico.fase === "lobby" ? acciones.filter((a) => a !== "finish") : acciones;
}

// Las acciones del juego alojado se exponen con prefijo `act:` para que la UI
// distinga lo que es del marco de lo que es del vertical.
function accionesDeJuego(sesion, userId, juego) {
  const { publico, privado } = sesion;
  if (!publico.manoEnCurso || !privado.estadoJuego || !esJugadorActivo(sesion, userId)) {
    return [];
  }
  return juego.accionesPermitidas(privado.estadoJuego, userId).map((tipo) => `act:${tipo}`);
}

// ---- Reductor -------------------------------------------------------------

// Aplica un sobre de acción. `actorId` es la identidad autenticada y llega
// SEPARADA del sobre; el sobre nunca la declara.
//
//   aplicar(sesion, { sobre, actorId, juego, semilla, configuracionJuego })
//
// Devuelve `{ ok: true, sesion, idempotente? }` o `{ ok: false, codigo }`. Un
// rechazo no modifica estado, revisión ni nonces.
export function aplicar(sesion, { sobre, actorId, juego, semilla, configuracionJuego } = {}) {
  const { publico, privado } = sesion;

  if (typeof actorId !== "string" || actorId === "") {
    return { ok: false, codigo: ERRORES.SIN_IDENTIDAD };
  }
  const invalido = validarSobre(sobre, publico.limites);
  if (invalido) return { ok: false, codigo: invalido };
  if (sobre.sessionId !== publico.id) {
    return { ok: false, codigo: ERRORES.SESION_DESCONOCIDA };
  }
  // La época se comprueba antes que el nonce: un sobre de una época cancelada
  // no puede colarse como repetición idempotente de la vigente.
  if (sobre.epocaCoordinador !== publico.epocaCoordinador) {
    return { ok: false, codigo: ERRORES.EPOCA_OBSOLETA };
  }
  // El nonce va ligado a la huella de SU petición: reenviar el sobre idéntico
  // es idempotente, pero reutilizar el nonce para otra acción es un error
  // explícito y no un éxito silencioso que descarta la petición nueva.
  const huella = huellaSobre(sobre);
  const previo = nonceProcesado(privado, actorId, sobre.nonce);
  if (previo) {
    if (previo.huella !== huella) {
      return { ok: false, codigo: ERRORES.NONCE_REUTILIZADO };
    }
    // Reintento del mismo actor dentro de la época: no reaplica ni sube
    // revisión. El adaptador puede reenviar sin miedo tras una desconexión.
    return { ok: true, sesion, idempotente: true };
  }
  if (sobre.revisionEsperada != null && sobre.revisionEsperada !== publico.revision) {
    return { ok: false, codigo: ERRORES.REVISION_OBSOLETA };
  }
  if (publico.fase === "terminada") {
    return { ok: false, codigo: ERRORES.FASE_INVALIDA };
  }

  const siguiente = clonar(sesion);
  const resultado = despachar(siguiente, {
    tipo: sobre.tipo,
    parametros: sobre.parametros ?? {},
    actorId,
    juego,
    semilla,
    configuracionJuego,
  });
  if (!resultado.ok) return resultado;

  // Una acción aceptada sube la revisión exactamente una vez y consume su nonce.
  siguiente.publico.revision += 1;
  registrarNonce(
    siguiente.privado,
    actorId,
    sobre.nonce,
    huella,
    siguiente.publico.limites.maxNonces,
  );
  return { ok: true, sesion: siguiente };
}

function despachar(sesion, ctx) {
  switch (ctx.tipo) {
    case "join":
      return accionJoin(sesion, ctx);
    case "watch":
      return accionWatch(sesion, ctx);
    case "leave":
      return accionLeave(sesion, ctx);
    case "start":
      return accionStart(sesion, ctx);
    case "act":
      return accionAct(sesion, ctx);
    case "finish":
      return accionFinish(sesion, ctx);
    case "close":
      return accionClose(sesion, ctx);
    default:
      return { ok: false, codigo: ERRORES.ACCION_DESCONOCIDA };
  }
}

function accionJoin(sesion, { actorId }) {
  const { publico } = sesion;
  if (publico.fase !== "lobby") return { ok: false, codigo: ERRORES.FASE_INVALIDA };
  if (esParticipante(sesion, actorId)) return { ok: false, codigo: ERRORES.YA_EN_MESA };
  if (!hayAsiento(sesion)) return { ok: false, codigo: ERRORES.MESA_LLENA };
  publico.jugadores.push({ userId: actorId, asiento: publico.jugadores.length, estado: "activo" });
  return { ok: true };
}

function accionWatch(sesion, { actorId }) {
  const { publico } = sesion;
  if (esJugador(sesion, actorId)) return { ok: false, codigo: ERRORES.YA_EN_MESA };
  if (publico.espectadores.includes(actorId)) return { ok: false, codigo: ERRORES.YA_EN_MESA };
  if (!hayAforo(sesion)) return { ok: false, codigo: ERRORES.AFORO_COMPLETO };
  publico.espectadores.push(actorId);
  return { ok: true };
}

// En lobby, abandonar libera el asiento. En partida NO lo libera ni revela nada:
// deja al jugador `ausente`, para que su identidad no pueda ser reclamada por
// otro y pueda reconectar al mismo asiento.
function accionLeave(sesion, { actorId }) {
  const { publico } = sesion;
  const espectador = publico.espectadores.indexOf(actorId);
  if (espectador >= 0) {
    publico.espectadores.splice(espectador, 1);
    return { ok: true };
  }
  const jugador = publico.jugadores.find((j) => j.userId === actorId);
  if (!jugador) return { ok: false, codigo: ERRORES.NO_PARTICIPA };
  if (publico.fase === "lobby") {
    publico.jugadores = publico.jugadores
      .filter((j) => j.userId !== actorId)
      .map((j, indice) => ({ ...j, asiento: indice }));
    return { ok: true };
  }
  jugador.estado = "ausente";
  return { ok: true };
}

function accionStart(sesion, { actorId, juego, semilla, configuracionJuego }) {
  const { publico } = sesion;
  if (!esAnfitrionOGm(sesion, actorId)) return { ok: false, codigo: ERRORES.NO_AUTORIZADO };
  if (publico.manoEnCurso) return { ok: false, codigo: ERRORES.FASE_INVALIDA };
  if (publico.jugadores.length < publico.limites.minJugadores) {
    return { ok: false, codigo: ERRORES.FASE_INVALIDA };
  }
  if (!Number.isInteger(semilla)) return { ok: false, codigo: ERRORES.SIN_SEMILLA };
  return iniciarMano(sesion, { juego, semilla, configuracionJuego });
}

function accionAct(sesion, { actorId, juego, parametros }) {
  const { publico, privado } = sesion;
  if (publico.fase !== "en_curso" || !publico.manoEnCurso || !privado.estadoJuego) {
    return { ok: false, codigo: ERRORES.FASE_INVALIDA };
  }
  if (!esJugadorActivo(sesion, actorId)) return { ok: false, codigo: ERRORES.NO_AUTORIZADO };

  // El juego recibe SIEMPRE la identidad autenticada, no la del payload.
  const res = juego.aplicar(privado.estadoJuego, {
    actorId,
    tipo: parametros.tipo,
    parametros: parametros.parametros ?? {},
  });
  if (!res?.ok) {
    return { ok: false, codigo: res?.codigo ?? ERRORES.JUEGO_RECHAZO };
  }
  privado.estadoJuego = res.estado;
  sincronizarJuego(sesion, juego);
  return { ok: true };
}

function accionFinish(sesion, { actorId }) {
  const { publico } = sesion;
  if (!esAnfitrionOGm(sesion, actorId)) return { ok: false, codigo: ERRORES.NO_AUTORIZADO };
  if (publico.manoEnCurso) return { ok: false, codigo: ERRORES.FASE_INVALIDA };
  publico.fase = "terminada";
  olvidarSecretos(sesion);
  return { ok: true };
}

function accionClose(sesion, { actorId }) {
  const { publico } = sesion;
  if (!esAnfitrionOGm(sesion, actorId)) return { ok: false, codigo: ERRORES.NO_AUTORIZADO };
  if (publico.manoEnCurso) return { ok: false, codigo: ERRORES.FASE_INVALIDA };
  publico.fase = "terminada";
  publico.cerrada = true;
  olvidarSecretos(sesion);
  return { ok: true };
}

// ---- Coordinador ----------------------------------------------------------

// Sustituye al GM coordinador. No se intenta reconstruir mazo ni manos desde
// datos públicos: la mano en curso se cancela SIN resultado, las fichas vuelven
// al checkpoint anterior al reparto y la nueva época invalida las propuestas y
// nonces de la anterior. Si se pasa `semilla`, arranca ya una mano nueva con
// secreto nuevo; si no, la mesa queda lista para que el anfitrión la inicie.
export function sustituirCoordinador(sesion, { coordinadorId, juego, semilla, configuracionJuego } = {}) {
  cadenaObligatoria(coordinadorId, "coordinadorId");
  const siguiente = clonar(sesion);
  const { publico, privado } = siguiente;

  publico.coordinadorId = coordinadorId;
  publico.epocaCoordinador += 1;
  publico.revision += 1;
  privado.epocaCoordinador = publico.epocaCoordinador;
  privado.nonces = [];
  privado.estadoJuego = null;
  privado.semilla = null;

  if (publico.manoEnCurso) {
    publico.manoEnCurso = false;
    publico.juegoPublico = null;
    publico.resultado = null;
    publico.manoCancelada = true;
    restaurarCheckpoint(siguiente);
  }
  if (Number.isInteger(semilla) && publico.fase !== "terminada" && juego) {
    iniciarMano(siguiente, { juego, semilla, configuracionJuego });
  }
  return siguiente;
}

// Reconexión: el mismo `userId` recupera su asiento y su vista. Otro usuario no
// puede reclamarlo, porque el asiento se busca por la identidad autenticada.
export function reconectar(sesion, userId) {
  const siguiente = clonar(sesion);
  const jugador = siguiente.publico.jugadores.find((j) => j.userId === userId);
  if (jugador?.estado !== "ausente") return sesion;
  jugador.estado = "activo";
  siguiente.publico.revision += 1;
  return siguiente;
}

export function marcarAusente(sesion, userId) {
  const siguiente = clonar(sesion);
  const jugador = siguiente.publico.jugadores.find((j) => j.userId === userId);
  if (!jugador || jugador.estado === "ausente") return sesion;
  jugador.estado = "ausente";
  siguiente.publico.revision += 1;
  return siguiente;
}

// ---- Interior de la mano --------------------------------------------------

function iniciarMano(sesion, { juego, semilla, configuracionJuego }) {
  const { publico, privado } = sesion;
  // El checkpoint se toma ANTES de repartir: solo fichas y datos públicos, para
  // poder cancelar sin reconstruir secretos ni adjudicar apuestas incompletas.
  publico.checkpointMano = {
    revision: publico.revision,
    // Solo la disposición de asientos y los datos públicos del juego (donde
    // viven las fichas). La presencia NO se guarda: quien se desconectó durante
    // la mano sigue ausente después de cancelarla, y restaurarlo como activo
    // sería resucitar a alguien que no está.
    jugadores: publico.jugadores.map((j) => ({ userId: j.userId, asiento: j.asiento })),
    juegoPublico: publico.juegoPublico,
  };
  publico.manoCancelada = false;
  publico.resultado = null;

  // Si la tabla no fija los asientos del juego, se derivan de la mesa: los
  // jugadores sentados, en su orden de asiento.
  const configuracion = {
    ...configuracionJuego,
    jugadores:
      configuracionJuego?.jugadores?.length > 0
        ? configuracionJuego.jugadores
        : publico.jugadores.map((j) => ({ userId: j.userId })),
  };
  let estadoJuego;
  try {
    estadoJuego = juego.crear(configuracion, semilla);
  } catch {
    return { ok: false, codigo: ERRORES.JUEGO_RECHAZO };
  }
  privado.semilla = semilla;
  privado.estadoJuego = estadoJuego;
  publico.fase = "en_curso";
  publico.manoEnCurso = true;
  sincronizarJuego(sesion, juego);
  return { ok: true };
}

// Publica lo que el juego considera público y cierra la mano si ha terminado.
// Nunca copia el estado interno del juego al estado compartido.
function sincronizarJuego(sesion, juego) {
  const { publico, privado } = sesion;
  publico.juegoPublico = juego.vistaPublica(privado.estadoJuego);
  if (juego.haTerminado(privado.estadoJuego)) {
    publico.manoEnCurso = false;
    publico.resultado = juego.resultado(privado.estadoJuego);
    // La mano siguiente es una decisión explícita del anfitrión (`start`), no
    // un encadenado automático. Los secretos de la mano resuelta se olvidan.
    privado.estadoJuego = null;
    privado.semilla = null;
  }
}

// Vuelve a los asientos y a las fichas públicas anteriores al reparto,
// conservando la presencia ACTUAL de cada jugador (ausente sigue ausente).
function restaurarCheckpoint(sesion) {
  const { publico } = sesion;
  if (!publico.checkpointMano) return;
  const presencia = new Map(publico.jugadores.map((j) => [j.userId, j.estado]));
  publico.jugadores = publico.checkpointMano.jugadores.map((j) => ({
    ...j,
    estado: presencia.get(j.userId) ?? "activo",
  }));
  publico.juegoPublico = publico.checkpointMano.juegoPublico ?? null;
}

// Al cerrar la mesa desaparecen los secretos. Los nonces se conservan: una
// sesión terminada ya no acepta acciones, pero el reenvío de la que la cerró
// debe seguir siendo idempotente en vez de convertirse en un error.
function olvidarSecretos(sesion) {
  sesion.privado.estadoJuego = null;
  sesion.privado.semilla = null;
}

// ---- Validación y utilidades ---------------------------------------------

function validarSobre(sobre, limites) {
  if (!sobre || typeof sobre !== "object") return ERRORES.PAYLOAD_INVALIDO;
  if (!ACCIONES.includes(sobre.tipo)) return ERRORES.ACCION_DESCONOCIDA;
  if (!cadenaAcotada(sobre.sessionId, limites.maxCadena)) return ERRORES.PAYLOAD_INVALIDO;
  if (!cadenaAcotada(sobre.nonce, limites.maxCadena)) return ERRORES.PAYLOAD_INVALIDO;
  if (!Number.isInteger(sobre.epocaCoordinador) || sobre.epocaCoordinador < 0) {
    return ERRORES.PAYLOAD_INVALIDO;
  }
  if (
    sobre.revisionEsperada != null &&
    (!Number.isInteger(sobre.revisionEsperada) || sobre.revisionEsperada < 0)
  ) {
    return ERRORES.PAYLOAD_INVALIDO;
  }
  if (sobre.parametros != null && !parametrosAcotados(sobre.parametros, limites, 0)) {
    return ERRORES.PAYLOAD_INVALIDO;
  }
  return null;
}

// El payload que llega de un cliente se acota antes de retransmitirlo o de
// dárselo al juego: escalares o un objeto plano de escalares, con dos niveles
// como mucho (`act` anida `{ tipo, parametros }`), claves y cadenas limitadas.
// Sin esto, un participante podría inflar el estado compartido a voluntad.
function parametrosAcotados(valor, limites, profundidad) {
  if (valor === null) return true;
  const tipo = typeof valor;
  if (tipo === "string") return valor.length <= limites.maxCadena;
  if (tipo === "number") return Number.isFinite(valor);
  if (tipo === "boolean") return true;
  if (tipo !== "object" || Array.isArray(valor)) return false;
  if (profundidad >= 2) return false;
  const claves = Object.keys(valor);
  if (claves.length > limites.maxClavesParametros) return false;
  return claves.every(
    (clave) =>
      clave.length <= limites.maxCadena &&
      parametrosAcotados(valor[clave], limites, profundidad + 1),
  );
}

function nonceProcesado(privado, actorId, nonce) {
  return privado.nonces.find((n) => n.actorId === actorId && n.nonce === nonce) ?? null;
}

// Huella estable de lo que el sobre PIDE (tipo y parámetros), independiente del
// orden de claves y de los campos de transporte. Los sobres ya vienen acotados
// en profundidad, claves y longitud por `validarSobre`, así que serializarlos
// aquí es barato y no puede desbordarse.
function huellaSobre(sobre) {
  return JSON.stringify([sobre.tipo, canonico(sobre.parametros ?? {})]);
}

/**
 * Forma canónica como SECUENCIA ORDENADA DE PARES, no como objeto reconstruido.
 *
 * Construir un objeto y asignarle claves parecía equivalente y no lo era: con
 * parámetros que vienen de `JSON.parse` —el caso real, porque llegan por el
 * socket—, `salida.__proto__ = …` dispara el setter heredado en vez de crear una
 * propiedad, así que la clave se evaporaba de `JSON.stringify` y las huellas de
 * `{"__proto__":{…}}` y `{}` salían idénticas. Dos sobres distintos con el mismo
 * nonce colisionaban y el segundo recibía éxito silencioso, que es exactamente
 * la garantía que la huella existe para sostener.
 *
 * Con pares no hay asignación de claves, así que ninguna clave puede tener
 * significado especial. Las marcas `"o"` y `"a"` distinguen un objeto de un
 * array para que un objeto no pueda hacerse pasar por la lista de sus pares.
 */
function canonico(valor) {
  if (Array.isArray(valor)) return ["a", valor.map(canonico)];
  if (valor === null || typeof valor !== "object") return valor;
  const pares = Object.keys(valor)
    .sort()
    .map((clave) => [clave, canonico(valor[clave])]);
  return ["o", pares];
}

// Colección acotada: descarta los más antiguos. Vive solo en el estado privado
// del coordinador, nunca se copia al estado público.
function registrarNonce(privado, actorId, nonce, huella, maximo) {
  privado.nonces.push({ actorId, nonce, huella });
  if (privado.nonces.length > maximo) {
    privado.nonces.splice(0, privado.nonces.length - maximo);
  }
}

function esJugador(sesion, userId) {
  return sesion.publico.jugadores.some((j) => j.userId === userId);
}

function esJugadorActivo(sesion, userId) {
  return sesion.publico.jugadores.some((j) => j.userId === userId && j.estado === "activo");
}

function esParticipante(sesion, userId) {
  return esJugador(sesion, userId) || sesion.publico.espectadores.includes(userId);
}

function esAnfitrionOGm(sesion, userId) {
  return userId === sesion.publico.anfitrionId || userId === sesion.publico.coordinadorId;
}

function hayAsiento(sesion) {
  return sesion.publico.jugadores.length < sesion.publico.limites.maxJugadores;
}

function hayAforo(sesion) {
  return sesion.publico.espectadores.length < sesion.publico.limites.maxEspectadores;
}

function puedeIniciar(sesion, userId) {
  return (
    esAnfitrionOGm(sesion, userId) &&
    !sesion.publico.manoEnCurso &&
    sesion.publico.jugadores.length >= sesion.publico.limites.minJugadores
  );
}

function puedeCerrar(sesion, userId) {
  return esAnfitrionOGm(sesion, userId) && !sesion.publico.manoEnCurso;
}

function cadenaAcotada(valor, maximo) {
  return typeof valor === "string" && valor.length > 0 && valor.length <= maximo;
}

function cadenaObligatoria(valor, nombre) {
  if (typeof valor !== "string" || valor === "") {
    throw new TypeError(`${nombre}: se requiere una cadena no vacía`);
  }
  return valor;
}

function clonar(sesion) {
  return { publico: estructuraClonada(sesion.publico), privado: clonarPrivado(sesion.privado) };
}

// El estado del juego alojado puede no ser estructuralmente clonable si un
// vertical guarda funciones; se conserva la referencia y se sustituye entera al
// aplicar, que es como el motor de juego devuelve estado nuevo.
function clonarPrivado(privado) {
  return {
    epocaCoordinador: privado.epocaCoordinador,
    semilla: privado.semilla,
    estadoJuego: privado.estadoJuego,
    nonces: privado.nonces.map((n) => ({ ...n })),
  };
}

function estructuraClonada(valor) {
  return structuredClone(valor);
}
