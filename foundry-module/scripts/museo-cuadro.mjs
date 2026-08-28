// Los cuadros del museo (#836): obra PLANA colgada de un muro.
//
// POR QUÉ ES UN MÓDULO Y NO CUATRO LÍNEAS EN LA SALA. Un cuadro parece lo más
// fácil que se puede colgar y es lo contrario: el motor no mapea texturas y el
// módulo no admite binarios (regla de arte de `CLAUDE.md`), así que aquí no hay
// ninguna imagen que pegar. Un cuadro se DIBUJA con el mismo primitivo que la
// piel de los muros —`chapasDeRejilla` sobre una cara plana, #548/#550— y todo
// lo que sigue son las consecuencias de eso.
//
// LA CELDA DEL LIENZO ES SUYA, Y ES EL MANDO DE ESCALA DEL CUADRO. La piel del
// muro va a 10 cm (#551) y a esa resolución un lienzo de 1,2 × 0,8 m tiene
// DOCE por OCHO píxeles: no es un cuadro, es un icono. Un cuadro es además la
// superficie del museo que más de cerca se mira, así que baja a 2,5 cm. Lo que
// NO se hace es bajar la celda del mural para conseguirlo: eso movería la piel
// de toda la nave, que es exactamente el fallo de #551 —lo que estaba en filas
// se partió por la mitad en silencio y la franja de aviso de una puerta acabó a
// la altura de la rodilla—. Una celda, un sitio, un consumidor.
//
// EL MARCO LLEVA RELIEVE Y EL LIENZO NO. Un marco es un OBJETO de la sala y se
// ilumina como todo lo demás: canto claro arriba y a la izquierda, canto oscuro
// abajo y a la derecha, el mismo sentido que `panelBiselado` — dos relieves
// iluminados al revés en la misma sala se ven a la primera. La pintura es
// PLANA. Biselarla la convertiría en chapa remachada, que es un material
// equivocado, igual que la cantina apaga la piel de casco en sus muebles de
// madera (#550).
//
// NADA QUE SE PUEDA LEER COMO UN INSTRUMENTO. Es la regla de #526 aplicada
// donde más fácil sería saltársela: un cuadro admite cualquier cosa, así que
// nada impediría colgar una carta estelar, un esquema de la nave o un diagrama.
// Ninguna de las tres se puede colgar. Quien anda por el museo no tiene forma de
// saber que ese mapa no cuenta, y el ornamento no puede abrir por detrás la
// lectura falsa que la superficie cierra por delante. Las composiciones de aquí
// son abstractas por esa razón y no por gusto.
//
// EL PRESUPUESTO ES LA CONDICIÓN, NO UNA OPTIMIZACIÓN POSTERIOR (#551). Un
// lienzo son 48 × 32 celdas más el marco: 1.872 antes de fundir, sobre una sala
// que ya cuesta lo suyo. Pasan por `fundirRectangulos` y por el agrupado por
// color, y además cada composición se COMPRUEBA AL IMPORTAR contra
// `TOPE_CUADRO`: una que se pase revienta al cargar el módulo y no en mitad de
// una visita. Aquí no vale el recorte al tope que sí vale en un muro —en un
// muro sobra un greeble y sigue siendo un muro; en un cuadro se corta la
// pintura por la mitad y se lee como un fallo, que es el mismo motivo por el que
// el suelo va a todo o nada (#552).
//
// Puro: geometría y datos. Sin color propio (#351): todo sale de `CUADRO`.

import { CUADRO } from "./paleta.mjs";
import { chapasDeRejilla, crearLienzo } from "./nave-mural-pixel.mjs";

/**
 * El lado de una celda del lienzo, en metros. El mando de escala del cuadro:
 * tocarlo cambia el tamaño del píxel de TODA la pintura y de nada más.
 */
export const CELDA_LIENZO = 0.025;

/**
 * Cuánto se despega el cuadro del muro. Más que el `SALIENTE` de la piel
 * (1 cm) porque el cuadro va ENCIMA de ella: con el mismo valor, las dos
 * superficies quedarían coplanares y se pelearían por el píxel.
 */
export const SALIENTE_CUADRO = 0.035;

/** Grosor del marco, en celdas. Dos son 5 cm: un listón, no una moldura. */
export const MARCO = 2;

/**
 * Cuántas chapas puede gastar un cuadro. No sale de una intuición: es el
 * presupuesto que las composiciones de hoy cumplen con holgura (ver la medida en
 * la cabecera de la sala) y el número que hay que volver a medir antes de
 * añadir la tercera. Si una composición no cabe, se simplifica el dibujo o se
 * quita un cuadro; nunca se sube la celda.
 */
