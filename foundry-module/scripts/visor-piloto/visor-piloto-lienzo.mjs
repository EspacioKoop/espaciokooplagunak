// El visor del piloto, volcado a un lienzo (#362).
//
// NO HAY BUCLE, y es una decisión y no una economía. La lámina de reconocimiento
// gira porque girar ES lo que enseña la silueta; aquí no hay nada que animar: lo
// que cambia son los contactos, y los contactos cambian cuando llega telemetría
// nueva. Interpolar entre dos sondeos daría un movimiento suave y falso —posición
// dibujada que nadie ha medido— justo en la superficie que más cuidado tiene que
// tener con eso.
//
// De regalo, `prefers-reduced-motion` sale gratis y de verdad: sin bucle no hay
// movimiento que frenar. La preferencia no se consulta porque no hay nada que
// preguntarle.
//
// Toca el <canvas> y nada más: la geometría entera vive en `visor-piloto.mjs`,
// que es puro y por eso se puede probar sin navegador.

import { pintarEscena } from "../retro3d-lienzo.mjs";
import { componerVisorPiloto } from "./visor-piloto.mjs";

/** La ranura del visor. Se nombra una vez porque montarlo y buscarlo tienen que
 * referirse a la MISMA, o el remontaje pintaría en el vacío. */
export const SELECTOR = "[data-lagunak-visor-piloto]";

/**
 * Pinta el visor si esta consola lo tiene y hay algo que enseñar.
 *
 * Devuelve la escena, o `null` cuando no se ha pintado. Los tres casos en que no
 * se pinta son distintos y ninguno es un error:
 *
 *  - no hay lienzo: esta consola no es la de pilotaje;
 *  - no hay sondeo (`sensores` nulo): el visor se queda apagado, que es lo que
 *    manda el cuarto estado (#353) — un sector negro y limpio diría «no hay
 *    nada ahí fuera» y eso es una afirmación que nadie ha comprobado;
 *  - hay sondeo y está vacío: eso SÍ se pinta, porque «he mirado y no hay nada»
 *    es un dato, y se ve como el vacío con estrellas que es.
 *
 * @param {Element} raiz raíz de la ventana del puesto.
 * @param {object|null} modelo el modelo del espacio de puesto.
 * @param {object} [opciones] puntos de entrada inyectables para las pruebas.
 */
export function pintarVisorPiloto(raiz, modelo, opciones = {}) {
  const { selector = SELECTOR } = opciones;
  const lienzo = raiz?.querySelector?.(selector);
  const ctx = lienzo?.getContext?.("2d");
  if (!ctx) return null;

  const escena = componerVisorPiloto(modelo?.sensores ?? null, {
    ...opciones,
    ancho: lienzo.width,
    alto: lienzo.height,
    // El rumbo puede no haberse leído, y entonces NO se resta nada: el visor
    // pasa a enseñar marcaciones absolutas, que es peor que restarlas bien pero
    // mucho mejor que restar un cero disfrazado de rumbo. La consola ya dice en
    // texto si hay lectura de rumbo o no.
    rumboPropio: Number.isFinite(modelo?.cascoRumbo) ? modelo.cascoRumbo : 0,
  });

  if (!escena) {
    // Apagado explícito: se limpia para no dejar el sondeo anterior congelado en
    // pantalla haciéndose pasar por actual.
    ctx.clearRect?.(0, 0, lienzo.width, lienzo.height);
    return null;
  }

  pintarEscena(ctx, escena, { fondo: opciones.fondo ?? null });
  return escena;
}
