// Utilidad para tiradas de dado D20 que usa el sistema de Foundry si está disponible,
// o cae a Math.random() en entornos de prueba.
export function rollD20() {
  if (typeof game !== 'undefined' && game.dice) {
    // Foundry VTT: game.dice.roll devuelve un objeto Roll, cuyo total es el resultado.
    return game.dice.roll("1d20").total;
  }
  // Fallback para entornos sin Foundry (pruebas, ejecución independiente).
  return 1 + Math.floor(Math.random() * 20);
}