// La playa de pruebas (#587): el primer EXTERIOR del módulo.
//
// PARA QUÉ ESTÁ. Es un banco de pruebas de los puntos de interacción (#582) y
// del vocabulario de props (#583) antes de gastarlos en la terraza de #579, que
// sí tiene que quedar bien. Una sala de nave más no probaría nada que las trece
// del Phobos no prueben ya; un exterior rompe TODOS los supuestos de
// `crearSalaCaja` a la vez —no hay caja, ni techo, ni rodapié, el suelo tiene
// pendiente, hay geometría a cientos de metros y el fondo no es gris de
// mamparo—, y eso es exactamente lo que interesa descubrir aquí y no allí.
//
// LAS REFERENCIAS SON KINGDOM HEARTS Y DIGIMON ADVENTURE. La cabina de teléfono
// plantada en mitad de la arena viene de la segunda, y no es un chiste interno:
// es el elemento que convierte una playa genérica en un SITIO. Sin ella esto es
// un degradado de arena; con ella, alguien pregunta qué hace ahí.
//
// LO QUE ESTA ESCENA DEJA AL DESCUBIERTO, a propósito y documentado: el motor de
// movimiento no tiene altura de terreno (`nave-movimiento.mover` resuelve en
// planta y `y` es solo salto/agachado). Se anda por la duna a cota cero, así que
// la duna sube MUY poco —lo que se hunden los pies es proporcional a lo que
// suba— y a partir de cierta altura pasa a ser obstáculo. No es un descuido
// disimulado: es el primer límite que este banco de pruebas ha encontrado.
//
// Puro y sin color propio (#351): los colores salen de `PLAYA` en `paleta.mjs`.

import { PLAYA } from "./paleta.mjs";
import { caja } from "./cantina-escena.mjs";
import { componerEscena, fundirEscenas } from "./retro3d.mjs";
import { resolverCamara } from "./nave-camara.mjs";
import { poligonosOtrosJugadores } from "./nave-avatares-render.mjs";
import { crearPlanta } from "./nave-movimiento.mjs";
import { colocarProp, definirVocabulario } from "./nave-props.mjs";
import { declararInteracciones } from "./nave-interaccion.mjs";

/* ---- medidas de la playa -------------------------------------------------- */

/**
 * La franja jugable, en metros. `ancho` es el eje X y va de tierra (0) a mar
 * (24); `profundidad` es el eje Z y es por donde se pasea a lo largo.
 *
 * Las cotas de cada franja se escriben una vez aquí porque la escena se lee de
 * izquierda a derecha y así se puede comprobar de un vistazo que suman lo que
 * pide el encargo: cinco metros lisos, un camino ancho, la duna a la izquierda y
 * los postes a otros cinco metros del camino.
 */
export const ANCHO = 24;
export const PROFUNDIDAD = 44;

/** Donde empieza el agua. A partir de aquí no se pasa. */
const ORILLA = 19;
/** Los cinco metros lisos: arena que acaba de dejar el mar. */
const LISO_DESDE = 14;
/** El camino ancho de arena fina, seis metros de ida y vuelta. */
const CAMINO_DESDE = 8;
/** Los postes, a cinco metros del borde del camino. */
const X_POSTES = CAMINO_DESDE - 5;

/** Cada cuánto hay un poste, a lo largo de Z. */
const PASO_POSTES = 8;
const Z_POSTES = Object.freeze([4, 12, 20, 28, 36]);

/**
 * La cabina, al fondo y AL BORDE del camino, no en medio.
 *
 * Estuvo centrada y era un tapón: es sólida, mide un metro y el camino tiene
 * seis, así que plantada en el eje partía en dos el único paso de la escena. Lo
 * cazó la prueba que recorre el camino de punta a punta, no el ojo.
 */
const CABINA = Object.freeze({ x: 13.2, z: 40.5 });

