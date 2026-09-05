// La terraza exterior de la cantina (#579).
//
// QUÉ ES. Una plataforma colgada del costado de la cantina, abierta al espacio,
// con una mesa, sus sillas, una barandilla y un soporte con cañas de pescar. Se
// llega andando desde la cantina y se vuelve por la misma puerta.
//
// QUÉ TIENE QUE TRANSMITIR, que es el requisito y no la geometría:
//
//     «Aquí la tripulación viene a sentarse, fumar, tomar algo y pescar.»
//
// Por eso las cañas no están puestas como objetos técnicos, apoyadas donde
// cupieran: están en su soporte, junto al borde, mirando al vacío. Es lo que
// empieza a hacer que la nave parezca un sitio donde vive gente y no un conjunto
// de habitaciones funcionales.
//
// PRIMER CONSUMIDOR REAL DE #582 Y #583, y por eso importa cómo está escrita.
// Ni una medida de mueble se declara aquí: mesa, silla, soporte, caña y
// barandilla salen del vocabulario común (`nave-props.mjs`), y el punto de pesca
// sale del ANCLA que declara el soporte, no de dos números escritos a ojo. Si
// alguien mueve el soporte, el punto de pesca se mueve con él. Ese era
// literalmente el encargo: «la futura interacción debe poder localizar algo
// equivalente a `punto-pesca` sin coordenadas incrustadas en la escena».
//
// LO QUE NO HACE, y es deliberado: no se pesca. No hay peces, ni recompensa, ni
// inventario. El punto existe y no concede nada — la regla de `docs/FOUNDRY.md`:
// una escena puede enseñar, transportar y ambientar; no conceder, contar ni
// recordar. El día que la pesca dé algo, ese algo es del núcleo.
//
// Y LA CAÑA NO SE RECOGE. Hay dos en el soporte, y el futuro minijuego será
// `terraza → punto de pesca → interacción → se asigna una caña`. Así la primera
// versión de la pesca no acopla el inventario general (decisión de #579).
//
// Puro y sin color propio (#351).

import { SECCION } from "./paleta.mjs";
import { caja, prisma } from "./escena-primitivas.mjs";
import { componerEscena, fundirEscenas } from "./retro3d.mjs";
import { campoEstelar, proyectarEstrellas } from "./retro3d-estrellas.mjs";
import { resolverCamara } from "./nave-camara.mjs";
import { poligonosOtrosJugadores } from "./nave-avatares-render.mjs";
import { crearPlanta } from "./nave-movimiento.mjs";
import { colocarProp } from "./nave-props.mjs";
import { buscarInteraccion, declararInteracciones } from "./nave-interaccion.mjs";
import { definicionesDeAsientos } from "./nave-asiento.mjs";
import { colocarPoseables, declararPoseables } from "./nave-pose.mjs";

/* ---- la plataforma --------------------------------------------------------- */

/**
 * Medidas de la terraza, en metros.
 *
 * Corta a propósito. Es un balcón, no una segunda cantina: lo bastante grande
 * para una mesa con sillas y para pasar por detrás de quien está sentado, y lo
 * bastante pequeña para que el borde —que es lo que la hace ser una terraza— se
 * vea siempre. Una plataforma grande al aire libre deja de dar vértigo, y el
 * vértigo es la mitad de la gracia.
 */
export const ANCHO = 6.4;
export const PROFUNDIDAD = 9.0;

/** El muro de la cantina, que es el único lado cerrado. */
const X_MURO = ANCHO;
/** Dónde se cruza de vuelta, en el muro de la cantina. */
export const PUERTA_CANTINA = Object.freeze({
  x: X_MURO - 0.6,
  z: PROFUNDIDAD / 2 - 1.0,
  ancho: 0.6,
  profundidad: 2.0,
});

/** Grosor de la tarima y cuánto sobresale su canto. */
const TARIMA = 0.22;

/**
 * Dónde se aparece al salir: junto a la puerta y mirando AL BORDE.
 *
 * Mirando al vacío y no a la mesa, a propósito. Lo primero que tiene que pasar
 * al salir a una terraza es darse cuenta de que estás fuera.
 */
