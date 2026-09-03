// Fábrica de salas-caja para andar por la nave (#427/#508): cuatro muros por
// el límite de la planta, con huecos de puerta y de VENTANA, suelo y techo.
//
// SE EXTRAJO de `nave-movimiento-sala-prueba.mjs` (que la definía solo para
// sus dos salas de prueba) porque #508 la necesita para salas REALES —una por
// puesto de tripulación— y ese archivo declara explícitamente que sus salas
// son un banco de pruebas, no la geografía definitiva. La fábrica en sí no
// tiene opinión sobre qué sala es de pruebas y cuál es real: solo sabe
// construir una caja con agujeros.
//
// UNA VENTANA ES UN AGUJERO A MEDIA ALTURA, NO UN AGUJERO ENTERO. Una puerta
// se recorta de suelo a `ALTURA_PUERTA` (con dintel por encima); una ventana
// se recorta entre `ALTURA_ALFEIZAR` y `ALTURA_DINTEL_VENTANA` (con antepecho
// por debajo Y dintel por encima) — así no se puede "salir" por una ventana
// por error de colisión: la planta (`crearPlanta`) sigue siendo la misma caja
// cerrada de siempre, la ventana solo abre la MALLA, nunca el paso. Detrás del
// hueco se proyecta el mismo campo estelar que ya usa la cantina (#384): el
// pintor dibuja las estrellas ANTES que los polígonos, así que el propio muro
// recorta el cielo solo — no hace falta cristal ni máscara (mismo mecanismo
// que `cantina-escena.mjs`, ver su cabecera de "Por el ojo de buey").
//
// Reutiliza el motor 3D (`retro3d.mjs`) sin tocarlo, igual que
// `cantina-escena.mjs`/`dados-3d.mjs`: aporta solo mallas y su colocación.
//
// Puro: ni Foundry, ni DOM, ni <canvas>, ni reloj, ni Math.random() (el cielo
// se siembra con `semillaCielo`, igual que en `cantina-escena.mjs`).
//
// Frontera de arte (#351): no declara ni un color propio — todos vienen de
// `paleta.mjs` (`SECCION`, ya usada para materiales genéricos de nave).

import { AMBAR_SENAL, SECCION } from "./paleta.mjs";
import { caja } from "./escena-primitivas.mjs";
import { componerEscena, fundirEscenas } from "./retro3d.mjs";
import { resolverCamara } from "./nave-camara.mjs";
import { campoEstelar, proyectarEstrellas } from "./retro3d-estrellas.mjs";
import { piezasDeVentana } from "./nave-ventana-espacio.mjs";
import { piezasMuralPixel } from "./nave-mural-pixel.mjs";
import { ANCHO_TESELA, METROS_POR_TEXEL, texturaMuro } from "./piel-textura.mjs";
import { piezasPielHoja } from "./nave-piel-puerta.mjs";
import { piezasPielColumna, piezasPielObjeto } from "./nave-piel-objeto.mjs";
import { piezasPielSuelo, piezasPielTecho } from "./nave-piel-suelo.mjs";
import { piezasLuminarias, mallaDifusorLuminarias, colorDifusorLuminaria } from "./nave-luminaria.mjs";
import { crearPlanta } from "./nave-movimiento.mjs";
import { poligonosOtrosJugadores } from "./nave-avatares-render.mjs";

/** A qué altura mira quien anda, de pie. El salto/agachado (#446) suma su
 *  propio offset por encima de esta base. 1.45 y no 1.6 (QA: "el personaje
 *  está demasiado alto") — más baja que la altura de ojos humana media a
 *  propósito, porque lo que se reportó no fue una cifra sino una sensación
 *  de mirar la sala desde demasiado arriba. */
export const ALTURA_OJOS = 1.45;

/** Altura de los muros, de suelo a techo. 3.8 y no 3: a la altura de ojos
 *  (1.6) un techo a 3 queda a menos de metro y medio por encima de la
 *  cabeza, que en primera persona se lee como agachado bajo una tapa, no
 *  como estar de pie en una sala. */
export const ALTURA = 3.8;
const GROSOR_MURO = 0.4;

/** Tonos del detalle de la hoja. Del casco, no colores nuevos (#351). */
const DETALLE_HOJA = SECCION.mamparo;
const FRANJA_HOJA = AMBAR_SENAL;

/** Altura del hueco de una puerta: por debajo se puede cruzar, por encima
 *  sigue habiendo muro (el dintel). 2.8 y no 2.2 (QA: "parece gigante"): al
 *  subir `ALTURA` de 3 a 3.8 la puerta se quedó con la medida vieja y dejó
 *  de ser la referencia de escala humana que hace que una sala se LEA a
 *  tamaño de persona — el techo creció pero nada más lo hizo con él. Ambas
 *  cifras conservan la MISMA proporción sobre `ALTURA` que tenían con el
 *  techo de 3 (puerta al 73%, antepecho al 30%), no un número nuevo a ojo. */
const ALTURA_PUERTA = 2.8;
/** Franja de una ventana: por debajo el antepecho, por encima el dintel —
 *  ninguno de los dos es cruzable, la ventana nunca es una puerta. */
const ALTURA_ALFEIZAR = 1.14;
const ALTURA_DINTEL_VENTANA = 2.9;
const TOLERANCIA_BORDE = 0.01;
/** Grosor visual del marco de una ventana (#508 feedback): un borde fino a
 *  cada lado del hueco, para que se lea como un límite de cristal y no como
 *  un boquete liso en el muro. Sin travesaño central — se probó y se leía
 *  como una mira, no como una junta. */
const GROSOR_MARCO = 0.08;

