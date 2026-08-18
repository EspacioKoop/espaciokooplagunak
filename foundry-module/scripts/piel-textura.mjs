// La piel del muro como TEXTURA, no como geometría (#584, #548, #551).
//
// POR QUÉ EXISTE, Y NO ES LO QUE #584 PEDÍA. Aquel issue quería prerenderizar la
// piel a PNG para no recalcularla en cada cliente. Medido, ese gasto resultó ser
// decenas de milisegundos una vez — no un problema. El problema real era otro y
// más gordo: **227 de los 253 polígonos de una sala son la piel del muro**. Se
// dibuja con miles de cajitas de diez centímetros, y eso no es caro de calcular:
// es caro de DIBUJAR, en cada fotograma, en cada máquina de la mesa.
//
// Como textura tileada, una pared entera es un cuadrilátero.
//
// Y AL PASAR A TÉXELES, EL DETALLE SALE GRATIS. Es lo que #548 y #551 pedían y
// no se podía dar: con cajas, cada remache nuevo cuesta un polígono y hay que
// racionarlos con un tope. Con textura cuesta un téxel, así que la pared puede
// llevar el nervado, las juntas finas, las manchas de uso y los greebles que en
// geometría había que dejar fuera. La resolución de aquí —dos centímetros y
// medio por téxel— es CUATRO VECES más fina que la rejilla de cajas.
//
// LA TESELA MIDE EXACTAMENTE EL ALTO DEL MURO, y de ahí sale que este módulo no
// necesite decidir nada. La altura de sala es fija (`ALTURA`), así que la `v` va
// de 0 a 1 clavada y solo la `u` repite, según lo largo que sea el vano. Sin
// esa coincidencia habría hecho falta o elegir un tamaño de tesela a ojo —que
// era la opción mala de #584— o enumerar un catálogo cerrado de vanos.
//
// EL BISEL VA PINTADO, Y ESA ES LA PÉRDIDA. En geometría, cada chapa coge la luz
// por su cuenta y el muro tiene un moteado vivo; aquí la pared recibe una sola
// intensidad y el relieve lo hace el dibujo: canto claro arriba, canto oscuro
// abajo. Es luz dibujada en vez de luz calculada — el mismo trato que hacen los
// fondos de la época que este motor imita, y por el mismo motivo.
//
// Puro y sin color propio (#351): los colores salen de `MURAL` en `paleta.mjs`.

import { MURAL } from "./paleta.mjs";
import { rngSemilla } from "./ventana-nave.mjs";

/** Cuántos metros mide un téxel. Dos centímetros y medio: cuatro veces más fino
 *  que la celda de 10 cm con la que se dibujaban las chapas. */
export const METROS_POR_TEXEL = 0.025;

/** Cuánto mide la tesela a lo ancho, en metros. Se repite por el vano. */
export const ANCHO_TESELA = 3.2;

/**
 * Pinta la tesela del muro.
 *
 * SE LEE DE ABAJO ARRIBA: la fila 0 es el suelo. Va por BANDAS porque una nave
 * de verdad va por bandas —el zócalo se golpea con todo lo que se arrastra, la
 * banda de en medio es la que se mira, y por encima del dintel va lo que nadie
 * mira—, y porque un paño uniforme se lee como papel pintado por muchos
 * remaches que lleve.
 */
