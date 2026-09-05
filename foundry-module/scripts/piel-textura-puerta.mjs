// La piel de la hoja de una puerta como TEXTURA, no como geometría (#458,
// sobre #550/#584).
//
// MISMO MOTIVO QUE EL MURO (`piel-textura.mjs`): en geometría, la hoja se
// dibuja con chapas del tamaño de `CELDA` (10 cm) vía `chapasDeRejilla` — barato
// de calcular, caro de DIBUJAR (cada puerta abierta suma sus propias chapas al
// fotograma). Como textura, una hoja entera es dos cuadriláteros —uno por
// cara— y el detalle sale gratis: a `METROS_POR_TEXEL` (2,5 cm, la MISMA
// resolución que ya usa el muro) caben remaches y lamas que en chapas de 10 cm
// no cabían.
//
// EL DIBUJO ES EL MISMO QUE `rejillaHoja`: zócalo, refuerzos, registro con
// lamas, franja de aviso, remaches, canto de cierre. Las alturas SON las
// mismas constantes de `nave-piel-puerta.mjs` (importadas, no copiadas): una
// puerta en textura y una en geometría tienen que marcar el aviso a la misma
// altura, o parecerían dos modelos de puerta distintos en la misma nave.
//
// SIN SEMILLA, como su original: una puerta es una pieza de serie, y todas
// las hojas del mismo tamaño salen IGUALES — lo que hace que un tamaño de
// hoja (típicamente uno solo: media hoja de `ANCHO_PUERTA` × `ALTURA_PUERTA`)
// se pueda generar una vez y reusarse en las trece salas del Phobos.
//
// EL ESPEJADO ES DE UV, NO DE PÍXELES. La hoja que cierra hacia la izquierda
// es la misma textura leída al revés en el eje U: invertir qué extremo del
// cuadrilátero lleva u=0 no toca el orden de sus vértices, así que la normal
// de la cara no cambia — solo qué borde de la imagen queda a cada lado.
//
// Puro y sin color propio (#351): `MURAL` y `AMBAR_SENAL`, de `paleta.mjs`.

import { AMBAR_SENAL, MURAL } from "./paleta.mjs";
import { METROS_POR_TEXEL } from "./piel-textura.mjs";
import {
  AVISO_DESDE,
  AVISO_HASTA,
  PANEL_BAJO_DESDE,
  PANEL_BAJO_HASTA,
  REFUERZOS,
  REGISTRO_DESDE,
  REGISTRO_HASTA,
  RESALTE_HOJA,
  ZOCALO,
} from "./nave-piel-puerta.mjs";

/** Metros → téxeles, redondeando. Compartido por las dos dimensiones: el
 *  téxel es cuadrado, igual que en `piel-textura.mjs`. */
function texeles(metros) {
  return Math.max(0, Math.round(metros / METROS_POR_TEXEL));
}

/**
 * La tesela de una hoja, en téxeles. `[fila][columna]`, fila 0 la del suelo —
 * mismo convenio que `rejillaHoja`.
 *
 * Se expone aparte de `texturaHoja` por lo mismo que `teselaMuro`/`texturaMuro`
 * están separadas: esto es el DIBUJO, legible y probable sin pasar por el
 * empaquetado a paleta+índices que pide el motor.
 */
