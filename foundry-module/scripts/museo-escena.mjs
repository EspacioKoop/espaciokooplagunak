// La sala del museo (#598): tres piezas, andable, y nada más.
//
// QUÉ ES, Y QUÉ NO. Es el CONSUMIDOR que le faltaba al catálogo con procedencia:
// `catalogo-piezas.mjs` valida la ficha y `museo-piezas.mjs` la ata a una malla;
// aquí esas dos mitades se convierten en un sitio por el que se anda. Nada de lo
// que hay en esta sala es contenido de campaña.
//
// LA REGLA DE `docs/FOUNDRY.md`, aplicada al pie de la letra: una escena puede
// **enseñar, transportar y ambientar**; no puede **conceder, contar ni
// recordar**. Un museo ENSEÑA, y por eso #598 empieza por él y no por el
// bestiario: acercarse a una pieza pinta su cartela y ya está. No se marca como
// vista, no se lleva la cuenta de cuántas van, no queda rastro de la visita. El
// día que un bestiario quiera registrar qué ha encontrado la tripulación, ese
// dato es del núcleo y no de esta ventana.
//
// TRES PIEZAS Y NO TREINTA. La disciplina de #590: una primero, para medir el
// precio. Aquí lo que se mide no es el motor —la sala es una `crearSalaCaja` con
// tres mallas encima de tres pedestales, y eso ya estaba resuelto— sino la
// CARTELA de cada pieza, que es trabajo humano y no escala con el código.
//
// POR QUÉ SE ENTRA POR HERRAMIENTA Y NO POR UNA PUERTA DE LA NAVE. Igual que la
// playa (#587): el Phobos no tiene un museo, y colgarlo de un mamparo contaría
// una historia que nadie ha decidido. Se abre desde la barra de escena, solo GM,
// y se vuelve por la salida, que es su único punto de interacción aparte de las
// piezas.
//
// LA LUZ Y EL COLOR HACEN UN TRABAJO CONCRETO: que la piedra se despegue del
// muro. Muro oscuro, pieza clara, pedestal en medio (ver `MUSEO` en
// `paleta.mjs`). Sin esa separación de valores, tres estatuas de metro y medio
// se leen como bultos pegados a la pared.
//
// LOS CUADROS (#836) SON LA SEGUNDA FORMA DE COLGAR, no un parámetro de la
// primera: una estatua se apoya en un pedestal y se rodea, un cuadro cuelga de
// un muro y solo se mira de frente. Van en los muros LATERALES y no en el del
// fondo, que es el de los pedestales: un cuadro detrás de una escultura le
// disputa la lectura a la escultura, y esta sala está montada para que gane la
// piedra. El dibujo en sí vive en `museo-cuadro.mjs`; aquí solo se decide de
// qué muro cuelga cada uno y desde dónde se mira.
//
// PRESUPUESTO MEDIDO (#836, vuelto a tomar en #838). Los cinco lienzos son
// 96 × 64 celdas cada uno y salen 48, 53, 170, 162 y 149 CARAS después de
// `fundirRectangulos`: ese es todo el truco, dibujos de masas grandes sobre una
// rejilla fina. Vienen de 19, 31, 51, 83 y 61 — el detalle de la celda de
// 1,25 cm multiplica por tres, y lo que se paga en un dibujo es el PERÍMETRO de
// las masas, no su área.
//
// Y la SALA entera bajó al ponerle piel de galería (#838, `museo-mural.mjs`):
// desde el centro mirando al oeste 1.466 -> 994 polígonos, al este 720 -> 267,
// desde la entrada 1.399 -> 894. Un tramo de muro largo pasa de 504 rectángulos
// de chapa a 32. No es una optimización: es que una pared de galería está
// vacía a propósito —lo que tiene que reclamar la mirada es lo colgado— y el
// presupuesto es la consecuencia de esa decisión, no su motivo.
//
// LO QUE SE PROBÓ Y SE RETIRÓ, para que no vuelva: relieve GEOMÉTRICO en los
// cuadros, cada masa de color adelantada unos milímetros con sus costados. Se
// midió rasterizando la escena con y sin él: cambiaba entre 0 y 168 píxeles de
// los 129.600 del fotograma, y ni subiendo el empaste a cinco centímetros
// pasaba del 0,3 %. Lo que se mira de frente enseña sus costados de canto, y a
// 480x270 un canto de milímetros no llega a un píxel — la misma razón por la
// que tampoco costaba polígonos en pantalla. El volumen que sí se ve aquí es el
// PINTADO, y por eso el marco es una moldura dibujada (`marcoMoldura`).
//
// Plantado ante un cuadro no se ven más de un centenar de caras: el lienzo
// llena la pantalla y todo lo demás cae por recorte. Esta es la cifra que hay
// que volver a tomar antes de colgar el sexto, no los tests en verde.
//
// Puro y sin color propio (#351).

