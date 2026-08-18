// Deformación de malla por huesos (#603, fase 1).
//
// QUÉ ES. La capa que le falta al motor para que una malla importada pueda
// DOBLARSE: una jerarquía de huesos con su pose de reposo, un peso por vértice y
// hueso, y la transformación de la malla ANTES de componerla. Nada de esto
// existía: `retro3d` compone polígonos con color plano por cara y no sabe —ni
// tiene por qué saber— qué es un esqueleto.
//
// POR QUÉ SE ELIGIÓ ESTE CAMINO Y NO CORTAR POR PLANOS. Está medido en #603: una
// estatua escaneada es UNA sola pieza conectada (la Venus tiene 448 vértices y
// dos componentes, y uno es un vértice suelto), así que «detectar el brazo» no
// se resuelve por topología. Cortar por planos daría piezas estáticas, y lo que
// se quiere de verdad —PC, NPC y criaturas— son cosas que se mueven. Esta es la
// vía estándar de industria y también la cara; se paga por fases.
//
// ESTA ES LA FASE 1 Y SE PARA AQUÍ. Hay formato de rig, pesos y deformación. NO
// hay asignación automática de pesos (fase 2), NI retargeting de una pose a otro
// esqueleto (fase 3), NI reproducción de clips con interpolación, que #603 deja
// explícitamente fuera. El criterio de salida es exactamente uno: una malla con
// un rig hecho a mano se dobla por el codo y se dibuja bien.
//
// EL MOTOR NO SE TOCA, Y ES LA DECISIÓN QUE SOSTIENE TODO LO DEMÁS. Esto entra y
// sale en `{vertices, caras}`: se deforma la malla y se le pasa a `componerEscena`
// la malla ya deformada. Un esqueleto dentro del rasterizador habría atado la
// deformación a una época de consola y a un pintor concreto, cuando es geometría
// y vale igual para las dos máquinas de #362.
//
// EL REPOSO ES SOLO TRASLACIÓN, y por eso aquí no hay inversión de matrices. Un
// hueso en reposo se declara por la posición de su CABEZA en el espacio de la
// malla; su transformación de reposo es la traslación hasta ese punto, cuya
// inversa es restar el punto. La matriz de piel de un hueso queda entonces en
// «lleva el vértice al origen del hueso, gíralo y súbelo con la cadena de
// padres», sin un solo determinante. Un rig con rotaciones ya metidas en el
// reposo obligaría a invertir, y no compra nada que no dé una pose.
//
// Puro: ni Foundry, ni DOM, ni red. Se prueba desde Node.

/** Tope de huesos por rig. Un esqueleto humanoide completo con dedos anda por
 *  los cincuenta; 128 deja sitio de sobra y evita que un dato corrupto haga
 *  recorrer una jerarquía sin fin. */
const MAX_HUESOS = 128;
/** Cuántos huesos puede influir a un mismo vértice. Cuatro es lo que usa
 *  cualquier motor, y no por casualidad: con más, el peso de los últimos ya no
 *  se ve, y la mezcla se vuelve imposible de razonar al ajustarla a mano. */
export const MAX_INFLUENCIAS = 4;

export class ErrorDeRig extends Error {
  constructor(code, path, message) {
    super(`${path}: ${message}`);
    this.name = "ErrorDeRig";
    this.code = code;
    this.path = path;
  }
}

function fallo(code, path, message) {
  throw new ErrorDeRig(code, path, message);
}

function esPunto(valor) {
  return Array.isArray(valor) && valor.length === 3 && valor.every((n) => Number.isFinite(n));
}

/* ---- álgebra mínima -------------------------------------------------------- */
//
// Se escriben aquí las cuatro operaciones que hacen falta en vez de traer una
// librería: son quince líneas, no tienen versiones ni licencia que revisar, y el
// módulo no declara ninguna dependencia dura (regla de `docs/ECOSISTEMA_MODULOS_FOUNDRY.md`).

