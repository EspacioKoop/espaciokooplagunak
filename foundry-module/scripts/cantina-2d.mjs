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
    const alfa = 0.22 * (1 - i / bandas);
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
 * Haces de luz cayendo de las lámparas. Trapecios: anchos abajo, estrechos
 * arriba, porque una lámpara de techo abre el cono hacia el suelo.
 *
 * Esto es lo que el 3D NO puede dar. `retro3d.mjs` sombrea por normal de cara —
 * cuánto mira una cara a la luz— y eso da volumen, pero no ilumina el AIRE: en
 * un local en penumbra, la mitad de la sensación de luz está en el haz que se ve
 * flotando, no en la superficie iluminada. Dibujarlo plano encima es lo que
 * hacían las consolas de la época, y sigue siendo lo correcto.
 */
export function pintarHaces(ctx, { aire = [], alto = 0, fuerza = 0.16 } = {}) {
  if (!ctx || !Array.isArray(aire)) return 0;
  let bandas = 0;
  for (const haz of aire) {
    if (haz.tipo !== "haz") continue;
    // El cono cae DESDE el foco proyectado, se abre hacia abajo y se apaga a la
    // vez: si solo se abriera, el suelo saldría más iluminado que la lámpara.
    const largo = Math.min(alto, Math.round(haz.largo));
    for (let i = 0; i < largo; i += 1) {
      const avance = i / largo;
      const medio = Math.round(haz.largo * (0.06 + avance * 0.2));
      const alfa = fuerza * (1 - avance);
      if (alfa <= 0.004) continue;
      const y = Math.round(haz.y + i);
      if (y < 0 || y > alto) continue;
      ctx.fillStyle = velo(CANTINA.lampara, alfa.toFixed(3));
      ctx.fillRect(Math.round(haz.x - medio), y, medio * 2, 1);
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
export function pintarHumo(ctx, { aire = [], ms = 0, fuerza = 0.16 } = {}) {
  if (!ctx || !Array.isArray(aire)) return 0;
  const vetas = aire.filter((pieza) => pieza.tipo === "humo");
  vetas.forEach((veta, i) => {
    // Deriva lenta y de ida y vuelta: el humo se mece, no desfila. Va sobre la
    // posición YA proyectada, así que la veta sigue pegada a su sitio de la
    // sala mientras se mueve.
    const vaiven = Math.sin(ms / (5200 + i * 900)) * veta.largo * 0.12;
    const largo = Math.round(veta.largo);
    const grosor = Math.max(1, Math.round(veta.largo / 22));
    ctx.fillStyle = velo(CANTINA.lampara, (fuerza * (1 - (i % 3) * 0.22)).toFixed(3));
    ctx.fillRect(Math.round(veta.x - largo / 2 + vaiven), Math.round(veta.y), largo, grosor);
  });
  return vetas.length;
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
export function pintarCachivaches(ctx, { anclas = [], ms = 0 } = {}) {
  if (!ctx || !Array.isArray(anclas)) return 0;
  let piezas = 0;

  anclas.forEach((ancla, i) => {
    const escala = Number.isFinite(ancla?.escala) ? ancla.escala : 1;
    const w = Math.max(4, Math.round(18 * escala));
    const h = Math.max(3, Math.round(13 * escala));
    const x = Math.round(ancla.x - w / 2);
    const y = Math.round(ancla.y - h / 2);

    // Cuerpo del cacharro y su marco: dos rectángulos, y ya tiene relieve.
    ctx.fillStyle = CANTINA.nervio;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = CANTINA.pantalla;
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    piezas += 2;
    // Por debajo de este tamaño, el detalle interior es un borrón: el panel se
    // queda como una placa y ya. Es la misma disciplina que el 3D, que descarta
    // las caras sin área en vez de pintarlas.
    if (w < 10 || h < 7) return;

    if (ancla.tipo === "barras") {
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
  });
  return piezas;
}

/**
 * Los rótulos de lo que se puede hacer desde este plano. Es el modelo de GTA V
 * o RDR2: la cámara está autorada, pero lo que puedes hacer desde donde estás
 * está SEÑALADO — no hay que descubrirlo barriendo la pantalla con el ratón.
 *
 * Un punto en su sitio y una pastilla debajo. `fuera` marca lo que no cabe en
 * el cuadro y se ha pegado al borde: se dibuja más apagado, porque «está ahí» y
 * «está por ahí» no son lo mismo y confundirlos manda a la gente a ciegas.
 */
export function pintarOpciones(ctx, { opciones = [], resaltada = null } = {}) {
  if (!ctx || !Array.isArray(opciones)) return 0;
  let pintadas = 0;
  for (const opcion of opciones) {
    const activa = resaltada && opcion.destino === resaltada.destino && opcion.puerta === resaltada.puerta;
    const r = activa ? 5 : 3;
    // Halo: sin él, un punto claro sobre la madera clara desaparece.
    ctx.fillStyle = velo(CANTINA.sombra, 0.5);
    ctx.fillRect(opcion.x - r - 1, opcion.y - r - 1, r * 2 + 3, r * 2 + 3);
    ctx.fillStyle = opcion.fuera ? CANTINA.nervio : CANTINA.lampara;
    ctx.fillRect(opcion.x - r, opcion.y - r, r * 2, r * 2);
    // Y el tallo hacia abajo, que es lo que ata el rótulo al suelo en vez de
    // dejarlo flotando como un icono de interfaz.
    if (!opcion.fuera) {
      ctx.fillStyle = velo(CANTINA.lampara, 0.55);
      ctx.fillRect(opcion.x, opcion.y + r, 1, 8);
    }
    pintadas += 1;
  }
  return pintadas;
}

/**
 * Todas las capas, en el orden en que se pintan. El orden importa: la luz va
 * antes que las líneas (si no, las líneas se comen el halo) y la viñeta va la
 * última, porque tiene que oscurecer también lo que han puesto las demás.
 */
export function pintarCapa2D(ctx, { ancho, alto, semilla = 1, ms = 0, anclas = [], aire = [], opciones = [], resaltada = null } = {}) {
  if (!ctx || !(ancho > 0) || !(alto > 0)) return false;
  pintarLuzAlta(ctx, { ancho, alto });
  // Luz y humo antes que las líneas: si fueran después, la trama se comería el
  // haz y el humo pasaría a ser una mancha con rayas.
  pintarHaces(ctx, { aire, alto });
  pintarHumo(ctx, { aire, ms });
  // Los cachivaches van después de la luz —los baña, no los tapa— y antes del
  // polvo y las líneas, que son lo que los integra con el resto del cuadro.
  pintarCachivaches(ctx, { anclas, ms });
  pintarPolvo(ctx, { ancho, alto, semilla });
  pintarLineas(ctx, { ancho, alto });
  pintarVinieta(ctx, { ancho, alto });
  // Las opciones van LAS ÚLTIMAS: son lo único que no puede quedar tapado por
  // el ambiente. Si el humo se come una salida, la sala deja de ser navegable.
  pintarOpciones(ctx, { opciones, resaltada });
  return true;
}
