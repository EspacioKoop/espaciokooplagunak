/**
 * Pintor del mapa vivo sobre un contexto 2D de <canvas>. Recibe el «frame»
 * calculado por `componerFrame` (ventana-nave.mjs) y solo dibuja: no consulta
 * la red, no conoce Foundry ni mantiene estado propio.
 *
 * ACOPLADO AL CANVAS: este archivo no se prueba en Node (no hay contexto 2D
 * real); su verificación es humana, en un Foundry de verdad, como el resto del
 * render del módulo (ver README del módulo, «Estado de verificación»).
 *
 * Estética Neo Geo: resolución interna baja (320×320 escalado con
 * image-rendering: pixelated), fillRect sin antialias para los blips, colores
 * saturados de PALETA_FACCIONES y parpadeo de fase fija.
 */

import { COLOR_JUGADOR } from "./ventana-nave.mjs";
import { clasificarNave, construirSpriteNave, dibujarNaveSprite } from "./nave-sprite.mjs";
import { dibujarDecorado } from "./decorado-fondo.mjs";

const FONDO = "#03071e"; // azul-negro profundo
const RETICULA = "rgba(125, 133, 151, 0.25)"; // gris azulado tenue
const TAM_ESTRELLA_MIN = 1;
const COLOR_DESTINO = "#ffd166"; // ámbar cálido: la ruta no compite con las facciones
const RUTA_DESTINO = "rgba(255, 209, 102, 0.55)";

// Los tres niveles de `proyeccion-puesto.mjs`, traducidos a opacidad. `tenue` no
// baja de 0.3: por debajo desaparece, y la vista de un puesto no puede hacer que
// un contacto deje de existir para quien mira.
const OPACIDAD_ENFASIS = Object.freeze({ alto: 1, normal: 0.75, tenue: 0.3 });
const VECTOR_LARGO_FIJO = 0.45; // sin velocidad máxima publicada
const CALOR_FRIO = "rgba(56, 176, 0, 0.75)";
const CALOR_CRITICO = "rgba(239, 35, 60, 0.85)";

/**
 * Pinta un frame completo. `frame` es la salida de componerFrame; con
 * `sinDatos` se pinta solo el fondo y la retícula (pantalla «en espera»).
 */
