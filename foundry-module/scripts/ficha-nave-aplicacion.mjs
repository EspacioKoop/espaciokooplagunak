/**
 * Aplicar la ficha generada al token prototipo de un Actor (#354).
 *
 * LA REGLA QUE ESTE MÓDULO HACE CUMPLIR: ningún documento de escena se escribe
 * si no lo pide el GM explícitamente. No hay hook de actualización, no hay
 * sondeo y no hay «se regenera solo cuando cambia la clase» — esa comodidad es
 * justo la que convertiría la ficha en un espejo de la simulación, que es lo
 * que el issue descartó. Lo único que dispara esto es un clic.
 *
 * Se escribe en `prototypeToken.texture.src` del Actor, y NO en tokens ya
 * colocados en una escena: el prototipo es la decisión editorial («esta nave se
 * ve así»), mientras que un token colocado es una instancia que el GM puede
 * haber retocado a mano. Sobrescribir lo segundo sería pisar trabajo suyo.
 *
 * Lógica pura: decide y devuelve el parche, pero no lo aplica. Quien llama
 * —`main.mjs`, y mañana el editor de contenido de #54— es quien toca Foundry,
 * así que esto se prueba entero desde Node.
 */

import { generarFichaNave } from "./ficha-nave.mjs";

/** Motivos por los que no se genera nada. Se traducen en la capa de UI. */
export const MOTIVOS = Object.freeze({
  noGm: "no_gm",
  sinSeleccion: "sin_seleccion",
});

/**
 * Lee la descripción declarativa de la nave desde un Actor.
 *
 * Acepta las tres formas en que un sistema puede haberla guardado y no exige
 * ninguna: sin datos utilizables, `clasificarNave` cae en la silueta de serie,
 * que es exactamente lo que el issue pide para la clase desconocida.
 */
export function describirNaveDeActor(actor) {
  const sistema = actor?.system ?? {};
  const nave = sistema.nave ?? sistema.ship ?? {};
  return {
    tipo: nave.tipo ?? nave.type ?? sistema.tipo ?? sistema.type ?? null,
    clase: nave.clase ?? nave.class ?? sistema.clase ?? sistema.class ?? null,
    subclase: nave.subclase ?? nave.subclass ?? null,
  };
}

/**
 * Decide qué escribir, para una selección de Actores y un usuario dados.
 *
 * @param {{actores: object[], isGM: boolean, color?: string}} entrada
 * @returns {{ok: boolean, motivo?: string, parches: {actor: object, datos: object}[]}}
 *   `parches` lista lo que habría que escribir, actor a actor. Con `ok: false`
 *   siempre viene vacío: no se escribe nada a medias.
 */
export function planificarFichas({ actores, isGM, color } = {}) {
  if (!isGM) return { ok: false, motivo: MOTIVOS.noGm, parches: [] };
  const lista = (Array.isArray(actores) ? actores : []).filter(Boolean);
  if (lista.length === 0) return { ok: false, motivo: MOTIVOS.sinSeleccion, parches: [] };

  const parches = lista.map((actor) => ({
    actor,
    // Ruta con puntos: es la forma en que Foundry aplica un cambio parcial sin
    // reescribir el resto del token prototipo (tamaño, visión, disposición…),
    // que son ajustes del GM y no tienen por qué venirse abajo por un cambio
    // de arte.
    datos: {
      "prototypeToken.texture.src": generarFichaNave({
        nave: describirNaveDeActor(actor),
        ...(color ? { color } : {}),
      }),
    },
  }));
  return { ok: true, parches };
}