import { MUSEO } from "./paleta.mjs";
import { crearSalaCaja } from "./nave-sala-caja.mjs";
import { piezasMuroMuseo } from "./museo-mural.mjs";
import { declararInteracciones } from "./nave-interaccion.mjs";
import { CATALOGO_MUSEO, MALLAS_MUSEO } from "./museo-piezas.mjs";
import { deformarPieza } from "./estatua-rig.mjs";
import { CATALOGO_CUADROS } from "./museo-cuadros.mjs";
import { ALTO_TOTAL, ANCHO_TOTAL, piezasCuadro } from "./museo-cuadro.mjs";

/* ---- medidas de la sala ---------------------------------------------------- */

/**
 * Nueve por siete metros. Una sala de exposición pequeña, no un pabellón: con
 * tres piezas, más superficie no da amplitud, da vacío — y andar diez segundos
 * entre estatua y estatua es lo que convierte un museo en un pasillo.
 */
// La sala creció de 9x7 a 12x9 (#590), de ahí a 12x10 (#757) y a 15x10 al
// fusionar #757 con los cuadros de #836/#838: con las columnas de pedestales
// repartidas por `ANCHO` (#590), las dos columnas de los extremos quedaban a
// 0,575 m de los muros laterales — justo donde #836 cuelga los cuadros. Un
// cuadro pegado al muro y una escultura a 0,575 m de ese mismo muro caen a
// menos de 1,5 m el uno del otro sea cual sea el z que se elija, y su propio
// mirador —a 1,1 m del muro— caía encima del pedestal: no era un límite mal
// puesto, es que no había SITIO. Ensanchar a 15 (`MARGEN_MURO_PEDESTAL` más
// abajo, 2,1 m) es lo que abre ese sitio sin tocar ninguna de las dos cuentas
// que ya dependían del ancho — ni las 18 mallas de vaciados, ni las columnas.
export const ANCHO = 15.0;
export const PROFUNDIDAD = 10.0;

/** La fila del fondo, a dos metros del muro: lo justo para rodear una pieza. */
const Z_PEDESTALES = PROFUNDIDAD - 2.0;

/** Medidas del pedestal, en metros. 0,6 de alto es lo que sube una pieza hasta
 *  que su masa queda a la altura del pecho de quien la mira, que es donde una
 *  escultura se lee mejor de pie. */
const PEDESTAL = Object.freeze({ lado: 1.15, alto: 0.6 });

/** La z de la entrada. Se usa para no plantar un pedestal encima de la puerta. */
const Z_ENTRADA = 1.8;

/**
 * Cuánto separa una fila de pedestales de la siguiente, en metros.
 *
 * NO es un número redondo elegido a ojo, y por eso está aquí y no incrustado: un
 * pedestal mide `PEDESTAL.lado` (1,15 m), así que a un metro las filas SE
 * SOLAPAN —se probó y se metían 15 cm la una en la otra—. Al lado del ancho hay
 * que dejar además por dónde pasar: `PASO_ENTRE_FILAS` es el lado más el hueco
 * de una persona andando de frente.
 */
/**
 * El radio del cuerpo con el que la sala se recorre. Es el mismo que usa
 * `nave-movimiento` para colisionar, y aquí manda porque un pasillo se mide por
 * quien tiene que caber en él, no por lo que sobre después de poner las piezas.
 */
const RADIO_CUERPO = 0.35;

/** Lo que se deja de aire entre el cuerpo de quien mira y la pieza. */
const MARGEN_MIRADA = 0.10;

/**
 * El pasillo entre dos filas: una persona de frente (`2 * RADIO_CUERPO`) más un
 * margen para no ir rozando el pedestal.
 *
 * Estaba en 0,8 m, que es MENOS que el diámetro de quien anda (0,70) más
 * cualquier margen, y de ahí salió el fallo de #757: entre dos filas quedaba una
 * franja pisable de 10 cm de ancho. No es que el mirador estuviera mal puesto —
 * es que no había dónde ponerlo.
 */
const HUECO_PARA_ANDAR = 2 * RADIO_CUERPO + 0.30;
const PASO_ENTRE_FILAS = PEDESTAL.lado + HUECO_PARA_ANDAR;

/** Cuántas filas caben del fondo hacia la entrada sin llegar a taparla. */
const FILAS_QUE_CABEN = Math.max(
  1,
  Math.floor((Z_PEDESTALES - Z_ENTRADA - PEDESTAL.lado) / PASO_ENTRE_FILAS) + 1,
);

/**
 * Las columnas SALEN DE LO QUE MIDE LA SALA, no de una lista escrita a mano.
 *
 * Estaban fijas en `[2.0, 4.5, 7.0]`, así que ensanchar la sala no metía ni una
 * pieza más: el ancho crecía y los tres pedestales seguían donde estaban. Ahora
 * se reparten centradas, tantas como quepan guardando `PASO_ENTRE_FILAS`.
 */