/** Transformación rígida: rotación 3x3 por filas más traslación. */
function identidad() {
  return { r: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] };
}

/** `a` aplicada DESPUÉS de `b`, o sea la composición `a ∘ b`. */
function componer(a, b) {
  const r = new Array(9);
  for (let fila = 0; fila < 3; fila += 1) {
    for (let col = 0; col < 3; col += 1) {
      r[fila * 3 + col] =
        a.r[fila * 3] * b.r[col]
        + a.r[fila * 3 + 1] * b.r[3 + col]
        + a.r[fila * 3 + 2] * b.r[6 + col];
    }
  }
  return { r, t: sumar(aplicarRotacion(a, b.t), a.t) };
}

function aplicarRotacion({ r }, [x, y, z]) {
  return [
    r[0] * x + r[1] * y + r[2] * z,
    r[3] * x + r[4] * y + r[5] * z,
    r[6] * x + r[7] * y + r[8] * z,
  ];
}

function aplicar(m, punto) {
  return sumar(aplicarRotacion(m, punto), m.t);
}

function sumar([ax, ay, az], [bx, by, bz]) {
  return [ax + bx, ay + by, az + bz];
}

function restar([ax, ay, az], [bx, by, bz]) {
  return [ax - bx, ay - by, az - bz];
}

/**
 * Rotación de `angulo` radianes alrededor de `eje` (Rodrigues).
 *
 * Eje libre y no tres ángulos de Euler: una pose se declara «este codo gira
 * tanto alrededor de este eje», que es como se piensa al montarla a mano, y de
 * paso no hay orden de ejes que memorizar ni bloqueo de cardán que explicar.
 */
function rotacion(eje, angulo) {
  const largo = Math.hypot(eje[0], eje[1], eje[2]);
  if (largo === 0) return identidad();
  const [x, y, z] = [eje[0] / largo, eje[1] / largo, eje[2] / largo];
  const c = Math.cos(angulo);
  const s = Math.sin(angulo);
  const u = 1 - c;
  return {
    r: [
      c + x * x * u, x * y * u - z * s, x * z * u + y * s,
      y * x * u + z * s, c + y * y * u, y * z * u - x * s,
      z * x * u - y * s, z * y * u + x * s, c + z * z * u,
    ],
    t: [0, 0, 0],
  };
}

/* ---- el rig ---------------------------------------------------------------- */

/**
 * Declara un esqueleto.
 *
 * Un hueso es `{id, padre?, cabeza}`: `cabeza` es su origen en el espacio de la
 * malla EN REPOSO, y `padre` el id de quien lo arrastra. Un hueso sin padre es
 * raíz. El orden de la lista no importa —se resuelve la jerarquía— pero un ciclo
 * o un padre inexistente son error, no un rig a medias: un esqueleto roto
 * deforma la malla a un amasijo y el fallo se ve tres capas más abajo.
 *
 * @param {Array<{id:string, padre?:string, cabeza:number[]}>} huesos
 * @returns {{huesos:Array, indice:Map, orden:number[]}} rig congelado.
 */
