// El repertorio de tareas de asistencia (#309).
//
// Hasta aquí, #309 tenía un motor entero —bandas, enfoques, probabilidad,
// propuesta, temporización, sesión, relevo— y **nada que servirle**. `abrir`
// recibe una `tarea` y `despacharPeticion` recibe un `buscarTarea`, pero ningún
// archivo del módulo declaraba ni una. Esto es esa declaración.
//
// ## Por qué es contenido y no lógica
//
// El diseño lo dice y conviene no discutirlo aquí: «el repertorio de tareas y
// sus enfoques es contenido de escenario/tabla, no lógica fija». Lo que este
// archivo aporta es el repertorio BASE con el que se puede jugar sin escribir
// nada, y la puerta para sustituirlo o ampliarlo desde un escenario. Añadir una
// tarea nueva no debe tocar ningún motor; si algún día hace falta tocarlo, la
// tarea está pidiendo una mecánica, no contenido, y eso es otro issue.
//
// ## El reto es del TIPO de habilidad, el puesto es el contexto
//
// De ahí que las tres tareas base compartan clase de enfoque en vez de tener
// cada una su mecánica: quien aprende a leer el rango de éxito ayudando a
// ingeniería lo sabe leer ayudando a pilotaje, y lo que cambia es la ficción.
// Rehacer la mecánica por puesto daría tres ayudas que se sienten iguales y
// cuestan el triple de mantener.
//
// ## Dos de las tres no mueven la nave, y es a propósito
//
// Solo `navigation`, `engineering` y `weapons` están en la matriz de autoridad
// (#268), así que solo ellos tienen una orden que prestar. Sensores no la tiene:
// su tarea sale en modo NARRATIVO —el fruto lo adjudica el GM en la mesa— y el
// reductor la rechaza a propósito en vez de inventarle un efecto. No es una
// tarea a medio hacer; es la otra mitad legítima del diseño.
//
// Puro: ni Foundry, ni DOM, ni red. Se valida al cargar y no en mesa.

import { BANDAS } from "./bandas.mjs";
import { CLASES_ENFOQUE, validarTarea } from "./enfoques.mjs";

/**
 * Las tareas base. Congeladas y validadas al final del archivo: una tarea mal
 * declarada revienta al importar el módulo, no cuando alguien intente ayudar en
 * mitad de una crisis.
 *
 * Los identificadores son estables porque viajan dentro de la petición del
 * asistente y quedan escritos en la propuesta: renombrar uno rompe las ayudas
 * vivas de una partida en curso.
 */
