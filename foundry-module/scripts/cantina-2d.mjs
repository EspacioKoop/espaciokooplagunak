// Capa 2D de la cantina (#423): pixel-art encima del 3D.
//
// POR QUÉ EXISTE. Un rasterizador por pintor con caras planas deja costuras:
// juntas de un píxel entre polígonos vecinos, esquinas donde dos cajas casi
// coinciden, y sobre todo un ambiente que no tiene ningún volumen porque nada
// atenúa las distancias cortas. Perseguir eso dentro del 3D es caro y además no
// es lo que hacían las consolas de la época: encima del render iban capas
// planas —viñeta, líneas, un velo de suciedad, luces dibujadas— y ahí es donde
// vivía la mitad del ambiente.
//
// Aquí está esa mitad. Se dibuja DESPUÉS de la escena, en el mismo búfer
// pequeño, así que se amplía con ella y sale del mismo tamaño de píxel: no es
// un filtro de pantalla, es dibujo del mismo cuadro.
//
// Sin estado, sin reloj propio, sin Foundry: recibe un contexto 2D y las
// medidas, como `retro3d-lienzo.mjs`. Se prueba con un contexto de mentira.
//
// Frontera de arte (#351): no declara ni un color.

import { CANTINA, PIXEL, canales } from "./paleta.mjs";

/**
 * Velo de un color de la paleta con la opacidad dada. Existe para que este
 * módulo no escriba ni un `rgba(...)` literal: la guardia de `paleta.test.mjs`
 * los prohíbe con razón —un velo es un color— y aquí el tono siempre sale de
 * `CANTINA`, solo que atenuado.
 */
function velo(color, alfa) {
  const [r, g, b] = canales(color) ?? canales(CANTINA.sombra);
  return `rgba(${r}, ${g}, ${b}, ${alfa})`;
}

/** Alto de la banda de suciedad del techo, como fracción del alto. */
const BANDA = 0.16;

/**
 * Viñeta por bandas, no por degradado. El degradado es un recurso de pantalla y
 * delata el pastiche —la misma razón por la que el grabado del módulo no usa
 * opacidad—; una consola oscurecía los bordes con tramas de píxeles, así que
 * esto son rectángulos translúcidos de anchura creciente y nada más.
 */
export function pintarVinieta(ctx, { ancho, alto, pasos = 4, fuerza = 0.12 }) {
  if (!ctx) return 0;
  let pintados = 0;
  for (let i = 0; i < pasos; i += 1) {
    const grosor = i + 1;
    ctx.fillStyle = velo(CANTINA.sombra, fuerza);
    ctx.fillRect(0, i, ancho, 1);
    ctx.fillRect(0, alto - 1 - i, ancho, 1);
    ctx.fillRect(i, 0, 1, alto);
    ctx.fillRect(ancho - 1 - i, 0, 1, alto);
    pintados += 4 * grosor;
  }
  return pintados;
}

/**
 * Líneas horizontales alternas, una sí una no. Es el recurso más viejo del
 * catálogo y hace dos cosas a la vez: da textura de tubo y, sobre todo, ROMPE
 * LAS COSTURAS — una junta de un píxel entre dos caras deja de leerse como un
 * arañazo cuando la imagen entera está rayada.
 */
export function pintarLineas(ctx, { ancho, alto, cada = 2, fuerza = 0.16 }) {
  if (!ctx) return 0;
  let lineas = 0;
  ctx.fillStyle = velo(CANTINA.sombra, fuerza);
  for (let y = 0; y < alto; y += cada) {
    ctx.fillRect(0, y, ancho, 1);
    lineas += 1;
  }
  return lineas;
}

/**
 * El halo de las lámparas: un par de bandas cálidas en la parte alta. La luz de
 * la sala sale de arriba y el 3D no la puede dar —no hay luces, solo sombreado
 * por normal—, así que se dibuja. Es exactamente el truco de la época.
 */
export function pintarLuzAlta(ctx, { ancho, alto }) {
  if (!ctx) return 0;
  const bandas = Math.max(1, Math.round(alto * BANDA));
  for (let i = 0; i < bandas; i += 1) {
    // Más fuerte arriba del todo y se apaga hacia abajo, por escalones.
    const alfa = 0.1 * (1 - i / bandas);
    ctx.fillStyle = velo(CANTINA.lampara, alfa.toFixed(3));
    ctx.fillRect(0, i, ancho, 1);
  }
  return bandas;
}

/**
 * Motas de polvo en suspensión, sembradas. Cuatro píxeles sueltos bastan para
 * que el aire de la sala deje de ser vacío perfecto; se siembran para que no
 * bailen entre fotogramas, que es lo que las convertiría en ruido.
 */
