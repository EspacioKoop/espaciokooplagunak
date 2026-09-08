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
 * `interacciones` (#582, antes `consolas` de #509) son puntos de interacción
 * DENTRO de la sala, no en un muro: acercarse a uno NO cambia de estancia
 * —`destino` no tiene sentido aquí—, dispara un aviso hacia fuera con su
 * `accion`, opaca para este módulo igual que `destino` en una puerta, que
 * interpreta quien gestione el catálogo.
 *
 * Nacieron como `consolas`, con la forma de una puerta (`{rect, puesto}`) para
 * reutilizar `nave-movimiento.puertaTocada`. Esa forma solo daba para lo que ya
 * había —una zona rectangular y un puesto—: ni ancla, ni orientación, ni id por
 * el que buscarlas. La declaración vive ahora en `nave-interaccion.mjs` y aquí
 * solo se transporta.
 *
 * @param {{
 *   planta: object,
 *   componer: (x:number, y:number, z:number, yaw:number, opciones?:object) => object,
 *   puertas?: Array<{rect:object, destino:{estancia:string, x?:number, z?:number, yaw?:number}}>,
 *   interacciones?: Array<object>,
 *   fondo?: string|null,
 *   conPoses?: (poses:object) => {planta:object, componer:Function, colocados?:Array},
 *   poseables?: Array<object>,
 *   entrada?: {x:number, z:number, yaw?:number},
 * }} definicion
 */
export function declararEstancia(definicion) {
  if (!definicion?.planta || typeof definicion?.componer !== "function") {
    throw new TypeError("declararEstancia requiere planta y componer(x, y, z, yaw)");
  }
  return Object.freeze({
    planta: definicion.planta,
    componer: definicion.componer,
    puertas: Object.freeze((definicion.puertas ?? []).map((p) => Object.freeze({ ...p }))),
    // Ya vienen validadas y congeladas de `declararInteraccion`: aquí solo se
    // garantiza que la lista existe, para que nadie tenga que comprobar
    // `?? []` al recorrerla.
    interacciones: Object.freeze([...(definicion.interacciones ?? [])]),
    // Con qué color se limpia el lienzo detrás de esta estancia (#587). Es
    // propiedad de la ESTANCIA y no de la ventana porque el gris de mamparo que
    // vale para «más nave sin renderizar todavía» no vale para un exterior: en
    // la playa, lo que hay detrás de la geometría es cielo. `null` deja el que
    // traiga la ventana, que es lo que hacen las trece salas de la nave.
    fondo: definicion.fondo ?? null,
    /**
     * Cómo queda esta estancia con sus muebles con pose en otras poses
     * (`nave-pose.mjs`), o `null` si no tiene ninguno.
     *
     * Es OPACO aquí, igual que la `accion` de un punto de interacción: el
     * catálogo declara que la estancia sabe recomponerse y quién le pasa qué
     * poses es cosa de arriba. Sin esto, la ventana de andar tendría que
     * preguntar «¿es la terraza?» para saber si una silla se retira, que es
     * exactamente el `if` con el nombre de una sala dentro del motor que #508
     * dejó prohibido.
     *
     * Devuelve `{planta, componer}`, que es lo que acepta `recomponer` del
     * bucle: ni puertas ni interacciones, porque una pose no las cambia.
     */
    conPoses: typeof definicion.conPoses === "function" ? definicion.conPoses : null,
    /** Los muebles con pose de esta estancia, ya declarados por
     *  `declararPoseables`. Van con `conPoses` y no dentro de ella porque quien
     *  cambia una pose necesita saber qué poses EXISTEN antes de pedir una. */
    poseables: Object.freeze([...(definicion.poseables ?? [])]),
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
 * Con qué estancia se abre la ventana de andar. Tres fuentes, en este orden:
 *
 * 1. `pedida` — alguien ha dicho explícitamente «entra AHÍ» (la sección de la
 *    nave al pulsar una sala, #508). MANDA SOBRE LA GUARDADA a propósito:
 *    pedir entrar al puente y reaparecer en la cantina porque es donde se
 *    cerró la ventana la última vez sería no obedecer. Y se aparece en la
 *    `entrada` de serie de esa estancia —por eso devuelve `guardada: null`—,
 *    no en unas coordenadas que son de OTRA sala.
 * 2. `guardada`, el checkpoint normal de quien vuelve a abrir la ventana.
 * 3. `porDefecto`, la lectura segura de la primera vez.
 *
 * Un id que el catálogo no conoce se ignora y cae al siguiente escalón (un
 * catálogo cambiado entre sesiones, o una sala de la sección que apunte a una
 * estancia que ya no existe): mejor arrancar en un sitio declarado que en uno
 * que nadie declaró.
 *
 * Aquí y no en la ventana porque es una DECISIÓN sobre el catálogo, que es lo
 * único que hace este módulo; la ventana solo la aplica.
 */
export function resolverArranque(catalogo, { pedida = null, guardada = null, porDefecto } = {}) {
  if (pedida && catalogo.tiene(pedida)) return { estancia: pedida, guardada: null };
  if (guardada?.estancia && catalogo.tiene(guardada.estancia)) {
    return { estancia: guardada.estancia, guardada };
  }
  return { estancia: porDefecto, guardada: null };
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
    interacciones: estancia.interacciones,
    fondo: estancia.fondo,
    x: destino.x ?? estancia.entrada.x,
    z: destino.z ?? estancia.entrada.z,
    yaw: destino.yaw ?? estancia.entrada.yaw,
  };
}
