// Fichas de la mesa de póker (#308), en el mismo arte de rejilla que la baraja:
// SVG generado en el cliente a partir del valor, sin assets binarios ni
// dependencias. Puro — ni Foundry, ni DOM, ni red.
//
// POR QUÉ EXISTEN, si el número ya está escrito al lado: porque un montón de
// fichas se lee de un vistazo y una cifra no. Quién va corto y quién manda la
// mesa es la información que más veces se mira durante una mano, y hasta ahora
// solo estaba en texto.
//
// ## Por qué la ficha tiene canto y no es un disco
//
// El primer corte dibujaba la ficha desde arriba, plana. Se reconocía, pero no
// era una mesa: sobre un tapete lo que se ve es el CANTO, y sobre todo lo que
// se ve es la ALTURA del montón — quién manda la mesa se sabe por lo alto que
// tiene el montón antes que por ningún número. Un disco plano no puede decir
// eso, por muchas fichas que se le pongan al lado.
//
// Así que la ficha se dibuja en perspectiva rebajada: elipse superior, pared
// visible debajo y las fichas apiladas de verdad, una encima de otra. El
// volumen es *rejilla*, no degradado: la cara y la pared son planos de color
// distintos —la pared es el mismo tono oscurecido— y no hay ni un gradiente,
// que es lo que separa este lenguaje del 3D del casco (#362).
//
// CRITERIO DE ACCESIBILIDAD: el valor de una ficha NO viaja en su color. Cada
// denominación lleva un número distinto de cuñas (2, 3, 4, 6, 8), que ahora se
// cuentan también en el canto —donde se ven aunque el montón tape las caras—, y
// el número exacto de fichas va escrito junto a cada montón. El color es un
// atajo para quien lo vea, nunca el único portador.
//
// Y la silueta —contorno de la cara, costados y borde de apoyo— va siempre en
// crema contra el fieltro (12:1): ver `SILUETA`.

import { FICHA, canales } from "../paleta.mjs";

// Lienzo lógico de UNA ficha. La proporción es la de un cilindro bajo mirado
// casi de canto: ancha y aplastada, no una moneda de frente.
export const ANCHO = 22;
const RX = 10; // semieje horizontal de la cara
const RY = 4; // semieje vertical: lo que aplasta la elipse es la perspectiva
// Canto visible por debajo de la cara. Es lo que asoma de cada ficha del montón
// y por eso NO puede ser menor que `PASO`: si lo fuese, entre ficha y ficha se
// vería el tapete y el montón se rompería en discos sueltos.
const PARED = 2;
// Apoyo: las dos filas que van UNA sola vez, debajo de la ficha de abajo del
// todo. No pertenecen a ninguna ficha —son el suelo del montón—, y por eso se
// dibujan aparte: metidas en el canto se repetirían en cada ficha y taparían
// justo las cuñas de la de abajo.
const APOYO = 2;
export const ALTO = 2 * RY + PARED + APOYO; // 12

const CX = ANCHO / 2;

// Cuánto asoma cada ficha de la de abajo. Es menos que la pared entera: las
// fichas de un montón se tapan entre sí, y ese solape es justo lo que hace que
// un montón parezca un montón y no una escalera.
const PASO = 2;

// Tope de fichas dibujadas en un montón. Por encima, el montón deja de crecer y
// manda la cifra: cien fichas apiladas serían una columna de dos metros y
// además ilegible. No es una mentira mientras la cuenta esté escrita al lado, y
// por eso `pilaSvg` no se usa nunca sin ella.
export const MAXIMO_APILADO = 5;

