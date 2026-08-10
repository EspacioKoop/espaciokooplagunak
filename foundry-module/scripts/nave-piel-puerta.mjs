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

/**
 * A qué fila va la franja de aviso, contando desde el suelo de la hoja: 5 y 6
 * sobre `CELDA` = de 1,0 a 1,4 m. Es la altura de la mano, que es donde se marca
 * una esclusa de verdad y donde queda a la vista aunque haya alguien delante.
 */
const FILAS_AVISO = Object.freeze([5, 6]);

/** Refuerzos horizontales: bajo y alto, para que la hoja tenga estructura y no
 *  sea un rectángulo con una pegatina en medio. */
const FILAS_REFUERZO = Object.freeze([2, 11]);

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

  // 1. Canto superior e inferior: la hoja se cierra contra algo por arriba y por
  //    abajo, y sin esas dos líneas flota dentro de su propio hueco.
  for (let u = 0; u < columnas; u += 1) {
    poner(0, u, MURAL.junta);
    poner(filas - 1, u, MURAL.junta);
  }

  // 2. Refuerzos. Solo si hay alto para que se distingan del canto.
  for (const v of FILAS_REFUERZO) {
    if (v <= 0 || v >= filas - 1) continue;
    for (let u = 0; u < columnas; u += 1) poner(v, u, MURAL.conducto);
  }

  // 3. Franja de aviso a bandas alternas: es lo que se lee de lejos, y alternar
  //    celda sí celda no funciona igual con tres columnas que con veinte —que es
  //    justo lo que no consigue un galón diagonal en una hoja estrecha.
  FILAS_AVISO.forEach((v, indice) => {
    if (v <= 0 || v >= filas - 1) return;
    for (let u = 0; u < columnas; u += 1) {
      // El desfase por fila hace que las dos filas juntas se lean como bandas
      // inclinadas, sin necesitar ancho para dibujar una diagonal de verdad.
      poner(v, u, (u + indice) % 2 === 0 ? AMBAR_SENAL : MURAL.junta);
    }
  });

  // 4. Remaches en las cuatro esquinas de la hoja. El detalle que aparece al
  //    acercarse, cuando los refuerzos ya son demasiado grandes para mirarlos.
  for (const v of [1, filas - 2]) {
    poner(v, 0, MURAL.remache);
    poner(v, columnas - 1, MURAL.remache);
  }

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
export function piezasPielHoja({ y0, y1, alongX }, hoja) {
  const largo = alongX ? hoja.ancho : hoja.profundidad;
  const columnas = Math.floor(largo / CELDA);
  const filas = Math.floor((y1 - y0) / CELDA);
  // Una hoja de menos de dos celdas en cualquier eje no admite dibujo: se queda
  // lisa en vez de recibir un canto que sería toda ella.
  if (columnas < 2 || filas < 4) return [];

  const rejilla = rejillaHoja(columnas, filas);
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
