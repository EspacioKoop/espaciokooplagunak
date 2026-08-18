// El matte painting del horizonte (#584, #589).
//
// QUÉ ES. Una banda pintada a lo lejos, alrededor de todo. Es el truco más viejo
// del cine —Ben-Hur tiene más matte que decorado— y sirve aquí por el mismo
// motivo que allí: lo que está a diez kilómetros no se puede construir, y no
// hace falta, porque nadie va a ir. Lo que hay que dar es la LECTURA de que
// existe.
//
// POR QUÉ ES EL PRIMER SITIO DONDE ENTRA UNA TEXTURA. El motor sabe texturar
// desde #573, y hasta ahora ninguna superficie lo usaba. Un matte es el
// consumidor ideal para estrenarlo: no tilea —es una imagen, entera, una vez—,
// va uno por escena, y es exactamente lo que un asset prerenderizado ES. Las
// pieles de la nave, que sí tilean y cambian de tamaño con cada vano, son un
// problema distinto y llegan después.
//
// Y NO HACE FALTA UN ATLAS. Se probó pensando que el motor admitía una sola
// textura por escena; no es cierto. `fundirEscenas` mezcla los polígonos de
// varias llamadas a `componerEscena`, cada una con la suya, y el rasterizador
// lee `poligono.textura` polígono a polígono. Un atlas además ROMPERÍA el
// tileado: `muestrearTextura` envuelve con módulo sobre la textura entera, así
// que una piel metida en una esquina de un atlas no puede repetirse.
//
// EL MOVIMIENTO ES LEVE Y ES LA MITAD DEL EFECTO. Un horizonte quieto se lee
// como un telón pintado, que es literalmente lo que es. Con la banda derivando
// muy despacio —una vuelta entera en más de diez minutos— deja de leerse como
// telón y pasa a leerse como nubes muy lejanas, sin que nadie llegue a ver
// moverse nada. Es deriva de UV, no de geometría: no cuesta un vértice.
//
// Y VARIAS CAPAS A DISTINTA PROFUNDIDAD, que es de donde sale el relieve. Es la
// cámara multiplano de Disney y el fondo por capas de cualquier juego 2D, y el
// principio es el mismo en los tres sitios: lo cercano se desplaza más que lo
// lejano cuando el que mira se mueve, y el ojo lee ESA DIFERENCIA como
// distancia. Una sola banda, por bien pintada que esté, no puede darla.
//
// El mando lo lleva `seguimiento`: cuánto acompaña una capa a la cámara. A 1 la
// capa va clavada al observador y está infinitamente lejos —nunca se desplaza—;
// por debajo de 1 se queda atrás al andar, y esa demora es la que la acerca.
// Andar por la playa despega las capas unas de otras, que es justo lo que un
// horizonte pintado en una sola lámina no hace nunca.
//
// Puro y sin color propio (#351): los colores salen de `PLAYA` en `paleta.mjs`,
// y el dibujo se genera aquí — no es arte de terceros (#571).

import { PLAYA } from "./paleta.mjs";
import { rngSemilla } from "./ventana-nave.mjs";

/** La medida de la banda, en téxeles. Ancha y baja: es un horizonte. */
/**
 * La medida de la banda, en téxeles. Ancha y baja: es un horizonte.
 *
 * SUBIRLA CUESTA LINEAL Y NO EXPONENCIAL, que es lo que permite ser generoso:
 * el codificador de PNG escribe en bloques `stored` —sin comprimir, para no
 * depender de `zlib` ni de `CompressionStream`, que no existen en las dos
 * plataformas a la vez—, así que un téxel es un byte y punto. A esta medida son
 * unos 165 KB por capa. El día que haga falta el doble, lo que hay que meter
 * antes es un deflate de verdad en `png-indexado.mjs`, no bajar el dibujo.
 */
export const ANCHO_MATTE = 1024;
export const ALTO_MATTE = 160;

/** La semilla del matte de la playa. Fija: un horizonte no se sortea en cada carga. */
export const SEMILLA_PLAYA = 20260824;

