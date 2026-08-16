// Bucle de sondeo de la consola caliente del GM (#276, paso 1).
//
// Extrae de las cuatro factorías (`estado-nave-app-v{1,2}.mjs`,
// `mapa-vivo-app-v{1,2}.mjs`) lo que tenían en común y no debería repetirse
// cuatro veces: la cadencia con backoff exponencial acotado, el conteo de
// fallos consecutivos, y el reparto de un ciclo de sondeo en una señal de
// conexión GLOBAL (`healthz`) más un estado POR PESTAÑA que no se contagia
// entre sí.
//
// Puro: ni Foundry, ni DOM, ni `setTimeout`. La clase Foundry (cascarón) es
// quien posee el reloj; este módulo solo decide QUÉ significa cada resultado.
//
// La regla de aislamiento por pestaña, tal cual la fija
// `docs/CONSOLA_CALIENTE_GM.md`:
//
//   1. `conexion` global la fija SOLO `healthz`. Es la única señal que dice
//      «no hay puente».
//   2. Cada pestaña tiene su propio estado de datos (`ok` / `sin-datos` /
//      `error`), con su propio motivo. Un fallo de una pestaña no toca a
//      las demás.
//   3. Un dato que llegó bien SE USA, aunque su compañero de lote fallase. Lo
//      que no llegó NO se rellena con lo anterior: unos contactos de hace tres
//      sondeos pintados como si fueran de ahora no se distinguen de los buenos.
//      La jerarquía tampoco es simétrica — sin `state` no hay centro, y unos
//      contactos sin nave propia son coordenadas sin origen: por eso `contacts`
//      declara `dependeDeState` y hereda su error, y no al revés.
//   4. El backoff es del bucle (lo disparan `healthz`/`state`), nunca de una
//      pestaña suelta: un `contacts` con hipo no debe frenar el sondeo.

/** Intervalo del próximo sondeo, con backoff exponencial acotado. */
export function calcularIntervaloMs(baseMs, fallosSeguidos, backoffMaxMs) {
  if (!Number.isFinite(fallosSeguidos) || fallosSeguidos <= 0) return baseMs;
  return Math.min(baseMs * 2 ** fallosSeguidos, backoffMaxMs);
}

/** Próximo contador de fallos consecutivos: sube y se acota, o se rearma a 0. */
export function siguienteFallosSeguidos(fallosSeguidos, huboFallo) {
  if (!huboFallo) return 0;
  const actual = Number.isFinite(fallosSeguidos) ? fallosSeguidos : 0;
  return Math.min(actual + 1, 10);
}

/**
 * Resuelve el estado de UNA pestaña a partir de su `PromiseSettledResult`
 * (o `null` si esta vuelta no la pidió, p. ej. una pestaña oculta que no
 * necesita continuidad).
 *
 * @returns {{status: "ok"|"sin-datos"|"error", dato: any, motivo: unknown}}
 */
export function resolverPestana(resultado) {
  if (!resultado) return { status: "sin-datos", dato: null, motivo: null };
  if (resultado.status === "rejected") {
    return { status: "error", dato: null, motivo: resultado.reason };
  }
  return { status: "ok", dato: resultado.value, motivo: null };
}

/**
 * Resuelve un ciclo completo de sondeo de la consola caliente.
 *
 * @param {object} args
 * @param {PromiseSettledResult|null} args.healthz - siempre se pide salvo
 *   revocación; si falta se trata como fallo (no se pidió nada más).
 * @param {PromiseSettledResult|null} args.state - compartido por Estado y
 *   Mapa. Si falla, CUALQUIER pestaña que dependa de él hereda su error (sin
 *   centro no hay con qué pintar esa pestaña), pero `conexion` sigue "ok":
 *   el puente respondió a `healthz`, solo `state` fue el que falló.
 * @param {Record<string, PromiseSettledResult|null>} args.extras - lote de
 *   peticiones específicas de pestaña (p. ej. `{ scenario, events, contacts }`),
 *   ya resueltas o `null` si esta vuelta no se pidieron.
 * @param {string[]} args.dependeDeState - nombres de `extras` cuyo tab debe
 *   heredar el error de `state` si `state` falló (p. ej. `["contacts"]`,
 *   porque el mapa no tiene centro sin nave).
 * @returns {{conexion: "ok"|"error", detalleErrorConexion: unknown, state: object, extras: Record<string, object>}}
 */
export function resolverCicloConsola({ healthz, state, extras = {}, dependeDeState = [] }) {
  if (!healthz || healthz.status === "rejected") {
    return {
      conexion: "error",
      detalleErrorConexion: healthz ? healthz.reason : null,
      state: { status: "sin-datos", dato: null, motivo: null },
      extras: Object.fromEntries(
        Object.keys(extras).map((nombre) => [nombre, { status: "sin-datos", dato: null, motivo: null }]),
      ),
    };
  }

  const estadoPestana = resolverPestana(state);
  const dependientes = new Set(dependeDeState);
  const resultadoExtras = {};
  for (const [nombre, resultado] of Object.entries(extras)) {
    if (estadoPestana.status === "error" && dependientes.has(nombre)) {
      resultadoExtras[nombre] = { status: "error", dato: null, motivo: estadoPestana.motivo };
      continue;
    }
    resultadoExtras[nombre] = resolverPestana(resultado);
  }

  return {
    conexion: "ok",
    detalleErrorConexion: null,
    state: estadoPestana,
    extras: resultadoExtras,
  };
}
