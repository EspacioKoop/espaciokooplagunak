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

import { SECCION } from "./paleta.mjs";
import { componerEscena } from "./retro3d.mjs";
import { campoEstelar, proyectarEstrellas } from "./retro3d-estrellas.mjs";
import { crearPlanta } from "./nave-movimiento.mjs";
import { poligonosOtrosJugadores } from "./nave-avatares-render.mjs";

/** Caja alineada a ejes por centro+medidas, caras en sentido antihorario
 *  vistas desde fuera (lo que `componerEscena` necesita para descartar las de
 *  espaldas). */
function caja([cx, cy, cz], [ancho, alto, fondo]) {
  const x = ancho / 2;
  const y = alto / 2;
  const z = fondo / 2;
  return {
    vertices: [
      [cx - x, cy - y, cz - z],
      [cx + x, cy - y, cz - z],
      [cx + x, cy + y, cz - z],
      [cx - x, cy + y, cz - z],
      [cx - x, cy - y, cz + z],
      [cx + x, cy - y, cz + z],
      [cx + x, cy + y, cz + z],
      [cx - x, cy + y, cz + z],
    ],
    caras: [
      [0, 3, 2, 1], // frente (−z)
      [4, 5, 6, 7], // fondo (+z)
      [0, 4, 7, 3], // izquierda
      [1, 2, 6, 5], // derecha
      [3, 7, 6, 2], // techo
      [0, 1, 5, 4], // suelo
    ],
  };
}

/** A qué altura mira quien anda, de pie. El salto/agachado (#446) suma su
 *  propio offset por encima de esta base. */
export const ALTURA_OJOS = 1.6;

/** Altura de los muros, de suelo a techo. 3.8 y no 3: a la altura de ojos
 *  (1.6) un techo a 3 queda a menos de metro y medio por encima de la
 *  cabeza, que en primera persona se lee como agachado bajo una tapa, no
 *  como estar de pie en una sala. */
export const ALTURA = 3.8;
const GROSOR_MURO = 0.4;

/** Altura del hueco de una puerta: por debajo se puede cruzar, por encima
 *  sigue habiendo muro (el dintel). */
const ALTURA_PUERTA = 2.2;
/** Franja de una ventana: por debajo el antepecho, por encima el dintel —
 *  ninguno de los dos es cruzable, la ventana nunca es una puerta. */
const ALTURA_ALFEIZAR = 0.9;
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
  }

  return {
    muros: [...tramosNorte, ...tramosSur, ...tramosOeste, ...tramosEste],
    bandas,
    marcos,
  };
}

/** Traslada una malla en coordenadas de mundo. */
function trasladarMalla(malla, [dx, dy, dz]) {
  return { ...malla, vertices: malla.vertices.map(([x, y, z]) => [x + dx, y + dy, z + dz]) };
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
 * @param {{ancho:number, profundidad:number, columnas?:Array,
 *   puertas?:Array<{rect:object}>, ventanas?:Array<{rect:object}>,
 *   colorMuro?:string, colorColumna?:string, colorMarcoVentana?:string,
 *   semillaCielo?:number, cantidadEstrellas?:number}} medidas
 */
export function crearSalaCaja({
  ancho,
  profundidad,
  columnas = [],
  puertas = [],
  ventanas = [],
  colorMuro = SECCION.casco,
  colorColumna = SECCION.mamparo,
  // El acento de la cantina (#508 feedback): un cerco de neón alrededor del
  // hueco es lo que hace que se lea como una ventana con cristal y no como
  // un boquete en el muro, sin que el motor sepa dibujar transparencias.
  colorMarcoVentana = SECCION.entrable,
  semillaCielo = 20260731,
  cantidadEstrellas = 90,
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
  const { muros: tramosMuro, bandas, marcos } = abrirHuecosEnMuros(muros, huecos, ancho, profundidad);

  const piezas = Object.freeze([
    ...tramosMuro.map((rect) => ({ malla: rectAColumna(rect, ALTURA), color: colorMuro })),
    ...marcos.map((malla) => ({ malla, color: colorMarcoVentana })),
    ...bandas.map((malla) => ({ malla, color: colorMuro })),
    ...columnas.map((rect) => ({ malla: rectAColumna(rect, ALTURA), color: colorColumna })),
    { malla: caja([ancho / 2, -0.05, profundidad / 2], [ancho, 0.1, profundidad]), color: SECCION.sala },
    { malla: caja([ancho / 2, ALTURA + 0.05, profundidad / 2], [ancho, 0.1, profundidad]), color: SECCION.mamparo },
  ]);

  const planta = crearPlanta({ ancho, profundidad, obstaculos: columnas });
  const tieneVentanas = ventanas.length > 0;
  const cielo = tieneVentanas ? campoEstelar(semillaCielo, { cantidad: cantidadEstrellas }) : null;

  /**
   * Compone la escena vista desde `(x, z)` mirando a `yaw`, con `y` el
   * offset de salto/agachado (#446) sobre `ALTURA_OJOS`.
   */
  function componer(x, y, z, yaw, opciones = {}) {
    const { ancho: anchoLienzo = 480, alto: altoLienzo = 270, epoca, fov = 62, otrosJugadores = [] } = opciones;
    const camara = [x, ALTURA_OJOS + y, z];
    const yawCamara = -yaw; // ver el comentario de `yaw` en `cantina-escena.mjs`

    const partes = piezas.map(({ malla, color }) =>
      componerEscena(trasladarMalla(malla, [-camara[0], -camara[1], -camara[2]]), {
        ancho: anchoLienzo,
        alto: altoLienzo,
        epoca,
        fov,
        color,
        posicion: [0, 0, 0],
        yaw: yawCamara,
      }),
    );

    const poligonosJugadores = poligonosOtrosJugadores(otrosJugadores, {
      camara,
      yaw: yawCamara,
      ancho: anchoLienzo,
      alto: altoLienzo,
      epoca,
      fov,
    });

    // Fundido y reordenado global: cada pieza ya viene ordenada por su
    // cuenta, y el orden por pintor no es componible.
    const poligonos = [...partes.flatMap((parte) => parte.poligonos), ...poligonosJugadores]
      .sort((a, b) => b.profundidad - a.profundidad);

    // El cielo por la(s) ventana(s): mismo mecanismo que `cantina-escena.mjs`
    // ("Por el ojo de buey") — se pinta ANTES que los polígonos, así que el
    // propio muro lo recorta y no hace falta máscara.
    const estrellas = cielo
      ? proyectarEstrellas(cielo, { ancho: anchoLienzo, alto: altoLienzo, epoca, fov, yaw: yawCamara })
      : [];

    return { ancho: anchoLienzo, alto: altoLienzo, epoca: partes[0]?.epoca, poligonos, estrellas };
  }

  return { planta, componer };
}