export function teselaHoja(columnas, filas) {
  const rejilla = Array.from({ length: filas }, () => new Array(columnas).fill(MURAL.medio));
  const poner = (v, u, color) => {
    if (v < 0 || v >= filas || u < 0 || u >= columnas) return;
    rejilla[v][u] = color;
  };
  const linea = (v, u0, largo, color) => {
    for (let u = u0; u < u0 + largo; u += 1) poner(v, u, color);
  };
  const columna = (u, v0, alto, color) => {
    for (let v = v0; v < v0 + alto; v += 1) poner(v, u, color);
  };
  const rect = (v0, u0, anchoRect, altoRect, color) => {
    for (let v = v0; v < v0 + altoRect; v += 1) linea(v, u0, anchoRect, color);
  };
  const fila = (metros) => texeles(metros);

  // 1. La hoja es un BULTO, no un rectángulo pintado: bisel completo, luz
  //    arriba y a la izquierda — mismo criterio que el resto del módulo.
  columna(0, 0, filas, MURAL.claro);
  columna(columnas - 1, 0, filas, MURAL.sombra);
  linea(filas - 1, 0, columnas, MURAL.claro);
  linea(0, 0, columnas, MURAL.junta);

  // 2. Zócalo.
  rect(1, 1, columnas - 2, fila(ZOCALO), MURAL.sombra);
  linea(fila(ZOCALO) + 1, 1, columnas - 2, MURAL.medio);

  // 3. Refuerzos horizontales.
  for (const metros of REFUERZOS) {
    const v = fila(metros);
    if (v <= 1 || v >= filas - 2) continue;
    linea(v, 1, columnas - 2, MURAL.medio);
    linea(v - 1, 1, columnas - 2, MURAL.junta);
  }

  // 4. Registro de inspección (con lamas) y su gemelo liso por debajo del
  //    aviso. Espaciado de lamas EN METROS (0,2 m, la misma cadencia que ya
  //    tenía la versión en chapas) y no en téxeles: a resolución fina, un paso
  //    en téxeles crudos habría multiplicado por cuatro el número de lamas sin
  //    que nadie lo decidiera.
  const PASO_LAMA = 0.2;
  const hueco = (desde, hasta, conLamas) => {
    const v0 = fila(desde);
    const v1 = fila(hasta);
    if (columnas < 12 || v1 >= filas - 2 || v1 - v0 < 4) return;
    rect(v0, 2, columnas - 4, v1 - v0, MURAL.hueco);
    linea(v1 - 1, 2, columnas - 4, MURAL.sombra);
    linea(v0, 2, columnas - 4, MURAL.claro);
    if (conLamas) {
      const paso = Math.max(1, fila(PASO_LAMA));
      for (let v = v0 + 1; v < v1 - 1; v += paso) linea(v, 3, columnas - 6, MURAL.medio);
    }
  };
  hueco(REGISTRO_DESDE, REGISTRO_HASTA, true);
  hueco(PANEL_BAJO_DESDE, PANEL_BAJO_HASTA, false);

  // 5. Franja de aviso a bandas alternas — un texel por columna, como la
  //    versión en chapas: es lo que la hace leerse a distancia sin ser una
  //    imagen borrosa de ámbar.
  const av0 = fila(AVISO_DESDE);
  const av1 = fila(AVISO_HASTA);
  linea(av0 - 1, 1, columnas - 2, MURAL.junta);
  for (let v = av0; v < av1 && v < filas - 1; v += 1) {
    for (let u = 1; u < columnas - 1; u += 1) {
      poner(v, u, (u + Math.floor((v - av0) / 2)) % 2 === 0 ? AMBAR_SENAL : MURAL.junta);
    }
  }
  linea(av1, 1, columnas - 2, MURAL.brillo);

  // 6. Remaches por el canto, cada 40 cm (misma cadencia que la versión en
  //    chapas: `fila(ZOCALO)+3`, paso `fila(0.4)`).
  const pasoRemache = Math.max(1, fila(0.4));
  for (let v = fila(ZOCALO) + Math.max(1, fila(0.3)); v < filas - 2; v += pasoRemache) {
    poner(v, 1, MURAL.remache);
    poner(v, columnas - 2, MURAL.remache);
  }

  // 7. El canto de cierre: más grueso, con dientes de engrane cada 30 cm.
  columna(columnas - 2, 1, filas - 2, MURAL.medio);
  const pasoDiente = Math.max(1, fila(0.3));
  for (let v = fila(ZOCALO) + Math.max(1, fila(0.2)); v < filas - 3; v += pasoDiente) {
    poner(v, columnas - 3, MURAL.sombra);
    poner(v + 1, columnas - 3, MURAL.claro);
  }

  // 8. Guías de rodadura arriba y abajo.
  linea(filas - 2, 1, columnas - 2, MURAL.medio);
  linea(filas - 3, 1, columnas - 2, MURAL.hueco);
  const pasoGuia = Math.max(1, fila(0.3));
  for (let u = fila(0.2); u < columnas - 2; u += pasoGuia) poner(filas - 3, u, MURAL.sombra);

  return rejilla;
}

/**
 * La tesela como textura del motor: `{ancho, alto, indices, paleta}` — mismo
 * empaquetado que `texturaMuro`, incluido el volcado vertical (fila 0 de la
 * rejilla es el suelo; fila 0 de una imagen es arriba).
 */
