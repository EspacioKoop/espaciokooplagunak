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
import { ANCHO, altoDePila, pilaDataUri, pilaDeFichas } from "./fichas-pixelart.mjs";

// Cuántas cartas tiene una mano de Texas hold'em y cuántas llegan al tapete.
// Vive aquí, y no en la plantilla, por la misma razón que `dorsosPropios`: la
// plantilla no tiene por qué saber a qué se juega.
const CARTAS_POR_MANO = 2;
const COMUNITARIAS_TOTALES = 5;

// Acciones del marco de sesión frente a acciones del juego, que llegan con
// prefijo `act:`. La distinción ya la hace `sesion-motor.mjs`; aquí se
// aprovecha para etiquetarlas por separado.
const PREFIJO_JUEGO = "act:";

const ETIQUETAS = Object.freeze({
  join: "LAGUNAK.Minijuegos.Accion.Sentarse",
  watch: "LAGUNAK.Minijuegos.Accion.Mirar",
  leave: "LAGUNAK.Minijuegos.Accion.Levantarse",
  return: "LAGUNAK.Minijuegos.Accion.Volver",
  botAdd: "LAGUNAK.Minijuegos.Accion.SentarAutomatico",
  botRemove: "LAGUNAK.Minijuegos.Accion.QuitarAutomatico",
  start: "LAGUNAK.Minijuegos.Accion.Repartir",
  finish: "LAGUNAK.Minijuegos.Accion.Rematar",
  close: "LAGUNAK.Minijuegos.Accion.Cerrar",
  "act:fold": "LAGUNAK.Minijuegos.Accion.Retirarse",
  "act:check": "LAGUNAK.Minijuegos.Accion.Pasar",
  "act:call": "LAGUNAK.Minijuegos.Accion.Igualar",
  "act:raise": "LAGUNAK.Minijuegos.Accion.Subir",
  // "mostrar" no tiene botón propio (#458): se dispara arrastrando o pulsando
  // una carta de la mano propia, nunca de una lista de acciones genérica — la
  // carta que se enseña es parte del gesto, no un parámetro aparte que haya
  // que teclear. La etiqueta que sigue existe solo para que
  // `accionesVisibles` no la descarte por desconocida al filtrar la lista que
  // llega del motor; `mesaVista` nunca la deja llegar a `acciones`.
  "act:mostrar": "LAGUNAK.Minijuegos.Accion.Mostrar",
});

// Acciones de juego que se disparan desde una carta (arrastre o clic), no
// desde la lista de botones de `.lagunak-mesa-acciones`. Se excluyen ahí para
// no duplicar el gesto como botón Y como carta arrastrable.
const ACCIONES_DE_CARTA = Object.freeze(["act:mostrar"]);

// Solo `raise` necesita que la persona diga cuánto. El resto son de un clic.
const CON_IMPORTE = Object.freeze(["act:raise"]);

function carta(codigo) {
  return { codigo, imagen: cartaDataUri(codigo) };
}

/**
 * Carta de la mano propia con lo que hace falta para poder arrastrarla:
 * `indice` (lo que identifica la carta para el motor, ver `carta-intento.mjs`)
 * y `puedeMostrar` (ya se ha mostrado, o el motor ya no lo permite ahora
 * mismo — mano terminada, retirado). Sin `puedeMostrar` la carta se pinta
 * igual, pero no arrastrable ni clicable: un dedo de más en la interfaz no
 * puede colar una jugada que el motor rechazaría de todos modos, pero si no
 * se puede no hace falta ni intentarlo.
 */
function cartaPropia(codigo, indice, codigosMostrados, puedeMostrarEnGeneral) {
  return {
    ...carta(codigo),
    indice,
    puedeMostrar: puedeMostrarEnGeneral && !codigosMostrados.has(codigo),
  };
}

/** Dorso: lo que se pinta donde hay una carta que NO se tiene derecho a ver. */
function dorso() {
  return { codigo: null, imagen: dorsoDataUri() };
}

/**
 * Montón de fichas de una cantidad: una ficha por denominación, con su cuenta.
 *
 * Es puro adorno con dos condiciones: no puede aparecer donde no hay cifra
 * —una mesa antes del reparto no tiene stacks, y dibujar fichas ahí sería
 * inventarse un estado— y no puede sustituir al número, que sigue escrito al
 * lado para quien no vea el montón.
 */
