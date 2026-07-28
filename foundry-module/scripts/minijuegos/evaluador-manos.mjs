// Evaluador de manos de póker: dada una colección de 5..7 cartas, calcula la
// mejor mano de 5 y devuelve una puntuación comparable. Primitiva pura y
// reutilizable por cualquier variante (Hold'em, Omaha…); no conoce apuestas ni
// turnos ni Foundry.
//
// Puntuación: `{ categoria, nombre, desempate }`.
//   - `categoria`: 1..9 (mayor gana). Ver CATEGORIAS.
//   - `desempate`: arreglo de valores (mayor primero) que rompe empates DENTRO
//     de la misma categoría, comparado elemento a elemento.
// Comparar dos manos = comparar `categoria` y, si empatan, `desempate`
// lexicográficamente. `compararManos` encapsula esa regla.

export const CATEGORIAS = Object.freeze({
  CARTA_ALTA: 1,
  PAREJA: 2,
  DOBLE_PAREJA: 3,
  TRIO: 4,
  ESCALERA: 5,
  COLOR: 6,
  FULL: 7,
  POKER: 8,
  ESCALERA_COLOR: 9,
});

const NOMBRE_CATEGORIA = Object.freeze({
  1: "carta-alta",
  2: "pareja",
  3: "doble-pareja",
  4: "trio",
  5: "escalera",
  6: "color",
  7: "full",
  8: "poker",
  9: "escalera-color",
});

// Valor alto de la mejor escalera dentro de un conjunto de valores, o 0 si no
// hay. Contempla la escalera baja A-2-3-4-5 (la rueda), donde el As vale 1.
function altoDeEscalera(valores) {
  const conjunto = new Set(valores);
  // El As (14) también cuenta como 1 para la rueda.
  if (conjunto.has(14)) {
    conjunto.add(1);
  }
  const unicos = [...conjunto].sort((a, b) => b - a);
  let seguidas = 1;
  for (let i = 1; i < unicos.length; i += 1) {
    if (unicos[i] === unicos[i - 1] - 1) {
      seguidas += 1;
      if (seguidas >= 5) {
        return unicos[i] + 4; // valor alto de la secuencia de 5
      }
    } else {
      seguidas = 1;
    }
  }
  return 0;
}

// Agrupa valores por frecuencia, ordenados por (frecuencia desc, valor desc).
// Devuelve arreglo de [valor, veces].
function porFrecuencia(cartas) {
  const conteo = new Map();
  for (const carta of cartas) {
    conteo.set(carta.valor, (conteo.get(carta.valor) ?? 0) + 1);
  }
  return [...conteo.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
}

// Toma los primeros `n` valores (mayores) que no estén en `excluidos`.
function kickers(cartas, excluidos, n) {
  const fuera = new Set(excluidos);
  const valores = cartas
    .map((c) => c.valor)
    .filter((v) => !fuera.has(v))
    .sort((a, b) => b - a);
  return valores.slice(0, n);
}

export function evaluarMano(cartas) {
  if (!Array.isArray(cartas) || cartas.length < 5) {
    throw new RangeError("evaluarMano: se requieren al menos 5 cartas");
  }

  const porPalo = new Map();
  for (const carta of cartas) {
    if (!porPalo.has(carta.palo)) {
      porPalo.set(carta.palo, []);
    }
    porPalo.get(carta.palo).push(carta.valor);
  }
  const paloColor = [...porPalo.entries()].find(([, vs]) => vs.length >= 5);

  // Escalera de color: escalera dentro del palo con color.
  if (paloColor) {
    const altoEC = altoDeEscalera(paloColor[1]);
    if (altoEC > 0) {
      return puntuacion(CATEGORIAS.ESCALERA_COLOR, [altoEC]);
    }
  }

  const grupos = porFrecuencia(cartas);
  const [valor1, veces1] = grupos[0];
  const [valor2, veces2] = grupos[1] ?? [0, 0];

  // Póker (cuatro iguales).
  if (veces1 === 4) {
    return puntuacion(CATEGORIAS.POKER, [valor1, ...kickers(cartas, [valor1], 1)]);
  }
  // Full (trío + pareja).
  if (veces1 === 3 && veces2 >= 2) {
    return puntuacion(CATEGORIAS.FULL, [valor1, valor2]);
  }
  // Color.
  if (paloColor) {
    const top5 = [...paloColor[1]].sort((a, b) => b - a).slice(0, 5);
    return puntuacion(CATEGORIAS.COLOR, top5);
  }
  // Escalera.
  const alto = altoDeEscalera(cartas.map((c) => c.valor));
  if (alto > 0) {
    return puntuacion(CATEGORIAS.ESCALERA, [alto]);
  }
  // Trío.
  if (veces1 === 3) {
    return puntuacion(CATEGORIAS.TRIO, [valor1, ...kickers(cartas, [valor1], 2)]);
  }
  // Doble pareja.
  if (veces1 === 2 && veces2 === 2) {
    const [mayor, menor] = [valor1, valor2].sort((a, b) => b - a);
    return puntuacion(CATEGORIAS.DOBLE_PAREJA, [mayor, menor, ...kickers(cartas, [mayor, menor], 1)]);
  }
  // Pareja.
  if (veces1 === 2) {
    return puntuacion(CATEGORIAS.PAREJA, [valor1, ...kickers(cartas, [valor1], 3)]);
  }
  // Carta alta.
  return puntuacion(CATEGORIAS.CARTA_ALTA, kickers(cartas, [], 5));
}

function puntuacion(categoria, desempate) {
  return Object.freeze({
    categoria,
    nombre: NOMBRE_CATEGORIA[categoria],
    desempate: Object.freeze(desempate),
  });
}

// -1 si a<b, 1 si a>b, 0 si empatan exactos (mano dividida).
export function compararManos(a, b) {
  if (a.categoria !== b.categoria) {
    return a.categoria < b.categoria ? -1 : 1;
  }
  const n = Math.max(a.desempate.length, b.desempate.length);
  for (let i = 0; i < n; i += 1) {
    const va = a.desempate[i] ?? 0;
    const vb = b.desempate[i] ?? 0;
    if (va !== vb) {
      return va < vb ? -1 : 1;
    }
  }
  return 0;
}