export function dibujarFrame(
  ctx,
  frame,
  {
    ancho = 320,
    alto = 320,
    decorado = [],
    cacheDecorado = null,
    eventosFondo = [],
    moviendo = false,
    tMs = 0,
    // Proyección del puesto que mira (#331, paso 2). Es opcional y, sin ella,
    // el mapa se pinta exactamente como antes: la vista no es un modo aparte,
    // es una lectura del mismo frame. El pintor NO decide qué se resalta —eso
    // ya viene decidido y probado en `proyeccion-puesto.mjs`—; aquí solo se
    // traduce `enfasis` a opacidad y se dibujan las capas que la vista pida.
    vista = null,
  } = {},
) {
  ctx.imageSmoothingEnabled = false;

  // Fondo.
  ctx.fillStyle = FONDO;
  ctx.fillRect(0, 0, ancho, alto);

  // Decorado de fondo (issue #203): nebulosas/planetas/asteroides con parallax,
  // ya compuesto por el llamador, entre el fondo y las estrellas. En la pantalla
  // «en espera» el llamador pasa una lista vacía para el decorado, pero los
  // eventos de fondo (issue #215 review) son un parámetro aparte que puede
  // seguir activo aunque no haya datos de la nave: se fuerzan vacíos aquí para
  // no dibujar sucesos ficticios (p. ej. una nave lejana) sobre la espera.
  dibujarDecorado(ctx, decorado, {
    ancho,
    alto,
    tMs,
    cache: cacheDecorado,
    eventos: frame.sinDatos ? [] : eventosFondo,
  });

  // Estrellas por capa, teseladas: cada estrella se pinta desplazada por el
  // offset de su capa y envuelta al lienzo; las que quedan a caballo del borde
  // se duplican al otro lado para que no haya costura al hacer parallax.
  for (const capa of frame.capas ?? []) {
    for (const e of capa.estrellas) {
      const x = (e.x + capa.dx) % ancho;
      const y = (e.y + capa.dy) % alto;
      const tam = Math.max(TAM_ESTRELLA_MIN, Math.round(e.r));
      ctx.fillStyle = `rgba(253, 255, 252, ${e.brillo})`;
      ctx.fillRect(Math.round(x), Math.round(y), tam, tam);
      // Duplicados de borde (solo cuando hace falta).
      if (x + tam > ancho) ctx.fillRect(Math.round(x - ancho), Math.round(y), tam, tam);
      if (y + tam > alto) ctx.fillRect(Math.round(x), Math.round(y - alto), tam, tam);
    }
  }

  // Retícula: anillo de alcance y cruz del centro.
  const cx = ancho / 2;
  const cy = alto / 2;
  const radio = Math.min(ancho, alto) / 2 - 2;
  ctx.strokeStyle = RETICULA;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, radio, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy);
  ctx.lineTo(cx + 6, cy);
  ctx.moveTo(cx, cy - 6);
  ctx.lineTo(cx, cy + 6);
  ctx.stroke();

  if (frame.sinDatos) return;

  // Ruta al destino (issue #175): línea nave→destino bajo los blips, para
  // que ningún contacto quede tapado por la decoración de la ruta.
  if (frame.destino) {
    ctx.strokeStyle = RUTA_DESTINO;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]); // punteado retro
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(Math.round(frame.destino.x), Math.round(frame.destino.y));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Blips de contactos. La rotación de cabina (morro arriba) ya viene aplicada
  // en las coordenadas del frame; aquí solo se pintan cuadrados.
  for (const blip of vista?.blips ?? frame.blips ?? []) {
    if (blip.esJugador) continue; // la nave propia se pinta al final, encima
    if (!blip.parpadeo) continue; // fase apagada del parpadeo retro
    // Atenuar no es ocultar: un contacto en `tenue` sigue estando ahí y sigue
    // pudiéndose pinchar. Lo que cambia es a qué presta atención la vista.
    ctx.globalAlpha = OPACIDAD_ENFASIS[blip.enfasis] ?? 1;
    if (blip.dentro) {
      // Sprite pixel-art por tipo/facción en vez de un cuadrado (Neo Geo).
      dibujarNaveSprite(
        ctx,
        construirSpriteNave({ clave: clasificarNave(blip, false), color: blip.color }),
        { centroX: blip.x, centroY: blip.y, pixel: 3 },
      );
    } else {
      // Fuera de alcance: marca en el borde del anillo, hacia el contacto.
      const a = Math.atan2(blip.y - cy, blip.x - cx);
      const bx = cx + Math.cos(a) * radio;
      const by = cy + Math.sin(a) * radio;
      ctx.fillStyle = blip.color;
      ctx.fillRect(Math.round(bx - 2), Math.round(by - 2), 4, 4);
    }
    // Etiqueta de comunicaciones: solo si la proyección la dio. Sin dato no hay
    // etiqueta, y aquí no se inventa un «?» que se leería como información.
    if (blip.etiqueta && blip.dentro) {
      ctx.font = "8px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = blip.color;
      ctx.fillText(blip.etiqueta, Math.round(blip.x) + 7, Math.round(blip.y));
    }
    ctx.globalAlpha = 1;
  }

  // Capas propias de la vista, entre los contactos y la nave propia: nunca por
  // encima de la nave, que es la referencia que no se puede tapar.
  dibujarCapasDeVista(ctx, vista, { cx, cy, radio, ancho });

  // Marca del destino: rombo ámbar con su nombre (issue #175). Dentro del
  // visor va sobre el punto real; fuera, recortado al anillo en su dirección
  // (frame.destino.x/y ya vienen recortados) y sin nombre, como las marcas de
  // borde de los contactos.
  if (frame.destino) {
    const dx = Math.round(frame.destino.x);
    const dy = Math.round(frame.destino.y);
    ctx.fillStyle = COLOR_DESTINO;
    ctx.beginPath();
    ctx.moveTo(dx, dy - 4);
    ctx.lineTo(dx + 4, dy);
    ctx.lineTo(dx, dy + 4);
    ctx.lineTo(dx - 4, dy);
    ctx.closePath();
    ctx.fill();
    if (frame.destino.dentro) {
      ctx.font = "8px monospace";
      ctx.textAlign = dx > ancho - 48 ? "right" : "left";
      ctx.textBaseline = "middle";
      ctx.fillText(frame.destino.nombre, dx + (dx > ancho - 48 ? -6 : 6), dy);
    }
  }

  // Nave propia: sprite pixel-art con el morro hacia arriba (la rotación del
  // mundo ya la hizo la proyección; en cabina el morro siempre apunta arriba).
  dibujarNaveSprite(
    ctx,
    construirSpriteNave({ clave: clasificarNave(null, true), color: COLOR_JUGADOR }),
    { centroX: cx, centroY: cy, pixel: 4, moviendo, tMs },
  );
}

/**
 * Anillos, vector y superposición térmica. Cada capa se dibuja solo si la
 * proyección la trae: el pintor no elige, obedece.
 */
function dibujarCapasDeVista(ctx, vista, { cx, cy, radio, ancho }) {
  if (!vista) return;

  // Sensores: anillos de escala. Salen del alcance del propio visor, no de una
  // distancia inventada.
  for (const anillo of vista.anillos ?? []) {
    ctx.strokeStyle = RETICULA;
    ctx.globalAlpha = anillo.tenue ? 0.6 : 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radio * anillo.radio01, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Navegación: el morro va siempre arriba en cabina, así que el vector se
  // dibuja hacia arriba y lo que informa es su largo. `magnitud01` en null
  // significa «hay velocidad pero no contra qué compararla»: largo fijo, que no
  // pretende ser una fracción de nada.
  if (vista.vector) {
    const fraccion = vista.vector.magnitud01 ?? VECTOR_LARGO_FIJO;
    ctx.strokeStyle = COLOR_JUGADOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy - radio * fraccion);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  // Ingeniería: barras de calor en una esquina. Los sistemas sin lectura no
  // aparecen —no son barras de cero— y por eso la superposición trae su lista
  // aparte: quien la consuma en texto puede decirlo, el mapa simplemente calla.
  const filas = vista.superposicion?.filas ?? [];
  const alto_barra = 4;
  filas.forEach((fila, i) => {
    const y = 8 + i * (alto_barra + 3);
    const largo = Math.round((ancho / 4) * fila.valor01);
    ctx.fillStyle = fila.critico ? CALOR_CRITICO : CALOR_FRIO;
    ctx.fillRect(8, y, Math.max(1, largo), alto_barra);
  });
}
