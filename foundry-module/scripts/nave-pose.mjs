// Props con POSE: muebles que cambian de sitio o de forma sin cambiar de sala.
//
// QUÉ LE FALTABA AL MÓDULO. Hasta ahora todo lo que hay dentro de una estancia
// era inmóvil: la fábrica de salas (`nave-sala-caja.mjs`) congela su mobiliario
// al construirla, y lo único que se recalcula por fotograma son las HOJAS de las
// puertas, cableadas a mano dentro de la fábrica. Es decir: el módulo ya sabía
// mover una cosa, pero solo esa cosa, y solo desde dentro. Un mueble que se abre,
// una palanca que baja o una silla que se retira al ocuparse no tenían dónde
// vivir.
//
// UNA POSE ES UNA COLOCACIÓN, NO UNA MALLA. Es la decisión que hace corto este
// módulo: una pose no declara geometría propia, declara DÓNDE va el prop que ya
// existe (y, si hace falta, qué prop del vocabulario es). Así una pose no puede
// desincronizarse del mueble —es el mismo mueble— y quien añade una pose no
// añade ni un vértice. Lo que no se puede expresar así (una hoja de libro que se
// dobla, #853) es geometría de verdad y va en su propio módulo, igual que
// `rig-esqueleto.mjs` no vive aquí.
//
// EL DESPLAZAMIENTO ES DEL PROP, NO DE LA SALA. Se declara `atras`/`lado` en
// metros y en el marco del propio mueble, y se gira con él (`girarEnPlanta`).
// Escribirlo en coordenadas de sala obligaría a poner dos números distintos por
// cada silla de las cuatro que rodean una mesa, y la de la izquierda se retiraría
// hacia el norte. Es la misma regla con la que el punto de pesca sale del ancla
// del soporte y no de dos números a ojo (#579).
//
// EL ESTADO NO VIVE AQUÍ. Este módulo es puro: se le pasa qué pose tiene cada
// prop y devuelve dónde queda todo. Quién recuerda la pose es de arriba —hoy la
// ventana de andar, junto al asiento que se tiene delante— porque no es un dato
// de la escena sino de esta partida en este instante, y porque una escena que
// recordara en qué pose dejó cada mueble estaría RECORDANDO, que es justo lo que
// `docs/FOUNDRY.md` no le deja hacer.
//
// Puro: ni Foundry, ni DOM, ni red.

import { VOCABULARIO, colocarProp, girarEnPlanta } from "./nave-props.mjs";

/**
 * Declara un mueble con poses.
 *
 * @param {object} definicion
 * @param {string} definicion.id estable y único dentro de su estancia, como el
 *   de un punto de interacción: es por donde se acciona.
 * @param {string} definicion.clave del vocabulario de props.
 * @param {number} definicion.x
 * @param {number} definicion.z posición de la pose BASE, en la sala.
 * @param {number} [definicion.cuartos] giro, en cuartos de vuelta.
 * @param {Record<string, {atras?:number, lado?:number, clave?:string}>} definicion.poses
 *   Al menos dos. `atras` y `lado` van en METROS y en el marco del mueble
 *   (`atras` positivo lo aleja de su frente); `clave` cambia el prop, para una
 *   pose que no sea un desplazamiento sino otra pieza.
 * @param {string} [definicion.pose] con cuál empieza. Por defecto, la primera.
 */
export function declararPoseable({ id, clave, x, z, cuartos = 0, poses, pose } = {}) {
  if (typeof id !== "string" || id === "") {
    throw new TypeError("declararPoseable requiere un `id` no vacío");
  }
  const nombres = Object.keys(poses ?? {});
  if (nombres.length < 2) {
    // Con una sola pose esto es un mueble normal, y declararlo aquí solo añade
    // un botón que no hace nada. Revienta al construir el catálogo.
    throw new RangeError(`declararPoseable("${id}") necesita al menos dos poses`);
  }
  const inicial = pose ?? nombres[0];
  if (!nombres.includes(inicial)) {
    throw new RangeError(`declararPoseable("${id}"): la pose inicial "${inicial}" no está declarada`);
  }
  return Object.freeze({
    id,
    clave,
    x,
    z,
    cuartos,
    poseInicial: inicial,
    nombres: Object.freeze([...nombres]),
    poses: Object.freeze(
      Object.fromEntries(
        nombres.map((nombre) => [
          nombre,
          Object.freeze({
            atras: poses[nombre].atras ?? 0,
            lado: poses[nombre].lado ?? 0,
            clave: poses[nombre].clave ?? clave,
          }),
        ]),
      ),
    ),
  });
}

/** Valida una lista y comprueba que no hay ids repetidos. */
export function declararPoseables(definiciones = []) {
  const vistos = new Set();
  return Object.freeze(
    definiciones.map((definicion) => {
      const poseable = declararPoseable(definicion);
      if (vistos.has(poseable.id)) {
        throw new RangeError(`declararPoseables: id repetido "${poseable.id}"`);
      }
      vistos.add(poseable.id);
      return poseable;
    }),
  );
}

/** La pose en la que está `id`, o su inicial si nadie la ha tocado. */
export function poseDe(poseables, estado, id) {
  const poseable = poseables.find((p) => p.id === id);
  if (!poseable) return null;
  const puesta = estado?.[id];
  return poseable.nombres.includes(puesta) ? puesta : poseable.poseInicial;
}

/**
 * El estado con `id` en la pose siguiente, o en la pedida.
 *
 * Devuelve un objeto NUEVO y no toca el que recibe: el estado de poses viaja
 * hasta el render en el mismo fotograma en el que cambia, y mutarlo en el sitio
 * es cómo se pinta media escena con la pose vieja.
 */
export function ponerPose(poseables, estado, id, pose = null) {
  const poseable = poseables.find((p) => p.id === id);
  if (!poseable) return estado ?? {};
  const actual = poseDe(poseables, estado, id);
  const siguiente = pose ?? poseable.nombres[(poseable.nombres.indexOf(actual) + 1) % poseable.nombres.length];
  if (!poseable.nombres.includes(siguiente)) return estado ?? {};
  return Object.freeze({ ...(estado ?? {}), [id]: siguiente });
}

/**
 * Coloca cada mueble con poses según el estado, listo para el mobiliario de una
 * sala.
 *
 * @returns {Array<{id:string, pose:string, piezas:Array, ancla:object|null, asiento:object|null}>}
 *   La misma forma que devuelve `colocarProp`, más el `id` y la pose, para que
 *   quien componga la escena no tenga que saber que existen las poses.
 */
export function colocarPoseables(poseables = [], estado = {}, { vocabulario = VOCABULARIO } = {}) {
  return poseables.map((poseable) => {
    const pose = poseDe(poseables, estado, poseable.id);
    const { atras, lado, clave } = poseable.poses[pose];
    // El desplazamiento se declara en el marco del mueble y se gira con él:
    // «hacia atrás» es −z local, y `lado` es +x local.
    const [dx, dz] = girarEnPlanta([lado, -atras], poseable.cuartos);
    const colocado = colocarProp(clave, {
      x: poseable.x + dx,
      z: poseable.z + dz,
      cuartos: poseable.cuartos,
      nombre: poseable.id,
      vocabulario,
    });
    return { id: poseable.id, pose, ...colocado };
  });
}
