// Lo único de la cantina que toca un <canvas> y un reloj (#423 sobre #362).
//
// La sala (`cantina-escena.mjs`) y los objetos que giran (`cantina-icono.mjs`)
// son geometría pura y no saben pintar; el pintor es `retro3d-lienzo.mjs`. Aquí
// está lo que falta entre las dos cosas: un bucle que pregunta la escena del
// instante y la vuelca, y el asomo de la cámara.
//
// NO IMPORTA FOUNDRY. Recibe elementos de lienzo y ya está, igual que hace
// `retro3d-lienzo.mjs`. Eso lo deja probable en Node con lienzos de mentira, que
// es como está cubierto — la ventana (`cantina-app.mjs`) solo le pasa el DOM.
//
// EL MOVIMIENTO ES OPCIONAL, NO DECORATIVO. Bajo `prefers-reduced-motion` no hay
// bucle: se pinta UN fotograma y se acabó. La sala sigue estando y las puertas
// siguen abriendo — lo que desaparece es el giro, no la información. Es la misma
// regla que el resto del módulo (#227), y por eso el bucle está construido para
// poder no existir en vez de para poder pararse.

import { componerCantina } from "./cantina-escena.mjs";
import { componerIcono } from "./cantina-icono.mjs";
import { CANTINA } from "./paleta.mjs";
import { pintarEscena } from "./retro3d-lienzo.mjs";

/**
 * Normaliza un punto del ratón a −1..1 sobre un rectángulo. Fuera del
 * rectángulo NO se recorta aquí: `componerCantina` ya acota, y recortar dos
 * veces esconde de dónde vino un valor raro.
 */
export function miradaDesdePunto({ x, y }, rect) {
  const ancho = rect?.width || 1;
  const alto = rect?.height || 1;
  return {
    x: ((x - (rect?.left ?? 0)) / ancho) * 2 - 1,
    // Y invertida: en pantalla crece hacia abajo y en la sala hacia arriba.
    // Sin esto, asomarse hacia arriba agacha la cámara y nadie sabe por qué.
    // Se resta en vez de negar el resultado para no devolver un `-0` en el
    // centro exacto: es el mismo número, pero `deepEqual` no lo cree.
    y: (((rect?.top ?? 0) + alto - y) / alto) * 2 - 1,
  };
}

/** Cuánto mueve una pulsación de flecha, en unidades de mirada. Un paso corto:
 * el teclado tiene que poder recorrer el rango entero sin parecer un salto. */
export const PASO_TECLADO = 0.25;

const TECLAS = Object.freeze({
  ArrowLeft: { x: -PASO_TECLADO, y: 0 },
  ArrowRight: { x: PASO_TECLADO, y: 0 },
  ArrowUp: { x: 0, y: PASO_TECLADO },
  ArrowDown: { x: 0, y: -PASO_TECLADO },
});

/** Mirada tras pulsar una tecla, acotada a −1..1. Devuelve `null` si esa tecla
 * no es de las que mueven, para que quien llame sepa si consumirla. */
export function miradaTrasTecla(mirada, tecla) {
  const paso = TECLAS[tecla];
  if (!paso) return null;
  const acotar = (v) => Math.max(-1, Math.min(1, v));
  return { x: acotar(mirada.x + paso.x), y: acotar(mirada.y + paso.y) };
}

/**
 * Arranca la sala en un lienzo y devuelve el mando para pararla.
 *
 * @param {{sala: object, objetos: Array<{lienzo: object, objeto: string}>}} piezas
 * @param {{epoca?: string, reducirMovimiento?: boolean, ahora?: () => number,
 *   pedirFotograma?: (cb: Function) => number, cancelarFotograma?: (id: number) => void}} opciones
 * @returns {{detener: Function, mirar: Function, pintarUnaVez: Function}}
 */
export function arrancarCantina(piezas, opciones = {}) {
  const {
    epoca,
    reducirMovimiento = false,
    ahora = () => Date.now(),
    pedirFotograma,
    cancelarFotograma,
  } = opciones;

  const sala = piezas?.sala ?? null;
  const objetos = Array.isArray(piezas?.objetos) ? piezas.objetos : [];
  // Se enfoca a lo sumo un objeto, y se guarda por su nombre y no por su
  // lienzo: dos puertas del mismo juego enfocarían las dos a la vez.
  let enfocado = null;
  let mirada = { x: 0, y: 0 };
  let fotograma = null;
  let vivo = true;
  const inicio = ahora();

  function pintarUnaVez() {
    const ms = ahora() - inicio;
    const ctx = sala?.getContext?.("2d");
    if (ctx) {
      pintarEscena(
        ctx,
        componerCantina({ ancho: sala.width, alto: sala.height, epoca, mirada }),
        { fondo: CANTINA.ventana },
      );
    }
    for (const { lienzo, objeto } of objetos) {
      const ctxObjeto = lienzo?.getContext?.("2d");
      if (!ctxObjeto) continue;
      pintarEscena(
        ctxObjeto,
        componerIcono(objeto, {
          ancho: lienzo.width,
          alto: lienzo.height,
          epoca,
          // Sin movimiento, el objeto se congela en una pose y no en el
          // fotograma cero: a t=0 la pila de fichas se ve de perfil.
          ms: reducirMovimiento ? 1200 : ms,
          enfocado: enfocado === objeto,
        }),
        // Fondo transparente: el objeto va DENTRO del botón, y pintarle un
        // fondo propio le dibujaría un recuadro dentro de otro.
        { fondo: null },
      );
    }
  }

  function tic() {
    if (!vivo) return;
    pintarUnaVez();
    fotograma = pedirFotograma?.(tic) ?? null;
  }

  pintarUnaVez();
  // El bucle solo existe si hay movimiento que hacer Y alguien que dé
  // fotogramas. Sin `pedirFotograma` esto es un pintor de un solo disparo, que
  // es justo lo que necesita una prueba.
  if (!reducirMovimiento && pedirFotograma) fotograma = pedirFotograma(tic);

  return {
    /** Mueve el punto de vista y repinta si el bucle no lo va a hacer. */
    mirar(nueva) {
      mirada = { x: nueva?.x ?? 0, y: nueva?.y ?? 0 };
      if (!fotograma) pintarUnaVez();
    },
    /** Enfoca un objeto (o ninguno con `null`). */
    enfocar(objeto) {
      enfocado = objeto ?? null;
      if (!fotograma) pintarUnaVez();
    },
    pintarUnaVez,
    detener() {
      vivo = false;
      if (fotograma !== null) cancelarFotograma?.(fotograma);
      fotograma = null;
    },
  };
}