export const TOPE_CUADRO = 260;

/** Medidas del lienzo pintado, en metros, sin contar el marco. */
export const LIENZO = Object.freeze({ ancho: 1.2, alto: 0.8 });

const COLUMNAS_LIENZO = Math.round(LIENZO.ancho / CELDA_LIENZO);
const FILAS_LIENZO = Math.round(LIENZO.alto / CELDA_LIENZO);

/** Medidas totales del cuadro colgado, marco incluido. Se exportan porque la
 *  sala necesita saber qué hueco de muro ocupa antes de colgar nada. */
export const ANCHO_TOTAL = (COLUMNAS_LIENZO + MARCO * 2) * CELDA_LIENZO;
export const ALTO_TOTAL = (FILAS_LIENZO + MARCO * 2) * CELDA_LIENZO;

/* ---- las composiciones ----------------------------------------------------- */

/**
 * «Campo partido»: dos masas de tierra que no se tocan, separadas por una línea
 * de hueso que no llega a los bordes.
 *
 * Lo que la hace un cuadro y no un patrón es que las masas están DESCENTRADAS:
 * una composición simétrica a esta escala se lee como un botón o como un aviso,
 * y ninguna de las dos cosas es una pintura.
 */
function campoPartido({ rect, linea }, columnas, filas) {
  rect(0, 0, columnas, filas, CUADRO.fondo);
  // La masa baja, ancha y pesada, apoyada fuera de campo por la izquierda.
  rect(2, 0, Math.round(columnas * 0.62), Math.round(filas * 0.46), CUADRO.ocre);
  // La alta, estrecha, entrando por arriba a la derecha: contrapeso, no espejo.
  rect(
    Math.round(filas * 0.38),
    Math.round(columnas * 0.68),
    Math.round(columnas * 0.24),
    filas - Math.round(filas * 0.38),
    CUADRO.bermellon,
  );
  // El corte de luz. Una sola celda de alto y sin llegar a los bordes: si
  // cruzara el lienzo entero sería un horizonte, y un horizonte ya es un sitio.
  linea(Math.round(filas * 0.52), 4, columnas - 12, CUADRO.hueso);
}

/**
 * «Contratiempo de verdín»: cinco masas que NO comparten base, de anchos y
 * alturas sin orden, dos de ellas cortadas por el borde del lienzo.
 *
 * Es la que justifica que haya dos cuadros propios y no uno: la otra es masa
 * contra masa, y esta es ritmo. Pero un ritmo REGULAR no es una pintura, es un
 * instrumento: la primera versión de este cuadro (#838) eran cuatro columnas
 * apoyadas en la misma base, con paso constante, altura estrictamente creciente
 * y un remate claro en el mismo costado de cada una — o sea, barras con sus
 * marcas, y se leía como un nivel en menos de un segundo. Que la cartela dijera
 * «esto no es una medida» era la señal de que sí lo parecía. Lo que rompe esa
 * gramática y hay que conservar al tocar el dibujo:
 *
 * - **ninguna base común**: cada masa arranca a una altura distinta y dos ni
 *   siquiera se apoyan —una cuelga del borde de arriba—, así que no hay eje;
 * - **alturas no monótonas** y anchos desiguales: no se puede ordenar la serie,
 *   que es lo que hace legible un gráfico de barras;
 * - **el hueso, una sola vez y atravesado**: cruza dos masas y el fondo en
 *   horizontal, en vez de rematar cada bloque por igual. Un acento repetido en
 *   el mismo sitio de cada elemento es un tic de escala;
 * - **dos masas cortadas por el borde**: lo que sale del cuadro dice que el
 *   dibujo sigue fuera, y una escala no se sale nunca de su regla.
 */
function contratiempoDeVerdin({ rect, linea }, columnas, filas) {
  rect(0, 0, columnas, filas, CUADRO.fondo);
  // fila, columna, ancho, alto — cortada la primera por la izquierda y la
  // última por la derecha; la segunda cuelga del borde de arriba.
  rect(Math.round(filas * 0.28), 0, 9, Math.round(filas * 0.34), CUADRO.verdin);
  rect(Math.round(filas * 0.56), 12, 6, filas - Math.round(filas * 0.56), CUADRO.ocre);
  rect(Math.round(filas * 0.09), 21, 11, Math.round(filas * 0.16), CUADRO.verdin);
  rect(Math.round(filas * 0.37), 26, 5, Math.round(filas * 0.28), CUADRO.ocre);
  rect(Math.round(filas * 0.19), 38, columnas - 38, Math.round(filas * 0.19), CUADRO.verdin);
  // El único acento de hueso, en horizontal y cruzando lo que se encuentre.
  linea(Math.round(filas * 0.62), 3, 22, CUADRO.hueso);
}

