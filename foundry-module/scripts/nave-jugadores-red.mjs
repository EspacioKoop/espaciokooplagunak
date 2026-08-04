// Estado puro de "quién anda por dónde" (#453): un registro en memoria de la
// última posición conocida de cada jugador remoto, indexado por estancia.
//
// SOLO GUARDA MUESTRAS CONFIRMADAS Y NUNCA EXTRAPOLA — la misma regla que ya
// sigue el mapa vivo (`ventana-nave.mjs`) para su interpolación: sin una
// muestra reciente de un jugador, ese jugador simplemente no está en la lista
// que devuelve `enEstancia`, no se le inventa una posición a partir de la
// última que se supo de él.
//
// Puro: ni Foundry, ni socket, ni reloj — el "ahora" entra siempre como
// parámetro para que el test lo controle.

/** Pasado este tiempo sin una muestra nueva, un jugador se considera
 *  desconectado/con la ventana cerrada y deja de listarse. */
export const VENCE_PASADO_MS = 4000;

/**
 * @param {{vencePasadoMs?: number}} opciones
 */
export function crearRegistroJugadores({ vencePasadoMs = VENCE_PASADO_MS } = {}) {
  const jugadores = new Map();

  return {
    /** Registra/actualiza la última muestra conocida de `userId`. Una muestra
     *  con campos no numéricos o sin estancia se descarta entera: peor es
     *  pintar a alguien en un sitio a medias que no pintarlo. */
    actualizar(userId, estado, ahoraMs) {
      if (!userId || !estado || typeof estado.estancia !== "string") return;
      const { estancia, x, y, z, yaw } = estado;
      if (![x, y, z, yaw].every(Number.isFinite)) return;
      jugadores.set(userId, { estancia, x, y, z, yaw, recibidoEn: ahoraMs });
    },

    /** Quita a un jugador explícitamente (p. ej. al cerrar sesión o su
     *  ventana): no hace falta esperar a que caduque solo. */
    quitar(userId) {
      jugadores.delete(userId);
    },

    /** Jugadores vivos (muestra no caducada) presentes en `estancia`, sin el
     *  identificador de red — solo lo que hace falta para pintarlos. */
    enEstancia(estancia, ahoraMs) {
      const vivos = [];
      for (const datos of jugadores.values()) {
        if (datos.estancia !== estancia) continue;
        if (ahoraMs - datos.recibidoEn > vencePasadoMs) continue;
        vivos.push({ x: datos.x, y: datos.y, z: datos.z, yaw: datos.yaw });
      }
      return vivos;
    },
  };
}
