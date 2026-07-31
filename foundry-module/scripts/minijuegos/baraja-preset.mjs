// Traducción de nuestra baraja al vocabulario de cartas nativo de Foundry
// (`Cards` / `Card`), para que la mesa pueda usar la baraja de la nave en
// cualquier partida de cartas casera fuera del póker.
//
// Esto NO es el motor del póker: el póker sigue en `poker-motor.mjs`, con su
// barajado sembrado y su coordinador único (decisiones 2, 5 y 6 de
// `docs/MINIJUEGOS_FOUNDRY.md`). Aquí sólo se exporta el arte y la nomenclatura
// como formato de intercambio; nada de este fichero participa en una partida.
//
// El arte se sirve como ficheros `.svg` del propio módulo, no como `data:` URI
// incrustado: es la ruta soportada por Foundry, la caché del navegador la
// aprovecha y no engorda la base de datos del mundo con una carta por
// documento.

import { barajaOrdenada, interpretarCodigo } from "./naipes.mjs";
import { cartaSvg, dorsoSvg, etiquetaValor } from "./cartas-pixelart.mjs";

export const ID_MODULO = "espaciokoop-lagunak";
export const CLAVE_PRESET = "lagunakBaraja";
export const DIRECTORIO_CARTAS = `modules/${ID_MODULO}/data/cartas`;
export const NOMBRE_PRESET = "baraja-lagunak.json";
export const NOMBRE_DORSO = "dorso.svg";

// `Card.suit` es texto libre en Foundry. Usamos el símbolo del palo: se lee
// igual en cualquier idioma y no obliga a inventar claves de i18n por carta.
export const SIMBOLO_PALO = Object.freeze({ c: "♣", d: "♦", h: "♥", s: "♠" });

// Nombre visible de una carta: "A♠", "10♥". Neutro respecto al idioma, que es
// lo que toca en un JSON de baraja que Foundry carga tal cual (sólo la etiqueta
// del mazo pasa por i18n, vía `CONFIG.Cards.presets`).
export function nombreCarta(codigo) {
  const { valor, palo } = interpretarCodigo(codigo);
  return `${etiquetaValor(valor)}${SIMBOLO_PALO[palo]}`;
}

export function ficheroCarta(codigo) {
  return `${codigo}.svg`;
}

export function rutaCarta(codigo) {
  return `${DIRECTORIO_CARTAS}/${ficheroCarta(codigo)}`;
}

export function rutaDorso() {
  return `${DIRECTORIO_CARTAS}/${NOMBRE_DORSO}`;
}

// Una carta nuestra vertida al esquema de `Card` (`common/documents/card.mjs`):
// `faces[]` con la cara visible, `value` numérico y `suit` como símbolo.
export function cartaFoundry(carta) {
  const nombre = nombreCarta(carta.codigo);
  return {
    name: nombre,
    // `face: null` = boca abajo al crearse. Quien reparta decide cuándo se ve.
    face: null,
    suit: SIMBOLO_PALO[carta.palo],
    value: carta.valor,
    back: { img: rutaDorso() },
    faces: [{ name: nombre, img: rutaCarta(carta.codigo), text: "" }],
  };
}

// Documento `Cards` de tipo `deck` serializado, con la forma que Foundry espera
// en el JSON de un preset (`public/cards/poker-deck-dark.json`).
export function barajaFoundry() {
  return {
    name: "Baraja de la nave",
    type: "deck",
    description: "Baraja francesa de 52 cartas del módulo Espaciokoop Lagunak.",
    img: rutaDorso(),
    cards: barajaOrdenada().map(cartaFoundry),
  };
}

// Todos los ficheros que compone la baraja: el JSON del preset y un SVG por
// carta más el dorso. Es la única fuente de verdad del generador y de la prueba
// que vigila que lo publicado no se separe del arte.
export function ficherosBaraja() {
  const ficheros = new Map();
  ficheros.set(NOMBRE_PRESET, `${JSON.stringify(barajaFoundry(), null, 2)}\n`);
  ficheros.set(NOMBRE_DORSO, `${dorsoSvg()}\n`);
  for (const carta of barajaOrdenada()) {
    ficheros.set(ficheroCarta(carta.codigo), `${cartaSvg(carta.codigo)}\n`);
  }
  return ficheros;
}

// Entrada de `CONFIG.Cards.presets`. `label` es clave de i18n: la baraja se
// nombra en el idioma de cada cual sin duplicar el JSON.
export function entradaPreset() {
  return {
    type: "deck",
    label: "LAGUNAK.Minijuegos.Baraja.Nombre",
    src: `${DIRECTORIO_CARTAS}/${NOMBRE_PRESET}`,
  };
}

// Publica la baraja entre las de Foundry. Falla en silencio si la versión no
// tiene el registro de presets: es una comodidad, no un requisito del módulo.
export function registrarPreset(config = globalThis.CONFIG) {
  const presets = config?.Cards?.presets;
  if (!presets || typeof presets !== "object") return false;
  presets[CLAVE_PRESET] = entradaPreset();
  return true;
}
