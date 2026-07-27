// Baraja francesa de 52 cartas: primitiva reutilizable para cualquier minijuego
// de cartas (póker, blackjack…). Independiente de Foundry y del póker concreto.
//
// Una carta es un objeto congelado `{ valor, palo, codigo }`:
//   - `valor`: 2..14 (11=J, 12=Q, 13=K, 14=A). Numérico para comparar sin tablas.
//   - `palo`: "c" tréboles, "d" diamantes, "h" corazones, "s" picas.
//   - `codigo`: etiqueta estable "As", "Kh", "Td"… útil para vistas y vectores
//     de prueba deterministas. No es texto visible al usuario (eso es i18n/arte).

import { crearAleatorio, mezclar } from "./aleatorio.mjs";

export const PALOS = Object.freeze(["c", "d", "h", "s"]);
export const VALOR_MINIMO = 2;
export const VALOR_MAXIMO = 14; // As alto

// Etiqueta de rango por valor para construir el código estable de la carta.
const ETIQUETA_RANGO = Object.freeze({
  2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9",
  10: "T", 11: "J", 12: "Q", 13: "K", 14: "A",
});

export function codigoCarta(valor, palo) {
  return `${ETIQUETA_RANGO[valor]}${palo}`;
}

function crearCarta(valor, palo) {
  return Object.freeze({ valor, palo, codigo: codigoCarta(valor, palo) });
}

// Baraja ordenada canónica de 52 cartas. Orden fijo → punto de partida
// determinista antes de mezclar con una semilla.
export function barajaOrdenada() {
  const cartas = [];
  for (const palo of PALOS) {
    for (let valor = VALOR_MINIMO; valor <= VALOR_MAXIMO; valor += 1) {
      cartas.push(crearCarta(valor, palo));
    }
  }
  return cartas;
}

// Baraja mezclada de forma determinista a partir de una semilla o un generador
// ya existente. Con la misma semilla siempre sale el mismo orden.
export function barajaMezclada(semillaOAleatorio) {
  const aleatorio =
    semillaOAleatorio && typeof semillaOAleatorio.siguiente === "function"
      ? semillaOAleatorio
      : crearAleatorio(semillaOAleatorio);
  return mezclar(barajaOrdenada(), aleatorio);
}

// Reparte `cantidad` cartas del tope de un mazo. Devuelve `{ repartidas, resto }`
// sin mutar el mazo de entrada (pureza): el llamador sustituye su mazo por
// `resto`. Falla si no hay cartas suficientes.
export function repartir(mazo, cantidad) {
  if (!Number.isInteger(cantidad) || cantidad < 0) {
    throw new RangeError("repartir: cantidad inválida");
  }
  if (cantidad > mazo.length) {
    throw new RangeError("repartir: no hay cartas suficientes");
  }
  return {
    repartidas: mazo.slice(0, cantidad),
    resto: mazo.slice(cantidad),
  };
}
