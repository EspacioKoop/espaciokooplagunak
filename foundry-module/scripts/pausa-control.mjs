/**
 * Lógica pura del estado de pausa (issue #125). ESM sin dependencias de
 * Foundry ni del DOM: la misma función decide qué estado se muestra y qué
 * orden es posible, y se prueba desde Node sin instancia de Foundry.
 *
 * El simulador es la única autoridad sobre su pausa: aquí solo se combina lo
 * último confirmado por el puente (`paused` de /v1/scenario) con la orden en
 * vuelo, si la hay. Nunca hay dos órdenes activas a la vez: mientras una
 * orden viaja, ambas quedan deshabilitadas.
 */

/** Estados posibles de la vista de pausa. */
export const ESTADOS_PAUSA = Object.freeze([
  "conectando", // aún no hay ninguna lectura confirmada de /v1/scenario
  "desconectado", // el sondeo falla: no se sabe el estado y no se ordena a ciegas
  "en_marcha", // confirmado: simulación corriendo
  "pausado", // confirmado: simulación pausada
  "pausando", // orden de pausa en vuelo, sin confirmación todavía
  "reanudando", // orden de reanudación en vuelo, sin confirmación todavía
  "error", // la última orden falló; se ofrece reintentar la acción coherente
]);

/**
 * Combina la última lectura confirmada con la orden en vuelo.
 *
 * @param {object} entrada
 * @param {"ok"|"error"|"conectando"} entrada.conexion estado del sondeo
 * @param {boolean|null} entrada.paused último `paused` confirmado por el
 *   puente (null si aún no hay lectura)
 * @param {boolean|null} entrada.pendiente orden en vuelo (`true` pausar,
 *   `false` reanudar, null ninguna)
 * @param {boolean} [entrada.falloOrden] la última orden terminó en error
 * @returns {{estado:string, puedePausar:boolean, puedeReanudar:boolean}}
 */
export function resolverPausa({ conexion, paused = null, pendiente = null, falloOrden = false }) {
  if (pendiente !== null) {
    return { estado: pendiente ? "pausando" : "reanudando", puedePausar: false, puedeReanudar: false };
  }
  if (conexion === "error") {
    return { estado: "desconectado", puedePausar: false, puedeReanudar: false };
  }
  if (paused === null) {
    return { estado: "conectando", puedePausar: false, puedeReanudar: false };
  }
  if (falloOrden) {
    // La orden falló pero el sondeo sigue vivo: se reintenta solo la acción
    // coherente con el estado confirmado (nunca las dos a la vez).
    return { estado: "error", puedePausar: !paused, puedeReanudar: paused };
  }
  return paused
    ? { estado: "pausado", puedePausar: false, puedeReanudar: true }
    : { estado: "en_marcha", puedePausar: true, puedeReanudar: false };
}

/**
 * Prepara el modelo de vista para Handlebars: etiqueta i18n del estado y
 * banderas de habilitación. `foundryPausado` (game.paused) se muestra como
 * dato aparte y SOLO informativo: la pausa de Foundry y la del simulador no
 * se sincronizan automáticamente en ninguna dirección (docs/FOUNDRY.md) —
 * así no puede haber bucles de reintento entre ambas.
 */
export function prepararVistaPausa({ conexion, paused = null, pendiente = null, falloOrden = false, foundryPausado = false, i18n }) {
  const r = resolverPausa({ conexion, paused, pendiente, falloOrden });
  const CLAVES = {
    conectando: "LAGUNAK.Pausa.Conectando",
    desconectado: "LAGUNAK.Pausa.Desconectado",
    en_marcha: "LAGUNAK.Pausa.EnMarcha",
    pausado: "LAGUNAK.Pausa.Pausado",
    pausando: "LAGUNAK.Pausa.Pausando",
    reanudando: "LAGUNAK.Pausa.Reanudando",
    error: "LAGUNAK.Pausa.Error",
  };
  return {
    estado: r.estado,
    etiqueta: i18n.localize(CLAVES[r.estado]),
    puedePausar: r.puedePausar,
    puedeReanudar: r.puedeReanudar,
    foundryPausado: Boolean(foundryPausado),
  };
}
