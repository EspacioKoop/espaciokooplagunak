// Proyección de cartas visibles en escena (#458), primera pieza del vertical
// mínimo de póker que pide el issue: un contrato entre el motor de cartas y lo
// que se pinta en el lienzo de Foundry, sin abrir una segunda fuente de verdad.
//
// Deliberadamente NO sabe qué es un dueño, una mano, un turno o una apuesta —
// eso sigue siendo autoridad exclusiva de `poker-motor.mjs`. Solo contesta a
// una pregunta: "¿qué cartas están visibles sobre la mesa ahora mismo, y
// dónde?". Por eso toma como entrada la VISTA (pública + la privada de quien
// mira), nunca el estado interno del motor: lo que no está en la vista no es
// visible para nadie que no sea el motor, y esta proyección no puede filtrarlo.
//
// Una `ProyeccionCarta` es `{ id, codigo, zona, bocaArriba }`:
//   - `id`      identificador ESTABLE de la carta-en-mesa (para que el lienzo
//               anime un movimiento en vez de destruir y recrear el objeto).
//   - `codigo`  código de naipes.mjs ("As", "Td"…), o null si está boca abajo
//               (una carta ajena no mostrada no tiene código que dar: el
//               lienzo no puede pintar lo que el motor no ha revelado).
//   - `zona`    "mesa" (comunitarias) | "mano-propia" | `mano-ajena:<userId>`.
//   - `bocaArriba` boolean.

const ZONA_MESA = "mesa";
const ZONA_MANO_PROPIA = "mano-propia";

function zonaManoAjena(userId) {
  return `mano-ajena:${userId}`;
}

/**
 * Construye la lista de cartas visibles en escena a partir de la vista de UN
 * observador (la del propio jugador, o la vista pública sin `tuMano` para un
 * espectador/GM). Pura: misma entrada, misma salida.
 *
 * @param {object} vista - resultado de `vistaPublica`/`vistaPrivada` del motor.
 * @param {string|null} userId - identidad de quien mira, o null para un
 *   espectador sin mano propia.
 */
export function proyectarCartasVisibles(vista, userId = null) {
  if (!vista) return [];
  const cartas = [];

  for (const [indice, codigo] of (vista.comunitarias ?? []).entries()) {
    cartas.push({
      id: `mesa:${indice}`,
      codigo,
      zona: ZONA_MESA,
      bocaArriba: true,
    });
  }

  if (userId && Array.isArray(vista.tuMano)) {
    vista.tuMano.forEach((codigo, indice) => {
      cartas.push({
        id: `mano:${userId}:${indice}`,
        codigo,
        zona: ZONA_MANO_PROPIA,
        bocaArriba: true,
      });
    });
  }

  for (const jugador of vista.jugadores ?? []) {
    if (jugador.userId === userId) continue; // la propia ya viene de tuMano.
    const mostradas = new Map(
      (vista.cartasMostradas?.[jugador.userId] ?? []).map((codigo, i) => [i, codigo]),
    );
    // Sin conteo público de cuántas cartas hay en la mano de otro, la única
    // carta ajena que puede proyectarse es la que el motor ya ha marcado
    // mostrada: cualquier otra posición sería inventar una carta boca abajo
    // que ni siquiera el motor ha confirmado que exista todavía en esa mano.
    for (const [indice, codigo] of mostradas) {
      cartas.push({
        id: `mano:${jugador.userId}:${indice}`,
        codigo,
        zona: zonaManoAjena(jugador.userId),
        bocaArriba: true,
      });
    }
  }

  return cartas;
}
