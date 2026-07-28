// Motor 3D de consola de los 90 (#362, rebanada 1): la geometría, no el lienzo.
//
// Por qué existe. `ventana-nave.mjs` declara en su cabecera que finge la
// profundidad —«parallax que finge la profundidad (sin 3D real)»—, y para un
// mapa cenital está bien. Para enseñar un casco girando no lo está. Esto trae
// profundidad de verdad sin traer un motor moderno.
//
// LA ÉPOCA ES UN PARÁMETRO, no dos módulos. PSX y GameCube no son el mismo
// aspecto y la diferencia no es nostalgia suelta: la PSX rasterizaba sin coma
// flotante y sin z-buffer, y de ahí salen sus dos firmas —el temblor de los
// vértices ajustados a la rejilla y los solapes del orden por pintor—. La
// GameCube tenía hardware honesto: sin temblor, con profundidad por píxel y más
// tonos, pero silueta de pocos polígonos. Con la época como parámetro, cada
// superficie elige: el visor del piloto puede ir sucio y la lámina del GM
// legible, sin duplicar el motor. Es la misma forma de decidir que `lenguajePara()`.
//
// Frontera de arte (#351): esto es lenguaje PIXEL —se repinta con telemetría—,
// así que rejilla, paleta corta y ni un degradado. Los tonos NO se declaran
// aquí: se derivan por sombreado del color base que entra, que ya viene de
// `paleta.mjs`. Este módulo no inventa color ninguno.
//
// Puro: ni Foundry, ni DOM, ni <canvas>, ni reloj, ni Math.random(). Produce una
// lista de polígonos en coordenadas de pantalla; quien pinta vive fuera, igual
// que en `ventana-nave.mjs`.

import { PIXEL, canales } from "./paleta.mjs";

/** Épocas disponibles. Cualquier otra cosa cae en la de por defecto. */
export const EPOCAS = Object.freeze(["psx", "gamecube"]);

export const EPOCA_POR_DEFECTO = "psx";

/**
 * Lo que cambia entre una consola y otra, escrito como datos y no como ramas
 * sueltas por el código.
 *
 * - `rejilla`: a cuántos píxeles se ajusta cada vértice proyectado. La PSX
 *   rasterizaba con enteros y por eso los vértices saltan; a 1 se reproduce
 *   sobre el búfer interno. A 0 no se ajusta nada.
 * - `tonos`: escalones del sombreado. Pocos y duros contra muchos y suaves.
 * - `profundidadPorPixel`: si hay z-buffer. La PSX no lo tenía y ordenaba por
 *   pintor, con los solapes que eso trae; se conserva porque es la mitad de su
 *   aspecto, no un defecto que haya que disimular.
 */
export const AJUSTES_EPOCA = Object.freeze({
  psx: Object.freeze({ rejilla: 1, tonos: 4, profundidadPorPixel: false }),
  gamecube: Object.freeze({ rejilla: 0, tonos: 16, profundidadPorPixel: true }),
});

export function ajustesEpoca(epoca) {
  return AJUSTES_EPOCA[epoca] ?? AJUSTES_EPOCA[EPOCA_POR_DEFECTO];
}

// ---- Álgebra mínima --------------------------------------------------------
//
// Suficiente para un cuerpo rígido y ni una función más: no hace falta una
// biblioteca de matrices para rotar una nave y proyectarla.

const resta = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

