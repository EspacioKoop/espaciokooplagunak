/**
 * Codificador PNG de color indexado, en JavaScript puro (#354).
 *
 * POR QUÉ EXISTE, HABIENDO CANVAS. El arte del módulo se genera en el cliente y
 * hasta ahora salía como SVG (`retrato-tripulante.mjs`) o pintado a mano sobre
 * `<canvas>` (`mapa-render.mjs`). Ninguna de las dos sirve aquí: lo que se
 * escribe en `prototypeToken.texture.src` lo carga PIXI como textura, y un PNG
 * es el único formato que se comporta igual en todos los clientes sin depender
 * de cómo el navegador rasterice un SVG embebido. `canvas.toDataURL()` daría un
 * PNG, pero ataría la generación al DOM y con ella la prueba: el issue pide
 * «lógica de imagen pura y probada desde Node», y esto se prueba sin navegador.
 *
 * DEFLATE SIN COMPRIMIR, A PROPÓSITO. El flujo zlib se emite con bloques
 * «stored» (BTYPE=00), que es DEFLATE válido y no necesita ni `zlib` de Node ni
 * `CompressionStream` del navegador —una dependencia de plataforma en un módulo
 * que debe correr en los dos—. El coste es tamaño, y por eso el color indexado:
 * un byte por píxel en vez de cuatro. Para las siluetas de `nave-sprite.mjs`, a
 * la escala a la que se usan, el resultado cabe de sobra en el tope que impone
 * `ficha-nave.mjs`.
 *
 * Puro: ni Foundry, ni DOM, ni red. Se prueba desde Node.
 */

const FIRMA = Object.freeze([137, 80, 78, 71, 13, 10, 26, 10]);

/** Máximo de entradas de una paleta PNG de 8 bits por píxel. */
export const MAX_PALETA = 256;

// Tabla CRC-32 (polinomio 0xEDB88320), calculada una vez al cargar el módulo.
const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c >>> 0;
  }
  return tabla;
})();

