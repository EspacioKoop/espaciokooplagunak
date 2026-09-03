// Retrato pixel de tripulante (#352): semilla → SVG en rejilla, generado en el
// cliente. Cero bytes en el repositorio, cero tráfico por el puente — el dato
// de entrada (`user.id`) ya lo tiene cada cliente.
//
// QUÉ CODIFICA, Y QUÉ NO. El retrato dice **presencia** (color o gris) y sirve
// de ancla visual para reconocer a alguien de un vistazo. NO dice identidad, ni
// autoridad, ni permiso: el flag `station` es autoasignable y mutable
// —`docs/FOUNDRY.md` lo llama «contexto operativo mutable, no identidad ni
// credencial» (#237)—, así que un retrato que se leyera como galón invitaría a
// confundirlo con una credencial. Por eso el marco de puesto y el tinte de
// alerta se aplican por CSS sobre el contenedor, fuera de esta imagen, y el
// texto de la fila sigue siendo la verdad para todo el mundo.
//
// Semilla: `user.id` y no el nombre, para que el retrato sobreviva a un
// renombrado. La consecuencia se acepta y se documenta: reinvitar a alguien le
// cambia la cara, porque Foundry le da un id nuevo.
//
// Puro: ni Foundry, ni DOM, ni red. Se prueba desde Node.

import { crearAleatorio } from "../minijuegos/aleatorio.mjs";
import { PIXEL, RETRATO, luminancia } from "../paleta.mjs";

// Rejilla lógica. 12x12 es el mínimo donde un casco con visor se lee a 32 px
// de alto, que es el tamaño al que se muestra en la fila de tripulación.
export const LADO = 12;

// Siluetas de casco. '.' = vacío, '#' = casco, '=' = casco en sombra,
// 'o' = visor, '+' = acento. Nose-up como el sprite de nave: la lectura de
// arriba abajo es cabeza → hombros.
const CASCOS = Object.freeze([
  // Casco redondo, cuello corto: el perfil clásico de escafandra.
  Object.freeze([
    "....####....",
    "..########..",
    ".##########.",
    "#####++#####",
    "#oooooooooo#",
    "#oooooooooo#",
    "#==========#",
    ".##########.",
    "..########..",
    "...=####=...",
    "..##====##..",
    ".###====###.",
  ]),
  // Casco angular con cresta: silueta de trabajo pesado.
  Object.freeze([
    "...######...",
    "..########..",
    ".####++####.",
    "############",
    "#.oooooooo.#",
    "#.oooooooo.#",
    "#.========.#",
    ".##########.",
    "..##====##..",
    "..#======#..",
    ".##========.",
    "###========#",
  ]),
  // Capucha alta y estrecha: perfil de piloto.
  Object.freeze([
    ".....##.....",
    "....####....",
    "...######...",
    "..###++###..",
    ".##oooooo##.",
    ".##oooooo##.",
    ".##======##.",
    "..########..",
    "...======...",
    "..########..",
    ".####==####.",
    "###########.",
  ]),
]);

// Formas de visor, superpuestas sobre las celdas 'o'. Cada una es un predicado
// sobre la columna dentro de la banda del visor: lo que devuelve `false` se
// apaga y deja ver el casco, que es lo que da variedad sin más siluetas.
const VISORES = Object.freeze([
  { nombre: "corrido", encendido: () => true },
  { nombre: "partido", encendido: (x) => x !== Math.floor(LADO / 2) },
  { nombre: "estrecho", encendido: (x) => x > 1 && x < LADO - 2 },
]);

/** Convierte un color a su gris de luminancia equivalente. */
function aGris(color) {
  const l = luminancia(color);
  if (l === null) return color;
  // La luminancia de WCAG es lineal; se vuelve a sRGB para que el gris se vea
  // tan claro como se veía el color, en vez de apagarse de más.
  const canal = l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055;
  const v = Math.max(0, Math.min(255, Math.round(canal * 255)));
  const hex = v.toString(16).padStart(2, "0");
  return `#${hex}${hex}${hex}`;
}

