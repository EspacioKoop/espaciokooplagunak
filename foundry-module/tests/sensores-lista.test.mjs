import test from 'node:test';
import assert from 'node:assert/strict';

import { filasDegradadas, filasCrudas, ESPACIO_FINO } from '../scripts/sensores-lista.mjs';

// Mock i18n object with a simple localize function that returns the key for testing
const mockI18n = {
  localize: (key) => key,
};

// Mock localizarFaccion function (for filasCrudas) that returns the faction string
const mockLocalizarFaccion = (faction) => faction;

test('filasDegradadas filtra al jugador propio', () => {
  const sensores = {
    contactos: [
      { callsign: 'Nav1', distancia: 100, rumboDeg: 45, esJugador: false },
      { callsign: 'Nav2', distancia: 200, rumboDeg: 90, esJugador: true }, // own ship
      { callsign: 'Nav3', distancia: 150, rumboDeg: 30, esJugador: false },
    ],
  };
  const result = filasDegradadas(sensores, mockI18n);
  assert.strictEqual(result.length, 2); // own ship filtered out
  assert.strictEqual(result[0].callsign, 'Nav1'); // closest first
  assert.strictEqual(result[1].callsign, 'Nav3');
});

test('filasDegradadas ordena por distancia ascendente', () => {
  const sensores = {
    contactos: [
      { callsign: 'Nav1', distancia: 300, rumboDeg: 0, esJugador: false },
      { callsign: 'Nav2', distancia: 100, rumboDeg: 0, esJugador: false },
      { callsign: 'Nav3', distancia: 200, rumboDeg: 0, esJugador: false },
    ],
  };
  const result = filasDegradadas(sensores, mockI18n);
  assert.strictEqual(result[0].callsign, 'Nav2'); // 100
  assert.strictEqual(result[1].callsign, 'Nav3'); // 200
  assert.strictEqual(result[2].callsign, 'Nav1'); // 300
});

test('filasDegradadas recorta a MAXIMO_FILAS (8)', () => {
  const contactos = Array.from({ length: 10 }, (_, i) => ({
    callsign: `Nav${i+1}`,
    distancia: (i+1) * 100,
    rumboDeg: 0,
    esJugador: false,
  }));
  const sensores = { contactos };
  const result = filasDegradadas(sensores, mockI18n);
  assert.strictEqual(result.length, 8); // MAXIMO_FILAS
});

test('filasDegradadas trata contacto sin callsign como eco', () => {
  const sensores = {
    contactos: [
      { callsign: undefined, distancia: 100, rumboDeg: 45, esJugador: false },
      { callsign: null, distancia: 200, rumboDeg: 90, esJugador: false },
      { callsign: 123, distancia: 300, rumboDeg: 30, esJugador: false }, // number, not string
    ],
  };
  const result = filasDegradadas(sensores, mockI18n);
  // All three should be eco
  assert.strictEqual(result[0].callsign, 'LAGUNAK.Espacios.Sensores.Eco');
  assert.strictEqual(result[1].callsign, 'LAGUNAK.Espacios.Sensores.Eco');
  assert.strictEqual(result[2].callsign, 'LAGUNAK.Espacios.Sensores.Eco');
  // faction should be localized as SinIdentificar
  assert.strictEqual(result[0].faction, 'LAGUNAK.Espacios.Sensores.SinIdentificar');
});

test('filasDegradadas con callsign real muestra callsign y faction', () => {
  const sensores = {
    contactos: [
      { callsign: 'Halcon', distancia: 100, rumboDeg: 45, esJugador: false, faction: 'Imperio' },
      { callsign: '', distancia: 200, rumboDeg: 90, esJugador: false }, // empty string
      { callsign: 'Orión', distancia: 300, rumboDeg: 30, esJugador: false }, // no faction
    ],
  };
  const result = filasDegradadas(sensores, mockI18n);
  assert.strictEqual(result[0].callsign, 'Halcon');
  assert.strictEqual(result[0].faction, 'Imperio');
  assert.strictEqual(result[1].callsign, ''); // empty string becomes empty string
  assert.strictEqual(result[1].faction, 'LAGUNAK.Facciones.SinFaccion'); // default
  assert.strictEqual(result[2].callsign, 'Orión');
  assert.strictEqual(result[2].faction, 'LAGUNAK.Facciones.SinFaccion');
});

test('filasDegradadas sin distancia o rumbo legibles usa texto de SinLectura', () => {
  const sensores = {
    contactos: [
      { callsign: 'Nav1', distancia: undefined, rumboDeg: 45, esJugador: false }, // undefined distance -> entero returns null
      { callsign: 'Nav2', distancia: 100, rumboDeg: undefined, esJugador: false }, // undefined rumbo
      { callsign: 'Nav3', distancia: undefined, rumboDeg: undefined, esJugador: false }, // both undefined
    ],
  };
  const result = filasDegradadas(sensores, mockI18n);
  assert.strictEqual(result[0].lectura, 'LAGUNAK.Espacios.Sensores.SinLectura');
  assert.strictEqual(result[1].lectura, 'LAGUNAK.Espacios.Sensores.SinLectura');
  assert.strictEqual(result[2].lectura, 'LAGUNAK.Espacios.Sensores.SinLectura');
});

