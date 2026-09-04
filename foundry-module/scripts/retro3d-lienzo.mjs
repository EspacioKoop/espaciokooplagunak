// Pintor del 3D retro (#362, rebanada 2): lo único que toca un lienzo.
//
// `retro3d.mjs` produce polígonos y no dibuja nada, igual que `ventana-nave.mjs`
// separa el cálculo del <canvas>. Aquí está la otra mitad, y es a propósito la
// pieza más tonta del módulo: si el dibujo se complica, el error casi siempre
// está en la geometría y conviene poder descartarlo mirando quince líneas.
//
// LA RESOLUCIÓN INTERNA ES EL EFECTO. Se pinta en un búfer pequeño y se estira
// con `image-rendering: pixelated` desde el CSS. No se dibuja «pixelado» a
// tamaño grande: se dibuja pequeño de verdad y se amplía, que es lo que hacía la
// consola y lo que hace que el ajuste de vértices a rejilla se note.
//
// No importa Foundry: recibe un contexto 2D y ya está. Eso lo hace probable en
// Node con un contexto de mentira, que es como está cubierto.

import { componerEscena } from "./retro3d.mjs";
import { campoEstelar, estrellasEpoca, proyectarEstrellas } from "./retro3d-estrellas.mjs";
import { canales } from "./paleta.mjs";

/**
 * Vuelca una escena ya compuesta en un contexto 2D.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{poligonos: Array, ancho: number, alto: number}} escena
 * @param {{fondo?: string|null}} opciones `fondo` null deja el lienzo
 *   transparente, para superponerlo sobre lo que ya haya debajo.
 */