/* ---- las tres interpretadas (#836, segunda tanda) --------------------------- */

// LAS TRES DE ABAJO NO SON INVENTADAS: son REDIBUJOS de tres paisajes de dominio
// público, escogidos porque su composición sobrevive a 48 × 32 píxeles. Lo que
// hace que un cuadro clásico quepa aquí no es que sea famoso, es que se
// reconozca por MASAS: la ola, el cono rojo y la silueta contra la niebla se
// leen enteros a esta resolución, y un retrato o un interior se convertirían en
// una mancha. Qué son exactamente —una interpretación y no una reproducción— lo
// dice la cartela y lo dice el campo `naturaleza`, que por esto tuvo que
// estrenar el valor `interpretacion`: el fichero es nuestro y la composición no.
//
// NO HAY NINGÚN ESCANEO EN EL ÁRBOL, y esa es la diferencia con las estatuas.
// De la fuente CC0 sale la composición, no el fichero: se mira el escaneo y se
// vuelve a dibujar aquí con las mismas cinco decenas de rectángulos que la piel
// de un muro. Por eso no hay `sha256` que comprobar — no hay archivo que se
// haya copiado — y por eso la ficha de `docs/PROCEDENCIA_ASSETS.md` de estos
// tres dice de qué obra vienen y no de qué fichero.

/**
 * Un triángulo isósceles apoyado en su base, dibujado fila a fila.
 *
 * Existe porque las tres composiciones nuevas tienen una montaña, y una montaña
 * dibujada a mano en cada una acabaría con tres perfiles distintos por descuido.
 * Devuelve el ancho de cada fila para que quien quiera rematar la cima en otro
 * color no tenga que recalcularlo.
 */
function cono({ linea }, { centro, base, alto, ancho, color, cima, filasCima = 0 }) {
  for (let i = 0; i < alto; i += 1) {
    const anchoFila = Math.max(1, Math.round(ancho * (1 - i / alto)));
    const tono = cima && i >= alto - filasCima ? cima : color;
    linea(base + i, centro - Math.floor(anchoFila / 2), anchoFila, tono);
  }
}

/**
 * «Frente al mar»: la gran ola por delante, la montaña detrás y muy pequeña.
 *
 * Del original se conserva lo único que cabe: la desproporción. La ola ocupa
 * media tabla y el monte son seis filas al fondo, que es de lo que trata el
 * grabado. La garra de espuma va en escalones y no en curva porque a esta
 * escala una curva son tres píxeles sueltos que se leen como suciedad.
 */
function frenteAlMar({ rect, linea }, columnas, filas) {
  rect(0, 0, columnas, filas, CUADRO.azulPalido); // el cielo, hasta arriba
  rect(0, 0, columnas, Math.round(filas * 0.38), CUADRO.azulProfundo); // el mar
  // El monte al fondo, pequeño y a la derecha del centro.
  cono({ linea }, {
    centro: Math.round(columnas * 0.66),
    base: Math.round(filas * 0.38),
    alto: 6,
    ancho: 13,
    color: CUADRO.niebla,
    cima: CUADRO.espuma,
    filasCima: 2,
  });
  // La ola: tramos de agua que suben hacia la izquierda, cada uno rematado en
  // espuma. Los anchos son múltiplos de cuatro columnas para que `fundirRectangulos`
  // tenga algo que fundir; en píxel a píxel esto no cabría en el presupuesto.
  const tramos = [
    [0, 6, 0.94],
    [6, 5, 0.78],
    [11, 5, 0.6],
    [16, 5, 0.46],
    [21, 4, 0.34],
  ];
  for (const [u0, ancho, altura] of tramos) {
    const alto = Math.round(filas * altura);
    rect(0, u0, ancho, alto, CUADRO.azulProfundo);
    linea(alto - 1, u0, ancho, CUADRO.espuma);
    linea(alto - 2, u0, ancho, CUADRO.espuma);
  }
  // El oleaje corto de la derecha: dos crestas bajas, para que el mar no sea un
  // rectángulo liso al lado de la ola.
  linea(Math.round(filas * 0.3), Math.round(columnas * 0.7), 9, CUADRO.espuma);
  linea(Math.round(filas * 0.22), Math.round(columnas * 0.78), 7, CUADRO.espuma);
}