/** Rectángulo esquina+medidas a caja centro+medidas en Y = [y0, y1]. */
function rectAColumnaEntre(rect, y0, y1) {
  return caja(
    [rect.x + rect.ancho / 2, (y0 + y1) / 2, rect.z + rect.profundidad / 2],
    [rect.ancho, y1 - y0, rect.profundidad],
  );
}

/** Rectángulo esquina+medidas a caja centro+medidas en Y = [0, altura]. */
function rectAColumna(rect, altura) {
  return rectAColumnaEntre(rect, 0, altura);
}

/**
 * Recorta un muro `x`-orientado (los de norte/sur) para dejar un hueco entre
 * `[desde, hasta]`. Devuelve los tramos de pared que sobreviven (0, 1 o 2).
 */
function recortarMuroX(muro, desde, hasta) {
  const inicio = muro.x;
  const fin = muro.x + muro.ancho;
  const tramos = [];
  if (desde > inicio) tramos.push({ ...muro, ancho: desde - inicio });
  if (hasta < fin) tramos.push({ ...muro, x: hasta, ancho: fin - hasta });
  return tramos;
}

/** Igual que `recortarMuroX`, para muros `z`-orientados (este/oeste). */
function recortarMuroZ(muro, desde, hasta) {
  const inicio = muro.z;
  const fin = muro.z + muro.profundidad;
  const tramos = [];
  if (desde > inicio) tramos.push({ ...muro, profundidad: desde - inicio });
  if (hasta < fin) tramos.push({ ...muro, z: hasta, profundidad: fin - hasta });
  return tramos;
}

/**
 * El cerco de una ventana: un marco fino por los DOS bordes del hueco a lo
 * largo del muro (sin travesaño central — un feedback de #508 descartó la
 * cruz por leerse como una mira, no como una junta de cristal), para que se
 * note un borde y no un boquete liso. `base` es el rectángulo del hueco ya
 * resuelto por `abrirHuecosEnMuros` (con la profundidad real del muro, no la
 * del hueco pedido); `alongX` dice si el muro corre a lo largo de X
 * (norte/sur) o de Z (este/oeste) — el marco se reparte sobre ESE eje.
 */
function piezasMarcoVentana(base, y0, y1, alongX) {
  if (alongX) {
    return [
      rectAColumnaEntre({ ...base, ancho: GROSOR_MARCO }, y0, y1),
      rectAColumnaEntre({ ...base, x: base.x + base.ancho - GROSOR_MARCO, ancho: GROSOR_MARCO }, y0, y1),
    ];
  }
  return [
    rectAColumnaEntre({ ...base, profundidad: GROSOR_MARCO }, y0, y1),
    rectAColumnaEntre({ ...base, z: base.z + base.profundidad - GROSOR_MARCO, profundidad: GROSOR_MARCO }, y0, y1),
  ];
}

/**
 * Marco de PUERTA: jambas a los lados y una banda de dintel encima del hueco.
 *
 * Un hueco sin marco no se lee como puerta (QA 2026-08-08: «hay que hacer
 * texturas para que se entienda que son puertas»). En este lenguaje de bloques no
 * hay texturas propiamente: lo que hace que algo se lea como puerta es el
 * CONTORNO —dos jambas verticales y un dintel— en un color distinto del muro, que
 * es exactamente cómo se señalizan las esclusas de verdad.
 *
 * Va hasta `ALTURA_PUERTA` y no hasta el techo: el dintel tiene que verse como el
 * borde superior del paso, no como una viga.
 */
function piezasMarcoPuerta(base, y0, y1, alongX) {
  const jambas = alongX
    ? [
        rectAColumnaEntre({ ...base, ancho: GROSOR_MARCO }, y0, y1),
        rectAColumnaEntre({ ...base, x: base.x + base.ancho - GROSOR_MARCO, ancho: GROSOR_MARCO }, y0, y1),
      ]
    : [
        rectAColumnaEntre({ ...base, profundidad: GROSOR_MARCO }, y0, y1),
        rectAColumnaEntre({ ...base, z: base.z + base.profundidad - GROSOR_MARCO, profundidad: GROSOR_MARCO }, y0, y1),
      ];
  // Dintel: una banda fina justo encima del hueco, del ancho entero del paso.
  const dintel = rectAColumnaEntre(base, y1 - GROSOR_MARCO, y1);
  return [...jambas, dintel];
}

// ---- Puertas correderas (QA: "estilo Star Trek, cerradas y se abren por
// dentro deslizándose") -----------------------------------------------------
//
// DOS HOJAS QUE CUBREN EL HUECO ENTERO EN REPOSO y se retiran cada una hacia
// SU lado del muro al acercarse alguien — nunca hacia arriba ni hacia fuera,
// que es lo que distingue una corredera de una puerta batiente. Grosor de
// muro real (`GROSOR_MURO`) para que no floten respecto al hueco que tapan.
//
// LA APERTURA ES PURA FUNCIÓN DE LA DISTANCIA, SIN ESTADO propio ni reloj:
// el mismo estilo que el resto del módulo (`componer` ya recibe `x`/`z` en
// cada llamada). Alguien que se acerca la ve abrirse progresivamente; nadie
// tiene que recordar en qué fotograma empezó a abrirse.
//
// LA COLISIÓN NO CAMBIA: sigue siendo el mismo agujero siempre transitable
// que ya documenta `nave-movimiento-lienzo.mjs` ("una puerta no bloquea").
// Esto es una hoja visual, no un cerrojo — bloquear el paso mientras se abre
// arriesgaría dejar a alguien atrapado contra una hoja que su propio cliente
// ve entreabierta por la latencia de red.
const DISTANCIA_EMPEZAR_A_ABRIR = 2.4;
const DISTANCIA_TOTALMENTE_ABIERTA = 1.0;