/**
 * Denominaciones, de mayor a menor. El orden es el del reparto codicioso y por
 * eso se declara una sola vez: `pilaDeFichas` recorre esta lista tal cual.
 *
 * `cunas` no es decoración: es la forma que distingue una denominación de otra
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
 * Devuelve como mucho una entrada por denominación —cinco— y nunca doscientas
 * fichas de 1 sueltas: cada montón se dibuja apilado hasta `MAXIMO_APILADO` con
 * su cuenta al lado. Un montón por valor es lo que se ve en una mesa, y además
 * acota lo que la ventana tiene que pintar sin que el modelo tenga que mentir
 * sobre el total.
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

// ---- Volumen ---------------------------------------------------------------

// Un plano más oscuro del MISMO color, no un color nuevo: el canto de una ficha
// roja es rojo en sombra. Se calcula y no se declara para que la paleta siga
// teniendo cinco tonos y no diez, y para que la guardia de #351 siga valiendo.
function plano(color, factor) {
  const rgb = canales(color);
  if (!rgb) return color;
  const byte = (c) => Math.round(Math.min(1, Math.max(0, c * factor)) * 255);
  return `#${rgb.map((c) => byte(c).toString(16).padStart(2, "0")).join("")}`;
}

const SOMBRA_PARED = 0.62; // canto en sombra
const SOMBRA_BASE = 0.4; // apoyo: la sombra que asienta el montón en el tapete

// Franja exterior de la silueta, en cara y en canto. Va SIEMPRE en crema.
//
// El tapete es verde oscuro, así que oscurecer la ficha no la despega: la pared
// en sombra se queda en 1,2:1 contra el fieltro y el rojo de la de 5 en 1,84
// incluso a plena luz. Quien porta la silueta es el crema (12:1), y por eso el
// contorno no es decoración ni se puede pintar del color del valor: sin él, el
// borde de abajo del montón desaparece justo donde se apoya.
const SILUETA = 0.88;

// ¿Cae este ángulo dentro de una cuña? Las cuñas se reparten por igual
// alrededor de la ficha, así que contarlas es contar interrupciones del anillo.
//
// La cuña va CENTRADA en su sector y con un ancho acotado, no proporcional al
// hueco entre cuñas. Con el ancho proporcional, la ficha de dos cuñas se comía
// media cara y dejaba de parecer una ficha: lo que hay que contar son marcas,
// y una marca tiene su tamaño lo tenga al lado o no.
// Y el reparto arranca en el FRENTE de la ficha, no en un punto cualquiera: así
// hay siempre una cuña centrada abajo y el dibujo sale simétrico también con un
// número impar de cuñas. Con la de tres, que es la única impar, se nota.
function enCuna(angulo, cunas) {
  const paso = (2 * Math.PI) / cunas;
  const desdeFrente = angulo - Math.PI / 2;
  const dentro = ((desdeFrente % paso) + paso) % paso;
  const ancho = Math.min(paso * 0.45, 0.5);
  return Math.min(dentro, paso - dentro) < ancho / 2;
}

// Cara superior: contorno crema, anillo de color con sus cuñas, campo crema y
// punto central. `cy` es el centro de la elipse de ESTA ficha dentro del montón.
function cara(rects, cy, color, cunas) {
  for (let y = Math.floor(cy - RY); y <= Math.ceil(cy + RY); y += 1) {
    for (let x = 0; x < ANCHO; x += 1) {
      const dx = (x + 0.5 - CX) / RX;
      const dy = (y + 0.5 - cy) / RY;
      const t = Math.hypot(dx, dy);
      if (t > 1) continue;
      let tono;
      if (t > SILUETA) tono = FICHA.canto; // contorno: lo que la despega del fieltro
      else if (t > 0.6) tono = enCuna(Math.atan2(dy, dx), cunas) ? FICHA.canto : color;
      else if (t <= 0.32) tono = color; // ojo central: la ficha no es un plato
      else tono = FICHA.canto;
      rects.push({ x, y, color: tono });
    }
  }
}

// Recorre el borde inferior de la elipse de una ficha: para cada columna, la
// fila donde la cara termina y empieza el canto.
function bordeInferior(cy, visita) {
  for (let x = 0; x < ANCHO; x += 1) {
    const dx = (x + 0.5 - CX) / RX;
    if (Math.abs(dx) >= 1) continue;
    visita(x, Math.floor(cy + RY * Math.sqrt(1 - dx * dx)), dx);
  }
}

// Canto: la franja que asoma por debajo de la cara. Las cuñas siguen ahí, y son
// las que se ven cuando el montón tapa las caras de abajo — por eso el canto
// lleva pared y cuñas y nada más: cualquier otra cosa metida aquí sería lo
// único que se viese de las fichas de abajo.
function canto(rects, cy, color, cunas) {
  const pared = plano(color, SOMBRA_PARED);
  bordeInferior(cy, (x, borde, dx) => {
    // Ángulo del frente de la ficha, para que la cuña del canto caiga en la
    // misma vertical que la de la cara.
    const esCuna = enCuna(Math.acos(dx), cunas);
    const flanco = Math.abs(dx) > SILUETA; // los costados también son silueta
    for (let paso = 0; paso < PARED; paso += 1) {
      rects.push({ x, y: borde + paso, color: flanco || esCuna ? FICHA.canto : pared });
    }
  });
}

// Suelo del montón, bajo la ficha de más abajo: una fila en sombra profunda
// —lo que asienta el montón en el tapete en vez de dejarlo flotando— y debajo
// el contorno crema, que es el que garantiza que ese borde se vea contra el
// fieltro. En ese orden: la sombra por dentro, la silueta por fuera.
function apoyo(rects, cy, color) {
  const base = plano(color, SOMBRA_BASE);
  bordeInferior(cy, (x, borde) => {
    rects.push({ x, y: borde + PARED, color: base });
    rects.push({ x, y: borde + PARED + 1, color: FICHA.canto });
  });
}

function altoDeMonton(fichas) {
  return ALTO + (fichas - 1) * PASO;
}

function rectsDeMonton(valor, fichas) {
  const denominacion = POR_VALOR.get(valor);
  if (!denominacion) {
    throw new RangeError(
      `fichaSvg: denominación desconocida (${valor}); se esperaba una de ` +
        `${DENOMINACIONES.map((d) => d.valor).join(", ")}`,
    );
  }
  const color = FICHA.valores[valor];
  const { cunas } = denominacion;
  const rects = [];
  // De la de abajo a la de arriba, y en ese orden a propósito: cada ficha se
  // pinta encima de la anterior y le tapa la cara. Ese solape es lo que hace
  // que un montón se lea como un montón y no como una escalera de discos.
  apoyo(rects, RY + (fichas - 1) * PASO, color);
  for (let i = fichas - 1; i >= 0; i -= 1) {
    const cy = RY + i * PASO;
    canto(rects, cy, color, cunas);
    cara(rects, cy, color, cunas);
  }
  return rects;
}

// ---- SVG ------------------------------------------------------------------

function svg(rects, alto) {
  // Las fichas de arriba tapan a las de abajo, así que la misma celda se pinta
  // varias veces y gana la última. Se resuelve aquí, antes de escribir: un
  // montón lleva cinco capas y el `data:` URI viaja entero en el HTML.
  const celdas = new Map();
  for (const r of rects) celdas.set(`${r.x},${r.y}`, r);
  const cuerpo = [...celdas.values()]
    .map((r) => `<rect x="${r.x}" y="${r.y}" width="1" height="1" fill="${r.color}"/>`)
    .join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ANCHO} ${alto}" ` +
    `shape-rendering="crispEdges">${cuerpo}</svg>`
  );
}

/**
 * SVG de un montón de `fichas` fichas de una denominación, apiladas.
 *
 * Se recorta a `MAXIMO_APILADO`: por encima manda la cifra escrita al lado, y
 * por eso este dibujo no se usa nunca sin ella.
 *
 * Sin `role="img"` ni título: el montón es decorativo y el valor va en el texto
 * de al lado, así que se marca `aria-hidden` allá donde se inserta en vez de
 * duplicar la cifra para quien escucha.
 */
export function pilaSvg(valor, fichas = 1) {
  const cuantas = Math.min(MAXIMO_APILADO, Math.max(1, Math.trunc(fichas) || 1));
  return svg(rectsDeMonton(valor, cuantas), altoDeMonton(cuantas));
}

/** Una ficha suelta: el montón de altura uno. */
export function fichaSvg(valor) {
  return pilaSvg(valor, 1);
}

/** data: URI listo para un `<img>` de Foundry sin tocar disco. */
export function pilaDataUri(valor, fichas = 1) {
  return `data:image/svg+xml,${encodeURIComponent(pilaSvg(valor, fichas))}`;
}

export function fichaDataUri(valor) {
  return pilaDataUri(valor, 1);
}

/** Alto del lienzo de un montón, para que quien lo coloque reserve el hueco. */
export function altoDePila(fichas = 1) {
  return altoDeMonton(Math.min(MAXIMO_APILADO, Math.max(1, Math.trunc(fichas) || 1)));
}
