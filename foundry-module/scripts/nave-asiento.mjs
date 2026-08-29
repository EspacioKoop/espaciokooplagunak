// Sentarse en un mueble de la nave.
//
// QUÉ ES Y POR QUÉ AQUÍ. La primera mecánica de las escenas andables que cambia
// dónde estás en vez de abrir una ventana. Hasta ahora TODOS los puntos de
// interacción (#582) hacían una de tres cosas: abrir la consola de un puesto
// (#509), pintar una cartela (#598) o llevarte a otra estancia (#587). Ninguna
// toca la escena: se acerca uno, aparece algo y la sala sigue exactamente igual.
// Por eso la terraza tiene sillas desde #579 y ni la mesa ni el taburete hacen
// nada — hay dónde sentarse y no se puede.
//
// Es lógica PURA y vive fuera del bucle por el mismo motivo que `nave-camara.mjs`:
// dónde acaban los ojos de quien se sienta es la misma regla para las catorce
// estancias, y así se prueba en Node sin lienzo.
//
// LA ALTURA SALE DEL MUEBLE, NO DE LA ESCENA. Un asiento declara a qué altura
// está su cara de arriba (`nave-props.mjs`) y de ahí sale todo lo demás. Escribir
// la altura de los ojos en la escena es exactamente el fallo que la cantina pagó
// tres veces —cámara en altura absoluta sobre un suelo que no estaba en cero, y
// los ojos a 3,35 m—, y aquí sería peor, porque una silla y un taburete se
// diferencian en once centímetros que nadie va a recordar.
//
// Y SE DEVUELVE UN OFFSET, NO UNA ALTURA. El bucle de andar maneja `y` como lo
// que se sube o se baja sobre la altura de ojos de pie (#446: salto y agachado),
// y sentarse es una postura más de esa familia. Devolver una altura absoluta
// obligaría al bucle a distinguir dos clases de `y`, que es como se cuelan los
// errores de signo.
//
// LO QUE NO HACE. No concede nada, no cuenta nada y no lo recuerda nadie: al
// cerrar la ventana te levantas, y la silla no sabe que estuviste ahí (regla de
// `docs/FOUNDRY.md`). Tampoco mueve la silla — un mueble que se retira al
// sentarte es una POSE, es otra mecánica y es la que necesita el libro de #853.
//
// Puro: ni Foundry, ni DOM, ni red.

import { ALTURA_OJOS } from "./nave-camara.mjs";

/**
 * A qué altura quedan los ojos sobre la cara del asiento, en metros.
 *
 * 0,72 m es un torso sentado de persona de pie 1,45 (`ALTURA_OJOS`): la
 * proporción normal es que sentarse baje del orden de medio metro los ojos, y
 * con una silla de 0,48 sale justo eso. No es un número de arte: si `ALTURA_OJOS`
 * cambia algún día, esto NO cambia — el torso mide lo que mide, y lo que se
 * acorta al sentarse son las piernas.
 */
export const OJOS_SOBRE_ASIENTO = 0.72;

/**
 * Cuánto sube o baja la cámara al sentarse en un asiento de esa altura.
 *
 * Negativo en cualquier mueble razonable, y esa es la comprobación de cordura:
 * sentarse BAJA. Un asiento tan alto que subiera los ojos por encima de estar de
 * pie es un taburete de bar de dos metros, o una errata.
 */
export function offsetSentado(alturaAsiento) {
  if (!Number.isFinite(alturaAsiento) || alturaAsiento < 0) {
    throw new RangeError("offsetSentado: la altura del asiento tiene que ser un número >= 0");
  }
  return alturaAsiento + OJOS_SOBRE_ASIENTO - ALTURA_OJOS;
}

/**
 * Dónde acaba quien se sienta: encima del asiento y mirando a donde el mueble
 * diga.
 *
 * @param {{punto:number[], orientacion:number|null, altura:number}} asiento
 *   tal y como lo devuelve `colocarProp`, ya en coordenadas de la sala.
 * @param {{yaw:number}} quien su orientación actual.
 * @returns {{x:number, z:number, yaw:number, y:number}}
 *
 * `orientacion: null` CONSERVA el rumbo de quien se sienta, y es lo que
 * distingue un taburete de una silla: un taburete no tiene frente, así que
 * girarte al sentarte sería inventarle uno. Es el mismo dato que ya distingue
 * un prop con ancla de uno sin ella (#583).
 */
export function resolverAsiento(asiento, { yaw = 0 } = {}) {
  if (!asiento || !Array.isArray(asiento.punto)) {
    throw new TypeError("resolverAsiento requiere un asiento con `punto`");
  }
  return {
    x: asiento.punto[0],
    z: asiento.punto[1],
    yaw: Number.isFinite(asiento.orientacion) ? asiento.orientacion : yaw,
    y: offsetSentado(asiento.altura),
  };
}

/**
 * Los puntos de interacción de los asientos de una escena.
 *
 * Se le pasa lo que ya tiene la escena —la lista de `colocarProp`— y salen las
 * definiciones para `declararInteracciones`. Los muebles sin `asiento` se saltan
 * conservando el índice, así que el id de una silla no cambia porque alguien
 * añada una barandilla antes en la lista: eso convertiría el catálogo en algo que
 * hay que revisar entero cada vez que se mueve un mueble.
 *
 * El punto de interacción se declara en el CENTRO del asiento aunque nadie pueda
 * pisarlo —la silla es un obstáculo—: el radio de serie (1,2 m) lo cubre desde
 * fuera, y ponerlo al lado obligaría a elegir un lado, que es justo lo que un
 * taburete no tiene.
 */
export function definicionesDeAsientos(colocados = [], { id = (indice) => `asiento-${indice}` } = {}) {
  return colocados.flatMap((colocado, indice) => {
    if (!colocado?.asiento) return [];
    // Un mueble con pose (`nave-pose.mjs`) ya trae id propio y es el mismo por
    // el que se le cambia la pose. Reutilizarlo, en vez de numerar otra vez, es
    // lo que evita que el punto de interacción y el mueble que mueve sean dos
    // nombres distintos de la misma silla.
    const suyo = typeof colocado.id === "string" ? colocado.id : id(indice);
    return [
      {
        id: `asiento-${suyo}`,
        punto: colocado.asiento.punto,
        orientacion: colocado.asiento.orientacion,
        // `altura` viaja en la acción porque es lo ÚNICO que el punto de
        // interacción no sabe decir por sí mismo: `punto` y `orientacion` ya
        // son campos suyos, y la altura es del mueble. Y `prop` es a quién hay
        // que cambiarle la pose al sentarse; sin él, sentarse podría mover la
        // silla de al lado.
        accion: { tipo: "asiento", altura: colocado.asiento.altura, prop: suyo },
      },
    ];
  });
}
