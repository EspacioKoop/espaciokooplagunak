// Lo que la mesa de blackjack DICE de sí misma (#553, del QA #449).
//
// El QA fue claro: «pasa funcionalmente pero las reglas y el estado no se
// entienden a simple vista». Y era cierto — `blackjack-vista.mjs` entrega los
// campos crudos del motor (`fase`, `turno`, `terminado`, `motivo`, `desenlace`)
// y no hay ni una frase que diga qué pasa ahora ni qué se espera de mí. Eso
// funciona para quien escribió el motor y para nadie más.
//
// Este módulo es solo eso: PALABRAS. No decide nada.
//
//   - No concede acciones. Las calcula el motor de sesión con la identidad
//     autenticada (#237) y `blackjack-vista` las etiqueta; aquí solo se explica
//     lo que ya está decidido. Una frase que diga «puedes doblar» al lado de un
//     botón apagado es un fallo de este módulo, no un permiso.
//   - No inventa estado. Si el motor no ha resuelto la mano, la lectura dice
//     que está en curso; no adelanta un desenlace probable.
//
// EL CARTEL DE REGLAS SE DERIVA DEL MOTOR, NO SE ESCRIBE. `reglasDeLaCasa` lee
// `LIMITE_PLANTADO_BANCA`, `PAGO_BLACKJACK` y `CARTAS_PARA_DOBLAR` de
// `blackjack-motor.mjs`, y la apuesta de la configuración de la mesa. Un cartel
// escrito a mano no falla: se desincroniza, y sigue anunciando cómo se jugaba
// antes del último cambio. Nadie se entera hasta que alguien pierde una mano por
// creérselo. Hay un test que sujeta esa correspondencia.
//
// DEVUELVE CLAVES DE i18n Y SUS DATOS, NUNCA TEXTO. Igual que el resto del
// módulo: quien pinta traduce. Así esto se prueba en Node sin cargar idiomas y
// una mesa en euskera no necesita otro módulo.
//
// Puro: ni Foundry, ni DOM, ni red.

import {
  CARTAS_PARA_DOBLAR,
  LIMITE_PLANTADO_BANCA,
  PAGO_BLACKJACK,
} from "./blackjack-motor.mjs";

/**
 * Las claves, escritas ENTERAS y nunca montadas por concatenación.
 *
 * Es lo que exige `tests/localization.test.mjs`, y con razón: una clave que solo
 * existe al ejecutarse no se puede encontrar buscando en el repositorio, así que
 * nadie sabe si sobra al retirar una función ni si falta al traducir. El precio
 * es esta tabla; la alternativa es un `lang/` que se pudre sin avisar.
 */
const CLAVES = Object.freeze({
  sinMesa: "LAGUNAK.Blackjack.Lectura.SinMesa",
  cancelada: "LAGUNAK.Blackjack.Lectura.Cancelada",
  esperandoReparto: "LAGUNAK.Blackjack.Lectura.EsperandoReparto",
  manoResuelta: "LAGUNAK.Blackjack.Lectura.ManoResuelta",
  tuTurno: "LAGUNAK.Blackjack.Lectura.TuTurno",
  turnoDeOtro: "LAGUNAK.Blackjack.Lectura.TurnoDeOtro",
  juegaLaBanca: "LAGUNAK.Blackjack.Lectura.JuegaLaBanca",
  reglaBanca: "LAGUNAK.Blackjack.Lectura.Regla.Banca",
  reglaBlackjack: "LAGUNAK.Blackjack.Lectura.Regla.Blackjack",
  reglaDoblar: "LAGUNAK.Blackjack.Lectura.Regla.Doblar",
  reglaApuesta: "LAGUNAK.Blackjack.Lectura.Regla.Apuesta",
  noDoblarYaPediste: "LAGUNAK.Blackjack.Lectura.NoDoblar.YaPediste",
  noDoblarSinFichas: "LAGUNAK.Blackjack.Lectura.NoDoblar.SinFichas",
});