/** CRC-32 de PNG sobre un tramo de bytes. */
export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = TABLA_CRC[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Adler-32, la suma de control que zlib pone al final del flujo. */
export function adler32(bytes) {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i += 1) {
    a = (a + bytes[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

/** Escribe un entero de 32 bits en big-endian, que es el orden de PNG. */
function u32(valor) {
  return [(valor >>> 24) & 255, (valor >>> 16) & 255, (valor >>> 8) & 255, valor & 255];
}

/** Arma un chunk PNG completo: longitud, tipo, datos y CRC del tipo+datos. */
function chunk(tipo, datos) {
  const nombre = [...tipo].map((ch) => ch.charCodeAt(0));
  const cuerpo = Uint8Array.from([...nombre, ...datos]);
  return [...u32(datos.length), ...cuerpo, ...u32(crc32(cuerpo))];
}

/**
 * Envuelve los bytes crudos en un flujo zlib de bloques «stored».
 * Cada bloque lleva como mucho 65535 bytes, que es lo que cabe en su campo LEN.
 */
export function zlibSinComprimir(crudo) {
  // Cabecera zlib: CM=8/CINFO=7 y FLEVEL=0, con FCHECK ajustado para que
  // 0x78 0x01 sea múltiplo de 31, como exige el formato.
  const salida = [0x78, 0x01];
  const MAX = 65535;
  if (crudo.length === 0) salida.push(1, 0, 0, 255, 255);
  for (let inicio = 0; inicio < crudo.length; inicio += MAX) {
    const trozo = crudo.subarray(inicio, Math.min(inicio + MAX, crudo.length));
    const ultimo = inicio + MAX >= crudo.length ? 1 : 0;
    const len = trozo.length;
    // Bloque stored: cabecera de un byte, LEN y su complemento, ambos en
    // little-endian (DEFLATE, al revés que PNG), y los datos tal cual.
    salida.push(ultimo, len & 255, (len >>> 8) & 255, ~len & 255, (~len >>> 8) & 255);
    for (let i = 0; i < len; i += 1) salida.push(trozo[i]);
  }
  salida.push(...u32(adler32(crudo)));
  return salida;
}

const ALFABETO_B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * Base64 propio sobre bytes. No se usa `btoa` ni `Buffer` porque cada uno
 * existe solo en una de las dos plataformas donde corre este módulo, y la
 * prueba debe validar exactamente la cadena que verá el navegador.
 */
export function base64(bytes) {
  let salida = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    salida += ALFABETO_B64[b0 >>> 2];
    salida += ALFABETO_B64[((b0 & 3) << 4) | ((b1 ?? 0) >>> 4)];
    salida += b1 === undefined ? "=" : ALFABETO_B64[((b1 & 15) << 2) | ((b2 ?? 0) >>> 6)];
    salida += b2 === undefined ? "=" : ALFABETO_B64[b2 & 63];
  }
  return salida;
}

/** Convierte "#rrggbb" en [r, g, b]. Cualquier otra forma es un error. */
export function hexARgb(hex) {
  const limpio = String(hex).trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(limpio)) throw new Error(`Color no hexadecimal de 6 dígitos: ${hex}`);
  const n = Number.parseInt(limpio, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Codifica una imagen de color indexado como bytes PNG.
 *
 * El índice 0 es SIEMPRE el transparente: se declara así en `tRNS`, que solo
 * necesita listar las entradas con alfa distinto de opaco y puede cortarse en
 * la última. Así el fondo de la ficha no pinta un rectángulo sobre el tablero.
 *
 * El RGB de esa entrada 0 lo pone este módulo y no quien llama: un píxel
 * totalmente transparente necesita tres bytes de color porque el formato lo
 * exige, no porque nadie vaya a verlos. Dejar que el arte los eligiera sería
 * pedirle una decisión de diseño sobre algo invisible —y colarle un color
 * propio fuera de `paleta.mjs`, que es justo lo que la guardia de #351
 * prohíbe—.
 *
 * @param {{ancho:number, alto:number, indices:Uint8Array, paleta:string[]}} imagen
 *   `paleta` lista SOLO los colores visibles, en el orden de los índices 1..n;
 *   `indices` recorre la imagen por filas, de arriba abajo, y el 0 es el hueco.
 * @returns {Uint8Array}
 */
export function codificarPngIndexado({ ancho, alto, indices, paleta }) {
  if (!Number.isInteger(ancho) || !Number.isInteger(alto) || ancho <= 0 || alto <= 0) {
    throw new Error(`Dimensiones no válidas: ${ancho}x${alto}`);
  }
  if (indices.length !== ancho * alto) {
    throw new Error(`Se esperaban ${ancho * alto} índices y llegaron ${indices.length}`);
  }
  if (paleta.length === 0 || paleta.length >= MAX_PALETA) {
    throw new Error(
      `La paleta debe tener entre 1 y ${MAX_PALETA - 1} colores visibles, y tiene ${paleta.length}`,
    );
  }

  // Cada fila va precedida por su byte de filtro. Se usa 0 (ninguno): los
  // filtros existen para que el compresor gane, y aquí no se comprime.
  const crudo = new Uint8Array(alto * (ancho + 1));
  for (let y = 0; y < alto; y += 1) {
    crudo[y * (ancho + 1)] = 0;
    crudo.set(indices.subarray(y * ancho, (y + 1) * ancho), y * (ancho + 1) + 1);
  }

  const ihdr = [...u32(ancho), ...u32(alto), 8, 3, 0, 0, 0];
  // Entrada 0: el hueco. Negro por convención y jamás visible, porque `tRNS`
  // lo declara con alfa 0 justo debajo.
  const plte = [0, 0, 0, ...paleta.flatMap((color) => hexARgb(color))];
  const trns = [0]; // solo la entrada 0 es transparente; el resto, opaco.

  return Uint8Array.from([
    ...FIRMA,
    ...chunk("IHDR", ihdr),
    ...chunk("PLTE", plte),
    ...chunk("tRNS", trns),
    ...chunk("IDAT", zlibSinComprimir(crudo)),
    ...chunk("IEND", []),
  ]);
}

/** El PNG ya codificado, como data-URI listo para un `src`. */
export function pngADataUri(bytes) {
  return `data:image/png;base64,${base64(bytes)}`;
}
