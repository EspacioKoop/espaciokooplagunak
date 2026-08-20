// Convocar a la tripulación a una estancia (la playa, el museo, la cantina...).
//
// POR QUE EXISTE. La playa (#587) y la sala del museo (#598) no cuelgan de
// ninguna puerta de la nave —su lista de `puertas` está vacía a propósito—, así
// que hoy solo las abre el GM desde la barra de escena y la tripulación no las
// pisa nunca. Sin esto, cada estatua y cada duna son decorado para una persona.
//
// LO QUE HACE Y LO QUE NO. Esto TRANSPORTA, que es uno de los tres verbos que
// `docs/FOUNDRY.md` permite a una escena —enseñar, transportar y ambientar—. No
// concede, no cuenta y no recuerda: aquí no se escribe estado en ninguna parte,
// ni siquiera de quién fue convocado.
//
// EL ROL SE RECIBE, NO SE ADIVINA. Un módulo puro no pregunta por `game.user`:
// quien llama le pasa el rol. Así se puede probar sin Foundry delante, y así la
// decisión de quién puede convocar vive en un solo sitio.

import { CATALOGO_ANDAR } from "./nave-catalogo-andar.mjs";
import { colisiona } from "./nave-movimiento.mjs";

/** El radio con el que se anda por la nave, el mismo que usan las pruebas de planta. */
const RADIO_TRIPULANTE = 0.35;

/**
 * Dónde aparece la tripulación al ser convocada a `idEstancia`.
 *
 * Devuelve `null` en los tres casos en que no se puede ir: quien convoca no es
 * GM, la estancia no existe, o su entrada está bloqueada. El llamante sólo
 * necesita saber si puede llevar a la gente o no; el día que la interfaz quiera
 * explicar CUAL de los tres fue, esta firma tendrá que devolver el motivo, y
 * ese día es el de cablearla, no antes.
 *
 * @param {string} idEstancia id del catálogo por el que se anda.
 * @param {string} rolConvocante rol de quien convoca; sólo `"GM"` puede.
 * @param {{catalogo?:object}} [opciones] el catálogo se inyecta para poder
 *        probar la estancia bloqueada, que en el catálogo real no ocurre.
 * @returns {{x:number, z:number, yaw:number}|null}
 */
export function convocar(idEstancia, rolConvocante, { catalogo = CATALOGO_ANDAR } = {}) {
  if (rolConvocante !== "GM") return null;
  if (!catalogo.tiene(idEstancia)) return null;

  const estancia = catalogo.obtener(idEstancia);
  const { x, z, yaw } = estancia.entrada;

  // Aparecer dentro de un pedestal o de un mamparo es el fallo que este módulo
  // existe para hacer imposible: se comprueba contra la planta de la estancia,
  // igual que hace el movimiento normal.
  if (colisiona(x, z, RADIO_TRIPULANTE, estancia.planta)) return null;

  return { x, z, yaw };
}
