// Lectura de modificadores reales de la ficha dnd5e (#500, segunda pieza).
//
// Hasta aquí, la vía "habilidad" de la asistencia (`resolucionDisponible` en
// `enfoques.mjs`) solo comprobaba si el ayudante TENÍA ficha —un booleano— y
// el rango de éxito se calculaba siempre con `modificador: 0`: el enfoque
// elegido no importaba para el número, solo para la ficción. Este módulo es
// la otra mitad: dado el `system` ya extraído de un Actor de dnd5e y el
// `habilidad` que declara el enfoque en el catálogo, devuelve el modificador
// real con el que tirar.
//
// ## Por qué es puro
//
// Recibe `ficha` ya como datos planos (`actor.system`, tal cual lo expone el
// data model de dnd5e), no el `Actor` de Foundry. Quien llama desde
// `asistencia-wiring.mjs` hace la única línea que toca Foundry
// (`game.users.get(id).character.system`); aquí no hay nada que no se pueda
// razonar y probar desde Node.
//
// ## Objetivo de compatibilidad
//
// dnd5e 2.3.1, mismo objetivo de regresión que declara
// docs/MINIJUEGOS_ASISTENCIA.md. Las claves de habilidad y herramienta son
// las que usa ESE data model (`system.skills.<clave>.total`,
// `system.tools.<clave>.total`, `system.abilities.<clave>.mod`); si un
// upstream de dnd5e las renombra, este es el único archivo que hay que tocar.

/** Los tres tipos de habilidad que un enfoque puede declarar. No hay más. */
export const TIPOS_HABILIDAD = Object.freeze(["skill", "tool", "ability"]);

/**
 * Modificador real de la ficha para la `habilidad` que declara un enfoque, o
 * `null` si no se puede leer (sin ficha, habilidad no declarada, o la ficha
 * no tiene esa clave — un personaje sin competencia en una herramienta
 * concreta simplemente no tiene esa entrada).
 *
 * `null` y no `0`: quien llama decide qué hacer con la ausencia (en
 * `sesion.mjs`, caer al 0 de siempre), y confundir "no se pudo leer" con "el
 * modificador es cero" escondería una ficha rota detrás de un número
 * plausible.
 */
export function modificadorDeFicha(ficha, habilidad) {
  if (!ficha || !habilidad) return null;
  const separador = String(habilidad).indexOf(":");
  if (separador < 0) return null;
  const tipo = habilidad.slice(0, separador);
  const clave = habilidad.slice(separador + 1);
  if (!clave || !TIPOS_HABILIDAD.includes(tipo)) return null;

  if (tipo === "ability") {
    const valor = ficha.abilities?.[clave]?.mod;
    return Number.isFinite(valor) ? Math.trunc(valor) : null;
  }
  const origen = tipo === "skill" ? ficha.skills?.[clave] : ficha.tools?.[clave];
  const valor = origen?.total;
  return Number.isFinite(valor) ? Math.trunc(valor) : null;
}