export const ENTRADA = Object.freeze({ x: X_MURO - 1.4, z: PROFUNDIDAD / 2, yaw: -Math.PI / 2 });

/* ---- lo que hay encima ----------------------------------------------------- */

/**
 * El mobiliario, todo del vocabulario común (#583).
 *
 * `cuartos` gira cada pieza: la barandilla se declara a lo largo de X, así que
 * los tramos del borde exterior —que corre a lo largo de Z— van girados un
 * cuarto de vuelta. Ni una medida se escribe aquí.
 */
const MOBILIARIO = Object.freeze([
  // La barandilla, tramo a tramo. El borde exterior (x=0) y los dos costados.
  { clave: "barandilla", x: 0.12, z: 1.5, cuartos: 1 },
  { clave: "barandilla", x: 0.12, z: 3.9, cuartos: 1 },
  { clave: "barandilla", x: 0.12, z: 6.3, cuartos: 1 },
  { clave: "barandilla", x: 0.12, z: 8.3, cuartos: 1 },
  { clave: "barandilla", x: 1.3, z: 0.12 },
  { clave: "barandilla", x: 3.7, z: 0.12 },
  { clave: "barandilla", x: 1.3, z: PROFUNDIDAD - 0.12 },
  { clave: "barandilla", x: 3.7, z: PROFUNDIDAD - 0.12 },

  // La mesa. Sus cuatro sillas NO están aquí: tienen pose y viven en
  // `ASIENTOS` — sentarse las retira, que es lo que dice desde fuera que ese
  // sitio está cogido.
  { clave: "mesa", x: 3.5, z: 3.2 },

  // El soporte de cañas, junto al borde y mirando al vacío. Su ANCLA es el punto
  // de pesca — ver `INTERACCIONES`.
  { clave: "soporte", x: 1.5, z: 6.6, cuartos: 3 },

  // Y las cañas, apoyadas en él. Dos, no una: «hay dos o tres en un soporte» es
  // lo que dice que son de la casa y no de nadie (#579).
  { clave: "cana", x: 1.35, z: 6.35, cuartos: 3 },
  { clave: "cana", x: 1.35, z: 6.85, cuartos: 3 },
]);

const COLOCADO = MOBILIARIO.map(({ clave, x, z, cuartos = 0 }, indice) =>
  colocarProp(clave, { x, z, cuartos, nombre: `${clave}-${indice}` }),
);

/**
 * Cuánto se retira un asiento al ocuparse, en metros.
 *
 * 0,25 m: lo que se corre una silla hacia atrás quien se sienta en ella, no lo
 * que se aparta quien la quita de en medio. Es una señal, no una mudanza — con
 * medio metro la silla deja de pertenecer a la mesa, y lo que tiene que decir es
 * «aquí hay alguien», no «aquí sobraba una silla».
 */
const RETIRADA = 0.25;

/**
 * Los asientos de la terraza, con pose (#583 + poses).
 *
 * Van APARTE de `MOBILIARIO` porque no son lo mismo: el resto de la terraza está
 * donde está, y estos cinco tienen dos sitios. Sus poses no declaran geometría,
 * solo desplazamiento en el marco del propio mueble, así que la silla de la
 * izquierda de la mesa se retira hacia su espalda y no hacia el norte.
 *
 * El taburete también se retira, aunque no tenga mesa de la que apartarse: quien
 * se sienta en un taburete lo mueve igual, y darle pose solo a las sillas
 * obligaría a mirar el mueble para saber si se acciona.
 */