export function teselaMuro({ ancho, alto, semilla = 1 } = {}) {
  const azar = rngSemilla(semilla >>> 0);
  const rejilla = Array.from({ length: alto }, () => new Array(ancho).fill(MURAL.medio));

  const poner = (v, u, color) => {
    if (v < 0 || v >= alto) return;
    rejilla[v][((u % ancho) + ancho) % ancho] = color;
  };
  const linea = (v, u0, largo, color) => {
    for (let u = u0; u < u0 + largo; u += 1) poner(v, u, color);
  };
  const columna = (u, v0, altoTramo, color) => {
    for (let v = v0; v < v0 + altoTramo; v += 1) poner(v, u, color);
  };
  const rect = (v0, u0, anchoRect, altoRect, color) => {
    for (let v = v0; v < v0 + altoRect; v += 1) linea(v, u0, anchoRect, color);
  };

  const zocalo = Math.round(alto * 0.17);
  const cornisa = Math.round(alto * 0.78);

  /**
   * Una plancha con relieve: canto claro arriba y a la izquierda, oscuro abajo y
   * a la derecha.
   *
   * EL SENTIDO NO ES DECORATIVO. La luz del motor viene de arriba, así que el
   * canto de arriba es el que la coge. Invertido, las planchas se leen hundidas
   * y el muro entero parece un molde en negativo — es el error clásico del
   * relieve dibujado, y el motivo de que esto sea UNA función y no un bisel
   * copiado dentro de cada motivo.
   */
  const plancha = (v0, u0, anchoP, altoP) => {
    rect(v0, u0, anchoP, altoP, MURAL.medio);
    linea(v0 + altoP - 1, u0, anchoP, MURAL.claro); // canto superior, a la luz
    linea(v0, u0, anchoP, MURAL.junta); // canto inferior, en sombra
    columna(u0, v0, altoP, MURAL.claro);
    columna(u0 + anchoP - 1, v0, altoP, MURAL.sombra);
    poner(v0 + altoP - 1, u0 + anchoP - 1, MURAL.medio); // la esquina no es de nadie
  };

  /* ---- ZÓCALO: chapa nervada, y su remate ---------------------------------- */

  rect(0, 0, ancho, zocalo, MURAL.sombra);
  // Nervios verticales cada 24 cm. Un zócalo de chapa lisa se abolla, así que en
  // una nave va nervado — y ese ritmo corto, frente al de las planchas, es lo
  // que le da peso propio en vez de parecer un recorte de la banda de arriba.
  for (let u = 4; u < ancho; u += 10) {
    columna(u, 2, zocalo - 4, MURAL.hueco);
    columna(u + 1, 2, zocalo - 4, MURAL.junta);
    columna(u + 2, 2, zocalo - 4, MURAL.claro);
  }
  linea(zocalo - 2, 0, ancho, MURAL.junta);
  linea(zocalo - 1, 0, ancho, MURAL.brillo); // el canto que coge la luz
  linea(0, 0, ancho, MURAL.hueco); // la junta con el suelo

  /* ---- BANDA MEDIA: planchas, remaches, y lo que las cruza ----------------- */

  const anchoPlancha = Math.round(ancho / 5);
  const altoPlancha = Math.round((cornisa - zocalo) / 2);
  for (let fila = 0; fila < 2; fila += 1) {
    for (let i = 0; i < 5; i += 1) {
      // Las filas van a matajunta, como se monta la chapa de verdad: alineadas,
      // las juntas verticales forman una línea continua de arriba abajo y el
      // paño se parte en columnas.
      const desplace = fila % 2 === 0 ? 0 : Math.round(anchoPlancha / 2);
      plancha(zocalo + fila * altoPlancha, i * anchoPlancha + desplace, anchoPlancha, altoPlancha);
    }
  }
  // Remaches: dos filas por plancha, hacia los bordes y no en el centro, que es
  // donde van los de verdad porque es donde se atornilla.
  for (let fila = 0; fila < 2; fila += 1) {
    const base = zocalo + fila * altoPlancha;
    for (const v of [base + 3, base + altoPlancha - 4]) {
      for (let u = 3; u < ancho; u += 7) {
        poner(v, u, MURAL.remache);
        poner(v - 1, u, MURAL.junta); // su sombrita: sin ella es un punto, no un remache
      }
    }
  }
  // Regueros bajo algunos remaches: es lo que hace que una pared parezca usada y
  // no recién montada, y cuesta una columna de téxeles.
  for (let i = 0; i < 6; i += 1) {
    const u = Math.floor(azar() * ancho);
    const v0 = zocalo + Math.floor(azar() * (cornisa - zocalo - 8));
    columna(u, v0, 3 + Math.floor(azar() * 6), MURAL.junta);
  }

  /* ---- LO QUE CRUZA EL MURO: conducto y abrazaderas ------------------------ */

  const vConducto = zocalo + Math.round((cornisa - zocalo) * 0.62);
  linea(vConducto, 0, ancho, MURAL.junta);
  linea(vConducto + 1, 0, ancho, MURAL.conducto);
  linea(vConducto + 2, 0, ancho, MURAL.conducto);
  linea(vConducto + 3, 0, ancho, MURAL.brillo); // el brillo del tubo
  for (let u = 6; u < ancho; u += 21) {
    rect(vConducto - 1, u, 3, 6, MURAL.abrazadera);
    poner(vConducto + 4, u + 1, MURAL.remache);
  }

  /* ---- CORNISA: lo que va por encima del dintel --------------------------- */

  rect(cornisa, 0, ancho, alto - cornisa, MURAL.sombra);
  linea(cornisa, 0, ancho, MURAL.junta);
  linea(cornisa + 1, 0, ancho, MURAL.claro);
  // Rejillas de ventilación, espaciadas y no seguidas: una fila continua se lee
  // como una raya, y tres grupos se leen como instalación.
  for (let g = 0; g < 3; g += 1) {
    const u0 = 6 + g * Math.round(ancho / 3);
    const anchoRejilla = Math.round(ancho / 7);
    for (let v = cornisa + 4; v < alto - 4; v += 3) {
      linea(v, u0, anchoRejilla, MURAL.ventilacion);
      linea(v + 1, u0, anchoRejilla, MURAL.junta);
    }
    columna(u0 - 1, cornisa + 3, alto - cornisa - 6, MURAL.claro);
    columna(u0 + anchoRejilla, cornisa + 3, alto - cornisa - 6, MURAL.sombra);
  }
  linea(alto - 1, 0, ancho, MURAL.hueco); // la junta con el techo

  /* ---- PARCHES: lo que rompe la repetición -------------------------------- */

  // Sin ellos, dos vanos contiguos se leen como la misma imagen pegada dos
  // veces, que es el fallo que delata un tileado antes que ningún otro.
  for (let i = 0; i < 3; i += 1) {
    const anchoParche = 5 + Math.floor(azar() * 9);
    const altoParche = 4 + Math.floor(azar() * 7);
    const u0 = Math.floor(azar() * ancho);
    const v0 = zocalo + 3 + Math.floor(azar() * (cornisa - zocalo - altoParche - 6));
    plancha(v0, u0, anchoParche, altoParche);
    rect(v0 + 1, u0 + 1, anchoParche - 2, altoParche - 2, MURAL.parche);
    for (let u = u0 + 1; u < u0 + anchoParche - 1; u += 3) poner(v0 + 1, u, MURAL.remache);
  }

  return rejilla;
}

/**
 * La tesela como textura del motor: `{ancho, alto, indices, paleta}`.
 *
 * Sin huecos: es la cara de un muro opaco, y un téxel transparente en mitad de
 * una pared sería un agujero al vacío.
 */
export function texturaMuro(opciones = {}) {
  const rejilla = teselaMuro(opciones);
  const alto = rejilla.length;
  const ancho = rejilla[0].length;
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
      // La fila 0 de la rejilla es el suelo, y en una imagen la 0 es la de
      // arriba: se vuelca del revés o el zócalo sale en el techo.
      indices[(alto - 1 - v) * ancho + u] = i;
    }
  }
  return { ancho, alto, indices, paleta };
}
