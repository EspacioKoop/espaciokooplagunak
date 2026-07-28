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
  const { ancho, alto, poligonos = [] } = escena;

  if (fondo) {
    ctx.fillStyle = fondo;
    ctx.fillRect(0, 0, ancho, alto);
  } else {
    ctx.clearRect(0, 0, ancho, alto);
  }

  for (const poligono of poligonos) {
    const puntos = poligono?.puntos;
    if (!Array.isArray(puntos) || puntos.length < 3) continue;
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
  pintarEscena(ctx, escena, { fondo: opciones.fondo ?? null });
  return escena;
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