export function pintarPolvo(ctx, { ancho, alto, semilla = 1, cuantas = 18 }) {
  if (!ctx) return 0;
  // Congruencial mínimo: no hace falta más para colocar motas, y `Math.random`
  // daría una sala distinta en cada repintado.
  let estado = semilla >>> 0;
  const siguiente = () => {
    estado = (estado * 1664525 + 1013904223) >>> 0;
    return estado / 4294967296;
  };
  ctx.fillStyle = PIXEL.estrella;
  let puestas = 0;
  for (let i = 0; i < cuantas; i += 1) {
    const x = Math.floor(siguiente() * ancho);
    const y = Math.floor(siguiente() * alto);
    ctx.fillRect(x, y, 1, 1);
    puestas += 1;
  }
  return puestas;
}

/**
 * El marco del ventanal, dibujado plano por encima del 3D. La geometría ya pone
 * los montantes, pero un filo claro de un píxel es lo que hace que el cristal
 * parezca cristal, y eso en 3D costaría cuatro cajas más por cada borde.
 */
export function pintarFiloVentanal(ctx, { ancho, alto }) {
  if (!ctx) return 0;
  const x0 = Math.round(ancho * 0.24);
  const x1 = Math.round(ancho * 0.76);
  const y0 = Math.round(alto * 0.22);
  const y1 = Math.round(alto * 0.62);
  ctx.fillStyle = CANTINA.nervio;
  ctx.fillRect(x0, y0, x1 - x0, 1);
  ctx.fillRect(x0, y1, x1 - x0, 1);
  ctx.fillRect(x0, y0, 1, y1 - y0);
  ctx.fillRect(x1, y0, 1, y1 - y0);
  return 4;
}

/**
 * Haces de luz cayendo de las lámparas. Trapecios: anchos abajo, estrechos
 * arriba, porque una lámpara de techo abre el cono hacia el suelo.
 *
 * Esto es lo que el 3D NO puede dar. `retro3d.mjs` sombrea por normal de cara —
 * cuánto mira una cara a la luz— y eso da volumen, pero no ilumina el AIRE: en
 * un local en penumbra, la mitad de la sensación de luz está en el haz que se ve
 * flotando, no en la superficie iluminada. Dibujarlo plano encima es lo que
 * hacían las consolas de la época, y sigue siendo lo correcto.
 */
export function pintarHaces(ctx, { ancho, alto, focos = 3, fuerza = 0.05 }) {
  if (!ctx) return 0;
  let bandas = 0;
  const techo = Math.round(alto * 0.16);
  const suelo = Math.round(alto * 0.78);
  for (let f = 0; f < focos; f += 1) {
    // Los focos se reparten el ancho y quedan centrados en su tramo.
    const cx = Math.round((ancho * (f + 0.5)) / focos);
    for (let y = techo; y < suelo; y += 1) {
      const avance = (y - techo) / (suelo - techo);
      // El cono se abre hacia abajo y a la vez se apaga: si solo se abriera,
      // el suelo saldría más iluminado que la lámpara.
      const medio = Math.round(ancho * (0.03 + avance * 0.07));
      const alfa = fuerza * (1 - avance);
      if (alfa <= 0.002) continue;
      ctx.fillStyle = velo(CANTINA.lampara, alfa.toFixed(3));
      const x0 = Math.max(0, cx - medio);
      const x1 = Math.min(ancho, cx + medio);
      ctx.fillRect(x0, y, x1 - x0, 1);
      bandas += 1;
    }
  }
  return bandas;
}

/**
 * Humo en suspensión: bandas horizontales lentas a media altura, donde se queda
 * el aire de un local cerrado. Sembrado y sin reloj propio —el desplazamiento
 * entra como `ms`— para que dos clientes vean lo mismo y para poder pintar un
 * fotograma cualquiera sin haber pintado los anteriores.
 *
 * Va en el TERCIO CENTRAL y no por toda la sala: humo repartido por igual es
 * niebla, y la niebla ya la pone el motor con la distancia.
 */
export function pintarHumo(ctx, { ancho, alto, ms = 0, vetas = 7, fuerza = 0.05 }) {
  if (!ctx) return 0;
  let puestas = 0;
  const desde = Math.round(alto * 0.34);
  const hasta = Math.round(alto * 0.66);
  for (let i = 0; i < vetas; i += 1) {
    // Cada veta tiene su altura, su grosor y su deriva; los números salen del
    // índice y no de un sorteo, así que la sala es la misma en cada apertura.
    const y = desde + Math.round(((hasta - desde) * ((i * 7) % vetas)) / vetas);
    const grosor = 1 + (i % 2);
    const velocidad = 0.004 + (i % 3) * 0.003;
    // Deriva continua que da la vuelta: el humo cruza y vuelve a entrar por el
    // otro lado en vez de acumularse en una esquina.
    const deriva = Math.floor((ms * velocidad + i * 37) % (ancho * 2)) - ancho;
    const largo = Math.round(ancho * (0.3 + (i % 3) * 0.12));
    ctx.fillStyle = velo(CANTINA.lampara, (fuerza * (1 - (i % 3) * 0.25)).toFixed(3));
    const x0 = Math.max(0, deriva);
    const x1 = Math.min(ancho, deriva + largo);
    if (x1 > x0) {
      ctx.fillRect(x0, y, x1 - x0, grosor);
      puestas += 1;
    }
  }
  return puestas;
}

