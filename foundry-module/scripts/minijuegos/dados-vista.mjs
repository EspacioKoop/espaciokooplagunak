// Modelo de presentación de la mesa de dados (#413), hermano de `mesa-vista.mjs`.
//
// Convierte lo que un cliente RECIBE —la vista pública del ajuste de mundo, más
// la privada que le llega por socket si está sentado— en algo que una plantilla
// pueda pintar sin saber del transporte ni del motor.
//
// LA MISMA REGLA QUE EN EL PÓKER, y aquí importa más: este módulo solo sabe lo
// que le han dado. No deduce cubiletes ajenos, no rellena huecos y no adivina
// tiradas. De un cubilete ajeno se sabe CUÁNTOS dados tiene —eso es público, y
// hace falta para juzgar si una apuesta es creíble— y nada más. Una mesa de
// faroleo que enseña de más no es un fallo de estética, es hacer trampas.
//
// Tampoco decide qué se puede hacer: las acciones permitidas las calcula el
// motor de sesión con la identidad autenticada, y aquí solo se les pone
// etiqueta. Un botón de más en pantalla no concede nada.
//
// Puro: ni Foundry, ni DOM, ni red, ni <canvas>. Se prueba desde Node.

import { CARAS } from "./dados-motor.mjs";

const PREFIJO_JUEGO = "act:";

const ETIQUETAS = Object.freeze({
  join: "LAGUNAK.Minijuegos.Accion.Sentarse",
  watch: "LAGUNAK.Minijuegos.Accion.Mirar",
  leave: "LAGUNAK.Minijuegos.Accion.Levantarse",
  return: "LAGUNAK.Minijuegos.Accion.Volver",
  botAdd: "LAGUNAK.Minijuegos.Accion.SentarAutomatico",
  botRemove: "LAGUNAK.Minijuegos.Accion.QuitarAutomatico",
  start: "LAGUNAK.Dados.Accion.Tirar",
  finish: "LAGUNAK.Minijuegos.Accion.Rematar",
  close: "LAGUNAK.Minijuegos.Accion.Cerrar",
  "act:apostar": "LAGUNAK.Dados.Accion.Apostar",
  "act:dudar": "LAGUNAK.Dados.Accion.Dudar",
});

// Apostar es la única que necesita que la persona diga algo: cuántos y de qué
// cara. Dudar es de un clic, y así debe seguir siendo — es la decisión valiente
// y no debe costar más trabajo que la cómoda.
const CON_APUESTA = Object.freeze(["act:apostar"]);

/**
 * @param {object|null} vista lo último recibido: pública, o privada si el
 *   cliente está sentado (la privada es la pública más `juegoPrivado`).
 * @param {{userId?: string, acciones?: string[]}} contexto identidad del
 *   cliente y acciones que el motor le permite ahora mismo.
 */