/**
 * La duna: terrazas de un metro que suben muy poco cada una.
 *
 * Sube 6 cm por metro. Con el motor de movimiento sin altura de terreno, la
 * pendiente que se puede pisar es la que no se nota al pisarla: 6 cm es un
 * escalón que no se ve desde 1,45 m de altura de ojos, y a lo largo de los
 * catorce metros que se ven acumula casi un metro, que sí se lee como duna.
 */
const PASO_DUNA = 1;
const SUBIDA_DUNA = 0.06;
/** A partir de esta altura la duna deja de pisarse y pasa a ser obstáculo. */
const DUNA_INFRANQUEABLE = 0.3;
/** La duna sigue más allá del borde jugable: cortarla en seco delataría la caja. */
const DUNA_HASTA = -16;

/* ---- props propios de la playa -------------------------------------------- */

/**
 * El vocabulario de la PLAYA, aparte del de la nave.
 *
 * Se comparte la maquinaria de `nave-props.mjs` (partes, giro, ancla,
 * envolvente) y NO la lista: un poste de luz y un aerogenerador en el catálogo
 * de la nave harían largo justo el catálogo que ese módulo mantiene corto a
 * propósito. Son piezas que no pintan nada juntas.
 */
export const VOCABULARIO_PLAYA = definirVocabulario({
  /**
   * Poste de luz: mástil, dos travesaños y la luminaria colgada.
   *
   * El travesaño superior es el que lleva los cables y por eso está donde está;
   * la luminaria cuelga hacia el camino (+z al declararla, se gira al colocarla).
   */
  poste: {
    color: PLAYA.poste,
    partes: [
      { medidas: [0.22, 5.4, 0.22], centro: [0, 2.7, 0] },
      { medidas: [1.5, 0.1, 0.1], centro: [0, 5.1, 0] },
      { medidas: [1.1, 0.09, 0.09], centro: [0, 4.6, 0] },
      { medidas: [0.12, 0.5, 0.12], centro: [0, 4.15, 0.55] },
      { medidas: [0.4, 0.16, 0.4], centro: [0, 3.85, 0.55] },
    ],
    ancla: null,
  },

  /**
   * Cabina de teléfono: cuatro montantes, techo, base y tres cristales.
   *
   * Los cristales son parte con COLOR PROPIO, no una cabina de un solo tono: sin
   * ellos la cabina es un armario rojo. El motor no dibuja transparencias, así
   * que el vidrio se resuelve como lo resolvía la época — un color frío que se
   * lee como reflejo del cielo.
   *
   * La puerta mira a +z; el ancla se planta delante, mirándola.
   */
  cabina: {
    color: PLAYA.cabina,
    partes: [
      { medidas: [1.0, 0.12, 1.0], centro: [0, 0.06, 0] },
      { medidas: [0.12, 2.3, 0.12], centro: [-0.44, 1.2, -0.44] },
      { medidas: [0.12, 2.3, 0.12], centro: [0.44, 1.2, -0.44] },
      { medidas: [0.12, 2.3, 0.12], centro: [-0.44, 1.2, 0.44] },
      { medidas: [0.12, 2.3, 0.12], centro: [0.44, 1.2, 0.44] },
      { medidas: [1.1, 0.22, 1.1], centro: [0, 2.44, 0] },
      { medidas: [1.05, 0.1, 1.05], centro: [0, 2.62, 0], color: PLAYA.cabinaTecho },
      { medidas: [0.8, 1.7, 0.06], centro: [0, 1.35, -0.46], color: PLAYA.cristal },
      { medidas: [0.06, 1.7, 0.8], centro: [-0.46, 1.35, 0], color: PLAYA.cristal },
      { medidas: [0.06, 1.7, 0.8], centro: [0.46, 1.35, 0], color: PLAYA.cristal },
    ],
    ancla: { centro: [0, 1.3], orientacion: Math.PI },
  },

  /**
   * Aerogenerador: torre, góndola y aspas en cruz.
   *
   * EN CRUZ Y NO EN TRES ASPAS, que es como son de verdad. El motor compone
   * cajas alineadas con los ejes y no sabe girar una pieza 120°: unas aspas «a
   * 120°» saldrían como sus cajas envolventes, o sea, tres bloques gordos. Una
   * cruz de cuatro aspas finas es geometría honesta, se lee inequívocamente como
   * aerogenerador a la distancia a la que está, y no finge una precisión que el
   * motor no tiene. La alternativa correcta —rotación libre— es #573/#556, no
   * esto.
   */
  aerogenerador: {
    color: PLAYA.torre,
    partes: [
      { medidas: [3.2, 44, 3.2], centro: [0, 22, 0] },
      { medidas: [3.0, 3.2, 6.0], centro: [0, 44.5, 0] },
      { medidas: [1.4, 34, 0.6], centro: [0, 44.5, -3.2], color: PLAYA.aspa },
      { medidas: [34, 1.4, 0.6], centro: [0, 44.5, -3.2], color: PLAYA.aspa },
    ],
    ancla: null,
  },
});