const BASE = [
  {
    // La rebanada mínima que nombró el pase de diseño: ingeniería, un sistema
    // caliente y el refrigerante que el ingeniero ya podía repartir por sí solo.
    id: "estabilizar-sistema-caliente",
    puestoAsistido: "engineering",
    accionPropuesta: "set_system_coolant",
    dificultad: 13,
    enfoques: [
      // (a) Reparar en caliente: el juego de herramientas de la ficha. Es el
      // enfoque que no gasta nada y por eso el que siempre está disponible.
      { id: "reparar-en-caliente", clase: CLASES_ENFOQUE.PRUEBA, cd: 13 },
      // (a) Recalcular márgenes: Arcana o Naturaleza. CD más alta porque es la
      // vía del que no sabe de máquinas y lo suple con teoría.
      { id: "recalcular-margenes", clase: CLASES_ENFOQUE.PRUEBA, cd: 15 },
      // (c) Reparar como conjuro: no hay a quién atacar ni CD que superar, así
      // que entra sin tirada, con banda fija y gastando recurso de verdad. Nunca
      // es crítico —el motor lo prohíbe— porque un efecto garantizado no compra
      // además el tramo alto: pagar un espacio no debe ser mejor que jugarlo.
      {
        id: "reparar-conjuro",
        clase: CLASES_ENFOQUE.SIN_TIRADA,
        bandaFija: BANDAS.EXITO,
        coste: { espacio: 1 },
      },
    ],
  },
  {
    // Pilotaje: el impulso es continuo, así que el grado de éxito tiene dónde
    // colocarse. El rumbo NO —a mitad de camino entre dos rumbos no hay «menos
    // ayuda», hay otro rumbo—, y por eso la ayuda al piloto es de cadencia y no
    // de dirección.
    id: "bordar-maniobra",
    puestoAsistido: "navigation",
    accionPropuesta: "set_impulse",
    dificultad: 13,
    // Cadencia es memoria de orden tanto como precisión de instante: la
    // secuencia encaja mejor que la temporización con lo que la ficción ya
    // describe (#500 amplía el repertorio de minijuegos de destreza).
    minijuegoDestreza: "secuencia",
    enfoques: [
      // (a) Coordinar la cadencia: Interpretación o Acrobacias. Cantar el ritmo
      // de la maniobra es ayudar sin tocar los mandos, que es exactamente lo que
      // «asistir» significa aquí.
      { id: "coordinar-cadencia", clase: CLASES_ENFOQUE.PRUEBA, cd: 13 },
      // (a) Leer la deriva: Percepción. Misma clase, otra ficción y otra hoja
      // que la aprovecha — de eso va ofrecer más de un enfoque.
      { id: "leer-deriva", clase: CLASES_ENFOQUE.PRUEBA, cd: 14 },
    ],
  },
  {
    // Deliberadamente NARRATIVA (no una limitación de la matriz de autoridad:
    // desde #462 sensores sí tiene una orden real, `scan_object`). Afinar un
    // contacto dudoso no es "pulsar escanear otra vez" — el fruto lo adjudica
    // el GM sobre la lectura ya hecha, y el reductor la rechaza con
    // `MODO_NARRATIVO` a propósito, para no fingir que ayudar aquí mueve un
    // dato mecánico que en realidad no existe.
    id: "afinar-contacto-dudoso",
    puestoAsistido: "sensors",
    accionPropuesta: null,
    dificultad: 13,
    enfoques: [
      { id: "leer-el-patron", clase: CLASES_ENFOQUE.PRUEBA, cd: 13 },
      { id: "corazonada", clase: CLASES_ENFOQUE.PRUEBA, cd: 15 },
    ],
  },
];

/**
 * Construye un catálogo consultable. Recibe las tareas ya validadas y devuelve
 * la función que `despacharPeticion` pide como `buscarTarea`, más la lista para
 * pintar el menú.
 *
 * Se construye en vez de exportarse un objeto suelto para que una mesa pueda
 * tener el suyo —`crearCatalogo([...BASE, ...mias])`— sin que el motor se entere
 * de que existe más de uno.
 */
export function crearCatalogo(tareas = BASE) {
  const validadas = tareas.map(validarTarea);
  const porId = new Map(validadas.map((tarea) => [tarea.id, tarea]));
  if (porId.size !== validadas.length) {
    throw new TypeError("crearCatalogo: hay dos tareas con el mismo id");
  }
  return Object.freeze({
    tareas: Object.freeze(validadas),
    /** La tarea, o `null` si nadie la declaró. Nunca lanza: el relevo ya sabe
     *  responder `TAREA_DESCONOCIDA` y un catálogo que revienta convertiría una
     *  petición inventada en un error de consola del GM. */
    buscar: (id) => porId.get(id) ?? null,
    /** Lo que se le puede ofrecer a quien quiere ayudar a un puesto concreto. */
    paraPuesto: (puesto) => validadas.filter((tarea) => tarea.puestoAsistido === puesto),
  });
}

/** El catálogo base, ya validado. Importarlo es la comprobación. */
export const CATALOGO_BASE = crearCatalogo();

/** Las tareas base sin validar, para quien quiera partir de ellas y añadir. */
export const TAREAS_BASE = Object.freeze(BASE.map((tarea) => Object.freeze({ ...tarea })));
