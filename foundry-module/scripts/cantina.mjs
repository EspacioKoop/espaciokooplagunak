/**
 * Cantina (#423): catálogo puro de las "puertas" sociales de la nave.
 *
 * Hasta ahora cada minijuego tenía su propio botón suelto en los controles de
 * escena; con uno solo (póker) ya funcionaba, pero no escalaba — el grupo
 * `lagunak` acumula herramientas de gobierno de la nave (estado, mapa, token)
 * junto a lo que es pura vida social a bordo, y son cosas de naturaleza
 * distinta que no deberían competir por hueco en la misma barra.
 *
 * La cantina es una entrada única: una puerta por cada mesa disponible. Hoy
 * solo hay una (póker); el catálogo existe para que añadir la siguiente sea
 * un elemento más en esta lista, no un botón nuevo en `main.mjs`.
 *
 * Puro: ni Foundry, ni DOM, ni red — igual que `minijuegos-wiring.mjs` separa
 * el motor del cableado, aquí se separa "qué puertas hay" de "cómo se pinta
 * la sala" (`cantina-app.mjs`).
 */

/** Una entrada por mesa social disponible. `id` identifica la puerta; `juego`
 * es el nombre con el que la conoce `sesion-motor.mjs`, y son campos distintos
 * a propósito: el día que dos puertas lleven al mismo juego con reglas de casa
 * distintas, la sala no tiene por qué enterarse. */
export const PUERTAS = Object.freeze([
  Object.freeze({
    id: "poker",
    juego: "poker",
    tituloClave: "LAGUNAK.Cantina.Puerta.Poker",
    icono: "fa-solid fa-diamond",
  }),
]);

/** Catálogo completo, en orden estable. */
export function puertasCantina() {
  return PUERTAS;
}

/** La puerta con ese id, o `undefined` si el catálogo no la tiene. */
export function puertaPorId(id) {
  return PUERTAS.find((puerta) => puerta.id === id);
}