/** Dónde están los aerogeneradores, mar adentro. Lejos y a distintas
 *  distancias: puestos en fila se leerían como una valla, no como un parque. */
const AEROGENERADORES = Object.freeze([
  { x: 78, z: 2 },
  { x: 104, z: 26 },
  { x: 138, z: 12 },
  { x: 166, z: 40 },
]);

/* ---- el terreno ----------------------------------------------------------- */

/**
 * Una franja de suelo: una losa fina cuya CARA SUPERIOR queda a `alto`.
 *
 * Losa y no plano porque el motor descarta las caras de espaldas, y un plano sin
 * grosor desaparece en cuanto se mira desde el otro lado — la orilla se ve desde
 * los dos.
 */
function franja({ desde, hasta, z0, z1, alto, color }) {
  const GRUESO = 0.4;
  return {
    malla: caja(
      [(desde + hasta) / 2, alto - GRUESO / 2, (z0 + z1) / 2],
      [hasta - desde, GRUESO, z1 - z0],
    ),
    color,
  };
}

/** Las terrazas de la duna, de dentro hacia fuera, con su canto en sombra. */
function terrazasDuna() {
  const piezas = [];
  let alto = 0;
  for (let x = CAMINO_DESDE; x > DUNA_HASTA; x -= PASO_DUNA) {
    alto += SUBIDA_DUNA;
    piezas.push(
      franja({ desde: x - PASO_DUNA, hasta: x, z0: -8, z1: PROFUNDIDAD + 8, alto, color: PLAYA.duna }),
      // El canto: sin él, dos terrazas del mismo color son un plano. Va justo en
      // el escalón, mirando al mar, que es de donde viene la luz.
      {
        malla: caja([x, alto - SUBIDA_DUNA / 2, (PROFUNDIDAD - 0) / 2 - 4], [0.05, SUBIDA_DUNA, PROFUNDIDAD + 16]),
        color: PLAYA.dunaSombra,
      },
    );
  }
  return piezas;
}

/** Los obstáculos de la planta: el agua, la duna alta y lo que ocupa un prop. */
function obstaculosDeTerreno() {
  const obstaculos = [
    // El mar. No se nada en esta escena (#587 lo deja fuera a propósito).
    { x: ORILLA, z: -1, ancho: ANCHO - ORILLA + 1, profundidad: PROFUNDIDAD + 2 },
  ];
  // Donde la duna pasa de la altura que se puede pisar sin notarlo, se bloquea.
  const metrosPisables = Math.floor(DUNA_INFRANQUEABLE / SUBIDA_DUNA) * PASO_DUNA;
  const bordePisable = Math.max(CAMINO_DESDE - metrosPisables, 0);
  if (bordePisable > 0) {
    obstaculos.push({ x: -1, z: -1, ancho: bordePisable + 1, profundidad: PROFUNDIDAD + 2 });
  }
  return obstaculos;
}

