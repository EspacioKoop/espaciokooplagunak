// Modelo de presentación de la mesa de blackjack (#308, tercer vertical),
// hermano de `mesa-vista.mjs` y `dados-vista.mjs`.
//
// Convierte lo que un cliente RECIBE —la vista pública del ajuste de mundo,
// más la privada que le llega por socket si está sentado— en algo que una
// plantilla pueda pintar sin saber del transporte ni del motor.
//
// LA MISMA REGLA QUE EN PÓKER Y DADOS: este módulo solo sabe lo que le han
// dado. No inventa el valor de la carta tapada de la banca —mientras está
// oculta, `blackjack-motor.vistaPublica` ya no manda su código, así que aquí
// solo se pinta un dorso— y no adivina el desenlace antes de que el motor lo
// resuelva.
//
// A diferencia del póker, en blackjack la mano de cada jugador es PÚBLICA
// desde el reparto: no hay `tuMano`/`juegoPrivado` que leer, porque
// `blackjack-motor.vistaPrivada` es idéntica a la pública. Solo la banca
// esconde una carta, y eso ya lo resuelve el motor antes de publicar.
//
// Tampoco decide qué se puede hacer: las acciones permitidas las calcula el
// motor de sesión con la identidad autenticada, y aquí solo se les pone
// etiqueta. Un botón de más en pantalla no concede nada.
//
// Puro: ni Foundry, ni DOM, ni red, ni <canvas>. Se prueba desde Node.

import { cartaDataUri, dorsoDataUri } from "./cartas-pixelart.mjs";
import { ANCHO, altoDePila, pilaDataUri, pilaDeFichas } from "./fichas-pixelart.mjs";

const PREFIJO_JUEGO = "act:";

const ETIQUETAS = Object.freeze({
  join: "LAGUNAK.Minijuegos.Accion.Sentarse",
  watch: "LAGUNAK.Minijuegos.Accion.Mirar",
  leave: "LAGUNAK.Minijuegos.Accion.Levantarse",
  return: "LAGUNAK.Minijuegos.Accion.Volver",
  botAdd: "LAGUNAK.Minijuegos.Accion.SentarAutomatico",
  botRemove: "LAGUNAK.Minijuegos.Accion.QuitarAutomatico",
  start: "LAGUNAK.Blackjack.Accion.Repartir",
  finish: "LAGUNAK.Minijuegos.Accion.Rematar",
  close: "LAGUNAK.Minijuegos.Accion.Cerrar",
  "act:pedir": "LAGUNAK.Blackjack.Accion.Pedir",
  "act:plantarse": "LAGUNAK.Blackjack.Accion.Plantarse",
  "act:doblar": "LAGUNAK.Blackjack.Accion.Doblar",
});

function carta(codigo) {
  return { codigo, imagen: cartaDataUri(codigo) };
}

/** Dorso: lo que se pinta donde hay una carta que no se tiene derecho a ver
 * —en blackjack, solo la segunda de la banca mientras está tapada. */
function dorso() {
  return { codigo: null, imagen: dorsoDataUri() };
}

/**
 * Montón de fichas de una cantidad: una ficha por denominación, con su cuenta.
 * Igual que en `mesa-vista.mjs`: adorno que nunca sustituye a la cifra escrita
 * al lado, y que no aparece donde no hay cifra que representar.
 */
function monton(cantidad) {
  return pilaDeFichas(cantidad).map(({ valor, cuenta }) => ({
    valor,
    cuenta,
    imagen: pilaDataUri(valor, cuenta),
    ancho: ANCHO,
    alto: altoDePila(cuenta),
  }));
}

/**
 * @param {object|null} vista lo último recibido: pública, o privada si el
 *   cliente está sentado. En blackjack son la misma cosa —no hay secreto por
 *   jugador—, pero se acepta el mismo contrato que las otras mesas.
 * @param {{userId?: string, acciones?: string[]}} contexto identidad del
 *   cliente y acciones que el motor le permite ahora mismo.
 */
