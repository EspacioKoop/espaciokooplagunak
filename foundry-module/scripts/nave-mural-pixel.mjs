// Pixelart de casco sobre los muros de la nave (#548): lo que convierte una
// sala de `crearSalaCaja` en el interior de una nave y no en una caja gris.
//
// ES PIXELART EN EL MUNDO, NO UNA TEXTURA. `retro3d.mjs` no mapea texturas y no
// va a hacerlo: el mural son polígonos, igual que el resto del arte del módulo
// (cero binarios en el repositorio). La rejilla es MÉTRICA y única —`CELDA`
// mide lo mismo en las catorce estancias—, así que dos salas de tamaños
// distintos comparten el tamaño de píxel y la nave se lee como una sola nave.
// Es el mismo mando de escala que `CELDA` en `nave-planta-phobos.mjs`, para la
// piel en vez de para la planta.
//
// NO PINTA NADA QUE SE PUEDA LEER. Es la regla de #526 aplicada a una superficie
// que sí se mira de cerca: planchas, remaches, escotillas, rejillas de
// ventilación, tendidos de cable y conductos. Ni una barra, ni una cifra, ni una
// escala, ni una marcación — un dial pintado en el muro sería un instrumento que
// nadie ha calculado, y quien anda por la nave no tiene forma de saber que ese
// no cuenta. Lo que hay aquí es chapa: no admite lectura ni equivocándose. Lo
// que hay DETRÁS de una escotilla tampoco se declara, por lo mismo.
//
// SE LEE A DOS DISTANCIAS, y eso es lo que separa una pared trabajada de una
// pared llena (#551). El muro se parte en tres bandas —zócalo, paño de planchas
// y bastidor de tubos bajo la cornisa— que dan la lectura de lejos; dentro de
// cada plancha va, o no, un greeble que premia acercarse. Llenarlo todo por
// igual produce ruido, que es el fallo contrario al de #548 y no es mejor.
//
// EL RELIEVE ES LA MITAD DEL TRABAJO. Un dibujo plano con más rayas sigue siendo
// plano: lo que da volumen es el bisel —canto claro arriba, oscuro abajo— sobre
// una rampa de seis tonos, y que el sentido de ese bisel coincida con la luz del
// motor. Una pieza montada y un hueco recortado llevan el bisel al revés el uno
// del otro, y esa es toda la diferencia entre un bulto y un agujero.
//
// EL FONDO NO SE PINTA. Solo se emiten las celdas que NO son el color del muro,
// y las contiguas del mismo color se funden en RECTÁNGULOS por mallado codicioso
// (`fundirRectangulos`). Sin eso, el dibujo de #551 pide del orden de mil caras
// por muro y por fotograma. `piezasMuralPixel` respeta además un tope duro
// (`TOPE_PIEZAS`) y prefiere quedarse corta a hundir el fotograma: el mural es
// adorno, y un adorno no puede costar la fluidez de andar.
//
// Medido sobre el catálogo real (2026-08-10, las catorce estancias, 480x270,
// psx, mirando a los cuatro rumbos). Polígonos visibles por fotograma y coste de
// componer la peor sala:
//
//   sin piel (antes de #548)      20–86     0,4 ms
//   piel de #548 + #550          122–327    1,45 ms
//   detalle de #551              871–1055   4,11 ms
//   suelo y techo (#552)         886–1135   4,19 ms
//   luminarias (#555)            894–1173   4,21 ms
//   maquinaria de sala (#560)    894–1264   5,09 ms
//   luminaria por alerta (#765)  363–1268   ~5 ms
//
// El salto de #765 (cablear el difusor a la alerta y a la salud del sistema)
// es CERO: se remidió sobre el mismo catálogo, antes y después del cambio, y
// el rango de polígonos no se movió ni un vértice — es la condición que el
// propio issue #765 puso: si el tinte cuesta polígonos, es que se está
// reconstruyendo algo. La geometría del difusor se funde una sola vez, en la
// construcción de la sala (`mallaDifusorLuminarias`, en `nave-luminaria.mjs`);
// lo único que cambia por fotograma es su `color`, vía `colorDifusorLuminaria`.
//
// El salto de #551 es real y hay que vigilarlo. Está pagado a tres bandas: el
// mallado en rectángulos, el agrupado por color de `chapasDeRejilla` (que quitó
// un 20% de coste sin tocar un solo polígono) y el tope duro. Cabe en un
// fotograma de 16 ms con sitio para el rasterizado, pero es la cifra que se
// vuelve a medir antes de subir nada — no la sensación de que «unos rectángulos
// más dan igual». Si algún día no cabe, lo que se toca es la densidad de
// greebles, NO la rejilla: media resolución se nota en todo el muro, media
// plancha sin escotilla no la echa nadie de menos.
//
// NO TOCA LA COLISIÓN. Son chapas de grosor cero apoyadas sobre la cara interior
// del muro, `SALIENTE` metros por delante para no pelearse con ella en el
// z-buffer. La planta que devuelve `crearPlanta` no cambia ni un centímetro:
// nadie choca con un remache.
//
// DETERMINISTA POR SEMILLA (`rngSemilla`, la misma del campo estelar): la misma
// sala se pinta igual en todas las pantallas de la mesa. Ni `Math.random()` ni
// reloj.
//
// Puro: ni Foundry, ni DOM, ni <canvas>. Se prueba desde Node.
//
// Frontera de arte (#351): ni un color propio — todos salen de `MURAL` en
// `paleta.mjs`.