export const ASIENTOS = declararPoseables(
  [
    { id: "silla-mesa-sur", clave: "silla", x: 3.5, z: 4.5, cuartos: 2 },
    { id: "silla-mesa-norte", clave: "silla", x: 3.5, z: 1.9 },
    { id: "silla-mesa-oeste", clave: "silla", x: 2.2, z: 3.2, cuartos: 1 },
    { id: "silla-mesa-este", clave: "silla", x: 4.8, z: 3.2, cuartos: 3 },
    // Un taburete suelto junto a la barandilla: el sitio de quien sale a fumar
    // (#439) y no a sentarse a la mesa. Un mueble desemparejado dice más que dos
    // iguales.
    { id: "taburete-borde", clave: "taburete", x: 1.4, z: 2.4 },
  ].map((asiento) => ({ ...asiento, poses: { libre: {}, ocupada: { atras: RETIRADA } } })),
);

/** Los cinco asientos colocados según el estado de poses que se le pase. */
export function asientosColocados(poses = {}) {
  return colocarPoseables(ASIENTOS, poses);
}

/** El soporte de cañas, que es la pieza que declara dónde se pesca. */
const SOPORTE = COLOCADO[MOBILIARIO.findIndex(({ clave }) => clave === "soporte")];

/**
 * Los puntos de interacción de la terraza (#582).
 *
 * `punto-pesca` sale del ANCLA del soporte, no de dos números escritos a ojo:
 * ese es el requisito de #579 y lo único que hace falta hacer bien hoy para que
 * la pesca de mañana no nazca acoplada a estas coordenadas. Se busca por nombre
 * con `buscarInteraccion`.
 *
 * NO CONCEDE NADA. Su `accion` no la atiende nadie todavía, y eso es lo correcto:
 * el punto existe, la mecánica no. Acercarse a las cañas hoy no hace nada, igual
 * que mirar por una ventana no hace nada.
 *
 * LAS SILLAS Y EL TABURETE SÍ (asientos). Salen de `definicionesDeAsientos`
 * sobre los propios `ASIENTOS`, así que no hay ni una coordenada de asiento
 * escrita aquí: quien mueva una silla mueve su sitio con ella, exactamente igual
 * que el punto de pesca sigue al soporte. Y el taburete se sienta sin girarte
 * porque no tiene frente, lo que se decide en el vocabulario y no en esta escena.
 *
 * Se declaran en la pose BASE y no se mueven con ella. Los 25 cm que se retira
 * un asiento al ocuparse caben de sobra en el radio de interacción (1,2 m), así
 * que quien está sentado sigue teniendo su propio asiento al alcance para
 * levantarse — que es lo único que hace falta que siga siendo cierto.
 */
export const INTERACCIONES = declararInteracciones([
  ...definicionesDeAsientos(asientosColocados()),
  {
    id: "punto-pesca",
    punto: SOPORTE.ancla.punto,
    // MEDIA VUELTA respecto al ancla del soporte, y no es un ajuste: el ancla de
    // un soporte dice dónde te pones para COGER algo de él, así que mira hacia
    // el soporte. Para pescar hay que darse la vuelta y mirar al vacío. Los dos
    // gestos ocurren en el mismo sitio, que es justo por lo que el punto sale de
    // ahí en vez de escribirse aparte.
    orientacion: SOPORTE.ancla.orientacion + Math.PI,
    accion: { tipo: "pesca" },
  },
]);

/** Atajo para quien venga después: dónde se pesca, sin saber de esta geometría. */
export function puntoDePesca() {
  return buscarInteraccion(INTERACCIONES, "punto-pesca");
}

/* ---- la escena ------------------------------------------------------------- */

