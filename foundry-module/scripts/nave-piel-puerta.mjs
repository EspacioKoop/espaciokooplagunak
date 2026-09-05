// Piel pixelart de la hoja de una puerta (#550, sobre #548).
//
// El muro ya tiene piel y la puerta no la tenía: tres bandas lisas dibujadas a
// fracciones de su alto (0.42, 0.55, 0.75), medidas en un sistema propio que no
// era el de ninguna otra superficie de la nave. Se ve: al pasar de la pared a la
// puerta, el tamaño del detalle cambia y la puerta parece de otra nave.
//
// LA REJILLA ES LA MISMA (`CELDA` de `nave-mural-pixel.mjs`), y ese es todo el
// motivo de que este módulo exista. Un remache de la puerta mide lo mismo que un
// remache del muro que la rodea, porque en una nave los remaches los pone el
// mismo astillero.
//
// LA HOJA ES ESTRECHA, y el dibujo está pensado para eso. Media hoja de una
// puerta de 1,2 m son TRES celdas de ancho: cualquier motivo que necesite anchura
// —galones, un rótulo, un damero— ahí no se lee. Lo que sí funciona a tres celdas
// es lo que se apoya en las filas: refuerzos horizontales, una franja de aviso a
// bandas alternas y remaches en las esquinas. Por eso el dibujo se declara fila a
// fila y ninguna decisión depende de que haya muchas columnas.
//
// EL ÁMBAR NO ES ADORNO. Es el mismo `AMBAR_SENAL` del marco de esa puerta y dice
// lo mismo que él. La regla de #526 sigue en pie: aquí no hay ninguna medida —una
// franja de aviso no afirma ninguna cantidad, y no crece ni mengua con nada—.
//
// LA PIEL VIAJA CON LA HOJA. Se calcula desde el MISMO rect que la hoja
// (`rectsHojaPuerta`), como ya hacía el detalle que sustituye: con dos cálculos,
// el dibujo se quedaría quieto mientras la puerta se abre.
//
// Puro y sin color propio (#351): `MURAL` y `AMBAR_SENAL`, de `paleta.mjs`.

import { AMBAR_SENAL, MURAL } from "./paleta.mjs";
import { CELDA, chapasDeRejilla } from "./nave-mural-pixel.mjs";

/**
 * Cuánto se despega la piel del plano de la hoja. Más que el `SALIENTE` del
 * mural (0.01): la hoja es un cuerpo que se MUEVE por delante del muro, y a un
 * dedo de distancia de él — un resalte de milímetro se pelearía con la pared al
 * cerrarse, no consigo misma.
 */
export const RESALTE_HOJA = 0.03;

// Las alturas van EN METROS y se convierten a filas con `CELDA`, nunca escritas
// como índice de fila. Al bajar la celda de 0,2 a 0,1 (#551) todas las medidas
// escritas en filas se partieron por la mitad sin que nada fallara: la franja de
// aviso se fue a la altura de la rodilla y la puerta se quedó lisa por arriba.
// Un índice de fila no dice a qué altura está; un metro sí.
const fila = (metros) => Math.round(metros / CELDA);

/**
 * Alturas del dibujo, EN METROS — compartidas con `piel-textura-puerta.mjs`
 * (#458): la textura pinta la MISMA hoja a más resolución, no otra hoja. Con
 * dos copias de estos números, subir el aviso un centímetro en una superficie
 * y no en la otra sería el mismo desalineado que #551 ya sufrió por escribir
 * una altura como índice de fila en vez de en metros.
 */
/** Altura de la mano: donde se marca una esclusa de verdad, y donde la marca
 *  sigue a la vista aunque haya alguien plantado delante. */
export const AVISO_DESDE = 1.05;
// 20 cm de franja y no 40: a cuatro filas la alternancia deja de leerse como una
// banda de peligro y empieza a leerse como una dentadura (se vio en la vista
// previa). Una franja de aviso es una LÍNEA, y lo que la hace visible es el
// contraste, no el grosor.
export const AVISO_HASTA = 1.25;
/** El zócalo de la hoja: la parte que se lleva las patadas y los carros. */
export const ZOCALO = 0.4;
/** Refuerzos horizontales, para que la hoja tenga estructura y no sea un
 *  rectángulo con una pegatina en medio. */
export const REFUERZOS = Object.freeze([0.7, 2.3]);
/** El registro de inspección: un hueco con lamas, entre el aviso y el dintel. */
export const REGISTRO_DESDE = 1.7;
export const REGISTRO_HASTA = 2.2;
/** Su gemelo liso por debajo de la franja, para que la hoja no tenga todo el
 *  peso arriba. */