export function dadosVista(vista, { userId = "", acciones = [] } = {}) {
  if (!vista || typeof vista !== "object") {
    return { hayMesa: false, acciones: [], jugadores: [], caras: [...CARAS] };
  }

  const publico = vista.juegoPublico ?? null;
  const privado = vista.juegoPrivado ?? null;
  const asientos = Array.isArray(vista.jugadores) ? vista.jugadores : [];
  const eresJugador = asientos.some((j) => j?.userId === userId);
  const turno = publico?.turno ?? null;
  const enJuego = new Map((publico?.jugadores ?? []).map((j) => [j.userId, j]));

  // El cubilete propio solo existe si ha llegado la vista privada. Un jugador
  // sentado antes de tirar, o un espectador, no ven ninguno: es la verdad.
  const tuCubilete = Array.isArray(privado?.tuCubilete) ? [...privado.tuCubilete] : null;
  const apuesta = publico?.apuesta ?? null;
  const destape = publico?.destape ?? null;

  return {
    hayMesa: true,
    id: vista.id ?? null,
    juego: vista.juego ?? null,
    fase: vista.fase ?? null,
    rondaEnCurso: Boolean(vista.manoEnCurso),
    rondaCancelada: Boolean(vista.manoCancelada),
    eresJugador,
    eresEspectador:
      !eresJugador && Array.isArray(vista.espectadores) && vista.espectadores.includes(userId),
    esTuTurno: Boolean(userId) && turno === userId,
    unosComodin: publico?.unosComodin !== false,
    dadosEnJuego: publico?.dadosEnJuego ?? null,
    apuesta: apuesta ? { cantidad: apuesta.cantidad, cara: apuesta.cara, userId: apuesta.userId } : null,
    tuCubilete,
    // Las caras posibles, para que la plantilla no tenga que escribir 1..6 a
    // mano ni saber cuántas tiene un dado.
    caras: [...CARAS],
    jugadores: asientos.map((asiento) => {
      const suyo = enJuego.get(asiento.userId) ?? null;
      const propio = asiento.userId === userId;
      return {
        userId: asiento.userId,
        eresTu: propio,
        esTurno: turno === asiento.userId,
        // Cuántos dados tiene: público y necesario para juzgar una apuesta.
        dados: suyo?.dados ?? null,
        eliminado: Boolean(suyo?.eliminado),
        controlador: suyo?.controlador ?? asiento.controlador ?? null,
        // Los VALORES solo del propio, y solo si llegó la vista privada. Para
        // los demás va `null`, que es lo que el pintor entiende como «dibuja
        // cubos lisos»: no hay nada que tapar porque no hay nada que enseñar.
        valores: propio ? tuCubilete : null,
        // Tras el destape sí se ven todos: la ronda terminó y es lo que hace el
        // resultado comprobable para la mesa entera.
        destapado: destape?.cubiletes?.[asiento.userId] ?? null,
      };
    }),
    destape: destape
      ? {
        cantidad: destape.apuesta?.cantidad ?? null,
        cara: destape.apuesta?.cara ?? null,
        reales: destape.reales ?? null,
        apuestaSostenida: Boolean(destape.apuestaSostenida),
        dudadorId: destape.dudadorId ?? null,
        perdedorId: destape.perdedorId ?? null,
      }
      : null,
    resultado: vista.resultado ?? null,
    acciones: accionesVisibles(accionesEfectivas(vista, acciones, eresJugador, userId)),
    // Qué apuesta propone la interfaz por defecto: la más barata que superaría a
    // la viva. Se calcula aquí, en lo puro, porque es aritmética de las reglas y
    // no decoración; el motor la revalida igual.
    sugerencia: sugerenciaDeApuesta(apuesta, publico?.dadosEnJuego ?? 0),
  };
}

/**
 * La apuesta más barata que superaría a la viva: misma cantidad con la cara
 * siguiente, y si ya no queda cara, un dado más empezando por la más baja.
 *
 * No es la jugada recomendada —eso es cosa de quien juega— sino el punto de
 * partida del formulario, para que nadie tenga que teclear desde cero lo que la
 * regla ya obliga a superar.
 */
export function sugerenciaDeApuesta(apuesta, dadosEnJuego) {
  const techo = Number.isInteger(dadosEnJuego) && dadosEnJuego > 0 ? dadosEnJuego : 1;
  if (!apuesta) return { cantidad: 1, cara: CARAS[0] };
  if (apuesta.cara < CARAS[CARAS.length - 1]) {
    return { cantidad: apuesta.cantidad, cara: apuesta.cara + 1 };
  }
  return { cantidad: Math.min(techo, apuesta.cantidad + 1), cara: CARAS[0] };
}

/**
 * Qué acciones se pintan. Mismo criterio que en el póker, y por el mismo motivo:
 * manda lo que el coordinador concedió a ESTE cliente, y el respaldo son las
 * acciones «de forastero» de la vista pública, que solo valen para quien no
 * participa. Sin ese respaldo, un cliente que se pierde su envío dirigido ve una
 * mesa sin un solo botón, indistinguible de una que no le deja entrar.
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
      requiereApuesta: CON_APUESTA.includes(tipo),
    }));
}
