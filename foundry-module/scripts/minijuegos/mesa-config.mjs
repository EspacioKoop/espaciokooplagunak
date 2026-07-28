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
 * Construye la `configuracionJuego` que `sesion-motor.mjs` pasa a
 * `poker-motor.crear`, a partir del estado público de la mesa.
 *
 * Los asientos se derivan **en el orden que publica la sesión**, que es el
 * mismo que usaría el motor de sesión al derivarlos: el asiento es posicional,
 * y reordenarlos aquí movería el botón y las ciegas sin que nadie lo pidiera.
 *
 * @param {object|null} publico estado público vigente de la sesión.
 * @param {object} opciones opciones de mesa (sin normalizar).
 */
export function configuracionPoker(publico, opciones = {}) {
  const mesa = normalizarMesa(opciones);
  const asientos = Array.isArray(publico?.jugadores) ? publico.jugadores : [];
  return {
    ciegaPequena: mesa.ciegaPequena,
    ciegaGrande: mesa.ciegaGrande,
    jugadores: asientos.map((asiento) => ({
      userId: asiento.userId,
      stack: mesa.fichasIniciales,
      // El controlador viaja tal cual: la sesión ya sabe si un asiento lo lleva
      // una persona o el agente automático, y el motor lo necesita para
      // distinguir a quién hay que resolverle el turno solo.
      controlador: asiento.controlador === "automatico" ? "automatico" : "humano",
    })),
  };
}