/** El suelo de la terraza y el canto que lo remata. */
function tarima() {
  return [
    {
      malla: caja([ANCHO / 2, -TARIMA / 2, PROFUNDIDAD / 2], [ANCHO, TARIMA, PROFUNDIDAD]),
      color: SECCION.sala,
    },
    // El canto, un tono más claro: es lo que dibuja el BORDE, y el borde es lo
    // que convierte una habitación sin techo en una terraza.
    { malla: caja([0.06, -0.06, PROFUNDIDAD / 2], [0.12, 0.14, PROFUNDIDAD]), color: SECCION.salaBorde },
    { malla: caja([ANCHO / 2, -0.06, 0.06], [ANCHO, 0.14, 0.12]), color: SECCION.salaBorde },
    { malla: caja([ANCHO / 2, -0.06, PROFUNDIDAD - 0.06], [ANCHO, 0.14, 0.12]), color: SECCION.salaBorde },
    // Y los tirantes que la sujetan al casco, vistos desde el borde. Sin ellos
    // la plataforma flota: una terraza tiene que estar colgada DE algo.
    ...[1.6, PROFUNDIDAD / 2, PROFUNDIDAD - 1.6].map((z) => ({
      malla: prisma([ANCHO - 0.5, -TARIMA, z], {
        radioAbajo: 0.11,
        radioArriba: 0.07,
        alto: 1.5,
        lados: 6,
        eje: "x",
      }),
      color: SECCION.casco,
    })),
  ];
}

/** El muro de la cantina, con el hueco por el que se entra. */
function muroDeLaCantina() {
  const ALTURA = 3.2;
  const { z: zPuerta, profundidad: anchoPuerta } = PUERTA_CANTINA;
  const tramos = [
    { z0: 0, z1: zPuerta },
    { z0: zPuerta + anchoPuerta, z1: PROFUNDIDAD },
  ];
  return [
    ...tramos
      .filter(({ z0, z1 }) => z1 - z0 > 0.01)
      .map(({ z0, z1 }) => ({
        malla: caja([X_MURO + 0.25, ALTURA / 2, (z0 + z1) / 2], [0.5, ALTURA, z1 - z0]),
        color: SECCION.casco,
      })),
    // El dintel sobre la puerta, que es lo que la hace leerse como puerta.
    {
      malla: caja([X_MURO + 0.25, 2.55, zPuerta + anchoPuerta / 2], [0.5, 1.3, anchoPuerta]),
      color: SECCION.casco,
    },
    // Marco ámbar, el mismo lenguaje de «esto se cruza» que el resto de la nave.
    {
      malla: caja([X_MURO - 0.02, 1.0, zPuerta + anchoPuerta / 2], [0.06, 2.0, anchoPuerta + 0.16]),
      color: SECCION.entrable,
    },
  ];
}

/** Lo que no se mueve nunca: la plataforma, el muro y el mobiliario sin pose. */
const PIEZAS_FIJAS = Object.freeze([
  ...tarima(),
  ...muroDeLaCantina(),
  ...COLOCADO.flatMap(({ piezas }) => piezas).map(({ malla, color }) => ({ malla, color })),
]);

/** Todas las piezas de la terraza con los asientos en las poses que se le pasen. */
function piezasDe(poses) {
  return [
    ...PIEZAS_FIJAS,
    ...asientosColocados(poses)
      .flatMap(({ piezas }) => piezas)
      .map(({ malla, color }) => ({ malla, color })),
  ];
}

/**
 * La colisión. El suelo entero es andable menos lo que ocupan los muebles, y el
 * borde lo cierra la propia planta: fuera de `ANCHO`/`PROFUNDIDAD` no se pasa.
 *
 * La barandilla NO se declara como obstáculo aparte: sus montantes ya lo son por
 * su huella, y el pasamanos va por encima de la cintura. Lo que impide caerse es
 * el límite de la planta, no el mueble — y así una barandilla es lo que parece,
 * un aviso, y no una pared invisible con adorno.
 */
/** Lo que de un mueble estorba de verdad al andar: ver el comentario de arriba. */
function obstaculosDe(colocados) {
  return colocados.flatMap(({ piezas }) =>
    piezas
      // Lo que va por encima de la cintura no estorba al andar, lo que no llega
      // al tobillo se pisa, y lo que el propio prop declara que no estorba —una
      // caña— no estorba: mismo criterio que la cantina.
      .filter(({ colision }) => colision !== false)
      .filter(({ centro, medidas }) => {
        const base = centro[1] - medidas[1] / 2;
        const alto = centro[1] + medidas[1] / 2;
        return alto >= 0.35 && base <= 1.15;
      })
      .map(({ centro, medidas }) => ({
        x: centro[0] - medidas[0] / 2,
        z: centro[2] - medidas[2] / 2,
        ancho: medidas[0],
        profundidad: medidas[2],
      })),
  );
}