import { MURAL } from "./paleta.mjs";
import { rngSemilla } from "./ventana-nave.mjs";

/**
 * El píxel del mural, en metros.
 *
 * 0.1 desde #551. En #548 era 0.2, y el argumento era la fidelidad al hardware:
 * «a la resolución interna de PSX, 10 cm es ruido». Ese argumento estaba mal
 * planteado, y las referencias de la época lo desmienten — Metal Slug, Pulstar o
 * Blazing Star en Neo Geo tienen naves con más detalle por metro que esto, y
 * SIGNALIS, que es la referencia moderna de este mismo look, corre a 640x360 y
 * usa a propósito textura MÁS fina de la que una PS1 movía en la práctica. La
 * regla correcta no es «tanta resolución como daba la máquina» sino «el LOOK de
 * la máquina»: paleta corta, sin filtrado, sin degradados. Eso se conserva
 * entero al bajar a 10 cm; lo único que se pierde es la pobreza.
 *
 * A 10 cm una plancha de casco mide 16x18 celdas, que es sitio para bisel,
 * remaches y un greeble dentro. A 20 cm medía 8x9 y no cabía nada: por eso el
 * mural de #548 solo podía ser rayas.
 */
export const CELDA = 0.1;

/**
 * Cuánto sobresale la chapa de la cara del muro. Suficiente para que el z-buffer
 * del bucle de andar la resuelva siempre por delante, y demasiado poco para que
 * se vea el canto (no lo hay: son caras sueltas, no cajas).
 */
export const SALIENTE = 0.01;

/** Ancho de una plancha de casco, en celdas: 16 x 0.1 = 1.6 m. */
const PANEL_ANCHO = 16;
/**
 * Alto de una plancha: 10 x 0.1 = 1 m.
 *
 * No es una medida de chapa real, es una decisión de composición: con planchas
 * de 1,8 m solo cabía UNA fila entre el zócalo y el bastidor de tubos, y un
 * muro con una sola fila de planchas se lee como un friso a media altura, no
 * como un mamparo. Con 1 m caben dos, y dos filas es lo que hace que la pared
 * tenga arriba y abajo.
 */
const PANEL_ALTO = 10;

/**
 * Las tres bandas horizontales en que se parte el muro. NO son adorno: son la
 * jerarquía que hace que el mural se lea a dos distancias, que es lo que
 * distingue una pared trabajada de una pared llena. De lejos se ven tres franjas
 * y las planchas; de cerca, lo que hay dentro de cada plancha.
 *
 * `ZOCALO_ALTO` = 4 celdas = 40 cm, la altura a la que se golpea una pared con
 * lo que se arrastra. `CORNISA_ALTO` = 5 = 50 cm, por encima del dintel (2.8 m)
 * en un muro de 3.8: lo que queda fuera del cono de mirada.
 */
const ZOCALO_ALTO = 4;
const CORNISA_ALTO = 5;

/**
 * Tope duro de polígonos por tramo de muro.
 *
 * Sube de 160 (#548) a 420 con el detalle de #551, y lo que lo hace pagable no
 * es haber subido el número: es `fundirRectangulos`. Con el fundido por tiradas
 * anterior, este mismo dibujo pedía del orden de mil piezas por muro; en
 * rectángulos baja a un tercio largo. El tope sigue existiendo para lo mismo:
 * cortar en seco un muro absurdamente largo antes de que se coma el fotograma.
 */
export const TOPE_PIEZAS = 420;

/**
 * Cuántas filas ocupa el bastidor de tubos: dos tubos con su filo y su sombra.
 *
 * Fueron tres y ocupaban 0,9 m del muro. Se vio en la vista previa: el bastidor
 * pesaba más que el paño de planchas y el muro se leía como una reja con un
 * friso debajo. El detalle de una superficie no se reparte a partes iguales —lo
 * que manda es el paño, y los tubos son el remate.
 */
const CONDUCTO_ALTO = 6;

/**
 * Reparte el alto del muro en sus bandas.
 *
 * Se calcula y no se escribe con números fijos porque la piel la piden también
 * la hoja de una puerta (2,8 m) y un objeto (0,6 m): con filas hardcodeadas, el
 * bastidor de tubos de un muro de 3,8 m caía encima de la cornisa en cuanto el
 * alto cambiaba, que es exactamente el fallo que tenía la primera versión de
 * #551. Cada banda cede en el orden en que deja de tener sentido: primero el
 * bastidor —una pared baja no tiene tubos por encima de la cabeza—, luego la
 * cornisa, y el zócalo es el último en irse porque un muro sin él flota.
 */
export function bandas(filas) {
  const zocalo = filas >= 12 ? ZOCALO_ALTO : 0;
  const cornisa = filas >= 20 ? CORNISA_ALTO : 0;
  const hayConducto = filas >= 30;
  const conducto = hayConducto ? CONDUCTO_ALTO : 0;
  return {
    zocalo,
    cornisa,
    // Dónde empieza el bastidor, o `null` si esta superficie no lo lleva.
    filaConducto: hayConducto ? filas - cornisa - conducto : null,
    // El paño de planchas: lo que queda en medio. `panoHasta` es EXCLUSIVO —la
    // primera fila que ya no es paño—, y no «la última que sí»: escrito como
    // límite inferior se perdía una fila de planchas enteras por un off-by-one
    // que no revienta nada, solo deja el muro con la mitad del dibujo.
    panoDesde: zocalo + (zocalo > 0 ? 1 : 0),
    // Una fila de aire entre el paño y los tubos: sin ella el bastidor se apoya
    // en la última plancha y las dos cosas se leen como una sola pieza rara.
    panoHasta: filas - cornisa - conducto - (hayConducto ? 1 : 0),
  };
}

