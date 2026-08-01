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

import { SISTEMAS_POR_REGION_CASCO_SERIE, saludPorRegion } from "./casco-dano.mjs";

/**
 * Rejilla de la sección, en celdas. Las salas se colocan sobre ella y el lienzo
 * escala después: la planta se piensa en celdas para que mover una sala sea
 * cambiar un número entero y no recalcular píxeles.
 */
export const REJILLA = Object.freeze({ columnas: 12, filas: 6 });

/**
 * La planta de la nave de serie, a mano y esquemática.
 *
 * A MANO A PROPÓSITO. Derivarla de la plantilla del simulador es más bonito y
 * mucho más caro, y además la plantilla no dice nada de salas: dice cascos y
 * sistemas. Una sección tolera ser esquemática —es su virtud— así que el primer
 * mapa se dibuja y ya se verá si #55 permite generarlo.
 *
 * Cada sala declara:
 * - `caja`: dónde está, en celdas de `REJILLA`.
 * - `region`: qué región del casco de #419 la gobierna, o `null` si es interior
 *   y no recibe daño directo. La salud NO se inventa aquí.
 * - `destino`: qué se abre al pulsarla. `null` es una sala que se mira y no se
 *   entra — que son la mayoría, y está bien: la sección es primero un mapa.
 */
export const SALAS = Object.freeze([
  Object.freeze({
    id: "puente",
    tituloClave: "LAGUNAK.Seccion.Sala.Puente",
    caja: Object.freeze({ x: 8, y: 1, ancho: 4, alto: 2 }),
    region: "lomo",
    // Entrar al puente es abrir la consola de puesto que ya existe: la sección
    // es un atajo hacia lo que hay, no una consola nueva. Y sigue sin dar
    // mandos — la consola enseña lo que el relé permita a quien la abra.
    destino: "puesto",
    puesto: "captain",
  }),
  Object.freeze({
    id: "cantina",
    tituloClave: "LAGUNAK.Seccion.Sala.Cantina",
    caja: Object.freeze({ x: 4, y: 1, ancho: 4, alto: 2 }),
    region: null,
    // La única sala que hoy tiene interior de verdad. Que sea la única no es
    // una carencia de la sección: es lo que hace que la sección valga la pena
    // ya, en vez de esperar a tener seis salas habitables.
    destino: "cantina",
  }),
  Object.freeze({
    id: "enfermeria",
    tituloClave: "LAGUNAK.Seccion.Sala.Enfermeria",
    caja: Object.freeze({ x: 1, y: 1, ancho: 3, alto: 2 }),
    region: "costados",
    destino: null,
  }),
  Object.freeze({
    id: "ingenieria",
    tituloClave: "LAGUNAK.Seccion.Sala.Ingenieria",
    caja: Object.freeze({ x: 8, y: 3, ancho: 4, alto: 2 }),
    region: "popa",
    destino: "puesto",
    puesto: "engineering",
  }),
  Object.freeze({
    id: "bodega",
    tituloClave: "LAGUNAK.Seccion.Sala.Bodega",
    caja: Object.freeze({ x: 4, y: 3, ancho: 4, alto: 2 }),
    region: "quilla",
    destino: null,
  }),
  Object.freeze({
    id: "camarotes",
    tituloClave: "LAGUNAK.Seccion.Sala.Camarotes",
    caja: Object.freeze({ x: 1, y: 3, ancho: 3, alto: 2 }),
    region: null,
    destino: null,
  }),
]);

/** Catálogo completo, en orden estable de lectura (proa arriba). */
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
  const salud = saludPorRegion(sistemas);
  return {
    rejilla: REJILLA,
    salas: SALAS.map((sala) => ({
      id: sala.id,
      tituloClave: sala.tituloClave,
      caja: sala.caja,
      region: sala.region,
      destino: sala.destino,
      puesto: sala.puesto ?? null,
      salud: sala.region ? (salud[sala.region] ?? null) : null,
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
export const SALA_DE_PUESTO = Object.freeze({
  captain: "puente",
  navigation: "puente",
  sensors: "puente",
  communications: "puente",
  weapons: "puente",
  engineering: "ingenieria",
});

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
  if (!sala?.region) return [];
  return SISTEMAS_POR_REGION_CASCO_SERIE[sala.region] ?? [];
}
