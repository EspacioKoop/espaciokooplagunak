// Configuración de mesa: lo que hay que decidir ANTES de repartir y que el
// motor de póker no puede inventarse (#308, paso 4).
//
// Por qué existe. `sesion-motor.mjs` deriva los asientos de la mesa cuando la
// tabla no los fija: `publico.jugadores.map((j) => ({ userId: j.userId }))`. Y
// `poker-motor.mjs` exige un `stack` entero positivo por jugador, porque una
// partida de póker sin fichas no es una partida. Con las dos reglas puestas una
// al lado de la otra, `start` fallaba SIEMPRE con `juego_rechazo`: nadie
// rellenaba las fichas. Este módulo es esa pieza que faltaba.
//
// Ninguno de los dos motores estaba mal por separado. Las fichas de entrada y
// las ciegas no son una regla del póker, son una decisión de LA MESA —cuánto se
// juega esta noche—, así que no pertenecen al motor del juego ni al marco de
// sesión: pertenecen aquí, donde la mesa se configura.
//
// Puro: ni Foundry, ni DOM, ni red.

// Valores de partida. Cien fichas con ciegas de 1 y 2 dan unas cuantas manos
// antes de que alguien se quede sin nada, que es lo que se quiere en una mesa
// de ambiente: que dure lo que dure la escena, no que reviente en tres manos.
export const MESA_POR_DEFECTO = Object.freeze({
  fichasIniciales: 100,
  ciegaPequena: 1,
  ciegaGrande: 2,
});

function entero(valor, porDefecto, minimo) {
  const n = Math.round(Number(valor));
  return Number.isFinite(n) && n >= minimo ? n : porDefecto;
}

/**
 * Normaliza las opciones de mesa. Se acota en vez de fallar: esto sale de un
 * ajuste de mundo que una persona edita a mano, y una errata no debe dejar la
 * mesa inarrancable — el motor sí fallaría, y el síntoma («juego_rechazo»)
 * llegaría muy lejos de la causa.
 */
export function normalizarMesa(opciones = {}) {
  const fichasIniciales = entero(opciones.fichasIniciales, MESA_POR_DEFECTO.fichasIniciales, 1);
  const ciegaPequena = entero(opciones.ciegaPequena, MESA_POR_DEFECTO.ciegaPequena, 1);
  // La ciega grande nunca puede quedar por debajo de la pequeña: sería una mesa
  // con las reglas al revés, y el motor la aceptaría sin rechistar.
  const ciegaGrande = Math.max(
    ciegaPequena,
    entero(opciones.ciegaGrande, ciegaPequena * 2, 1),
  );
  return { fichasIniciales, ciegaPequena, ciegaGrande };
}

/**
 * Fichas con las que cada asiento llega a la mano que va a empezar.
 *
 * La primera mano usa la entrada configurada. A partir de ahí manda lo que la
 * mano anterior dejó: el motor juega UNA mano y declara que «la mano siguiente
 * es un nuevo `crear` con los stacks resultantes». Si se volviera a repartir la
 * entrada, cada reparto sería una recompra encubierta y las fichas dejarían de
 * ser efímeras, que es justo lo que #308 no quiere.
 *
 * Se prefiere `resultado.stacksFinales` a los stacks de la vista pública porque
 * es el cierre contable de la mano —incluye el reparto del bote—, y la vista
 * pública de una mano terminada podría estar publicada en un punto anterior.
 */
function fichasDe(publico, userId, fichasIniciales) {
  const finales = publico?.resultado?.stacksFinales;
  if (finales && Number.isInteger(finales[userId])) return finales[userId];
  const enJuego = publico?.juegoPublico?.jugadores;
  if (Array.isArray(enJuego)) {
    const asiento = enJuego.find((j) => j?.userId === userId);
    if (asiento && Number.isInteger(asiento.stack)) return asiento.stack;
  }
  return fichasIniciales;
}

/**
 * Construye la `configuracionJuego` que `sesion-motor.mjs` pasa a
 * `poker-motor.crear`, a partir del estado público de la mesa.
 *
 * Los asientos se derivan **en el orden que publica la sesión**, que es el
 * mismo que usaría el motor de sesión al derivarlos: el asiento es posicional,
 * y reordenarlos aquí movería el botón y las ciegas sin que nadie lo pidiera.
 *
 * QUIEN SE QUEDA A CERO NO VUELVE A ENTRAR. `poker.crear` exige un stack entero
 * positivo, así que había que cerrar la regla en algún sitio, y la que encaja
 * con «fichas efímeras, sin recompras» es esta: el asiento se queda **fuera de
 * la mano**, no fuera de la mesa. Sigue sentado, sigue viendo el reparto y
 * sigue en la escena — que es para lo que existe esta capa social—, pero no se
 * le regalan fichas para que siga jugando. Repartirle la entrada otra vez sería
 * la recompra por la puerta de atrás; echarlo de la mesa lo expulsaría de una
 * conversación que no es solo el juego.
 *
 * @param {object|null} publico estado público vigente de la sesión.
 * @param {object} opciones opciones de mesa (sin normalizar).
 */
export function configuracionPoker(publico, opciones = {}) {
  const mesa = normalizarMesa(opciones);
  const asientos = Array.isArray(publico?.jugadores) ? publico.jugadores : [];
  const jugadores = asientos
      .map((asiento) => ({
        userId: asiento.userId,
        stack: fichasDe(publico, asiento.userId, mesa.fichasIniciales),
        // El controlador viaja tal cual: la sesión ya sabe si un asiento lo
        // lleva una persona o el agente automático, y el motor lo necesita para
        // distinguir a quién hay que resolverle el turno solo.
        controlador: asiento.controlador === "automatico" ? "automatico" : "humano",
      }))
      // Un stack negativo no debería existir; si llega, se trata como cero en
      // vez de propagarlo al motor, que lo rechazaría con un código lejano a la
      // causa.
    .filter((jugador) => jugador.stack > 0);
  return {
    ciegaPequena: mesa.ciegaPequena,
    ciegaGrande: mesa.ciegaGrande,
    jugadores,
    botonIndice: botonSiguiente(publico, jugadores),
  };
}