/**
 * «Viento del sur»: el cono rojo con su nieve, el bosque abajo y las nubes en
 * bandas.
 *
 * Es la más simple de las tres a propósito, y la que mejor demuestra por qué la
 * celda del lienzo tiene que ser suya: a los 10 cm del mural, este cono son
 * cuatro píxeles y un cambio de color.
 */
function vientoDelSur({ rect, linea }, columnas, filas) {
  rect(0, 0, columnas, filas, CUADRO.azulPalido);
  cono({ linea }, {
    centro: Math.round(columnas * 0.44),
    base: Math.round(filas * 0.2),
    alto: Math.round(filas * 0.74),
    ancho: columnas - 4,
    color: CUADRO.bermellon,
    cima: CUADRO.espuma,
    filasCima: 5,
  });
  rect(0, 0, columnas, Math.round(filas * 0.2), CUADRO.verdin); // el bosque
  // Las nubes en banda, arriba y a la derecha. Van por encima del cono porque
  // en el original pasan por delante de la ladera, no por detrás.
  linea(filas - 4, Math.round(columnas * 0.6), 15, CUADRO.espuma);
  linea(filas - 7, Math.round(columnas * 0.68), 11, CUADRO.espuma);
  linea(filas - 10, Math.round(columnas * 0.74), 8, CUADRO.espuma);
}

/**
 * «Sobre la niebla»: una figura de espaldas en lo alto de una peña, y debajo el
 * mar de nubes con las cumbres asomando.
 *
 * La figura se dibuja con el color del FONDO del lienzo y no con un negro
 * propio: a contraluz no hay detalle que enseñar, y el pigmento más oscuro que
 * ya existe hace de silueta sin estrenar ninguno. Es la única de las tres con
 * una persona dentro, y sigue sin ser legible como nada: de espaldas, ocho
 * píxeles de alto y sin cara.
 */
function sobreLaNiebla({ rect, linea }, columnas, filas) {
  rect(0, 0, columnas, filas, CUADRO.azulPalido); // el cielo alto
  rect(0, 0, columnas, Math.round(filas * 0.52), CUADRO.niebla); // el mar de nubes
  // Las cumbres que asoman, a los dos lados y a distinta altura: son la escala
  // de la niebla, sin ellas el gris es un fondo y no una distancia. Van MÁS
  // OSCURAS que el vapor y no más claras: una cumbre más clara que la niebla que
  // la rodea se lee como un roto en la niebla, no como una montaña detrás.
  cono({ linea }, {
    centro: Math.round(columnas * 0.16),
    base: Math.round(filas * 0.5),
    alto: 5,
    ancho: 11,
    color: CUADRO.azulProfundo,
  });
  cono({ linea }, {
    centro: Math.round(columnas * 0.84),
    base: Math.round(filas * 0.46),
    alto: 7,
    ancho: 15,
    color: CUADRO.azulProfundo,
  });
  // La peña, maciza y descentrada, entrando por abajo.
  const anchoPena = Math.round(columnas * 0.3);
  const uPena = Math.round(columnas * 0.36);
  rect(0, uPena, anchoPena, Math.round(filas * 0.3), CUADRO.roca);
  linea(Math.round(filas * 0.3), uPena + 2, anchoPena - 5, CUADRO.roca);
  // La figura: piernas, tronco y cabeza, tres franjas y nada más.
  const uFigura = uPena + Math.round(anchoPena / 2) - 1;
  const base = Math.round(filas * 0.3) + 1;
  rect(base, uFigura, 3, 4, CUADRO.fondo);
  rect(base + 4, uFigura - 1, 5, 3, CUADRO.fondo);
  rect(base + 7, uFigura, 3, 2, CUADRO.fondo);
}

/**
 * De ID a dibujo. El mismo papel que `MALLAS_MUSEO` con las estatuas: la ficha
 * del catálogo dice `malla: "campo-partido"` y aquí se resuelve. Un cuadro no
 * tiene una malla suya —es una rejilla que se convierte en chapas por color—,
 * pero la ficha, el validador y la guarda de referencia no cambian por eso.
 */
export const COMPOSICIONES = Object.freeze({
  "campo-partido": campoPartido,
  "contratiempo-de-verdin": contratiempoDeVerdin,
  "frente-al-mar": frenteAlMar,
  "viento-del-sur": vientoDelSur,
  "sobre-la-niebla": sobreLaNiebla,
});

