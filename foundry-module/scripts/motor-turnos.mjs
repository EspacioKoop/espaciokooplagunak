function validarCombatiente(combatiente) {
  if (!combatiente || typeof combatiente.id !== "string" || combatiente.id.trim() === "") {
    throw new TypeError("combatiente.id must be a non-empty string");
  }
  if (!Number.isFinite(combatiente.iniciativa)) {
    throw new TypeError("combatiente.iniciativa must be finite");
  }
  return { ...combatiente, id: combatiente.id, iniciativa: combatiente.iniciativa };
}

function ordenar(combatientes) {
  return [...combatientes].sort((left, right) =>
    right.iniciativa - left.iniciativa || left.id.localeCompare(right.id),
  );
}

function copiar(state) {
  return {
    combatientes: state.combatientes.map((combatiente) => ({ ...combatiente })),
    orden: [...state.orden],
    activo: state.activo,
    ronda: state.ronda,
  };
}

function reconstruir(state, combatientes, activo = state.activo) {
  const ordered = ordenar(combatientes);
  const nextActive = ordered.some((combatiente) => combatiente.id === activo)
    ? activo
    : ordered[0]?.id ?? null;
  return {
    combatientes: ordered,
    orden: ordered.map((combatiente) => combatiente.id),
    activo: nextActive,
    ronda: state.ronda,
  };
}

export function crearMotorTurnos(combatientes = []) {
  const normalized = combatientes.map(validarCombatiente);
  if (new Set(normalized.map((combatiente) => combatiente.id)).size !== normalized.length) {
    throw new TypeError("combatiente.id must be unique");
  }
  const ordered = ordenar(normalized);
  return reconstruir({ ronda: 1, activo: ordered[0]?.id ?? null }, ordered, ordered[0]?.id ?? null);
}

export function avanzarTurno(state) {
  const current = copiar(state);
  if (current.orden.length === 0) return current;
  const index = current.orden.indexOf(current.activo);
  const nextIndex = index < 0 ? 0 : (index + 1) % current.orden.length;
  return {
    ...current,
    activo: current.orden[nextIndex],
    ronda: index >= 0 && nextIndex === 0 ? current.ronda + 1 : current.ronda,
  };
}

export function anadirCombatiente(state, combatiente) {
  const current = copiar(state);
  const next = validarCombatiente(combatiente);
  if (current.orden.includes(next.id)) return current;
  return reconstruir(current, [...current.combatientes, next]);
}

export function retirarCombatiente(state, id) {
  const current = copiar(state);
  if (typeof id !== "string" || !current.orden.includes(id)) return current;
  const wasActive = id === current.activo;
  // Dar de baja al combatiente activo usa la MISMA transición circular que
  // NEXT_TURN (avanzarTurno), incluyendo el avance de ronda al dar la vuelta
  // — antes esto se recalculaba a mano con aritmética de índices y nunca
  // tocaba `ronda`, así que volver al primero de la lista tras la última baja
  // no contaba como una vuelta completa.
  const advanced = wasActive ? avanzarTurno(current) : current;
  const remaining = advanced.combatientes.filter((combatiente) => combatiente.id !== id);
  const nextActive = wasActive ? advanced.activo : current.activo;
  return reconstruir(
    { ...advanced, ronda: advanced.ronda },
    remaining,
    remaining.some((combatiente) => combatiente.id === nextActive) ? nextActive : remaining[0]?.id ?? null,
  );
}

export function estadoTurnos(state) {
  return {
    activo: state.activo,
    ronda: state.ronda,
    orden: [...state.orden],
  };
}