/**
 * Pinta el matte: cielo degradado, un banco de nubes y una costa lejana.
 *
 * SE LEE DE ABAJO ARRIBA porque así es como se mira: la fila 0 es el horizonte
 * y la última, el cenit de la banda.
 *
 * La costa va MUY baja y muy poco contrastada. Es la tentación clásica del
 * matte: dibujar unas montañas bonitas que se comen el cuadro. Lo que hace que
 * un fondo funcione es que casi no se vea — perspectiva aérea, que es lo mismo
 * que ya hace la niebla del motor con lo cercano.
 */
export function rejillaHorizonte({
  ancho = ANCHO_MATTE,
  alto = ALTO_MATTE,
  semilla = SEMILLA_PLAYA,
  contenido = "costa",
} = {}) {
  const azar = rngSemilla(semilla >>> 0);
  // Vacía, no de color cielo: lo que no se pinta tiene que DEJAR VER la capa de
  // detrás. Solo el fondo del todo se permite ser opaco.
  const rejilla = Array.from({ length: alto }, () => new Array(ancho).fill(null));
  const enRango = (v, u, color) => {
    if (v >= 0 && v < alto && color) rejilla[v][((u % ancho) + ancho) % ancho] = color;
  };

  if (contenido === "costa") return pintarCosta(rejilla, { ancho, alto, azar, enRango });
  return pintarNubes(rejilla, { ancho, alto, azar, enRango, jirones: contenido === "jirones" });
}

/**
 * El fondo: cielo escalonado, sol tumbado, bruma y dos líneas de costa.
 *
 * DOS LÍNEAS Y NO UNA, que es la diferencia entre un perfil y un paisaje. Una
 * silueta suelta se lee como un recorte de cartón por buena que sea su forma;
 * dos, la de atrás más clara y más alta y la de delante más oscura y más baja,
 * se leen como distancia — porque es exactamente la información que da la
 * perspectiva aérea: lo que está más lejos tiene más aire delante y por eso se
 * lava hacia el color del cielo. Es el mismo principio que Leonardo escribió y
 * que ya gobierna la niebla del motor, aplicado dentro de una imagen plana.
 */