export function crearRig(huesos) {
  if (!Array.isArray(huesos) || huesos.length === 0) {
    fallo("rig_vacio", "$", "un rig necesita al menos un hueso");
  }
  if (huesos.length > MAX_HUESOS) fallo("demasiados_huesos", "$", `máximo ${MAX_HUESOS} huesos`);

  const porId = new Map();
  huesos.forEach((hueso, i) => {
    const path = `huesos[${i}]`;
    if (typeof hueso?.id !== "string" || hueso.id.length === 0) {
      fallo("id_invalido", `${path}.id`, "cada hueso necesita un id");
    }
    if (porId.has(hueso.id)) fallo("id_duplicado", `${path}.id`, "id repetido");
    if (!esPunto(hueso.cabeza)) fallo("cabeza_invalida", `${path}.cabeza`, "debe ser [x, y, z] finito");
    porId.set(hueso.id, i);
  });

  huesos.forEach((hueso, i) => {
    if (hueso.padre === undefined || hueso.padre === null) return;
    if (!porId.has(hueso.padre)) {
      fallo("padre_inexistente", `huesos[${i}].padre`, `no existe el hueso "${hueso.padre}"`);
    }
    if (hueso.padre === hueso.id) fallo("ciclo", `huesos[${i}].padre`, "un hueso no puede ser su propio padre");
  });

  // Orden de padres antes que hijos, resuelto una vez: la pose se evalúa muchas
  // veces (una por fotograma si algún día esto anima) y recorrer la jerarquía
  // en cada evaluación sería pagar el mismo recorrido para siempre.
  const orden = [];
  const estado = new Array(huesos.length).fill(0); // 0 sin ver, 1 en curso, 2 listo
  const visitar = (i) => {
    if (estado[i] === 2) return;
    if (estado[i] === 1) fallo("ciclo", `huesos[${i}].padre`, "la jerarquía tiene un ciclo");
    estado[i] = 1;
    const padre = huesos[i].padre;
    if (padre !== undefined && padre !== null) visitar(porId.get(padre));
    estado[i] = 2;
    orden.push(i);
  };
  huesos.forEach((_, i) => visitar(i));

  return Object.freeze({
    huesos: Object.freeze(huesos.map((hueso) => Object.freeze({
      id: hueso.id,
      padre: hueso.padre ?? null,
      cabeza: Object.freeze([...hueso.cabeza]),
    }))),
    indice: porId,
    orden: Object.freeze(orden),
  });
}

/**
 * Las matrices de piel de una pose, una por hueso.
 *
 * Una pose es `{[idHueso]: {eje, angulo, desplazamiento?}}`, y lo que no se
 * nombra se queda en reposo. Eso importa más de lo que parece: una pose parcial
 * —«solo el codo»— tiene que ser declarable sin escribir el esqueleto entero,
 * porque si no, cada pose nueva es una copia del rig y todas envejecen juntas.
 */
export function matricesDePose(rig, pose = {}) {
  const mundo = new Array(rig.huesos.length);
  for (const i of rig.orden) {
    const hueso = rig.huesos[i];
    const padre = hueso.padre === null ? null : rig.indice.get(hueso.padre);
    const base = padre === null ? identidad() : mundo[padre];
    const cabezaPadre = padre === null ? [0, 0, 0] : rig.huesos[padre].cabeza;
    const giro = pose[hueso.id];
    const local = giro?.eje && Number.isFinite(giro.angulo)
      ? rotacion(giro.eje, giro.angulo)
      : identidad();
    if (giro?.desplazamiento) {
      if (!esPunto(giro.desplazamiento)) {
        fallo("pose_invalida", `pose.${hueso.id}.desplazamiento`, "debe ser [x, y, z] finito");
      }
      local.t = [...giro.desplazamiento];
    }
    // Traslación hasta la cabeza del hueso RESPECTO A SU PADRE, y después el
    // giro local: girar en el origen de la malla en vez de en el del hueso es
    // el error clásico que manda el brazo entero al otro lado de la sala.
    const offset = { r: identidad().r, t: restar(hueso.cabeza, cabezaPadre) };
    mundo[i] = componer(componer(base, offset), local);
  }
  // La matriz de piel lleva el vértice al origen de SU hueso (restar la cabeza
  // de reposo, que es la inversa exacta de un reposo solo-traslación) y lo sube
  // por la cadena ya posada.
  return mundo.map((m, i) => ({ m, cabeza: rig.huesos[i].cabeza }));
}

/* ---- los pesos ------------------------------------------------------------- */

