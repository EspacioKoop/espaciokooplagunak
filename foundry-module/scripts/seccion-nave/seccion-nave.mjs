/* La nave en SECCIÓN (#427): el corte transversal con todas las salas a la vez.
 *
 * POR QUÉ ESTO Y NO ANDAR POR LOS PASILLOS. La cantina (#423) demostró que se
 * puede estar DENTRO de un sitio, y la pregunta siguiente era andar de una sala
 * a otra en primera persona. Son dos mitades distintas y esta es la barata: una
 * sección no necesita planta navegable ni colisiones —es una rejilla de salas—,
 * se lee de un vistazo, y da justo lo que ninguna vista en primera persona
 * puede dar: quién está dónde y qué parte de la nave está reventada.
 *
 * La sección es el MAPA; la cantina es ESTAR dentro. Una lleva a la otra: se
 * pulsa una sala y se abre su vista propia. Por eso este módulo no dibuja ni
 * abre nada — solo declara la planta y responde preguntas sobre ella.
 *
 * LO QUE ESTE MÓDULO NO ES. No es autoridad (#237): dónde esté un tripulante en
 * la sección no da mandos de nada, los puestos los sigue resolviendo el relé.
 * Y la salud de una sala no es una lectura nueva: se deriva de los sistemas que
 * ya publica el puente, cruzando por las mismas regiones de casco de #419.
 *
 * Puro: ni Foundry, ni DOM, ni red, ni color.
 */

import { ID_CANTINA, celdasConCantina, rejillaDelPlano } from "../nave-planta-phobos.mjs";

/**
 * Rejilla de la sección, en celdas. Las salas se colocan sobre ella y el lienzo
 * escala después: la planta se piensa en celdas para que mover una sala sea
 * cambiar un número entero y no recalcular píxeles.
 */
/**
 * Rejilla y salas: la planta REAL del Phobos M3P (#542).
 *
 * Hasta aquí la sección declaraba seis salas a mano —puente, enfermería, bodega,
 * camarotes…— con el argumento de que «la plantilla no dice nada de salas: dice
 * cascos y sistemas». Ese argumento resultó FALSO: el `shipTemplate` declara
 * trece salas con sus sistemas (`addRoom`/`addRoomSystem`), y #540 ya las usó
 * para la nave que se recorre. Mantener las seis inventadas dejaba dos naves
 * distintas en el mismo módulo, con una enfermería y una bodega que no existen y
 * nueve salas reales sin dibujar.
 *
 * La planta la declara `nave-planta-phobos.mjs` y aquí solo se le añade lo que
 * es propio de la sección: qué se abre al pulsar cada sala.
 */
export const REJILLA = Object.freeze(rejillaDelPlano());

/**
 * Qué puesto abre la consola de cada sala, por su SISTEMA.
 *
 * Es el mismo reparto que usa la ventana de andar (`nave-catalogo-andar.mjs`) y
 * por el mismo motivo: la consola del reactor abre ingeniería porque ahí está el
 * reactor. Se repite aquí en vez de importarse para no crear una dependencia
 * entre la sección y el catálogo de andar — la sección declara adónde lleva cada
 * sala, y el motor de andar no necesita saber que existe una sección.
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

/** Puestos sin sistema propio, alojados en las pasarelas. Igual que en #540. */
const PUESTO_POR_SALA = Object.freeze({
  "pasarela-proa": "sensors",
  "pasarela-popa": "communications",
});

/**
 * Las salas de la sección.
 *
 * `destino` es «andar» para TODAS menos la cantina: ahora que la planta es la
 * real, cada sala de la sección es una estancia recorrible de verdad, y ya no
 * hace falta la traducción a mano que #540 tuvo que poner (`puente →
 * pasarela-proa`, `ingenieria → reactor`) para que el clic no muriera. El
 * `estancia` es el propio id.
 *
 * La cantina conserva `destino: "cantina"`: abre su ventana propia de cinco
 * planos fijos (#423), que es la vista hecha a medida de esa sala.
 */
export const SALAS = Object.freeze(celdasConCantina().map((celda) => Object.freeze({
  id: celda.id,
  // Los nombres ya existían para la ventana de andar: una sala tiene UN nombre.
  tituloClave: ["LAGUNAK", "AndarNave", "Sala", celda.id].join("."),
  caja: Object.freeze({ x: celda.x, y: celda.y, ancho: celda.w, alto: celda.h }),
  /** El sistema que ALOJA, o `null`. Sustituye a la `region` inventada: la
   *  salud de una sala es la de su sistema, no la de un trozo de casco. */
  sistema: celda.sistema,
  destino: celda.id === ID_CANTINA ? "cantina" : "andar",
  estancia: celda.id === ID_CANTINA ? null : celda.id,
  puesto: celda.sistema ? (PUESTO_POR_SISTEMA[celda.sistema] ?? null) : (PUESTO_POR_SALA[celda.id] ?? null),
})));

