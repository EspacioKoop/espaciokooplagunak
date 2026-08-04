// Catálogo de estancias navegables (#427): qué planta de colisión y qué
// composición de render usa cada sala, y por dónde se sale de ella.
//
// MISMO PATRÓN QUE YA EXISTE DOS VECES EN EL MÓDULO: un mapa por nombre, para
// que una sala nueva no obligue a tocar el motor de movimiento
// (`nave-movimiento.mjs`) ni el bucle de render (`nave-movimiento-lienzo.
// mjs`) — igual que `registrarJuego` deja que un minijuego nuevo no toque
// `sesion-motor.mjs`, o que `crearCatalogo` deje que una mesa de asistencia
// traiga sus propias tareas sin tocar `sesion.mjs`. Aportar la estancia
// (planta + composición + puertas) es la responsabilidad de quien la declara;
// resolver "qué estancia toca ahora" es la única de este archivo.
//
// Puro: compone objetos y funciones que ya son puras (la planta de
// `nave-movimiento.mjs`, la composición de render de cada sala); no toca DOM
// ni Foundry.

/**
 * Declara una estancia. `puertas` son las de ESTA estancia —lo que se toca
 * yendo hacia fuera—, cada una con su `destino: {estancia, x, z, yaw}` que
 * apunta a otra estancia del mismo catálogo. `entrada` es dónde se aparece si
 * nadie más lo dice (primera apertura, o una puerta que no fija `x`/`z`).
 *
 * @param {{
 *   planta: object,
 *   componer: (x:number, z:number, yaw:number, opciones?:object) => object,
 *   puertas?: Array<{rect:object, destino:{estancia:string, x?:number, z?:number, yaw?:number}}>,
 *   entrada?: {x:number, z:number, yaw?:number},
 * }} definicion
 */
export function declararEstancia(definicion) {
  if (!definicion?.planta || typeof definicion?.componer !== "function") {
    throw new TypeError("declararEstancia requiere planta y componer(x, z, yaw)");
  }
  return Object.freeze({
    planta: definicion.planta,
    componer: definicion.componer,
    puertas: Object.freeze((definicion.puertas ?? []).map((p) => Object.freeze({ ...p }))),
    entrada: Object.freeze({
      x: definicion.entrada?.x ?? definicion.planta.ancho / 2,
      z: definicion.entrada?.z ?? definicion.planta.profundidad / 2,
      yaw: definicion.entrada?.yaw ?? 0,
    }),
  });
}

/**
 * Compone el catálogo. Recibe un objeto `{id: definicion}` y no una lista
 * porque el destino de una puerta ya referencia estancias POR ID —una lista
 * obligaría a resolver el id contra un índice en dos sitios distintos.
 *
 * Valida al construir, no al andar: una puerta que apunta a una estancia que
 * no existe revienta aquí, no en mitad de una sesión con gente jugando.
 */
export function crearCatalogoEstancias(estancias = {}) {
  const mapa = new Map();
  for (const [id, definicion] of Object.entries(estancias)) {
    mapa.set(id, declararEstancia(definicion));
  }
  for (const [id, estancia] of mapa) {
    for (const puerta of estancia.puertas) {
      if (!mapa.has(puerta.destino?.estancia)) {
        throw new RangeError(
          `crearCatalogoEstancias: la estancia "${id}" tiene una puerta a "${puerta.destino?.estancia}", que no existe`,
        );
      }
    }
  }
  return Object.freeze({
    tiene: (id) => mapa.has(id),
    obtener: (id) => mapa.get(id) ?? null,
    ids: Object.freeze([...mapa.keys()]),
  });
}

/**
 * Resuelve dónde aparece quien cruza una puerta: la puerta puede fijar
 * `x`/`z`/`yaw` exactos (para dejar de espaldas a la puerta por la que se
 * entra, por ejemplo), y lo que no fije cae en la `entrada` por defecto de la
 * estancia destino. Nunca se aparece DENTRO del rectángulo de una puerta del
 * destino por casualidad de coordenadas: es responsabilidad de quien declara
 * las estancias, no algo que este módulo pueda garantizar por sí solo.
 */
export function puntoDeLlegada(catalogo, destino) {
  const estancia = catalogo.obtener(destino?.estancia);
  if (!estancia) return null;
  return {
    estancia: destino.estancia,
    planta: estancia.planta,
    componer: estancia.componer,
    puertas: estancia.puertas,
    x: destino.x ?? estancia.entrada.x,
    z: destino.z ?? estancia.entrada.z,
    yaw: destino.yaw ?? estancia.entrada.yaw,
  };
}
