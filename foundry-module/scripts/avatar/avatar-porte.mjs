/**
 * Lo que alguien LLEVA en la mano, separado de lo que está HACIENDO (#897).
 *
 * Hasta ahora el atrezo salía del gesto: la jarra aparecía con «brindis» y el
 * cigarro con «fumar» (`atrezoDelGesto` en `cantina-avatar.mjs`). Con esa regla,
 * poder llevar una espada obligaba a inventar un gesto «empuñar» que excluiría a
 * los otros cinco — no se podría fumar con la espada en la mano. Aquí el porte
 * es un dato aparte, por anclaje, y se puede combinar con cualquier gesto.
 *
 * CADA OBJETO DECLARA SU AGARRE: dónde se cierra el puño, medido desde el
 * origen del propio objeto. Lo declara la pieza y no el cuerpo, porque una
 * espada se coge por el mango, una jarra por el asa a media altura y una
 * tablilla por el canto de abajo — y un cuerpo no tiene por qué conocer cada
 * trasto que le pongan en la mano. Colgar es entonces UNA RESTA, sin una sola
 * rama por tipo de objeto: esa ausencia es la prueba de que el contrato está en
 * el sitio correcto.
 *
 * DE MOMENTO SOLO CAJAS. Las piezas de un avatar viajan como
 * `{nombre, color, centro, medidas}` y sus cuatro consumidores las convierten en
 * malla con `caja`/`cajaGirada`. Un objeto de malla libre —la espada de 107
 * caras de la sonda de #976— no cabe por ese contrato sin ensancharlo en los
 * cuatro sitios, y eso es una decisión aparte que no se cuela dentro de esta.
 *
 * Frontera de arte (#351): ni un color propio, todos de `paleta.mjs`.
 * Puro: ni Foundry, ni DOM, ni red, ni reloj.
 */

import { AVATAR } from "../paleta.mjs";
import { sombrear } from "../retro3d.mjs";

/** El catálogo cerrado. Un objeto nuevo es una entrada más, nunca una rama. */
export const PORTE = Object.freeze(["jarra", "linterna", "tablilla"]);

/**
 * Cada entrada declara `agarre` y `piezas`, las dos en coordenadas del OBJETO
 * (origen en el propio objeto, no en el cuerpo). Nadie de aquí sabe dónde está
 * una mano.
 */
const DEFINICIONES = Object.freeze({
  // La jarra de la cantina. Se coge por el asa, que no está en su eje: el
  // agarre va desplazado en x, y solo con eso ya cuelga bien.
  jarra: Object.freeze({
    agarre: Object.freeze([0.1, 0, 0]),
    piezas: () => [
      { sufijo: "Jarra", color: AVATAR.jarra, centro: [0, 0, 0], medidas: [0.18, 0.24, 0.18] },
    ],
  }),

  // Una linterna: mango y cabeza. El cristal es la única pieza EMISIVA, la
  // misma excepción de #555 — se pinta a intensidad plena y no alumbra a nadie.
  linterna: Object.freeze({
    agarre: Object.freeze([0, -0.05, 0]),
    piezas: ({ encendida = false } = {}) => [
      { sufijo: "LinternaMango", color: sombrear(AVATAR.acero, 0.7), centro: [0, 0, 0], medidas: [0.06, 0.2, 0.06] },
      { sufijo: "LinternaCabeza", color: AVATAR.acero, centro: [0, 0.14, 0], medidas: [0.1, 0.1, 0.1] },
      {
        sufijo: "LinternaCristal",
        // Apagada NO es otra pieza ni otro objeto: es la misma, más oscura y
        // sin emitir. Lo que cambia es el estado, no el inventario.
        color: encendida ? AVATAR.simbolo : sombrear(AVATAR.simbolo, 0.35),
        emisivo: encendida,
        centro: [0, 0.2, 0],
        medidas: [0.09, 0.02, 0.09],
      },
    ],
  }),

  // Una tablilla de datos: ni arma ni bebida. Se sujeta por el canto de abajo,
  // que es lo que hace que su agarre no se parezca a los otros dos.
  tablilla: Object.freeze({
    agarre: Object.freeze([0, -0.1, 0.015]),
    piezas: ({ encendida = true } = {}) => [
      { sufijo: "Tablilla", color: sombrear(AVATAR.acero, 0.65), centro: [0, 0, 0], medidas: [0.2, 0.26, 0.022] },
      {
        sufijo: "TablillaPantalla",
        color: encendida ? AVATAR.simbolo : sombrear(AVATAR.simbolo, 0.35),
        emisivo: encendida,
        centro: [0, 0.02, -0.014],
        medidas: [0.16, 0.19, 0.004],
      },
    ],
  }),
});

/**
 * Un desplazamiento pegado al cuerpo: gira CON la persona.
 *
 * Misma cuenta que `sobreCuerpo` en `cantina-avatar.mjs` y por el mismo motivo:
 * una jarra «un poco por delante de la mano» tiene que seguir por delante
 * cuando alguien se da la vuelta. Sumarlo en ejes de mundo la dejaría cruzando
 * el pecho.
 */
function sobreCuerpo([x, y, z], [dx, dy, dz], yaw = 0) {
  if (!Number.isFinite(yaw) || yaw === 0) return [x + dx, y + dy, z + dz];
  const sen = Math.sin(yaw);
  const cos = Math.cos(yaw);
  return [x + dx * cos + dz * sen, y + dy, z - dx * sen + dz * cos];
}

/**
 * Las piezas de un objeto colgado de un anclaje ya resuelto.
 *
 * @param {string} nombre uno de `PORTE`. Cualquier otro valor no dibuja nada y
 *   no revienta: un estado con un objeto mal escrito no debe tirar la sala.
 * @param {[number, number, number]} punto el anclaje, en el mismo espacio de
 *   mundo que las piezas del cuerpo (lo da `anclasAvatar`).
 * @param {{prefijo?: string, yaw?: number, encendida?: boolean}} opciones
 * @returns {Array<{nombre: string, color: string, centro: number[], medidas: number[]}>}
 */
export function sostener(nombre, punto, { prefijo = "", yaw = 0, ...estado } = {}) {
  const definicion = DEFINICIONES[nombre];
  if (!definicion || !Array.isArray(punto) || punto.length !== 3) return [];
  const [ax, ay, az] = definicion.agarre;
  return definicion.piezas(estado).map((pieza) => {
    const [cx, cy, cz] = pieza.centro;
    return Object.freeze({
      ...pieza,
      sufijo: undefined,
      nombre: `${prefijo}${pieza.sufijo}`,
      // La resta: el agarre del objeto se lleva al punto de la mano, y lo demás
      // del objeto viaja con él.
      centro: sobreCuerpo(punto, [cx - ax, cy - ay, cz - az], yaw),
    });
  });
}

/**
 * El porte normalizado: qué se lleva en cada mano.
 *
 * Un objeto desconocido se descarta en silencio en vez de propagarse, por lo
 * mismo que `normalizarAvatar` acota el resto: un dato de mundo mal escrito no
 * puede dejar a nadie sin cuerpo.
 */
export function normalizarPorte(porte = {}) {
  const uno = (v) => (typeof v === "string" && PORTE.includes(v) ? v : null);
  return Object.freeze({
    manoDerecha: uno(porte?.manoDerecha),
    manoIzquierda: uno(porte?.manoIzquierda),
  });
}
