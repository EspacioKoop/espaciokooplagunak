// El catálogo de estancias que usa la ventana de andar (#427), DERIVADO de la
// planta real del Phobos M3P (#540) más la cantina como sala añadida.
//
// Antes cosía a mano una geografía inventada —vestíbulo, pasillo del puente y
// cinco salas de estación idénticas— mientras la nave ya declaraba su interior
// en `scripts/shipTemplates/frigates.lua`. Aquello producía los cuatro fallos
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
import { SECCION } from "./paleta.mjs";
import { puntoLibreCerca } from "./nave-movimiento.mjs";
import { crearSalaCaja } from "./nave-sala-caja.mjs";
import { PLANTA_CANTINA_SALA, PUERTA_OESTE, componerCantinaSala } from "./cantina-sala.mjs";
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
 * Zona de la consola: un cuadrado donde ponerse de pie, apartado del centro
 * para que acercarse sea un gesto y no un accidente al cruzar la sala.
 */
function zonaConsola(sala) {
  const { ancho, profundidad } = medidasSala(sala);
  const lado = 1.6;
  return {
    x: Math.max(ancho * 0.72 - lado / 2, GROSOR_PUERTA + 0.4),
    z: Math.max(profundidad * 0.72 - lado / 2, GROSOR_PUERTA + 0.4),
    ancho: lado,
    profundidad: lado,
  };
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
        ...libreEnCantina(PUERTA_OESTE.x + PUERTA_OESTE.ancho + 0.6, PUERTA_OESTE.z + PUERTA_OESTE.profundidad / 2),
        yaw: Math.PI / 2,
      },
    });
  }

  const caja = crearSalaCaja({
    ancho,
    profundidad,
    puertas: puertas.map(({ rect }) => ({ rect })),
    ventanas: ventanasAlExterior(sala, salientes),
    // Mismo motivo que en la cantina: el marco de serie es `SECCION.entrable`,
    // un turquesa de señalización de la sección que sobre un muro entero se lee
    // como un error de pintado (QA: «lo del color es muy feo»).
    colorMarcoVentana: SECCION.mamparo,
    // Semilla por sala: cada ventana da a un trozo de cielo distinto, y el
    // mismo siempre. Sin esto todas las salas mirarían a las mismas estrellas.
    semillaCielo: 20260808 + sala.celda.x * 31 + sala.celda.y * 7,
  });

  const puesto = puestoDe(sala);
  return {
    planta: caja.planta,
    componer: caja.componer,
    // Sin puerta de entrada preferente: se aparece en el centro solo en la
    // primera apertura, porque cualquier llegada real trae su `x`/`z`.
    entrada: { x: ancho / 2, z: profundidad / 2, yaw: 0 },
    puertas,
    consolas: puesto ? [{ rect: zonaConsola(sala), puesto }] : [],
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
    entrada: { ...libreEnCantina(PUERTA_OESTE.x + PUERTA_OESTE.ancho + 0.6, PUERTA_OESTE.z + PUERTA_OESTE.profundidad / 2), yaw: Math.PI / 2 },
    puertas: [
      {
        // El disparador lo declara la propia sala, junto al hueco que abre en su
        // muro: antes eran dos números en dos archivos y estaban desalineados
        // casi un metro — el «puerta extraña que no da a ninguna parte» del QA.
        rect: PUERTA_OESTE,
        destino: { estancia: SALA_DE_LA_CANTINA, x: 11, z: 3, yaw: Math.PI },
      },
    ],
  },
});