/**
 * De qué muro es este tramo y hacia dónde mira su cara interior.
 *
 * Los tramos que produce `abrirHuecosEnMuros` son rectángulos alineados a ejes
 * en el borde de la planta: los de norte/sur son largos en `x` y finos en `z`,
 * los de este/oeste al revés. La cara que se ve desde dentro es la que da a la
 * sala, y de qué lado está se sabe comparando con las medidas de la sala.
 *
 * Devuelve `null` para un rectángulo que no sea un muro perimetral reconocible
 * (una columna interior, por ejemplo): quien llame no pinta mural ahí, en vez de
 * inventarse una orientación.
 *
 * @returns {{eje:"x"|"z", plano:number, sentido:1|-1, u0:number, largo:number}|null}
 */
export function caraInterior(rect, sala) {
  const largoX = rect.ancho;
  const largoZ = rect.profundidad;
  if (largoX >= largoZ) {
    // Muro largo en x: su cara interior mira en z.
    const centroZ = rect.z + rect.profundidad / 2;
    if (centroZ < 0) return { eje: "x", plano: rect.z + rect.profundidad, sentido: 1, u0: rect.x, largo: largoX };
    if (centroZ > sala.profundidad) return { eje: "x", plano: rect.z, sentido: -1, u0: rect.x, largo: largoX };
    return null;
  }
  const centroX = rect.x + rect.ancho / 2;
  if (centroX < 0) return { eje: "z", plano: rect.x + rect.ancho, sentido: 1, u0: rect.z, largo: largoZ };
  if (centroX > sala.ancho) return { eje: "z", plano: rect.x, sentido: -1, u0: rect.z, largo: largoZ };
  return null;
}

/**
 * El mural en coordenadas de rejilla, sin geometría: para cada celda `(u, v)`,
 * qué color le toca o `null` si ahí se ve el muro pelado.
 *
 * Se expone aparte de la geometría porque es LA decisión de dibujo y es lo que
 * se puede leer en un test sin montar una escena: la mitad de abajo del archivo
 * solo traduce esta rejilla a polígonos.
 *
 * @param {number} columnas celdas a lo ancho del tramo
 * @param {number} filas celdas de suelo a techo
 * @param {number} semilla
 * @returns {(string|null)[][]} `[fila][columna]`, fila 0 = la del suelo
 */
