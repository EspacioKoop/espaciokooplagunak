import assert from "node:assert/strict";
import { reducir, crearEstado, select } from '../scripts/turno-orden-reductor.mjs';

/** Helper to deep freeze an object for comparison (since reducer returns frozen). */
function deepFreeze(obj) {
  return Object.isFrozen(obj) ? obj : Object.freeze(obj);
}

export function testTurnOrderReducer() {
  // Test INIT
  let state = reducir(crearEstado(), { type: 'INIT' });
  assert.deepStrictEqual(state, crearEstado());

  // Test ADD_COMBATANT
  state = reducir(state, {
    type: 'ADD_COMBATANT',
    payload: { id: '1', name: 'Goblin', initiativeMod: 2, ally: false, race: 'elfo', className: 'mago', shiny: true },
  });
  assert.equal(state.combatants.length, 1);
  assert.equal(state.combatants[0].id, '1');
  assert.equal(state.combatants[0].initiative, 2); // base initiative equals modifier
  assert.equal(state.currentIndex, 0);
  assert.equal(state.round, 0);
  assert.equal(state.active, false);
  assert.equal(state.combatants[0].race, 'elfo');
  assert.equal(state.combatants[0].className, 'mago');
  assert.equal(state.combatants[0].shiny, true);

  // Add another with higher initiative
  state = reducir(state, {
    type: 'ADD_COMBATANT',
    payload: { id: '2', name: 'Knight', initiativeMod: 5, ally: true },
  });
  assert.equal(state.combatants.length, 2);
  // Should be sorted: Knight first (5), Goblin second (2)
  assert.equal(state.combatants[0].id, '2');
  assert.equal(state.combatants[1].id, '1');
  // Current index should stay at 0? Since we added before current? Actually currentIndex was 0 (Goblin). After adding Knight before Goblin, the Goblin moved to index 1. Our reducer tries to keep currentIndex pointing to same combatant if possible.
  // Let's see what we got.
  // We'll accept either behavior but we need to know. Let's compute expected: we want to keep track of the combatant that was current (Goblin). After insertion, Goblin is at index 1.
  // Our reducer logic: if currentIndex < old length and the combatant at old currentIndex still exists, we keep its index.
  // Old combatants: [Goblin]; currentIndex 0 points to Goblin.
  // After adding Knight, sorted: [Knight, Goblin]; Goblin is at index 1.
  // So we expect currentIndex to become 1.
  assert.equal(state.combatants[state.currentIndex].id, '1'); // Goblin still current

  // Test SET_INITIATIVE (change initiative of Goblin to 10)
  state = reducir(state, {
    type: 'SET_INITIATIVE',
    payload: { id: '1', initiative: 10 },
  });
  // Now Goblin initiative 10 > Knight 5, so order should goblin first
  assert.equal(state.combatants[0].id, '1');
  assert.equal(state.combatants[1].id, '2');
  // Current index should still point to Goblin (now at index 0)
  assert.equal(state.combatants[state.currentIndex].id, '1');

  // Test ROLL_INITIATIVE: add roll to Knight
  state = reducir(state, {
    type: 'ROLL_INITIATIVE',
    payload: { id: '2', roll: 4 }, // initiativeMod 5 + 4 = 9
  });
  // Knight initiative becomes 9, Goblin 10 -> Goblin still first
  assert.equal(state.combatants[0].id, '1');
  assert.equal(state.combatants[0].initiative, 10);
  assert.equal(state.combatants[1].id, '2');
  assert.equal(state.combatants[1].initiative, 9);

  // Test NEXT_TURN (activate combat)
  state = reducir(state, { type: 'SET_ACTIVE', payload: { active: true } });
  assert.equal(state.active, true);
  state = reducir(state, { type: 'NEXT_TURN' });
  // Should move to Knight (index 1)
  assert.equal(state.combatants[state.currentIndex].id, '2');
  assert.equal(state.currentIndex, 1);
  // Another NEXT_TURN should wrap to Goblin and increment round
  state = reducir(state, { type: 'NEXT_TURN' });
  assert.equal(state.combatants[state.currentIndex].id, '1');
  assert.equal(state.currentIndex, 0);
  assert.equal(state.round, 1);

  // Test REMOVE_COMBATANT: remove Goblin (id 1) when it's current
  state = reducir(state, {
    type: 'REMOVE_COMBATANT',
    payload: { id: '1' },
  });
  assert.equal(state.combatants.length, 1);
  assert.equal(state.combatants[0].id, '2');
  // After removal, if removed combatant was current, we set currentIndex to next (or 0 if only one left)
  // Since we removed index 0 and it was current, next index would be 0 (the only remaining)
  assert.equal(state.currentIndex, 0);
  assert.equal(state.combatants[state.currentIndex].id, '2');
  // Round should stay same? Our reducer does not change round on remove.
  assert.equal(state.round, 1);

  // Test SET_COMBATANTS (replace list)
  state = reducir(state, {
    type: 'SET_COMBATANTS',
    payload: {
      combatants: [
        { id: '3', name: 'Elf', initiative: 7, initiativeMod: 3, ally: false },
        { id: '4', name: 'Orc', initiative: 4, initiativeMod: 1, ally: true },
      ],
    },
  });
  assert.equal(state.combatants.length, 2);
  assert.equal(state.combatants[0].id, '3'); // Elf first
  assert.equal(state.combatants[1].id, '4');
  // Since we replaced list, currentIndex should be 0 if active (we are active)
  assert.equal(state.currentIndex, 0);
  assert.equal(state.active, true);
  // Round unchanged? Keep previous round (1)
  assert.equal(state.round, 1);

  // Test RESET
  state = reducir(state, { type: 'RESET' });
  assert.deepStrictEqual(state, crearEstado());

  state = reducir(crearEstado(), {
    type: 'ADD_COMBATANT',
    payload: { id: 'status', name: 'Alda', initiativeMod: 4, ally: true },
  });
  state = reducir(state, {
    type: 'SET_COMBATANT_STATUS',
    payload: { id: 'status', statuses: ['concentracion', 'invalido', 'concentracion'], inspiration: true, exhaustion: 9 },
  });
  assert.deepStrictEqual(state.combatants[0].statuses, ['concentracion']);
  assert.equal(state.combatants[0].inspiration, true);
  assert.equal(state.combatants[0].exhaustion, 6);

  // Regression: SET_INITIATIVE on ANOTHER combatant (not the active one) must
  // never steal the active turn, even when the old index of the active
  // combatant coincides with the new index of the reordered one.
  // A=20 (active, index 0), B=10 (index 1). Setting B's initiative to 30
  // puts B at index 0 too — comparing indices instead of IDs used to make
  // the reducer think "nothing changed" and leave currentIndex=0, which then
  // pointed at B instead of A.
  let stolen = reducir(crearEstado(), {
    type: 'ADD_COMBATANT',
    payload: { id: 'A', name: 'A', initiativeMod: 20, ally: true },
  });
  stolen = reducir(stolen, {
    type: 'ADD_COMBATANT',
    payload: { id: 'B', name: 'B', initiativeMod: 10, ally: true },
  });
  stolen = reducir(stolen, { type: 'SET_INITIATIVE', payload: { id: 'A', initiative: 20 } });
  stolen = reducir(stolen, { type: 'SET_ACTIVE', payload: { active: true } });
  assert.equal(select.combatantActual(stolen).id, 'A');
  stolen = reducir(stolen, { type: 'SET_INITIATIVE', payload: { id: 'B', initiative: 30 } });
  assert.equal(
    select.combatantActual(stolen).id,
    'A',
    'SET_INITIATIVE sobre otro combatiente no debe robar el turno activo',
  );

  console.log('All tests passed');
}

// Run if invoked directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testTurnOrderReducer();
}