/** Punto de `rect` más cercano a `(x, z)` — misma geometría de tres líneas
 *  que `nave-movimiento.mjs`, duplicada porque esa función no se expone y
 *  aquí hace falta la distancia, no un booleano de colisión. */
export function distanciaARect(x, z, rect) {
  const cx = Math.max(rect.x, Math.min(x, rect.x + rect.ancho));
  const cz = Math.max(rect.z, Math.min(z, rect.z + rect.profundidad));
  return Math.hypot(x - cx, z - cz);
}

/** 0 = cerrada del todo, 1 = abierta del todo, con una rampa lineal entre
 *  ambas distancias — nada de golpe seco al cruzar un umbral. Exportada para
 *  poder probar la rampa sin pasar por cámara ni proyección. */
export function fraccionAbierta(distancia) {
  if (distancia >= DISTANCIA_EMPEZAR_A_ABRIR) return 0;
  if (distancia <= DISTANCIA_TOTALMENTE_ABIERTA) return 1;
  return (DISTANCIA_EMPEZAR_A_ABRIR - distancia) / (DISTANCIA_EMPEZAR_A_ABRIR - DISTANCIA_TOTALMENTE_ABIERTA);
}

/**
 * Las dos hojas de una puerta, YA desplazadas según cuánto deba estar
 * abierta. `base`/`y0`/`y1`/`alongX` son los mismos que ya resuelve
 * `abrirHuecosEnMuros` para esa puerta; `fraccion` es la que da
 * `fraccionAbierta`. Cada hoja cubre media anchura del hueco en reposo y se
 * retira hacia SU lado —nunca hacia el centro— al abrirse, hasta desaparecer
 * por completo dentro del muro que la enmarca.
 */
/**
 * Los RECTS de las dos hojas, ya deslizadas.
 *
 * Se separa de `piezasHojaPuerta` para que el detalle pixelart de la hoja salga de
 * los MISMOS rects que la hoja: con dos cálculos, la franja de aviso se quedaría
 * quieta mientras la puerta se abre.
 */
export function rectsHojaPuerta({ base, alongX }, fraccion) {
  if (alongX) {
    const mitad = base.ancho / 2;
    const deslizamiento = mitad * fraccion;
    return [
      { ...base, x: base.x - deslizamiento, ancho: mitad },
      { ...base, x: base.x + mitad + deslizamiento, ancho: mitad },
    ];
  }
  const mitad = base.profundidad / 2;
  const deslizamiento = mitad * fraccion;
  return [
    { ...base, z: base.z - deslizamiento, profundidad: mitad },
    { ...base, z: base.z + mitad + deslizamiento, profundidad: mitad },
  ];
}

export function piezasHojaPuerta(puerta, fraccion) {
  const { y0, y1 } = puerta;
  return rectsHojaPuerta(puerta, fraccion).map((rect) => rectAColumnaEntre(rect, y0, y1));
}

/**
 * Detalle pixelart SOBRE la hoja de una puerta (QA 2026-08-08: «no hay pixelart
 * en la puerta»).
 *
 * El marco ya dice DÓNDE está la puerta; esto dice QUÉ es. En un lenguaje de
 * bloques el detalle son piezas finas resaltadas sobre el plano de la hoja, no un
 * mapa de bits: tres bandas horizontales de refuerzo y una franja de aviso a la
 * altura de la mano, que es como se marca una esclusa de verdad.
 *
 * Sobresalen un pelo del plano de la hoja (`RESALTE`) porque dos superficies
 * coplanares se pelean por el orden del pintor y parpadean.
 */
const RESALTE = 0.03;
const ALTURAS_BANDA = Object.freeze([0.55, 0.75]);
const ALTURA_FRANJA = 0.42;

function piezasDetalleHoja({ base, y0, y1, alongX }, hoja) {
  const alto = y1 - y0;
  const piezas = [];
  const grueso = 0.09;

  const bandaEn = (fraccion, grosorBanda, color) => {
    const cy = y0 + alto * fraccion;
    const rect = alongX
      ? { ...hoja, z: hoja.z - RESALTE, profundidad: hoja.profundidad + RESALTE * 2 }
      : { ...hoja, x: hoja.x - RESALTE, ancho: hoja.ancho + RESALTE * 2 };
    piezas.push({ malla: rectAColumnaEntre(rect, cy - grosorBanda / 2, cy + grosorBanda / 2), color });
  };

  for (const fraccion of ALTURAS_BANDA) bandaEn(fraccion, grueso, DETALLE_HOJA);
  // La franja de aviso va más ancha y en ámbar: es la que se lee de lejos.
  bandaEn(ALTURA_FRANJA, grueso * 2, FRANJA_HOJA);
  return piezas;
}

/**
 * Convierte los muros llenos y una lista de HUECOS —puertas y ventanas,
 * `{rect, y0, y1, esVentana}`— en las piezas de pared que de verdad hay que
 * dibujar. Un hueco recorta su tramo horizontal del muro que toca —a qué
 * lado pertenece se decide por qué borde de la sala toca su rectángulo, no
 * por su orden en la lista— y añade banda(s) de relleno por debajo de `y0`
 * (si `y0 > 0`, el antepecho de una ventana) y por encima de `y1` (si
 * `y1 < ALTURA`, el dintel de una puerta o de una ventana): sin esas bandas
 * la pared quedaría "flotando" cortada en seco. Una ventana además deja su
 * cerco (`piezasMarcoVentana`) para leerse como una ventana con cristal.
 */