export function rejillaMural(columnas, filas, semilla = 1) {
  const azar = rngSemilla(semilla >>> 0);
  const lienzo = crearLienzo(columnas, filas);
  const { poner, rect, linea } = lienzo;
  const banda = bandas(filas);

  // --- Banda baja: ZÓCALO. La chapa de abajo se golpea con todo lo que se
  //     arrastra por un pasillo, así que en una nave de verdad es otra pieza:
  //     más gruesa, atornillada aparte y rematada por un canto. Aquí hace
  //     además el trabajo de composición de anclar el muro al suelo.
  if (banda.zocalo > 0) {
    rect(0, 0, columnas, banda.zocalo, MURAL.sombra);
    linea(banda.zocalo, 0, columnas, MURAL.brillo); // el canto que coge la luz
    // Rigidizadores: un zócalo de chapa lisa se abolla, así que va nervado. Es
    // además el único sitio del muro con ritmo corto (cada 60 cm), y ese cambio
    // de ritmo respecto a las planchas (1,6 m) es lo que le da a la banda baja
    // un peso propio en vez de parecer un recorte de la de arriba.
    for (let u = 4; u < columnas - 1; u += 8) {
      lienzo.columna(u, 1, banda.zocalo - 1, MURAL.hueco);
      lienzo.columna(u + 1, 1, banda.zocalo - 1, MURAL.medio);
    }
    for (let u = 8; u < columnas; u += 8) poner(1, u, MURAL.remache);
  }

  // --- Banda alta: CORNISA, por encima del dintel de una puerta. Va más
  //     apagada y con menos cosas a propósito: es lo que queda fuera del cono de
  //     mirada, y llenarla compite con lo que sí se mira. Lo único que lleva son
  //     las ménsulas de las que cuelga: sin ellas es una franja flotando.
  if (banda.cornisa > 0) {
    const vCornisa = filas - banda.cornisa;
    rect(vCornisa, 0, columnas, banda.cornisa, MURAL.junta);
    linea(vCornisa - 1, 0, columnas, MURAL.medio);
    linea(filas - 1, 0, columnas, MURAL.sombra);
    for (let u = 8; u < columnas; u += PANEL_ANCHO) {
      rect(vCornisa, u, 3, banda.cornisa - 1, MURAL.sombra);
      lienzo.columna(u, vCornisa, banda.cornisa - 1, MURAL.medio);
    }
  }

  // --- Banda media: el PAÑO DE PLANCHAS. Es el grueso del muro y lo que da la
  //     escala de la sala.
  const paneles = [];
  for (let v = banda.panoDesde; v + PANEL_ALTO <= banda.panoHasta; v += PANEL_ALTO) {
    for (let u = 0; u + PANEL_ANCHO <= columnas; u += PANEL_ANCHO) {
      // No todas las planchas son del mismo tono. Es UN rectángulo más por
      // plancha —lo más barato que hay en este dibujo— y es lo que más se nota:
      // un paño donde todas son idénticas se lee como una textura repetida por
      // muy trabajada que esté cada una. Las naves de Neo Geo hacen justo esto,
      // y por eso su chapa parece chapa y no papel pintado.
      const tono = azar();
      if (tono < 0.18) rect(v + 1, u + 1, PANEL_ANCHO - 2, PANEL_ALTO - 2, MURAL.sombra);
      else if (tono < 0.30) rect(v + 1, u + 1, PANEL_ANCHO - 2, PANEL_ALTO - 2, MURAL.medio);
      panelBiselado(lienzo, u, v, PANEL_ANCHO, PANEL_ALTO);
      paneles.push([u, v]);
    }
    // El sobrante de la derecha, cuando el muro no mide un número entero de
    // planchas: media plancha es lo que se ve en una nave real, y dejar ese
    // trozo liso delataría la rejilla más que cualquier junta.
    const resto = columnas % PANEL_ANCHO;
    if (resto >= 3) panelBiselado(lienzo, columnas - resto, v, resto, PANEL_ALTO);
  }

  // --- El BASTIDOR DE SERVICIO, a la altura a la que pasan los tubos en
  //     cualquier nave dibujada: por encima de la cabeza y por debajo del
  //     dintel. Un conducto no afirma ningún caudal, que es lo que lo hace
  //     admisible como adorno (#526).
  if (banda.filaConducto !== null) conducto(lienzo, banda.filaConducto, columnas);

  // --- Los GREEBLES: uno por plancha como mucho, sorteado. Es lo que hace que
  //     el paño no sea papel pintado, y lo que premia acercarse — de lejos se
  //     ven las planchas, de cerca cada una es distinta.
  //
  //     El sorteo recorre la lista de planchas SIEMPRE en el mismo orden, así
  //     que la semilla fija el muro entero.
  for (const [u, v] of paneles) {
    const tirada = azar();
    if (tirada < 0.2) escotilla(lienzo, u, v, azar);
    else if (tirada < 0.36) rejillaVentilacion(lienzo, u, v);
    else if (tirada < 0.52) tendidoCables(lienzo, u, v, azar);
    else if (tirada < 0.66) placaAtornillada(lienzo, u, v, azar);
    // El resto se queda como plancha lisa. Una nave donde TODAS las planchas
    // llevan algo encima es un cuarto de máquinas, no un pasillo.

    // Y un detalle menudo encima, a veces: la tercera capa de lectura, la que
    // solo existe cuando te pones al lado del muro. No sustituye al greeble
    // grande, se le suma — que es lo que hace que acercarse siga dando algo
    // después de haber visto ya la escotilla.
    if (azar() < 0.5) menudencia(lienzo, u, v, azar);
  }

  // --- Las CUADERNAS: la estructura de la nave, vista por dentro. Van por
  //     ENCIMA de las planchas —se dibujan las últimas— y solo dentro del paño:
  //     de zócalo a cornisa cruzaban el bastidor de tubos y el muro entero se
  //     leía como una verja (se vio en la vista previa).
  for (let u = PANEL_ANCHO; u + 3 < columnas; u += PANEL_ANCHO * 2) {
    cuaderna(lienzo, u, banda.panoDesde, banda.panoHasta);
  }

  return lienzo.rejilla;
}

/**
 * El canal estructural entre dos columnas de planchas: tres celdas HUNDIDAS, con
 * su filo de luz a un lado y el fondo oscuro dentro.
 *
 * Se probó al revés —un nervio claro, montado por delante— y era peor: a la
 * cadencia de 3,2 m, tres barras claras de suelo a techo convierten la pared en
 * una verja y se comen la lectura horizontal de las bandas. Hundido hace el
 * trabajo contrario: da profundidad sin quitar protagonismo, que es lo que se le
 * pide a un rasgo que se repite tanto.
 */
function cuaderna(lienzo, u0, v0, v1) {
  const alto = v1 - v0;
  if (alto < 6) return;
  lienzo.rect(v0, u0, 3, alto, MURAL.hueco);
  lienzo.columna(u0, v0, alto, MURAL.sombra);
  lienzo.columna(u0 + 2, v0, alto, MURAL.medio); // el filo del otro lado, a la luz
  for (let v = v0 + 3; v < v1 - 1; v += 6) lienzo.poner(v, u0 + 1, MURAL.sombra);
}

/**
 * Detalle menudo: lo que se ve al pegarse al muro. Cuatro cosas pequeñas, todas
 * de dos o tres celdas, ninguna capaz de significar nada (#526) — un par de
 * pernos, una cartela de esquina, un tapón roscado, una junta de dilatación.
 */
