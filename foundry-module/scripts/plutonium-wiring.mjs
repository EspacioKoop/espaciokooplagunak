// Detección de plutonium/5etools en el mundo (#332).
//
// Igual que el resto del módulo de contenido externo: opcional, se detecta,
// no se depende de él (docs/MINIJUEGOS_ASISTENCIA.md §"dnd5e es
// enriquecimiento, no dependencia dura", aplicado un escalón más arriba).
// `module.json` no declara ninguna relación con plutonium a propósito.
//
// Recibe `gameGlobal` por parámetro en vez de leer el global `game`: así
// sigue siendo testeable desde Node sin simular Foundry entero, y quien
// wire esto en main.mjs decide explícitamente qué instante de `game`
// pasarle.

export function plutoniumDisponible(gameGlobal) {
  return Boolean(gameGlobal?.modules?.get?.("plutonium")?.active);
}

/**
 * Contenido crudo del mundo para pasar a resolverCriaturas/Objetos/Hechizos.
 * Con plutonium ausente o `gameGlobal` sin inicializar, devuelve colecciones
 * vacías: el adaptador las procesa igual y no encuentra nada, sin ramas
 * especiales — cero regresión cuando plutonium no está.
 */
export function contenidoDelMundo(gameGlobal) {
  if (!plutoniumDisponible(gameGlobal)) {
    return { actores: [], items: [] };
  }
  return {
    actores: Array.from(gameGlobal?.actors?.contents ?? []),
    items: Array.from(gameGlobal?.items?.contents ?? []),
  };
}