function pintarCosta(rejilla, { ancho, alto, azar, enRango }) {
  // --- EL CIELO, EN ESCALONES. Un solo tono es un telón y un degradado fino no
  //     cabe en esta paleta; cuatro bandas con cantos limpios dan la sensación
  //     de que el cielo se aclara al bajar sin inventar colores que no hay.
  const escalones = [
    { hasta: 1.0, color: PLAYA.cielo },
    { hasta: 0.62, color: PLAYA.cielo },
    { hasta: 0.36, color: PLAYA.espuma },
    { hasta: 0.2, color: PLAYA.espuma },
  ];
  for (let v = 0; v < alto; v += 1) {
    const t = v / alto;
    const banda = escalones.find((e) => t <= e.hasta) ?? escalones[0];
    for (let u = 0; u < ancho; u += 1) rejilla[v][u] = banda.color;
  }

  // --- EL RESPLANDOR DEL SOL, tumbado sobre el horizonte y en un solo sitio.
  //     El sol de la escena está sobre el mar; que el cielo se caliente justo
  //     ahí y no en toda la banda es lo que dice de dónde viene la luz, y lo
  //     que ata el matte a la iluminación del resto en vez de dejarlo flotando
  //     como una imagen de otra hora.
  const centroSol = Math.round(ancho * 0.26);
  const radio = Math.round(ancho * 0.22);
  for (let du = -radio; du <= radio; du += 1) {
    const caida = 1 - Math.abs(du) / radio;
    // MUY TUMBADO. La primera versión subía hasta un tercio de la banda y salía
    // un triángulo blanco que se leía como una montaña nevada — el resplandor de
    // un sol bajo se EXTIENDE a lo ancho del horizonte, no se levanta.
    const altura = Math.round(alto * 0.1 * caida);
    for (let v = 0; v < altura; v += 1) enRango(v, centroSol + du, PLAYA.espuma);
    // Y el corazón cálido, pegado al horizonte y estrecho: es un apunte, no un
    // amanecer. Ancho, se comería el cielo entero.
    if (caida > 0.75) enRango(0, centroSol + du, PLAYA.luzSol);
    if (caida > 0.9) enRango(1, centroSol + du, PLAYA.luzSol);
  }

  // --- LA BRUMA de la línea del horizonte: las filas de más abajo, más claras.
  //     Es de las cosas que nadie mira y todo el mundo nota — a ras de horizonte
  //     hay cien kilómetros de aire de por medio, y el cielo no es del mismo
  //     tono ahí que a treinta grados. Sin ella la banda empalma con el mar por
  //     un canto duro y se lee como telón.
  const bruma = Math.max(3, Math.round(alto * 0.12));
  for (let v = 0; v < bruma; v += 1) {
    for (let u = 0; u < ancho; u += 1) rejilla[v][u] = PLAYA.espuma;
  }

  // --- LAS DOS COSTAS. Cada una es una suma de armónicos de la vuelta ENTERA
  //     —cada término da un número entero de ciclos— y por eso la última columna
  //     empalma con la primera. Una junta en el horizonte delata el truco de golpe.
  const perfil = (crestas, escala, fase0) => {
    const fases = Array.from({ length: crestas }, () => azar() * Math.PI * 2 + fase0);
    const pesos = Array.from({ length: crestas }, (_, i) => (0.9 / (i + 1)) * (0.55 + azar() * 0.9));
    return (u) => {
      const t = (u / ancho) * Math.PI * 2;
      let h = 0;
      for (let i = 0; i < crestas; i += 1) h += Math.sin(t * (i + 1) + fases[i]) * pesos[i];
      return Math.max(0, Math.round((h + 1.15) * escala));
    };
  };

  // La de atrás: más alta, más lavada, y con la cumbre cogiendo algo de luz.
  const lejana = perfil(14, bruma * 0.95, 0);
  for (let u = 0; u < ancho; u += 1) {
    const cumbre = lejana(u);
    for (let v = 0; v < cumbre; v += 1) {
      // Perspectiva aérea: lo de más lejos es lo MÁS LAVADO, casi el color del
      // cielo. Es lo que la primera versión tenía del revés.
      enRango(v, u, v === cumbre - 1 && cumbre > 2 ? PLAYA.espuma : PLAYA.marLejos);
    }
  }

  // La de delante: más baja, más oscura y más quebrada. Al recortarse contra la
  // otra aparecen valles, que es lo que convierte dos curvas en un relieve.
  const cercana = perfil(22, bruma * 0.6, 1.7);
  for (let u = 0; u < ancho; u += 1) {
    const cumbre = cercana(u);
    for (let v = 0; v < cumbre; v += 1) {
      // La de delante, un punto más oscura y más azul. En pardo se leía como
      // una loma a dos kilómetros y rompía la distancia de toda la banda: a
      // veinte kilómetros no queda color propio, queda azul.
      enRango(v, u, v === cumbre - 1 && cumbre > 1 ? PLAYA.marLejos : PLAYA.sombraCielo);
    }
  }

  return rejilla;
}

/**
 * Las capas de nubes: casi todo vacío, y con VOLUMEN.
 *
 * La primera versión eran tiradas de un téxel de alto repartidas al azar, y el
 * cielo se leía a rayas. Una nube no es una raya: es un montón con la panza
 * plana. Se dibuja como una pila de tiradas que se acortan hacia arriba —eso da
 * el montón—, con la fila de arriba en el tono claro y la de abajo en el
 * oscuro, que es lo único que hace falta para que se lea de qué lado le da el
 * sol. Con dos colores y ninguna curva.
 */
