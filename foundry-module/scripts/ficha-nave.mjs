/**
 * Arte de ficha para naves NARRATIVAS que el GM coloca a mano (#354).
 *
 * QUÉ NO ES. No es un token de contacto vivo. Nada aquí sondea, nada se
 * suscribe a un hook y nada se entera de que existe `/v1/contacts`: el issue
 * descartó explícitamente volcar los contactos del sondeo al lienzo, porque un
 * documento persistente de Foundry que espeje la simulación se queda mintiendo
 * con la última posición cuando el puente cae, y porque trasladaría «qué sabe
 * la tripulación» de una decisión del GM a la visión de tokens de Foundry.
 *
 * Este módulo produce UNA imagen a partir de UNA descripción declarativa de la
 * nave, cuando alguien la pide. Es una decisión editorial del GM congelada en
 * un PNG, no una instantánea de telemetría — y por eso el mundo guardado sigue
 * teniendo sentido si se reabre semanas después, sin necesidad de recordar cómo
 * estaba la simulación al cerrar.
 *
 * DE DÓNDE SALE EL DIBUJO. De `construirSpriteNave()`, el mismo generador que
 * pinta el mapa vivo, para que el lenguaje visual del mapa llegue al tablero
 * sin duplicar siluetas ni estilos. La entrada es solo la descripción de la
 * nave (`{tipo, clase, subclase}` o una clave de silueta) y su color: no se le
 * pasa el contexto donde va a usarse, así que el mismo arte vale para el editor
 * de contenido (#54), para una hoja o para lo que venga.
 *
 * Puro: ni Foundry, ni DOM, ni red. Se prueba desde Node.
 */

import { PIXEL } from "./paleta.mjs";
import { clasificarNave, construirSpriteNave } from "./nave-sprite.mjs";
import { codificarPngIndexado, pngADataUri, MAX_PALETA } from "./png-indexado.mjs";

/**
 * Lado objetivo de la imagen, en píxeles. La escala se DERIVA de aquí en vez
 * de fijarse por celda: con una escala fija, una silueta grande da una imagen
 * grande, y como el peso crece con el área, la ficha de la nave propia (9
 * celdas de ancho) llegaba a rozar el tope mientras la del caza sobraba. Con
 * un lado objetivo, todas las fichas pesan más o menos lo mismo y el tope deja
 * de depender de qué silueta toque.
 *
 * 128 px es de sobra para un token: el tablero lo escala a su rejilla, y el
 * pixel-art se amplía por bloques sin perder nada.
 */
export const LADO_OBJETIVO = 128;

/** Celdas de hueco alrededor de la silueta, para que no toque el borde. */
export const MARGEN_POR_DEFECTO = 1;

/**
 * Tope del data-URI, en caracteres. La imagen se guarda en la base del mundo y
 * se replica a cada cliente que vea el token, así que el tamaño es un requisito
 * y no un detalle: pasarse es un error, no un aviso. 32 KiB deja holgura de
 * sobra para las siluetas actuales a la escala por defecto.
 */
export const MAX_DATA_URI = 32 * 1024;

/**
 * Construye la rejilla de índices de paleta de la ficha.
 *
 * Trabaja con índices y no con colores porque es lo que come el PNG indexado:
 * el índice 0 queda reservado al hueco transparente y cada color distinto del
 * sprite entra una sola vez en la paleta.
 *
 * @returns {{ancho:number, alto:number, indices:Uint8Array, paleta:string[]}}
 */
export function construirRejillaFicha({
  clave,
  nave,
  color = PIXEL.neutro,
  escala,
  margen = MARGEN_POR_DEFECTO,
} = {}) {
  if (escala !== undefined && (!Number.isInteger(escala) || escala <= 0)) {
    throw new Error(`Escala no válida: ${escala}`);
  }
  if (!Number.isInteger(margen) || margen < 0) throw new Error(`Margen no válido: ${margen}`);

  // `clave` gana si se da explícitamente; si no, se clasifica la descripción.
  // Sin ninguna de las dos, `clasificarNave` ya devuelve "desconocido", que es
  // la silueta de serie — la misma regla que las láminas de #374.
  const siluetaClave = clave ?? clasificarNave(nave ?? null, false);
  const celdas = construirSpriteNave({ clave: siluetaClave, color });

  // El sprite viene centrado en (0,0) con celdas a media unidad: se lleva a
  // coordenadas enteras desde la esquina superior izquierda.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const celda of celdas) {
    minX = Math.min(minX, celda.dx);
    minY = Math.min(minY, celda.dy);
    maxX = Math.max(maxX, celda.dx);
    maxY = Math.max(maxY, celda.dy);
  }
  const anchoCeldas = maxX - minX + 1 + margen * 2;
  const altoCeldas = maxY - minY + 1 + margen * 2;
  // Escala entera y nunca menor que 1: ampliar por bloques exige un número
  // entero de píxeles por celda, y redondear hacia abajo solo puede dejar la
  // imagen algo por debajo del lado objetivo, jamás por encima del tope.
  const escalaFinal = escala ?? Math.max(1, Math.floor(LADO_OBJETIVO / Math.max(anchoCeldas, altoCeldas)));
  const ancho = anchoCeldas * escalaFinal;
  const alto = altoCeldas * escalaFinal;

  // Solo colores VISIBLES: el hueco transparente es el índice 0 y lo añade el
  // codificador, así que este módulo no declara ni un color propio y puede
  // entrar en la guardia de paleta de #351.
  const paleta = [];
  const indicePorColor = new Map();
  const indices = new Uint8Array(ancho * alto);

  for (const celda of celdas) {
    let indice = indicePorColor.get(celda.color);
    if (indice === undefined) {
      if (paleta.length >= MAX_PALETA - 1) {
        throw new Error(`La silueta usa más de ${MAX_PALETA - 1} colores`);
      }
      // +1 porque el índice 0 está reservado al hueco transparente.
      indice = paleta.length + 1;
      paleta.push(celda.color);
      indicePorColor.set(celda.color, indice);
    }
    // Cada celda de silueta se expande a un cuadrado macizo: el pixel-art se
    // amplía por bloques, nunca interpolado.
    const x0 = (celda.dx - minX + margen) * escalaFinal;
    const y0 = (celda.dy - minY + margen) * escalaFinal;
    for (let y = 0; y < escalaFinal; y += 1) {
      indices.fill(indice, (y0 + y) * ancho + x0, (y0 + y) * ancho + x0 + escalaFinal);
    }
  }

  return { ancho, alto, indices, paleta };
}

/**
 * Genera la ficha completa como data-URI PNG, a petición y de una sola vez.
 *
 * @param {{clave?:string, nave?:object, color?:string, escala?:number,
 *          margen?:number, maxBytes?:number}} opciones
 * @returns {string} `data:image/png;base64,...`, autosuficiente: sin una sola
 *   referencia a red, que es lo que exige la CSP de Foundry y lo que hace que
 *   el token siga viéndose en un mundo archivado.
 */
export function generarFichaNave({ maxBytes = MAX_DATA_URI, ...opciones } = {}) {
  const dataUri = pngADataUri(codificarPngIndexado(construirRejillaFicha(opciones)));
  if (dataUri.length > maxBytes) {
    throw new Error(
      `La ficha ocupa ${dataUri.length} caracteres y el tope es ${maxBytes}: baja la escala`,
    );
  }
  return dataUri;
}