export const PANEL_BAJO_DESDE = 0.55;
export const PANEL_BAJO_HASTA = 0.95;

/**
 * El dibujo de media hoja, en celdas. `[fila][columna]`, fila 0 la del suelo.
 *
 * Se expone aparte de la geometría por lo mismo que `rejillaMural`: es LA
 * decisión de dibujo, y es lo que un test puede leer sin montar una escena.
 *
 * No lleva semilla: dos puertas de la misma nave tienen que ser IGUALES. Un muro
 * se sortea porque el casco es una superficie larga donde la repetición canta;
 * una puerta es una pieza de serie, y sortear sus remaches la convertiría en
 * artesanía —justo lo contrario de lo que dice una esclusa—.
 */
export function rejillaHoja(columnas, filas) {
  const rejilla = Array.from({ length: filas }, () => new Array(columnas).fill(null));
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
  const rect = (v0, u0, ancho, alto, color) => {
    for (let v = v0; v < v0 + alto; v += 1) linea(v, u0, ancho, color);
  };

  // 1. La hoja es un BULTO, no un rectángulo pintado: bisel completo, con la luz
  //    arriba y a la izquierda igual que las planchas del muro (ver
  //    `panelBiselado`). Es lo que hace que se lea como una plancha que corre por
  //    delante de la pared y no como un agujero más oscuro.
  columna(0, 0, filas, MURAL.claro);
  columna(columnas - 1, 0, filas, MURAL.sombra);
  linea(filas - 1, 0, columnas, MURAL.claro);
  linea(0, 0, columnas, MURAL.junta);

  // 2. Zócalo: la parte que se lleva las patadas y los carros. En una puerta de
  //    servicio es siempre otra chapa, más gruesa y sin nada encima.
  rect(1, 1, columnas - 2, fila(ZOCALO), MURAL.sombra);
  linea(fila(ZOCALO) + 1, 1, columnas - 2, MURAL.medio);

  // 3. Refuerzos horizontales.
  for (const metros of REFUERZOS) {
    const v = fila(metros);
    if (v <= 1 || v >= filas - 2) continue;
    linea(v, 1, columnas - 2, MURAL.medio);
    linea(v - 1, 1, columnas - 2, MURAL.junta); // su sombra: le da grosor
  }

  // 4. Registro de inspección: un hueco con lamas. Lo que hay detrás no se
  //    declara, así que no miente sobre nada (#526) — y es el rasgo que premia
  //    acercarse a una puerta, que antes era lisa de la franja para arriba.
  const hueco = (desde, hasta, conLamas) => {
    const v0 = fila(desde);
    const v1 = fila(hasta);
    if (columnas < 5 || v1 >= filas - 2 || v1 - v0 < 3) return;
    rect(v0, 2, columnas - 4, v1 - v0, MURAL.hueco);
    linea(v1 - 1, 2, columnas - 4, MURAL.sombra); // en un hueco la sombra va ARRIBA
    linea(v0, 2, columnas - 4, MURAL.claro);
    if (conLamas) for (let v = v0 + 1; v < v1 - 1; v += 2) linea(v, 3, columnas - 6, MURAL.medio);
  };
  hueco(REGISTRO_DESDE, REGISTRO_HASTA, true);
  // Y su gemelo por debajo de la franja, liso: una hoja con todo el peso en la
  // mitad de arriba se lee descompensada, y el sitio para equilibrarla es donde
  // no hay nada que decir — así que va vacío, no con otro registro inventado.
  hueco(PANEL_BAJO_DESDE, PANEL_BAJO_HASTA, false);

  // 5. Franja de aviso a bandas alternas: lo que se lee de lejos. Alternar celda
  //    sí celda no funciona igual con seis columnas que con veinte, que es justo
  //    lo que no consigue un galón diagonal en una hoja estrecha.
  const av0 = fila(AVISO_DESDE);
  const av1 = fila(AVISO_HASTA);
  linea(av0 - 1, 1, columnas - 2, MURAL.junta);
  for (let v = av0; v < av1 && v < filas - 1; v += 1) {
    for (let u = 1; u < columnas - 1; u += 1) {
      // El desfase por fila hace que las bandas se lean inclinadas sin dibujar
      // una diagonal de verdad, que en seis columnas no cabría.
      poner(v, u, (u + Math.floor((v - av0) / 2)) % 2 === 0 ? AMBAR_SENAL : MURAL.junta);
    }
  }
  linea(av1, 1, columnas - 2, MURAL.brillo);

  // 6. Remaches por el canto de la hoja, cada 40 cm. El detalle que aparece al
  //    acercarse, cuando los refuerzos ya son demasiado grandes para mirarlos.
  for (let v = fila(ZOCALO) + 3; v < filas - 2; v += 4) {
    poner(v, 1, MURAL.remache);
    poner(v, columnas - 2, MURAL.remache);
  }

  // 7. El CANTO DE CIERRE: el borde por el que esta hoja se junta con la otra.
  //    Es la parte más característica de una puerta de nave y la que estaba sin
  //    dibujar —la hoja tenía menos detalle que el muro que la rodea, y eso se
  //    nota justo cuando te plantas delante—. Va más grueso que el resto del
  //    bisel y con sus dientes de engrane, que es lo que dice que las dos hojas
  //    encajan y no solo se tocan.
  columna(columnas - 2, 1, filas - 2, MURAL.medio);
  for (let v = fila(ZOCALO) + 2; v < filas - 3; v += 3) {
    poner(v, columnas - 3, MURAL.sombra);
    poner(v + 1, columnas - 3, MURAL.claro);
  }

  // 8. Guías de rodadura arriba y abajo: una puerta corredera va colgada de algo.
  linea(filas - 2, 1, columnas - 2, MURAL.medio);
  linea(filas - 3, 1, columnas - 2, MURAL.hueco);
  for (let u = 2; u < columnas - 2; u += 3) poner(filas - 3, u, MURAL.sombra);

  return rejilla;
}