/**
 * Cuánto se deja entre una columna de pedestales y el muro lateral.
 *
 * NO es `PEDESTAL.lado / 2` (pegar la columna al muro salvo por medio
 * pedestal): un cuadro de #836 cuelga justo en ese muro, y la prueba de
 * "ningún cuadro se cuelga detrás de una escultura" exige más de 1,5 m entre
 * el centro del cuadro (en el propio muro, `dx = 0`) y el de la escultura más
 * cercana. Con solo `dx = 0,575` esa distancia depende de acertar un `dz`
 * enorme, y la fila delantera —la que #757 acerca a la entrada para dejar
 * sitio a piezas hondas como el caballo ecuestre— no lo tiene. Fijar el
 * margen en la propia distancia mínima (1,6, con un pelín de holgura sobre
 * 1,5) hace que la columna quede fuera de alcance sea cual sea el `dz`.
 */
const MARGEN_MURO_PEDESTAL = 2.1;
const X_PEDESTALES = Object.freeze(
  (() => {
    const offset = Math.max(PEDESTAL.lado / 2, MARGEN_MURO_PEDESTAL);
    const disponible = ANCHO - 2 * offset;
    const columnas = Math.max(1, Math.floor(disponible / PASO_ENTRE_FILAS) + 1);
    if (columnas === 1) return [ANCHO / 2];
    const separacion = disponible / (columnas - 1);
    return Array.from({ length: columnas }, (_, i) => offset + i * separacion);
  })(),
);

/**
 * Cuántas piezas caben de verdad. Con 15x10 m siguen siendo **18**, que son
 * exactamente las mallas de vaciados que hay hoy en `foundry-module/data/mallas/`
 * — el ancho creció para dejar sitio a los cuadros de #836/#838, no para meter
 * una columna más.
 *
 * Se declara porque es un límite que hay que saber ANTES de ampliar el catálogo,
 * y porque ahora depende de las medidas de la sala: tocar `ANCHO` o
 * `PROFUNDIDAD` cambia esto solo, sin listas que actualizar a mano.
 */
export const CAPACIDAD = X_PEDESTALES.length * FILAS_QUE_CABEN;

/**
 * A qué z va cada fila, contando desde el fondo.
 *
 * NO es `Z_PEDESTALES - fila * PASO_ENTRE_FILAS`. Ese reparto uniforme suponía
 * que todas las piezas ocupan lo que ocupa su pedestal, y es falso: las mallas
 * no se reescalan en la escena (la altura se decide al convertir) y
 * `caballo-marco-aurelio` mide 2,64 m de fondo sobre una base de 1,15. Vuela
 * 1,3 m por delante Y por detrás, así que se comía el mirador de su propia fila
 * y el de la fila de atrás. Doce de dieciocho miradores caían dentro de un
 * obstáculo (#757).
 *
 * Así que el pasillo entre dos filas se calcula con lo que de verdad hay en
 * ellas: quien mira la fila `r` se pone delante de la pieza más honda de esa
 * fila, y a la vez tiene que quedar libre de la pieza más honda de la fila de
 * delante. La separación es la suma de las dos holguras, nunca menor que el
 * pasillo mínimo para andar.
 *
 * Se recorre de delante hacia atrás porque la fila de delante es la que tiene
 * el resto del museo por delante para apartarse, y ahí es donde
 * `PUESTO_EN_LA_REJILLA` manda las piezas más hondas.
 */
/**
 * Qué puesto de la rejilla ocupa cada pieza.
 *
 * NO es el orden del catálogo: las piezas se reparten por FONDO, y la más honda
 * se lleva la fila de delante. El motivo es que una pieza que vuela por delante
 * de su pedestal necesita suelo libre donde ponerse a mirarla, y la única fila
 * que tiene suelo libre delante —el resto del museo— es la primera. En las
 * demás, lo que hay delante es el pedestal de la fila siguiente.
 *
 * Con el catálogo de hoy solo importa para una pieza (el caballo ecuestre, 2,64 m
 * de fondo frente a los 1,29 del siguiente), pero se hace por regla y no por
 * excepción con su nombre: la fila de delante es donde va lo que sobresale, sea
 * cual sea la pieza que sobresalga mañana.
 *
 * Los índices altos son la fila de delante (`obtenerPosicionPedestal` cuenta las
 * filas desde el fondo), así que ordenar por fondo ASCENDENTE y repartir en ese
 * orden deja lo más hondo al final, que es delante.
 */