/**
 * Modelo del retrato: qué casco, qué visor y qué colores. Separado del SVG para
 * poder probar la elección sin analizar cadenas.
 *
 * @param {string} semilla identificador estable del tripulante (`user.id`).
 * @param {{activo?: boolean}} opciones `activo: false` lo devuelve en gris.
 */
export function retratoTripulante(semilla, { activo = true } = {}) {
  const { siguiente } = crearAleatorio(semilla);
  const casco = CASCOS[Math.floor(siguiente() * CASCOS.length) % CASCOS.length];
  const visor = VISORES[Math.floor(siguiente() * VISORES.length) % VISORES.length];
  const tono = RETRATO.cascos[Math.floor(siguiente() * RETRATO.cascos.length) % RETRATO.cascos.length];
  const cristal = RETRATO.visores[Math.floor(siguiente() * RETRATO.visores.length) % RETRATO.visores.length];
  const acento = RETRATO.acentos[Math.floor(siguiente() * RETRATO.acentos.length) % RETRATO.acentos.length];

  const enLinea = Boolean(activo);
  const pintar = (color) => (enLinea ? color : aGris(color));

  return {
    filas: casco,
    visor: visor.nombre,
    activo: enLinea,
    colores: {
      casco: pintar(tono),
      // La sombra del casco es el mismo tono a media luz: una capa más sin un
      // color más que mantener en la paleta.
      sombra: pintar(mezclar(tono, PIXEL.borde, 0.45)),
      visor: pintar(cristal),
      acento: pintar(acento),
    },
  };
}

/** Mezcla lineal de dos colores hexadecimales, `t` de 0 (a) a 1 (b). */
function mezclar(a, b, t) {
  const ca = hexACanales(a);
  const cb = hexACanales(b);
  if (!ca || !cb) return a;
  const f = Math.max(0, Math.min(1, t));
  const mezcla = ca.map((v, i) => Math.round(v + (cb[i] - v) * f));
  return `#${mezcla.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function hexACanales(color) {
  const crudo = String(color ?? "").trim().replace(/^#/, "");
  const hex = crudo.length === 3 ? [...crudo].map((c) => c + c).join("") : crudo;
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

const CODIGO_A_CAPA = Object.freeze({
  "#": "casco",
  "=": "sombra",
  o: "visor",
  "+": "acento",
});

/**
 * SVG autosuficiente del retrato: sin URLs, sin `<image>`, sin fuentes. Se
 * agrupan los píxeles por capa en un solo `<path>` cada una, de modo que el
 * documento tiene cuatro nodos de dibujo y no ciento cuarenta.
 */
export function retratoTripulanteSvg(semilla, opciones = {}) {
  const { filas, colores, activo, visor } = retratoTripulante(semilla, opciones);
  const forma = VISORES.find((v) => v.nombre === visor) ?? VISORES[0];

  const trazos = { casco: [], sombra: [], visor: [], acento: [] };
  filas.forEach((fila, y) => {
    [...fila].forEach((codigo, x) => {
      let capa = CODIGO_A_CAPA[codigo];
      if (!capa) return;
      // El visor apagado por la forma no desaparece: se rellena como casco, que
      // es justo lo que hay debajo del cristal.
      if (capa === "visor" && !forma.encendido(x)) capa = "casco";
      trazos[capa].push(`M${x} ${y}h1v1h-1z`);
    });
  });

  const capas = Object.entries(trazos)
    .filter(([, d]) => d.length > 0)
    .map(([capa, d]) => `<path fill="${colores[capa]}" d="${d.join("")}"/>`)
    .join("");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LADO} ${LADO}" ` +
    `shape-rendering="crispEdges" role="img" aria-hidden="true" ` +
    `data-activo="${activo}">${capas}</svg>`
  );
}

/** El mismo retrato como `data:` URI, listo para el `src` de un `<img>`. */
export function retratoTripulanteDataUri(semilla, opciones = {}) {
  return `data:image/svg+xml,${encodeURIComponent(retratoTripulanteSvg(semilla, opciones))}`;
}
