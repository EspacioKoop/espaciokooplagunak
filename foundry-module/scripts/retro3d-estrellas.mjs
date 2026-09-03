// Fondo estelar del 3D retro (#362, rebanada 5): lo que hay DETRÁS de la nave.
//
// Las dos superficies retro pintaban la silueta sobre vacío. Funcionaba, pero
// una nave flotando en nada no está en ningún sitio, y el motor ya sabe hacer lo
// único que este fondo necesita: proyectar puntos en perspectiva. Las estrellas
// pasan por el mismo `focal` y el mismo recorte cercano que la malla, así que no
// son una capa aparte pegada encima —están en la misma escena.
//
// EL CIELO NO SE MUEVE SOLO, y esto no es una limitación sino la regla. Los
// puntos viven en el mundo, no en el lienzo: solo cambian cuando cambia la
// cámara. Un fondo que se desplazara por su cuenta diría «la nave avanza», y el
// casco propio de la consola se queda quieto A PROPÓSITO cuando no hay lectura
// de rumbo (#353: ausencia no es cero). Sería una mentira pequeña en el único
// sitio donde no caben: una consola de mando. Por eso tampoco hay arrastre por
// velocidad, por tentador que sea.
//
// Y no informa de nada. Es ambiente puro; ningún dato depende de contarlas ni de
// mirarlas. Si algún día algo de aquí quisiera significar, deja de ser decorado
// y necesita su propia decisión.
//
// Puro: ni Foundry, ni DOM, ni red. Se prueba desde Node.

import { PIXEL } from "./paleta.mjs";
import { ajustesEpoca, focal, proyectar, sombrear, transformar } from "./retro3d.mjs";
import { rngSemilla } from "./ventana-nave.mjs";

/**
 * Cuántas estrellas y cómo brillan según la época. Es el mismo criterio que
 * `AJUSTES_EPOCA`: lo que cambia entre consolas son datos, no ramas sueltas.
 *
 * - `psx`: pocas y crudas. Sin z-buffer y con la resolución interna baja, un
 *   cielo denso se convierte en ruido blanco que se come la silueta.
 * - `gamecube`: más y con más escalones de brillo, que es lo que la máquina
 *   podía y lo que hace legible una lámina que se mira fija.
 */
export const ESTRELLAS_POR_EPOCA = Object.freeze({
  psx: Object.freeze({ cantidad: 70, tonos: 3, tamMax: 1 }),
  gamecube: Object.freeze({ cantidad: 140, tonos: 8, tamMax: 2 }),
});

const RESPALDO_ESTRELLAS = ESTRELLAS_POR_EPOCA.psx;

/** Ajustes de estrellas de una época, con respaldo para las desconocidas. */
export function estrellasEpoca(epoca) {
  return ESTRELLAS_POR_EPOCA[epoca] ?? RESPALDO_ESTRELLAS;
}

/**
 * Genera el cielo: puntos sobre un cascarón esférico centrado en la cámara.
 *
 * La distribución es uniforme de verdad (z sorteado plano y luego el radio del
 * paralelo), no `sen(θ)` a ojo: sortear los dos ángulos por igual amontona
 * estrellas en los polos, y con la cámara siempre cabeceada hacia abajo ese
 * amontonamiento cae justo en el borde superior del visor, donde se ve.
 *
 * Misma semilla, mismo cielo. Importa porque el fondo se recompone en cada
 * fotograma: si el sorteo no fuera determinista, el cielo hervería.
 *
 * @param {number} semilla
 * @param {{cantidad?: number, radio?: number}} opciones
 * @returns {{punto: number[], brillo: number}[]}
 */
