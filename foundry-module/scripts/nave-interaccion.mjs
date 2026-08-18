// Puntos de interacción de una sala (#582): lo que se puede TOCAR dentro de
// ella, declarado como dato y no cableado en el bucle de andar.
//
// POR QUÉ EXISTE. Hasta ahora la nave entera tenía exactamente una interacción
// —acercarse a la consola de un puesto abre su espacio de trabajo (#509)— y
// estaba cableada a mano: el lienzo llevaba una lista `consolas` con su propio
// aviso `alTocarConsola`. Con un caso eso es lo correcto y no había nada que
// generalizar. Con cinco issues abiertos pidiendo el segundo, el tercero y el
// cuarto —el punto de pesca de #579, la mesa de blackjack de #553, las cartas
// de #458, los mini-minijuegos de #309, los cigarros de #439— la alternativa
// real no es «un sistema o nada», es «un sistema o cinco caminos distintos para
// estar cerca de algo y pulsar». El mismo argumento con el que #550 impuso una
// sola rejilla para muro, puerta y objeto.
//
// ES UN RAÍL, NO UN TREN. Aquí no hay ni una acción concreta: `accion` es opaca
// para este módulo, igual que `destino` lo es para una puerta. Quien declara la
// interacción decide qué significa; quien la recibe, qué hacer con ella.
//
// EL `id` ES DIRECCIONABLE. No es decoración: #579 pide que la futura pesca
// pueda localizar algo equivalente a `punto-pesca` SIN coordenadas incrustadas
// en la escena. Un id estable es lo que convierte eso en una búsqueda en vez de
// en dos números copiados a mano.
//
// UN SOLO PUNTO ACTIVO, Y EL MISMO EN TODAS LAS PANTALLAS. Dos clientes de la
// mesa con el avatar en el mismo sitio tienen que resolver el mismo punto, así
// que el desempate es explícito y estable (ver `interaccionAlAlcance`) en vez de
// depender del orden en que alguien haya declarado la lista.
//
// Puro: ni Foundry, ni DOM, ni red. Se prueba desde Node.

import { distanciaARect } from "./nave-movimiento.mjs";

/**
 * Alcance de serie de un punto suelto, en metros.
 *
 * 1,2 m es «de pie delante de», no «pasaba por el mismo cuarto»: con el radio
 * del que anda (0,35) da poco más de metro y medio de contacto, del orden de lo
 * que ya cubre la zona de una consola. Más grande, dos props vecinos de la
 * terraza de #579 se pisarían el turno; más pequeño, hay que buscar el punto
 * exacto y la interacción se siente rota.
 */
export const RADIO_INTERACCION = 1.2;

/** El centro de un rect esquina+medidas. */
function centroDe(rect) {
  return [rect.x + rect.ancho / 2, rect.z + rect.profundidad / 2];
}

/**
 * Declara un punto de interacción.
 *
 * @param {object} definicion
 * @param {string} definicion.id estable y único DENTRO de su estancia. Es por
 *   donde se busca (`buscarInteraccion`), así que se elige para leerse —
 *   `punto-pesca`, `consola-engineering`—, no se genera.
 * @param {number[]} [definicion.punto] `[x, z]` del ancla: dónde se plantan
 *   quien interactúa y, si algún día hay aviso en pantalla, dónde se dibuja.
 *   Con `zona` y sin `punto`, se toma el centro de la zona.
 * @param {number|null} [definicion.orientacion] hacia dónde MIRA quien
 *   interactúa (yaw, misma convención que el resto: 0 mira a +z). Es opcional
 *   porque no toda interacción la necesita —una consola se usa igual desde
 *   cualquier lado—, pero una caña de pescar apoyada en la barandilla no: mira
 *   al espacio o no es pescar. Declararla es lo que evita que #579 tenga que
 *   deducirla a ojo de la geometría.
 * @param {number} [definicion.radio] alcance, si el disparador es un círculo.
 * @param {object|null} [definicion.zona] rect esquina+medidas que dispara, en
 *   lugar del círculo. Existe para que la consola siga comportándose EXACTAMENTE
 *   igual que antes de #582: su disparador siempre fue el rectángulo de su zona,
 *   y sustituirlo por un círculo habría cambiado dónde empieza a responder —un
 *   cambio de comportamiento colado dentro de una migración, que es la peor
 *   forma de introducirlo.
 * @param {*} [definicion.accion] opaca aquí. La interpreta quien recibe el aviso.
 */
