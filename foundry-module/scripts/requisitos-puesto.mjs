// Requisitos de característica para ocupar un puesto (opcional, apagado de serie).
//
// Qué resuelve. El flag `station` es autoasignable (#237) y hasta ahora cualquiera
// podía sentarse en cualquier sitio. Hay mesas que quieren que el puesto tenga
// que ver con la ficha —que ingeniería la lleve alguien despierto y las armas
// alguien con pulso— y mesas que no quieren nada de eso. Por eso es una casilla
// y no una regla: **de serie está apagado y el módulo se comporta como siempre**.
//
// POR QUÉ «ALGUNA DE ESTAS» Y NO UNA SOLA. Un puesto no tiene una única forma de
// llevarse bien: las armas se pueden servir con fuerza bruta o con puntería, y
// ingeniería con conocimiento o con intuición. Exigir una característica concreta
// obligaría a la mesa a construir personajes contra su idea del personaje, que es
// justo lo contrario de para qué sirve una ficha.
//
// LÍMITE HONESTO, escrito aquí para que nadie lo venda de otra manera: esto es
// una puerta de INTERFAZ, igual que la privacidad de las manos del póker. El flag
// lo escribe el propio usuario, así que alguien con la consola del navegador
// abierta puede saltárselo. Sirve para que una mesa se organice, no para
// defenderse de quien quiere hacer trampas.
//
// Puro: ni Foundry, ni DOM, ni red. Las características entran como un objeto
// llano; de sacarlas de la ficha se encarga quien llama.

import { STATIONS } from "./station-assignment.mjs";

/** Las seis características de dnd5e, que es el sistema de la mesa. */
export const CARACTERISTICAS = Object.freeze(["str", "dex", "con", "int", "wis", "cha"]);

/**
 * Qué característica pide cada puesto. Es una LISTA por puesto: basta cumplir
 * una. Son valores de partida discutibles a propósito —una mesa puede quererlos
 * de otra manera— y por eso se pueden sustituir enteros al llamar.
 */
export const REQUISITOS_POR_DEFECTO = Object.freeze({
  // Mando: convencer a la tripulación, no levantar peso.
  captain: Object.freeze(["cha", "wis"]),
  // Astrogación: cuentas o buen ojo para el rumbo.
  navigation: Object.freeze(["int", "wis"]),
  // Ingeniería: saber cómo funciona, o intuir qué le pasa.
  engineering: Object.freeze(["int", "wis"]),
  // Sensores: leer lo que casi no se ve.
  sensors: Object.freeze(["wis", "int"]),
  // Comunicaciones: hablar con quien está al otro lado.
  communications: Object.freeze(["cha", "int"]),
  // Armas: pulso o empuje, las dos valen.
  weapons: Object.freeze(["dex", "str"]),
  // Relay: llevar la cuenta de todo a la vez, o darse cuenta de lo que falta.
  relay: Object.freeze(["int", "wis"]),
  // Control de daños: aguantar el tipo mientras la nave se cae a trozos, o
  // saber qué se apaga primero.
  damagecontrol: Object.freeze(["con", "int"]),
});

/** Puntuación mínima de serie. 12 es «por encima de la media» sin ser una criba. */
export const MINIMO_POR_DEFECTO = 12;

export const REQUISITO_ERRORES = Object.freeze({
  SIN_FICHA: "sin-ficha",
  PUNTUACION_BAJA: "puntuacion-baja",
});