function menudencia(lienzo, u, v, azar) {
  const { poner, linea, columna } = lienzo;
  const cual = Math.floor(azar() * 4);
  const uu = u + 3 + Math.floor(azar() * (PANEL_ANCHO - 7));
  const vv = v + 2 + Math.floor(azar() * (PANEL_ALTO - 5));
  if (cual === 0) {
    // Dos pernos con su sombra: el detalle más pequeño que sigue leyéndose.
    poner(vv, uu, MURAL.brillo);
    poner(vv - 1, uu, MURAL.junta);
    poner(vv, uu + 2, MURAL.brillo);
    poner(vv - 1, uu + 2, MURAL.junta);
  } else if (cual === 1) {
    // Cartela: el triángulo escalonado que refuerza una esquina interior.
    for (let k = 0; k < 3; k += 1) linea(v + 2 + k, u + 2, 3 - k, MURAL.claro);
  } else if (cual === 2) {
    // Tapón roscado: un cuadro de tres con el centro hundido.
    lienzo.rect(vv, uu, 3, 3, MURAL.medio);
    poner(vv + 1, uu + 1, MURAL.hueco);
  } else {
    // Junta de dilatación: una costura corta con su filo.
    columna(uu, vv, 4, MURAL.junta);
    columna(uu + 1, vv, 4, MURAL.claro);
  }
}

/**
 * El VOCABULARIO compartido del pixelart de la nave (#551): el lienzo de celdas
 * y las dos piezas con las que se dibuja todo —una pieza montada y un hueco
 * recortado—. Se exporta porque puertas y objetos dibujan con lo MISMO, y el
 * sentido del bisel es justo lo que no puede divergir entre superficies: dos
 * relieves iluminados al revés en la misma sala se ven a la primera.
 */
/** Un lienzo de celdas con las brochas que usa todo el dibujo. Se pasa entero a
 *  cada motivo para que ninguno tenga que redeclarar sus límites — que es donde
 *  se cuelan los desbordes de uno en el motivo de al lado. */
export function crearLienzo(columnas, filas) {
  const rejilla = Array.from({ length: filas }, () => new Array(columnas).fill(null));
  const poner = (v, u, color) => {
    if (v < 0 || v >= filas || u < 0 || u >= columnas) return;
    rejilla[v][u] = color;
  };
  return {
    rejilla,
    columnas,
    filas,
    poner,
    /** Franja horizontal de una celda de alto. */
    linea(v, u0, largo, color) {
      for (let u = u0; u < u0 + largo; u += 1) poner(v, u, color);
    },
    /** Franja vertical de una celda de ancho. */
    columna(u, v0, alto, color) {
      for (let v = v0; v < v0 + alto; v += 1) poner(v, u, color);
    },
    /** Rectángulo macizo. */
    rect(v0, u0, ancho, alto, color) {
      for (let v = v0; v < v0 + alto; v += 1) {
        for (let u = u0; u < u0 + ancho; u += 1) poner(v, u, color);
      }
    },
  };
}

/**
 * Una plancha con RELIEVE: canto claro arriba y a la izquierda, canto oscuro
 * abajo y a la derecha, interior sin pintar (o sea, el color del muro).
 *
 * Es la pieza que sostiene todo el mural. Sin bisel no hay volumen, y sin
 * volumen el mural es un plano con rayas por muy denso que se ponga — que es
 * exactamente lo que era en #548.
 *
 * El SENTIDO del bisel no es decorativo: la luz del motor viene de arriba
 * (`LUZ` en `retro3d.mjs`), así que el canto de arriba es el que la coge. Si se
 * invirtiera, las planchas se leerían hundidas en vez de montadas y el muro
 * entero parecería un molde en negativo. Es el error clásico del relieve
 * dibujado a mano, y es el motivo de que esto sea UNA función y no un bisel
 * copiado dentro de cada motivo.
 */
export function panelBiselado({ linea, columna, poner }, u0, v0, ancho, alto) {
  linea(v0 + alto - 1, u0, ancho, MURAL.claro); // canto superior, a la luz
  linea(v0, u0, ancho, MURAL.junta); // canto inferior, en sombra
  columna(u0, v0, alto, MURAL.claro); // costado izquierdo, a la luz
  columna(u0 + ancho - 1, v0, alto, MURAL.sombra); // costado derecho, en sombra
  // Las dos esquinas donde se cruzan luz y sombra van a un tono intermedio: sin
  // esto el bisel hace una escalera de contraste que canta más que el relieve.
  poner(v0, u0, MURAL.sombra);
  poner(v0 + alto - 1, u0 + ancho - 1, MURAL.medio);
  // Remaches en las cuatro esquinas de la plancha, ya por dentro del bisel.
  poner(v0 + 1, u0 + 1, MURAL.remache);
  poner(v0 + 1, u0 + ancho - 2, MURAL.remache);
  poner(v0 + alto - 2, u0 + 1, MURAL.remache);
  poner(v0 + alto - 2, u0 + ancho - 2, MURAL.remache);
}

/**
 * Un hueco RECORTADO en la plancha: el bisel al revés que el de una pieza
 * montada —sombra arriba, luz abajo—, porque eso es justo lo que distingue un
 * agujero de un bulto. Devuelve el rectángulo interior para que el motivo que
 * lo pidió lo rellene.
 */
export function hundir({ linea, columna, rect }, u0, v0, ancho, alto) {
  rect(v0, u0, ancho, alto, MURAL.hueco);
  linea(v0 + alto - 1, u0, ancho, MURAL.sombra);
  columna(u0, v0, alto, MURAL.sombra);
  linea(v0, u0, ancho, MURAL.claro);
  columna(u0 + ancho - 1, v0, alto, MURAL.claro);
  return { u0: u0 + 1, v0: v0 + 1, ancho: Math.max(0, ancho - 2), alto: Math.max(0, alto - 2) };
}