function cruz(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalizar(v) {
  const largo = Math.hypot(v[0], v[1], v[2]);
  // Un triángulo degenerado (dos vértices iguales) da normal cero. Se devuelve
  // el vector nulo en vez de NaN: el sombreado lo trata como cara sin luz y el
  // polígono sigue pintándose, que es preferible a un color «NaN» en el lienzo.
  if (!Number.isFinite(largo) || largo === 0) return [0, 0, 0];
  return [v[0] / largo, v[1] / largo, v[2] / largo];
}

const punto = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Rota un vértice en el orden yaw (Y) → pitch (X) → roll (Z) y lo traslada.
 * El orden es fijo y se escribe porque componer rotaciones no es conmutativo:
 * cambiarlo aquí movería todas las mallas sin que nadie lo pidiera.
 */
export function transformar([x, y, z], { yaw = 0, pitch = 0, roll = 0, posicion = [0, 0, 0] } = {}) {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  let px = x * cy + z * sy;
  let py = y;
  let pz = -x * sy + z * cy;

  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const ry = py * cp - pz * sp;
  const rz = py * sp + pz * cp;
  py = ry;
  pz = rz;

  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  const rx = px * cr - py * sr;
  py = px * sr + py * cr;
  px = rx;

  return [px + posicion[0], py + posicion[1], pz + posicion[2]];
}

// ---- Proyección ------------------------------------------------------------

/**
 * Distancia focal en píxeles para un campo de visión vertical dado. Se calcula
 * y no se configura a mano para que cambiar el tamaño del visor no cambie
 * también cuánto se ve.
 */
export function focal(alto, fovGrados = 60) {
  const fov = (acotar(fovGrados, 1, 179, 60) * Math.PI) / 180;
  return alto / 2 / Math.tan(fov / 2);
}

/**
 * Acota a un rango. `Math.min`/`Math.max` propagan `NaN` en silencio y el
 * resultado acaba en el lienzo como un `#NaNNaNNaN` o una focal infinita, muy
 * lejos de donde entró el valor malo.
 */
function acotar(valor, minimo, maximo, porDefecto) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return porDefecto;
  return Math.max(minimo, Math.min(maximo, n));
}

/**
 * Proyecta un vértice en espacio de cámara (la cámara mira hacia +z) a
 * coordenadas de pantalla. `rejilla` ajusta el resultado, que es de donde sale
 * el temblor de la PSX: no es un fallo que reproducimos por capricho, es la
 * consecuencia de rasterizar con enteros.
 *
 * Devuelve también `z`, que el orden por pintor necesita después.
 */
export function proyectar([x, y, z], { ancho, alto, f, rejilla = 0 }) {
  const px = ancho / 2 + (x * f) / z;
  // La pantalla crece hacia abajo y el mundo hacia arriba: sin este signo la
  // nave sale del revés y se arregla luego rotando la malla, que es peor.
  const py = alto / 2 - (y * f) / z;
  if (rejilla > 0) {
    return { x: Math.round(px / rejilla) * rejilla, y: Math.round(py / rejilla) * rejilla, z };
  }
  return { x: px, y: py, z };
}

/**
 * Recorta un polígono contra el plano cercano (Sutherland-Hodgman sobre un solo
 * plano). Sin esto, un vértice detrás de la cámara divide por un `z` diminuto o
 * negativo y el triángulo sale disparado por la pantalla: es EL fallo clásico
 * de un rasterizador casero, y a la PSX le pasaba de verdad. Aquí se recorta a
 * propósito, porque un artefacto que no se puede leer no es estética.
 */
export function recortarCercano(vertices, cerca) {
  const dentro = [];
  const n = vertices.length;
  for (let i = 0; i < n; i += 1) {
    const actual = vertices[i];
    const siguiente = vertices[(i + 1) % n];
    const actualDentro = actual[2] >= cerca;
    const siguienteDentro = siguiente[2] >= cerca;
    if (actualDentro) dentro.push(actual);
    if (actualDentro !== siguienteDentro) {
      const t = (cerca - actual[2]) / (siguiente[2] - actual[2]);
      dentro.push([
        actual[0] + (siguiente[0] - actual[0]) * t,
        actual[1] + (siguiente[1] - actual[1]) * t,
        cerca,
      ]);
    }
  }
  return dentro;
}

// ---- Sombreado -------------------------------------------------------------

const LUZ = normalizar([-0.4, 0.8, -0.45]);

/**
 * Intensidad lambertiana de una cara, ya escalonada según la época. Se deja un
 * suelo de luz ambiente: una cara a oscuras total se funde con el fondo y la
 * silueta se rompe, que en un visor pequeño se lee como un agujero.
 */
