// Intención de arrastre de una carta proyectada a la escena (#458).
//
// El transporte es hermano del de `station-order-relay.mjs` y de
// `asistencia/relevo.mjs`: quien arrastra escribe en un flag de SU PROPIO
// documento `User` (Foundry impide escribir el de otro), y el GM coordinador
// lo lee del `updateUser` que dispara ese cambio. La identidad NUNCA viaja
// dentro del sobre.
//
// A propósito, este archivo NO pasa por `sesion-motor.aplicar`/`despachar`:
// las cartas que se pueden arrastrar (ver `mesa-proyeccion.mjs`) son siempre
// ya públicas —comunitarias o reveladas en showdown—, así que no hay ninguna
// regla de póker que un arrastre pudiera romper. Lo único que puede fallar es
// que la mesa haya avanzado entre el arrastre y su resolución (la ronda
// terminó, la carta ya no está en la proyección vigente): eso es una
// comprobación de VIGENCIA, no una regla de juego, y por eso vive aquí y no
// en el motor. Las coordenadas de destino son orientativas: quien las aplica
// decide el layout real de la mesa (`minijuegos-tiles.mjs`); este módulo solo
// exige que sean números finitos.

export const ARRASTRE_FLAG = "mesaCartaArrastre";

/**
 * Construye el registro que el arrastrador deja como flag propio. `nonce`
 * fuerza a Foundry a disparar `updateUser` aunque se repita el mismo
 * arrastre.
 */
export function construirIntentoArrastre({ cartaId, destino, nonce }) {
  if (typeof cartaId !== "string" || cartaId === "") {
    throw new TypeError("construirIntentoArrastre requiere cartaId");
  }
  if (!nonce) throw new TypeError("construirIntentoArrastre requiere nonce");
  const x = Number(destino?.x);
  const y = Number(destino?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new TypeError("construirIntentoArrastre requiere destino {x, y} numérico");
  }
  return { cartaId, destino: { x, y }, nonce };
}

/**
 * Saca el intento del diferencial de un `updateUser`. Mismo cuidado que en
 * el relé de órdenes y en la asistencia: `changes` solo dice QUE el flag se
 * tocó, el intento se lee del documento ya actualizado.
 */
export function extraerIntentoDeCambio({ changes, moduleId, userDoc }) {
  const tocado = changes?.flags?.[moduleId]?.[ARRASTRE_FLAG];
  if (!tocado || typeof tocado !== "object") return null;
  const intento = userDoc?.flags?.[moduleId]?.[ARRASTRE_FLAG] ?? tocado;
  if (!intento || typeof intento !== "object") return null;
  if (typeof intento.cartaId !== "string" || intento.cartaId === "") return null;
  if (!intento.nonce) return null;
  const x = Number(intento.destino?.x);
  const y = Number(intento.destino?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { cartaId: intento.cartaId, destino: { x, y }, nonce: intento.nonce };
}

export const ARRASTRE_ERRORES = Object.freeze({
  /** La carta ya no está en la proyección vigente: la mano avanzó o terminó
   *  entre el arrastre y su resolución. No es un rechazo de regla, es que el
   *  objeto que se quería mover ya no representa nada real. */
  CARTA_OBSOLETA: "carta-obsoleta",
  /** El destino cae fuera de los límites de mesa declarados. */
  FUERA_DE_LIMITES: "fuera-de-limites",
});

/**
 * Resuelve un intento contra la proyección vigente. Devuelve la carta
 * proyectada y el destino ya acotado, o un error. No toca Foundry ni el
 * motor: es la validación de vigencia/bounds que le falta a un arrastre
 * puramente cosmético antes de convertirse en una llamada a Tile.
 *
 * @param {{cartas: Array}} proyeccion la salida vigente de `proyectarMesa`.
 * @param {{cartaId: string, destino: {x:number,y:number}}} intento
 * @param {{minX:number,minY:number,maxX:number,maxY:number}} [limites]
 */
export function resolverIntentoArrastre({ proyeccion, intento, limites }) {
  const carta = (proyeccion?.cartas ?? []).find((c) => c.id === intento?.cartaId);
  if (!carta) {
    return { ok: false, codigo: ARRASTRE_ERRORES.CARTA_OBSOLETA };
  }
  const destino = acotar(intento.destino, limites);
  if (!destino) {
    return { ok: false, codigo: ARRASTRE_ERRORES.FUERA_DE_LIMITES };
  }
  return { ok: true, carta, destino };
}

function acotar(destino, limites) {
  if (!limites) return destino;
  const { minX = -Infinity, minY = -Infinity, maxX = Infinity, maxY = Infinity } = limites;
  if (maxX < minX || maxY < minY) return null;
  return {
    x: Math.min(Math.max(destino.x, minX), maxX),
    y: Math.min(Math.max(destino.y, minY), maxY),
  };
}