/**
 * El estado de un asiento. Van aparte porque el motor los nombra —`plantado`,
 * `bust`, `gana`— y aquí solo se traducen a clave: una tabla explícita es lo
 * único que garantiza que un motivo nuevo del motor no se pinte como una clave
 * inventada que nadie ha traducido.
 */
const CLAVES_MOTIVO = Object.freeze({
  decide: "LAGUNAK.Blackjack.Lectura.Motivo.Decide",
  espera: "LAGUNAK.Blackjack.Lectura.Motivo.Espera",
  sinCartas: "LAGUNAK.Blackjack.Lectura.Motivo.SinCartas",
  plantado: "LAGUNAK.Blackjack.Lectura.Motivo.Plantado",
  bust: "LAGUNAK.Blackjack.Lectura.Motivo.Bust",
  blackjack: "LAGUNAK.Blackjack.Lectura.Motivo.Blackjack",
  doblado: "LAGUNAK.Blackjack.Lectura.Motivo.Doblado",
});

const CLAVES_DESENLACE = Object.freeze({
  gana: "LAGUNAK.Blackjack.Lectura.Desenlace.Gana",
  pierde: "LAGUNAK.Blackjack.Lectura.Desenlace.Pierde",
  empate: "LAGUNAK.Blackjack.Lectura.Desenlace.Empate",
  blackjack: "LAGUNAK.Blackjack.Lectura.Desenlace.Blackjack",
});

/**
 * En qué punto va la mano y qué se espera de quien mira.
 *
 * El orden de las ramas es el orden en que importan las cosas: lo primero que
 * hay que saber es si te toca a ti. Un jugador que tiene que actuar no debería
 * tener que leer tres líneas para descubrirlo.
 *
 * @param {object} vista lo que devuelve `blackjackVista`.
 * @returns {{clave: string, datos: object, esTuTurno: boolean}}
 */
export function situacion(vista) {
  if (!vista?.hayMesa) return { clave: CLAVES.sinMesa, datos: {}, esTuTurno: false };

  if (vista.manoCancelada) return { clave: CLAVES.cancelada, datos: {}, esTuTurno: false };

  if (!vista.manoEnCurso) {
    // Sin mano en curso hay dos situaciones distintas y conviene no
    // confundirlas: la mesa recién abierta y la mano ya resuelta cuyo resultado
    // sigue en pantalla.
    const clave = vista.resultado ? CLAVES.manoResuelta : CLAVES.esperandoReparto;
    return { clave, datos: {}, esTuTurno: false };
  }

  if (vista.esTuTurno) {
    return { clave: CLAVES.tuTurno, datos: { total: totalPropio(vista) }, esTuTurno: true };
  }

  const enTurno = (vista.jugadores ?? []).find((jugador) => jugador.esTurno);
  if (enTurno) {
    return { clave: CLAVES.turnoDeOtro, datos: { userId: enTurno.userId }, esTuTurno: false };
  }

  // Nadie tiene el turno y la mano sigue viva: los jugadores han terminado y le
  // toca a la banca destapar y pedir.
  return { clave: CLAVES.juegaLaBanca, datos: { limite: LIMITE_PLANTADO_BANCA }, esTuTurno: false };
}

/** El total de quien mira, si está sentado y tiene cartas. */
function totalPropio(vista) {
  const propio = (vista.jugadores ?? []).find((jugador) => jugador.eresTu);
  return propio?.total ?? null;
}

/**
 * Qué le pasa a un jugador concreto, en una palabra.
 *
 * Traduce `motivo` y `desenlace` —que son vocabulario del motor— a algo que se
 * pueda poner debajo de sus cartas. Se separan a propósito: `motivo` dice cómo
 * acabó su mano (se plantó, se pasó) y `desenlace` si ganó, y una mano puede
 * tener lo primero mucho antes que lo segundo.
 */
