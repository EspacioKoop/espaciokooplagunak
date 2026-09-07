// El catálogo de estancias que usa la ventana de andar (#427), DERIVADO de la
// planta real del Phobos M3P (#540) más la cantina como sala añadida.
//
// Antes cosía a mano una geografía inventada —vestíbulo, pasillo del puente y
// cinco salas de estación idénticas— mientras la nave ya declaraba su interior
// en `scripts/shiptemplates/frigates.lua`. Aquello producía los cuatro fallos
// de #539: huecos entre salas, puertas contra las que te golpeabas, ninguna
// estancia alcanzable salvo la cantina y una escala distinta por sala. Nada de
// eso puede volver a pasar por construcción:
//
//   - la rejilla es CONTIGUA, así que dos salas vecinas comparten muro y no
//     queda vacío entre ellas;
//   - hay puerta entre TODA pareja contigua, calculada del solapamiento real de
//     sus aristas, así que ninguna puerta cae donde no se puede llegar;
//   - todas las salas miden múltiplos de la MISMA celda (`CELDA`).
//
// Este archivo sigue teniendo una sola responsabilidad —coser qué puerta lleva
// a dónde— y ya no declara ni una medida: las saca de `nave-planta-phobos.mjs`.
//
// Puro: compone objetos y funciones que ya son puras.

import { crearCatalogoEstancias } from "./nave-estancias.mjs";
import { declararInteracciones } from "./nave-interaccion.mjs";
import { SECCION } from "./paleta.mjs";
import { puntoLibreCerca } from "./nave-movimiento.mjs";
import { crearSalaCaja } from "./nave-sala-caja.mjs";
import { piezasConsola } from "./nave-consola.mjs";
import { piezasMobiliarioSala } from "./nave-mobiliario-sala.mjs";
import { PLANTA_CANTINA_SALA, PUERTA_SALIDA, PUERTA_TERRAZA, componerCantinaSala } from "./cantina-sala.mjs";
import {
  ENTRADA as ENTRADA_TERRAZA,
  INTERACCIONES as INTERACCIONES_TERRAZA,
  PUERTA_CANTINA,
  PLANTA_TERRAZA,
  componerTerraza,
  componerTerrazaCon,
  plantaTerraza,
  asientosColocados,
  ASIENTOS as ASIENTOS_TERRAZA,
} from "./terraza-cantina.mjs";
import {
  ENTRADA as ENTRADA_PLAYA,
  INTERACCIONES as INTERACCIONES_PLAYA,
  PLANTA_PLAYA,
  componerPlaya,
} from "./playa-escena.mjs";
import {
  ENTRADA as ENTRADA_MUSEO,
  INTERACCIONES as INTERACCIONES_MUSEO,
  PLANTA_MUSEO,
  componerMuseo,
} from "./museo-escena.mjs";
import { MUSEO, PLAYA } from "./paleta.mjs";
import {
  ANCHO_PUERTA,
  GROSOR_PUERTA,
  SALAS_PHOBOS,
  conexiones,
  llegada,
  medidasSala,
  rectPuerta,
} from "./nave-planta-phobos.mjs";

/**
 * Qué puesto abre la consola de cada sala con sistema (#509).
 *
 * Sale del sistema que la sala ALOJA, no de un reparto inventado: es la mejora
 * que trajo #540 frente a las cinco salas de puente idénticas de antes —
 * acercarse a la consola del reactor abre ingeniería porque ahí está el reactor.
 *
 * Los escudos van a `weapons` porque `set_shields` es una orden de armas en la
 * matriz de autoridad, no de ingeniería. No da mandos nuevos: es un atajo a la
 * consola que ese tripulante ya podía abrir por botón (#237).
 */
const PUESTO_POR_SISTEMA = Object.freeze({
  Reactor: "engineering",
  BeamWeapons: "weapons",
  MissileSystem: "weapons",
  FrontShield: "weapons",
  RearShield: "weapons",
  Maneuver: "navigation",
  Impulse: "navigation",
  Warp: "navigation",
  JumpDrive: "navigation",
});