/** Escotilla de acceso: un hueco con su tapa dentro y dos tiradores. Lo que hay
 *  detrás no se declara, y por eso no miente sobre nada. */
function escotilla(lienzo, u, v, azar) {
  const ancho = 6 + Math.floor(azar() * 3);
  const alto = 6 + Math.floor(azar() * 3);
  const u0 = u + 2 + Math.floor(azar() * Math.max(1, PANEL_ANCHO - ancho - 3));
  const v0 = v + 2 + Math.floor(azar() * Math.max(1, PANEL_ALTO - alto - 3));
  const dentro = hundir(lienzo, u0, v0, ancho, alto);
  lienzo.rect(dentro.v0, dentro.u0, dentro.ancho, dentro.alto, MURAL.medio);
  // Los dos tiradores, a media altura: son lo que dice «esto se abre».
  const vt = dentro.v0 + Math.floor(dentro.alto / 2);
  lienzo.linea(vt, dentro.u0 + 1, 2, MURAL.brillo);
  lienzo.linea(vt, dentro.u0 + dentro.ancho - 3, 2, MURAL.brillo);
}

/** Rejilla de ventilación: lamas horizontales dentro de un hueco. Cada lama es
 *  una línea de hueco con su filo claro debajo — así se dibuja una lama, y no
 *  una raya. */
function rejillaVentilacion(lienzo, u, v) {
  const dentro = hundir(lienzo, u + 3, v + 3, PANEL_ANCHO - 6, PANEL_ALTO - 6);
  for (let k = 0; k + 1 < dentro.alto; k += 2) {
    lienzo.linea(dentro.v0 + k, dentro.u0, dentro.ancho, MURAL.ventilacion);
    lienzo.linea(dentro.v0 + k + 1, dentro.u0, dentro.ancho, MURAL.medio);
  }
}

/** Tendido de cables por fuera del mamparo, con sus grapas. Va en VERTICAL
 *  porque es lo que rompe un paño lleno de líneas horizontales. */
function tendidoCables(lienzo, u, v, azar) {
  const u0 = u + 2 + Math.floor(azar() * (PANEL_ANCHO - 5));
  const alto = PANEL_ALTO - 4;
  lienzo.columna(u0, v + 2, alto, MURAL.sombra);
  lienzo.columna(u0 + 1, v + 2, alto, MURAL.medio);
  for (let k = 2; k < alto; k += 5) lienzo.linea(v + 2 + k, u0 - 1, 4, MURAL.claro);
}

/** Placa atornillada encima de la plancha: la reparación de toda nave vieja. Es
 *  una pieza MONTADA, así que lleva el bisel en el sentido de un bulto. */
function placaAtornillada(lienzo, u, v, azar) {
  const ancho = 5 + Math.floor(azar() * 4);
  const alto = 4 + Math.floor(azar() * 3);
  const u0 = u + 2 + Math.floor(azar() * Math.max(1, PANEL_ANCHO - ancho - 3));
  const v0 = v + 2 + Math.floor(azar() * Math.max(1, PANEL_ALTO - alto - 3));
  lienzo.rect(v0, u0, ancho, alto, MURAL.parche);
  lienzo.linea(v0 + alto - 1, u0, ancho, MURAL.claro);
  lienzo.linea(v0, u0, ancho, MURAL.junta);
  lienzo.columna(u0 + ancho - 1, v0, alto, MURAL.sombra);
  for (let k = 1; k < ancho - 1; k += 3) {
    lienzo.poner(v0 + 1, u0 + k, MURAL.remache);
    lienzo.poner(v0 + alto - 2, u0 + k, MURAL.remache);
  }
}

/** El bastidor de tubos: tres conductos paralelos con brillo arriba, sombra
 *  abajo y abrazaderas que los amarran al mamparo. */
function conducto(lienzo, v0, columnas) {
  const { linea, rect, columna, poner } = lienzo;
  // Los dos tubos NO son iguales: uno grueso y claro, otro fino y oscuro. Dos
  // tubos idénticos se leen como una reja; dos distintos, como dos servicios que
  // van por el mismo bastidor, que es lo que hay en una nave.
  rect(v0, 0, columnas, 2, MURAL.conducto);
  linea(v0 + 1, 0, columnas, MURAL.claro);
  linea(v0 - 1, 0, columnas, MURAL.junta);
  linea(v0 + 4, 0, columnas, MURAL.sombra);
  linea(v0 + 5, 0, columnas, MURAL.medio);

  // Las abrazaderas al mamparo, cada 1,6 m — la misma cadencia que las planchas,
  // porque en una nave se atornillan a la estructura y no donde caiga.
  let cuenta = 0;
  for (let u = 4; u < columnas; u += PANEL_ANCHO) {
    rect(v0 - 1, u, 2, CONDUCTO_ALTO + 1, MURAL.abrazadera);
    columna(u, v0 - 1, CONDUCTO_ALTO + 1, MURAL.claro);
    // Y cada tres abrazaderas, una caja de registro: el bastidor deja de ser una
    // línea infinita y pasa a tener sitios donde ocurre algo. Lo que ocurre no
    // se declara —una caja cerrada no afirma nada (#526)—, pero su ritmo largo
    // (cada 4,8 m) es lo que impide que el remate superior se lea como una
    // moldura repetida.
    if (cuenta % 3 === 2 && u + 6 < columnas) {
      rect(v0 - 2, u + 3, 6, CONDUCTO_ALTO + 2, MURAL.medio);
      linea(v0 + CONDUCTO_ALTO - 1, u + 3, 6, MURAL.claro);
      columna(u + 8, v0 - 2, CONDUCTO_ALTO + 2, MURAL.sombra);
      poner(v0, u + 4, MURAL.remache);
      poner(v0, u + 7, MURAL.remache);
      poner(v0 + 3, u + 4, MURAL.remache);
      poner(v0 + 3, u + 7, MURAL.remache);
    }
    cuenta += 1;
  }
}

