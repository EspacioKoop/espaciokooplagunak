// Parlamento: la comunicación como encuentro con un NPC (#810).
//
// Puesto de comunicaciones. Al abrir canal con un contacto se abre una ventana
// de parlamento: el interlocutor es una ficha de `npc-generador.mjs` sembrada
// por el identificador del contacto —misma semilla, mismo NPC en todos los
// clientes, sin transmitir la ficha (#676)—. La conversación ofrece enfoques
// (Persuasión, Engaño, Perspicacia, Intimidación) con su CD y su rango de
// éxito VISIBLE, se resuelve con `asistencia/bandas.mjs` y produce UNA BANDA,
// no un resultado.
//
// ## Por qué es puro
//
// Todo lo que se puede razonar sin Foundry vive aquí: la semilla que deriva del
// contacto, los enfoques que presenta la ventana, el rango de éxito que el
// jugador lee ANTES de tirar y la banda que produce la resolución. La ventana
// (cuando exista) solo pinta; el diálogo nativo de comms (`scripts/comms_*.lua`)
// sigue siendo el camino sin módulo, así que esto es textura encima del núcleo,
// no gameplay que se pierda offline (ADR-0008, standalone-first).
//
// ## ADR-0012 — v1 NO recuerda
//
// La ventana enseña y ambienta; el fruto lo adjudica el GM (Modo A de #309) y
// NO SE GUARDA. Sin reputación, sin «ya hablaste con este», sin estado de
// facción. Este módulo no escribe nada en `User.flags`, `Actor.flags` ni en
// ningún lado: es una función pura de (contacto, ficha) → presentación. Quien
// quiera persistencia tendrá que abrir la decisión de núcleo que #598 dejó
// abierta, y eso es otro issue, no esto.
//
// ## ADR-0013
//
// Mecánica de #676, habilidades del SRD 5.1 (CC-BY-4.0), ni un nombre de las
// obras de referencia. `npc-tablas.test.mjs` ya vigila cada cadena emitida; el
// catálogo de encuentros entra bajo esa misma puerta.
//
// Puro: ni Foundry, ni DOM, ni red, ni `Math.random()`. El NPC sale de su
// propio generador determinista; la semilla del contacto de aquí.

import { crearAleatorio, normalizarSemilla } from "./minijuegos/aleatorio.mjs";
import { generarNpc } from "./npc-generador/npc-generador.mjs";
import {
  BANDAS,
  BANDAS_ORDENADAS,
  bandaDesdeMargen,
  margenContraObjetivo,
} from "./asistencia/bandas.mjs";
import { distribucionBandas, rangoDeExito } from "./asistencia/probabilidad.mjs";
import { CLASES_ENFOQUE } from "./asistencia/enfoques.mjs";

/** Los cuatro enfoques del parlamento. Sus CD son las del escenario; la ficha
 *  del hablante solo aporta el modificador de la habilidad que nombre. */
export const ENFOQUES_PARLAMENTO = Object.freeze([
  { id: "persuasion", clase: CLASES_ENFOQUE.PRUEBA, cd: 14, habilidad: "skill:per" },
  { id: "engano", clase: CLASES_ENFOQUE.PRUEBA, cd: 15, habilidad: "skill:dec" },
  { id: "perspicacia", clase: CLASES_ENFOQUE.PRUEBA, cd: 13, habilidad: "skill:ins" },
  { id: "intimidacion", clase: CLASES_ENFOQUE.PRUEBA, cd: 16, habilidad: "skill:itm" },
]);

/**
 * Deriva una semilla determinista del contacto, NO del `User` autenticado ni de
 * nada que varíe entre clientes (#810 / Odiseo).
 *
 * Contrato:
 *   contacto estable → normalizar → semilla → generarNpc({ semilla, desafio })
 *   → misma ficha en todos los clientes.
 *
 * @param {{callsign?: string, id?: string, faction?: string}} contacto la
 *   identidad estable del contacto. Basta con un id o callsign; la facción NO
 *   entra en la semilla (dos contactos de la misma facción no deben compartir
 *   ficha solo por eso).
 * @param {number} [desafio=1] dificultad del interlocutor.
 */
export function semillaDeContacto(contacto, desafio = 1) {
  const estable = contacto?.id ?? contacto?.callsign;
  if (estable === undefined || estable === null || estable === "") {
    throw new TypeError("semillaDeContacto: el contacto no tiene id ni callsign estables");
  }
  // La semilla es la identidad ya normalizada del generador; el desafío se
  // adjunta para que el mismo contacto a otro desafío sea otro NPC, pero el
  // MISMO contacto + MISMO desafío sigue dando la MISMA ficha en cualquier
  // cliente.
  return `${normalizarSemilla(String(estable))}#parlamento#${Number(desafio) || 0}`;
}

/**
 * Reconstruye el interlocutor del parlamento desde el contacto, en cualquier
 * cliente, sin transmitir la ficha.
 *
 * @returns {{npc: object, semilla: string}} el NPC y la semilla usada (para
 *   trazabilidad y para que la ventana pueda semillar su propio reto si hace
 *   falta). Nunca lanza si el contacto es válido; valida la semilla antes.
 */