/**
 * Consolas en salas SIN sistema.
 *
 * Sensores y comunicaciones no son sistemas con sala en EmptyEpsilon, así que la
 * planta real no les da sitio. Se les asigna una pasarela para que sus
 * tripulantes puedan llegar andando a su consola como los demás; es la parte
 * inventada de esto y por eso está aquí, aislada y con su nombre, en vez de
 * disimulada dentro de la tabla de sistemas. Revisable sin tocar nada más.
 *
 * Enlace, mando y control de daños se quedan sin consola andando a propósito:
 * no tienen un sitio en la nave que justifique estar ahí de pie. Siguen
 * abriéndose por botón, que es como se abren hoy.
 */
const PUESTO_POR_SALA_LIBRE = Object.freeze({
  "pasarela-proa": "sensors",
  "pasarela-popa": "communications",
});

/**
 * Zona de la consola: un cuadrado donde ponerse de pie, apartado del centro para
 * que acercarse sea un gesto y no un accidente al cruzar la sala.
 *
 * Se elige el CUARTO DE SALA MÁS LEJOS DE LAS PUERTAS, no siempre el mismo
 * (#557). Mientras la consola era un rectángulo invisible daba igual dónde
 * cayera; en cuanto pasó a ser un mueble sólido dejó de darlo: en `armas-haz`
 * aterrizaba justo en el punto donde se aparece al cruzar desde `pasarela-proa`,
 * y quien llegaba se materializaba dentro de la mesa. Lo cazó
 * `nave-planta-phobos.test.mjs`, que ya comprobaba justo eso.
 *
 * Se mide contra las PUERTAS y no contra los puntos de llegada porque los de
 * esta sala los declaran las salas vecinas y aquí no se conocen — pero una
 * llegada siempre cae cerca de su puerta, así que apartarse de las puertas basta
 * y no acopla `definirSala` con el resto del catálogo.
 */
function zonaConsola(sala, puertas = []) {
  const { ancho, profundidad } = medidasSala(sala);
  const lado = 1.6;
  const margen = GROSOR_PUERTA + 0.4;
  const centrosPuerta = puertas.map(({ rect }) => ({
    x: rect.x + rect.ancho / 2,
    z: rect.z + rect.profundidad / 2,
  }));
  const candidatas = [0.72, 0.28].flatMap((fx) =>
    [0.72, 0.28].map((fz) => ({
      x: Math.min(Math.max(ancho * fx - lado / 2, margen), Math.max(margen, ancho - lado - margen)),
      z: Math.min(Math.max(profundidad * fz - lado / 2, margen), Math.max(margen, profundidad - lado - margen)),
      ancho: lado,
      profundidad: lado,
    })),
  );
  // La primera candidata (72%/72%) sigue siendo la preferida: el `reduce` solo
  // la sustituye por una ESTRICTAMENTE mejor, así que una sala sin puertas —o
  // con todas igual de lejos— conserva la colocación de siempre.
  const holgura = (zona) => {
    if (centrosPuerta.length === 0) return Infinity;
    const cx = zona.x + zona.ancho / 2;
    const cz = zona.z + zona.profundidad / 2;
    return Math.min(...centrosPuerta.map((p) => Math.hypot(cx - p.x, cz - p.z)));
  };
  return candidatas.reduce((mejor, actual) => (holgura(actual) > holgura(mejor) ? actual : mejor));
}

function puestoDe(sala) {
  return sala.sistema ? PUESTO_POR_SISTEMA[sala.sistema] : PUESTO_POR_SALA_LIBRE[sala.id];
}

/** Radio del jugador, el mismo que usa `nave-movimiento-lienzo.mjs`. */
const RADIO_JUGADOR = 0.35;

/** Un punto de la cantina garantizado libre de mobiliario. */
function libreEnCantina(x, z) {
  return puntoLibreCerca(x, z, RADIO_JUGADOR, PLANTA_CANTINA_SALA);
}

/** La cantina cuelga del muro libre de esta sala. */
const SALA_DE_LA_CANTINA = "acceso-cantina";

/**
 * Puerta a la cantina: en el muro norte de `acceso-cantina`, que es el único de
 * esa sala sin vecino en la rejilla. Si algún día la planta cambia y ese muro
 * pasa a tener vecino, la prueba de solapes lo cazará en vez de dejar dos
 * puertas pisándose.
 */