/**
 * Funde cada fila de la rejilla en tiradas horizontales del mismo color.
 *
 * Es lo que hace asumible el coste: una junta horizontal de 40 celdas sale como
 * UN rectángulo, no como cuarenta. Solo se funde en horizontal —fundir también
 * en vertical exigiría un rectangulado 2D con casos degenerados y ahorra poco:
 * lo largo de este mural son las líneas horizontales.
 *
 * @returns {{v:number, u0:number, ancho:number, color:string}[]}
 */
export function fundirTiradas(rejilla) {
  const tiradas = [];
  rejilla.forEach((fila, v) => {
    let u = 0;
    while (u < fila.length) {
      const color = fila[u];
      if (!color) {
        u += 1;
        continue;
      }
      let fin = u;
      while (fin + 1 < fila.length && fila[fin + 1] === color) fin += 1;
      tiradas.push({ v, u0: u, ancho: fin - u + 1, color });
      u = fin + 1;
    }
  });
  return tiradas;
}

/**
 * Funde la rejilla en RECTÁNGULOS, no solo en tiradas de una fila: mallado
 * codicioso clásico —extender a la derecha mientras el color siga, luego hacia
 * arriba mientras la franja entera repita— que es óptimo de sobra para dibujos
 * como estos y cabe en veinte líneas.
 *
 * Sustituye a `fundirTiradas` como fundido de serie (#551). La versión anterior
 * solo fundía en horizontal y su comentario decía que fundir en vertical
 * «ahorra poco»: era CIERTO con el mural disperso de #548 —cuatro rasgos, casi
 * todos líneas horizontales— y dejó de serlo en cuanto el dibujo se llenó de
 * relieve, que es vertical por definición (el canto claro de un panel es una
 * columna de N celdas). Con tiradas, un panel biselado de 8x9 costaba 22
 * polígonos; en rectángulos cuesta 4. Ese ahorro es justo lo que paga el
 * detalle nuevo, así que no es una optimización suelta: es su condición.
 *
 * `fundirTiradas` se conserva exportada porque sigue siendo la forma de mirar
 * una rejilla fila a fila en un test, que es más fácil de leer que un mallado.
 *
 * @returns {{v:number, u0:number, ancho:number, alto:number, color:string}[]}
 */
export function fundirRectangulos(rejilla) {
  const filas = rejilla.length;
  const columnas = filas > 0 ? rejilla[0].length : 0;
  const gastada = rejilla.map((fila) => fila.map(() => false));
  const piezas = [];

  for (let v = 0; v < filas; v += 1) {
    for (let u = 0; u < columnas; u += 1) {
      const color = rejilla[v][u];
      if (!color || gastada[v][u]) continue;

      let ancho = 1;
      while (u + ancho < columnas && rejilla[v][u + ancho] === color && !gastada[v][u + ancho]) ancho += 1;

      let alto = 1;
      while (v + alto < filas) {
        let cabe = true;
        for (let du = 0; du < ancho; du += 1) {
          if (rejilla[v + alto][u + du] !== color || gastada[v + alto][u + du]) {
            cabe = false;
            break;
          }
        }
        if (!cabe) break;
        alto += 1;
      }

      for (let dv = 0; dv < alto; dv += 1) {
        for (let du = 0; du < ancho; du += 1) gastada[v + dv][u + du] = true;
      }
      piezas.push({ v, u0: u, ancho, alto, color });
    }
  }
  return piezas;
}

/**
 * Un rectángulo de piel como cara suelta, con el mismo sentido de giro que la
 * cara sobre la que se apoya (antihorario vista desde donde se mira), para que
 * `componerEscena` no la descarte de espaldas ni la ilumine al revés.
 *
 * Se EXPORTA (#550) porque la piel de una puerta y la de un objeto se apoyan en
 * caras exactamente igual de planas y alineadas a ejes que la de un muro: lo que
 * cambia entre las tres es QUÉ se dibuja, no cómo se apoya una chapa. Con esto
 * copiado, el signo invertido del eje `z` que se comenta abajo se habría copiado
 * mal en dos sitios más.
 *
 * @param {{eje:"x"|"z", plano:number, sentido:1|-1}} cara
 * @param {number} u0 @param {number} u1 a lo largo de la cara, en metros
 * @param {number} v0 @param {number} v1 en altura, en metros
 * @param {number} saliente cuánto se despega del plano
 */