function monton(cantidad) {
  return pilaDeFichas(cantidad).map(({ valor, cuenta }) => ({
    valor,
    cuenta,
    // El montón se dibuja apilado: la altura es lo que se lee de un vistazo.
    // `ancho`/`alto` son el tamaño del lienzo del arte y viajan con la imagen
    // para escribirlos como atributos del `<img>`: con ellos el navegador
    // reserva el hueco por proporción antes de decodificar el `data:` URI, y la
    // fila del asiento no da un salto cada vez que alguien apuesta y el montón
    // cambia de altura. El tamaño en pantalla lo sigue poniendo el CSS.
    imagen: pilaDataUri(valor, cuenta),
    ancho: ANCHO,
    alto: altoDePila(cuenta),
  }));
}

/** Tantos huecos como cartas comunitarias falten por salir. */
function huecos(repartidas) {
  const faltan = Math.max(0, COMUNITARIAS_TOTALES - repartidas);
  return Array.from({ length: faltan }, () => ({}));
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
  const puedeMostrarEnGeneral = (Array.isArray(acciones) ? acciones : []).includes(
    "act:mostrar",
  );
  const tuMano = Array.isArray(privado?.tuMano)
    ? (() => {
        // `cartasMostradas` viaja como CÓDIGOS ("As"), no como índices — es la
        // vista pública, y el índice en la mano de otro no es asunto de nadie
        // más. Para saber qué índice propio ya está mostrado, se compara por
        // código contra la propia mano: dos cartas iguales en una mano de dos
        // no pueden darse (52 cartas, sin repetición).
        const codigosMostrados = new Set(publico?.cartasMostradas?.[userId] ?? []);
        return privado.tuMano.map((codigo, indice) =>
          cartaPropia(codigo, indice, codigosMostrados, puedeMostrarEnGeneral),
        );
      })()
    : null;

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
    botePila: monton(publico?.bote),
    apuestaActual: publico?.apuestaActual ?? null,
    subidaMinima: publico?.subidaMinima ?? null,
    comunitarias: (publico?.comunitarias ?? []).map(carta),
    // Los huecos son la diferencia entre «aún no han salido» y «esta mano no
    // llega al river»: sin ellos, el flop y el showdown se ven igual de llenos.
    huecosComunitarios: huecos((publico?.comunitarias ?? []).length),
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
        pila: monton(enJuego?.stack),
        apostadoRonda: enJuego?.apostadoRonda ?? null,
        apuestaPila: monton(enJuego?.apostadoRonda),
        // Cartas boca abajo del asiento AJENO: solo si esa persona sigue en la
        // mano. La propia no se dobla aquí — se ve entera más abajo—, y quien
        // se retiró no tiene cartas que enseñar. Es dorso, nunca deducción: de
        // la mano ajena este módulo no sabe nada y no puede saberlo.
        cartasOcultas:
          !enJuego || enJuego.retirado || asiento.userId === userId
            ? []
            : Array.from({ length: CARTAS_POR_MANO }, dorso),
        retirado: enJuego?.retirado ?? false,
        allIn: enJuego?.allIn ?? false,
        controlador: enJuego?.controlador ?? asiento.controlador ?? null,
      };
    }),
    resultado: vista.resultado ?? null,
    acciones: accionesVisibles(accionesEfectivas(vista, acciones, eresJugador, userId)),
  };
}

/**
 * Qué acciones se pintan.
 *
 * Manda siempre lo que el coordinador concedió a ESTE cliente. Pero ese envío
 * es dirigido y puede perderse —llega por socket, y un cliente que aún no
 * escuchaba se lo pierde entero—, y entonces la mesa se veía sin un solo botón:
 * indistinguible de una mesa que no te deja entrar.
 *
 * El respaldo son las acciones «de forastero» que el coordinador publica en la
 * vista pública, y que solo se usan si este cliente NO participa: son las de
 * entrar (sentarse, mirar), iguales para cualquiera de fuera y calculadas por
 * quien tiene la autoridad, no deducidas aquí. A un participante no se le
 * ofrecen nunca: sus acciones dependen de su sitio en la mano y esas sí exigen
 * el envío dirigido.
 */
function accionesEfectivas(vista, acciones, eresJugador, userId) {
  if (Array.isArray(acciones) && acciones.length > 0) return acciones;
  if (eresJugador) return [];
  const espectador = Array.isArray(vista.espectadores) && vista.espectadores.includes(userId);
  if (espectador) return [];
  return Array.isArray(vista.accionesForastero) ? vista.accionesForastero : [];
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
    .filter(
      (tipo) =>
        typeof tipo === "string" && ETIQUETAS[tipo] && !ACCIONES_DE_CARTA.includes(tipo),
    )
    .map((tipo) => ({
      tipo,
      etiqueta: ETIQUETAS[tipo],
      esDeJuego: tipo.startsWith(PREFIJO_JUEGO),
      requiereImporte: CON_IMPORTE.includes(tipo),
    }));
}
