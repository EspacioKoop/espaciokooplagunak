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

import { MIRA, acotarCamara, componerCantina } from "./cantina-escena.mjs";
import { componerIcono } from "./cantina-icono.mjs";
import { CANTINA } from "./paleta.mjs";
import { pintarCapa2D } from "./cantina-2d.mjs";
import { pintarEscena } from "./retro3d-lienzo.mjs";

/**
 * Normaliza un punto del ratón a −1..1 sobre un rectángulo. Fuera del
 * rectángulo NO se recorta aquí: `componerCantina` ya acota, y recortar dos
 * veces esconde de dónde vino un valor raro.
 */
/** Paso de andar por pulsación, en unidades de sala. Corto: cruzar la cantina
 * son unos ocho pasos, que es lo que se espera de andar y no de teletransporte. */
export const PASO_ANDAR = 0.35;

/**
 * Hacia dónde anda una tecla, EN EL SISTEMA DE QUIEN MIRA. Adelante es hacia
 * donde se mira, no hacia el fondo de la sala: si `w` fuera siempre +z, girarse
 * y seguir andando te llevaría de espaldas, que es lo que convierte un paseo en
 * un puzle.
 */
export function andar(camara, tecla, paso = PASO_ANDAR) {
  const marcha = ANDARES[tecla];
  if (!marcha) return null;
  const yaw = Number.isFinite(camara?.yaw) ? camara.yaw : 0;
  const sen = Math.sin(yaw);
  const cos = Math.cos(yaw);
  return acotarCamara({
    ...camara,
    x: (camara?.x ?? 0) + (marcha.lado * cos + marcha.frente * sen) * paso,
    z: (camara?.z ?? 0) + (marcha.frente * cos - marcha.lado * sen) * paso,
  });
}

/**
 * Mirada desde el ratón. El ratón MIRA y no anda: es el reparto estándar de un
 * juego en primera persona, y mezclarlo fue lo que hizo que el movimiento
 * anterior no se leyera como moverse.
 */
export function mirarDesdePunto(camara, { x, y }, rect) {
  const p = miradaDesdePunto({ x, y }, rect);
  return acotarCamara({ ...camara, yaw: p.x * MIRA.yaw, pitch: -p.y * MIRA.pitch });
}

/** Cuánto gira una pulsación de girar sobre uno mismo, en radianes. */
export const PASO_GIRO = 0.22;

const GIROS = Object.freeze({
  q: -1,
  e: 1,
  Q: -1,
  E: 1,
  ArrowLeft: -1,
  ArrowRight: 1,
});

/**
 * Gira sobre uno mismo. SIN TOPE y sin normalizar a un rango: en una sala uno
 * puede darse la vuelta entera, y acotar el giro a un cono es lo que convertía
 * esto en «asomarse» en vez de estar de pie mirando donde quieras.
 */
export function girar(camara, tecla, paso = PASO_GIRO) {
  const sentido = GIROS[tecla];
  if (!sentido) return null;
  return acotarCamara({ ...camara, yaw: (camara?.yaw ?? 0) + sentido * paso });
}

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

/**
 * Todas las formas de moverse por la sala. Flechas y WASD a la vez, y en
 * minúscula y mayúscula: quien juega con el bloqueo de mayúsculas puesto no
 * tiene por qué descubrir que la sala deja de responder, y quien viene de un
 * juego usa las teclas de un juego sin tener que aprenderse las de este.
 *
 * Es una tabla y no un `switch` por lo mismo que el catálogo de puertas: añadir
 * un esquema más —IJKL, un mando— es una entrada, no una rama.
 */
/**
 * Las teclas de andar, en los dos esquemas de siempre. `frente` positivo es
 * hacia donde se mira; `lado` positivo es a la derecha.
 */
const ANDARES = Object.freeze({
  w: { frente: 1, lado: 0 },
  s: { frente: -1, lado: 0 },
  a: { frente: 0, lado: -1 },
  d: { frente: 0, lado: 1 },
  W: { frente: 1, lado: 0 },
  S: { frente: -1, lado: 0 },
  A: { frente: 0, lado: -1 },
  D: { frente: 0, lado: 1 },
  ArrowUp: { frente: 1, lado: 0 },
  ArrowDown: { frente: -1, lado: 0 },
});

const TECLAS = Object.freeze({
  ArrowLeft: { x: -PASO_TECLADO, y: 0 },
  ArrowRight: { x: PASO_TECLADO, y: 0 },
  ArrowUp: { x: 0, y: PASO_TECLADO },
  ArrowDown: { x: 0, y: -PASO_TECLADO },
  a: { x: -PASO_TECLADO, y: 0 },
  d: { x: PASO_TECLADO, y: 0 },
  w: { x: 0, y: PASO_TECLADO },
  s: { x: 0, y: -PASO_TECLADO },
  A: { x: -PASO_TECLADO, y: 0 },
  D: { x: PASO_TECLADO, y: 0 },
  W: { x: 0, y: PASO_TECLADO },
  S: { x: 0, y: -PASO_TECLADO },
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
  let camara = acotarCamara({ x: 0, z: 0, yaw: 0, pitch: 0 });
  let fotograma = null;
  let vivo = true;
  const inicio = ahora();

  function pintarUnaVez() {
    const ms = ahora() - inicio;
    const ctx = sala?.getContext?.("2d");
    if (ctx) {
      const escena = componerCantina({ ancho: sala.width, alto: sala.height, epoca, camara });
      pintarEscena(ctx, escena, { fondo: CANTINA.ventana });
      // Y encima, el pixel-art plano: halo de las lámparas, filo del ventanal,
      // polvo, líneas y viñeta. Va DESPUÉS del 3D a propósito — es lo que tapa
      // las costuras que deja el pintor entre caras vecinas, y lo que pone la
      // luz que un sombreado por normal no puede dar.
      // Las anclas vienen proyectadas por la MISMA cámara que la sala: es lo
      // que hace que los trastos estén en la pared y no encima del cristal.
      pintarCapa2D(ctx, { ancho: sala.width, alto: sala.height, ms, anclas: escena.anclas });
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
    /** Coloca la cámara entera (posición y mirada) y repinta si hace falta. */
    situar(nueva) {
      camara = acotarCamara(nueva);
      if (!fotograma) pintarUnaVez();
    },
    /** Dónde se está y hacia dónde se mira ahora mismo. */
    donde() {
      return camara;
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
