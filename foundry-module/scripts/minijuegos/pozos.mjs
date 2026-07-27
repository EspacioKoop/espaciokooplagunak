// Reparto de botes con botes laterales (side pots). Primitiva pura de póker,
// separada del motor para poder probarla en aislamiento y reutilizarla entre
// variantes (Hold'em, Omaha…). No conoce cartas ni turnos: solo cuánto puso
// cada jugador y quién sigue en juego con qué mano.
//
// Regla del bote lateral: un jugador solo puede ganar de cada otro jugador hasta
// lo que él mismo arriesgó. Se construyen capas por niveles de aportación; cada
// capa la ganan las mejores manos ELEGIBLES (no retiradas) que llegaron a ese
// nivel. Las fichas de los jugadores retirados siguen en el bote.

import { compararManos } from "./evaluador-manos.mjs";

// `jugadores`: en orden de asiento, `{ userId, apostadoTotal, retirado }`.
// `evaluaciones`: Map userId -> puntuación (solo para no retirados en showdown).
// Devuelve `{ ganancias: Map userId->fichas, capas: [...] }`.
//
// El reparto de fichas sobrantes (no divisibles entre ganadores) sigue el orden
// de asiento recibido: la ficha impar va al ganador sentado antes, criterio
// estable y determinista.
export function repartirBotes(jugadores, evaluaciones) {
  const ganancias = new Map(jugadores.map((j) => [j.userId, 0]));
  const capas = [];

  // Niveles de aportación distintos y positivos, de menor a mayor.
  const niveles = [...new Set(jugadores.map((j) => j.apostadoTotal))]
    .filter((v) => v > 0)
    .sort((a, b) => a - b);

  let nivelPrevio = 0;
  for (const nivel of niveles) {
    const grosor = nivel - nivelPrevio;
    // Todos los que aportaron al menos este nivel llenan la capa (incluidos los
    // retirados: su dinero está en el bote aunque no puedan ganarlo).
    const contribuyentes = jugadores.filter((j) => j.apostadoTotal >= nivel);
    const montoCapa = grosor * contribuyentes.length;
    if (montoCapa === 0) {
      nivelPrevio = nivel;
      continue;
    }

    // Elegibles: no retirados que llegaron a este nivel y tienen mano evaluada.
    const elegibles = contribuyentes.filter(
      (j) => !j.retirado && evaluaciones.has(j.userId),
    );

    const ganadores = mejores(elegibles, evaluaciones);
    repartirCapa(ganancias, ganadores, montoCapa, jugadores);
    capas.push({
      nivel,
      monto: montoCapa,
      ganadores: ganadores.map((j) => j.userId),
    });
    nivelPrevio = nivel;
  }

  return { ganancias, capas };
}

// Subconjunto de `elegibles` con la mejor puntuación (puede haber empate).
function mejores(elegibles, evaluaciones) {
  let top = [];
  for (const jugador of elegibles) {
    const punt = evaluaciones.get(jugador.userId);
    if (top.length === 0) {
      top = [jugador];
      continue;
    }
    const cmp = compararManos(punt, evaluaciones.get(top[0].userId));
    if (cmp > 0) {
      top = [jugador];
    } else if (cmp === 0) {
      top.push(jugador);
    }
  }
  return top;
}

// Reparte el monto de una capa entre los ganadores; el sobrante (fichas impares)
// se asigna por orden de asiento para ser determinista.
function repartirCapa(ganancias, ganadores, monto, ordenAsiento) {
  if (ganadores.length === 0) {
    return; // Nadie elegible (todos retirados): no debería ocurrir en showdown.
  }
  const parte = Math.floor(monto / ganadores.length);
  let sobra = monto - parte * ganadores.length;
  for (const jugador of ganadores) {
    ganancias.set(jugador.userId, ganancias.get(jugador.userId) + parte);
  }
  // Sobrante ficha a ficha, siguiendo el orden de asiento entre los ganadores.
  const ganadoresPorAsiento = ordenAsiento.filter((j) =>
    ganadores.some((g) => g.userId === j.userId),
  );
  let i = 0;
  while (sobra > 0) {
    const j = ganadoresPorAsiento[i % ganadoresPorAsiento.length];
    ganancias.set(j.userId, ganancias.get(j.userId) + 1);
    sobra -= 1;
    i += 1;
  }
}
