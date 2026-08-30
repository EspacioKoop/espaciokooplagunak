// Emisor real de la tirada del parlamento (#810).
//
// La ventana (`parlamento-ventana.mjs`) solo PIDE la tirada: emite
// `lagunakParlamentoSolicitaTirada` con el enfoque y el hablante. Este módulo
// es quien la TIENE: lee la ficha del hablante (el dnd5e del User que abrió el
// canal), suma el modificador del enfoque y tira un d20 de verdad, y devuelve el
// total por `lagunakParlamentoResuelve`. La ventana cierra en banda con ese total.
//
// Modular y honesto: la ventana no inventa el total (no miente sobre la salida)
// y la tirada es real, del hablante, no del sistema. Sin Foundry este módulo no
// se registra (main lo hace en `ready`), así que no rompe standalone-first
// (ADR-0008): el contenido núcleo (abrir canal) sigue siendo el diálogo nativo de
// comms y este cableado es textura encima.
//
// La habilidad de cada enfoque NO se declara aquí: viene del propio enfoque
// (`opcionesVisibles(...).habilidad`, declarado en `parlamento.mjs`). Este
// módulo llegó a tener su propio mapa y se desincronizó del catálogo en tres de
// los cuatro enfoques —`prc` (Percepción) por Persuasión, `inv`
// (Investigación) por Perspicacia y un `int` que ni siquiera es clave de
// habilidad en dnd5e 2.3.1, así que caía a 0—. La tirada salía con el
// modificador de otra habilidad y nada lo delataba: el número existe y es
// plausible. Un solo sitio donde escribir la clave es lo que lo impide.
// El modificador lo resuelve `modificadorDeFicha` de `ficha-dnd5e.mjs`; si el
// hablante no tiene esa habilidad, el modificador es 0 (no un número roto).
import { opcionesVisibles } from "./parlamento.mjs";
import { modificadorDeFicha } from "./asistencia/ficha-dnd5e.mjs";

/**
 * Total de la tirada del enfoque para un hablante dado. Puro salvo por el dado:
 * `dado()` devuelve un entero 1..20 (en Foundry es `new Roll("1d20").evaluate()`;
 * en las pruebas lo inyectamos). El modificador viene de la ficha del hablante.
 */
export function totalParlamento({ enfoqueId, ficha, dado = () => 1 + Math.floor(Math.random() * 20) }) {
  if (!enfoqueId) throw new TypeError("totalParlamento requiere enfoqueId");
  const opcion = opcionesVisibles({ ficha }).find((o) => o.id === enfoqueId);
  if (!opcion) throw new RangeError(`enfoque de parlamento desconocido: ${enfoqueId}`);
  const mod = opcion.habilidad ? (modificadorDeFicha(ficha, opcion.habilidad) ?? 0) : 0;
  return dado() + mod;
}

/**
 * Registra el emisor en Foundry. Al pedir tirada, lee la ficha del hablante y
 * emite el total. Sin Foundry no se llama (main lo hace en `ready`), así que el
 * import por sí solo no toca nada.
 *
 * - `leerFicha(hablanteId)`: devuelve `game.users.get(id)?.character?.system`,
 *   o null si no hay hablante/ficha. Se inyecta para poder probar sin Foundry.
 * - `dado()`: inyectable para pruebas deterministas.
 */
export function registrarParlamentoTirada({
  leerFicha = (hablanteId) => game?.users?.get(hablanteId)?.character?.system ?? null,
  dado = () => {
    // Foundry: `new Roll("1d20").evaluate({ async: false }).total`. Fuera de
    // Foundry (no debería registrarse, pero por si acaso) un d20 plano.
    const roll = foundry?.dice?.Roll ?? globalThis.Roll;
    if (roll) {
      const r = new roll("1d20");
      r.evaluate?.({ async: false });
      return r.total ?? 1 + Math.floor(Math.random() * 20);
    }
    return 1 + Math.floor(Math.random() * 20);
  },
} = {}) {
  Hooks.on("lagunakParlamentoSolicitaTirada", ({ enfoqueId, hablanteId } = {}) => {
    if (!enfoqueId) return;
    const ficha = hablanteId ? leerFicha(hablanteId) : null;
    let total;
    try {
      total = totalParlamento({ enfoqueId, ficha, dado });
    } catch {
      return; // Enfoque desconocido: no se inventa salida.
    }
    Hooks.callAll("lagunakParlamentoResuelve", { enfoqueId, total });
  });
}