/**
 * Cachivaches electrónicos: los trastos que llenan un mamparo de nave —paneles
 * con hileras de pilotos, lecturas de barras, un dial suelto, cableado visto—.
 *
 * VAN EN 2D Y NO EN 3D A PROPÓSITO. Un panel de veinte centímetros modelado con
 * cajas cuesta doce polígonos, se ve como una mancha gris a esta resolución y
 * encima entra en el orden por pintor a pelearse con el mamparo que tiene detrás.
 * Dibujado plano cuesta cuatro rectángulos, se lee perfectamente y no puede
 * ordenarse mal. Es exactamente el reparto que hacía una consola de la época: el
 * volumen en 3D, el detalle pintado.
 *
 * SE COLOCAN EN LAS BANDAS LATERALES, nunca en el centro: ahí está el ventanal,
 * y taparlo con cacharros sería repetir el fallo que dejó la sala sin vacío.
 *
 * Los pilotos parpadean, pero NO todos ni a la vez: cada uno tiene su periodo
 * derivado del índice. Una hilera parpadeando al unísono es una guirnalda de
 * Navidad, no una nave.
 */
export function pintarCachivaches(ctx, { ancho, alto, ms = 0, cuantos = 6 }) {
  if (!ctx) return 0;
  let piezas = 0;
  const margen = Math.round(ancho * 0.02);
  const zonaIzq = Math.round(ancho * 0.2);
  const zonaDer = Math.round(ancho * 0.8);

  for (let i = 0; i < cuantos; i += 1) {
    const izquierda = i % 2 === 0;
    const paso = Math.floor(i / 2);
    const x = izquierda ? margen + paso * Math.round(zonaIzq / 3.2) : zonaDer + paso * Math.round(zonaIzq / 3.2);
    const y = Math.round(alto * (0.24 + (i % 3) * 0.13));
    const w = Math.round(ancho * 0.055);
    const h = Math.round(alto * 0.075);
    if (x + w > ancho) continue;

    // Cuerpo del cacharro y su marco: dos rectángulos, y ya tiene relieve.
    ctx.fillStyle = CANTINA.nervio;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = CANTINA.pantalla;
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    piezas += 2;

    if (i % 3 === 2) {
      // Lectura de barras: tres niveles distintos, como un ecualizador parado.
      for (let b = 0; b < 3; b += 1) {
        const alturaBarra = 1 + ((i + b) % 3);
        ctx.fillStyle = CANTINA.neon;
        ctx.fillRect(x + 2 + b * 2, y + h - 2 - alturaBarra, 1, alturaBarra);
        piezas += 1;
      }
    } else {
      // Hilera de pilotos. Cada uno con su periodo: el parpadeo al unísono
      // convierte una consola en una guirnalda.
      for (let p = 0; p < 3; p += 1) {
        const periodo = 900 + ((i * 3 + p) % 5) * 420;
        const encendido = Math.floor(ms / periodo) % 2 === 0;
        ctx.fillStyle = encendido ? CANTINA.baliza : CANTINA.pantalla;
        ctx.fillRect(x + 2 + p * 3, y + 2, 2, 2);
        piezas += 1;
      }
    }

    // Un cable colgando hacia el suelo. Es el detalle más barato que existe y
    // el que más dice «esto se ha reparado más de una vez».
    if (i % 2 === 1) {
      ctx.fillStyle = CANTINA.conducto;
      ctx.fillRect(x + Math.round(w / 2), y + h, 1, Math.round(alto * 0.06));
      piezas += 1;
    }
  }
  return piezas;
}

/**
 * Todas las capas, en el orden en que se pintan. El orden importa: la luz va
 * antes que las líneas (si no, las líneas se comen el halo) y la viñeta va la
 * última, porque tiene que oscurecer también lo que han puesto las demás.
 */
export function pintarCapa2D(ctx, { ancho, alto, semilla = 1, ms = 0 } = {}) {
  if (!ctx || !(ancho > 0) || !(alto > 0)) return false;
  pintarLuzAlta(ctx, { ancho, alto });
  // Luz y humo antes que las líneas: si fueran después, la trama se comería el
  // haz y el humo pasaría a ser una mancha con rayas.
  pintarHaces(ctx, { ancho, alto });
  pintarHumo(ctx, { ancho, alto, ms });
  pintarFiloVentanal(ctx, { ancho, alto });
  // Los cachivaches van después de la luz —los baña, no los tapa— y antes del
  // polvo y las líneas, que son lo que los integra con el resto del cuadro.
  pintarCachivaches(ctx, { ancho, alto, ms });
  pintarPolvo(ctx, { ancho, alto, semilla });
  pintarLineas(ctx, { ancho, alto });
  pintarVinieta(ctx, { ancho, alto });
  return true;
}
