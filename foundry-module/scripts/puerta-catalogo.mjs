/**
 * Catálogo de puerta (#448, item 4 de la propuesta de consolidación):
 * `cantina.mjs` (#423) y `panel-gm.mjs` (#448) repetían el mismo patrón
 * —lista congelada de entradas con `id`, búsqueda por id que no inventa
 * nada para un id ajeno— con solo el nombre de las funciones cambiando.
 * Esto extrae ESA parte, y solo esa: la forma de guardar y consultar una
 * lista de entradas.
 *
 * Lo que NO entra aquí a propósito, para no forzar una abstracción que no
 * encaja: la ventana (`cantina-app.mjs` pinta una sala con cámara y
 * navegación por teclado; `panel-gm-app.mjs` es una lista plana — son
 * cosas distintas), y `seccion-nave.mjs` (rejilla de salas con ocupación de
 * tripulación, no una lista plana de puertas). Si en el futuro aparece una
 * segunda ventana de lista plana, ahí sí habría dos consumidores reales
 * para justificar extraer también ese cascarón — con uno solo sería
 * abstraer contra un consumidor imaginario.
 */

/**
 * Crea un catálogo a partir de una lista de entradas ya congeladas
 * individualmente por quien llama (cada entrada declara sus propios campos
 * además de `id` — `cantina.mjs` añade `juego`/`objeto`, `panel-gm.mjs` no
 * necesita más que `tituloClave`/`icono` — este módulo no impone forma más
 * allá de que exista `id`).
 *
 * @returns {{ congelado: object[], todas: () => object[], porId: (id: string) => object|undefined }}
 */
export function crearCatalogoPuertas(entradas) {
  const congelado = Object.freeze(entradas);
  return {
    congelado,
    todas: () => congelado,
    porId: (id) => congelado.find((entrada) => entrada.id === id),
  };
}