const PUESTO_EN_LA_REJILLA = (() => {
  const fondoDe = (pieza) => {
    const zs = MALLAS_MUSEO[pieza.malla].vertices.map(([, , z]) => z);
    return Math.max(...zs) - Math.min(...zs);
  };
  const porFondo = CATALOGO_MUSEO.piezas
    .map((pieza, orden) => ({ orden, fondo: fondoDe(pieza) }))
    // El desempate por `orden` mantiene el reparto ESTABLE: dos piezas del mismo
    // fondo no pueden intercambiarse de sitio entre ejecuciones.
    .sort((a, b) => a.fondo - b.fondo || a.orden - b.orden);
  const puestos = new Array(CATALOGO_MUSEO.piezas.length);
  porFondo.forEach(({ orden }, indice) => {
    puestos[orden] = indice;
  });
  return Object.freeze(puestos);
})();

/** El mirador, en el centro del pasillo entre filas. */
const DISTANCIA_MIRADA = PASO_ENTRE_FILAS / 2;

const HOLGURA_MIRADA = RADIO_CUERPO + MARGEN_MIRADA;

/** La distancia de mirada de una fila, a partir del medio fondo de su pieza más
 *  honda. Es la misma regla que aplica `distanciaDeMirada` a cada pieza. */
function distanciaDeFila(medioFondo) {
  return Math.max(DISTANCIA_MIRADA, medioFondo + HOLGURA_MIRADA);
}

const Z_DE_CADA_FILA = (() => {
  const columnas = X_PEDESTALES.length;
  const total = CATALOGO_MUSEO.piezas.length;

  // El medio fondo de la pieza más honda de cada fila. `filaDesdeElFondo` es el
  // índice tal y como lo usa `obtenerPosicionPedestal` (0 = fondo).
  const medioFondoPorFila = [];
  for (let i = 0; i < total; i += 1) {
    const fila = Math.floor(PUESTO_EN_LA_REJILLA[i] / columnas);
    const zs = MALLAS_MUSEO[CATALOGO_MUSEO.piezas[i].malla].vertices.map(([, , z]) => z);
    const medio = (Math.max(...zs) - Math.min(...zs)) / 2;
    medioFondoPorFila[fila] = Math.max(medioFondoPorFila[fila] ?? 0, medio);
  }

  const filas = medioFondoPorFila.length;
  const z = new Array(filas);
  // La de delante (índice mayor) es la primera que se sitúa: su mirador cae en
  // el suelo abierto hacia la entrada, así que solo tiene que dejar sitio a su
  // propia pieza y no pisar la puerta.
  const delante = filas - 1;
  z[delante] = Z_ENTRADA + medioFondoPorFila[delante] + 2 * HOLGURA_MIRADA;
  for (let fila = delante - 1; fila >= 0; fila -= 1) {
    // La holgura de delante es la distancia de mirada REAL de esta fila, no la
    // que le tocaría por su fondo: `distanciaDeMirada` nunca baja del medio
    // pasillo, así que en una fila de piezas pequeñas el mirador queda MÁS
    // adelantado de lo que su propio fondo pediría. Calcular la separación con
    // el fondo en vez de con la distancia real dejaba a la venus capitolina a
    // 20 cm de la grupa del caballo.
    const separacion = Math.max(
      PASO_ENTRE_FILAS,
      distanciaDeFila(medioFondoPorFila[fila]) + medioFondoPorFila[fila + 1] + HOLGURA_MIRADA,
    );
    z[fila] = z[fila + 1] + separacion;
  }
  return Object.freeze(z);
})();

/**
 * Dónde va el pedestal número `indice`.
 *
 * Se llena la fila del fondo y se avanza hacia la entrada. La sala se queda sin
 * filas antes de llegar a ella: `FILAS_QUE_CABEN` está calculado para que el
 * último pedestal deje libre la puerta por la que se entra —con 12 piezas y el
 * paso de un metro, un pedestal caía justo encima de `ENTRADA`—. Pasado ese
 * tope se reparte otra vez desde el fondo en vez de invadirla: amontonar dos
 * piezas se ve raro, pero tapar la salida deja a la gente encerrada.
 */
function obtenerPosicionPedestal(indice) {
  // Pasarse de la capacidad NO se apaña en silencio. La version anterior hacia
  // `% FILAS_QUE_CABEN` y las piezas de mas volvian al fondo, encima de las que
  // ya estaban: el catalogo crecia, la sala se veia igual y nadie se enteraba.
  if (indice >= CAPACIDAD) {
    throw new RangeError(
      `El museo admite ${CAPACIDAD} piezas y se ha pedido la ${indice + 1}. ` +
        "Ensanchar la sala es una decision de diseno, no un ajuste: mira CAPACIDAD.",
    );
  }
  const columnas = X_PEDESTALES.length;
  const fila = Math.floor(indice / columnas);
  return {
    x: X_PEDESTALES[indice % columnas],
    z: Z_DE_CADA_FILA[fila],
  };
}