export function blackjackVista(vista, { userId = "", acciones = [] } = {}) {
  if (!vista || typeof vista !== "object") {
    return { hayMesa: false, acciones: [], jugadores: [], banca: null };
  }

  const publico = vista.juegoPublico ?? null;
  const asientos = Array.isArray(vista.jugadores) ? vista.jugadores : [];
  const eresJugador = asientos.some((j) => j?.userId === userId);
  const turno = publico?.turno ?? null;
  const enJuego = new Map((publico?.jugadores ?? []).map((j) => [j.userId, j]));

  const bancaPublica = publico?.banca ?? null;
  const banca = bancaPublica && {
    // Mientras está tapada, `blackjack-motor` ya solo manda el código de la
    // primera: la segunda se pinta de dorso porque no hay nada más que
    // enseñar, no porque este módulo decida esconderla.
    cartas: bancaPublica.oculta
      ? [carta(bancaPublica.cartas?.[0]), dorso()]
      : (bancaPublica.cartas ?? []).map(carta),
    oculta: Boolean(bancaPublica.oculta),
    total: bancaPublica.total ?? null,
  };

  const resultado = vista.resultado ?? null;
  const resultadoPorJugador = new Map(
    Array.isArray(resultado?.jugadores) ? resultado.jugadores.map((j) => [j.userId, j]) : [],
  );

  return {
    hayMesa: true,
    id: vista.id ?? null,
    juego: vista.juego ?? null,
    fase: vista.fase ?? null,
    manoEnCurso: Boolean(vista.manoEnCurso),
    manoCancelada: Boolean(vista.manoCancelada),
    eresJugador,
    eresEspectador:
      !eresJugador && Array.isArray(vista.espectadores) && vista.espectadores.includes(userId),
    esTuTurno: Boolean(userId) && turno === userId,
    banca,
    jugadores: asientos.map((asiento) => {
      const suyo = enJuego.get(asiento.userId) ?? null;
      const suDesenlace = resultadoPorJugador.get(asiento.userId) ?? null;
      return {
        userId: asiento.userId,
        eresTu: asiento.userId === userId,
        esTurno: turno === asiento.userId,
        fichas: suyo?.fichas ?? null,
        pila: monton(suyo?.fichas),
        apuesta: suyo?.apuesta ?? null,
        apuestaPila: monton(suyo?.apuesta),
        // La mano es pública desde el reparto: no hay dorso que pintar aquí
        // salvo que este asiento aún no tenga cartas —la mesa existe antes
        // que la mano.
        cartas: (suyo?.cartas ?? []).map(carta),
        total: suyo?.total ?? null,
        terminado: Boolean(suyo?.terminado),
        motivo: suyo?.motivo ?? null,
        desenlace: suyo?.desenlace ?? suDesenlace?.desenlace ?? null,
        ganancia: suDesenlace?.ganancia ?? null,
        controlador: suyo?.controlador ?? asiento.controlador ?? null,
      };
    }),
    resultado,
    acciones: accionesVisibles(accionesEfectivas(vista, acciones, eresJugador, userId)),
  };
}

/**
 * Qué acciones se pintan. Mismo criterio que en póker y dados: manda lo que
 * el coordinador concedió a ESTE cliente, y el respaldo son las acciones «de
 * forastero» de la vista pública, que solo valen para quien no participa.
 */
function accionesEfectivas(vista, acciones, eresJugador, userId) {
  if (Array.isArray(acciones) && acciones.length > 0) return acciones;
  if (eresJugador) return [];
  const espectador = Array.isArray(vista.espectadores) && vista.espectadores.includes(userId);
  if (espectador) return [];
  return Array.isArray(vista.accionesForastero) ? vista.accionesForastero : [];
}

/** Acciones con etiqueta, sin las que este módulo no sepa nombrar. */
export function accionesVisibles(acciones) {
  return (Array.isArray(acciones) ? acciones : [])
    .filter((tipo) => typeof tipo === "string" && ETIQUETAS[tipo])
    .map((tipo) => ({
      tipo,
      etiqueta: ETIQUETAS[tipo],
      esDeJuego: tipo.startsWith(PREFIJO_JUEGO),
    }));
}