function puertaCantina(sala) {
  const { ancho } = medidasSala(sala);
  return {
    x: Math.max(ancho / 2 - ANCHO_PUERTA / 2, 0),
    z: 0,
    ancho: ANCHO_PUERTA,
    profundidad: GROSOR_PUERTA,
  };
}

/**
 * Ventanas al espacio en los muros que dan AL EXTERIOR (#508, generalizado en
 * #540).
 *
 * La sala de ingeniería inventada tenía una ventana escrita a mano, y era lo
 * mejor que tenía: con cielo real detrás, la sala deja de ser una caja. Al
 * derivar la planta de la rejilla eso se puede decidir en vez de escribir — un
 * muro sin vecino es casco, y el casco puede tener ventana.
 *
 * El vestíbulo no tenía ventana a propósito («es tránsito»); esa distinción se
 * pierde aquí, y a cambio se gana que ninguna sala del casco se quede ciega sin
 * que nadie lo haya decidido. Si alguna debe ir a oscuras, se excluye por id.
 */
const ANCHO_VENTANA = 4;

function ventanasAlExterior(sala, salientes) {
  const { ancho, profundidad } = medidasSala(sala);
  const ocupados = new Set(salientes.map((conexion) => conexion.contacto.lado));
  // El muro por el que se sale a la cantina tampoco lleva ventana: ya tiene
  // hueco de puerta, y dos huecos en el mismo muro se pisarían.
  if (sala.id === SALA_DE_LA_CANTINA) ocupados.add("norte");

  const ventanas = [];
  const centrado = (largo) => Math.max(largo / 2 - ANCHO_VENTANA / 2, 0);
  if (!ocupados.has("norte")) {
    ventanas.push({ rect: { x: centrado(ancho), z: 0, ancho: ANCHO_VENTANA, profundidad: GROSOR_PUERTA } });
  }
  if (!ocupados.has("sur")) {
    ventanas.push({
      rect: { x: centrado(ancho), z: profundidad - GROSOR_PUERTA, ancho: ANCHO_VENTANA, profundidad: GROSOR_PUERTA },
    });
  }
  if (!ocupados.has("oeste")) {
    ventanas.push({ rect: { x: 0, z: centrado(profundidad), ancho: GROSOR_PUERTA, profundidad: ANCHO_VENTANA } });
  }
  if (!ocupados.has("este")) {
    ventanas.push({
      rect: { x: ancho - GROSOR_PUERTA, z: centrado(profundidad), ancho: GROSOR_PUERTA, profundidad: ANCHO_VENTANA },
    });
  }
  return ventanas;
}

/** Agrupa las conexiones por sala de origen. */
function conexionesPorSala() {
  const mapa = new Map(SALAS_PHOBOS.map((sala) => [sala.id, []]));
  for (const conexion of conexiones()) {
    mapa.get(conexion.de.id).push(conexion);
  }
  return mapa;
}