function pintarNubes(rejilla, { ancho, alto, azar, enRango, jirones }) {
  const racimos = jirones ? 16 : 34;
  const desde = jirones ? 1 : Math.floor(alto * 0.22);
  for (let r = 0; r < racimos; r += 1) {
    const centroU = Math.floor(azar() * ancho);
    const base = desde + Math.floor(azar() * Math.max(1, alto - desde - 6));
    // Los jirones de delante son más largos y más planos: es lo que hace que
    // CRUCEN en vez de posarse, y lo que los distingue del banco de fondo aunque
    // los dos usen los mismos dos colores.
    // LAS DOS CAPAS TIENEN FORMAS DISTINTAS, y no es adorno: es lo que hace
    // legible el multiplano. Si las tres profundidades pintaran lo mismo, mover
    // la cámara solo produciría un deslizamiento raro; con cúmulos compactos
    // detrás y jirones largos y planos delante, el ojo SEPARA las capas incluso
    // en una imagen quieta, y el movimiento solo confirma lo que ya veía.
    const largo = jirones ? 70 + Math.floor(azar() * 150) : 18 + Math.floor(azar() * 40);
    const pisos = jirones ? 3 + Math.floor(azar() * 2) : 5 + Math.floor(azar() * 7);
    const u0 = centroU - Math.floor(largo / 2);
    for (let piso = 0; piso < pisos; piso += 1) {
      // Cada piso se acorta y se desplaza un poco: apilados a plomo saldría un
      // escalón simétrico, que no es una nube sino una pirámide.
      // El estrechamiento es SUAVE. Con `largo * piso / (pisos + 1)` los pisos
      // altos salían de ancho cero y el cúmulo se quedaba en sus dos primeras
      // filas — de ahí que siguieran leyéndose como rayas por mucho grosor que
      // se les diera. Repartido entre el doble de pisos, la nube conserva cuerpo
      // hasta arriba y solo se redondea.
      const encoge = Math.round((largo * piso) / (pisos * 2.4));
      const sesgo = Math.round((azar() - 0.5) * 6);
      const desdeU = u0 + Math.floor(encoge / 2) + sesgo;
      const hastaU = u0 + largo - Math.ceil(encoge / 2) + sesgo;
      // CADA PISO TIENE GROSOR, y a esta resolución es imprescindible. Con un
      // piso = una fila, un cúmulo de cinco pisos medía cinco téxeles de alto
      // por cuarenta de ancho: la proporción de una raya, no la de una nube. El
      // grosor sale de la altura de la banda, así que subir la resolución no
      // vuelve a aplanarlas.
      const grosor = Math.max(1, Math.round(alto * (jirones ? 0.008 : 0.014)));
      const v = base + piso * grosor;
      // Arriba coge la luz, abajo se queda en sombra: es todo el modelado que
      // necesita una nube a esta distancia.
      //
      // Y LA PANZA NO PUEDE SER DEL COLOR DEL CIELO, que es lo que era y por lo
      // que las nubes salían como rayas de un píxel: los pisos de abajo estaban
      // pintados del mismo tono que el fondo, o sea, no estaban. La base va en
      // un azul más frío —que es de lo que se ve la panza de una nube— y solo la
      // fila de arriba coge la luz.
      const tono = piso === pisos - 1 ? PLAYA.espuma : piso === 0 ? PLAYA.marLejos : PLAYA.cielo;
      for (let capa = 0; capa < grosor; capa += 1) {
        for (let u = desdeU; u < hastaU; u += 1) enRango(v + capa, u, tono);
      }
    }
    // Y una cola fina a sotavento, que es lo que le quita el aire de bloque.
    const cola = Math.floor(azar() * 34);
    const grosorCola = Math.max(1, Math.round(alto * 0.008));
    for (let i = 0; i < cola; i += 1) {
      for (let capa = 0; capa < grosorCola; capa += 1) enRango(base + capa, u0 + largo + i, PLAYA.marLejos);
    }
  }
  return rejilla;
}

/**
 * El índice que significa «aquí no hay nada».
 *
 * HACE FALTA UN VALOR EXPLÍCITO porque los dos formatos que hay que casar
 * numeran distinto, y es un desajuste que muerde en silencio: el PNG indexado
 * reserva su entrada 0 para el hueco (la declara transparente en `tRNS`), y el
 * rasterizador de `retro3d-lienzo.mjs` indexa `paleta` desde 0. O sea que el
 * índice 3 no significa lo mismo a un lado y al otro.
 *
 * La forma de RUNTIME manda —es la que se pinta— y el hueco se representa con un
 * índice fuera de paleta, que es lo que el rasterizador ya trata como «cae al
 * color plano de la cara». La conversión al PNG y de vuelta se hace en un solo
 * sitio, aquí debajo, y no en cada consumidor.
 */
export const HUECO = 255;

/**
 * Una rejilla de colores a la forma `{ancho, alto, indices, paleta}` que consume
 * el motor: paleta desde 0, y `HUECO` donde la celda esté vacía.
 *
 * Un `null` es TRANSPARENTE y no un color de relleno, y en un horizonte por
 * capas eso es todo el mecanismo: si las nubes de delante taparan con cielo
 * opaco, no habría multiplano — habría el telón de la capa de delante.
 */
