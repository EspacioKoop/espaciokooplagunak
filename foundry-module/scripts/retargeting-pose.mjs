// Retargeting de poses entre esqueletos (#603, fase 3).
//
// QUÉ ES. Lo que convierte «tengo la pose de la Venus» en «mi NPC puede
// adoptarla»: una pose declarada sobre UN rig, aplicada a OTRO rig de
// proporciones distintas —brazos más largos, torso más ancho— sin rehacerla a
// mano hueso por hueso.
//
// POR QUÉ ES TAN CORTO. El formato de pose de la fase 1 (`rig-esqueleto.mjs`)
// ya hizo el trabajo difícil: una pose es `{eje, angulo}` por hueso, un giro
// puro alrededor de un eje en espacio de mundo, y la traslación de cada hueso
// respecto a su padre la pone el RIG (`cabeza`), nunca la pose. Eso significa
// que un giro no sabe nada de longitudes: «el codo gira 40° alrededor de este
// eje» vale igual para un brazo de 30 cm que para uno de 45. El retargeting no
// es álgebra nueva —no hay matrices que recalcular ni cadenas que resolver dos
// veces—, es encontrar a qué hueso del rig destino corresponde cada hueso del
// rig origen y copiar el giro tal cual. Esa es también la frontera: un rig
// destino con una jerarquía de padres distinta (un dedo de más, un tramo
// partido en dos) da una pose que se dobla por donde no toca, porque la
// correspondencia de nombres no es una correspondencia de anatomía. Eso se
// declara en el propio mapeo, no lo detecta este módulo.
//
// LO QUE SE DEJA FUERA A PROPÓSITO. Reproducción de clips con interpolación
// (#603 la deja fuera desde la fase 1) y cualquier corrección de convención de
// ejes entre rigs: esta fase exige que origen y destino compartan la misma
// convención. El mapeo es solo `{idOrigen: idDestino}` — no hay esquema para
// declarar un giro de corrección; si dos rigs no coinciden en ejes, no se
// pueden retargetar todavía.
//
// Puro: ni Foundry, ni DOM, ni red. Se prueba desde Node.

export class ErrorDeRetargeting extends Error {
  constructor(code, path, message) {
    super(`${path}: ${message}`);
    this.name = "ErrorDeRetargeting";
    this.code = code;
    this.path = path;
  }
}

function fallo(code, path, message) {
  throw new ErrorDeRetargeting(code, path, message);
}

// Un id de hueso es una cadena arbitraria, y "__proto__" o "toString" son
// ids tan válidos como cualquier otro para `crearRig`. Una asignación
// `obj[id] = valor` con esos ids no crea una propiedad propia — o muta el
// prototipo, o el `obj[id]` de lectura devuelve un método heredado en vez de
// `undefined` cuando no hay mapeo. `defineProperty` fuerza una propiedad de
// datos propia (nunca dispara el setter de `__proto__`) y `Object.hasOwn`
// para leer evita que un id heredado se confunda con uno mapeado.
function asignar(obj, clave, valor) {
  Object.defineProperty(obj, clave, { value: valor, enumerable: true, writable: true, configurable: true });
}

/**
 * Aplica una pose de `rigOrigen` a `rigDestino` vía `mapeo`.
 *
 * `mapeo` es `{[idHuesoOrigen]: idHuesoDestino}`. Solo se traduce lo que el
 * mapeo declara: un hueso de la pose que no aparece en el mapeo se ignora en
 * vez de fallar —una pose parcial, «solo el codo», sigue siendo una pose
 * válida, la misma regla que ya vale para `matricesDePose`—, pero un mapeo que
 * señale a un hueso que no existe en uno de los dos rigs SÍ es error: eso no es
 * una pose incompleta, es un dato roto.
 *
 * @param {object} rigOrigen de `crearRig`.
 * @param {object} poseOrigen `{[idHueso]: {eje, angulo, desplazamiento?}}`.
 * @param {object} rigDestino de `crearRig`.
 * @param {Record<string,string>} mapeo id origen -> id destino.
 * @returns {object} pose lista para `deformarMalla`/`matricesDePose` con `rigDestino`.
 */
export function retargetPose(rigOrigen, poseOrigen, rigDestino, mapeo) {
  if (mapeo === null || typeof mapeo !== "object" || Array.isArray(mapeo)) {
    fallo("mapeo_invalido", "$.mapeo", "debe ser un objeto {idOrigen: idDestino}");
  }

  for (const [origen, destino] of Object.entries(mapeo)) {
    if (!rigOrigen.indice.has(origen)) {
      fallo("hueso_origen_inexistente", `mapeo.${origen}`, `no existe en el rig de origen`);
    }
    if (typeof destino !== "string" || !rigDestino.indice.has(destino)) {
      fallo("hueso_destino_inexistente", `mapeo.${origen}`, `"${destino}" no existe en el rig de destino`);
    }
  }

  const poseDestino = {};
  for (const [idOrigen, giro] of Object.entries(poseOrigen ?? {})) {
    if (!Object.hasOwn(mapeo, idOrigen)) continue; // no mapeado: se ignora, no es error.
    asignar(poseDestino, mapeo[idOrigen], giro);
  }
  return poseDestino;
}

/**
 * Construye el mapeo por coincidencia exacta de id entre dos rigs.
 *
 * Sirve para el caso común: dos esqueletos humanoides con la misma
 * nomenclatura de huesos («brazo_l», «antebrazo_l», …) y proporciones
 * distintas. No es un caso especial de `retargetPose` — es un mapeo como
 * cualquier otro, calculado en vez de escrito a mano cuando los nombres ya
 * coinciden, para no repetir la lista entera por cada pareja de rigs.
 *
 * @returns {Record<string,string>}
 */
export function mapeoPorId(rigOrigen, rigDestino) {
  const mapeo = {};
  for (const hueso of rigOrigen.huesos) {
    if (rigDestino.indice.has(hueso.id)) asignar(mapeo, hueso.id, hueso.id);
  }
  return mapeo;
}
