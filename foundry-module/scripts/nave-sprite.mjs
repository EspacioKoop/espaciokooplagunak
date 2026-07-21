/**
 * Sprites pixel-art «falso 3D» de las naves para el mapa vivo (estética Neo Geo).
 * Dibuja la nave propia y los contactos como siluetas de bloques con volumen
 * fingido por sombreado (borde superior iluminado, inferior oscuro, cabina y
 * motores como acentos), en vez de blips cuadrados.
 *
 * Todo por primitivas de canvas, SIN assets externos (obligado por la CSP de
 * Foundry) y coloreado a partir del color de facción que ya calcula
 * `ventana-nave.mjs`. La geometría y el sombreado son lógica pura y tienen
 * pruebas Node; el pintado sobre `<canvas>` es verificación humana, como el
 * resto de `mapa-render.mjs`.
 *
 * Varios «modelos» inspirados en las clases de EmptyEpsilon (caza, carguero,
 * crucero, estación) se eligen por el tipo del contacto; sin tipo utilizable se
 * usa una silueta genérica. No hay rotación por rumbo: el mapa es de cabina
 * (nave propia con el morro arriba) y `/v1/contacts` no publica rumbo por
 * contacto, así que el «falso 3D» es de sombreado, no de frames.
 */

// Acentos fijos (no dependen de la facción).
const CABINA = "#fdfffc"; // crema cálido, como la nave propia del mapa
const MOTOR = "#ffb703"; // ámbar de propulsión

// Siluetas nose-up. Códigos: '=' casco iluminado, '#' casco base,
// '-' casco en sombra, '*' cabina, 'o' motor, '.' vacío.
export const SILUETAS = {
  jugador: [
    "....=....",
    "...=*=...",
    "..==*==..",
    ".==#*#==.",
    "=##=*=##=",
    "###-*-###",
    ".#-###-#.",
    "..#-#-#..",
    "..o#-#o..",
  ],
  caza: [
    "..=..",
    ".=*=.",
    "#=*=#",
    ".###.",
    ".o.o.",
  ],
  carguero: [
    ".=====.",
    "#######",
    "#=###=#",
    "#-###-#",
    ".#o.o#.",
  ],
  crucero: [
    "...=...",
    "..===..",
    ".==*==.",
    "##=*=##",
    "#######",
    ".#-.-#.",
    "..o.o..",
  ],
  estacion: [
    "..###..",
    ".#=*=#.",
    "##*=*##",
    "#=*#*=#",
    "##*=*##",
    ".#=*=#.",
    "..###..",
  ],
  desconocido: [
    "..=..",
    ".=#=.",
    "=#*#=",
    ".=#=.",
    "..=..",
  ],
};

/** Recorta un canal a [0,255]. */
function clampCanal(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

/** Mezcla un color hex hacia blanco (factor>0) o negro (factor<0). */
export function ajustarBrillo(hex, factor) {
  const n = Number.parseInt(String(hex).replace("#", ""), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (factor >= 0) {
    r += (255 - r) * factor;
    g += (255 - g) * factor;
    b += (255 - b) * factor;
  } else {
    const k = 1 + factor; // factor negativo → oscurece
    r *= k;
    g *= k;
    b *= k;
  }
  const hx = (v) => clampCanal(v).toString(16).padStart(2, "0");
  return `#${hx(r)}${hx(g)}${hx(b)}`;
}

/**
 * Elige la silueta a partir de la plantilla y la clasificación semántica de
 * EmptyEpsilon. Acepta también una cadena por compatibilidad con consumidores
 * anteriores; el mapa pasa `{tipo, clase, subclase}` desde `/v1/contacts`.
 */
export function clasificarNave(datos, esJugador = false) {
  if (esJugador) return "jugador";
  const campos = typeof datos === "string"
    ? [datos]
    : [datos?.tipo ?? datos?.type, datos?.clase ?? datos?.class, datos?.subclase ?? datos?.subclass];
  const t = campos.filter((valor) => typeof valor === "string").join(" ").toLowerCase();
  if (!t) return "desconocido";
  if (/(station|base|platform|estación|estacion|plataforma)/.test(t)) return "estacion";
  if (/(freighter|transport|cargo|tug|hauler|tanker|carguero|transporte|remolcador|cisterna)/.test(t))
    return "carguero";
  if (/(starfighter|fighter|interceptor|gunship|drone|scout|caza|cañonera|canonera|dron|explorador)/.test(t))
    return "caza";
  if (/(cruiser|battleship|dreadnought|frigate|corvette|carrier|destroyer|warship|crucero|acorazado|fragata|corbeta|portaaviones|destructor)/.test(t))
    return "crucero";
  return "desconocido";
}

// Resuelve el código de celda a un color concreto sobre el color base.
function colorCelda(codigo, base) {
  switch (codigo) {
    case "=": return ajustarBrillo(base, 0.42);
    case "#": return base;
    case "-": return ajustarBrillo(base, -0.4);
    case "*": return CABINA;
    case "o": return MOTOR;
    default: return null;
  }
}

/**
 * Construye el sprite como celdas centradas en (0,0). Puro: no toca el canvas.
 * Cada celda es {dx, dy, color} en unidades de píxel de la silueta.
 *
 * @returns {{dx:number, dy:number, color:string}[]}
 */
export function construirSpriteNave({ clave = "desconocido", color = "#ffffff" } = {}) {
  const filas = SILUETAS[clave] ?? SILUETAS.desconocido;
  const alto = filas.length;
  const ancho = filas.reduce((max, fila) => Math.max(max, fila.length), 0);
  const cx = (ancho - 1) / 2;
  const cy = (alto - 1) / 2;
  const celdas = [];
  for (let y = 0; y < alto; y += 1) {
    for (let x = 0; x < filas[y].length; x += 1) {
      const c = colorCelda(filas[y][x], color);
      if (c) celdas.push({ dx: x - cx, dy: y - cy, color: c });
    }
  }
  return celdas;
}

/**
 * Pinta un sprite ya construido centrado en (centroX, centroY) del canvas, con
 * `pixel` px por celda. Debe llamarse tras el fondo/decorado y bajo la retícula
 * para la nave propia, o en la posición del contacto para los blips.
 */
export function dibujarNaveSprite(
  ctx,
  celdas,
  { centroX, centroY, pixel = 2, moviendo = false, tMs = 0 } = {},
) {
  // Parpadeo de la llama de propulsión (fase temporal, look retro).
  const llamaLarga = moviendo && Math.floor(tMs / 90) % 2 === 0;
  for (const celda of celdas) {
    const esMotor = celda.color === MOTOR;
    // Motor apagado cuando la nave está parada; encendido (ámbar vivo) al mover.
    ctx.fillStyle = esMotor && !moviendo ? "#6e5211" : celda.color;
    const px = Math.round(centroX + celda.dx * pixel - pixel / 2);
    const py = Math.round(centroY + celda.dy * pixel - pixel / 2);
    ctx.fillRect(px, py, pixel, pixel);

    // Estela de propulsión hacia popa (abajo, morro arriba) solo en movimiento.
    if (esMotor && moviendo) {
      ctx.fillStyle = "#fff3c4"; // núcleo claro
      ctx.fillRect(px, py + pixel, pixel, pixel);
      ctx.fillStyle = "#ff8c1e"; // estela ámbar
      ctx.fillRect(px, py + pixel * 2, pixel, pixel * (llamaLarga ? 2 : 1));
    }
  }
}
