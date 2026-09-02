// Estado efímero del libro interactuable (#853, vertical 2): en qué página
// está, qué ángulo de apertura tiene y si hay una hoja en vuelo ahora mismo.
// Máquina de estados pura y basada en tiempo — nunca lee el reloj por su
// cuenta, todo llega como `ahoraMs` — así que se prueba desde Node sin
// `Date.now` ni `requestAnimationFrame`. El reloj y la única variable mutable
// viven en `libro-sesion.mjs`, que envuelve este módulo.
//
// EFÍMERO A PROPÓSITO, y no una omisión (#853, con #766/#767 fuera de
// alcance): este módulo no declara ni persistencia ni sincronización porque no
// las necesita — el mismo contrato que `bridge-token-session.mjs` (memoria del
// GM) o `sesion-motor.mjs` de las mesas de minijuegos ("vive en memoria y ya
// está"). No hay "página en la que me quedé": cerrar el libro (irse del punto
// de interacción) lo devuelve a `estadoInicial()`, página incluida. Un
// bestiario que RECUERDE qué se ha leído es del núcleo, no de esta escena — la
// misma frontera que ya traza `catalogo-piezas.mjs`.
//
// UNA hoja en vuelo, nunca más de una (issue #853, comentario "Odiseo" del
// mantenedor): `activar()` ignora una petición nueva mientras hay una
// transición en curso, así que no se puede encolar una segunda animación —
// tocar la interacción deprisa no acelera nada, solo no hace nada hasta que la
// hoja en vuelo aterrice.
//
// `reducirMovimiento` colapsa cualquier transición a duración cero (mismo
// contrato que `cantina-lienzo.mjs`/`retro3d-lienzo.mjs`): el libro sigue
// siendo interactuable —abre, pasa página, cierra— solo que de golpe, sin
// interpolar. No es una degradación de la función, solo de la animación.
//
// Puro: ni Foundry, ni DOM, ni reloj, ni Math.random(). Se prueba desde Node.

export const FASE_CERRADO = "cerrado";
export const FASE_ABRIENDO = "abriendo";
export const FASE_ABIERTO = "abierto";
export const FASE_PASANDO = "pasando";
export const FASE_CERRANDO = "cerrando";

/** Ángulo de apertura "cómodo" para leer: 90°, ni de canto ni totalmente
 *  desplegado en plano — el mismo valor con el que se prueba `libroGeometria`
 *  en su propia suite. */
export const APERTURA_ABIERTO = Math.PI / 2;

export const DURACION_ABRIR_MS = 700;
export const DURACION_PASAR_MS = 500;

/** El estado de un libro cerrado, sin nadie habiendo interactuado nunca. */
export function estadoInicial() {
  return Object.freeze({
    fase: FASE_CERRADO,
    apertura: 0,
    hojaVuelo: 0,
    paginaActual: 0,
    transicion: null,
  });
}

function iniciarTransicion(estado, { fase, ahoraMs, duracionMs, reducirMovimiento }) {
  return Object.freeze({
    ...estado,
    fase,
    transicion: Object.freeze({ desde: ahoraMs, duracion: reducirMovimiento ? 0 : duracionMs }),
  });
}

/**
 * Interpreta el gesto de "activar" el libro: llegar al punto de interacción,
 * o volver a llegar tras haberse ido. Es la ÚNICA entrada de usuario de este
 * módulo; todo lo que hace `actualizar` después es solo el paso del tiempo
 * sobre lo que este gesto decidió.
 *
 * - Cerrado → empieza a abrirse.
 * - Abierto, y quedan páginas → empieza a pasar a la siguiente.
 * - Abierto, en la última página → empieza a cerrarse.
 * - Con una transición ya en curso → no hace nada (una sola hoja en vuelo).
 *
 * @param {object} estado
 * @param {{ahoraMs:number, reducirMovimiento?:boolean, totalPaginas:number}} contexto
 */
export function activar(estado, { ahoraMs, reducirMovimiento = false, totalPaginas }) {
  if (!Number.isFinite(ahoraMs)) throw new TypeError("activar requiere ahoraMs finito");
  if (!Number.isFinite(totalPaginas) || totalPaginas < 1) {
    throw new RangeError("activar requiere totalPaginas >= 1");
  }
  if (estado.transicion) return estado;

  if (estado.fase === FASE_CERRADO) {
    return iniciarTransicion(estado, {
      fase: FASE_ABRIENDO, ahoraMs, duracionMs: DURACION_ABRIR_MS, reducirMovimiento,
    });
  }
  if (estado.fase === FASE_ABIERTO) {
    const esUltima = estado.paginaActual + 1 >= totalPaginas;
    return iniciarTransicion(estado, {
      fase: esUltima ? FASE_CERRANDO : FASE_PASANDO,
      ahoraMs,
      duracionMs: esUltima ? DURACION_ABRIR_MS : DURACION_PASAR_MS,
      reducirMovimiento,
    });
  }
  // Fase desconocida (no debería pasar fuera de una prueba): no hace nada.
  return estado;
}

/** Interpolación 0..1 suavizada (coseno), para que abrir o pasar página no se
 *  sienta como un metrónomo lineal. */
function suavizar(t) {
  return (1 - Math.cos(Math.PI * t)) / 2;
}

/**
 * Avanza el reloj sobre una transición en curso; sin gesto nuevo. Se llama en
 * cada fotograma que se vaya a pintar. Sin transición en marcha, devuelve la
 * MISMA referencia de estado (para que quien compone pueda saltarse trabajo
 * comparando por identidad si le interesa).
 */
export function actualizar(estado, ahoraMs) {
  if (!Number.isFinite(ahoraMs)) throw new TypeError("actualizar requiere ahoraMs finito");
  if (!estado.transicion) return estado;

  const { desde, duracion } = estado.transicion;
  const t = duracion > 0 ? Math.min(1, Math.max(0, (ahoraMs - desde) / duracion)) : 1;
  const s = suavizar(t);

  if (estado.fase === FASE_ABRIENDO) {
    if (t >= 1) {
      return Object.freeze({
        ...estado, fase: FASE_ABIERTO, apertura: APERTURA_ABIERTO, hojaVuelo: 0, transicion: null,
      });
    }
    return Object.freeze({ ...estado, apertura: APERTURA_ABIERTO * s, hojaVuelo: 0 });
  }

  if (estado.fase === FASE_PASANDO) {
    if (t >= 1) {
      return Object.freeze({
        ...estado,
        fase: FASE_ABIERTO,
        apertura: APERTURA_ABIERTO,
        hojaVuelo: 0,
        paginaActual: estado.paginaActual + 1,
        transicion: null,
      });
    }
    return Object.freeze({ ...estado, apertura: APERTURA_ABIERTO, hojaVuelo: APERTURA_ABIERTO * s });
  }

  if (estado.fase === FASE_CERRANDO) {
    if (t >= 1) return estadoInicial();
    return Object.freeze({ ...estado, apertura: APERTURA_ABIERTO * (1 - s), hojaVuelo: 0 });
  }

  return estado;
}