function abrirHuecosEnMuros(muros, huecos, ancho, profundidad) {
  const [norte, sur, oeste, este] = muros;
  let tramosNorte = [norte];
  let tramosSur = [sur];
  let tramosOeste = [oeste];
  let tramosEste = [este];
  const bandas = [];
  const marcos = [];
  const marcosPuerta = [];
  const puertasConBase = [];

  for (const hueco of huecos) {
    const { rect, y0, y1, esVentana } = hueco;
    const tocaNorte = rect.z <= TOLERANCIA_BORDE;
    const tocaSur = rect.z + rect.profundidad >= profundidad - TOLERANCIA_BORDE;
    const tocaOeste = rect.x <= TOLERANCIA_BORDE;
    const tocaEste = rect.x + rect.ancho >= ancho - TOLERANCIA_BORDE;

    let base = null;
    let alongX = true;
    if (tocaNorte) {
      tramosNorte = tramosNorte.flatMap((m) => recortarMuroX(m, rect.x, rect.x + rect.ancho));
      base = { ...norte, x: rect.x, ancho: rect.ancho };
    } else if (tocaSur) {
      tramosSur = tramosSur.flatMap((m) => recortarMuroX(m, rect.x, rect.x + rect.ancho));
      base = { ...sur, x: rect.x, ancho: rect.ancho };
    } else if (tocaOeste) {
      tramosOeste = tramosOeste.flatMap((m) => recortarMuroZ(m, rect.z, rect.z + rect.profundidad));
      base = { ...oeste, z: rect.z, profundidad: rect.profundidad };
      alongX = false;
    } else if (tocaEste) {
      tramosEste = tramosEste.flatMap((m) => recortarMuroZ(m, rect.z, rect.z + rect.profundidad));
      base = { ...este, z: rect.z, profundidad: rect.profundidad };
      alongX = false;
    }
    // Un hueco que no toca ningún borde es un dato de planta mal formado: se
    // ignora en vez de reventar el render por un rectángulo interior.
    if (!base) continue;

    if (y0 > 0) bandas.push(rectAColumnaEntre(base, 0, y0));
    if (y1 < ALTURA) bandas.push(rectAColumnaEntre(base, y1, ALTURA));
    if (esVentana) marcos.push(...piezasMarcoVentana(base, y0, y1, alongX));
    else marcosPuerta.push(...piezasMarcoPuerta(base, y0, y1, alongX));
    // `base` ya trae el hueco resuelto con el grosor REAL del muro que toca
    // (el `rect` de entrada no lo garantiza — sus ejes fuera del ancho de
    // puerta son arbitrarios, ver `nave-vestibulo.PUERTA_*`), así que las
    // hojas correderas se apoyan en él y no en `rect` directamente.
    if (!esVentana) puertasConBase.push({ base, y0, y1, alongX });
  }

  return {
    muros: [...tramosNorte, ...tramosSur, ...tramosOeste, ...tramosEste],
    bandas,
    marcos,
    marcosPuerta,
    puertasConBase,
  };
}

/** Traslada una malla en coordenadas de mundo. */
function trasladarMalla(malla, [dx, dy, dz]) {
  return { ...malla, vertices: malla.vertices.map(([x, y, z]) => [x + dx, y + dy, z + dz]) };
}

/** Grosor del rodapié: pegado a la cara interior de cada muro, nunca coincide
 *  con su plano (el muro ocupa hasta x/z = 0, el rodapié EMPIEZA ahí). */
const GROSOR_RODAPIE = 0.06;
const ALTURA_RODAPIE = 0.16;

/**
 * Un cerco de rodapié al pie de las cuatro paredes (QA: "los objetos 3D son
 * muy cutres, necesitan más detalle"): una sala sin nada donde el suelo se
 * encuentra con el muro se lee como una caja vacía. Reusa `SECCION.salaBorde`
 * —"el canto que separa una sala de la siguiente"— porque es exactamente eso:
 * el canto entre el suelo y la pared, ningún color nuevo (#351).
 */
function rodapie(ancho, profundidad) {
  const color = SECCION.salaBorde;
  return [
    { malla: caja([ancho / 2, ALTURA_RODAPIE / 2, GROSOR_RODAPIE / 2], [ancho, ALTURA_RODAPIE, GROSOR_RODAPIE]), color },
    {
      malla: caja(
        [ancho / 2, ALTURA_RODAPIE / 2, profundidad - GROSOR_RODAPIE / 2],
        [ancho, ALTURA_RODAPIE, GROSOR_RODAPIE],
      ),
      color,
    },
    { malla: caja([GROSOR_RODAPIE / 2, ALTURA_RODAPIE / 2, profundidad / 2], [GROSOR_RODAPIE, ALTURA_RODAPIE, profundidad]), color },
    {
      malla: caja(
        [ancho - GROSOR_RODAPIE / 2, ALTURA_RODAPIE / 2, profundidad / 2],
        [GROSOR_RODAPIE, ALTURA_RODAPIE, profundidad],
      ),
      color,
    },
  ];
}


/**
 * Botones y una palanca sobre la cara SUPERIOR del cuerpo de una consola
 * (#509 QA: "botones o palancas", más allá de solo pantalla) — deliberado en
 * la cara de ARRIBA y no en la de la pantalla: el cuerpo es el mismo cubo en
 * toda sala de puesto, pero qué cara lleva la pantalla cambia según hacia
 * dónde mira esa sala (`nave-sala-ingenieria.mjs` la pone al sur,
 * `nave-salas-puente.mjs` al oeste) — la tapa de arriba es la única
 * superficie común a las dos, así que este detalle no necesita saber de
 * orientación. Sin colisión propia: ya la cubre el cuerpo de la consola.
 *
 * `centroCuerpo`/`medidasCuerpo` son los mismos que ya recibe `caja()` para
 * el cuerpo (`[x,y,z]`/`[ancho,alto,fondo]`) — el reparto se hace sobre SU
 * ancho (eje X local), no sobre uno inventado aquí.
 */
