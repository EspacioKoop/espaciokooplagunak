// Piel pixelart de los objetos de una sala (#550, sobre #548): columnas,
// mobiliario, cajas de servicio — todo lo que en `crearSalaCaja` es una `caja`
// de un solo color plantada en el suelo.
//
// MISMA REJILLA QUE EL MURO Y QUE LA PUERTA (`CELDA`). Es lo único que hace que
// una sala se lea como UNA nave: si cada superficie elige su tamaño de detalle,
// el conjunto parece un decorado montado con piezas de tres maquetas.
//
// NO TODO OBJETO LLEVA PIEL, y esa es la decisión de diseño de este módulo. La
// cantina sola tiene 126 muebles (#423): vestirlos todos multiplicaría por
// cuatro caras cada botella y cada taburete, para poner dos píxeles en algo que
// mide dos píxeles. Solo se viste lo que es ARQUITECTURA de la sala —lo bastante
// grande como para que se le vea la chapa (`MINIMO_LADO`, `MINIMO_ALTO`)—; lo
// pequeño se queda liso, que a esa escala es lo correcto y no una carencia.
//
// SOLO LAS CARAS VERTICALES. La de arriba casi nunca se ve —la mayoría de estos
// objetos llegan a la cintura o más arriba— y la de abajo no se ve nunca; pintar
// las cuatro laterales ya cuesta cuatro veces lo que una pared del mismo tamaño.
//
// LO QUE DIBUJA NO SE PUEDE LEER (regla de #526, la misma que el mural): cantos,
// un refuerzo a media altura, remaches y una rejilla de ventilación. Una rejilla
// de ventilación no afirma ningún caudal; un piloto encendido sí afirmaría un
// estado, y por eso no hay ninguno. Los objetos que SÍ informan de algo en esta
// nave son las consolas, y esas ya tienen su propio lenguaje.
//
// Puro y sin color propio (#351): todo de `MURAL`.

import { MURAL } from "./paleta.mjs";
import { CELDA, SALIENTE, chapasDeRejilla } from "./nave-mural-pixel.mjs";

/**
 * Qué tiene que medir un objeto para merecer piel. 0.6 m son tres celdas: por
 * debajo de eso el dibujo es un canto arriba, un canto abajo y nada en medio, o
 * sea ruido. Se mide el lado MENOR en horizontal, porque una tabla larguísima y
 * estrecha se ve de canto la mitad del tiempo.
 */
export const MINIMO_LADO = 0.6;
export const MINIMO_ALTO = 0.6;

/** Tope por objeto. Muy por debajo del de un muro: son muchos y pequeños, y el
 *  presupuesto de una sala lo gasta el conjunto, no el peor. */
export const TOPE_OBJETO = 24;

/**
 * El dibujo de una cara de objeto, en celdas. `[fila][columna]`, fila 0 abajo.
 *
 * Sin semilla, por lo mismo que la hoja de una puerta: el mobiliario de una nave
 * es de serie. Lo que rompe la repetición entre dos armarios iguales es que
 * están en sitios distintos, no que uno tenga los remaches torcidos.
 */
export function rejillaObjeto(columnas, filas) {
  const rejilla = Array.from({ length: filas }, () => new Array(columnas).fill(null));
  const poner = (v, u, color) => {
    if (v < 0 || v >= filas || u < 0 || u >= columnas) return;
    rejilla[v][u] = color;
  };

  // 1. El canto de arriba: el borde que coge la luz y separa el objeto del aire.
  //    El de abajo no se pinta — ahí está el suelo, y un canto inferior a ras de
  //    suelo se lee como una sombra mal puesta.
  for (let u = 0; u < columnas; u += 1) poner(filas - 1, u, MURAL.junta);

  // 2. Refuerzo a media altura: le da a la caja un arriba y un abajo. Solo si hay
  //    sitio para que no se pegue al canto.
  const medio = Math.floor(filas / 2);
  if (medio > 0 && medio < filas - 1) {
    for (let u = 0; u < columnas; u += 1) poner(medio, u, MURAL.conducto);
  }

  // 3. Rejilla de ventilación: tres celdas alternas justo debajo del refuerzo, y
  //    solo si la cara es lo bastante ancha para que quepa sin tocar los bordes.
  if (columnas >= 5 && medio - 1 > 0) {
    for (let u = 1; u < columnas - 1; u += 2) poner(medio - 1, u, MURAL.abrazadera);
  }

  // 4. Remaches en las dos esquinas de arriba. Abajo no: no se miran.
  if (filas >= 3) {
    poner(filas - 2, 0, MURAL.remache);
    poner(filas - 2, columnas - 1, MURAL.remache);
  }

  return rejilla;
}

/**
 * Las cuatro caras verticales de una caja, en el formato que entiende
 * `chapasDeRejilla`. Los sentidos salen de las caras equivalentes de `caja` en
 * `nave-sala-caja.mjs`, no de probar cuál se ve.
 */
function carasVerticales([cx, , cz], [ancho, , fondo]) {
  const x0 = cx - ancho / 2;
  const x1 = cx + ancho / 2;
  const z0 = cz - fondo / 2;
  const z1 = cz + fondo / 2;
  return [
    { eje: "x", plano: z0, sentido: -1, u0: x0, largo: ancho },
    { eje: "x", plano: z1, sentido: 1, u0: x0, largo: ancho },
    { eje: "z", plano: x0, sentido: -1, u0: z0, largo: fondo },
    { eje: "z", plano: x1, sentido: 1, u0: z0, largo: fondo },
  ];
}

/**
 * La piel de un objeto-caja, o vacío si no la merece por tamaño.
 *
 * @param {{centro:number[], medidas:number[]}} objeto centro y medidas, tal y
 *   como los declara el `mobiliario` de `crearSalaCaja`.
 * @returns {{malla:object, color:string}[]}
 */
export function piezasPielObjeto({ centro, medidas }) {
  const [ancho, alto, fondo] = medidas;
  if (Math.min(ancho, fondo) < MINIMO_LADO || alto < MINIMO_ALTO) return [];
  const base = centro[1] - alto / 2;
  const filas = Math.floor(alto / CELDA);
  if (filas < 2) return [];

  return carasVerticales(centro, medidas).flatMap((cara) => {
    const columnas = Math.floor(cara.largo / CELDA);
    if (columnas < 2) return [];
    return chapasDeRejilla(cara, rejillaObjeto(columnas, filas), {
      base,
      // Menos saliente que una puerta: un objeto no se mueve por delante de
      // nada, así que basta con ganarle al z-buffer su propia cara.
      saliente: SALIENTE,
      tope: TOPE_OBJETO,
    });
  });
}

/**
 * La piel de un rectángulo de planta que sube del suelo a `altura` — la forma en
 * que `crearSalaCaja` declara sus columnas. Es azúcar sobre `piezasPielObjeto`
 * para no obligar a cada consumidor a convertir esquina+medidas a centro+medidas
 * (que es exactamente el tipo de conversión a mano donde se cuelan los medios).
 */
export function piezasPielColumna(rect, altura) {
  return piezasPielObjeto({
    centro: [rect.x + rect.ancho / 2, altura / 2, rect.z + rect.profundidad / 2],
    medidas: [rect.ancho, altura, rect.profundidad],
  });
}
