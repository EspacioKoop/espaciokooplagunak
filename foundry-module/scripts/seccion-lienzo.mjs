/* Pintado de la sección de la nave (#427).
 *
 * Es 2D a propósito y no una vista del motor de #362: una sección no gana nada
 * con perspectiva —se lee mejor plana, como un plano— y así entra por el lado
 * del pixel-art que el módulo ya domina, sin pelearse con el rasterizador.
 *
 * Sin estado, sin reloj propio, sin Foundry: recibe un contexto 2D, las medidas
 * y la sección ya compuesta, igual que `retro3d-lienzo.mjs` y `cantina-2d.mjs`.
 * Se prueba con un contexto de mentira.
 *
 * Frontera de arte (#351): no declara ni un color.
 */

import { SECCION, canales } from "./paleta.mjs";
import { COLOR_REGION, colorParaSalud } from "./ship-view/casco-dano.mjs";

/** Grosor del casco alrededor del corte, en píxeles de búfer. */
const CASCO = 6;

function velo(color, alfa) {
  const [r, g, b] = canales(color) ?? canales(SECCION.vacio);
  return `rgba(${r}, ${g}, ${b}, ${alfa})`;
}

/**
 * Conversión celda → píxel. Se calcula una vez y se pasa a todo lo demás para
 * que nadie vuelva a dividir por su cuenta: dos redondeos distintos sobre la
 * misma rejilla es exactamente cómo aparecen las juntas de un píxel.
 */
export function medidas({ ancho, alto, rejilla }) {
  const util = { ancho: Math.max(0, ancho - CASCO * 2), alto: Math.max(0, alto - CASCO * 2) };
  return {
    casco: CASCO,
    celdaAncho: util.ancho / (rejilla?.columnas || 1),
    celdaAlto: util.alto / (rejilla?.filas || 1),
    origenX: CASCO,
    origenY: CASCO,
  };
}

/** La caja de una sala, en píxeles enteros. */
export function cajaEnPixeles(caja, m) {
  const x = Math.round(m.origenX + caja.x * m.celdaAncho);
  const y = Math.round(m.origenY + caja.y * m.celdaAlto);
  const x2 = Math.round(m.origenX + (caja.x + caja.ancho) * m.celdaAncho);
  const y2 = Math.round(m.origenY + (caja.y + caja.alto) * m.celdaAlto);
  return { x, y, ancho: x2 - x, alto: y2 - y };
}

/**
 * De un punto del lienzo a una celda de la rejilla. Es la inversa de `medidas`
 * y vive aquí por lo mismo: quien tenga el ratón no debería saber de `CASCO`.
 */
export function celdaEnPunto({ x, y }, m) {
  return {
    x: (x - m.origenX) / (m.celdaAncho || 1),
    y: (y - m.origenY) / (m.celdaAlto || 1),
  };
}

/** El casco: el marco grueso, y el vacío detrás. */
export function pintarCasco(ctx, { ancho, alto }) {
  if (!ctx) return;
  ctx.fillStyle = SECCION.vacio;
  ctx.fillRect(0, 0, ancho, alto);
  ctx.fillStyle = SECCION.casco;
  ctx.fillRect(0, 0, ancho, alto);
  ctx.fillStyle = SECCION.mamparo;
  ctx.fillRect(CASCO, CASCO, Math.max(0, ancho - CASCO * 2), Math.max(0, alto - CASCO * 2));
}

/**
 * El relleno de una sala. El color lo decide el daño y NADA más: sin lectura se
 * queda en el suelo neutro, y no en un verde que afirmaría que está sana.
 */
export function colorDeSala(salud) {
  if (!Number.isFinite(salud)) return SECCION.sala;
  return colorParaSalud(salud);
}

/**
 * Una sala: relleno, canto, y el realce de que se puede entrar. El realce es un
 * BORDE y no un tinte del relleno porque el relleno ya lo manda el daño — dos
 * significados en el mismo píxel es cómo se vuelve ilegible un plano.
 */
export function pintarSala(ctx, sala, m, { foco = false } = {}) {
  if (!ctx) return null;
  const caja = cajaEnPixeles(sala.caja, m);
  ctx.fillStyle = colorDeSala(sala.salud);
  ctx.fillRect(caja.x, caja.y, caja.ancho, caja.alto);

  // Una sala dañada además se raya: el color solo no vale si quien mira no
  // distingue el ámbar del verde, y una trama sí se ve en escala de grises.
  if (Number.isFinite(sala.salud) && colorParaSalud(sala.salud) !== COLOR_REGION.estable) {
    ctx.fillStyle = velo(SECCION.vacio, 0.18);
    for (let y = caja.y + 1; y < caja.y + caja.alto; y += 3) {
      ctx.fillRect(caja.x + 1, y, Math.max(0, caja.ancho - 2), 1);
    }
  }

  ctx.fillStyle = sala.destino ? SECCION.entrable : SECCION.salaBorde;
  ctx.fillRect(caja.x, caja.y, caja.ancho, 1);
  ctx.fillRect(caja.x, caja.y + caja.alto - 1, caja.ancho, 1);
  ctx.fillRect(caja.x, caja.y, 1, caja.alto);
  ctx.fillRect(caja.x + caja.ancho - 1, caja.y, 1, caja.alto);

  if (foco) {
    ctx.fillStyle = velo(SECCION.foco, 0.22);
    ctx.fillRect(caja.x + 1, caja.y + 1, Math.max(0, caja.ancho - 2), Math.max(0, caja.alto - 2));
  }
  return caja;
}

/** El rótulo de la sala, dentro de su caja. */
export function pintarRotulo(ctx, texto, caja) {
  if (!ctx || !texto) return;
  ctx.fillStyle = SECCION.rotulo;
  if (typeof ctx.fillText !== "function") return;
  ctx.fillText(texto, caja.x + 4, caja.y + 11);
}

/**
 * La tripulación de una sala: un punto por persona, en fila y a ras de suelo.
 * Un punto y no un retrato porque a este tamaño un retrato es una mancha, y
 * porque quién está dónde se responde contando, no reconociendo caras.
 */
export function pintarTripulacion(ctx, gente, caja) {
  if (!ctx || !Array.isArray(gente) || gente.length === 0) return 0;
  ctx.fillStyle = SECCION.tripulante;
  const base = caja.y + caja.alto - 5;
  let pintados = 0;
  for (let i = 0; i < gente.length; i += 1) {
    const x = caja.x + 4 + i * 5;
    if (x + 3 > caja.x + caja.ancho - 2) break; // No se sale de su sala.
    ctx.fillRect(x, base, 3, 3);
    pintados += 1;
  }
  return pintados;
}

/**
 * El cuadro entero. Devuelve las cajas en píxeles de cada sala para que quien
 * tenga el ratón pueda resolver un clic sin repetir la aritmética.
 */
export function pintarSeccion(ctx, seccion, { ancho, alto, foco = null, tripulacion = {}, rotulo = () => "" } = {}) {
  if (!ctx) return { cajas: {} };
  const m = medidas({ ancho, alto, rejilla: seccion?.rejilla });
  pintarCasco(ctx, { ancho, alto });

  const cajas = {};
  for (const sala of seccion?.salas ?? []) {
    const caja = pintarSala(ctx, sala, m, { foco: foco === sala.id });
    cajas[sala.id] = caja;
    pintarRotulo(ctx, rotulo(sala), caja);
    pintarTripulacion(ctx, tripulacion[sala.id], caja);
  }
  return { cajas, medidas: m };
}