export function texturaDeRejilla(rejilla) {
  const alto = rejilla.length;
  const ancho = rejilla[0]?.length ?? 0;
  const paleta = [];
  const indiceDe = new Map();
  const indices = new Uint8Array(ancho * alto).fill(HUECO);
  for (let v = 0; v < alto; v += 1) {
    for (let u = 0; u < ancho; u += 1) {
      const color = rejilla[v][u];
      if (color == null) continue;
      let i = indiceDe.get(color);
      if (i === undefined) {
        i = paleta.length;
        paleta.push(color);
        indiceDe.set(color, i);
      }
      // La fila 0 de la rejilla es el horizonte, y en una imagen la fila 0 es la
      // de arriba: se vuelca del revés o el cielo sale debajo del mar.
      indices[(alto - 1 - v) * ancho + u] = i;
    }
  }
  if (paleta.length > HUECO - 1) throw new Error("Un matte no puede tener tantos colores.");
  return { ancho, alto, indices, paleta };
}

/** La misma textura en el formato que espera el codificador de PNG: todo +1,
 *  con el 0 libre para el hueco. */
export function pngDeTextura({ ancho, alto, indices, paleta }) {
  const desplazados = new Uint8Array(indices.length);
  for (let i = 0; i < indices.length; i += 1) {
    desplazados[i] = indices[i] === HUECO ? 0 : indices[i] + 1;
  }
  return { ancho, alto, indices: desplazados, paleta };
}

/** Y de vuelta, para leer un asset prerenderizado. */
export function texturaDePng({ ancho, alto, indices, paleta }) {
  const runtime = new Uint8Array(indices.length);
  for (let i = 0; i < indices.length; i += 1) {
    runtime[i] = indices[i] === 0 ? HUECO : indices[i] - 1;
  }
  return { ancho, alto, indices: runtime, paleta };
}

/** La textura del matte de la playa, generada. */
export function texturaHorizonte(opciones) {
  return texturaDeRejilla(rejillaHorizonte(opciones));
}

/**
 * La banda de geometría sobre la que se pinta: un cilindro abierto alrededor del
 * observador, en `lados` cuadriláteros.
 *
 * VA CENTRADA EN LA CÁMARA y no en el mundo. Un matte tiene que estar siempre a
 * la misma distancia mires desde donde mires — si se quedara fijo en el mundo,
 * cruzar la playa lo acercaría, y un horizonte que se acerca deja de ser un
 * horizonte. Es la misma razón por la que el cielo de un juego es una caja
 * pegada a la cámara y no un objeto del nivel.
 *
 * `deriva` desplaza las UV en horizontal: es el «leve movimiento». Va en vueltas
 * (1 = una vuelta entera), y se aplica a la textura, no a los vértices.
 */
export function mallaHorizonte({
  centro = [0, 0, 0],
  distancia = 1800,
  base = -40,
  altura = 420,
  lados = 24,
  deriva = 0,
} = {}) {
  const [cx, cy, cz] = centro;
  const vertices = [];
  const caras = [];
  const uvs = [];
  for (let i = 0; i < lados; i += 1) {
    const a0 = (i / lados) * Math.PI * 2;
    const a1 = ((i + 1) / lados) * Math.PI * 2;
    const p = (a) => [cx + Math.sin(a) * distancia, 0, cz + Math.cos(a) * distancia];
    const [x0, , z0] = p(a0);
    const [x1, , z1] = p(a1);
    const b = vertices.length;
    vertices.push([x0, cy + base, z0], [x1, cy + base, z1], [x1, cy + base + altura, z1], [x0, cy + base + altura, z0]);
    // Mirando desde DENTRO: el orden es el que deja la cara vuelta hacia el
    // centro, o el motor la descarta por dar la espalda.
    caras.push([b, b + 3, b + 2, b + 1]);
    const u0 = i / lados + deriva;
    const u1 = (i + 1) / lados + deriva;
    uvs.push([
      [u0, 1],
      [u0, 0],
      [u1, 0],
      [u1, 1],
    ]);
  }
  return { vertices, caras, uvs };
}

/**
 * Cuánto ha derivado el matte a los `segundos` que sean.
 *
 * MUY DESPACIO, y el número importa: una vuelta entera en doce minutos. Más
 * rápido y se ve moverse, que es exactamente lo que no puede pasar —un
 * horizonte que se mueve visiblemente se lee como un fondo que gira, no como
 * distancia—. Más lento y da igual que no esté.
 */
