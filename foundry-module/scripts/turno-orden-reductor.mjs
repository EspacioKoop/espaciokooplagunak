/**
 * Turn order reducer: pure state machine for initiative and turn management.
 * Follows the pattern of asistencia/sesion.mjs: immutable state, pure functions.
 *
 * State shape:
 *   {
 *     combatants: Array<{id:string, name:string, initiative:number, initiativeMod:number, ally:boolean, race?:string, className?:string, shiny?:boolean, statuses?:string[], exhaustion?:number}>,
 *     currentIndex: number,
 *     round: number,
 *     active: boolean
 *   }
 *
 * Actions:
 *   {type: 'INIT'} - start fresh state
 *   {type: 'ADD_COMBATANT', payload: {id, name, initiativeMod, ally, race, className, shiny, statuses, exhaustion}}
 *   {type: 'REMOVE_COMBATANT', payload: {id}}
 *   {type: 'SET_INITIATIVE', payload: {id, initiative}} // sets raw initiative (after roll)
 *   {type: 'ROLL_INITIATIVE', payload: {id, roll}} // adds roll to initiativeMod
 *   {type: 'NEXT_TURN'} - advance to next combatant
 *   {type: 'RESET'} - clear combatants, reset index/round/active
 *   {type: 'SET_ACTIVE', payload: {active}}
 *   {type: 'SET_ROUND', payload: {round}}
 *   {type: 'SET_CURRENT_INDEX', payload: {currentIndex}}
 *   {type: 'SET_COMBATANTS', payload: {combatants}} // replace entire list (sorted)
 */

export const TURN_ORDER_ERRORES = Object.freeze({
  COMBATANT_NOT_FOUND: 'combatant-not-found',
  COMBAT_NOT_ACTIVE: 'combat-not-active',
});

const ESTADOS_VALIDOS = Object.freeze(['herido', 'ventaja', 'concentracion', 'muerto']);

function metadatosDeCombatiente(payload = {}) {
  const estados = Array.isArray(payload.statuses)
    ? [...new Set(payload.statuses.filter((estado) => ESTADOS_VALIDOS.includes(estado)))]
    : [];
  const agotamiento = Number.isInteger(payload.exhaustion)
    ? Math.max(0, Math.min(6, payload.exhaustion))
    : 0;
  return {
    race: typeof payload.race === 'string' ? payload.race : null,
    className: typeof payload.className === 'string' ? payload.className : null,
    bando: ['aliado', 'enemigo', 'neutral'].includes(payload.bando) ? payload.bando : null,
    shiny: payload.shiny === true,
    statuses: Object.freeze(estados),
    inspiration: payload.inspiration === true,
    exhaustion: agotamiento,
  };
}

/** Initial state: empty, not active, round 0. */
export function crearEstado() {
  return Object.freeze({
    combatants: Object.freeze([]),
    currentIndex: 0,
    round: 0,
    active: false,
  });
}

/** Helper: find combatant index by id. */
function indicePorId(combatants, id) {
  return combatants.findIndex(c => c.id === id);
}

/** Helper: sort combatants by initiative descending, then by name for tie-break. */
function ordenarPorIniciativa(combatants) {
  return [...combatants].sort((a, b) => {
    if (b.initiative !== a.initiative) return b.initiative - a.initiative;
    return a.name.localeCompare(b.name);
  });
}