function definirSala(sala, salientes) {
  const { ancho, profundidad } = medidasSala(sala);
  const puertas = salientes.map((conexion) => ({
    rect: rectPuerta(sala, conexion.contacto),
    destino: { estancia: conexion.a.id, ...llegada(conexion.a, conexion.contacto) },
  }));

  if (sala.id === SALA_DE_LA_CANTINA) {
    puertas.push({
      rect: puertaCantina(sala),
      // Se llega a la cantina por su puerta oeste, así que se aparece dentro y
      // separado de ella para no reactivarla de vuelta.
      destino: {
        estancia: "cantina",
        // Delante de la puerta y mirando hacia DENTRO de la cantina (yaw 0 mira
        // a +z, así que hacia el interior desde el muro sur es π).
        ...libreEnCantina(PUERTA_SALIDA.x + PUERTA_SALIDA.ancho / 2, PUERTA_SALIDA.z - 1.6),
        yaw: Math.PI,
      },
    });
  }

  // La consola se declara ANTES de la sala porque es mobiliario suyo: hasta #557
  // el rect existía solo como disparador y no se dibujaba nada encima.
  const puestoDeLaSala = puestoDe(sala);
  const rectConsola = zonaConsola(sala, puertas);
  const caja = crearSalaCaja({
    ancho,
    profundidad,
    mobiliario: [
      ...(puestoDeLaSala ? piezasConsola({ zona: rectConsola, sala: { ancho, profundidad } }) : []),
      // La maquinaria de la sala (#560): sale de su SISTEMA, no se inventa.
      ...piezasMobiliarioSala({
        sala: { ancho, profundidad },
        sistema: sala.sistema ?? null,
        puertas,
        consola: puestoDeLaSala ? rectConsola : null,
        // Semilla por celda, como el cielo de sus ventanas: la misma sala se
        // amuebla igual siempre, y dos salas distintas no salen calcadas.
        semilla: 20260810 + sala.celda.x * 131 + sala.celda.y * 17,
        receta: sala.id === "camarotes" ? ["registro", "litera", "taquilla"] : undefined,
      }),
    ],
    puertas: puertas.map(({ rect }) => ({ rect })),
    ventanas: ventanasAlExterior(sala, salientes),
    // Mismo motivo que en la cantina: el marco de serie es `SECCION.entrable`,
    // un turquesa de señalización de la sección que sobre un muro entero se lee
    // como un error de pintado (QA: «lo del color es muy feo»).
    colorMarcoVentana: SECCION.mamparo,
    // Semilla por sala: cada ventana da a un trozo de cielo distinto, y el
    // mismo siempre. Sin esto todas las salas mirarían a las mismas estrellas.
    semillaCielo: 20260808 + sala.celda.x * 31 + sala.celda.y * 7,
    // La luminaria parpadea por SU sistema (#765), no por uno inventado: la
    // misma cadena que ya declara `SALAS_PHOBOS` para el puesto y el mobiliario.
    sistema: sala.sistema ?? null,
  });

  return {
    planta: caja.planta,
    componer: caja.componer,
    // Sin puerta de entrada preferente: se aparece en el centro solo en la
    // primera apertura, porque cualquier llegada real trae su `x`/`z`.
    entrada: { x: ancho / 2, z: profundidad / 2, yaw: 0 },
    puertas,
    // La consola es un punto de interacción como cualquier otro desde #582: su
    // zona sigue siendo el mismo rectángulo de siempre —el disparador no cambia—
    // y lo que antes era el campo `puesto` viaja ahora dentro de `accion`, que
    // es lo único que el bucle de andar transporta sin interpretar.
    interacciones: puestoDeLaSala
      ? declararInteracciones([
          {
            id: `consola-${puestoDeLaSala}`,
            zona: rectConsola,
            accion: { tipo: "consola", puesto: puestoDeLaSala },
          },
        ])
      : [],
  };
}

const porSala = conexionesPorSala();