/* ---- la escena ------------------------------------------------------------ */

/** Todo lo que se planta sobre la arena, ya colocado. */
function propsColocados() {
  const puestos = [];

  for (const [indice, z] of Z_POSTES.entries()) {
    // Girados media vuelta: la luminaria cuelga hacia el camino, que está a la
    // derecha (+x) de los postes... y el prop la declara hacia +z, así que un
    // cuarto de vuelta la lleva a +x.
    puestos.push(
      colocarProp("poste", {
        x: X_POSTES,
        z,
        cuartos: 1,
        nombre: `poste-${indice}`,
        vocabulario: VOCABULARIO_PLAYA,
      }),
    );
  }

  puestos.push(
    colocarProp("cabina", {
      x: CABINA.x,
      z: CABINA.z,
      cuartos: 2, // la puerta mira hacia quien llega andando por el camino
      nombre: "cabina",
      vocabulario: VOCABULARIO_PLAYA,
    }),
  );

  for (const [indice, sitio] of AEROGENERADORES.entries()) {
    puestos.push(
      colocarProp("aerogenerador", {
        ...sitio,
        nombre: `aerogenerador-${indice}`,
        vocabulario: VOCABULARIO_PLAYA,
      }),
    );
  }

  return puestos;
}

/**
 * Los cables entre postes: dos tramos por vano, el segundo más bajo que el
 * primero.
 *
 * Es la catenaria que sabe dibujar un motor de cajas: no se puede curvar una
 * caja, pero dos tramos escalonados ya no leen como una barra recta, que es lo
 * que hace que un cable parezca un cable.
 */
const ALTURA_CABLE = 5.1;
const DESCUELGUE = 0.35;

function cables() {
  const piezas = [];
  for (let i = 0; i < Z_POSTES.length - 1; i += 1) {
    const z0 = Z_POSTES[i];
    const medio = z0 + PASO_POSTES / 2;
    // Dos cables por vano, uno a cada lado del travesaño.
    for (const dx of [-0.5, 0.5]) {
      piezas.push(
        {
          malla: caja(
            [X_POSTES + dx, ALTURA_CABLE - DESCUELGUE / 2, (z0 + medio) / 2],
            [0.05, 0.05, PASO_POSTES / 2],
          ),
          color: PLAYA.cable,
        },
        {
          malla: caja(
            [X_POSTES + dx, ALTURA_CABLE - DESCUELGUE, (medio + z0 + PASO_POSTES) / 2],
            [0.05, 0.05, PASO_POSTES / 2],
          ),
          color: PLAYA.cable,
        },
      );
    }
  }
  return piezas;
}

/** Hasta dónde dibuja esta escena. Los aerogeneradores están a 170 m y el mar
 *  llega al horizonte: con los 80 de serie no habría ni mar ni parque eólico. */
const ALCANCE = 420;

/** El mar sigue mucho más allá del borde jugable, o se vería su canto. */
const MAR_HASTA = 380;

const PROPS = propsColocados();

const PIEZAS = Object.freeze([
  // De lejos a cerca, que es como se lee la escena y como conviene escribirla.
  franja({ desde: 60, hasta: MAR_HASTA, z0: -MAR_HASTA, z1: MAR_HASTA, alto: -0.1, color: PLAYA.marLejos }),
  franja({ desde: ORILLA, hasta: 60, z0: -MAR_HASTA, z1: MAR_HASTA, alto: -0.1, color: PLAYA.mar }),
  // La lengua de espuma, justo en la orilla y un pelo por encima del agua.
  franja({ desde: ORILLA - 0.5, hasta: ORILLA + 0.4, z0: -8, z1: PROFUNDIDAD + 8, alto: -0.02, color: PLAYA.espuma }),
  franja({ desde: LISO_DESDE, hasta: ORILLA, z0: -8, z1: PROFUNDIDAD + 8, alto: 0, color: PLAYA.arenaMojada }),
  franja({ desde: CAMINO_DESDE, hasta: LISO_DESDE, z0: -8, z1: PROFUNDIDAD + 8, alto: 0.02, color: PLAYA.arena }),
  ...terrazasDuna(),
  ...cables(),
  ...PROPS.flatMap(({ piezas }) => piezas).map(({ centro, medidas, color }) => ({
    malla: caja(centro, medidas),
    color,
  })),
]);