export function detalleConsola([cx, cy, cz], [anchoCuerpo, altoCuerpo], opciones = {}) {
  const { colorBoton = SECCION.salaBorde, colorPalanca = SECCION.entrable } = opciones;
  const yTapa = cy + altoCuerpo / 2;
  const margen = anchoCuerpo * 0.14;
  const anchoBotones = anchoCuerpo * 0.62;
  const botones = [-0.5, 0, 0.5].map((paso, i) => ({
    nombre: `consolaBoton${i}`,
    centro: [cx + paso * anchoBotones, yTapa + 0.03, cz],
    medidas: [0.1, 0.06, 0.1],
    color: colorBoton,
    colision: false,
  }));
  const palanca = {
    nombre: "consolaPalanca",
    centro: [cx + anchoCuerpo / 2 - margen, yTapa + 0.12, cz],
    medidas: [0.06, 0.24, 0.06],
    color: colorPalanca,
    colision: false,
  };
  return [...botones, palanca];
}

/**
 * Cuánta luz de relleno recibe un paño texturado.
 *
 * Un cuadrilátero plano recibe UNA intensidad, mientras que las chapas de la
 * piel de geometría cogían luz por muchas caras a la vez. Sin compensarlo, el
 * muro texturado sale bastante más oscuro que el que sustituye — se vio en la
 * comparación lado a lado, no es una suposición. El valor iguala el brillo de
 * las dos maneras de dibujar lo mismo.
 */
const AMBIENTE_PANO = 0.62;

/**
 * La tesela del muro, generada UNA vez por semilla.
 *
 * Todas las salas de una nave comparten semilla, así que sin caché se generaría
 * la misma imagen trece veces por carga. Con ella, una.
 */
const teselas = new Map();

function texturaDelMuro(semilla) {
  let textura = teselas.get(semilla);
  if (!textura) {
    textura = texturaMuro({
      ancho: Math.round(ANCHO_TESELA / METROS_POR_TEXEL),
      alto: Math.round(ALTURA / METROS_POR_TEXEL),
      semilla,
    });
    teselas.set(semilla, textura);
  }
  return textura;
}

/** Cuánto se despega el paño de la cara del muro. Lo justo para que el z-buffer
 *  lo resuelva por delante, y demasiado poco para que se vea el canto — el mismo
 *  criterio y el mismo orden de magnitud que el saliente de las chapas de #548. */
const SALIENTE_PANO = 0.02;

/**
 * Los paños texturados de un tramo de muro: UNO POR CARA.
 *
 * La primera versión ponía un solo cuadrilátero en el eje del tramo y no se veía
 * nada — quedaba enterrado dentro del muro macizo que lo sostiene. Un tramo
 * tiene dos caras y puede separar dos salas, así que se pintan las dos, cada una
 * despegada hacia SU lado y mirando hacia fuera del muro.
 *
 * La `u` se mide en teselas a lo largo del vano —un tramo de 7 m enseña 2,2
 * repeticiones— y la `v` va de 0 a 1 porque la tesela mide exactamente la altura
 * de la sala. Que esa coincidencia exista es lo que permite que este camino no
 * tenga que decidir ningún tamaño ni enumerar ningún catálogo de vanos.
 */
function panosTexturados(rect, altura) {
  const { x, z, ancho: anchoRect, profundidad } = rect;
  const alLargoDeX = anchoRect >= profundidad;
  const u1 = (alLargoDeX ? anchoRect : profundidad) / ANCHO_TESELA;

  // EL ORDEN DE LOS DOS PUNTOS ES LA NORMAL, y estaba del revés: con el sentido
  // contrario la cara mira hacia DENTRO del muro, el motor la descarta por dar
  // la espalda, y el paño no se ve — que es exactamente lo que pasaba, y cuesta
  // encontrarlo porque no hay error en ningún sitio, simplemente no aparece.
  const caras = alLargoDeX
    ? [
        { a: [x + anchoRect, z - SALIENTE_PANO], b: [x, z - SALIENTE_PANO] },
        { a: [x, z + profundidad + SALIENTE_PANO], b: [x + anchoRect, z + profundidad + SALIENTE_PANO] },
      ]
    : [
        { a: [x - SALIENTE_PANO, z], b: [x - SALIENTE_PANO, z + profundidad] },
        { a: [x + anchoRect + SALIENTE_PANO, z + profundidad], b: [x + anchoRect + SALIENTE_PANO, z] },
      ];

  return caras.map(({ a, b }) => ({
    malla: {
      vertices: [
        [a[0], 0, a[1]],
        [b[0], 0, b[1]],
        [b[0], altura, b[1]],
        [a[0], altura, a[1]],
      ],
      caras: [[0, 1, 2, 3]],
      uvs: [[[0, 1], [u1, 1], [u1, 0], [0, 0]]],
    },
  }));
}

/**
 * Fabrica una sala-caja: cuatro muros por el límite de la planta, columnas
 * opcionales, puertas, VENTANAS, suelo y techo.
 *
 * Devuelve `{planta, componer}`, la forma exacta que pide
 * `nave-estancias.declararEstancia` y `nave-movimiento-lienzo.arrancarAndar`.
 *
 * `puertas` y `ventanas` son rectángulos `{rect}` contra el borde de la sala.
 * Las puertas son las MISMAS que se declaran como disparador en el catálogo
 * de estancias (#427): pasarlas aquí abre un hueco real en la malla del muro
 * que tocan. Las ventanas nunca son disparador —no hay `destino` que
 * declarar— y, a diferencia de una puerta, dejan la sala viendo el campo
 * estelar de `semillaCielo` por el hueco.
 *
 * `mobiliario` (#509) son piezas sueltas dentro de la sala —una consola, una
 * mesa— cada una `{centro:[x,y,z], medidas:[ancho,alto,fondo], color,
 * colision?:boolean}`. Con `colision` (default `true`) la pieza también
 * bloquea el paso, con su huella en el plano X/Z; una decoración que cuelga
 * del techo o que no debe estorbar puede ponerlo a `false`.
 *
 * @param {{ancho:number, profundidad:number, columnas?:Array,
 *   puertas?:Array<{rect:object}>, ventanas?:Array<{rect:object}>,
 *   mobiliario?:Array<{centro:number[], medidas:number[], color:string, colision?:boolean}>,
 *   colorMuro?:string, colorColumna?:string, colorMarcoVentana?:string,
 *   semillaCielo?:number, cantidadEstrellas?:number, sistema?:string|null}} medidas
 */