export const CATALOGO_ANDAR = crearCatalogoEstancias({
  ...Object.fromEntries(
    SALAS_PHOBOS.map((sala) => [sala.id, definirSala(sala, porSala.get(sala.id))]),
  ),
  // La cantina NO sale de la rejilla: el interior nativo no tiene cantina, y es
  // el único sitio donde inventar geografía está justificado (#540). Conserva su
  // planta y su arte hechos a mano (#423) — y su tamaño, que es la referencia
  // con la que se eligió `CELDA`.
  cantina: {
    planta: PLANTA_CANTINA_SALA,
    componer: componerCantinaSala,
    // DELANTE DE LA PUERTA, no en un rincón bonito (QA 2026-08-08: «no puedo
    // acceder a ninguna otra sala»). Los 126 muebles de la cantina parten su
    // suelo libre en zonas incomunicadas, y la entrada anterior caía en una que
    // no daba a la puerta: se podía andar, pero no salir. Naciendo junto a la
    // única salida, estar en su misma zona está garantizado por construcción, y
    // una prueba de inundación lo comprueba para todas las salas.
    entrada: { ...libreEnCantina(PUERTA_SALIDA.x + PUERTA_SALIDA.ancho / 2, PUERTA_SALIDA.z - 1.6), yaw: Math.PI },
    puertas: [
      {
        // El disparador lo declara la propia sala, junto al hueco que abre en su
        // muro: antes eran dos números en dos archivos y estaban desalineados
        // casi un metro — el «puerta extraña que no da a ninguna parte» del QA.
        rect: PUERTA_SALIDA,
        destino: { estancia: SALA_DE_LA_CANTINA, x: 11, z: 3, yaw: Math.PI },
      },
      {
        // Y la salida a la terraza (#579), por el muro oeste. Se sale mirando al
        // borde: lo primero que tiene que pasar al salir a una terraza es darse
        // cuenta de que estás fuera.
        rect: PUERTA_TERRAZA,
        destino: { estancia: "terraza", ...ENTRADA_TERRAZA },
      },
    ],
  },
  /**
   * La terraza de la cantina (#579).
   *
   * Es una estancia más del MISMO catálogo, no una escena aparte: la nave tiene
   * una sola geografía y la terraza es un sitio dentro de ella, al que se llega
   * andando desde la cantina y del que se vuelve por la misma puerta.
   */
  terraza: {
    planta: PLANTA_TERRAZA,
    componer: componerTerraza,
    // Sus cinco asientos se retiran al ocuparse (`nave-pose.mjs`). La estancia
    // declara CÓMO queda con otras poses; quién las cambia y cuándo es de la
    // ventana, que es la que sabe quién se acaba de sentar.
    conPoses: (poses) => ({
      planta: plantaTerraza(poses),
      componer: componerTerrazaCon(poses),
      // Dónde queda cada asiento ya en su pose: quien se sienta necesita el
      // sitio NUEVO, no el de la silla sin retirar.
      colocados: asientosColocados(poses),
    }),
    poseables: ASIENTOS_TERRAZA,
    entrada: ENTRADA_TERRAZA,
    interacciones: INTERACCIONES_TERRAZA,
    // Al aire libre y con la nave detrás: el fondo es el vacío, no el mamparo de
    // «más nave todavía sin renderizar».
    fondo: SECCION.vacio,
    puertas: [
      {
        rect: PUERTA_CANTINA,
        // De vuelta a la cantina, apareciendo dentro y separado de su puerta
        // para no reactivarla en el mismo paso. Mirando a la sala, no al muro.
        destino: {
          estancia: "cantina",
          ...libreEnCantina(PUERTA_TERRAZA.ancho + 1.2, PUERTA_TERRAZA.z + PUERTA_TERRAZA.profundidad / 2),
          yaw: Math.PI / 2,
        },
      },
    ],
  },
  // La playa de pruebas (#587). NO cuelga de ninguna puerta de la nave: no es un
  // sitio al que se llegue andando desde el Phobos, y colgarla de un mamparo
  // sería contar una historia que nadie ha decidido. Se entra por la herramienta
  // solo-GM de la barra de escena, y se vuelve por la cabina de teléfono — que
  // es su único punto de interacción y la prueba de que #582 sirve para algo más
  // que abrir consolas.
  playa: {
    planta: PLANTA_PLAYA,
    componer: componerPlaya,
    entrada: ENTRADA_PLAYA,
    interacciones: INTERACCIONES_PLAYA,
    // Un exterior no se limpia con gris de mamparo: detrás de la geometría hay
    // cielo, y sin esto el mar termina contra el color de «más nave todavía sin
    // renderizar».
    fondo: PLAYA.cielo,
    puertas: [],
  },
  // La sala del museo (#598). Como la playa: NO cuelga de ninguna puerta de la
  // nave —el Phobos no tiene un museo— y se entra por la herramienta solo-GM de
  // la barra de escena. Se vuelve por la salida, su punto de interacción.
  museo: {
    planta: PLANTA_MUSEO,
    componer: componerMuseo,
    entrada: ENTRADA_MUSEO,
    interacciones: INTERACCIONES_MUSEO,
    // Interior cerrado y sin ventanas: lo que asome por un hueco es más sala sin
    // pintar, no el vacío. Su propio gris, y no el de mamparo, para que el borde
    // de la sala no se lea como casco de nave.
    fondo: MUSEO.zocalo,
    puertas: [],
  },
});