test('filasDegradadas con margen > 0 muestra ≈ y ±', () => {
  const sensores = {
    contactos: [
      { callsign: 'Nav1', distancia: 2000, rumboDeg: 90, esJugador: false, precision: 50, rumboPrecision: 10 },
    ],
  };
  const result = filasDegradadas(sensores, mockI18n);
  // Expect format: ≈2 000 · ≈90 ° ±50 · ±10 (using ESPACIO_FINO for thousands separator)
  // We'll check for the presence of the symbols and the structure.
  assert.match(result[0].lectura, /^≈/);
  assert.match(result[0].lectura, /·/);
  assert.match(result[0].lectura, /±/);
  // More precise check: the distance part should have ≈ and the bearing part should have ≈ and ±
  // Since we are using mock i18n, the strings are the keys, but the medida function returns formatted strings.
  // We can check that the string contains the unicode for approximate and plus-minus.
  assert.match(result[0].lectura, /≈/);
  assert.match(result[0].lectura, /±/);
});

test('filasDegradadas sin margen (0 o ausente) no muestra ≈ ni ±', () => {
  const sensores = {
    contactos: [
      { callsign: 'Nav1', distancia: 2000, rumboDeg: 90, esJugador: false, precision: 0, rumboPrecision: 0 },
      { callsign: 'Nav2', distancia: 2000, rumboDeg: 90, esJugador: false }, // precision and rumboPrecision undefined
    ],
  };
  const result = filasDegradadas(sensores, mockI18n);
  // For precision: 0 -> no ±
  assert.strictEqual(!/±/.test(result[0].lectura), true);
  assert.strictEqual(!/≈/.test(result[0].lectura), true);
  // For undefined: treated as 0 -> no ±
  assert.strictEqual(!/±/.test(result[1].lectura), true);
  assert.strictEqual(!/≈/.test(result[1].lectura), true);
});

test('filasCrudas nunca marca eco', () => {
  const contactsPayload = {
    contacts: [
      { callsign: 'Nav1', position: { x: 100, y: 200 }, faction: 'Imperio', is_player: false },
      { callsign: 'Nav2', position: { x: -50, y: 30 }, faction: 'Rebeldes', is_player: true }, // own ship
      { callsign: 'Nav3', position: { x: 0, y: 0 }, is_player: false }, // no faction
    ],
  };
  const result = filasCrudas(contactsPayload, mockI18n, mockLocalizarFaccion);
  assert.strictEqual(result.length, 2); // own ship filtered out
  assert.strictEqual(result[0].eco, false);
  assert.strictEqual(result[1].eco, false);
});

test('filasCrudas usa is_player y contacts', () => {
  const contactsPayload = {
    contacts: [
      { callsign: 'Nav1', position: { x: 100, y: 200 }, faction: 'Imperio', is_player: false },
    ],
  };
  const result = filasCrudas(contactsPayload, mockI18n, mockLocalizarFaccion);
  assert.strictEqual(result[0].callsign, 'Nav1');
  assert.strictEqual(result[0].faction, 'Imperio');
  assert.strictEqual(result[0].lectura, '100, 200');
});

test('filasCrudas coordenadas exactas', () => {
  const contactsPayload = {
    contacts: [
      { callsign: 'Nav1', position: { x: 123, y: -456 }, faction: 'Imperio', is_player: false },
    ],
  };
  const result = filasCrudas(contactsPayload, mockI18n, mockLocalizarFaccion);
  assert.strictEqual(result[0].lectura, '123, -456');
});

test('Miles con separador correcto (ESPACIO_FINO) en distancia de 4+ cifras', () => {
  // We need to test the conMiles function indirectly through filasDegradadas or filasCrudas.
  // Let's create a contact with distance 1234567 and see if the lectura contains the fine space.
  // We'll use filasDegradadas and check the distancia part of the lectura.
  const sensores = {
    contactos: [
      { callsign: 'Nav1', distancia: 1234567, rumboDeg: 0, esJugador: false, precision: 0, rumboPrecision: 0 },
    ],
  };
  const result = filasDegradadas(sensores, mockI18n);
  // The lectura string will be something like "1 234 567 · 0°" (with fine spaces)
  // We'll check for the presence of the fine space (Unicode U+202F) in the distance part.
  // Since the bearing is 0, we can split by " · " and check the first part.
  const distanciaPart = result[0].lectura.split(' · ')[0];
  assert.match(distanciaPart, new RegExp(ESPACIO_FINO)); // should contain the fine space
  // Also check that the number is formatted with fine spaces as thousands separators.
  // We can also test conMiles directly if we export it, but it's not exported.
  // Alternatively, we can test the conMiles function by importing it? It's not exported.
  // We'll rely on the above.
});
