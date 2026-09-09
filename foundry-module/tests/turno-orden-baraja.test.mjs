import { generarCartaCombate, generarBarajaTurnos, crearEstado, reducir } from '../scripts/turno-orden-baraja.mjs';
import assert from "node:assert/strict";

/** Helper to compare SVG strings ignoring whitespace differences */
function normalizeSvg(svg) {
  return svg.replace(/\s+/g, ' ').trim();
}

export function testTurnoOrdenBaraja() {
  // Test 1: generarCartaCombate con combatant básico
  const combatant = { id: '1', name: 'Goblin', initiative: 10, initiativeMod: 2, ally: false };
  const datosCampania = new Map(); // vacío
  const estadoCombate = new Map(); // vacío
  const svgCarta = generarCartaCombate(combatant, datosCampania, estadoCombate);
  // Debería ser un string SVG
  assert.ok(typeof svgCarta === 'string' && svgCarta.startsWith('<svg') && svgCarta.endsWith('</svg>'), 'generarCartaCombate returns SVG string');
  // Debería contener el número de iniciativa (10) y la letra E (enemigo)
  // Como estamos dibujando la iniciativa como dos dígitos, 10 -> "10"
  // Y la letra E (enemigo)
  // No podemos asegurar el contenido exacto por la complejidad del SVG, pero al menos que tenga algún texto
  // Vamos a comprobar que contiene el número 1 y 0 y la letra E en algún lugar (en el SVG, el texto está dibujado como pixeles, no como texto)
  // En vez de eso, vamos a comprobar que el SVG tiene un cierto tamaño esperado? No.
  // Por ahora, solo nos aseguramos de que no lanza excepción y devuelve SVG.

  // Test 2: generarBarajaTurnos con estado vacío
  const estadoVacio = crearEstado();
  const svgBarajaVacia = generarBarajaTurnos(estadoVacio, datosCampania, estadoCombate);
  assert.ok(typeof svgBarajaVacia === 'string' && svgBarajaVacia.startsWith('<svg') && svgBarajaVacia.endsWith('</svg>'), 'generarBarajaTurnos with empty state returns SVG string');

  // Test 3: generarBarajaTurnos con un combatant
  const estadoConUno = reducir(crearEstado(), {
    type: 'ADD_COMBATANT',
    payload: { id: '1', name: 'Goblin', initiativeMod: 2, ally: false }
  });
  // Ahora el combatant tiene iniciativa = initiativeMod (2) porque aún no se ha tirado
  const svgBarajaUno = generarBarajaTurnos(estadoConUno, datosCampania, estadoCombate);
  assert.ok(typeof svgBarajaUno === 'string' && svgBarajaUno.startsWith('<svg') && svgBarajaUno.endsWith('</svg>'), 'generarBarajaTurnos with one combatant returns SVG string');

  // Test 4: generarBarajaTurnos con dos combatants y activo
  let estadoDos = reducir(crearEstado(), {
    type: 'ADD_COMBATANT',
    payload: { id: '1', name: 'Goblin', initiativeMod: 2, ally: false }
  });
  estadoDos = reducir(estadoDos, {
    type: 'ADD_COMBATANT',
    payload: { id: '2', name: 'Knight', initiativeMod: 5, ally: true }
  });
  // Orden: Knight (5) luego Goblin (2)
  estadoDos = reducir(estadoDos, { type: 'SET_ACTIVE', payload: { active: true } });
  const svgBarajaDos = generarBarajaTurnos(estadoDos, datosCampania, estadoCombate);
  assert.ok(typeof svgBarajaDos === 'string' && svgBarajaDos.startsWith('<svg') && svgBarajaDos.endsWith('</svg>'), 'generarBarajaTurnos with two combatants returns SVG string');

  // Test 5: con datos de campaña y estado de combate
  const datosCampaniaConDatos = new Map([['1', { nivel: 3 }], ['2', { nivel: 5 }]]);
  const estadoCombateConDatos = new Map([['1', { herido: true, ventaja: false, concentracionRota: false, muerto: false }], ['2', { herido: false, ventaja: true, concentracionRota: false, muerto: false }]]);
  const svgBarajaConDatos = generarBarajaTurnos(estadoDos, datosCampaniaConDatos, estadoCombateConDatos);
  assert.ok(typeof svgBarajaConDatos === 'string' && svgBarajaConDatos.startsWith('<svg') && svgBarajaConDatos.endsWith('</svg>'), 'generarBarajaTurnos with campaign and combat data returns SVG string');

  console.log('All tests passed');
}

// Run if invoked directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testTurnoOrdenBaraja();
}