export function pintarEscena(ctx, escena, { fondo = null } = {}) {
  if (!ctx || !escena) return 0;
  const { ancho, alto, poligonos = [], estrellas = [] } = escena;

  if (fondo) {
    ctx.fillStyle = fondo;
    ctx.fillRect(0, 0, ancho, alto);
  } else {
    ctx.clearRect(0, 0, ancho, alto);
  }

  // El cielo va después de limpiar y antes de la nave: es lo único que puede
  // quedar tapado por todo lo demás. Cuadrados y no círculos —un `arc` a esta
  // resolución da un borrón gris de tres píxeles en vez de una estrella.
  for (const estrella of estrellas) {
    ctx.fillStyle = estrella.color;
    ctx.fillRect(estrella.x, estrella.y, estrella.tam, estrella.tam);
  }

  for (const poligono of poligonos) {
    const puntos = poligono?.puntos;
    if (!Array.isArray(puntos) || puntos.length < 3) continue;
    // Alfa por polígono (#556). El motor no lo tenía y casi nada lo necesita: una
    // caja opaca es opaca. Lo pide el CONO de luz de una luminaria, que si fuera
    // opaco taparía el suelo que dice estar iluminando — un haz que oculta lo que
    // alumbra no se lee como luz, se lee como un objeto colgando.
    //
    // Va aquí y no en `componerEscena` porque es cómo se PINTA, no cómo se
    // compone. Sin `alpha` declarado no se toca `globalAlpha`, así que ni una
    // escena existente cambia.
    const alfa = Number.isFinite(poligono.alpha) ? Math.max(0, Math.min(1, poligono.alpha)) : 1;
    if (alfa === 0) continue;
    ctx.globalAlpha = alfa;
    ctx.beginPath();
    ctx.moveTo(puntos[0].x, puntos[0].y);
    for (let i = 1; i < puntos.length; i += 1) ctx.lineTo(puntos[i].x, puntos[i].y);
    ctx.closePath();
    ctx.fillStyle = poligono.color;
    ctx.fill();
    // Se contornea cada cara con su propio color. Sin esto quedan costuras del
    // ancho de un píxel entre polígonos vecinos —el antialias del navegador no
    // llega a cubrir la junta— y a resolución baja una costura es un arañazo
    // que cruza la nave entera.
    ctx.strokeStyle = poligono.color;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return poligonos.length;
}

// ---- Pintor con z-buffer real (#510) ---------------------------------------
//
// `pintarEscena` (arriba) pinta por PINTOR: sin z-buffer, el orden es el
// único algoritmo de visibilidad que hay, y dos caras a profundidades casi
// iguales pueden invertir ese orden con el temblor de cámara de un fotograma
// al siguiente — el parpadeo de #510. Ya se intentó "arreglar el orden"
// (un margen de tolerancia con sort estable) y salió PEOR: el orden con el
// que se declaran las piezas no tiene por qué acercarse al orden real de
// profundidad, así que "estabilizar" ese orden solo congela un error en vez
// de evitarlo a veces.
//
// La respuesta correcta no es ordenar mejor: es no necesitar orden. Un
// z-buffer de verdad compara, PÍXEL A PÍXEL, la profundidad interpolada de
// cada triángulo contra lo que ya hay pintado ahí — el resultado no depende
// de en qué orden lleguen los polígonos, así que no hay nada que pueda
// desestabilizarse con un temblor de cámara.
//
// OPT-IN, no sustituye a `pintarEscena`: las cámaras fijas de la cantina
// (#423, `cantina-planos.mjs`) y el resto de superficies existentes siguen
// con el pintor de siempre, sin ningún riesgo de regresión — esto solo lo usa
// quien lo pida explícitamente (hoy, `nave-movimiento-lienzo.mjs`, el bucle
// de "andar por la nave" donde se reportó el parpadeo).

/** Interpolación PERSPECTIVE-CORRECT: 1/z (no z) es lo que varía linealmente
 *  en el espacio de pantalla para una superficie plana, así que se interpola
 *  1/z con los mismos pesos baricéntricos que x/y y NUNCA z directamente
 *  —eso daría una profundidad con curvatura incorrecta—. Comparar por 1/z
 *  funciona igual de bien que comparar por z (más cerca = 1/z más grande) y
 *  ahorra la división final: el propio búfer de profundidad guarda 1/z. */
function areaConSigno2(ax, ay, bx, by, cx, cy) {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

/**
 * Muestrea un téxel de una textura indexada, con envoltura (`repeat`).
 *
 * SIN FILTRADO, Y ES EL EFECTO. Se coge el téxel más cercano y ya: el filtrado
 * bilineal es de la generación siguiente, y suavizar aquí borraría exactamente
 * lo que hace que una textura se lea como de la época. Es el mismo criterio que
 * `image-rendering: pixelated` en la superficie.
 *
 * La envoltura es con `((n % m) + m) % m` y no con `n % m`: en JavaScript el
 * resto de un negativo es negativo, y una UV por debajo de cero —que sale sola
 * en cuanto una cara se recorta— indexaría fuera del búfer.
 */
/**
 * ¿Es la textura estructuralmente utilizable? Se comprueba UNA vez por polígono,
 * no por téxel, y cierra la entrada al camino texturado en vez de dejar que
 * `muestrearTextura` haga `% 0` y lea una posición inválida.
 *
 * Es la misma degradación deliberada que ya se aplica con UV no finitas y con
 * índices fuera de paleta: textura inválida → color plano de la cara.
 */
export function texturaUtilizable(textura) {
  if (!textura) return false;
  const { ancho, alto, indices } = textura;
  if (!Number.isInteger(ancho) || !Number.isInteger(alto) || ancho <= 0 || alto <= 0) return false;
  return indices != null && indices.length >= ancho * alto;
}

export function muestrearTextura(textura, u, v) {
  const { ancho, alto, indices } = textura;
  const x = Math.floor(u * ancho);
  const y = Math.floor(v * alto);
  const xa = ((x % ancho) + ancho) % ancho;
  const ya = ((y % alto) + alto) % alto;
  return indices[ya * ancho + xa];
}

/** Rasteriza UN triángulo (perspective-correct, ver arriba) contra el búfer
 *  de profundidad compartido, con prueba de profundidad por píxel: solo
 *  escribe donde su 1/z es mayor (más cerca) que lo que ya hay ahí.
 *
 *  Con `tex` rasteriza TEXTURADO. El interpolado de UV depende de la época y no
 *  es un ajuste de calidad, es la época (#573):
 *
 *  - **PSX: afín.** Se interpolan `u,v` linealmente en pantalla, SIN dividir por
 *    z. Eso deforma la textura cuando un polígono se ve muy inclinado — el
 *    famoso bamboleo de la PSX, que no era un fallo del juego sino que la
 *    consola no tenía división por píxel. Reproducirlo es el objetivo, igual que
 *    el temblor de vértices que ya hace `rejilla`.
 *  - **GameCube: perspectiva corregida.** Se interpolan `u/z` y `v/z` y se
 *    divide por el `1/z` que ya se calcula para el z-buffer. Coste: una división
 *    por píxel, que es justo lo que aquella máquina sí podía pagar.
 */
function rasterizarTriangulo(pixeles, profundidades, ancho, alto, p0, p1, p2, r, g, b, tex) {
  const area = areaConSigno2(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y);
  if (area === 0) return; // degenerado: los tres puntos en línea, sin superficie que pintar

  const minX = Math.max(0, Math.floor(Math.min(p0.x, p1.x, p2.x)));
  const maxX = Math.min(ancho - 1, Math.ceil(Math.max(p0.x, p1.x, p2.x)));
  const minY = Math.max(0, Math.floor(Math.min(p0.y, p1.y, p2.y)));
  const maxY = Math.min(alto - 1, Math.ceil(Math.max(p0.y, p1.y, p2.y)));
  if (minX > maxX || minY > maxY) return; // el triángulo cae fuera del lienzo

  const invArea = 1 / area;
  // z<=0 no debería llegar aquí (recortarCercano ya lo impide), pero un 1/z
  // de un z basura no puede colar un NaN al búfer de profundidad compartido.
  const invZ0 = p0.z > 0 ? 1 / p0.z : 0;
  const invZ1 = p1.z > 0 ? 1 / p1.z : 0;
  const invZ2 = p2.z > 0 ? 1 / p2.z : 0;

  for (let y = minY; y <= maxY; y += 1) {
    const py = y + 0.5;
    for (let x = minX; x <= maxX; x += 1) {
      const px = x + 0.5;
      // Pesos baricéntricos del píxel, con el mismo signo que `area`: los
      // tres tienen que coincidir en signo (o ser cero) para estar dentro.
      const w0 = areaConSigno2(p1.x, p1.y, p2.x, p2.y, px, py) * invArea;
      const w1 = areaConSigno2(p2.x, p2.y, p0.x, p0.y, px, py) * invArea;
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;

      const invZ = w0 * invZ0 + w1 * invZ1 + w2 * invZ2;
      const indice = y * ancho + x;
      if (invZ <= profundidades[indice]) continue; // algo más cerca ya está ahí
      profundidades[indice] = invZ;
      const o = indice * 4;

      if (tex) {
        let u;
        let v;
        if (tex.afin) {
          // PSX: lineal en pantalla, sin dividir. La deformación ES el efecto.
          u = w0 * p0.u + w1 * p1.u + w2 * p2.u;
          v = w0 * p0.v + w1 * p1.v + w2 * p2.v;
        } else {
          // GameCube: u/z y v/z sí varían linealmente en pantalla; se dividen
          // por el 1/z ya interpolado para volver a u,v.
          const uz = w0 * p0.u * invZ0 + w1 * p1.u * invZ1 + w2 * p2.u * invZ2;
          const vz = w0 * p0.v * invZ0 + w1 * p1.v * invZ1 + w2 * p2.v * invZ2;
          u = invZ > 0 ? uz / invZ : 0;
          v = invZ > 0 ? vz / invZ : 0;
        }
        const rgb = tex.paletaRGB[muestrearTextura(tex.textura, u, v)];
        if (rgb) {
          // Téxel POR intensidad de la cara: el sombreado no se puede
          // premultiplicar en un color único cuando cada téxel es distinto.
          pixeles[o] = rgb[0] * tex.intensidad;
          pixeles[o + 1] = rgb[1] * tex.intensidad;
          pixeles[o + 2] = rgb[2] * tex.intensidad;
          pixeles[o + 3] = 255;
          continue;
        }
        // Índice fuera de paleta: se cae al color plano de la cara en vez de
        // pintar basura o de no pintar —un agujero en un muro se lee como un
        // fallo de geometría y manda a buscar el error donde no está.
      }

      pixeles[o] = r;
      pixeles[o + 1] = g;
      pixeles[o + 2] = b;
      pixeles[o + 3] = 255;
    }
  }
}

/** Abanico desde el primer vértice: válido para cualquier polígono CONVEXO,
 *  que es todo lo que compone `retro3d.mjs` (caras de cajas, siempre
 *  convexas incluso recortadas contra un plano). */
function paraCadaTrianguloDelAbanico(puntos, fn) {
  for (let i = 1; i + 1 < puntos.length; i += 1) fn(puntos[0], puntos[i], puntos[i + 1]);
}

// Los búferes se reutilizan entre fotogramas, por tamaño de lienzo: son
// arrays típicos de un puñado de cientos de KB (480×270×4 bytes ronda medio
// MB) y reservarlos sesenta veces por segundo sería tirar memoria sin
// necesidad, igual que ya hace `cielos` unas líneas más abajo con el campo
// estelar.
const buferes = new Map();

function buferesDe(ancho, alto) {
  const clave = `${ancho}x${alto}`;
  let b = buferes.get(clave);
  if (!b) {
    b = { pixeles: new Uint8ClampedArray(ancho * alto * 4), profundidades: new Float32Array(ancho * alto) };
    buferes.set(clave, b);
  }
  return b;
}

// La paleta de una textura, resuelta a canales UNA vez por textura y no por
// píxel. Sin esto, un muro de 100×100 téxeles vuelve a parsear el mismo puñado
// de hexadecimales diez mil veces por fotograma. `WeakMap` y no `Map` porque la
// clave es la propia textura: si la superficie la deja de usar, se recoge sola
// en vez de quedarse viva por estar cacheada.
const paletasRGB = new WeakMap();

function paletaRGBDe(textura) {
  let tabla = paletasRGB.get(textura);
  if (!tabla) {
    const paleta = Array.isArray(textura?.paleta) ? textura.paleta : [];
    tabla = paleta.map((color) => {
      const c = canales(color);
      return c ? [c[0] * 255, c[1] * 255, c[2] * 255] : null;
    });
    paletasRGB.set(textura, tabla);
  }
  return tabla;
}

const coloresRGB = new Map();

/** Canales 0-255 de un color, con caché: se repite mucho el mismo color
 *  (todas las caras de un muro) y volver a parsear el mismo hexadecimal cada
 *  vez sería trabajo tirado. */
function rgbDe(color) {
  let rgb = coloresRGB.get(color);
  if (!rgb) {
    const c = canales(color);
    rgb = c ? [Math.round(c[0] * 255), Math.round(c[1] * 255), Math.round(c[2] * 255)] : [255, 0, 255];
    coloresRGB.set(color, rgb);
  }
  return rgb;
}

/**
 * Vuelca una escena con un z-buffer real: cada triángulo se compara PÍXEL A
 * PÍXEL contra lo que ya hay pintado, así que el resultado no depende de en
 * qué orden lleguen los polígonos — a diferencia de `pintarEscena`, que
 * pinta por orden y por eso puede parpadear cuando dos caras están casi a la
 * misma profundidad (#510).
 *
 * @param {CanvasRenderingContext2D} ctx necesita `putImageData`, no solo
 *   `fillRect`/`fill` — es la diferencia con `pintarEscena`.
 * @param {{poligonos: Array, ancho: number, alto: number}} escena
 * @param {{fondo?: string|null}} opciones `fondo` null pinta negro: un
 *   z-buffer no tiene "no pintar nada", cada píxel se decide una vez.
 */
export function pintarEscenaConProfundidad(ctx, escena, { fondo = null } = {}) {
  if (!ctx?.putImageData || !escena) return 0;
  const { ancho, alto, poligonos = [], estrellas = [] } = escena;
  if (!(ancho > 0) || !(alto > 0)) return 0;

  const { pixeles, profundidades } = buferesDe(ancho, alto);
  profundidades.fill(0); // 0 = "infinitamente lejos": cualquier 1/z real (z finito y positivo) le gana

  const [fr, fg, fb] = fondo ? rgbDe(fondo) : [0, 0, 0];
  for (let i = 0; i < pixeles.length; i += 4) {
    pixeles[i] = fr;
    pixeles[i + 1] = fg;
    pixeles[i + 2] = fb;
    pixeles[i + 3] = 255;
  }

  // El cielo se pinta directo, sin pasar por el z-buffer: no tiene una
  // profundidad de verdad (son puntos "en el infinito", ver
  // `retro3d-estrellas.mjs`) y cualquier polígono con profundidad real debe
  // poder tapar una estrella sin depender de en qué orden se pinten.
  for (const estrella of estrellas) {
    const x = Math.floor(estrella.x);
    const y = Math.floor(estrella.y);
    const [r, g, b] = rgbDe(estrella.color);
    for (let dx = 0; dx < estrella.tam; dx += 1) {
      for (let dy = 0; dy < estrella.tam; dy += 1) {
        const px = x + dx, py = y + dy;
        if (px < 0 || px >= ancho || py < 0 || py >= alto) continue;
        const o = (py * ancho + px) * 4;
        pixeles[o] = r;
        pixeles[o + 1] = g;
        pixeles[o + 2] = b;
        pixeles[o + 3] = 255;
      }
    }
  }

  // La época decide el interpolado de UV, y viene en la escena. Se lee UNA vez
  // por volcado en vez de por polígono: es la misma para toda la escena.
  const afin = escena.epoca !== "gamecube";

  for (const poligono of poligonos) {
    const puntos = poligono?.puntos;
    if (!Array.isArray(puntos) || puntos.length < 3) continue;
    const [r, g, b] = rgbDe(poligono.color);
    // Solo se textura si la textura es estructuralmente utilizable Y todos los
    // puntos traen UV: un abanico con un vértice sin coordenadas —o una textura
    // con `ancho: 0`— produciría `NaN` y una franja de basura, y prefiero un
    // muro liso a un muro roto.
    const tex =
      texturaUtilizable(poligono.textura) &&
      puntos.every((p) => Number.isFinite(p?.u) && Number.isFinite(p?.v))
        ? {
            textura: poligono.textura,
            paletaRGB: paletaRGBDe(poligono.textura),
            intensidad: Number.isFinite(poligono.intensidad) ? poligono.intensidad : 1,
            afin,
          }
        : null;
    paraCadaTrianguloDelAbanico(puntos, (p0, p1, p2) => {
      rasterizarTriangulo(pixeles, profundidades, ancho, alto, p0, p1, p2, r, g, b, tex);
    });
  }

  const ImageDataCtor = globalThis.ImageData;
  const imagen = ImageDataCtor ? new ImageDataCtor(pixeles, ancho, alto) : { data: pixeles, width: ancho, height: alto };
  ctx.putImageData(imagen, 0, 0);
  return poligonos.length;
}

/**
 * Compone y pinta de una vez. Es lo que usa la superficie: el tamaño del búfer
 * sale del propio lienzo, así que nadie tiene que mantener dos números
 * sincronizados a mano.
 */
export function pintarNave(lienzo, opciones = {}) {
  const ctx = lienzo?.getContext?.("2d");
  if (!ctx) return null;
  const escena = componerEscena(opciones.malla, {
    ...opciones,
    ancho: lienzo.width,
    alto: lienzo.height,
  });
  // Fondo estelar (#384): opcional y apagado si nadie lo pide, porque no todas
  // las superficies quieren cielo —una lámina de reconocimiento sobre fondo
  // limpio se lee mejor que una con purpurina detrás, y esa es decisión de la
  // superficie y no del pintor.
  if (opciones.cielo) {
    escena.estrellas = proyectarEstrellas(cieloDe(opciones.cielo, escena.epoca), {
      ...opciones,
      epoca: escena.epoca,
      ancho: escena.ancho,
      alto: escena.alto,
    });
  }
  pintarEscena(ctx, escena, { fondo: opciones.fondo ?? null });
  return escena;
}

// El cielo se genera UNA vez por semilla y época y se guarda. Los puntos no
// cambian nunca —lo que cambia es la cámara, y eso se recalcula igual en cada
// fotograma—, así que resortearlos sesenta veces por segundo sería tirar trabajo
// para obtener exactamente el mismo cielo. La clave lleva la época porque la
// densidad depende de ella.
const cielos = new Map();

function cieloDe(peticion, epoca) {
  const semilla = Number(peticion?.semilla) || 0;
  const cantidad = Number(peticion?.cantidad) || estrellasEpoca(epoca).cantidad;
  const clave = `${epoca}:${semilla}:${cantidad}`;
  let campo = cielos.get(clave);
  if (!campo) {
    campo = campoEstelar(semilla, { cantidad, radio: peticion?.radio });
    cielos.set(clave, campo);
  }
  return campo;
}

/**
 * Bucle de giro con freno de mano.
 *
 * `prefers-reduced-motion` NO se consulta una vez al arrancar: alguien puede
 * cambiar la preferencia del sistema con la ventana abierta, y quedarse con la
 * nave girando después de pedir que no lo haga es exactamente el fallo que la
 * preferencia existe para evitar. Con la preferencia puesta se pinta UN
 * fotograma —la nave sigue ahí, quieta— en vez de no pintar nada.
 *
 * Devuelve la función de parada; llamarla dos veces no hace daño.
 */
export function girarNave(lienzo, opciones = {}) {
  const {
    vueltaMs = 18000,
    ahora = () => globalThis.performance?.now?.() ?? Date.now(),
    pedirFotograma = (fn) => globalThis.requestAnimationFrame?.(fn),
    cancelarFotograma = (id) => globalThis.cancelAnimationFrame?.(id),
    movimientoReducido = () =>
      Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches),
  } = opciones;

  let id = null;
  let vivo = true;
  const inicio = ahora();

  const paso = () => {
    if (!vivo) return;
    const quieto = movimientoReducido();
    const yaw = quieto ? (opciones.yaw ?? 0) : ((ahora() - inicio) / vueltaMs) * Math.PI * 2;
    pintarNave(lienzo, { ...opciones, yaw });
    // Con movimiento reducido no se encadena otro fotograma: se ha pintado la
    // pose fija y no hay nada más que hacer hasta que alguien vuelva a llamar.
    if (!quieto) id = pedirFotograma(paso);
  };

  paso();
  return () => {
    vivo = false;
    if (id != null) cancelarFotograma(id);
    id = null;
  };
}