/** La coronilla: una losa fina y más clara sobre el bloque. Sin ella el pedestal
 *  es un prisma plano y la pieza parece brotar de él. */
const CORONILLA = Object.freeze({ lado: 1.3, alto: 0.08 });

/** La cartela física, junto al pedestal. Va EN BLANCO a propósito: el texto se
 *  lee en la ventana, no pintado en el mundo. Un cartel con letras dibujadas en
 *  la escena sería una lectura que el motor no puede sostener a esa resolución
 *  —la regla de #526— y encima habría que repintarlo por idioma. */
const CARTELA = Object.freeze({ ancho: 0.42, alto: 0.3, grosor: 0.05, cota: 0.95 });

/** Dónde se planta quien mira, delante de cada pedestal. Metro y medio: lo justo
 *  para tener la pieza entera en el campo de visión sin retroceder. */
/**
 * A qué distancia por delante de la pieza se pone quien la mira.
 *
 * SE DERIVA DEL PASILLO, no se escribe al lado. Era `1.5` fijo mientras las
 * filas iban a `PASO_ENTRE_FILAS` (1,95 m) unas de otras: el mirador caía a
 * 1,5 m por delante de su pedestal, o sea DENTRO del pedestal de la fila de
 * delante, cuyo borde empieza a 1,375 m. Doce de las dieciocho piezas tenían su
 * mirador dentro de un obstáculo, y `interaccionAlAlcance` seguía encontrando la
 * cartela desde ahí: la escena daba verde y no se podía recorrer.
 *
 * Puesto en el centro del pasillo, la holgura a los pedestales de delante y de
 * atrás es la misma y vale para cualquier `PASO_ENTRE_FILAS` que se elija
 * después. Un número suelto vuelve a desincronizarse en cuanto alguien mueve
 * las filas; este no puede.
 */

/**
 * Y la pieza también estorba, no solo el pedestal.
 *
 * `caballo-marco-aurelio` mide 2,64 m de fondo sobre un pedestal de 1,15: vuela
 * 1,3 m por delante de su base. Con la distancia sacada solo del pasillo, quien
 * mirase el caballo quedaba DENTRO del caballo. Las mallas no se reescalan en la
 * escena a propósito —la altura se decide al convertir, y dos mandos de escala
 * para lo mismo es peor que una estatua larga—, así que quien tiene que ceder es
 * el mirador: se aparta lo que haga falta para dejar libre la caja real de la
 * pieza, más el cuerpo de quien mira y un margen.
 */

function distanciaDeMirada(limites) {
  const medioFondo = (limites.z1 - limites.z0) / 2;
  return Math.max(DISTANCIA_MIRADA, medioFondo + RADIO_CUERPO + MARGEN_MIRADA);
}

/* ---- colocar una pieza ----------------------------------------------------- */

/** La caja que ocupa una malla, en sus propias coordenadas. */
function limitesDe(malla) {
  const xs = malla.vertices.map(([x]) => x);
  const ys = malla.vertices.map(([, y]) => y);
  const zs = malla.vertices.map(([, , z]) => z);
  return {
    x0: Math.min(...xs), x1: Math.max(...xs),
    y0: Math.min(...ys), y1: Math.max(...ys),
    z0: Math.min(...zs), z1: Math.max(...zs),
  };
}

/**
 * Coloca una pieza del catálogo sobre su pedestal.
 *
 * La malla llega de `tools/convertir-estatua.mjs` centrada en planta y APOYADA
 * EN EL SUELO (`y = 0` es su base, y una prueba de higiene lo comprueba pieza a
 * pieza), así que colocarla es sumarle la cota del pedestal y llevarla a su x/z.
 * No se escala nada aquí: la altura se decidió al convertir, y volver a tocarla
 * en la escena sería tener dos mandos de escala para lo mismo.
 *
 * @param {object} pieza entrada del catálogo.
 * @param {number} indice puesto que ocupa en la fila.
 */
