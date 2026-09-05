/**
 * Panel de GM (#448): catálogo puro de las entradas solo-GM que hasta ahora
 * eran botones sueltos en los controles de escena (consola caliente, token,
 * diagnóstico, música, decorado, ficha de nave).
 *
 * Mismo patrón que `cantina.mjs` (#423) y `seccion-nave.mjs` (#427): una
 * puerta única con un catálogo interno, para que añadir una entrada nueva sea
 * un elemento más de esta lista y no un botón nuevo en `main.mjs`. Puro: ni
 * Foundry, ni DOM, ni red — solo "qué entradas hay".
 *
 * La entrada "consola" abre la consola caliente del GM (#276), que ya fusionó
 * estado+mapa+encuentros+previsualización en una sola ventana con un solo
 * bucle de sondeo: este catálogo no reabre esa fusión con entradas propias de
 * "estado"/"mapa", porque esas ventanas ya no existen por separado.
 *
 * El almacenamiento y la búsqueda por id son `crearCatalogoPuertas`
 * (#448, item 4): mismo patrón exacto que `cantina.mjs`, factorizado una vez
 * que hubo dos consumidores reales.
 */

import { crearCatalogoPuertas } from "./puerta-catalogo.mjs";

/** Una entrada por acción de GM disponible. `id` identifica la entrada y es
 * lo que `panel-gm-app.mjs` pasa de vuelta al elegirla; la acción concreta
 * (qué función de `main.mjs` invoca) la decide quien conecta el panel, no
 * el catálogo. */
const catalogo = crearCatalogoPuertas([
  Object.freeze({
    id: "consola",
    tituloClave: "LAGUNAK.PanelGM.Entrada.Consola",
    icono: "fa-solid fa-gauge-high",
  }),
  Object.freeze({
    id: "token",
    tituloClave: "LAGUNAK.PanelGM.Entrada.Token",
    icono: "fa-solid fa-key",
  }),
  Object.freeze({
    id: "diagnostico",
    tituloClave: "LAGUNAK.PanelGM.Entrada.Diagnostico",
    icono: "fa-solid fa-stethoscope",
  }),
  Object.freeze({
    id: "musica",
    tituloClave: "LAGUNAK.PanelGM.Entrada.Musica",
    icono: "fa-solid fa-music",
  }),
  Object.freeze({
    id: "decorado",
    tituloClave: "LAGUNAK.PanelGM.Entrada.Decorado",
    icono: "fa-solid fa-dice",
  }),
  Object.freeze({
    id: "ficha",
    tituloClave: "LAGUNAK.PanelGM.Entrada.Ficha",
    icono: "fa-solid fa-image-portrait",
  }),
  Object.freeze({
    id: "sonido",
    tituloClave: "LAGUNAK.PanelGM.Entrada.Sonido",
    icono: "fa-solid fa-volume-high",
  }),
]);

export const ENTRADAS = catalogo.congelado;

/** Catálogo completo, en orden estable. */
export function entradasPanelGM() {
  return catalogo.todas();
}

/** La entrada con ese id, o `undefined` si el catálogo no la tiene. */
export function entradaPorId(id) {
  return catalogo.porId(id);
}
