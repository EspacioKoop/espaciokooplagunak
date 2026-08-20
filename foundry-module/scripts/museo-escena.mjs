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
// Puro y sin color propio (#351).

import { MUSEO } from "./paleta.mjs";
import { crearSalaCaja } from "./nave-sala-caja.mjs";
import { declararInteracciones } from "./nave-interaccion.mjs";
import { CATALOGO_MUSEO, MALLAS_MUSEO } from "./museo-piezas.mjs";

/* ---- medidas de la sala ---------------------------------------------------- */

/**
 * Nueve por siete metros. Una sala de exposición pequeña, no un pabellón: con
 * tres piezas, más superficie no da amplitud, da vacío — y andar diez segundos
 * entre estatua y estatua es lo que convierte un museo en un pasillo.
 */
export const ANCHO = 9.0;
export const PROFUNDIDAD = 7.0;

/** Los pedestales van contra el fondo, alineados y a la misma cota: es la
 *  disposición de una sala de vaciados de verdad, y además deja todo el frente
 *  libre para mirar de lejos antes de acercarse. */
const Z_PEDESTALES = 5.0;
const X_PEDESTALES = Object.freeze([2.0, 4.5, 7.0]);

/**
 * Devuelve la posición (x, z) del pedestal para el índice dado.
 * Usa múltiples filas hacia adelante si hay más piezas que columnas.
 */
function obtenerPosicionPedestal(indice) {
  const fila = Math.floor(indice / X_PEDESTALES.length);
  const indiceEnFila = indice % X_PEDESTALES.length;
  const x = X_PEDESTALES[indiceEnFila];
  const z = Z_PEDESTALES - fila * 1.0; // cada fila está a 1 metro hacia adelante
  return { x, z };
}

/** Medidas del pedestal, en metros. 0,6 de alto es lo que sube una pieza hasta
 *  que su masa queda a la altura del pecho de quien la mira, que es donde una
 *  escultura se lee mejor de pie. */
const PEDESTAL = Object.freeze({ lado: 1.15, alto: 0.6 });
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
const DISTANCIA_MIRADA = 1.5;

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
  const malla = MALLAS_MUSEO[pieza.malla];
  const { x, z } = obtenerPosicionPedestal(indice);
  const cota = PEDESTAL.alto + CORONILLA.alto;
  const limites = limitesDe(malla);
  const trasladada = Object.freeze({
    vertices: malla.vertices.map(([vx, vy, vz]) => [x + vx, cota + vy, z + vz]),
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
    mirador: Object.freeze([x, z - DISTANCIA_MIRADA]),
  });
}

/** Las tres piezas ya colocadas. Se calcula una vez: la sala no cambia. */
export const PIEZAS_COLOCADAS = Object.freeze(CATALOGO_MUSEO.piezas.map(colocarPieza));

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
export const ENTRADA = Object.freeze({ x: ANCHO / 2, z: 1.8, yaw: 0 });

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
  semillaMural: 20260818,
});

export const PLANTA_MUSEO = SALA.planta;
export const componerMuseo = SALA.componer;
export { colocarPieza };