/**
 * Normaliza y valida los pesos de una malla.
 *
 * `pesos[v]` es una lista de `{hueso, peso}` para el vértice `v`. Se exige que
 * TODO vértice tenga al menos una influencia: un vértice sin hueso se quedaría
 * clavado en su sitio mientras el resto se dobla, y el agujero resultante se
 * confunde con un fallo del rasterizador — que es donde se acabaría buscando.
 *
 * Los pesos se normalizan a suma 1 aquí y no en el bucle de deformación: es una
 * propiedad del binding, no de cada evaluación.
 */
export function normalizarPesos(rig, pesos, totalVertices) {
  if (!Array.isArray(pesos) || pesos.length !== totalVertices) {
    fallo("pesos_incompletos", "$.pesos", `debe haber una entrada por vértice (${totalVertices})`);
  }
  return Object.freeze(pesos.map((influencias, v) => {
    const path = `pesos[${v}]`;
    if (!Array.isArray(influencias) || influencias.length === 0) {
      fallo("vertice_sin_hueso", path, "todo vértice necesita al menos una influencia");
    }
    if (influencias.length > MAX_INFLUENCIAS) {
      fallo("demasiadas_influencias", path, `máximo ${MAX_INFLUENCIAS} huesos por vértice`);
    }
    let suma = 0;
    const limpias = influencias.map(({ hueso, peso }, j) => {
      if (!rig.indice.has(hueso)) {
        fallo("hueso_inexistente", `${path}[${j}].hueso`, `no existe el hueso "${hueso}"`);
      }
      if (!Number.isFinite(peso) || peso < 0) {
        fallo("peso_invalido", `${path}[${j}].peso`, "el peso debe ser un número no negativo");
      }
      suma += peso;
      return { indice: rig.indice.get(hueso), peso };
    });
    if (suma <= 0) fallo("peso_invalido", path, "los pesos de un vértice no pueden sumar cero");
    return Object.freeze(limpias.map(({ indice, peso }) => Object.freeze({ indice, peso: peso / suma })));
  }));
}

/* ---- la deformación -------------------------------------------------------- */

/**
 * Deforma una malla según una pose. Devuelve una malla nueva; la de entrada no
 * se toca —viene de `data/mallas/`, congelada y compartida por toda la escena.
 *
 * Es mezcla lineal de matrices (LBS), la misma que hacía el hardware de la época
 * que este motor imita: cada vértice se transforma por cada hueso que lo influye
 * y se promedia por peso. Con dos huesos y un ángulo grande, el codo pierde algo
 * de volumen —el «caramelo» clásico—; corregirlo es matriz dual o pesos mejores,
 * y ninguna de las dos cosas es de esta fase.
 *
 * @param {{vertices:number[][], caras:number[][]}} malla
 * @param {object} rig de `crearRig`.
 * @param {Array} pesos ya normalizados por `normalizarPesos`.
 * @param {object} [pose]
 */
export function deformarMalla(malla, rig, pesos, pose = {}) {
  const matrices = matricesDePose(rig, pose);
  const vertices = malla.vertices.map((vertice, v) => {
    const influencias = pesos[v];
    let [x, y, z] = [0, 0, 0];
    for (const { indice, peso } of influencias) {
      const { m, cabeza } = matrices[indice];
      const local = restar(vertice, cabeza);
      const [px, py, pz] = aplicar(m, local);
      x += px * peso;
      y += py * peso;
      z += pz * peso;
    }
    return [x, y, z];
  });
  // Las caras viajan TAL CUAL y se comparten con la malla de origen: deformar no
  // cambia la topología, y copiar miles de índices en cada pose sería pagar por
  // no cambiar nada.
  return { vertices, caras: malla.caras };
}

/** ¿Dónde queda la cabeza de cada hueso con esta pose? Sirve para colgar cosas
 *  de un hueso —un prop en la mano— sin volver a resolver la jerarquía fuera. */
export function posicionesDeHuesos(rig, pose = {}) {
  const matrices = matricesDePose(rig, pose);
  return rig.huesos.map((hueso, i) => ({ id: hueso.id, punto: aplicar(matrices[i].m, [0, 0, 0]) }));
}