export function chapaEnCara({ eje, plano, sentido }, u0, u1, v0, v1, saliente = SALIENTE) {
  const p = plano + saliente * sentido;
  const punto = eje === "x" ? (u, v) => [u, v, p] : (u, v) => [p, v, u];
  // Cuál de los dos giros toca sale de las caras equivalentes de `caja` en
  // `nave-sala-caja.mjs` (frente/fondo para un muro largo en x, izquierda/
  // derecha para uno largo en z), no de probar cuál se ve. Ojo: para el eje `z`
  // el par está INVERTIDO respecto al eje `x`, porque `u` es entonces la
  // coordenada z y el sistema es dextrógiro — es justo el signo que se pone al
  // revés si se copia el caso de al lado.
  const directo = eje === "x" ? sentido > 0 : sentido < 0;
  const vertices = directo
    ? [punto(u0, v0), punto(u1, v0), punto(u1, v1), punto(u0, v1)]
    : [punto(u0, v0), punto(u0, v1), punto(u1, v1), punto(u1, v0)];
  return { vertices, caras: [[0, 1, 2, 3]] };
}

/**
 * El mural de un tramo de muro, listo para entrar en la lista de piezas de
 * `crearSalaCaja`.
 *
 * @param {{rect:object, sala:{ancho:number, profundidad:number}, altura:number, semilla?:number}} opciones
 * @returns {{malla:object, color:string}[]} vacío si el rectángulo no es un muro
 *   perimetral o si no cabe ni una celda.
 */
export function piezasMuralPixel({ rect, sala, altura, semilla = 1 }) {
  const cara = caraInterior(rect, sala);
  if (!cara) return [];
  const columnas = Math.floor(cara.largo / CELDA);
  const filas = Math.floor(altura / CELDA);
  if (columnas < 1 || filas < 1) return [];

  // La semilla mezcla la posición del tramo: dos muros de la misma sala con el
  // mismo largo no pueden salir con los parches en el mismo sitio, o la sala se
  // lee como una habitación de espejos.
  const semillaTramo = (semilla ^ Math.round(rect.x * 97) ^ Math.round(rect.z * 8191)) >>> 0;
  return chapasDeRejilla(cara, rejillaMural(columnas, filas, semillaTramo));
}

/**
 * Traduce una rejilla de celdas a piezas sobre una cara: funde, corta por el
 * tope y coloca cada tirada en su sitio.
 *
 * Es la mitad de abajo de `piezasMuralPixel`, exportada para que puertas y
 * objetos (#550) no la repitan — es donde vive el tope de presupuesto, y un tope
 * que solo cumple uno de los tres consumidores no es un tope.
 *
 * @param {{eje:"x"|"z", plano:number, sentido:1|-1, u0:number}} cara
 * @param {(string|null)[][]} rejilla
 * @param {{base?:number, celda?:number, saliente?:number, tope?:number}} opciones
 *   `base` es la altura del suelo de la rejilla (0 en un muro, `y0` en la hoja
 *   de una puerta, la cara inferior en un objeto).
 */
export function chapasDeRejilla(cara, rejilla, opciones = {}) {
  const { base = 0, celda = CELDA, saliente = SALIENTE, tope = TOPE_PIEZAS } = opciones;

  // NO HAY RELIEVE GEOMÉTRICO, y consta por si alguien vuelve a intentarlo
  // (#838): esta función tuvo una opción para adelantar cada color unos
  // milímetros y sacarle los costados, con la idea de dar volumen a la pintura
  // de un cuadro. Se retiró MEDIDA. Con y sin ella cambiaban entre 0 y 168
  // píxeles de los 129.600 del fotograma, y ni subiendo el empaste a cinco
  // centímetros pasaba del 0,3 %: lo que se mira de frente enseña sus costados
  // de canto, y a esta resolución un canto de milímetros no llega a un píxel.
  // El volumen que sí se ve aquí es el PINTADO —el bisel de `panelBiselado`—,
  // y por eso el mural entero se dibuja así.

  // Las chapas se agrupan POR COLOR en una sola malla cada una, en vez de
  // devolver una pieza por rectángulo (#551).
  //
  // No es cosmético y no cambia ni un polígono de la salida: quien consume esto
  // llama a `componerEscena` UNA VEZ POR PIEZA, y esa función tiene un coste fijo
  // por llamada —ajustes de época, focal, reservas— que con mil chapas se paga
  // mil veces. Medido en la peor sala del catálogo (reactor, 1029 polígonos):
  // 4,88 ms por fotograma con una pieza por rectángulo, 3,96 ms agrupando por
  // color, con EXACTAMENTE los mismos polígonos en pantalla. Casi un 20% del
  // coste de composición era peaje de llamada, no dibujo.
  //
  // Se puede hacer porque todas las chapas de una cara son coplanares y comparten
  // color de material: una malla con muchas caras sueltas es exactamente lo que
  // `componerEscena` ya sabe recorrer.
  const porColor = new Map();
  const anadir = (color, vertices) => {
    let malla = porColor.get(color);
    if (!malla) {
      malla = { vertices: [], caras: [] };
      porColor.set(color, malla);
    }
    const desde = malla.vertices.length;
    malla.vertices.push(...vertices);
    malla.caras.push(vertices.map((_, i) => desde + i));
  };

  for (const { v, u0, ancho, alto, color } of fundirRectangulos(rejilla).slice(0, tope)) {
    const quad = chapaEnCara(
      cara,
      cara.u0 + u0 * celda,
      cara.u0 + (u0 + ancho) * celda,
      base + v * celda,
      base + (v + alto) * celda,
      saliente,
    );
    anadir(color, quad.vertices);
  }
  return [...porColor].map(([color, malla]) => ({ malla, color }));
}
