// Los niveles del campo de pruebas (#838).
//
// NO HAY CATÁLOGO PROPIO, y esa es la decisión de este archivo. El módulo ya
// declara `CATALOGO_ANDAR` en `nave-catalogo-andar.mjs` con la forma exacta que
// pide el bucle de andar —planta, componer, entrada, interacciones, fondo,
// puertas— y las dos escenas que interesan aquí, el museo y la playa, están ahí
// dentro con su geometría de verdad. Escribir aquí una segunda lista sería
// tener dos catálogos que se desincronizan, que es justo el fallo que
// `nave-planta-phobos.mjs` evita comparándose con su `.lua`.
//
// Lo que SÍ es de aquí: qué estancias del catálogo son NIVELES del campo, en
// qué orden van y cómo se llaman en pantalla. Un tercer nivel es una entrada
// más de esta lista, no una página nueva — la misma regla que la cantina aplica
// a sus mesas y la sección de la nave a sus salas.
//
// LAS TRECE SALAS DEL PHOBOS NO SON NIVELES a propósito. El campo de pruebas
// existe para mirar las dos escenas que se entran por herramienta y que no
// cuelgan de ningún mamparo (#587, #598): son las únicas que no se pueden
// visitar andando desde la nave, y por tanto las únicas que no tienen otro
// sitio donde mirarse. Meter aquí el reactor sería convertir esto en un visor
// de la nave, que es otra herramienta y no esta.

import { CATALOGO_ANDAR } from "../../foundry-module/scripts/nave-catalogo-andar.mjs";

/**
 * El orden importa: es el del campo de pruebas, de dentro a fuera. El museo
 * primero porque es un interior cerrado y pequeño —lo que hay que mirar cabe en
 * una pantalla— y la playa después porque es lo contrario, un exterior con
 * horizonte, niebla y cosas que el viento mueve. Pasar del uno a la otra es
 * pasar de comprobar una superficie a comprobar una distancia.
 */
export const NIVELES = Object.freeze([
  Object.freeze({
    id: "museo",
    nombre: { es: "Museo", en: "Museum" },
    // Qué se va a mirar aquí, y por qué está en el nivel y no en un comentario:
    // se lee en pantalla al entrar, y quien abre esto viene a comprobar algo.
    mira: {
      es: "Interior cerrado. El relieve de los cuadros y las cartelas de las piezas.",
      en: "Enclosed interior. The relief on the paintings and the pieces' labels.",
    },
  }),
  Object.freeze({
    id: "playa",
    nombre: { es: "Playa", en: "Beach" },
    mira: {
      es: "Exterior con horizonte. La niebla que lo cierra y lo que el viento mueve.",
      en: "Exterior with a horizon. The fog that closes it and what the wind moves.",
    },
  }),
  Object.freeze({
    id: "pasillo-recuerdos",
    nombre: { es: "Pasillo de los recuerdos", en: "Corridor of memories" },
    mira: {
      es: "Un pasillo muy largo. Que la niebla se coma el fondo antes de que tú"
        + " te canses de andar.",
      en: "A very long corridor. That the fog swallows the far end before you"
        + " get tired of walking.",
    },
  }),
]);

/**
 * La estancia de un nivel, tal cual la declara el módulo.
 *
 * Revienta si el catálogo no la tiene, en vez de devolver nulo: un nivel que
 * apunta a una estancia inexistente es un error de esta lista y tiene que verse
 * al arrancar, no a mitad de una visita. Misma regla que el catálogo de
 * asistencia y que la `estancia` de la sección de la nave.
 */
export function estanciaDe(id) {
  const estancia = CATALOGO_ANDAR.obtener(id);
  if (!estancia) {
    throw new Error(
      `El nivel «${id}» no existe en CATALOGO_ANDAR. Hay: ${CATALOGO_ANDAR.ids.join(", ")}`,
    );
  }
  return estancia;
}

/** El nivel que sigue, dando la vuelta. Es a donde lleva la salida de cada uno. */
export function siguienteNivel(id) {
  const i = NIVELES.findIndex((nivel) => nivel.id === id);
  return NIVELES[(i + 1) % NIVELES.length];
}

/** Un nivel por su id, o el primero si no se pide ninguno o el pedido no está.
 *  Cae al primero en vez de dejar la pantalla en negro — mismo criterio que
 *  `resolverArranque`: mejor arrancar en un sitio declarado que en ninguno. */
export function nivelDe(id) {
  return NIVELES.find((nivel) => nivel.id === id) ?? NIVELES[0];
}
