// Fichas de la mesa de póker (#308), en el mismo arte de rejilla que la baraja:
// SVG generado en el cliente a partir del valor, sin assets binarios ni
// dependencias. Puro — ni Foundry, ni DOM, ni red.
//
// POR QUÉ EXISTEN, si el número ya está escrito al lado: porque un montón de
// fichas se lee de un vistazo y una cifra no. Quién va corto y quién manda la
// mesa es la información que más veces se mira durante una mano, y hasta ahora
// solo estaba en texto.
//
// CRITERIO DE ACCESIBILIDAD: el valor de una ficha NO viaja en su color. Cada
// denominación lleva un número distinto de cuñas en el canto (2, 3, 4, 6, 8),
// que se cuenta sin distinguir tonos, y el número exacto de fichas va escrito
// junto a cada montón. El color es un atajo para quien lo vea, nunca el único
// portador.
//
// La ficha lleva siempre un borde crema contra el fieltro: es lo que la despega
// del tapete (12:1), porque los tonos de denominación por sí solos no llegan.

import { FICHA } from "../paleta.mjs";

// Lienzo lógico. Cuadrado y pequeño a propósito: la ficha acompaña a una cifra,
// no compite con las cartas.
export const LADO = 16;

const CENTRO = LADO / 2;
const RADIO_FICHA = 7.5; // silueta
const RADIO_BORDE = 6.3; // por fuera de esto, canto crema
const RADIO_CARA = 4.2; // por dentro, cara crema
const RADIO_PIP = 1.6; // punto central del color de la denominación

/**
 * Denominaciones, de mayor a menor. El orden es el del reparto codicioso y por
 * eso se declara una sola vez: `pilaDeFichas` recorre esta lista tal cual.
 *
 * `cuñas` no es decoración: es la forma que distingue una denominación de otra
 * cuando el color no se percibe.
 */
export const DENOMINACIONES = Object.freeze([
  Object.freeze({ valor: 500, cunas: 8 }),
  Object.freeze({ valor: 100, cunas: 6 }),
  Object.freeze({ valor: 25, cunas: 4 }),
  Object.freeze({ valor: 5, cunas: 3 }),
  Object.freeze({ valor: 1, cunas: 2 }),
]);

const POR_VALOR = new Map(DENOMINACIONES.map((d) => [d.valor, d]));

/**
 * Reparte una cantidad en montones por denominación, de mayor a menor.
 *
 * Devuelve como mucho una entrada por denominación —cinco— y nunca una pila de
 * doscientas fichas de 1: cada montón se dibuja con UNA ficha y su cuenta al
 * lado. Un montón por valor es lo que se ve en una mesa, y además acota lo que
 * la ventana tiene que pintar sin que el modelo tenga que mentir sobre el total.
 *
 * Cantidades no enteras, negativas o cero no producen fichas: no hay ficha de
 * media, y una mesa que dibuja fichas donde no las hay es peor que una que no
 * dibuja ninguna.
 *
 * @param {number} cantidad fichas totales
 * @returns {{valor: number, cuenta: number}[]}
 */
export function pilaDeFichas(cantidad) {
  if (!Number.isInteger(cantidad) || cantidad <= 0) return [];
  let resto = cantidad;
  const pila = [];
  for (const { valor } of DENOMINACIONES) {
    const cuenta = Math.floor(resto / valor);
    if (cuenta > 0) {
      pila.push({ valor, cuenta });
      resto -= cuenta * valor;
    }
  }
  return pila;
}

// ---- Dibujo ---------------------------------------------------------------

function distancia(x, y) {
  const dx = x + 0.5 - CENTRO;
  const dy = y + 0.5 - CENTRO;
  return Math.sqrt(dx * dx + dy * dy);
}

// ¿Cae esta celda dentro de una de las cuñas del canto? Las cuñas se reparten
// por igual alrededor de la ficha, así que basta con mirar el ángulo módulo el
// paso: contarlas es contar interrupciones del anillo de color.
function enCuna(x, y, cunas) {
  const angulo = Math.atan2(y + 0.5 - CENTRO, x + 0.5 - CENTRO);
  const paso = (2 * Math.PI) / cunas;
  const desde = ((angulo % paso) + paso) % paso;
  return desde < paso * 0.34;
}

function rectsDeFicha(valor) {
  const denominacion = POR_VALOR.get(valor);
  if (!denominacion) {
    throw new RangeError(
      `fichaSvg: denominación desconocida (${valor}); se esperaba una de ` +
        `${DENOMINACIONES.map((d) => d.valor).join(", ")}`,
    );
  }
  const color = FICHA.valores[valor];
  const rects = [];
  for (let y = 0; y < LADO; y += 1) {
    for (let x = 0; x < LADO; x += 1) {
      const r = distancia(x, y);
      if (r > RADIO_FICHA) continue; // fuera de la ficha: se ve el tapete
      if (r > RADIO_BORDE) rects.push({ x, y, color: FICHA.canto });
      else if (r > RADIO_CARA) {
        rects.push({ x, y, color: enCuna(x, y, denominacion.cunas) ? FICHA.canto : color });
      } else if (r <= RADIO_PIP) rects.push({ x, y, color });
      else rects.push({ x, y, color: FICHA.canto });
    }
  }
  return rects;
}

/**
 * SVG de una ficha. Sin `role="img"` ni título: la ficha es decorativa y el
 * valor va en el texto de al lado, así que se marca `aria-hidden` allá donde se
 * inserta en vez de duplicar la cifra para quien escucha.
 */
export function fichaSvg(valor) {
  const cuerpo = rectsDeFicha(valor)
    .map((r) => `<rect x="${r.x}" y="${r.y}" width="1" height="1" fill="${r.color}"/>`)
    .join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LADO} ${LADO}" ` +
    `shape-rendering="crispEdges">${cuerpo}</svg>`
  );
}

/** data: URI listo para un `<img>` de Foundry sin tocar disco. */
export function fichaDataUri(valor) {
  return `data:image/svg+xml,${encodeURIComponent(fichaSvg(valor))}`;
}