export function intensidadCara(normal, tonos) {
  const lambert = Math.max(0, punto(normal, LUZ));
  const crudo = 0.35 + 0.65 * lambert;
  // Negado a propósito, y no `tonos <= 1`: así un `tonos` que no sea número cae
  // también aquí en vez de colarse y devolver NaN.
  if (!(tonos > 1)) return crudo;
  // Escalonado: el sombreado suave es justo lo que no queremos: delata el
  // render moderno y rompe la frontera de paleta corta.
  return Math.round(crudo * (tonos - 1)) / (tonos - 1);
}

/**
 * Aplica una intensidad a un color base y devuelve un `#rrggbb`.
 *
 * El color entra desde fuera —de `paleta.mjs`, vía facción o acento— y aquí solo
 * se oscurece. Por eso este módulo no declara ni un literal de color: la guardia
 * de `paleta.test.mjs` lo comprueba, y así una nave nueva no puede colar su
 * propio verde.
 */
export function sombrear(colorBase, intensidad) {
  const rgb = canales(colorBase);
  // Un color ilegible no se adivina: se devuelve tal cual y quien pinte verá el
  // valor original en vez de un negro silencioso que parece un fallo de luz.
  if (!rgb) return colorBase;
  const k = acotar(intensidad, 0, 1, 1);
  const hex = rgb
    .map((c) => Math.round(Math.max(0, Math.min(255, c * 255 * k))).toString(16).padStart(2, "0"))
    .join("");
  return `#${hex}`;
}

// ---- Escena ----------------------------------------------------------------

/**
 * Compone una escena: malla + cámara → lista de polígonos de pantalla, ya
 * ordenados para pintar y con su color resuelto.
 *
 * Devuelve datos y no dibuja: el lienzo vive fuera, como en `ventana-nave.mjs`.
 * Así esto se prueba en Node sin un `<canvas>` de mentira.
 *
 * @param {{vertices: number[][], caras: number[][]}} malla
 * @param {object} opciones
 */
export function componerEscena(malla, opciones = {}) {
  const {
    epoca = EPOCA_POR_DEFECTO,
    ancho = 160,
    alto = 120,
    fov = 60,
    cerca = 0.1,
    // Casco sin color de facción, tomado de la paleta y no escrito aquí.
    color = PIXEL.neutro,
    yaw = 0,
    pitch = 0,
    roll = 0,
    posicion = [0, 0, 6],
  } = opciones;

  const ajustes = ajustesEpoca(epoca);
  const f = focal(alto, fov);
  const vertices = Array.isArray(malla?.vertices) ? malla.vertices : [];
  const caras = Array.isArray(malla?.caras) ? malla.caras : [];

  const enCamara = vertices.map((v) => transformar(v, { yaw, pitch, roll, posicion }));

  const poligonos = [];
  for (const cara of caras) {
    if (!Array.isArray(cara) || cara.length < 3) continue;
    const crudos = cara.map((indice) => enCamara[indice]).filter(Boolean);
    if (crudos.length < 3) continue;

    const recortada = recortarCercano(crudos, cerca);
    if (recortada.length < 3) continue;

    // La normal se toma de la cara SIN recortar: el recorte añade vértices sobre
    // el plano cercano y puede dejar los tres primeros casi alineados, lo que
    // daría una normal basura y un parpadeo de sombreado justo al pasar rozando
    // la cámara — que es cuando más se nota.
    const normal = normalizar(cruz(resta(crudos[1], crudos[0]), resta(crudos[2], crudos[0])));

    const puntos = recortada.map((v) => proyectar(v, { ancho, alto, f, rejilla: ajustes.rejilla }));

    // Caras de espaldas fuera, medido en pantalla: es más barato que en 3D y,
    // además, descarta los polígonos que el ajuste a rejilla ha aplastado hasta
    // dejarlos sin área, que no se verían pero sí se pintarían.
    if (areaFirmada(puntos) <= 0) continue;

    poligonos.push({
      puntos,
      color: sombrear(color, intensidadCara(normal, ajustes.tonos)),
      profundidad: recortada.reduce((suma, v) => suma + v[2], 0) / recortada.length,
    });
  }

  // Orden por pintor: primero lo lejano. La GameCube tenía z-buffer y no lo
  // necesitaría, pero ordenar igual no le hace daño y deja un solo camino; lo
  // que cambia de verdad entre épocas es el temblor y los tonos.
  poligonos.sort((a, b) => b.profundidad - a.profundidad);
  return { epoca: EPOCAS.includes(epoca) ? epoca : EPOCA_POR_DEFECTO, ancho, alto, poligonos };
}

