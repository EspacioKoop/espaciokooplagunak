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

import { mover, puertaTocada } from "./nave-movimiento.mjs";
import { pintarEscena } from "./retro3d-lienzo.mjs";

/** Ritmo al que gira la cámara mientras se mantiene "girar-izq"/"girar-der". */
const VELOCIDAD_GIRO = Math.PI * 0.6; // radianes por segundo

/**
 * Arranca el andar en un lienzo. Devuelve el mando: pulsar/soltar dirección,
 * girar, leer la posición y parar.
 *
 * @param {HTMLCanvasElement} lienzo
 * @param {{
 *   componer: (x:number, y:number, z:number, yaw:number, opciones?:{otrosJugadores?:Array}) => object,
 *   planta: object,
 *   puertas?: Array<{rect:object, destino:object}>,
 *   alTocarPuerta?: (destino:object) => void,
 *   x?: number, z?: number, y?: number, yaw?: number,
 *   velocidad?: number, radio?: number, velocidadGiro?: number,
 *   fondo?: string|null,
 *   ahora?: () => number,
 *   pedirFotograma?: (cb: (ms:number) => void) => number,
 *   cancelarFotograma?: (id: number) => void,
 *   otrosJugadores?: () => Array<{x:number, y:number, z:number, avatar?:object}>,
 * }} opciones
 */
export function arrancarAndar(lienzo, opciones = {}) {
  const {
    velocidad = 2.2,
    radio = 0.35,
    velocidadGiro = VELOCIDAD_GIRO,
    fondo = null,
    ahora = () => globalThis.performance?.now?.() ?? Date.now(),
    pedirFotograma,
    cancelarFotograma,
    // Función y no array a propósito: se evalúa en cada fotograma pintado,
    // nunca una sola vez al arrancar — igual que `ahora`, este bucle no
    // conoce el reloj/red por su cuenta, solo pide el dato fresco cuando le
    // toca pintar (#498, follow-up de #453).
    otrosJugadores = () => [],
  } = opciones;

  if (typeof opciones.componer !== "function") {
    throw new TypeError("arrancarAndar requiere `componer(x, y, z, yaw)`");
  }

  // `planta`, `componer`, `puertas` y `alTocarPuerta` son mutables a
  // propósito: `cambiarEstancia` los reemplaza sin reiniciar el bucle de
  // fotogramas ni la ventana que lo contiene — es la costura entre salas.
  let planta = opciones.planta;
  let componer = opciones.componer;
  let puertas = Array.isArray(opciones.puertas) ? opciones.puertas : [];
  let alTocarPuerta = typeof opciones.alTocarPuerta === "function" ? opciones.alTocarPuerta : null;

  let x = Number.isFinite(opciones.x) ? opciones.x : planta.ancho / 2;
  let z = Number.isFinite(opciones.z) ? opciones.z : planta.profundidad / 2;
  let y = Number.isFinite(opciones.y) ? opciones.y : 0;
  let velocidadY = 0;
  let yaw = Number.isFinite(opciones.yaw) ? opciones.yaw : 0;

  const activas = new Set();
  let girando = 0; // -1 izquierda, 0 quieto, +1 derecha
  let vivo = true;
  let fotograma = null;
  let anterior = ahora();

  function pintarUnaVez() {
    const ctx = lienzo?.getContext?.("2d");
    if (!ctx) return;
    pintarEscena(ctx, componer(x, y, z, yaw, { otrosJugadores: otrosJugadores() }), { fondo });
  }

  function paso(ms) {
    if (!vivo) return;
    const ahoraMs = Number.isFinite(ms) ? ms : ahora();
    const dt = Math.max(0, (ahoraMs - anterior) / 1000);
    anterior = ahoraMs;

    if (girando !== 0) yaw += girando * velocidadGiro * dt;
    const siguiente = mover({ x, z, y, velocidadY, yaw, activas, dt, planta, velocidad, radio });
    x = siguiente.x;
    z = siguiente.z;
    y = siguiente.y;
    velocidadY = siguiente.velocidadY;

    // Se comprueba DESPUÉS de mover, con la posición ya resuelta: una puerta
    // no bloquea (`mover` no la conoce), así que su detección no puede
    // adelantarse al desplazamiento sin leer una posición que todavía no es
    // la real de este fotograma.
    if (alTocarPuerta) {
      const puerta = puertaTocada(x, z, radio, puertas);
      if (puerta) alTocarPuerta(puerta.destino);
    }

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
     *  para guardarlas en un flag al cerrar la ventana). `y` es la altura de
     *  salto/agachado, no la de ojos —ver `nave-movimiento.mover`. */
    posicion() {
      return { x, z, y, yaw };
    },
    /**
     * Cambia de estancia SIN reiniciar el bucle de fotogramas: sustituye la
     * planta de colisión, la composición de render, sus puertas y la
     * posición/orientación de llegada. Es la costura entre salas — quien
     * decide CUÁNDO llamarla (típicamente al recibir `alTocarPuerta`) es capa
     * de arriba (el catálogo de estancias o quien lo consulte), nunca este
     * módulo: aquí solo se aplica el cambio ya decidido.
     */
    cambiarEstancia({ planta: nuevaPlanta, componer: nuevoComponer, puertas: nuevasPuertas, x: nx, z: nz, yaw: nYaw }) {
      if (nuevaPlanta) planta = nuevaPlanta;
      if (typeof nuevoComponer === "function") componer = nuevoComponer;
      puertas = Array.isArray(nuevasPuertas) ? nuevasPuertas : [];
      if (Number.isFinite(nx)) x = nx;
      if (Number.isFinite(nz)) z = nz;
      if (Number.isFinite(nYaw)) yaw = nYaw;
      // Cruzar una puerta siempre aterriza de pie: un salto no sobrevive al
      // corte de estancia, igual que ninguna otra inercia lo hace.
      y = 0;
      velocidadY = 0;
      // Sin bucle propio (lienzo de prueba), quien llama necesita ver el
      // cambio reflejado de inmediato y no esperar a un `avanzar` posterior.
      pintarUnaVez();
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