export function crearSalaCaja({
  ancho,
  profundidad,
  columnas = [],
  puertas = [],
  ventanas = [],
  mobiliario = [],
  colorMuro = SECCION.casco,
  colorColumna = SECCION.mamparo,
  // El acento de la cantina (#508 feedback): un cerco de neón alrededor del
  // hueco es lo que hace que se lea como una ventana con cristal y no como
  // un boquete en el muro, sin que el motor sepa dibujar transparencias.
  colorMarcoVentana = SECCION.entrable,
  // Ámbar de señalización: el mismo que ya usa el módulo para «esto se acciona».
  colorMarcoPuerta = AMBAR_SENAL,
  semillaCielo = 20260731,
  cantidadEstrellas = 90,
  // Pixelart de casco sobre los muros (#548). Encendido de serie: un muro plano
  // es una caja gris, y la piel es lo que hace que la sala se lea como nave.
  // El interruptor existe para las salas de prueba —donde el mural solo estorba
  // al leer qué está midiendo el test— y no como preferencia de estilo.
  muralPixel = true,
  /**
   * Cómo se dibuja la piel del muro (#584).
   *
   * `"geometria"` es lo que hay desde #548: miles de chapas de diez centímetros,
   * cada una cogiendo la luz por su cuenta. `"textura"` pinta el mismo muro con
   * una tesela de `piel-textura.mjs` sobre un cuadrilátero por paño.
   *
   * POR QUÉ HAY DOS Y NO UNA. La textura gana en todo lo medible —227 de los 253
   * polígonos de una sala son la piel, y texturada baja a uno por pared— y en
   * detalle, porque a dos centímetros y medio por téxel caben los remaches, el
   * nervado y las juntas finas que en cajas de diez centímetros no caben. Lo que
   * pierde es el moteado vivo de la luz por chapa: pasa a ser relieve PINTADO.
   *
   * Eso cambia el aspecto de las trece salas del Phobos a la vez, así que el
   * cambio de serie es una decisión de arte y se toma aparte. Aquí está el
   * camino, probado y listo; cambiar este valor por defecto es la línea que lo
   * enciende.
   */
  pielMuro = "geometria",
  semillaMural = 20260810,
  // Piel de puertas y objetos (#550). Van con su propio interruptor y no con el
  // del mural porque son decisiones separables: una sala puede querer sus muros
  // desnudos y sus puertas marcadas. Ambas encendidas de serie, y ambas apagadas
  // en las salas de prueba por el mismo motivo que el mural.
  pielPuertas = true,
  pielObjetos = true,
  pielSuelo = true,
  // Qué sistema aloja esta sala (#765), o `null` si no aloja ninguno — la misma
  // cadena que declara `SALAS_PHOBOS` (p.ej. `"Reactor"`). Solo sirve para que
  // `componer` sepa qué entrada de `saludSistemas` mirar cada fotograma: el
  // difusor de la luminaria no puede parpadear por un sistema que la sala no
  // aloja.
  sistema = null,
}) {
  const muros = [
    { x: -GROSOR_MURO, z: -GROSOR_MURO, ancho: ancho + GROSOR_MURO * 2, profundidad: GROSOR_MURO },
    { x: -GROSOR_MURO, z: profundidad, ancho: ancho + GROSOR_MURO * 2, profundidad: GROSOR_MURO },
    { x: -GROSOR_MURO, z: 0, ancho: GROSOR_MURO, profundidad },
    { x: ancho, z: 0, ancho: GROSOR_MURO, profundidad },
  ];
  const huecos = [
    ...puertas.map(({ rect }) => ({ rect, y0: 0, y1: ALTURA_PUERTA, esVentana: false })),
    ...ventanas.map(({ rect }) => ({ rect, y0: ALTURA_ALFEIZAR, y1: ALTURA_DINTEL_VENTANA, esVentana: true })),
  ];
  const { muros: tramosMuro, bandas, marcos, marcosPuerta, puertasConBase } =
    abrirHuecosEnMuros(muros, huecos, ancho, profundidad);

  const obstaculosMobiliario = mobiliario
    .filter((pieza) => pieza.colision !== false)
    .map(({ centro, medidas }) => ({
      x: centro[0] - medidas[0] / 2,
      z: centro[2] - medidas[2] / 2,
      ancho: medidas[0],
      profundidad: medidas[2],
    }));

  const piezas = Object.freeze([
    ...tramosMuro.map((rect) => ({ malla: rectAColumna(rect, ALTURA), color: colorMuro })),
    // La piel va justo detrás del muro que la sostiene y antes que todo lo
    // demás: es parte de la pared, no mobiliario colgado de ella.
    ...(muralPixel && pielMuro === "geometria"
      ? tramosMuro.flatMap((rect) =>
          piezasMuralPixel({ rect, sala: { ancho, profundidad }, altura: ALTURA, semilla: semillaMural }),
        )
      : []),
    // La piel texturada: un cuadrilátero por paño, con la tesela repitiéndose a
    // lo largo del vano. La `v` va de 0 a 1 clavada porque la tesela mide
    // exactamente `ALTURA`, y por eso este camino no necesita decidir ningún
    // tamaño ni enumerar ningún catálogo de vanos.
    ...(muralPixel && pielMuro === "textura"
      ? tramosMuro.flatMap((rect) => panosTexturados(rect, ALTURA)).map((pano) => ({
          ...pano,
          color: colorMuro,
          textura: texturaDelMuro(semillaMural),
          // Un paño plano recibe una sola intensidad donde las chapas cogían luz
          // por muchas caras, así que sin esto sale bastante más oscuro que lo
          // que sustituye. No es un retoque de gusto: es igualar el brillo de
          // dos maneras distintas de dibujar lo mismo.
          ambiente: AMBIENTE_PANO,
        }))
      : []),
    ...marcos.map((malla) => ({ malla, color: colorMarcoVentana })),
    // El marco de puerta lleva su propio color: es lo que la hace reconocible
    // como paso a otra sala y no como un boquete en el muro.
    ...marcosPuerta.map((malla) => ({ malla, color: colorMarcoPuerta })),
    ...bandas.map((malla) => ({ malla, color: colorMuro })),
    ...columnas.map((rect) => ({ malla: rectAColumna(rect, ALTURA), color: colorColumna })),
    ...mobiliario.map(({ centro, medidas, color, emisivo, malla }) => ({
      // Una pieza puede traer su PROPIA malla: desde el inventario 3D, un prop
      // puede ser un prisma en vez de una caja (un conducto redondo, el pie de
      // una mesa). Sin `malla` se sigue construyendo la caja de siempre, así que
      // todo lo que ya había no cambia ni un vértice.
      malla: malla ?? caja(centro, medidas),
      color,
      // Un mueble puede declararse emisivo (#557, la pantalla de una consola):
      // se pinta a intensidad plena, sin sombreado por normal.
      emisivo: emisivo === true,
    })),
    // Piel de los objetos (#550). Va DESPUÉS de las cajas que viste, y solo la
    // reciben los que son arquitectura de la sala: `piezasPielObjeto` filtra por
    // tamaño, así que las 126 piezas de mobiliario de la cantina no se convierten
    // en 126 objetos vestidos — pasan las pocas que se ven de cerca.
    ...(pielObjetos
      ? [
          ...columnas.flatMap((rect) => piezasPielColumna(rect, ALTURA)),
          ...mobiliario
            .filter((pieza) => pieza.piel !== false)
            .flatMap(({ centro, medidas }) => piezasPielObjeto({ centro, medidas })),
        ]
      : []),
    ...rodapie(ancho, profundidad),
    { malla: caja([ancho / 2, -0.05, profundidad / 2], [ancho, 0.1, profundidad]), color: SECCION.sala },
    { malla: caja([ancho / 2, ALTURA + 0.05, profundidad / 2], [ancho, 0.1, profundidad]), color: SECCION.mamparo },
    // Suelo y techo (#552). Van con su propio interruptor, como el resto de la
    // piel, y detrás de sus dos losas: son chapa encima, no las sustituyen.
    ...(pielSuelo
      ? [
          ...piezasPielSuelo({ ancho, profundidad, semilla: semillaMural }),
          ...piezasPielTecho({ ancho, profundidad, altura: ALTURA }),
        ]
      : []),
    ...piezasLuminarias({ ancho, profundidad, altura: ALTURA }),
  ]);
  // Geometría del difusor fundida UNA vez (#765): su color se decide en
  // `componer`, cada fotograma, sin rehacer un solo vértice — es la condición
  // que #551 dejó puesta al medir el presupuesto de la sala.
  const difusorLuminarias = mallaDifusorLuminarias({ ancho, profundidad, altura: ALTURA });

  const planta = crearPlanta({ ancho, profundidad, obstaculos: [...columnas, ...obstaculosMobiliario] });
  const tieneVentanas = ventanas.length > 0;
  const cielo = tieneVentanas ? campoEstelar(semillaCielo, { cantidad: cantidadEstrellas }) : null;

  /**
   * Compone la escena vista desde `(x, z)` mirando a `yaw`, con `y` el
   * offset de salto/agachado (#446) sobre `ALTURA_OJOS`.
   */
  function componer(x, y, z, yaw, opciones = {}) {
    const {
      ancho: anchoLienzo = 480, alto: altoLienzo = 270, epoca, fov = 62, otrosJugadores = [],
      // Punto de vista (QA 2026-08-08). La regla vive en `nave-camara.mjs`
      // porque es la misma para las catorce estancias; aquí solo se consume.
      modoCamara,
      avatarPropio = {},
      // #541: lo que se ve por la ventana es el MISMO espacio que la nave tiene
      // alrededor, no un cielo de adorno. Sin lectura baja una persiana, que lo
      // decide `nave-ventana-espacio.mjs`: aquí no se inventa relleno.
      sensores = null,
      rumboNave = null,
      // Alerta de la nave y salud por sistema (#765), difundidas a toda la
      // mesa por `alerta-escena.mjs`/`telemetria-difusion.mjs`. `tiempo` ya
      // llegaba (#587, para el ambiente) y aquí además marca la cadencia del
      // parpadeo — el mismo reloj que el resto de la escena.
      aviso = null,
      saludSistemas = null,
      tiempo = 0,
    } = opciones;
    const { camara, dibujarPropio } = resolverCamara({ x, z, y, yaw, modo: modoCamara });
    const yawCamara = -yaw; // ver el comentario de `yaw` en `cantina-escena.mjs`

    // Las hojas de cada puerta se recalculan en cada llamada: su apertura es
    // pura función de la distancia de quien mira a esa puerta (ver la
    // cabecera de "Puertas correderas"), así que no pueden vivir en `piezas`
    // —congeladas una vez, en la construcción de la sala— sino que se
    // generan aquí, con `x`/`z` ya conocidos.
    const hojasPuertas = puertasConBase.flatMap((puerta) => {
      const fraccion = fraccionAbierta(distanciaARect(x, z, puerta.base));
      const rects = rectsHojaPuerta(puerta, fraccion);
      return [
        ...rects.map((rect) => ({ malla: rectAColumnaEntre(rect, puerta.y0, puerta.y1), color: colorMuro })),
        // El detalle sale de los MISMOS rects, así que viaja con la hoja al
        // abrirse. En rejilla (#550) para que el detalle de la puerta mida lo
        // mismo que el del muro que la rodea; sin piel, la hoja se queda con las
        // bandas lisas de siempre, que siguen siendo mejor que una hoja pelada.
        ...rects.flatMap((rect) =>
          pielPuertas ? piezasPielHoja(puerta, rect) : piezasDetalleHoja(puerta, rect),
        ),
      ];
    });

    const vistaVentanas = ventanas.flatMap(({ rect }) =>
      piezasDeVentana({ rect, sala: { ancho, profundidad }, sensores, rumboNave }),
    );

    // El color del difusor se decide AQUÍ, cada fotograma — la geometría ya
    // está fundida en `difusorLuminarias` desde la construcción de la sala
    // (#765). Sin `sistema` (la sala no aloja ninguno) no hay salud que mirar
    // y el difusor solo responde a la alerta general.
    const salud = sistema ? Number(saludSistemas?.[sistema.toLowerCase()]?.health) : null;
    const difusor = difusorLuminarias
      ? [{
          malla: difusorLuminarias,
          ...colorDifusorLuminaria({ aviso, health: Number.isFinite(salud) ? salud : null, timeMs: tiempo }),
        }]
      : [];

    const partes = [...piezas, ...difusor, ...hojasPuertas, ...vistaVentanas].map(({ malla, color, emisivo, textura, ambiente }) =>
      componerEscena(trasladarMalla(malla, [-camara[0], -camara[1], -camara[2]]), {
        ancho: anchoLienzo,
        alto: altoLienzo,
        epoca,
        fov,
        color,
        // Solo lo que de verdad emite: hoy, el difusor de una luminaria (#555).
        emisivo: emisivo === true,
        // La textura de ESTA pieza, si la trae (#584). El motor admite una por
        // llamada y funde después, así que una sala con paños texturados y
        // mobiliario liso no necesita ni atlas ni cambio de motor.
        textura: textura ?? null,
        // Y su luz de relleno, si la pide: un paño plano necesita más que una
        // caja para brillar lo mismo. Sin declararla, la sala manda la suya.
        ...(Number.isFinite(ambiente) ? { ambiente } : {}),
        posicion: [0, 0, 0],
        yaw: yawCamara,
        // Recorte de frustum completo (#510): las salas de #508 son
        // contenido nuevo sin cámaras afinadas a ojo que dependan del recorte
        // laxo — activarlo aquí es justo el caso seguro que #510 documenta.
        recorteLateral: true,
        // Luz fija en el mundo, no en la cámara (QA: "las paredes cambian de
        // iluminación sin sentido al girar"): aquí `yaw` es el giro de la
        // CÁMARA fingido rotando el mundo al revés, no el giro de una pieza
        // en una vitrina — ver el comentario de `luzFija` en `retro3d.mjs`.
        luzFija: true,
      }),
    );

    // En tercera persona el propio cuerpo entra como un avatar más: reusa
    // `piezasAvatar` sin que el render de presencia sepa que uno de ellos eres
    // tú. En primera no se pinta —estarías dentro de tu propia cabeza—, y esa es
    // la única diferencia real entre los dos modos aparte de dónde va la cámara.
    const cuerpos = dibujarPropio
      ? [...otrosJugadores, { x, y, z, yaw, avatar: avatarPropio }]
      : otrosJugadores;

    const poligonosJugadores = poligonosOtrosJugadores(cuerpos, {
      camara,
      yaw: yawCamara,
      ancho: anchoLienzo,
      alto: altoLienzo,
      epoca,
      fov,
    });

    // Fundido y reordenado global: cada pieza ya viene ordenada por su
    // cuenta, y el orden por pintor no es componible. `fundirEscenas` (#510)
    // acepta tanto escenas como listas sueltas, que es como llegan los avatares
    // de los demás jugadores.
    const { poligonos } = fundirEscenas([...partes, poligonosJugadores]);

    // El cielo por la(s) ventana(s): mismo mecanismo que `cantina-escena.mjs`
    // ("Por el ojo de buey") — se pinta ANTES que los polígonos, así que el
    // propio muro lo recorta y no hace falta máscara.
    // El campo estelar solo con LECTURA: es el fondo del espacio, y detrás de una
    // persiana bajada no hay fondo que ver. Sin esta condición se colaban
    // estrellas por las rendijas de las lamas y la persiana dejaba de leerse como
    // «no hay vista» para parecer «hay vista y está vacía» (#541).
    const hayLectura = Boolean(sensores && Array.isArray(sensores.contactos) && rumboNave !== null && rumboNave !== undefined);
    const estrellas = cielo && hayLectura
      ? proyectarEstrellas(cielo, { ancho: anchoLienzo, alto: altoLienzo, epoca, fov, yaw: yawCamara })
      : [];

    return { ancho: anchoLienzo, alto: altoLienzo, epoca: partes[0]?.epoca, poligonos, estrellas };
  }

  return { planta, componer };
}
