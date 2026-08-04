// Cableado Foundry de "ver a los demás andar por la nave" (#453): la capa de
// red que #427 y el PR #444 dejaron fuera a propósito.
//
// ## Transporte: por qué esto SÍ usa `game.socket` directo
//
// El resto del módulo que habla por socket (`asistencia-wiring.mjs`, el relé
// de órdenes) NUNCA acredita una identidad declarada en el mensaje: la
// petición viaja en el flag del propio `User` autenticado y el GM la recoge
// por `updateUser`, porque ahí sí el documento que cambió ES la identidad.
// Aquí se rompe esa norma a propósito, y por eso queda escrito: la posición de
// andar es SOLO decorativa —ni afecta a sistemas, ni a daño, ni a ninguna
// autoridad de partida (`ADR-0002`)—, así que suplantar el `userId` de otro
// jugador en este canal como mucho lo teletransporta de mentira en la vista
// de los demás, exactamente igual de inocuo que ya es hoy que cada uno lea su
// propio flag `posicionNave` sin que nadie lo verifique. Pedir el trámite
// GM-en-medio para un dato puramente cosmético que se muestrea varias veces
// por segundo habría añadido latencia y carga al GM sin cerrar un riesgo real.
// Si esto alguna vez importa para algo con autoridad, ese día deja de valer
// este archivo.
//
// ## Muestreo
//
// Se emite a intervalo fijo (~200ms, ver `INTERVALO_MUESTREO_MS`), no cada
// fotograma: mismo motivo que documenta `nave-jugadores-red.mjs` para no
// extrapolar — aquí es no inundar la red mientras alguien anda.
//
// Capa fina y no testeable en Node —usa globales de Foundry—: la única lógica
// de verdad vive en `nave-jugadores-red.mjs`, ya cubierta por pruebas.

import { MODULE_ID } from "./lagunak-constantes.mjs";
import { crearRegistroJugadores } from "./nave-jugadores-red.mjs";

const TIPO_POSICION = "andarNavePosicion";
const INTERVALO_MUESTREO_MS = 200;

function canalSocket() {
  return `module.${MODULE_ID}`;
}

/**
 * Arranca la sincronía: escucha las posiciones que emiten los demás clientes
 * y empieza a emitir la propia a intervalo fijo.
 *
 * @param {{registro?: object, ahora?: () => number, intervaloMs?: number}} opciones
 */
export function iniciarSincroniaJugadores({
  registro = crearRegistroJugadores(),
  ahora = () => globalThis.performance?.now?.() ?? Date.now(),
  intervaloMs = INTERVALO_MUESTREO_MS,
} = {}) {
  const receptor = (mensaje) => {
    if (mensaje?.tipo !== TIPO_POSICION) return;
    // La propia posición ya se conoce localmente (es la cámara de quien
    // juega): no hace falta enterarse de ella por la vuelta del broadcast.
    if (!mensaje?.userId || mensaje.userId === game.user?.id) return;
    registro.actualizar(mensaje.userId, mensaje.estado, ahora());
  };
  game.socket?.on(canalSocket(), receptor);

  // Guardado por `reportar` en vez de leído de un `mando` mantenido aquí: esta
  // capa no sabe qué es un `mando` de `arrancarAndar`, solo el estado plano
  // que ya le hayan resuelto — mismo desacoplo que el resto del módulo.
  let ultimoEstado = null;

  let intervalo = globalThis.setInterval?.(() => {
    if (!game.socket || !ultimoEstado) return;
    game.socket.emit(canalSocket(), { tipo: TIPO_POSICION, userId: game.user?.id, estado: ultimoEstado });
  }, intervaloMs);

  return {
    registro,
    /** Actualiza qué posición se emitirá en el próximo tick del intervalo.
     *  Llamar cada vez que cambie la estancia o la posición (p. ej. desde el
     *  bucle de pintado) es barato: el envío de verdad lo sigue marcando
     *  `intervaloMs`, esto solo deja lista la fotografía más reciente. */
    reportar(estancia, { x, y, z, yaw }) {
      ultimoEstado = { estancia, x, y, z, yaw };
    },
    /** Jugadores vivos (misma estancia, muestra no caducada) para pasarle a
     *  `nave-jugadores-render.componerConJugadores`. */
    jugadoresEnEstancia(estancia) {
      return registro.enEstancia(estancia, ahora());
    },
    detener() {
      game.socket?.off?.(canalSocket(), receptor);
      if (intervalo !== undefined) globalThis.clearInterval?.(intervalo);
      intervalo = undefined;
    },
  };
}
