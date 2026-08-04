// Bucle de andar (#427): lo único de "moverse por la nave" que toca un
// <canvas> y un reloj. `nave-movimiento.mjs` sabe colisionar y desplazar un
// punto; esto es la otra mitad —pedir fotogramas, leer qué teclas están
// pulsadas AHORA y pintar—, igual que `cantina-lienzo.mjs` es la otra mitad
// de `cantina-escena.mjs`.
//
// NO SABE DE NINGUNA SALA CONCRETA. Recibe `componer(x, z, yaw) -> escena` ya
// inyectado: quien llama decide qué geometría hay y con qué cámara se compone
// (mismo contrato que devuelve `retro3d.componerEscena`). Así este módulo es
// el runtime compartido de "andar" y cada sala/módulo de la nave aporta su
// propia composición sin que esto necesite saber que existen — la misma idea
// que `registrarJuego` en minijuegos o `crearCatalogo` en asistencia, pero
// para render en vez de para reglas.
//
// NO IMPORTA FOUNDRY. Recibe el lienzo y ya está, igual que `cantina-lienzo.
// mjs`: se prueba en Node con un lienzo de mentira y un `pedirFotograma` que
// el test dispara a mano.
//
// EL MOVIMIENTO ES OPCIONAL, NO DECORATIVO (mismo contrato que #227 y que
// `cantina-lienzo.mjs`): bajo `prefers-reduced-motion` no hay bucle continuo,
// pero aquí "movimiento" es la respuesta a pulsar una tecla, no un giro
// ambiental — apagar el bucle apagaría el propio andar. Por eso la preferencia
// no para el juego: solo evita CUALQUIER interpolación que no dependa
// directamente de una tecla mantenida (hoy no hay ninguna). Queda documentado
// aquí porque es la primera superficie del módulo donde `reducirMovimiento`
// NO es la respuesta correcta, y conviene que quien la toque sepa por qué.

import { mover } from "./nave-movimiento.mjs";
import { pintarEscena } from "./retro3d-lienzo.mjs";

/** Ritmo al que gira la cámara mientras se mantiene "girar-izq"/"girar-der". */
const VELOCIDAD_GIRO = Math.PI * 0.6; // radianes por segundo

/**
 * Arranca el andar en un lienzo. Devuelve el mando: pulsar/soltar dirección,
 * girar, leer la posición y parar.
 *
 * @param {HTMLCanvasElement} lienzo
 * @param {{
 *   componer: (x:number, z:number, yaw:number) => object,
 *   planta: object,
 *   x?: number, z?: number, yaw?: number,
 *   velocidad?: number, radio?: number, velocidadGiro?: number,
 *   fondo?: string|null,
 *   ahora?: () => number,
 *   pedirFotograma?: (cb: (ms:number) => void) => number,
 *   cancelarFotograma?: (id: number) => void,
 * }} opciones
 */
export function arrancarAndar(lienzo, opciones = {}) {
  const {
    componer,
    planta,
    velocidad = 2.2,
    radio = 0.35,
    velocidadGiro = VELOCIDAD_GIRO,
    fondo = null,
    ahora = () => globalThis.performance?.now?.() ?? Date.now(),
    pedirFotograma,
    cancelarFotograma,
  } = opciones;

  if (typeof componer !== "function") {
    throw new TypeError("arrancarAndar requiere `componer(x, z, yaw)`");
  }

  let x = Number.isFinite(opciones.x) ? opciones.x : planta.ancho / 2;
  let z = Number.isFinite(opciones.z) ? opciones.z : planta.profundidad / 2;
  let yaw = Number.isFinite(opciones.yaw) ? opciones.yaw : 0;

  const activas = new Set();
  let girando = 0; // -1 izquierda, 0 quieto, +1 derecha
  let vivo = true;
  let fotograma = null;
  let anterior = ahora();

  function pintarUnaVez() {
    const ctx = lienzo?.getContext?.("2d");
    if (!ctx) return;
    pintarEscena(ctx, componer(x, z, yaw), { fondo });
  }

  function paso(ms) {
    if (!vivo) return;
    const ahoraMs = Number.isFinite(ms) ? ms : ahora();
    const dt = Math.max(0, (ahoraMs - anterior) / 1000);
    anterior = ahoraMs;

    if (girando !== 0) yaw += girando * velocidadGiro * dt;
    const siguiente = mover({ x, z, yaw, activas, dt, planta, velocidad, radio });
    x = siguiente.x;
    z = siguiente.z;

    pintarUnaVez();
    fotograma = pedirFotograma?.(paso) ?? null;
  }

  pintarUnaVez();
  if (pedirFotograma) fotograma = pedirFotograma(paso);

  return {
    /** Mantiene una dirección activa ("adelante"/"atras"/"izquierda"/"derecha"). */
    pulsar(direccion) {
      activas.add(direccion);
    },
    /** Suelta una dirección. Soltar una que no estaba activa no hace nada. */
    soltar(direccion) {
      activas.delete(direccion);
    },
    /** Gira mientras se mantenga: -1 izquierda, 0 quieto, 1 derecha. */
    girar(sentido) {
      girando = Math.sign(sentido) || 0;
    },
    /** Posición y orientación actuales, para quien necesite leerlas (p. ej.
     *  para guardarlas en un flag al cerrar la ventana). */
    posicion() {
      return { x, z, yaw };
    },
    /** Sin bucle (lienzo de prueba o `pedirFotograma` ausente), avanza un
     *  paso a mano — es lo que usa un test para no depender de un reloj real. */
    pintarUnaVez,
    avanzar(dtMs) {
      paso(anterior + dtMs);
    },
    detener() {
      vivo = false;
      if (fotograma !== null) cancelarFotograma?.(fotograma);
      fotograma = null;
    },
  };
}
