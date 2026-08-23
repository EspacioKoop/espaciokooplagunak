import assert from 'node:assert/strict';
import { registrarRelevoPuestos } from '../scripts/station-handover.mjs';

// Mock global objects required by the listener
const Hooks = {
  listeners: {},
  on(event, fn) { this.listeners[event] = fn; },
  off(event) { delete this.listeners[event]; },
};

const foundry = { utils: { randomID: () => 'r1' } };

let game;
const JournalEntryMock = {
  createEmbeddedDocuments: async (_tipo, entradas) => {
    // simulate adding pages
    return entradas;
  },
  journalCreado: { pages: [] },
};

const ui = { avisos: [], notifications: { info: (msg) => ui.avisos.push(msg) } };

// Provide a simple Journal and game objects
game = {
  user: { isGM: true },
  users: { activeGM: { isGM: true } },
  i18n: {
    localize: (key) => key,
    format: (key, datos) => `${key}${datos ? ` ${JSON.stringify(datos)}` : ''}`,
  },
};

// Make globals accessible to module
globalThis.Hooks = Hooks;
globalThis.foundry = foundry;

(async () => {
  const cleanup = registrarRelevoPuestos('testMod');
  const listener = Hooks.listeners['updateUser'];
  assert(listener, 'listener registered');

  const userDoc = {
    id: 'u1',
    getFlag: (mod, key) => (mod === 'testMod' && key === 'station' ? 'nav' : null),
  };
  const changes = { flags: { testMod: { station: 'nav' } } };

  await listener(userDoc, changes);
  // Ensure cleanup works
  cleanup();
  assert(!Hooks.listeners['updateUser'], 'listener removed');
})();

console.log('RegistrarRelevoPuestos test passed');
