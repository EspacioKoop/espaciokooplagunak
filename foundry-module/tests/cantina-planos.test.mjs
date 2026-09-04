import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PLANOS,
  PLANO_INICIAL,
  planoPorId,
  destinoValido,
} from '../scripts/cantina-planos.mjs';

// 1. planoPorId con un id real devuelve el plano correcto.
test('planoPorId returns correct plano for real id', () => {
  for (const esperado of PLANOS) {
    const obtenido = planoPorId(esperado.id);
    assert.strictEqual(obtenido.id, esperado.id);
    // deepStrictEqual for frozen objects
    assert.deepStrictEqual(obtenido, esperado);
  }
});

// 2. planoPorId con un id inexistente devuelve el plano PLANO_INICIAL, no undefined.
test('planoPorId returns PLANO_INICIAL for unknown id', () => {
  const desconocido = 'no-existe';
  const obtenido = planoPorId(desconocido);
  assert.strictEqual(obtenido.id, PLANO_INICIAL);
  // Ensure it's not undefined
  assert.ok(obtenido !== undefined);
});

// 3. destinoValido es true para cada id real de PLANOS, false para uno inventado.
test('destinoValido returns true for real ids and false for invented', () => {
  for (const plano of PLANOS) {
    assert.strictEqual(destinoValido(plano.id), true);
  }
  assert.strictEqual(destinoValido('inventado'), false);
});

// 4. Cada accion "ir" de cada plano en PLANOS tiene un destino que es un id real de otro plano en PLANOS.
test('every "ir" action has a real destination id', () => {
  const idsSet = new Set(PLANOS.map(p => p.id));
  for (const plano of PLANOS) {
    for (const accion of plano.acciones) {
      if (accion.tipo === 'ir') {
        assert.ok(
          idsSet.has(accion.destino),
          `En plano ${plano.id}, acción "ir" tiene destino ${accion.destino} que no es un id real`
        );
        assert.notStrictEqual(
          accion.destino,
          plano.id,
          `En plano ${plano.id}, acción "ir" es un bucle a sí mismo`
        );
      }
    }
  }
});

// 5. Los ids de PLANOS son todos distintos entre sí.
test('all ids in PLANOS are unique', () => {
  const ids = PLANOS.map(p => p.id);
  const unique = new Set(ids);
  assert.strictEqual(unique.size, ids.length, 'hay ids duplicados');
});

// 6. PLANO_INICIAL es uno de los ids presentes en PLANOS.
test('PLANO_INICIAL is one of the ids in PLANOS', () => {
  const ids = PLANOS.map(p => p.id);
  assert.ok(ids.includes(PLANO_INICIAL), `${PLANO_INICIAL} no está en la lista de ids`);
});