export function interlocutorDelContacto(contacto, desafio = 1) {
  const semilla = semillaDeContacto(contacto, desafio);
  const npc = generarNpc({ semilla, desafio });
  return Object.freeze({ npc, semilla });
}

/**
 * Qué lee el jugador ANTES de comprometerse: los cuatro enfoques con su CD y su
 * rango de éxito visible, y el modificador que aporta su ficha.
 *
 * `ficha` es `actor.system` ya plano (mismo contrato que `ficha-dnd5e.mjs`): si
 * no hay ficha, el modificador es 0 y el rango se calcula igual, porque el
 * jugador tiene que ver las probabilidades aunque juegue sin sistema de juego.
 *
 * @returns {Array<{id, clase, cd, habilidad, modificador, via, distribucion, favorable}>}
 *   congelado. `habilidad` es la clave dnd5e del enfoque (fuente única para
 *   quien tire de verdad). `via` es "probabilidad" (los cuatro enfoques del parlamento son
 *   clase (a)); `distribucion` es el reparto de bandas; `favorable` la
 *   probabilidad de éxito o crítico. La UI pinta esto y nada más: la tirada
 *   sigue siendo real en mesa.
 */
export function opcionesVisibles({ enfoques = ENFOQUES_PARLAMENTO, ficha = null, modificadorDe = null } = {}) {
  const resolverMod = modificadorDe ?? ((f, hab) => modificadorDeFicha(f, hab));
  return Object.freeze(enfoques.map((enfoque) => {
    const mod = resolverMod(ficha, enfoque.habilidad);
    const rango = rangoDeExito({
      enfoque,
      modificador: mod ?? 0,
      reglaCasaNatural: false,
    });
    return Object.freeze({
      id: enfoque.id,
      clase: enfoque.clase,
      cd: enfoque.cd,
      // Se expone la habilidad para que el emisor de la tirada NO tenga que
      // mantener su propio mapa enfoque→habilidad: dos mapas se desincronizan,
      // y una habilidad desincronizada tira el dado equivocado en silencio.
      habilidad: enfoque.habilidad ?? null,
      modificador: mod ?? 0,
      via: rango.via,
      distribucion: rango.distribucion,
      favorable: rango.favorable,
    });
  }));
}

/**
 * Resuelve el parlamento: dado el enfoque elegido y el total ya tirado, produce
 * la BANDA, no el resultado. El fruto lo adjudica el GM (Modo A de #309); este
 * módulo no escribe estado (ADR-0012).
 *
 * Separamos explícitamente la probabilidad visible (`opcionesVisibles`) del
 * resultado (`resolverParlamento`): la resolución NO queda escondida dentro del
 * renderer de Foundry, es una función pura que la ventana consume.
 *
 * @param {{id: string, total: number, natural?: number}} tirada el enfoque
 *   elegido por su id y el total del d20 + modificador ya calculado en mesa.
 * @param {Array} [enfoques=ENFOQUES_PARLAMENTO] el repertorio, por si la mesa
 *   sustituye el catálogo.
 * @returns {{enfoque: string, banda: string, margen: number}} congelado.
 */
export function resolverParlamento({ id, total }, enfoques = ENFOQUES_PARLAMENTO) {
  const enfoque = enfoques.find((e) => e.id === id);
  if (!enfoque) throw new RangeError(`resolverParlamento: enfoque «${id}» no existe`);
  const margen = margenContraObjetivo({ total: Number(total), dificultad: Number(enfoque.cd) });
  const banda = bandaDesdeMargen({ margen, salvacion: false });
  return Object.freeze({ enfoque: id, banda, margen });
}

/**
 * Modificador real de la ficha para la habilidad que nombra un enfoque, o `null`
 * si no se puede leer. Replicado localmente para no acoplar este módulo a
 * `ficha-dnd5e.mjs` (que es de la vía de asistencia): mismo contrato de clave
 * `tipo:clave`. `null` y no 0, para que quien llame caiga al 0 de siempre sin
 * confundir «no se pudo leer» con «el modificador es cero».
 */
export function modificadorDeFicha(ficha, habilidad) {
  if (!ficha || !habilidad) return null;
  const separador = String(habilidad).indexOf(":");
  if (separador < 0) return null;
  const tipo = habilidad.slice(0, separador);
  const clave = habilidad.slice(separador + 1);
  if (!clave) return null;
  if (tipo === "ability") {
    const valor = ficha.abilities?.[clave]?.mod;
    return Number.isFinite(valor) ? Math.trunc(valor) : null;
  }
  if (tipo === "skill") {
    const valor = ficha.skills?.[clave]?.total;
    return Number.isFinite(valor) ? Math.trunc(valor) : null;
  }
  if (tipo === "tool") {
    const valor = ficha.tools?.[clave]?.total;
    return Number.isFinite(valor) ? Math.trunc(valor) : null;
  }
  return null;
}

/**
 * Escapa una cadena para inserción segura en el DOM (ADR / revisión de los
 * Dioscuros). Los nombres y facciones del NPC pueden componerse dinámicamente,
 * así que la ventana nunca los escribe sin pasarlos por aquí: un nombre con
 * `<script>` no debe ejecutarse.
 */
export function escaparParaDom(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Re-exporta lo que la ventana necesita sin que tenga que saber de bandas.mjs.
export { BANDAS, BANDAS_ORDENADAS, distribucionBandas };
