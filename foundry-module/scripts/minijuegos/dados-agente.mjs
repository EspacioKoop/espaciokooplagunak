// Política del jugador automático en la mesa de dados (#413).
//
// Vive FUERA del motor, igual que `agente-automatico.mjs` vive fuera del póker:
// el motor debe seguir siendo un reductor puro de reglas, y quien decide QUÉ
// jugar es sustituible sin tocarlo. `turnos-automaticos.mjs` no sabe de dados ni
// de cartas —recibe la política inyectada—, así que esta pieza entra ahí tal
// cual y no hubo que tocar el andamio de turnos.
//
// DETERMINISTA A PROPÓSITO. Ni azar ni estado externo: con el mismo cubilete y
// la misma apuesta viva, el NPC juega igual. Es lo que permite que una partida
// sembrada sea reproducible de principio a fin, como exige el contrato de #308.
//
// CÓMO PIENSA. Un jugador de dados no calcula su mano, calcula la de todos: la
// apuesta habla de los dados de LA MESA. Así que el agente suma lo que ve en su
// cubilete —información cierta— y le añade la esperanza de lo que no ve. Eso da
// un número honesto contra el que medir la apuesta viva; el farol no se modela
// porque un NPC que farolea sin leer a nadie es un NPC que se suicida.

import { CARAS, contarCara, superaApuesta } from "./dados-motor.mjs";

/**
 * Cuántos dados de una cara cabe esperar entre los que NO se ven.
 *
 * Con los unos de comodín, cada dado ajeno vale para la cara pedida de dos
 * formas —saliendo esa cara o saliendo un uno—, así que la esperanza se dobla.
 * Apostando a unos no: ahí solo valen los unos.
 */
export function esperanzaOculta(dadosOcultos, cara, unosComodin) {
  const caras = unosComodin && cara !== 1 ? 2 : 1;
  return Math.max(0, dadosOcultos) * (caras / 6);
}

/**
 * Cuántos dados de esa cara cabe esperar en TODA la mesa, con lo que este
 * jugador sabe. Lo suyo es certeza; lo ajeno, esperanza.
 */
export function estimarTotal(vista, cara) {
  const mio = vista?.tuCubilete ?? [];
  const ciertos = contarCara({ propio: mio }, cara, vista?.unosComodin !== false);
  const ocultos = Math.max(0, (vista?.dadosEnJuego ?? 0) - mio.length);
  return ciertos + esperanzaOculta(ocultos, cara, vista?.unosComodin !== false);
}

/**
 * Margen de credulidad, en dados. Una apuesta por encima de la esperanza no es
 * mentira: la esperanza es la media, y media mesa está por encima de la media.
 * Dudar en cuanto se pasa un decimal haría un NPC insufrible que corta todas las
 * rondas en la primera subida.
 */
export const MARGEN_DUDA = 1;

/**
 * Decide la jugada del NPC de turno.
 *
 * @param {object} vista vista PRIVADA del motor de dados (lleva `tuCubilete`).
 * @param {string[]} acciones acciones permitidas, sin prefijo de sesión.
 * @returns {{tipo: string, parametros?: object}|null}
 */
export function decidirJugadaDados(vista, acciones) {
  if (!Array.isArray(acciones) || acciones.length === 0) return null;
  const puede = (t) => acciones.includes(t);
  const apuesta = vista?.apuesta ?? null;

  // Abrir la ronda: se apuesta por la cara que uno más tiene, sin inflar. Es la
  // apertura que menos compromete y la que más se parece a lo que hace una
  // persona con su cubilete recién destapado delante.
  if (!apuesta) {
    if (!puede("apostar")) return null;
    return { tipo: "apostar", parametros: aperturaHonesta(vista) };
  }

  // ¿Es creíble lo que hay sobre la mesa?
  const esperado = estimarTotal(vista, apuesta.cara);
  if (apuesta.cantidad > esperado + MARGEN_DUDA && puede("dudar")) {
    return { tipo: "dudar" };
  }

  const subida = siguienteApuesta(vista, apuesta);
  // Sin subida posible —o con una que ya no se sostiene ni para uno mismo— toca
  // dudar: es preferible perder un dado a prometer algo imposible.
  if (!subida || subida.cantidad > estimarTotal(vista, subida.cara) + MARGEN_DUDA) {
    if (puede("dudar")) return { tipo: "dudar" };
  }
  if (subida && puede("apostar")) return { tipo: "apostar", parametros: subida };
  return puede("dudar") ? { tipo: "dudar" } : null;
}

/** La cara que más se repite en el cubilete propio, contando comodines. */
function mejorCara(vista) {
  const mio = vista?.tuCubilete ?? [];
  const comodin = vista?.unosComodin !== false;
  let elegida = CARAS[CARAS.length - 1];
  let mejor = -1;
  for (const cara of CARAS) {
    const cuenta = contarCara({ propio: mio }, cara, comodin);
    // Estrictamente mayor: ante empate se queda la cara MÁS BAJA, que deja más
    // sitio para subir después sin saltar de cantidad.
    if (cuenta > mejor) {
      mejor = cuenta;
      elegida = cara;
    }
  }
  return { cara: elegida, cuenta: Math.max(0, mejor) };
}

function aperturaHonesta(vista) {
  const { cara, cuenta } = mejorCara(vista);
  const enJuego = Math.max(1, vista?.dadosEnJuego ?? 1);
  // Al menos uno: una apuesta de cero dados no existe. Y nunca más de los que
  // hay sobre la mesa, que el motor rechazaría.
  return { cantidad: Math.min(enJuego, Math.max(1, cuenta)), cara };
}

/**
 * La subida más barata que supera a la viva: misma cantidad con una cara más
 * alta si queda sitio, y si no, un dado más con la cara propia más fuerte.
 *
 * Subir lo mínimo es política, no pereza: cada dado prometido de más es un dado
 * que hay que encontrar en la mesa cuando alguien dude.
 */
export function siguienteApuesta(vista, apuesta) {
  const enJuego = Math.max(0, vista?.dadosEnJuego ?? 0);
  const preferida = mejorCara(vista).cara;

  const candidatas = [];
  // Misma cantidad, cara más alta. Se prueba primero la propia si sirve.
  for (const cara of CARAS) {
    if (cara > apuesta.cara) candidatas.push({ cantidad: apuesta.cantidad, cara });
  }
  // Un dado más, empezando por la cara que uno tiene.
  candidatas.push({ cantidad: apuesta.cantidad + 1, cara: preferida });
  for (const cara of CARAS) candidatas.push({ cantidad: apuesta.cantidad + 1, cara });

  const viables = candidatas.filter(
    (c) => c.cantidad <= enJuego && superaApuesta(c, apuesta),
  );
  if (viables.length === 0) return null;

  // De las viables, la que mejor sostiene uno mismo; a igualdad, la más barata,
  // que es la primera por el orden en que se generaron.
  let elegida = viables[0];
  let mejorApoyo = -Infinity;
  for (const candidata of viables) {
    const apoyo = estimarTotal(vista, candidata.cara) - candidata.cantidad;
    if (apoyo > mejorApoyo) {
      mejorApoyo = apoyo;
      elegida = candidata;
    }
  }
  return elegida;
}