export function declararInteraccion({
  id,
  punto = null,
  orientacion = null,
  radio = RADIO_INTERACCION,
  zona = null,
  accion = null,
} = {}) {
  if (typeof id !== "string" || id === "") {
    throw new TypeError("declararInteraccion requiere un `id` no vacío");
  }
  const ancla = punto ?? (zona ? centroDe(zona) : null);
  if (!Array.isArray(ancla) || !Number.isFinite(ancla[0]) || !Number.isFinite(ancla[1])) {
    throw new TypeError(`declararInteraccion("${id}") requiere \`punto\` [x, z] o \`zona\``);
  }
  if (!(radio > 0)) {
    throw new RangeError(`declararInteraccion("${id}"): el radio debe ser positivo`);
  }
  return Object.freeze({
    id,
    punto: Object.freeze([ancla[0], ancla[1]]),
    orientacion: Number.isFinite(orientacion) ? orientacion : null,
    radio,
    zona: zona ? Object.freeze({ ...zona }) : null,
    accion,
  });
}

/** Congela una lista de definiciones, validándolas y sin ids repetidos. */
export function declararInteracciones(definiciones = []) {
  const vistos = new Set();
  const lista = definiciones.map((definicion) => {
    const interaccion = declararInteraccion(definicion);
    if (vistos.has(interaccion.id)) {
      // Revienta al construir el catálogo y no en mitad de una sesión: dos
      // puntos con el mismo id hacen que `buscarInteraccion` devuelva uno de
      // los dos sin criterio, y ese es justo el fallo que nadie reproduce.
      throw new RangeError(`declararInteracciones: id repetido "${interaccion.id}"`);
    }
    vistos.add(interaccion.id);
    return interaccion;
  });
  return Object.freeze(lista);
}

/** Lo que le falta a quien está en `(x, z)` para tocar `interaccion`; ∞ si no llega. */
function holguraHasta(x, z, radioJugador, interaccion) {
  if (interaccion.zona) {
    const distancia = distanciaARect(x, z, interaccion.zona);
    return distancia < radioJugador ? distancia : Infinity;
  }
  const distancia = Math.hypot(x - interaccion.punto[0], z - interaccion.punto[1]);
  return distancia < interaccion.radio + radioJugador ? distancia : Infinity;
}

/**
 * Qué punto de interacción tiene al alcance un círculo de `radioJugador`
 * centrado en `(x, z)`, o `null`.
 *
 * UNO SOLO, aunque haya varios solapados: dos avisos simultáneos no se pueden
 * atender y el jugador no elige entre ellos. Manda el más cercano —lo que se
 * tiene delante—, y a igual distancia el de `id` menor. Ese segundo criterio
 * parece innecesario hasta que dos clientes con el avatar en el mismo sitio
 * resuelven puntos distintos porque el orden de la lista no coincidía: el
 * empate exacto es raro, pero la simetría de una sala hace que ocurra
 * precisamente donde alguien se para.
 */
export function interaccionAlAlcance(x, z, radioJugador, interacciones) {
  let mejor = null;
  let mejorHolgura = Infinity;
  for (const interaccion of interacciones ?? []) {
    const holgura = holguraHasta(x, z, radioJugador, interaccion);
    if (holgura === Infinity) continue;
    if (holgura < mejorHolgura || (holgura === mejorHolgura && interaccion.id < mejor.id)) {
      mejor = interaccion;
      mejorHolgura = holgura;
    }
  }
  return mejor;
}

/**
 * El punto de interacción con ese `id`, o `null`.
 *
 * Es la mitad que hace direccionable el catálogo: una mecánica futura pide
 * `punto-pesca` por nombre y recibe su ancla y su orientación ya declaradas, en
 * vez de llevar coordenadas propias que se desalinean en cuanto alguien mueve
 * la terraza (#579).
 */
export function buscarInteraccion(interacciones, id) {
  return (interacciones ?? []).find((interaccion) => interaccion.id === id) ?? null;
}