/** Área firmada del polígono en pantalla. Positiva = mirándonos. */
export function areaFirmada(puntos) {
  let suma = 0;
  for (let i = 0; i < puntos.length; i += 1) {
    const a = puntos[i];
    const b = puntos[(i + 1) % puntos.length];
    suma += a.x * b.y - b.x * a.y;
  }
  return suma / 2;
}

// ---- Malla ------------------------------------------------------------------

/**
 * Topología común de todos los cascos: qué vértice va con cuál. Los índices van
 * en sentido antihorario visto desde fuera, que es lo que hace funcionar el
 * descarte de caras traseras.
 */
const CARAS_CASCO = Object.freeze([
  [0, 2, 1], // lomo
  [0, 1, 3], // costado izquierdo
  [0, 3, 2], // costado derecho
  [1, 2, 3], // popa
  [0, 1, 4], // ala izquierda, cara superior
  [0, 4, 3], // ala izquierda, cara inferior
  [0, 5, 2], // ala derecha, cara superior
  [0, 3, 5], // ala derecha, cara inferior
]);

/** Medidas de un casco de serie. Un caza: corto, estrecho y con mucha ala. */
export const CASCO_POR_DEFECTO = Object.freeze({
  eslora: 1.6,
  manga: 0.75,
  envergadura: 1.7,
  quilla: 0.35,
});

/**
 * Malla a partir de CUATRO MEDIDAS, no de una lista de vértices a mano.
 *
 * Decidido en #362 tras ver las dos opciones renderizadas: con una malla escrita
 * a mano, un carguero y un caza son la misma nave repintada, y eso no vale para
 * un atlas. Con medidas, la clase se lee de un vistazo — el carguero es ancho y
 * el caza afilado— y una nave nueva no obliga a dibujar nada.
 *
 * En esta fase los números se escriben en el módulo. Cuando exista el editor
 * declarativo de naves (#55), se cambia de dónde vienen y este código no se
 * entera: es justo lo que se gana empezando por aquí y no por el catálogo.
 *
 * Morro en +z (la cámara mira hacia +z, así que de frente se ve venir), alas en
 * ±x, quilla en −y.
 */
export function mallaDesdeCasco(entrada = {}) {
  // `= {}` solo cubre `undefined`; un `null` explícito llegaría hasta aquí y
  // reventaría al leer la primera medida.
  const medidas = entrada ?? {};
  const eslora = acotar(medidas.eslora, 0.2, 8, CASCO_POR_DEFECTO.eslora);
  const manga = acotar(medidas.manga, 0.1, 4, CASCO_POR_DEFECTO.manga);
  const envergadura = acotar(medidas.envergadura, 0.1, 6, CASCO_POR_DEFECTO.envergadura);
  const quilla = acotar(medidas.quilla, 0.05, 3, CASCO_POR_DEFECTO.quilla);
  return {
    vertices: [
      [0, 0, eslora], // 0 morro
      [-manga, 0.18, -0.6], // 1 popa alta izquierda
      [manga, 0.18, -0.6], // 2 popa alta derecha
      [0, -quilla, -0.5], // 3 quilla
      [-envergadura, -0.05, -0.75], // 4 punta de ala izquierda
      [envergadura, -0.05, -0.75], // 5 punta de ala derecha
    ],
    caras: CARAS_CASCO.map((cara) => [...cara]),
  };
}

/** El caza de serie, por comodidad de quien no quiere pensar en medidas. */
export const MALLA_CAZA = Object.freeze(mallaDesdeCasco(CASCO_POR_DEFECTO));