export function salasSeccion() {
  return SALAS;
}

/** La sala con ese id, o `undefined`. */
export function salaPorId(id) {
  return SALAS.find((sala) => sala.id === id);
}

function dentro(caja, x, y) {
  return x >= caja.x && x < caja.x + caja.ancho && y >= caja.y && y < caja.y + caja.alto;
}

/**
 * Qué sala hay en esa celda, o `null` si es mamparo. Coordenadas en celdas: la
 * conversión desde píxeles la hace quien tenga el lienzo, no este módulo.
 */
export function salaEnCelda(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return SALAS.find((sala) => dentro(sala.caja, Math.floor(x), Math.floor(y))) ?? null;
}

/**
 * La sección lista para pintar: cada sala con la salud de su región.
 *
 * `null` en `salud` quiere decir SIN LECTURA, y no «cero»: una sala interior no
 * tiene región, y una nave sin puente conectado no tiene ninguna. Confundir las
 * dos cosas pintaría de rojo una nave intacta, que es la peor mentira que puede
 * contar un mapa de daños.
 */
export function componerSeccion(sistemas = []) {
  // La salud de una sala es la de SU sistema. Antes se agrupaba por regiones de
  // casco inventadas y una sala podía teñirse por una avería que no estaba en
  // ella; ahora el reactor se pone en rojo cuando se rompe el reactor.
  const porId = new Map(
    (Array.isArray(sistemas) ? sistemas : [])
      .filter((sistema) => typeof sistema?.id === "string")
      .map((sistema) => [sistema.id.toLowerCase(), sistema?.health]),
  );
  const saludDe = (sala) => {
    if (!sala.sistema) return null;
    const leida = porId.get(sala.sistema.toLowerCase());
    return typeof leida === "number" && Number.isFinite(leida) ? leida : null;
  };
  return {
    rejilla: REJILLA,
    salas: SALAS.map((sala) => ({
      id: sala.id,
      tituloClave: sala.tituloClave,
      caja: sala.caja,
      sistema: sala.sistema,
      destino: sala.destino,
      estancia: sala.estancia ?? null,
      puesto: sala.puesto ?? null,
      salud: saludDe(sala),
    })),
  };
}

/**
 * Reparto de tripulantes por sala. Recibe presencias ya resueltas por quien sí
 * sabe de Foundry (`{ id, nombre, sala }`) y las agrupa; una presencia en una
 * sala que no existe se descarta en vez de inventarse un sitio donde ponerla.
 */
export function tripulacionPorSala(presencias = []) {
  const porSala = new Map(SALAS.map((sala) => [sala.id, []]));
  for (const presencia of Array.isArray(presencias) ? presencias : []) {
    const lista = porSala.get(presencia?.sala);
    if (lista) lista.push({ id: presencia.id ?? null, nombre: presencia.nombre ?? "" });
  }
  return Object.fromEntries(porSala);
}

/**
 * Dónde está físicamente cada puesto. Es la única fuente de presencia que hay
 * hoy, y es honesta: quien tiene ingeniería está en ingeniería, y el resto del
 * puente está en el puente.
 *
 * NO es autoridad y no puede llegar a serlo (#237): esto lee el puesto para
 * decidir dónde pintar un punto. Al revés —deducir el puesto de dónde está tu
 * punto— sería regalar los mandos a quien se ponga en el sitio correcto, y es
 * justo lo que este issue promete no hacer.
 */
export const SALA_DE_PUESTO = Object.freeze(
  // Se INVIERTE el reparto de consolas en vez de escribirse aparte: con dos
  // tablas, un puesto podía pintarse en una sala cuya consola abre otro puesto.
  // Cuando un puesto tiene varias salas (pilotaje aloja maniobra, impulso, warp
  // y salto) gana la primera del plano, que es la más a proa.
  SALAS.reduce((mapa, sala) => {
    if (sala.puesto && !mapa[sala.puesto]) mapa[sala.puesto] = sala.id;
    return mapa;
  }, {}),
);

/** La sala de ese puesto, o `null` si el puesto no tiene sitio en la planta. */
export function salaDePuesto(puesto) {
  return SALA_DE_PUESTO[puesto] ?? null;
}

/**
 * Qué sistemas del DTO explican la salud de esta sala. Es el canal TEXTUAL de
 * la sección: el color dice «aquí pasa algo» y esta lista dice qué, para quien
 * no distinga los tres escalones de color o no los esté mirando.
 */
export function sistemasDeSala(id) {
  const sala = salaPorId(id);
  // Una sala aloja UN sistema o ninguno: ya no hay que traducir por regiones de
  // casco. Se devuelve lista para no cambiar el contrato de quien la pinta.
  return sala?.sistema ? [sala.sistema.toLowerCase()] : [];
}