function colocarPieza(pieza, indice) {
  // Fase 4 de #603: una pieza puede declarar un `rig` y se dobla según él antes
  // de colocarla. Sin `rig` la malla entra igual que siempre, así que el aspecto
  // actual del museo no cambia: solo se habilita la pose donde se declare.
  let malla = MALLAS_MUSEO[pieza.malla];
  if (pieza.rig) {
    malla = deformarPieza(malla, pieza.rig);
  }
  const { x, z } = obtenerPosicionPedestal(indice);
  const cota = PEDESTAL.alto + CORONILLA.alto;
  const limites = limitesDe(malla);
  // `tools/convertir-estatua.mjs` no fija ningún "frente" al convertir: cada
  // malla queda mirando hacia donde apuntaba en su escaneo, y nada garantiza
  // que coincida con el lado por el que se la mira en esta sala (el mirador
  // SIEMPRE está al lado de la entrada, `z` más pequeño — es el único lado con
  // suelo libre). `girada180` es el escape para las piezas donde no coincide:
  // gira 180° alrededor de su propio eje vertical, ANTES de trasladar. Es
  // seguro para el reparto de filas (`Z_DE_CADA_FILA` lee `MALLAS_MUSEO`
  // directamente, sin pasar por aquí) porque una pieza centrada en planta
  // (`tools/convertir-estatua.mjs`) tiene el mismo cuadro delimitador antes y
  // después de un giro de 180°: lo único que cambia es qué lado mira a quién.
  const girar = pieza.girada180 === true;
  const trasladada = Object.freeze({
    vertices: malla.vertices.map(([vx, vy, vz]) =>
      girar ? [x - vx, cota + vy, z - vz] : [x + vx, cota + vy, z + vz],
    ),
    caras: malla.caras,
  });
  return Object.freeze({
    pieza,
    malla: trasladada,
    // El yeso de un vaciado y la piedra de una reconstrucción no son el mismo
    // material, y la cartela lo dice: que no lo digan también los dos colores
    // sería contradecirla con la pintura.
    color: pieza.naturaleza === "reconstruccion" ? MUSEO.piedra : MUSEO.yeso,
    centro: Object.freeze([x, cota + (limites.y1 - limites.y0) / 2, z]),
    medidas: Object.freeze([
      limites.x1 - limites.x0,
      limites.y1 - limites.y0,
      limites.z1 - limites.z0,
    ]),
    // Delante de la pieza es hacia −z: los pedestales están contra el fondo y se
    // miran desde la sala. `yaw = 0` mira a +z, así que quien se planta aquí
    // mira de frente al pedestal sin tener que girarse.
    mirador: Object.freeze([x, z - distanciaDeMirada(limites)]),
  });
}

/** Las piezas ya colocadas. Se calcula una vez: la sala no cambia. */
export const PIEZAS_COLOCADAS = Object.freeze(
  CATALOGO_MUSEO.piezas.map((pieza, orden) => colocarPieza(pieza, PUESTO_EN_LA_REJILLA[orden])),
);

/* ---- colgar un cuadro ------------------------------------------------------ */

/**
 * El tramo de muro lateral del que se puede colgar, en metros de z.
 *
 * Los dos extremos están puestos por un motivo distinto y por eso se declaran
 * los dos, en vez de sacar uno del otro:
 *
 * - `desde` deja libre la esquina de la entrada. Se entra por ahí, y un cuadro
 *   pegado a la puerta se pasa de largo antes de verlo.
 * - `hasta` es lo que la fila de pedestales deja libre. Un cuadro colgado
 *   detrás de una escultura le disputa la lectura a la escultura, y esta sala
 *   está montada para que gane la piedra: por eso el muro se corta ANTES de
 *   llegar al fondo y no se llena hasta la esquina.
 *
 * Todo esto pasa en la mitad de la sala que da a la entrada, que es donde se
 * mira: se entra de cara a las esculturas, y un cuadro a la espalda no lo ve
 * nadie salvo al salir.
 */
const Z_LIBRE = Object.freeze({ desde: 0.8, hasta: 5.6 });

/**
 * Cuánto se deja entre marco y marco. NO es un margen estético: es lo que hace
 * que dos cuadros se lean como dos obras y no como un friso. Con menos, la
 * pareja se mira de una vez; con mucho más, no caben tres en el tramo libre.
 */
const HUECO_ENTRE_CUADROS = 0.4;

/**
 * Las z de los ganchos, repartidas por el tramo libre. SALEN DE LO QUE MIDE LA
 * SALA, igual que `X_PEDESTALES` (#590): escribirlas a mano dejaría el reparto
 * mintiendo el día que la sala cambie de tamaño o el cuadro de formato.
 */
const Z_CUADROS = Object.freeze(
  (() => {
    const tramo = Z_LIBRE.hasta - Z_LIBRE.desde;
    const paso = ANCHO_TOTAL + HUECO_ENTRE_CUADROS;
    const cuantos = Math.max(1, Math.floor((tramo - ANCHO_TOTAL) / paso) + 1);
    const ocupado = ANCHO_TOTAL * cuantos + HUECO_ENTRE_CUADROS * (cuantos - 1);
    const margen = (tramo - ocupado) / 2;
    return Array.from(
      { length: cuantos },
      (_, i) => Z_LIBRE.desde + margen + ANCHO_TOTAL / 2 + i * paso,
    );
  })(),
);

/** El borde INFERIOR del marco, en metros. Con los 90 cm de alto del cuadro, su
 *  centro cae a 1,60 — la altura a la que se cuelga de verdad, que es la del ojo
 *  de quien mira de pie y no la mitad del muro. */
