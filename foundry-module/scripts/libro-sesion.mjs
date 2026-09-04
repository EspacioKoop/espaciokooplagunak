// Sesión efímera del libro del museo (#853, vertical 2): envuelve la máquina
// pura de `libro-estado.mjs` con la ÚNICA variable mutable y el punto donde
// entra el reloj. Mismo contrato que `bridge-token-session.mjs` (token del
// puente, solo en memoria) o `sesion-motor.mjs` de las mesas de minijuegos
// (sesión del coordinador, solo en memoria): nada de esto se guarda ni viaja
// por red, y por eso NO hace falta relé ni documento — cada cliente que anda
// por el museo lleva su propio libro en su propia memoria. Que dos
// tripulantes lo vean en páginas distintas a la vez no es un bug, es lo que
// significa "efímero y no sincronizado" tal como pide el issue.
//
// `activarLibro`/`cerrarLibro` son las dos entradas de gesto (llegar al punto
// de interacción / alejarse), llamadas desde `andar-nave-app.mjs`.
// `estadoLibroAhora` es la lectura de cada fotograma, llamada desde
// `libro-museo.mjs` con el reloj de la ESCENA (`opciones.tiempo`, el mismo que
// ya usa la playa para el viento) y no con un `Date.now()` propio — así la
// única impureza de verdad de este módulo es la variable mutable, no el reloj.

import { activar, actualizar, estadoInicial } from "./libro-estado.mjs";

let estado = estadoInicial();

/** Llegar al punto de interacción del libro: abre, o pasa página, o cierra si
 *  ya estaba en la última — ver `libro-estado.activar` para la regla exacta. */
export function activarLibro({ totalPaginas, reducirMovimiento = false, ahoraMs }) {
  estado = activar(estado, { ahoraMs, reducirMovimiento, totalPaginas });
  return estado;
}

/** Alejarse del libro: vuelve a `estadoInicial()` sin animar — la misma regla
 *  instantánea que ya usa la cartela de una pieza al retirarse (#598). No hay
 *  "se quedó a medio abrir": un libro que nadie mira no tiene por qué seguir
 *  ocupando fotogramas ni recordando por dónde iba. */
export function cerrarLibro() {
  estado = estadoInicial();
  return estado;
}

/** El estado vigente, evaluado hasta `ahoraMs`. Se llama una vez por
 *  fotograma pintado; `ahoraMs` es obligatorio y viene de fuera para que este
 *  módulo no tenga reloj propio. */
export function estadoLibroAhora(ahoraMs) {
  estado = actualizar(estado, ahoraMs);
  return estado;
}

/** Solo para pruebas: la sesión es un módulo con estado propio, y sin esto
 *  las pruebas se contaminarían entre sí por el orden en que se ejecutan. */
export function reiniciarLibroParaPruebas() {
  estado = estadoInicial();
}