/**
 * La pintura en coordenadas de rejilla, marco incluido. Se expone aparte de la
 * geometría por el mismo motivo que `rejillaMural`: es LA decisión de dibujo, y
 * es lo que se puede leer en un test sin montar una escena.
 *
 * @param {string} id una clave de `COMPOSICIONES`.
 * @returns {(string|null)[][]} `[fila][columna]`, fila 0 = la de abajo.
 */
export function rejillaCuadro(id) {
  const dibujo = COMPOSICIONES[id];
  if (!dibujo) throw new RangeError(`No hay ninguna composición llamada «${id}».`);
  const columnas = COLUMNAS_LIENZO + MARCO * 2;
  const filas = FILAS_LIENZO + MARCO * 2;
  const lienzo = crearLienzo(columnas, filas);

  // El marco primero, macizo, y encima sus dos cantos. La luz viene de arriba.
  lienzo.rect(0, 0, columnas, filas, CUADRO.marco);
  lienzo.linea(filas - 1, 0, columnas, CUADRO.marcoLuz);
  lienzo.columna(0, 0, filas, CUADRO.marcoLuz);
  lienzo.linea(0, 0, columnas, CUADRO.marcoSombra);
  lienzo.columna(columnas - 1, 0, filas, CUADRO.marcoSombra);

  // La pintura se dibuja en su propio lienzo y se estampa dentro del marco. Se
  // hace así, y no pasándole el offset al dibujo, para que ninguna composición
  // pueda pintar sobre el marco por un índice mal sumado: lo que se sale del
  // lienzo pequeño se pierde ahí, que es lo que ya garantiza `crearLienzo`.
  const pintura = crearLienzo(COLUMNAS_LIENZO, FILAS_LIENZO);
  dibujo(pintura, COLUMNAS_LIENZO, FILAS_LIENZO);
  for (let v = 0; v < FILAS_LIENZO; v += 1) {
    for (let u = 0; u < COLUMNAS_LIENZO; u += 1) {
      const color = pintura.rejilla[v][u];
      if (color) lienzo.poner(v + MARCO, u + MARCO, color);
    }
  }
  return lienzo.rejilla;
}

/**
 * Las chapas de un cuadro colgado, listas para la lista de mobiliario de
 * `crearSalaCaja`.
 *
 * @param {object} opciones
 * @param {{eje:"x"|"z", plano:number, sentido:1|-1}} opciones.cara la cara
 *   interior del muro del que cuelga, en la convención de `chapaEnCara`.
 * @param {number} opciones.u dónde empieza el cuadro a lo largo de esa cara, en
 *   metros de mundo (una z si el muro es lateral, una x si es de fondo).
 * @param {number} opciones.cota altura del borde INFERIOR del marco.
 * @param {string} opciones.composicion clave de `COMPOSICIONES`.
 * @returns {{malla:object, color:string}[]}
 */
export function piezasCuadro({ cara, u, cota, composicion }) {
  return chapasDeRejilla({ ...cara, u0: u }, rejillaCuadro(composicion), {
    base: cota,
    celda: CELDA_LIENZO,
    saliente: SALIENTE_CUADRO,
    tope: TOPE_CUADRO,
  });
}

/**
 * Cuántas chapas gasta una composición después de fundir. Es la medida que hay
 * que pegar en el PR al tocar un dibujo, y la que comprueba la guarda de abajo.
 */
export function costeCuadro(composicion) {
  return piezasCuadro({
    cara: { eje: "z", plano: 0, sentido: 1 },
    u: 0,
    cota: 0,
    composicion,
  }).reduce((total, { malla }) => total + malla.caras.length, 0);
}

// LA GUARDA, AL IMPORTAR. Una composición que se pase del tope no se recorta
// —media pintura se lee como un fallo—, así que revienta aquí y no dentro de la
// sala: el mismo criterio que el catálogo de asistencia, donde una tarea rota
// falla al cargar y no en mitad de una crisis.
for (const composicion of Object.keys(COMPOSICIONES)) {
  const coste = costeCuadro(composicion);
  if (coste > TOPE_CUADRO) {
    throw new RangeError(
      `La composición «${composicion}» gasta ${coste} chapas y el tope es ${TOPE_CUADRO}. ` +
        "Simplifica el dibujo o cuelga un cuadro menos; NO subas CELDA_LIENZO.",
    );
  }
}