export const VUELTA_SEGUNDOS = 720;

export function derivaEn(segundos) {
  const s = Number.isFinite(segundos) ? segundos : 0;
  return (s / VUELTA_SEGUNDOS) % 1;
}


/* ---- las capas ------------------------------------------------------------- */

/**
 * Las tres profundidades del horizonte, de lejos a cerca.
 *
 * TRES Y NO CINCO. Cada capa es una vuelta de cuadriláteros texturados, y a
 * partir de tres el ojo ya no separa una más: lo que da profundidad es que haya
 * distintas velocidades, no cuántas. Con dos, en cambio, el efecto se lee como
 * dos telones, que es peor que uno.
 *
 * `seguimiento` va cayendo y `velocidad` subiendo a la vez, y no es casual: son
 * las dos caras del mismo dato. Lo que está más cerca se queda más atrás al
 * andar Y cruza más rápido con el tiempo. Si una subiera sin la otra, la capa
 * diría dos distancias distintas y el cuadro se leería mal sin que se sepa por
 * qué.
 */
export const CAPAS = Object.freeze([
  // El fondo: la costa lejana. Clavada al observador —está tan lejos que andar
  // no la mueve— y prácticamente quieta.
  Object.freeze({
    nombre: "costa",
    distancia: 2200,
    base: -30,
    altura: 380,
    seguimiento: 1,
    velocidad: 0.35,
    semilla: SEMILLA_PLAYA,
    contenido: "costa",
  }),
  // El medio: el banco de nubes altas.
  Object.freeze({
    nombre: "nubes-altas",
    distancia: 1500,
    base: 60,
    altura: 320,
    seguimiento: 0.985,
    velocidad: 1,
    semilla: SEMILLA_PLAYA + 1,
    contenido: "nubes",
  }),
  // Lo cercano: jirones bajos, los que de verdad cruzan. Es la capa que hace el
  // trabajo del relieve, porque es la única cuyo desplazamiento se llega a notar.
  Object.freeze({
    nombre: "nubes-bajas",
    distancia: 900,
    base: 20,
    altura: 190,
    seguimiento: 0.94,
    velocidad: 2.4,
    semilla: SEMILLA_PLAYA + 2,
    contenido: "jirones",
  }),
]);

/**
 * Dónde se centra una capa cuando la cámara está en `camara`.
 *
 * A `seguimiento` 1 devuelve la cámara entera: la capa la acompaña y no se
 * mueve nunca respecto a quien mira. Por debajo, se queda una fracción atrás, y
 * esa fracción ES la profundidad aparente.
 */
export function centroDeCapa(camara, seguimiento) {
  const k = Number.isFinite(seguimiento) ? seguimiento : 1;
  return [camara[0] * k, camara[1] * k, camara[2] * k];
}

/**
 * Las piezas del horizonte listas para componer, en orden de lejos a cerca.
 *
 * Sale una por capa, cada una con SU textura: el motor admite una textura por
 * llamada a `componerEscena` y las funde después, así que tres capas texturadas
 * distintas no necesitan ni atlas ni cambio de motor.
 */
export function piezasHorizonte({ camara = [0, 0, 0], segundos = 0, texturas = null } = {}) {
  const tabla = texturas ?? texturasHorizonte();
  return CAPAS.map((capa) => ({
    nombre: capa.nombre,
    malla: mallaHorizonte({
      centro: centroDeCapa(camara, capa.seguimiento),
      distancia: capa.distancia,
      base: capa.base,
      altura: capa.altura,
      deriva: derivaEn(segundos) * capa.velocidad,
    }),
    textura: tabla[capa.nombre],
    // Un matte no lo ilumina el sol de la escena: ya viene pintado con su luz
    // dentro, que es lo que hace que sea un matte y no geometría lejana.
    emisivo: true,
  }));
}

/** Una textura por capa, generadas de sus semillas. */
export function texturasHorizonte() {
  return Object.fromEntries(
    CAPAS.map((capa) => [
      capa.nombre,
      texturaDeRejilla(rejillaHorizonte({ semilla: capa.semilla, contenido: capa.contenido })),
    ]),
  );
}