/** Reducer: takes state and action, returns new state. */
export function reducir(state, action) {
  // Ensure we work on a frozen state; if not frozen, freeze it (but ideally caller passes frozen).
  const frozen = Object.isFrozen(state) ? state : Object.freeze(state);

  switch (action.type) {
    case 'INIT':
      return crearEstado();

    case 'ADD_COMBATANT': {
      const { id, name, initiativeMod, ally = false } = action.payload;
      if (indicePorId(frozen.combatants, id) >= 0) {
        // Already exists; could update or ignore. We'll ignore for simplicity.
        return frozen;
      }
      const nuevo = Object.freeze({
        id,
        name,
        initiative: initiativeMod, // base initiative starts as modifier (will be rolled later)
        initiativeMod,
        ally,
        ...metadatosDeCombatiente(action.payload),
      });
      const updated = [...frozen.combatants, nuevo];
      const sorted = ordenarPorIniciativa(updated);
      // Determine new currentIndex: try to keep the same combatant as current if any.
      let newIndex = 0;
      if (frozen.combatants.length > 0 &&
          Number.isInteger(frozen.currentIndex) &&
          frozen.currentIndex >= 0 &&
          frozen.currentIndex < frozen.combatants.length) {
        const currentId = frozen.combatants[frozen.currentIndex].id;
        const found = indicePorId(sorted, currentId);
        if (found >= 0) newIndex = found;
      }
      // Clamp just in case
      if (newIndex < 0) newIndex = 0;
      if (newIndex >= sorted.length) newIndex = 0;
      return Object.freeze({
        ...frozen,
        combatants: Object.freeze(sorted),
        currentIndex: newIndex,
      });
    }

    case 'REMOVE_COMBATANT': {
      const { id } = action.payload;
      const idx = indicePorId(frozen.combatants, id);
      if (idx < 0) return frozen;
      const updated = [...frozen.combatants];
      updated.splice(idx, 1);
      const sorted = ordenarPorIniciativa(updated);
      // La baja del activo usa exactamente la transición circular de NEXT_TURN.
      // Primero avanzamos en la lista original, luego conservamos esa identidad.
      const advanced = idx === frozen.currentIndex && frozen.active
        ? reducir(frozen, { type: 'NEXT_TURN' }) : frozen;
      const currentId = advanced.combatants[advanced.currentIndex]?.id;
      const newIndex = Math.max(0, indicePorId(sorted, currentId));
      return Object.freeze({
        ...advanced,
        combatants: Object.freeze(sorted),
        currentIndex: newIndex,
      });
    }

    case 'SET_INITIATIVE': {
      const { id, initiative } = action.payload;
      const idx = indicePorId(frozen.combatants, id);
      if (idx < 0) return frozen;
      const updated = [...frozen.combatants];
      updated[idx] = Object.freeze({
        ...updated[idx],
        initiative,
      });
      const sorted = ordenarPorIniciativa(updated);
      // El turno activo se recalcula siempre a partir del ID que tenía el
      // turno ANTES de reordenar, nunca por posición de índice: si el índice
      // antiguo del activo coincide por casualidad con el nuevo índice del
      // combatiente que se acaba de reordenar (aunque sean combatientes
      // distintos), comparar índices le robaba el turno activo al que de
      // verdad lo tenía.
      const currentId = frozen.combatants[frozen.currentIndex]?.id;
      const adjustedIndex = currentId ? indicePorId(sorted, currentId) : frozen.currentIndex;
      return Object.freeze({
        ...frozen,
        combatants: Object.freeze(sorted),
        currentIndex: adjustedIndex,
      });
    }

    case 'SET_COMBATANT_STATUS': {
      const { id, ...status } = action.payload;
      const idx = indicePorId(frozen.combatants, id);
      if (idx < 0) return frozen;
      const updated = [...frozen.combatants];
      updated[idx] = Object.freeze({ ...updated[idx], ...metadatosDeCombatiente({ ...updated[idx], ...status }) });
      return Object.freeze({ ...frozen, combatants: Object.freeze(updated) });
    }

    case 'ROLL_INITIATIVE': {
      const { id, roll } = action.payload;
      const idx = indicePorId(frozen.combatants, id);
      if (idx < 0) return frozen;
      const base = frozen.combatants[idx].initiativeMod;
      const total = base + roll;
      return reducir(frozen, {
        type: 'SET_INITIATIVE',
        payload: { id, initiative: total },
      });
    }

    case 'NEXT_TURN': {
      if (!frozen.active || frozen.combatants.length === 0) return frozen;
      let next = frozen.currentIndex + 1;
      if (next >= frozen.combatants.length) {
        next = 0;
        // Increment round when we wrap to first combatant
        return Object.freeze({
          ...frozen,
          currentIndex: next,
          round: frozen.round + 1,
        });
      }
      return Object.freeze({
        ...frozen,
        currentIndex: next,
      });
    }

    case 'RESET':
      return crearEstado();

    case 'SET_ACTIVE':
      return Object.freeze({
        ...frozen,
        active: !!action.payload.active,
      });

    case 'SET_ROUND':
      return Object.freeze({
        ...frozen,
        round: Number(action.payload.round) || 0,
      });

    case 'SET_CURRENT_INDEX':
      const idx = Number(action.payload.currentIndex);
      if (Number.isInteger(idx) && idx >= 0 && idx < frozen.combatants.length) {
        return Object.freeze({
          ...frozen,
          currentIndex: idx,
        });
      }
      return frozen;

    case 'SET_COMBATANTS': {
      const { combatants } = action.payload;
      const sorted = ordenarPorIniciativa([...combatants]);
      return Object.freeze({
        ...frozen,
        combatants: Object.freeze(sorted),
        currentIndex: frozen.active && sorted.length > 0 ? 0 : 0, // if active, start at first; else 0
        // round remains? Usually reset round when setting new combatants? We'll keep round unchanged.
      });
    }

    default:
      return frozen;
  }
}

/** Selectors (pure functions to derive data from state) */
export const select = {
  /** Returns the current combatant or null if none. */
  combatantActual: (state) => {
    const { combatants, currentIndex, active } = state;
    if (!active || combatants.length === 0) return null;
    return combatants[currentIndex] || null;
  },
  /** Returns true if combat is active. */
  estaActivo: (state) => state.active,
  /** Returns the current round number. */
  rondaActual: (state) => state.round,
  /** Returns the initiative order array (sorted). */
  ordenIniciativa: (state) => [...state.combatants],
  /** Returns the number of combatants. */
  totalCombatientes: (state) => state.combatants.length,
  /** Returns true if the given combatant id is the current turn. */
  esTurnoDe: (state, id) => {
    const c = select.combatantActual(state);
    return c ? c.id === id : false;
  },
};