/**
 * Los puntos de interacción de la playa (#582).
 *
 * Solo uno: la cabina. Descolgar devuelve a la nave, que además resuelve que la
 * escena no sea un callejón sin salida — un exterior al que se entra por
 * herramienta y del que no se sale sin cerrar la ventana sería un banco de
 * pruebas incómodo de usar.
 *
 * El ancla la declara el PROP y no esta escena: es exactamente el mecanismo que
 * #579 necesita para su punto de pesca, probado aquí primero.
 */
const CABINA_COLOCADA = PROPS.find(({ ancla }) => ancla !== null);

export const INTERACCIONES = declararInteracciones([
  {
    id: "cabina-telefono",
    punto: CABINA_COLOCADA.ancla.punto,
    orientacion: CABINA_COLOCADA.ancla.orientacion,
    accion: { tipo: "estancia", estancia: "cantina" },
  },
]);

/** La huella en planta de un prop colocado, para que no se pueda atravesar. */
function huellaDe(piezas) {
  return piezas
    // Lo que está por encima de la cabeza no estorba al andar: las aspas de un
    // aerogenerador a 44 m de altura no son un muro.
    .filter(({ centro, medidas }) => centro[1] - medidas[1] / 2 < 2)
    .map(({ centro, medidas }) => ({
      x: centro[0] - medidas[0] / 2,
      z: centro[2] - medidas[2] / 2,
      ancho: medidas[0],
      profundidad: medidas[2],
    }));
}

export const PLANTA_PLAYA = crearPlanta({
  ancho: ANCHO,
  profundidad: PROFUNDIDAD,
  obstaculos: [
    ...obstaculosDeTerreno(),
    // Los aerogeneradores están mar adentro, fuera de la planta: su huella no
    // llega. Se filtran para no meter obstáculos con coordenadas de otro mundo.
    ...PROPS.flatMap(({ piezas }) => huellaDe(piezas)).filter((rect) => rect.x < ANCHO),
  ],
});

/** Dónde se aparece: en el camino, a la altura de la cabina pero lejos de ella,
 *  mirando hacia el fondo — así lo primero que se ve es la cabina al final del
 *  camino, con el mar a la derecha. */
export const ENTRADA = Object.freeze({ x: 11.5, z: 6, yaw: 0 });

/**
 * Compone la playa vista desde `(x, z)` mirando a `yaw`.
 *
 * Misma firma que la `componer` de `crearSalaCaja` —es lo que el bucle de andar
 * espera— pero sin nada de lo que una sala da por hecho: ni hojas de puerta, ni
 * ventanas, ni campo estelar. A cambio, dos cosas que ninguna sala usa: alcance
 * de dibujo largo y niebla hacia el color del cielo, que es lo que cierra el
 * horizonte en vez de dejar el mar cortado en seco.
 */
export function componerPlaya(x, y, z, yaw, opciones = {}) {
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
        lejos: ALCANCE,
        // Sin esto no hay niebla, y sin niebla el mar termina en una raya recta
        // a 380 m: el horizonte lo hace el fundido, no la geometría.
        fondo: PLAYA.cielo,
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
  return { ancho: anchoLienzo, alto: altoLienzo, epoca: partes[0]?.epoca, poligonos, estrellas: [] };
}