export function texturaHoja(columnas, filas) {
  const rejilla = teselaHoja(columnas, filas);
  const alto = rejilla.length;
  const ancho = alto > 0 ? rejilla[0].length : 0;
  const paleta = [];
  const indiceDe = new Map();
  const indices = new Uint8Array(ancho * alto);
  for (let v = 0; v < alto; v += 1) {
    for (let u = 0; u < ancho; u += 1) {
      const color = rejilla[v][u];
      let i = indiceDe.get(color);
      if (i === undefined) {
        i = paleta.length;
        paleta.push(color);
        indiceDe.set(color, i);
      }
      indices[(alto - 1 - v) * ancho + u] = i;
    }
  }
  return { ancho, alto, indices, paleta };
}

/** Tamaño mínimo de hoja que admite textura, EN METROS — mismo umbral que la
 *  versión en chapas (0,4 m de ancho, 1,2 m de alto), expresado sin depender
 *  de a cuántos téxeles equivalga. */
const ANCHO_MINIMO = 0.4;
const ALTO_MINIMO = 1.2;

const cacheTextura = new Map();
function texturaCacheada(columnas, filas) {
  const clave = `${columnas}x${filas}`;
  let textura = cacheTextura.get(clave);
  if (!textura) {
    textura = texturaHoja(columnas, filas);
    cacheTextura.set(clave, textura);
  }
  return textura;
}

/**
 * La piel de una media hoja como TEXTURA, por sus dos caras.
 *
 * Misma firma que `piezasPielHoja` de `nave-piel-puerta.mjs` — `puerta` es la
 * puerta con base ya resuelta (`{y0, y1, alongX, base}`) y `hoja` el rect de
 * ESTA media hoja, ya desplazado por su apertura — para que `nave-sala-caja.
 * mjs` pueda elegir entre las dos sin más que cambiar la llamada.
 *
 * `opciones.color`/`opciones.ambiente` viajan tal cual a `componerEscena`,
 * igual que en los paños texturados del muro (`panosTexturados`): un
 * cuadrilátero texturizado necesita su propio ambiente porque solo recibe luz
 * por una cara, no por muchas a la vez como las chapas.
 *
 * @param {{y0:number, y1:number, alongX:boolean, base:object|null}} puerta
 * @param {{x:number, z:number, ancho:number, profundidad:number}} hoja
 * @param {{color:string, ambiente?:number}} opciones
 * @returns {{malla:object, color:string, textura:object, ambiente?:number}[]}
 */
export function piezasPielHojaTextura({ y0, y1, alongX, base }, hoja, { color, ambiente } = {}) {
  const largo = alongX ? hoja.ancho : hoja.profundidad;
  const alto = y1 - y0;
  if (largo < ANCHO_MINIMO || alto < ALTO_MINIMO) return [];

  const inicioHoja = alongX ? hoja.x : hoja.z;
  const inicioHueco = base ? (alongX ? base.x : base.z) : inicioHoja;
  const cierraALaDerecha = inicioHoja <= inicioHueco + largo / 2;

  const columnas = texeles(largo);
  const filas = texeles(alto);
  const textura = texturaCacheada(columnas, filas);
  // Espejado por UV (ver cabecera): mismos vértices, solo qué borde de la
  // imagen les toca.
  const uvs = cierraALaDerecha
    ? [[0, 1], [1, 1], [1, 0], [0, 0]]
    : [[1, 1], [0, 1], [0, 0], [1, 0]];

  const { x, z, ancho, profundidad } = hoja;
  const caras = alongX
    ? [
        { a: [x + ancho, z - RESALTE_HOJA], b: [x, z - RESALTE_HOJA] },
        { a: [x, z + profundidad + RESALTE_HOJA], b: [x + ancho, z + profundidad + RESALTE_HOJA] },
      ]
    : [
        { a: [x - RESALTE_HOJA, z], b: [x - RESALTE_HOJA, z + profundidad] },
        { a: [x + ancho + RESALTE_HOJA, z + profundidad], b: [x + ancho + RESALTE_HOJA, z] },
      ];

  return caras.map(({ a, b }) => ({
    malla: {
      vertices: [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      caras: [[0, 1, 2, 3]],
      uvs: [uvs],
    },
    color,
    textura,
    ...(Number.isFinite(ambiente) ? { ambiente } : {}),
  }));
}
