// Mock Foundry globals
global.game = {
  user: { id: 'test', isGM: false },
  users: {
    activeGM: null,
    get: () => ({
      id: 'test',
      character: null,
      getFlag: () => null,
    }),
  },
  settings: {
    get: () => false,
  },
};
global.foundry = {
  utils: {
    randomID: () => 'test-nonce',
  },
};
global.Hooks = {
  on: () => {},
  off: () => {},
  callAll: () => {},
};
global.socket = {
  on: () => {},
  off: () => {},
  emit: () => {},
};

import { assert } from 'node:assert';
import { podarAsistencias } from '../scripts/asistencia-wiring.mjs';

test('podarAsistencias is not exported (removed)', () => {
  assert.equal(typeof podarAsistencias, 'undefined');
});