const COTA_CUADRO = 1.15;

/** A qué distancia del muro se planta quien mira. Menos que ante una escultura
 *  (`DISTANCIA_MIRADA`): un cuadro de metro y pico se abarca de cerca, y a metro
 *  y medio de un muro se está mirando el muro. */
const DISTANCIA_CUADRO = 1.1;

/**
 * Los dos muros de los que se puede colgar, en la convención de `chapaEnCara`.
 *
 * El interior de la sala va de 0 a `ANCHO` —es lo que ocupa la losa del suelo
 * que monta `crearSalaCaja`—, así que sus dos caras interiores están en esos dos
 * planos exactos, mirando hacia dentro. Se declaran aquí y no se deducen del
 * grosor del muro: ese grosor es un detalle privado de la fábrica de salas, y
 * copiarlo aquí sería atarse a él.
 */
const MUROS_LATERALES = Object.freeze([
  Object.freeze({ eje: "z", plano: 0, sentido: 1, mirador: DISTANCIA_CUADRO, yaw: -Math.PI / 2 }),
  Object.freeze({
    eje: "z",
    plano: ANCHO,
    sentido: -1,
    mirador: ANCHO - DISTANCIA_CUADRO,
    yaw: Math.PI / 2,
  }),
]);

/**
 * Cuántos cuadros caben de verdad: los ganchos de un muro por los dos muros.
 *
 * Se declara por el mismo motivo que `CAPACIDAD` en los pedestales: es un límite
 * que hay que saber ANTES de escribir la sexta cartela, no al colgarla.
 */
export const GANCHOS = MUROS_LATERALES.length * Z_CUADROS.length;

/**
 * Cuelga un cuadro del gancho que le toca.
 *
 * SE ALTERNA DE MURO EN MURO y no se llena uno antes que el otro: con cinco
 * cuadros seguidos, llenar primero el oeste dejaría una pared con tres y otra
 * con dos al fondo, y quien entra vería toda la colección a un lado. Alternando,
 * la sala está repartida sea cual sea el número de fichas del catálogo.
 *
 * Pasarse no se apaña en silencio, igual que `obtenerPosicionPedestal`: dónde va
 * el cuadro que ya no cabe es una decisión de diseño —otro tramo de muro, otro
 * formato, otra sala—, no un hueco que aparezca solo.
 *
 * OJO CON EL ESPEJO: los dos muros comparten el sentido de la coordenada `u`
 * (creciente en z), así que el mismo dibujo colgado en los dos saldría en
 * espejo el uno del otro. No se corrige porque no hay nada que corregir con
 * composiciones distintas, pero conviene saberlo antes de colgar la misma dos
 * veces.
 */
function colgarCuadro(pieza, indice) {
  if (indice >= GANCHOS) {
    throw new RangeError(
      `El museo tiene ${GANCHOS} ganchos y se ha pedido el ${indice + 1}. ` +
        "Dónde va el siguiente cuadro es una decisión de diseño, no un hueco que aparezca solo.",
    );
  }
  const muro = MUROS_LATERALES[indice % MUROS_LATERALES.length];
  const z = Z_CUADROS[Math.floor(indice / MUROS_LATERALES.length)];
  const u = z - ANCHO_TOTAL / 2;
  return Object.freeze({
    pieza,
    chapas: Object.freeze(
      piezasCuadro({ cara: muro, u, cota: COTA_CUADRO, composicion: pieza.malla }),
    ),
    centro: Object.freeze([muro.plano, COTA_CUADRO + ALTO_TOTAL / 2, z]),
    // Delante del cuadro y mirando al muro. La orientación se declara y no se
    // deduce: un cuadro solo se mira de un lado, al revés que una consola.
    mirador: Object.freeze([muro.mirador, z]),
    yaw: muro.yaw,
  });
}

/** Los cuadros ya colgados, en el orden del catálogo. */
export const CUADROS_COLGADOS = Object.freeze(CATALOGO_CUADROS.piezas.map(colgarCuadro));

/* ---- la salida ------------------------------------------------------------- */

/**
 * Por dónde se vuelve. Un torno de salida contra el muro de entrada, con su
 * punto de interacción delante: el mismo camino que la cabina de teléfono de la
 * playa (#587), que devuelve a la cantina reusando el salto de estancia que ya
 * existe en vez de estrenar uno.
 */
const SALIDA = Object.freeze({
  centro: Object.freeze([ANCHO / 2, 0.55, 0.7]),
  medidas: Object.freeze([1.1, 1.1, 0.35]),
});

/** Donde se aparece al entrar: en el centro del frente, mirando a las piezas. */
export const ENTRADA = Object.freeze({ x: ANCHO / 2, z: Z_ENTRADA, yaw: 0 });

/* ---- la sala --------------------------------------------------------------- */