/**
 * Dónde va el botón en la mano que empieza.
 *
 * El motor juega UNA mano y no sabe que hubo otra antes, así que sin esto
 * `crear` cae en su valor por defecto —asiento 0— y el botón nunca se mueve:
 * el mismo jugador paga la ciega pequeña toda la noche. Rotarlo es la regla
 * del póker, y es además lo que reparte la desventaja posicional.
 *
 * Se avanza por el ORDEN DE LA MESA, no por el de la mano anterior: quien se
 * quedó a cero sigue sentado aunque no reciba cartas (ver arriba), y saltarlo
 * en el recuento haría que el botón se saltara asientos enteros cuando ese
 * jugador vuelva a tener fichas. Del orden de mesa se elige el primero que sí
 * juega esta mano.
 *
 * Sin mano anterior —mesa recién abierta, o coordinador que adoptó una mesa sin
 * estado de juego— el botón arranca en el asiento 0, que es tan bueno como
 * cualquiera para la primera mano.
 */
// ---- Blackjack --------------------------------------------------------------
//
// Mismo problema que el póker (#308, paso 4) y misma solución: `blackjack-motor.
// crear` exige `apuesta` y `fichas` por jugador, y eso no es una regla del
// juego —es cuánto se juega esta noche—, así que vive aquí y no en el motor.
//
// A diferencia del póker no hay ciegas ni botón: cada mano todos arriesgan la
// MISMA apuesta fija, decidida por la mesa. Quien no llega a esa apuesta se
// queda fuera de la mano, exactamente como en póker quien se queda a cero.

export const MESA_POR_DEFECTO_BLACKJACK = Object.freeze({
  fichasIniciales: 100,
  apuesta: 5,
});

export function normalizarMesaBlackjack(opciones = {}) {
  return {
    fichasIniciales: entero(opciones.fichasIniciales, MESA_POR_DEFECTO_BLACKJACK.fichasIniciales, 1),
    apuesta: entero(opciones.apuesta, MESA_POR_DEFECTO_BLACKJACK.apuesta, 1),
  };
}

/**
 * Fichas con las que cada asiento llega a la mano que va a empezar. Misma
 * regla que en póker: la primera mano usa la entrada configurada; a partir de
 * ahí manda lo que dejó la mano anterior, para que las fichas sigan siendo
 * efímeras y repartir de nuevo la entrada no sea una recompra encubierta.
 */
function fichasDeBlackjack(publico, userId, fichasIniciales) {
  const resueltos = publico?.resultado?.jugadores;
  if (Array.isArray(resueltos)) {
    const propio = resueltos.find((j) => j?.userId === userId);
    if (propio && Number.isInteger(propio.fichas)) return propio.fichas;
  }
  const enJuego = publico?.juegoPublico?.jugadores;
  if (Array.isArray(enJuego)) {
    const asiento = enJuego.find((j) => j?.userId === userId);
    if (asiento && Number.isInteger(asiento.fichas)) return asiento.fichas;
  }
  return fichasIniciales;
}

/**
 * Construye la `configuracionJuego` que `sesion-motor.mjs` pasa a
 * `blackjack-motor.crear`, a partir del estado público de la mesa.
 *
 * QUIEN NO LLEGA A LA APUESTA NO ENTRA A LA MANO. `blackjack.crear` exige
 * fichas suficientes para la apuesta fija; el asiento se queda fuera del
 * reparto, no fuera de la mesa — sigue sentado viendo jugar, igual que en
 * póker.
 *
 * @param {object|null} publico estado público vigente de la sesión.
 * @param {object} opciones opciones de mesa (sin normalizar).
 */
export function configuracionBlackjack(publico, opciones = {}) {
  const mesa = normalizarMesaBlackjack(opciones);
  const asientos = Array.isArray(publico?.jugadores) ? publico.jugadores : [];
  const jugadores = asientos
    .map((asiento) => ({
      userId: asiento.userId,
      fichas: fichasDeBlackjack(publico, asiento.userId, mesa.fichasIniciales),
      apuesta: mesa.apuesta,
      controlador: asiento.controlador === "automatico" ? "automatico" : "humano",
    }))
    .filter((jugador) => jugador.fichas >= jugador.apuesta);
  return { jugadores };
}

function botonSiguiente(publico, jugadores) {
  if (jugadores.length === 0) return 0;
  const anterior = publico?.juegoPublico;
  const previos = Array.isArray(anterior?.jugadores) ? anterior.jugadores : [];
  const indiceAnterior = anterior?.botonIndice;
  if (!Number.isInteger(indiceAnterior) || !previos[indiceAnterior]) return 0;

  const ordenMesa = (Array.isArray(publico?.jugadores) ? publico.jugadores : []).map(
    (asiento) => asiento?.userId,
  );
  const desde = ordenMesa.indexOf(previos[indiceAnterior].userId);
  if (desde < 0) return 0;

  for (let salto = 1; salto <= ordenMesa.length; salto += 1) {
    const candidato = ordenMesa[(desde + salto) % ordenMesa.length];
    const indice = jugadores.findIndex((jugador) => jugador.userId === candidato);
    if (indice >= 0) return indice;
  }
  return 0;
}
