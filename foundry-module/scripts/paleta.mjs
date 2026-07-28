/**
 * Paletas del arte procedural del módulo y la frontera entre sus dos lenguajes
 * (#351).
 *
 * En el módulo conviven dos artes generadas en el cliente, y no chocan por
 * casualidad: las dos renuncian al degradado y comparten papel oscuro. Son una
 * imprenta y un CRT en la misma sala.
 *
 * ## La frontera: vivo frente a registrado
 *
 * - **GRABADO** (`TINTA`) para lo que **persiste o enmarca**: cartelas, fichas,
 *   códice, el marco cartográfico del mapa. Sombra por densidad de línea, nunca
 *   por opacidad — la opacidad es un recurso de pantalla y delata el pastiche.
 * - **PIXEL** (`PIXEL`) para lo que **se repinta con telemetría**: sprites de
 *   nave, barras, iconos de sistema, retratos, naipes. Rejilla, `crispEdges`,
 *   paleta corta.
 *
 * El eje NO es «diegético frente a papel», que fue el primer intento: bajo esa
 * regla el marco de grabado que envuelve el lienzo de píxeles del mapa vivo
 * sería una infracción, cuando es justo lo correcto — el marco es la carta y el
 * interior es la verdad que cambia en cada sondeo. Formulada como vivo/registrado
 * la regla predice bien los casos que vienen: la cartela de una lámina impresa es
 * grabado aunque cuelgue de una consola, y una barra que sigue a `/v1/state` es
 * pixel aunque viva dentro de un diario.
 *
 * Este módulo existe para que la frontera sea EXIGIBLE y no prosa: antes los
 * mismos tokens de color estaban repetidos en tres sitios sin dueño, así que
 * nada impedía que el cuarto módulo inventara su propio sepia.
 *
 * Puro: ni Foundry, ni DOM, ni red. Los valores son exactamente los que ya
 * usaban los tres módulos; este archivo los reúne, no los rediseña.
 */

/** Lenguajes disponibles, para que un consumidor pueda declarar el suyo. */
export const LENGUAJES = Object.freeze(["grabado", "pixel"]);

/**
 * Tinta sepia sobre papel envejecido: la paleta del grabado impreso, no la de
 * una pantalla. Se expone para que el consumidor pueda invertirla.
 */
export const TINTA = Object.freeze({
  linea: "#c9b48a",
  lineaSuave: "rgba(201, 180, 138, 0.45)",
  papel: "#0b0f18",
  realce: "#f0e4c4",
});

/**
 * Paleta del arte de rejilla. Reúne los acentos de los sprites de nave y la
 * baraja, que antes vivían por separado.
 */
// Crema cálido. Lo comparten el acento de cabina del sprite y la nave propia
// del mapa vivo, que es justo lo que quiere decir su comentario original
// («como la nave propia del mapa»): la relación se escribe, no se repite el
// literal en dos módulos donde nadie los ve juntos.
const CREMA = "#fdfffc";

export const PIXEL = Object.freeze({
  // Naipes (#308/#330). `cara` es pergamino claro para dar el máximo contraste
  // con ambas tintas de palo.
  cara: "#f4e8c8",
  borde: "#2a1f14",
  negro: "#1c1a2e",
  rojo: "#b3212a",
  dorsoFondo: "#141b33",
  dorsoMotivo: "#c8a24a",
  dorsoEstrella: "#8fa3d9",
  // Sprites de nave: acentos fijos que no dependen del color de facción.
  cabina: CREMA,
  motor: "#ffb703",
  motorApagado: "#6e5211", // ámbar sin propulsión: mismo tono, sin brillo
  motorNucleo: "#fff3c4", // núcleo claro de la estela
  motorEstela: "#ff8c1e", // cola de la estela
  neutro: "#ffffff", // casco sin color de facción utilizable
  // Mapa vivo (#33): contactos del radar. Reservados, fuera del reparto por
  // hash de `FACCIONES`.
  naveJugador: CREMA, // la nave propia destaca
  sinFaccion: "#7d8597", // gris azulado: objetos sin facción
});

/**
 * Paleta arcade saturada de las facciones en el mapa vivo. Es una lista y no un
 * objeto porque el color se reparte por hash del nombre de facción: importa el
 * orden, no el nombre de cada entrada.
 *
 * El ámbar coincide a propósito con `PIXEL.motor`: es el mismo ámbar de
 * propulsión del sprite, y por eso se toma de ahí en vez de repetirlo.
 */
export const FACCIONES = Object.freeze([
  "#ff2e88", // magenta
  "#00e5ff", // cian
  PIXEL.motor, // ámbar
  "#38b000", // verde
  "#9d4edd", // púrpura
  "#ef233c", // rojo
  "#3a86ff", // azul
  "#f15bb5", // rosa
]);

/**
 * Iconos de daño por sistema (#353). El estado se dibuja con forma —grietas,
 * píxeles apagados, contorno discontinuo—, así que estos colores acompañan a
 * la forma en vez de sustituirla: quien no distinga los tonos sigue leyendo el
 * estado, y el texto de la fila sigue siendo la verdad.
 */
export const SISTEMA = Object.freeze({
  // El marco no es un gris nuevo: es el mismo de lo que no tiene facción en el
  // mapa. Se toma de ahí en vez de repetirlo, que es la regla de este archivo.
  marco: PIXEL.sinFaccion,
  nucleo: "#8df06f", // verde de sistema respondiendo
  grieta: "#e2aa28", // ámbar de la alerta amarilla
  apagado: "#3a2b2f", // núcleo muerto: presente pero sin responder
  sinLectura: "#5b6472", // ni bueno ni malo: no se sabe
});

/**
 * Qué lenguaje toca. Se responde con una pregunta y no con una lista de
 * superficies, para que valga también para la superficie que aún no existe.
 *
 * @param {boolean} seRepintaConTelemetria ¿el dibujo cambia cuando cambia el
 *   estado de la nave, o es un marco que se queda quieto?
 */
export function lenguajePara(seRepintaConTelemetria) {
  return seRepintaConTelemetria ? "pixel" : "grabado";
}

// ---- Contraste -------------------------------------------------------------

/** Canales 0–1 de un color `#rgb` o `#rrggbb`. `null` si no es hexadecimal. */
export function canales(color) {
  if (typeof color !== "string") return null;
  const crudo = color.trim().replace(/^#/, "");
  const hex =
    crudo.length === 3
      ? [...crudo].map((c) => c + c).join("")
      : crudo.length === 6
        ? crudo
        : null;
  if (!hex || !/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
}

/**
 * Luminancia relativa de WCAG 2.x. No es el promedio de los canales: el ojo
 * pesa mucho más el verde que el azul, y usar un promedio daría por legibles
 * combinaciones que no lo son.
 */
export function luminancia(color) {
  const rgb = canales(color);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Razón de contraste entre dos colores, de 1 (idénticos) a 21 (negro sobre
 * blanco). WCAG 1.4.3 pide 4.5 para texto normal y 3 para texto grande o para
 * los elementos gráficos que portan información (1.4.11).
 */
export function contraste(a, b) {
  const la = luminancia(a);
  const lb = luminancia(b);
  if (la === null || lb === null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