function mobiliario() {
  const piezas = [];
  for (const colocada of PIEZAS_COLOCADAS) {
    const [x, , z] = colocada.centro;
    piezas.push({
      centro: [x, PEDESTAL.alto / 2, z],
      medidas: [PEDESTAL.lado, PEDESTAL.alto, PEDESTAL.lado],
      color: MUSEO.pedestal,
    });
    piezas.push({
      centro: [x, PEDESTAL.alto + CORONILLA.alto / 2, z],
      medidas: [CORONILLA.lado, CORONILLA.alto, CORONILLA.lado],
      color: MUSEO.pedestalCanto,
    });
    piezas.push({
      malla: colocada.malla,
      centro: colocada.centro,
      medidas: colocada.medidas,
      color: colocada.color,
    });
    // La cartela, a la derecha del pedestal y a la altura a la que se lee de
    // pie. No colisiona: chocarse con un cartel de museo es de las cosas que
    // rompen un sitio.
    piezas.push({
      centro: [x + CORONILLA.lado / 2 + 0.35, CARTELA.cota, z - 0.2],
      medidas: [CARTELA.ancho, CARTELA.alto, CARTELA.grosor],
      color: MUSEO.cartel,
      colision: false,
    });
  }
  piezas.push({ centro: [...SALIDA.centro], medidas: [...SALIDA.medidas], color: MUSEO.zocalo });
  // Los cuadros entran como mobiliario con su malla propia, SIN colisión y SIN
  // piel: el muro del que cuelgan ya frena a quien se acerque —chocarse con un
  // cuadro es de las cosas que rompen un sitio, igual que chocarse con una
  // cartela—, y la piel de serie es chapa remachada de casco, que sobre un
  // lienzo pintado sería el material equivocado (#550).
  for (const colgado of CUADROS_COLGADOS) {
    for (const { malla, color } of colgado.chapas) {
      piezas.push({ malla, color, colision: false, piel: false });
    }
  }
  return piezas;
}

/**
 * Los puntos de interacción: uno por pieza, más la salida.
 *
 * `accion.tipo === "cartela"` es opaco para el motor de andar, igual que
 * `"consola"` o `"estancia"`: transporta el ID de la pieza y quien recibe decide
 * qué hacer con él (#582). La ventana lo resuelve contra el catálogo y pinta la
 * ficha; nadie más necesita saber qué es un museo.
 */
export const INTERACCIONES = declararInteracciones([
  ...PIEZAS_COLOCADAS.map((colocada) => ({
    id: `pieza-${colocada.pieza.id}`,
    punto: [...colocada.mirador],
    orientacion: 0,
    accion: { tipo: "cartela", pieza: colocada.pieza.id },
  })),
  ...CUADROS_COLGADOS.map((colgado) => ({
    id: `cuadro-${colgado.pieza.id}`,
    punto: [...colgado.mirador],
    orientacion: colgado.yaw,
    accion: { tipo: "cartela", pieza: colgado.pieza.id },
  })),
  {
    id: "salida",
    punto: [SALIDA.centro[0], SALIDA.centro[2] + 0.9],
    orientacion: Math.PI,
    accion: { tipo: "estancia", estancia: "cantina" },
  },
]);

const SALA = crearSalaCaja({
  ancho: ANCHO,
  profundidad: PROFUNDIDAD,
  mobiliario: mobiliario(),
  colorMuro: MUSEO.muro,
  colorColumna: MUSEO.zocalo,
  // Sin ventanas: una sala de exposición se ilumina sola y un ventanal al vacío
  // detrás de las piezas las dejaría a contraluz, que es la peor manera posible
  // de enseñar una escultura.
  // Y sin piel de objetos (#550): la piel de serie es chapa remachada de casco,
  // y un pedestal de museo remachado sería un material equivocado, el mismo
  // motivo por el que la cantina la apaga en sus muebles de madera.
  pielObjetos: false,
  // Y con su propia piel de muro (#838). La de serie es chapa remachada de
  // casco: sirve para una nave y es el fondo equivocado para una obra colgada,
  // por lo mismo que un pedestal remachado sería el material equivocado. La de
  // aquí es una pared de galería —rodapié, paño liso, riel de cuelgue, cornisa—
  // y está deliberadamente vacía: en un museo lo que tiene que reclamar la
  // mirada es lo colgado, no la pared.
  piezasPielMuro: piezasMuroMuseo,
  semillaMural: 20260818,
});

export const PLANTA_MUSEO = SALA.planta;
export const componerMuseo = SALA.componer;
// Se exportan para las pruebas: el reparto es la parte que hay que poder
// interrogar con mas piezas de las que hoy tiene el catalogo.
export { colocarPieza, colgarCuadro, obtenerPosicionPedestal, MUROS_LATERALES, PEDESTAL, Z_CUADROS };
