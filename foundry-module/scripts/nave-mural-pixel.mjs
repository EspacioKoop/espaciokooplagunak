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
// que sí se mira de cerca: juntas de panel, remaches, un conducto y parches de
// blindaje. Ni una barra, ni una cifra, ni una escala, ni una marcación — un
// dial pintado en el muro sería un instrumento que nadie ha calculado, y quien
// anda por la nave no tiene forma de saber que ese no cuenta. Lo que hay aquí
// es chapa: no admite lectura ni siquiera equivocándose.
//
// EL FONDO NO SE PINTA. Solo se emiten los píxeles que NO son el color del muro,
// y las tiradas contiguas de un mismo color se funden en UN polígono
// (`fundirTiradas`). Sin eso, un muro de 8 m serían 40x19 = 760 caras por muro y
// por fotograma; con eso son unas pocas decenas. `piezasMuralPixel` respeta un
// tope duro (`TOPE_PIEZAS`) y prefiere quedarse corta a hundir el fotograma:
// el mural es adorno, y un adorno no puede costar la fluidez de andar.
//
// Medido sobre el catálogo real (2026-08-10, las catorce estancias, 480x270,
// época psx): los polígonos VISIBLES por fotograma pasan de 20–86 a 122–299, y
// componer la peor sala (la cantina) cuesta 1,3 ms. Con la piel de puertas y
// objetos encima (#550) el techo queda en 327 y 1,45 ms. Cabe de sobra, y es la
// cifra que hay que volver a medir antes de subir la densidad de cualquiera de
// las tres — no la sensación de que «unos rectángulos más dan igual».
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
 * El píxel del mural, en metros. 0.2 y no 0.1: a la altura de ojos (1.45) y con
 * la resolución interna baja de la época PSX, un píxel de 10 cm se convierte en
 * ruido a dos pasos de la pared —el mismo motivo por el que el cielo `psx` lleva
 * pocas estrellas y crudas—. A 20 cm un remache sigue siendo un remache cuando
 * te acercas y no desaparece cuando te alejas.
 */
export const CELDA = 0.2;

/**
 * Cuánto sobresale la chapa de la cara del muro. Suficiente para que el z-buffer
 * del bucle de andar la resuelva siempre por delante, y demasiado poco para que
 * se vea el canto (no lo hay: son caras sueltas, no cajas).
 */
export const SALIENTE = 0.01;

/** Ancho de un panel de casco, en píxeles de mural: 8 x 0.2 = 1.6 m. */
const PANEL_ANCHO = 8;
/** Alto de un panel: 9 x 0.2 = 1.8 m, apenas por encima de una persona. */
const PANEL_ALTO = 9;

/**
 * Tope duro de polígonos por tramo de muro. Un muro de 8 m da del orden de 60
 * piezas ya fundidas; 160 deja margen de sobra para una sala grande y aun así
 * corta en seco un mural que se desbocara. Se corta por el final de la lista
 * (los rasgos van de más estructural a más anecdótico), así que lo que se pierde
 * primero son los parches, no las juntas.
 */
export const TOPE_PIEZAS = 160;

/**
 * A qué fila va el conducto de servicio. 13 x 0.2 = 2.6 m: por encima de la
 * cabeza y por debajo del dintel de una puerta (2.8), así que cruza el muro sin
 * chocar con ningún hueco a la altura a la que se mira.
 */
const FILA_CONDUCTO = 13;

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
  const rejilla = Array.from({ length: filas }, () => new Array(columnas).fill(null));
  const poner = (v, u, color) => {
    if (v < 0 || v >= filas || u < 0 || u >= columnas) return;
    rejilla[v][u] = color;
  };

  // 1. Juntas de panel. La chapa de una nave viene en planchas, y la junta entre
  //    dos planchas es lo único que hace que una pared plana tenga tamaño: sin
  //    ellas no hay con qué medir a ojo lo grande que es la sala.
  for (let u = PANEL_ANCHO; u < columnas; u += PANEL_ANCHO) {
    for (let v = 0; v < filas; v += 1) poner(v, u, MURAL.junta);
  }
  for (let v = PANEL_ALTO; v < filas; v += PANEL_ALTO) {
    for (let u = 0; u < columnas; u += 1) poner(v, u, MURAL.junta);
  }

  // 2. Remaches en los cruces de junta. Un píxel suelto y claro: es el rasgo que
  //    se lee de cerca, cuando las juntas ya son demasiado grandes para verse.
  for (let u = PANEL_ANCHO; u < columnas; u += PANEL_ANCHO) {
    for (let v = PANEL_ALTO; v < filas; v += PANEL_ALTO) poner(v, u, MURAL.remache);
  }

  // 3. El conducto de servicio: una línea horizontal continua por encima de la
  //    cabeza, con abrazaderas cada metro y medio. Es lo que dice «esto es un
  //    barco y por dentro pasan cosas» sin decir qué pasa por ahí — un conducto
  //    no afirma ningún caudal.
  if (filas > FILA_CONDUCTO + 1) {
    for (let u = 0; u < columnas; u += 1) poner(FILA_CONDUCTO, u, MURAL.conducto);
    for (let u = 3; u < columnas; u += 7) {
      poner(FILA_CONDUCTO, u, MURAL.abrazadera);
      poner(FILA_CONDUCTO + 1, u, MURAL.abrazadera);
    }
  }

  // 4. Parches de blindaje, uno como mucho por panel y solo si sale. Rompen la
  //    repetición: con juntas perfectamente regulares y nada más, el muro se lee
  //    como papel pintado. La tirada se hace panel a panel y SIEMPRE en el mismo
  //    orden, así que la semilla fija el resultado entero.
  for (let panelU = 0; panelU * PANEL_ANCHO < columnas; panelU += 1) {
    for (let panelV = 0; panelV * PANEL_ALTO < filas; panelV += 1) {
      if (azar() > 0.45) continue;
      const anchoParche = 2 + Math.floor(azar() * 3);
      const altoParche = 2 + Math.floor(azar() * 2);
      const u0 = panelU * PANEL_ANCHO + 1 + Math.floor(azar() * Math.max(1, PANEL_ANCHO - anchoParche - 1));
      const v0 = panelV * PANEL_ALTO + 1 + Math.floor(azar() * Math.max(1, PANEL_ALTO - altoParche - 1));
      for (let du = 0; du < anchoParche; du += 1) {
        for (let dv = 0; dv < altoParche; dv += 1) {
          // El parche no pisa el conducto: una chapa remachada por encima de un
          // tubo de servicio es justo lo que nadie monta.
          if (v0 + dv === FILA_CONDUCTO) continue;
          poner(v0 + dv, u0 + du, MURAL.parche);
        }
      }
    }
  }

  return rejilla;
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
  return fundirTiradas(rejilla)
    .slice(0, tope)
    .map(({ v, u0, ancho, color }) => ({
      malla: chapaEnCara(
        cara,
        cara.u0 + u0 * celda,
        cara.u0 + (u0 + ancho) * celda,
        base + v * celda,
        base + (v + 1) * celda,
        saliente,
      ),
      color,
    }));
}
