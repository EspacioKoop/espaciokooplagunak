// Modelo de presentación de la mesa de minijuegos (#308, paso 4): convierte lo
// que un cliente RECIBE —la vista pública del ajuste de mundo, más la vista
// privada que le llega por socket si está sentado— en algo que una plantilla
// pueda pintar sin saber nada del transporte ni del motor.
//
// Puro: ni Foundry, ni DOM, ni red. Se prueba desde Node.
//
// LA REGLA QUE SOSTIENE EL RESTO: este módulo solo sabe lo que le han dado.
// No deduce cartas ajenas, no rellena huecos y no adivina de quién es el turno
// más allá de lo que dice la vista. Si algo no está, se dibuja un dorso o un
// hueco — nunca una carta inventada. Una mesa que enseña de más no es un fallo
// de estética, es hacer trampas.
//
// Tampoco decide qué se puede hacer: las acciones permitidas las calcula el
// motor de sesión con la identidad autenticada, y aquí solo se les pone
// etiqueta. Un botón de más en pantalla no concede nada; el coordinador
// rechazaría la propuesta igual.

import { cartaDataUri, dorsoDataUri } from "./cartas-pixelart.mjs";

// Acciones del marco de sesión frente a acciones del juego, que llegan con
// prefijo `act:`. La distinción ya la hace `sesion-motor.mjs`; aquí se
// aprovecha para etiquetarlas por separado.
const PREFIJO_JUEGO = "act:";

const ETIQUETAS = Object.freeze({
  join: "LAGUNAK.Minijuegos.Accion.Sentarse",
  watch: "LAGUNAK.Minijuegos.Accion.Mirar",
  leave: "LAGUNAK.Minijuegos.Accion.Levantarse",
  start: "LAGUNAK.Minijuegos.Accion.Repartir",
  finish: "LAGUNAK.Minijuegos.Accion.Rematar",
  close: "LAGUNAK.Minijuegos.Accion.Cerrar",
  "act:fold": "LAGUNAK.Minijuegos.Accion.Retirarse",
  "act:check": "LAGUNAK.Minijuegos.Accion.Pasar",
  "act:call": "LAGUNAK.Minijuegos.Accion.Igualar",
  "act:raise": "LAGUNAK.Minijuegos.Accion.Subir",
});

// Solo `raise` necesita que la persona diga cuánto. El resto son de un clic.
const CON_IMPORTE = Object.freeze(["act:raise"]);

function carta(codigo) {
  return { codigo, imagen: cartaDataUri(codigo) };
}

/** Dorso: lo que se pinta donde hay una carta que NO se tiene derecho a ver. */
function dorso() {
  return { codigo: null, imagen: dorsoDataUri() };
}

/**
 * @param {object|null} vista lo último recibido: pública, o privada si el
 *   cliente está sentado (la privada es la pública más `juegoPrivado`).
 * @param {{userId?: string, acciones?: string[]}} contexto identidad del
 *   cliente y acciones que el motor le permite ahora mismo.
 */
export function mesaVista(vista, { userId = "", acciones = [] } = {}) {
  if (!vista || typeof vista !== "object") {
    return { hayMesa: false, acciones: [], jugadores: [], comunitarias: [] };
  }

  const publico = vista.juegoPublico ?? null;
  const privado = vista.juegoPrivado ?? null;
  const asientos = Array.isArray(vista.jugadores) ? vista.jugadores : [];
  const eresJugador = asientos.some((j) => j?.userId === userId);

  // La mano propia solo existe si ha llegado la vista privada. Un jugador
  // sentado antes del reparto, o un espectador, ven dorsos: es la verdad, y es
  // además lo que se ve en una mesa real.
  const tuMano = Array.isArray(privado?.tuMano) ? privado.tuMano.map(carta) : null;

  const turno = publico?.turno ?? null;
  const manoPorAsiento = new Map(
    (publico?.jugadores ?? []).map((j) => [j.userId, j]),
  );
  // Quién lleva el disco. Va por identidad y no por índice porque los asientos
  // de la mano son solo los que juegan: quien está sentado sin fichas no está
  // en esa lista, y comparar posiciones pondría el disco en el asiento
  // equivocado. Antes del reparto no hay botón que enseñar.
  const conBoton =
    Number.isInteger(publico?.botonIndice) && publico.jugadores?.[publico.botonIndice]
      ? publico.jugadores[publico.botonIndice].userId
      : null;

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
    bote: publico?.bote ?? null,
    apuestaActual: publico?.apuestaActual ?? null,
    subidaMinima: publico?.subidaMinima ?? null,
    comunitarias: (publico?.comunitarias ?? []).map(carta),
    tuMano,
    // Cuántos dorsos pintar cuando no hay mano propia: dos, que es lo que
    // reparte el Texas hold'em. Se dice aquí y no en la plantilla para que la
    // plantilla no tenga que saber de qué juego se trata.
    dorsosPropios: tuMano ? [] : [dorso(), dorso()],
    jugadores: asientos.map((asiento) => {
      const enJuego = manoPorAsiento.get(asiento.userId) ?? null;
      return {
        userId: asiento.userId,
        eresTu: asiento.userId === userId,
        esTurno: turno === asiento.userId,
        esBoton: Boolean(conBoton) && conBoton === asiento.userId,
        // Lo que sigue puede ser null antes del reparto: la mesa existe
        // antes que la mano.
        stack: enJuego?.stack ?? null,
        apostadoRonda: enJuego?.apostadoRonda ?? null,
        retirado: enJuego?.retirado ?? false,
        allIn: enJuego?.allIn ?? false,
        controlador: enJuego?.controlador ?? asiento.controlador ?? null,
      };
    }),
    resultado: vista.resultado ?? null,
    acciones: accionesVisibles(acciones),
  };
}

/**
 * Quién se llevó qué, en líneas listas para escribir. Es puro y vive aquí —y no
 * en la ventana— porque el resultado del póker tiene DOS formas: la mano que se
 * gana sin rival (`ganadorId`/`ganancia`) y el showdown (`ganancias` por
 * identidad, con botes laterales). Leer esas dos formas es saber de póker, y la
 * ventana no tiene por qué.
 *
 * Sin resultado, o con uno que no se reconozca, no se devuelve nada: una mesa
 * que anuncia un ganador inventado es peor que una que no anuncia ninguno.
 */
export function lineasResultado(resultado) {
  if (!resultado || typeof resultado !== "object") return [];
  if (typeof resultado.ganadorId === "string" && Number.isFinite(resultado.ganancia)) {
    return [{ userId: resultado.ganadorId, fichas: resultado.ganancia }];
  }
  const ganancias = resultado.ganancias;
  if (!ganancias || typeof ganancias !== "object") return [];
  return Object.entries(ganancias)
    .filter(([, fichas]) => Number.isFinite(fichas) && fichas > 0)
    .map(([userId, fichas]) => ({ userId, fichas }));
}

/** Acciones con etiqueta, sin las que este módulo no sepa nombrar. */
export function accionesVisibles(acciones) {
  return (Array.isArray(acciones) ? acciones : [])
    .filter((tipo) => typeof tipo === "string" && ETIQUETAS[tipo])
    .map((tipo) => ({
      tipo,
      etiqueta: ETIQUETAS[tipo],
      esDeJuego: tipo.startsWith(PREFIJO_JUEGO),
      requiereImporte: CON_IMPORTE.includes(tipo),
    }));
}