export function estadoDeJugador(jugador) {
  if (!jugador) return null;
  const porDesenlace = CLAVES_DESENLACE[jugador.desenlace];
  if (porDesenlace) return { clave: porDesenlace, datos: { ganancia: jugador.ganancia ?? 0 } };
  const porMotivo = CLAVES_MOTIVO[jugador.motivo];
  if (porMotivo) return { clave: porMotivo, datos: { total: jugador.total ?? null } };
  if (jugador.esTurno) return { clave: CLAVES_MOTIVO.decide, datos: { total: jugador.total ?? null } };
  if (jugador.total != null) return { clave: CLAVES_MOTIVO.espera, datos: { total: jugador.total } };
  // Sentado pero sin cartas: o la mano no ha empezado, o no llegó a la apuesta y
  // se quedó fuera de ESTA mano sin levantarse de la mesa.
  return { clave: CLAVES_MOTIVO.sinCartas, datos: {} };
}

/**
 * El cartel de reglas de ESTA mesa.
 *
 * Todo sale del motor o de la configuración, nada está escrito aquí. Añadir una
 * regla nueva a este cartel sin que exista en el motor es tan fácil como
 * escribir una línea, y por eso el test compara contra las constantes en vez de
 * contra un texto esperado.
 *
 * @param {{apuesta?: number, fichasIniciales?: number}} mesa configuración ya
 *   normalizada por `normalizarMesaBlackjack`.
 */
export function reglasDeLaCasa(mesa = {}) {
  const reglas = [
    { clave: CLAVES.reglaBanca, datos: { limite: LIMITE_PLANTADO_BANCA } },
    { clave: CLAVES.reglaBlackjack, datos: { pago: PAGO_BLACKJACK } },
    { clave: CLAVES.reglaDoblar, datos: { cartas: CARTAS_PARA_DOBLAR } },
  ];
  // La apuesta solo se anuncia si la mesa la ha fijado: un cartel que diga
  // «apuesta: 0» es peor que uno que no hable de la apuesta.
  if (Number.isInteger(mesa.apuesta) && mesa.apuesta > 0) {
    reglas.push({ clave: CLAVES.reglaApuesta, datos: { apuesta: mesa.apuesta } });
  }
  return reglas;
}

/**
 * Por qué NO puedes doblar ahora mismo, cuando es tu turno y el botón no está.
 *
 * Es la pregunta concreta que el QA no podía responder mirando la mesa: si
 * doblar está apagado porque la mesa no lo permite o porque no me llegan las
 * fichas. Devuelve `null` cuando sí se puede o cuando la pregunta no aplica —
 * explicar una ausencia que nadie ha notado es ruido.
 */
export function porQueNoPuedesDoblar(vista, { apuesta = 0 } = {}) {
  if (!vista?.esTuTurno) return null;
  if ((vista.acciones ?? []).some((accion) => accion.tipo === "act:doblar")) return null;
  const propio = (vista.jugadores ?? []).find((jugador) => jugador.eresTu);
  if (!propio) return null;
  const cartas = propio.cartas?.length ?? 0;
  if (cartas > CARTAS_PARA_DOBLAR) {
    return { clave: CLAVES.noDoblarYaPediste, datos: { cartas: CARTAS_PARA_DOBLAR } };
  }
  if (Number.isInteger(propio.fichas) && apuesta > 0 && propio.fichas < apuesta * 2) {
    return { clave: CLAVES.noDoblarSinFichas, datos: { necesarias: apuesta * 2, tienes: propio.fichas } };
  }
  // Se puede llegar aquí con la mano ya terminada o en un estado que el motor
  // conoce y esto no: se calla en vez de inventar un motivo.
  return null;
}

/**
 * La lectura completa, que es lo que consume una plantilla.
 *
 * @param {object} vista salida de `blackjackVista`.
 * @param {object} mesa configuración normalizada de la mesa.
 */
export function lecturaBlackjack(vista, mesa = {}) {
  return {
    situacion: situacion(vista),
    reglas: reglasDeLaCasa(mesa),
    noPuedesDoblar: porQueNoPuedesDoblar(vista, mesa),
    jugadores: (vista?.jugadores ?? []).map((jugador) => ({
      userId: jugador.userId,
      estado: estadoDeJugador(jugador),
    })),
  };
}