function entero(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/**
 * Normaliza la tabla de requisitos que llega de un ajuste editable a mano. Se
 * acota en vez de fallar, como `normalizarMesa` en la mesa de póker: una errata
 * en un ajuste no debe dejar la tripulación sin poder sentarse.
 */
export function normalizarRequisitos(config = {}) {
  const minimo = entero(config?.minimo);
  const puestos = {};
  for (const puesto of STATIONS) {
    const crudo = config?.puestos?.[puesto];
    const lista = (Array.isArray(crudo) ? crudo : REQUISITOS_POR_DEFECTO[puesto]).filter((c) =>
      CARACTERISTICAS.includes(c),
    );
    // Una lista vacía significaría un puesto imposible de ocupar, que no es lo
    // que nadie quiere decir al vaciarla: se lee como «este puesto no pide nada».
    puestos[puesto] = lista.length > 0 ? [...lista] : [];
  }
  return {
    activo: Boolean(config?.activo),
    minimo: minimo != null && minimo >= 1 && minimo <= 30 ? minimo : MINIMO_POR_DEFECTO,
    puestos,
  };
}

/**
 * Puntuaciones de una ficha de dnd5e, como objeto llano. Devuelve `null` si no
 * hay ficha — que NO es lo mismo que una ficha con todo a cero, igual que en las
 * barras de estado: ausencia y cero son cosas distintas.
 */
export function caracteristicasDeActor(actor) {
  const abilities = actor?.system?.abilities;
  if (!abilities || typeof abilities !== "object") return null;
  const salida = {};
  let alguna = false;
  for (const clave of CARACTERISTICAS) {
    const valor = entero(abilities[clave]?.value);
    if (valor != null) {
      salida[clave] = valor;
      alguna = true;
    }
  }
  return alguna ? salida : null;
}

/**
 * ¿Puede esta ficha ocupar este puesto?
 *
 * Devuelve siempre la misma forma —`{ ok, codigo, exigidas, minimo, mejor }`—
 * para que quien pinta pueda explicar POR QUÉ no, y no solo tachar la opción.
 * Una puerta que no dice su motivo se vive como un fallo del módulo.
 */
export function cumpleRequisito({ puesto, caracteristicas, requisitos } = {}) {
  const config = normalizarRequisitos(requisitos);
  const exigidas = config.puestos[puesto] ?? [];

  // Con la regla apagada, sin puesto (levantarse siempre se puede) o con un
  // puesto que no pide nada, se pasa sin mirar la ficha.
  if (!config.activo || !puesto || exigidas.length === 0) {
    return { ok: true, codigo: null, exigidas, minimo: config.minimo, mejor: null };
  }

  // Sin ficha no se puede comprobar, y aquí se ELIGE bloquear. Dejar pasar
  // convertiría el ajuste en una mentira: bastaría con no asignarse personaje
  // para saltárselo. El GM sigue pudiendo sentar a quien quiera, así que no deja
  // a nadie encerrado.
  if (!caracteristicas) {
    return { ok: false, codigo: REQUISITO_ERRORES.SIN_FICHA, exigidas, minimo: config.minimo, mejor: null };
  }

  let mejor = null;
  for (const clave of exigidas) {
    const valor = entero(caracteristicas[clave]);
    if (valor == null) continue;
    if (mejor == null || valor > mejor.valor) mejor = { clave, valor };
  }

  if (mejor != null && mejor.valor >= config.minimo) {
    return { ok: true, codigo: null, exigidas, minimo: config.minimo, mejor };
  }
  return {
    ok: false,
    codigo: REQUISITO_ERRORES.PUNTUACION_BAJA,
    exigidas,
    minimo: config.minimo,
    mejor,
  };
}

/**
 * Puestos que esta ficha puede ocupar, con su motivo si no. Lo usa la lista de
 * asignación para deshabilitar opciones **explicando** el porqué.
 *
 * `esGM` exime siempre: el GM tiene que poder recolocar a la tripulación aunque
 * la regla diga que no, o una mesa mal configurada se queda atascada sin salida.
 */
export function puestosDisponibles({ caracteristicas, requisitos, esGM = false } = {}) {
  return STATIONS.map((puesto) => {
    if (esGM) {
      return { puesto, ok: true, codigo: null, exento: true };
    }
    const veredicto = cumpleRequisito({ puesto, caracteristicas, requisitos });
    return { puesto, ...veredicto, exento: false };
  });
}