export function campoEstelar(semilla, { cantidad = RESPALDO_ESTRELLAS.cantidad, radio = 60 } = {}) {
  const cuantas = Number.isFinite(cantidad) ? Math.max(0, Math.trunc(cantidad)) : 0;
  const r = Number.isFinite(radio) && radio > 0 ? radio : 60;
  const rng = rngSemilla(Number.isFinite(semilla) ? semilla : 0);
  const campo = [];
  for (let i = 0; i < cuantas; i += 1) {
    const z = rng() * 2 - 1;
    const theta = rng() * Math.PI * 2;
    const paralelo = Math.sqrt(Math.max(0, 1 - z * z));
    campo.push({
      punto: [r * paralelo * Math.cos(theta), r * paralelo * Math.sin(theta), r * z],
      // El brillo no baja de un tercio: una estrella casi negra sobre papel
      // negro es una estrella que no está, y aun así cuesta lo mismo pintarla.
      brillo: 0.35 + rng() * 0.65,
      // Una de cada seis sale CÁLIDA (#458 QA: «solo son unos puntos en el
      // cielo»). Un cielo real no es monocromo —hay gigantes rojas entre las
      // blancas—, y esto es lo poco que se puede afirmar sin inventar
      // ninguna estrella real: variedad de tono, no una posición. Nace aquí
      // y no se decide en el pintor porque tiene que ser la MISMA estrella
      // cálida en cada fotograma, no una que cambia de color al repintarse.
      calida: rng() < (1 / 6),
    });
  }
  return campo;
}

/**
 * Proyecta el cielo a puntos de pantalla.
 *
 * La cámara solo ROTA respecto a las estrellas: se pasa una posición nula a
 * `transformar` a propósito. La malla sí se aleja o se acerca; el cielo está
 * lejos por definición y trasladarlo lo convertiría en una pared de puntos que
 * orbita la nave.
 *
 * @param {{punto: number[], brillo: number}[]} campo
 * @param {object} opciones misma cámara que `componerEscena`.
 * @returns {{x: number, y: number, tam: number, color: string}[]}
 */
export function proyectarEstrellas(campo, opciones = {}) {
  if (!Array.isArray(campo) || campo.length === 0) return [];
  const { epoca } = opciones;
  const ancho = numero(opciones.ancho, 160);
  const alto = numero(opciones.alto, 120);
  const cerca = numero(opciones.cerca, 0.1);
  const ajustes = ajustesEpoca(epoca);
  const cielo = estrellasEpoca(epoca);
  const f = focal(alto, numero(opciones.fov, 60));

  const salida = [];
  for (const estrella of campo) {
    const v = transformar(estrella?.punto, {
      yaw: opciones.yaw,
      pitch: opciones.pitch,
      roll: opciones.roll,
      posicion: [0, 0, 0],
    });
    // Detrás de la cámara o rozando el plano cercano: fuera antes de dividir.
    // Una estrella no se puede recortar como un polígono —no tiene lados— así
    // que o entra entera o no entra.
    if (!(v[2] > cerca)) continue;

    const { x, y } = proyectar(v, { ancho, alto, f, rejilla: ajustes.rejilla });
    // Fuera del búfer no se pinta. El pintor lo toleraría, pero recortar aquí
    // deja la salida diciendo la verdad sobre lo que se ve, que es lo que las
    // pruebas pueden comprobar sin un lienzo.
    if (!(x >= 0 && x < ancho && y >= 0 && y < alto)) continue;

    const brillo = escalonar(numero(estrella?.brillo, 1), cielo.tonos);
    salida.push({
      x: Math.floor(x),
      y: Math.floor(y),
      // Solo las más brillantes ganan el píxel extra, y solo donde la época lo
      // permite. Con todas gordas el cielo se vuelve una cortina.
      tam: brillo > 0.75 ? cielo.tamMax : 1,
      // Cálida sale del mismo crema que ya usa el núcleo de la estela del
      // motor (`PIXEL.motorNucleo`): ni color nuevo ni degradado, el mismo
      // acento cálido que el módulo ya reserva para "esto brilla de verdad".
      color: sombrear(estrella?.calida ? PIXEL.motorNucleo : PIXEL.estrella, brillo),
    });
  }
  return salida;
}

/** Escalona el brillo como `intensidadCara` escalona la luz: paleta corta. */
function escalonar(valor, tonos) {
  const v = Math.max(0, Math.min(1, valor));
  if (!(tonos > 1)) return v;
  return Math.round(v * (tonos - 1)) / (tonos - 1);
}

function numero(valor, porDefecto) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : porDefecto;
}