/**
 * La planta de colisión con los asientos en las poses que se le pasen.
 *
 * Es una FUNCIÓN y no una constante porque una silla retirada ocupa otro sitio,
 * y una planta congelada dejaría a quien pasa chocándose con donde estaba la
 * silla hace un momento — el mismo desajuste entre dibujo y colisión que produjo
 * los cuatro fallos de la cantina (#540).
 */
export function plantaTerraza(poses = {}) {
  return crearPlanta({
    ancho: ANCHO,
    profundidad: PROFUNDIDAD,
    obstaculos: [...obstaculosDe(COLOCADO), ...obstaculosDe(asientosColocados(poses))],
  });
}

/** La planta con todos los asientos libres, que es como se abre la terraza. */
export const PLANTA_TERRAZA = plantaTerraza();

/** Las piezas con todos los asientos libres, calculadas una vez. */
const PIEZAS_LIBRES = Object.freeze(piezasDe({}));

/** El cielo de la terraza: el espacio de verdad, no un techo. */
const CIELO = campoEstelar(20260817, { cantidad: 140, radio: 70 });

/**
 * Sin niebla y sin alcance corto: aquí lo que hay al fondo es el vacío, y el
 * vacío no se destiñe. Lo que cierra la escena es el campo de estrellas, que se
 * pinta detrás de todo.
 */
/**
 * El compositor de la terraza con los asientos en unas poses dadas.
 *
 * Devuelve una FUNCIÓN con la firma de siempre, en vez de añadirle un parámetro
 * a `componerTerraza`: el bucle de andar llama a `componer(x, y, z, yaw, ...)` y
 * no sabe —ni tiene por qué— que aquí hay muebles que se mueven. Quien cambia
 * una pose pide un compositor nuevo y se lo da al bucle, igual que se le da uno
 * al cambiar de estancia.
 */
export function componerTerrazaCon(poses = {}) {
  const piezas = piezasDe(poses);
  return (x, y, z, yaw, opciones = {}) => componerConPiezas(piezas, x, y, z, yaw, opciones);
}

/**
 * Compone la terraza con todos los asientos libres. Misma firma que cualquier
 * estancia, y es la que consume el catálogo al abrirla.
 */
export function componerTerraza(x, y, z, yaw, opciones = {}) {
  return componerConPiezas(PIEZAS_LIBRES, x, y, z, yaw, opciones);
}

function componerConPiezas(PIEZAS, x, y, z, yaw, opciones = {}) {
  const {
    ancho: anchoLienzo = 480,
    alto: altoLienzo = 270,
    epoca,
    fov = 62,
    otrosJugadores = [],
    modoCamara,
    avatarPropio = {},
  } = opciones;
  const { camara, dibujarPropio } = resolverCamara({ x, z, y, yaw, modo: modoCamara });
  const yawCamara = -yaw;

  const partes = PIEZAS.map(({ malla, color }) =>
    componerEscena(
      { ...malla, vertices: malla.vertices.map(([vx, vy, vz]) => [vx - camara[0], vy - camara[1], vz - camara[2]]) },
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

  const cuerpos = dibujarPropio ? [...otrosJugadores, { x, y, z, yaw, avatar: avatarPropio }] : otrosJugadores;
  const poligonosJugadores = poligonosOtrosJugadores(cuerpos, {
    camara,
    yaw: yawCamara,
    ancho: anchoLienzo,
    alto: altoLienzo,
    epoca,
    fov,
  });

  const { poligonos } = fundirEscenas([...partes, poligonosJugadores]);
  return {
    ancho: anchoLienzo,
    alto: altoLienzo,
    epoca: partes[0]?.epoca,
    poligonos,
    estrellas: proyectarEstrellas(CIELO, { ancho: anchoLienzo, alto: altoLienzo, epoca, fov, yaw: yawCamara }),
  };
}
