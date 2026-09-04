// Puesta en escena del libro interactuable del museo (#853, vertical 2): junta
// `libro-geometria.mjs` (la malla) y `libro-pagina.mjs` (el dibujo de la
// hoja) con una posición fija en la sala, y las compone con la MISMA cámara
// que usa el resto de la sala (`nave-camara.resolverCamara`,
// `retro3d.componerEscena`) para que `fundirEscenas` (#510) pueda mezclar sus
// polígonos con los de `museo-escena.mjs` sin que nadie tenga que saber que
// son dos mallas distintas.
//
// EL LIBRO SE PLANTA DE PIE, no tumbado sobre un atril inclinado: lomo
// vertical, como un facistol de coro para un libro grande. Así el eje "alto"
// de `libroGeometria` (z local) cae directo sobre la vertical de la sala (`y`)
// sin inventar una inclinación ni un segundo sistema de referencia. Es la
// lectura MÁS simple de las que caben en el eje local del libro, y coincide
// con el vertical mínimo del issue: sin curvatura, una hoja en vuelo, un plano
// rígido — nada de esto pretende ser el atril definitivo, es lo que hace falta
// para que "acercarse, abrir, pasar página" sea real y medible.
//
// LA PÁGINA SE PEGA A LA HOJA CON SU PROPIO TRANSFORM, no con
// `libro-pagina.colocarPagina`: esa función asume una cara de PARED (normal en
// x o z, la convención de `chapaEnCara` en `nave-mural-pixel.mjs`), y la cara
// visible de la hoja tiene la normal en SU eje y (es una placa fina). En vez
// de forzar esa convención, se toma `mallaPagina(semilla)` —ya centrada, con
// sus propias medidas iguales a las del libro (`ANCHO_PAGINA`/`ALTO_PAGINA`,
// pasadas también a `libroGeometria` para que cubierta y página compartan
// tamaño)— y se le aplica EXACTAMENTE el mismo giro y empuje que
// `libro-geometria.mjs` aplica a la hoja internamente (rotación en z por
// `β = π/2 − hojaVuelo`, empuje en y por `grosor`), para que quede pegada a su
// cara superior sin duplicar la cadena de transformación entera.
//
// PRESUPUESTO (medido 2026-09-02, Node puro, `node --print`, sin lienzo):
// libro cerrado → 32 vértices / 24 caras (solo el cuerpo; sin página, ver
// más abajo). Libro abierto con la hoja a mitad de vuelo (el peor caso real,
// una página visible) → 32 vértices / 24 caras del cuerpo + hasta
// `TOPE_PAGINA` (60) caras de UNA sola página = 84 caras como mucho. Frente a
// las ~900-1200 caras de la sala más cara medida en #551/#555, es una
// fracción de lo que cuesta un solo mueble — y se paga SOLO mientras el libro
// está abierto: cerrado (`estado.fase === "cerrado"` sin transición) esta
// puesta en escena no compone nada y devuelve la sala tal cual.
//
// Ni Foundry, ni DOM. Recibe el estado ya evaluado (de `libro-sesion.mjs`,
// con el reloj de la ESCENA — `opciones.tiempo`, no un `Date.now()` propio) y
// compone. Se prueba desde Node con mallas de mentira y un estado a mano.

import { componerEscena, fundirEscenas } from "./retro3d.mjs";
import { resolverCamara } from "./nave-camara.mjs";
import { libroGeometria } from "./libro-geometria.mjs";
import { mallaPagina, ANCHO_PAGINA, ALTO_PAGINA } from "./libro-pagina.mjs";
import { PAGINA } from "./paleta.mjs";
import { componerMuseo, ATRIL_LIBRO } from "./museo-escena.mjs";
import { estadoLibroAhora } from "./libro-sesion.mjs";

/** Grosor de cada tapa/hoja, en metros — el mismo valor por defecto de
 *  `libroGeometria`, declarado aquí porque el transform de la página también
 *  lo necesita para calcular el empuje sobre la hoja. */
const GROSOR = 0.02;

/** Cuántas páginas tiene la única obra del catálogo (#853, vertical mínimo:
 *  pocas bastan para probar "abrir, pasar, pasar, cerrar" de principio a fin
 *  sin que la demo se alargue). Cada página usa una semilla distinta de
 *  `rejillaPagina`, así que no se repite la misma mancha dos veces seguidas. */
export const PAGINAS_LIBRO = 5;

/** Semilla base: la página N usa `SEMILLA_LIBRO_BASE + n`, determinista y
 *  reproducible entre fotogramas y entre pruebas. */
const SEMILLA_LIBRO_BASE = 853000;

function rotarZ([x, y, z], angulo) {
  const c = Math.cos(angulo);
  const s = Math.sin(angulo);
  return [x * c - y * s, x * s + y * c, z];
}

function trasladar([x, y, z], [dx, dy, dz]) {
  return [x + dx, y + dy, z + dz];
}

/** Coloca una malla ya expresada en el sistema propio del libro (el que
 *  produce `libroGeometria`: bisagra en x=0, altura en z) sobre el atril de
 *  la sala: gira por su `yaw` y traslada a su `(x, altura, z)`. El eje local
 *  z (altura del libro) cae en el eje vertical de la sala (`y`), que es la
 *  decisión de "de pie" explicada en la cabecera. */
function colocarEnAtril(malla, atril) {
  const c = Math.cos(atril.yaw);
  const s = Math.sin(atril.yaw);
  return {
    vertices: malla.vertices.map(([lx, ly, lz]) => [
      atril.x + lx * c - ly * s,
      atril.altura + lz,
      atril.z + lx * s + ly * c,
    ]),
    caras: malla.caras,
  };
}

