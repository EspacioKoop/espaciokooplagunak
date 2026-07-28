// Resolución de los turnos que lleva la máquina (#308).
//
// El motor de sesión no tiene reloj ni sabe de NPCs, y el agente automático no
// sabe de sesiones: solo mira una vista y decide. Faltaba quien los presentara,
// y esa es esta pieza —la que hace que un asiento automático juegue en vez de
// dejar la mano colgada esperando a nadie.
//
// Puro: ni Foundry, ni red, ni reloj. La política llega inyectada (`decidir`),
// así que se puede probar con un agente de mentira y sustituir por otro más
// listo sin tocar nada de esto.
//
// DOS REGLAS QUE SOSTIENEN EL RESTO:
//
// - Los NPC pasan por la MISMA puerta que las personas: `aplicar`, con su sobre,
//   su época y su nonce. No hay un atajo que escriba el estado del juego a mano.
//   Si el motor rechaza la jugada de un NPC, se rechaza de verdad y se para.
// - Se para SIEMPRE, pase lo que pase. Un agente que devolviera una acción que
//   el motor no acepta dejaría al coordinador dando vueltas en un bucle
//   infinito, colgando el navegador de quien lleva la mesa: hay un límite duro
//   de jugadas y cualquier rechazo corta la cadena.

import {
  accionesPermitidas,
  aplicar,
  esAutomatico,
  vistaPrivadaSesion,
} from "./sesion-motor.mjs";

const PREFIJO_JUEGO = "act:";

// Tope de jugadas encadenadas en una sola llamada. Generoso para una mano
// completa entre NPCs (cuatro rondas, seis asientos), y finito, que es lo que
// importa.
export const LIMITE_JUGADAS = 64;

/**
 * Deja que jueguen los asientos automáticos hasta que el turno vuelva a ser de
 * una persona, la mano termine, o se agote el límite.
 *
 * @param {object} sesion sesión viva del coordinador.
 * @param {object} opciones
 * @param {object} opciones.juego vertical alojado (el motor de póker).
 * @param {(vista: object, acciones: string[]) => object|null} opciones.decidir
 *   política del agente: recibe la vista PRIVADA del juego y sus acciones sin
 *   prefijo, y devuelve `{ tipo, parametros }` o null para no jugar.
 * @returns {{sesion: object, jugadas: object[], cortadoPor: string|null}}
 *   la sesión resultante (la misma instancia si no jugó nadie), lo que se jugó
 *   —para poder contarlo en la bitácora— y por qué se paró.
 */
export function resolverTurnosAutomaticos(
  sesion,
  { juego, decidir, limite = LIMITE_JUGADAS } = {},
) {
  let actual = sesion;
  const jugadas = [];
  if (typeof decidir !== "function" || !juego) return { sesion, jugadas, cortadoPor: "sin_agente" };

  for (let vuelta = 0; vuelta < limite; vuelta += 1) {
    const turno = turnoAutomatico(actual);
    if (!turno) return { sesion: actual, jugadas, cortadoPor: null };

    const vista = vistaPrivadaSesion(actual, turno, juego).juegoPrivado ?? null;
    const acciones = accionesPermitidas(actual, turno, juego)
      .filter((accion) => accion.startsWith(PREFIJO_JUEGO))
      .map((accion) => accion.slice(PREFIJO_JUEGO.length));
    if (!vista || acciones.length === 0) return { sesion: actual, jugadas, cortadoPor: "sin_acciones" };

    let decision = null;
    try {
      decision = decidir(vista, acciones);
    } catch {
      // Una política que revienta no puede llevarse por delante la mesa entera:
      // el turno se queda donde está y lo resuelve una persona.
      return { sesion: actual, jugadas, cortadoPor: "agente_roto" };
    }
    if (!decision?.tipo) return { sesion: actual, jugadas, cortadoPor: "sin_decision" };

    const resultado = aplicar(actual, {
      sobre: {
        sessionId: actual.publico.id,
        epocaCoordinador: actual.publico.epocaCoordinador,
        // El nonce lo genera el coordinador y lleva la revisión dentro, así que
        // no se repite ni hace falta azar para construirlo.
        nonce: `${turno}#${actual.publico.revision}`,
        tipo: "act",
        parametros: { tipo: decision.tipo, parametros: decision.parametros ?? {} },
      },
      actorId: turno,
      juego,
    });
    if (!resultado.ok) {
      // El motor manda. Si dice que no, se para: insistir sería discutir con las
      // reglas, y el turno lo puede desatascar quien lleva la mesa.
      return { sesion: actual, jugadas, cortadoPor: resultado.codigo };
    }
    actual = resultado.sesion;
    jugadas.push({ userId: turno, tipo: decision.tipo, parametros: decision.parametros ?? {} });
  }
  return { sesion: actual, jugadas, cortadoPor: "limite" };
}

/** Identidad del asiento automático al que le toca, o null si no toca a ninguno. */
function turnoAutomatico(sesion) {
  const { publico } = sesion;
  if (!publico.manoEnCurso) return null;
  const turno = publico.juegoPublico?.turno ?? null;
  return esAutomatico(turno) ? turno : null;
}