/**
 * La piel de una media hoja, por sus DOS caras: una puerta se ve desde las dos
 * salas que separa, y una hoja con dibujo solo por un lado es una hoja que se
 * queda lisa justo cuando la cruzas.
 *
 * @param {{y0:number, y1:number, alongX:boolean}} puerta la puerta con base ya
 *   resuelta, tal y como la guarda `abrirHuecosEnMuros`.
 * @param {{x:number, z:number, ancho:number, profundidad:number}} hoja el rect de
 *   ESTA media hoja, ya desplazado por su apertura.
 * @returns {{malla:object, color:string}[]}
 */
export function piezasPielHoja({ y0, y1, alongX, base }, hoja) {
  const largo = alongX ? hoja.ancho : hoja.profundidad;
  const columnas = Math.floor(largo / CELDA);
  const filas = Math.floor((y1 - y0) / CELDA);
  // Una hoja demasiado pequeña no admite el dibujo y se queda lisa, en vez de
  // recibir un bisel que sería toda ella. Los mínimos están en CELDAS pero
  // significan 40 cm de ancho y 1,2 m de alto: por debajo de eso no caben ni el
  // zócalo ni la franja de aviso, y lo que saldría no sería una puerta pequeña
  // sino un trozo de puerta.
  if (columnas < 4 || filas < 12) return [];

  // Por qué lado CIERRA esta media hoja. `rejillaHoja` dibuja siempre el canto
  // de cierre a la derecha, y para la hoja que corre al otro lado se espeja la
  // rejilla entera. Sin esto, las dos hojas salen con el canto grueso en el
  // mismo lado y la puerta se lee torcida — se vio en la vista previa, y es un
  // fallo que ningún test de conteo habría cazado.
  //
  // Cuál es cuál se deduce de su sitio dentro del hueco, no de un índice: quien
  // llama recorre `rectsHojaPuerta` y no tiene por qué saber qué significa el
  // orden de esa lista.
  const inicioHoja = alongX ? hoja.x : hoja.z;
  const inicioHueco = base ? (alongX ? base.x : base.z) : inicioHoja;
  const cierraALaDerecha = inicioHoja <= inicioHueco + largo / 2;

  const rejilla = rejillaHoja(columnas, filas);
  if (!cierraALaDerecha) rejilla.forEach((f) => f.reverse());
  // Las dos caras planas de la hoja. `eje` es el que RECORRE la hoja, igual que
  // en `caraInterior`: una hoja larga en x se mira desde ±z.
  const caras = alongX
    ? [
        { eje: "x", plano: hoja.z, sentido: -1, u0: hoja.x },
        { eje: "x", plano: hoja.z + hoja.profundidad, sentido: 1, u0: hoja.x },
      ]
    : [
        { eje: "z", plano: hoja.x, sentido: -1, u0: hoja.z },
        { eje: "z", plano: hoja.x + hoja.ancho, sentido: 1, u0: hoja.z },
      ];

  return caras.flatMap((cara) =>
    chapasDeRejilla(cara, rejilla, { base: y0, saliente: RESALTE_HOJA }),
  );
}