/**
 * La página, transformada al mismo sistema que produce `libroGeometria` para
 * su hoja: mismo giro (`β = π/2 − hojaVuelo`) y mismo empuje (`grosor`) que
 * `transformar(hoja, β, grosor)` aplica internamente. `mallaPagina` entrega la
 * página centrada con la normal en su propio eje x (`x≈0`, y=altura,
 * z=anchura); aquí se remapea a las coordenadas locales de la hoja
 * (x=anchura invertida desde la bisagra, y=un pelo por encima de la cara,
 * z=altura) antes de aplicar ese giro/empuje.
 */
function paginaSobreHoja(semilla, hojaVuelo) {
  const pagina = mallaPagina(semilla);
  const beta = Math.PI / 2 - hojaVuelo;
  // `mallaPagina` entrega la página con la normal en su propio eje x (siempre
  // ~0, es un plano sin relieve), altura en y, anchura en z. Se remapea a las
  // coordenadas LOCALES de la hoja de `libroGeometria` (anchura en x medida
  // desde la bisagra en 0 hasta -ancho, altura en z, y un pelo por encima de
  // la cara en y) y LUEGO se le aplica el mismo giro/empuje que
  // `libro-geometria.mjs` aplica a la hoja: rotar en z por `β` y trasladar en
  // y por `GROSOR`.
  const enLocalDeLaHoja = pagina.vertices.map(([, py, pz]) => [
    -(pz + ANCHO_PAGINA / 2),
    GROSOR / 4 + 0.003,
    py,
  ]);
  return {
    vertices: enLocalDeLaHoja.map((v) => trasladar(rotarZ(v, beta), [0, GROSOR, 0])),
    caras: pagina.caras,
  };
}

/**
 * Las piezas del libro en el sistema de coordenadas DEL ATRIL (sin cámara
 * todavía): el cuerpo (tapas+lomo+hoja) de un único color, y la página de la
 * hoja que gira solo cuando hay algo que ver.
 *
 * Exportada para pruebas: comprobar el umbral de la página (`apertura > 0.05`)
 * contando polígonos de la escena compuesta es frágil —el propio cuerpo
 * cambia de silueta según el recorte de cámara en cuanto `apertura` se mueve
 * un poco—, así que la prueba real llama a esta función directamente.
 */
export function piezasLibroEnSala(estado) {
  const cuerpo = libroGeometria(estado.apertura, estado.hojaVuelo, ANCHO_PAGINA, ALTO_PAGINA, GROSOR);
  const piezas = [{ malla: colocarEnAtril(cuerpo, ATRIL_LIBRO), color: PAGINA.tapa }];

  // Por debajo de este ángulo el libro está prácticamente cerrado y no se ve
  // ni rastro de página: componer 60 caras extra para nada sería pagar el
  // presupuesto de la cabecera sin que nadie lo note.
  if (estado.apertura > 0.05) {
    const semilla = SEMILLA_LIBRO_BASE + estado.paginaActual;
    const pagina = paginaSobreHoja(semilla, estado.hojaVuelo);
    piezas.push({ malla: colocarEnAtril(pagina, ATRIL_LIBRO), color: PAGINA.papel });
  }

  return piezas;
}

/**
 * Compone la sala del museo CON el libro encima: la sala estática
 * (`componerMuseo`, sin cambios) más el libro, evaluado hasta `opciones.tiempo`
 * y fundido con `fundirEscenas`. Con el libro cerrado y sin transición no se
 * compone nada extra — se devuelve la sala tal cual, que es el caso común
 * (nadie ha llegado nunca al atril).
 *
 * Misma firma que cualquier `componer` de `nave-sala-caja.crearSalaCaja`:
 * esto es lo que entra en `nave-catalogo-andar.mjs` en vez de `componerMuseo`
 * a secas.
 */
export function componerMuseoConLibro(x, y, z, yaw, opciones = {}) {
  const base = componerMuseo(x, y, z, yaw, opciones);
  const {
    ancho: anchoLienzo = 480, alto: altoLienzo = 270, epoca, fov = 62, modoCamara, tiempo,
  } = opciones;

  // Sin fallback a `Date.now()`: mezclar el reloj monotónico del bucle
  // (`opciones.tiempo`, ver cabecera) con el reloj de pared en cualquier
  // punto de la cadena es justo el bug que congelaba la apertura (revisión
  // de VaroTv7 en #914) — si `tiempo` no llega finito, `estadoLibroAhora`
  // debe fallar alto y no disimularlo con otro reloj.
  const estado = estadoLibroAhora(tiempo);
  if (estado.fase === "cerrado" && !estado.transicion) return base;

  const { camara } = resolverCamara({ x, z, y, yaw, modo: modoCamara });
  const yawCamara = -yaw;

  const piezasCompuestas = piezasLibroEnSala(estado).map(({ malla, color }) =>
    componerEscena(
      { vertices: malla.vertices.map((v) => trasladar(v, [-camara[0], -camara[1], -camara[2]])), caras: malla.caras },
      {
        ancho: anchoLienzo,
        alto: altoLienzo,
        epoca,
        fov,
        color,
        posicion: [0, 0, 0],
        yaw: yawCamara,
        recorteLateral: true,
        luzFija: true,
      },
    ),
  );

  const fundido = fundirEscenas([base, ...piezasCompuestas]);
  return { ...base, poligonos: fundido.poligonos };
}
