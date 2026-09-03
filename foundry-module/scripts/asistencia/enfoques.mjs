// Tareas de asistencia y sus enfoques (#309).
//
// Una TAREA de asistencia («estabilizar un sistema caliente») declara a qué
// puesto ayuda, qué orden YA AUTORIZADA de ese puesto podría proponerse, y un
// puñado de ENFOQUES: las distintas maneras de intentarlo. El repertorio es
// contenido de mesa, no lógica fija: el reto representa un TIPO de habilidad y
// el puesto solo cambia el contexto narrativo.
//
// Cada enfoque declara su CLASE de resolución, y la clase fija quién tira, si
// hay recurso que gastar y cómo se produce la banda. Un enfoque que no encaje en
// ninguna de las tres NO es declarable: no hay cuarta vía improvisada. Meter un
// hechizo sin tirada en un `d20 vs CD` sería vender como 5e algo que 5e no dice.
//
// Puro: valida y filtra declaraciones. No tira dados ni toca la ficha.

import { BANDAS } from "./bandas.mjs";
import { STATION_ACTIONS } from "../station-actions.mjs";
import { TIPOS_HABILIDAD } from "./ficha-dnd5e.mjs";

/** Las tres clases de enfoque del contrato. No hay más. */
export const CLASES_ENFOQUE = Object.freeze({
  /** (a) prueba de habilidad o de herramienta: tira el ayudante contra una CD. */
  PRUEBA: "prueba",
  /** (b) ataque de conjuro o salvación: exige objetivo declarado por la tarea. */
  TIRADA_CONTRA_OBJETIVO: "tirada-contra-objetivo",
  /** (c) uso sin tirada: banda fija; nadie tira. */
  SIN_TIRADA: "sin-tirada",
});

/** Modos de «ayudar». Solo existen estos dos (ADR-0002). */
export const MODOS = Object.freeze({
  /** Color y tensión; el fruto lo adjudica el GM. Cero efecto en la simulación. */
  NARRATIVO: "narrativo",
  /** Token que el TITULAR del puesto gasta como una de SUS órdenes autorizadas. */
  PROPUESTA: "propuesta",
});

/**
 * Minijuegos de destreza disponibles para el camino sin dnd5e (o sin ficha).
 * Una tarea declara cuál usa; sin declararlo, se asume temporización, que fue
 * el primero y el que ya conocen las mesas existentes (#500 amplía el
 * repertorio, no lo sustituye).
 */
export const MINIJUEGOS_DESTREZA = Object.freeze([
  "temporizacion",
  "secuencia",
  "precision",
  "puzzle",
]);

export const ASISTENCIA_ERRORES = Object.freeze({
  TAREA_INVALIDA: "tarea-invalida",
  CLASE_DESCONOCIDA: "clase-desconocida",
  SIN_CD: "sin-cd",
  SIN_OBJETIVO: "sin-objetivo",
  SIN_BANDA_FIJA: "sin-banda-fija",
  BANDA_FIJA_CRITICA: "banda-fija-critica",
  ACCION_NO_AUTORIZADA: "accion-no-autorizada",
  HABILIDAD_DESCONOCIDA: "habilidad-desconocida",
  MINIJUEGO_DESCONOCIDO: "minijuego-desconocido",
});

export class AsistenciaError extends Error {
  constructor(codigo, mensaje) {
    super(mensaje ?? codigo);
    this.name = "AsistenciaError";
    this.codigo = codigo;
  }
}

function fallar(codigo, mensaje) {
  throw new AsistenciaError(codigo, mensaje);
}

/**
 * ¿Puede esta tarea rendir en modo propuesta? Solo si el puesto asistido tiene
 * vía de control (está en la matriz de autoridad) y la orden propuesta es una de
 * las suyas. Capitán, sensores y comunicaciones pueden asistir, pero su ayuda
 * solo rinde en modo narrativo: no hay orden que prestarles.
 */
export function modoDeTarea(tarea) {
  const permitidas = STATION_ACTIONS[tarea?.puestoAsistido] ?? null;
  if (!permitidas || !tarea?.accionPropuesta) return MODOS.NARRATIVO;
  if (!permitidas.includes(tarea.accionPropuesta)) {
    fallar(
      ASISTENCIA_ERRORES.ACCION_NO_AUTORIZADA,
      `${tarea.puestoAsistido} no puede emitir ${tarea.accionPropuesta}`,
    );
  }
  return MODOS.PROPUESTA;
}

/**
 * ¿Puede una orden de mando mejorar esta tarea?
 *
 * Solo se llama con tareas que ya atravesaron `validarTarea`: leer su modo
 * validado mantiene una única frontera para UI y autoridad GM, sin deducir otra
 * lista de puestos ni confundir una tarea narrativa visible con una asistencia
 * que el reductor pueda abrir.
 */
export function esTareaDePropuesta(tarea) {
  return tarea?.modo === MODOS.PROPUESTA;
}

/**
 * Valida un enfoque contra su clase. Devuelve el enfoque normalizado.
 *
 * `tarea` entra porque la clase (b) SOLO es declarable si la tarea define un
 * objetivo concreto (con CA, o que haga la salvación). Estabilizar un sistema o
 * leer un contacto no tienen a quién atacar: ahí el hechizo entra por (c), o no
 * entra.
 */
export function validarEnfoque(enfoque, tarea = {}) {
  if (!enfoque?.id) fallar(ASISTENCIA_ERRORES.TAREA_INVALIDA, "enfoque sin id");
  const clase = enfoque.clase;
  const coste = enfoque.coste ?? null;
  // `habilidad` es opcional (#500): sin ella, el rango de éxito se calcula con
  // modificador 0, como antes de leer la ficha. Si SE declara, tiene que
  // apuntar a un tipo real de entrada de la ficha — un prefijo inventado no se
  // detectaría hasta que alguien intentara ayudar y el modificador saliera
  // silenciosamente en 0, que es peor que fallar al cargar.
  if (enfoque.habilidad != null) {
    const tipo = String(enfoque.habilidad).split(":")[0];
    if (!TIPOS_HABILIDAD.includes(tipo)) {
      fallar(
        ASISTENCIA_ERRORES.HABILIDAD_DESCONOCIDA,
        `${enfoque.id}: habilidad «${enfoque.habilidad}» no empieza por ${TIPOS_HABILIDAD.map((t) => `${t}:`).join("/")}`,
      );
    }
  }
  switch (clase) {
    case CLASES_ENFOQUE.PRUEBA: {
      if (!Number.isFinite(Number(enfoque.cd))) {
        fallar(ASISTENCIA_ERRORES.SIN_CD, `${enfoque.id}: la clase (a) exige CD`);
      }
      break;
    }
    case CLASES_ENFOQUE.TIRADA_CONTRA_OBJETIVO: {
      const objetivo = tarea.objetivo ?? null;
      const tieneCa = Number.isFinite(Number(objetivo?.ca));
      const tieneSalvacion = Boolean(objetivo?.salvacion);
      if (!objetivo || (!tieneCa && !tieneSalvacion)) {
        fallar(
          ASISTENCIA_ERRORES.SIN_OBJETIVO,
          `${enfoque.id}: la clase (b) exige un objetivo con CA o salvación`,
        );
      }
      break;
    }
    case CLASES_ENFOQUE.SIN_TIRADA: {
      if (!enfoque.bandaFija) {
        fallar(ASISTENCIA_ERRORES.SIN_BANDA_FIJA, `${enfoque.id}: la clase (c) exige banda fija`);
      }
      // Un efecto garantizado no compra además el tier alto.
      if (enfoque.bandaFija === BANDAS.CRITICO) {
        fallar(ASISTENCIA_ERRORES.BANDA_FIJA_CRITICA, `${enfoque.id}: (c) nunca es crítico`);
      }
      break;
    }
    default:
      fallar(ASISTENCIA_ERRORES.CLASE_DESCONOCIDA, `${enfoque.id}: clase «${clase}» no existe`);
  }
  return Object.freeze({ ...enfoque, coste });
}

/** Valida la tarea entera y la congela. Falla pronto: mejor en carga que en mesa. */
export function validarTarea(tarea) {
  if (!tarea?.id) fallar(ASISTENCIA_ERRORES.TAREA_INVALIDA, "tarea sin id");
  if (!Array.isArray(tarea.enfoques) || tarea.enfoques.length === 0) {
    fallar(ASISTENCIA_ERRORES.TAREA_INVALIDA, `${tarea.id}: sin enfoques`);
  }
  if (tarea.minijuegoDestreza != null && !MINIJUEGOS_DESTREZA.includes(tarea.minijuegoDestreza)) {
    fallar(
      ASISTENCIA_ERRORES.MINIJUEGO_DESCONOCIDO,
      `${tarea.id}: minijuego de destreza «${tarea.minijuegoDestreza}» no existe`,
    );
  }
  const modo = modoDeTarea(tarea);
  const enfoques = tarea.enfoques.map((e) => validarEnfoque(e, tarea));
  return Object.freeze({ ...tarea, modo, enfoques: Object.freeze(enfoques) });
}

/** ¿Este enfoque gasta un recurso real de la ficha (espacio de conjuro, uso)? */
export function gastaRecurso(enfoque) {
  return Boolean(enfoque?.coste);
}

/**
 * Qué se le puede ofrecer al ayudante aquí y ahora.
 *
 * - Sin ficha (o sin sistema de juego que la entienda): se degrada al minijuego
 *   de destreza, que produce las MISMAS bandas. La clase (a) es la única que
 *   podría existir sin hoja, y sin modificador no hay tirada que ofrecer.
 * - Los enfoques con coste solo aparecen si el GM abrió esa vía: gastar un
 *   espacio de conjuro es un coste de campaña real, no efímero. El motor nunca
 *   fabrica recursos; como mucho consume los que el jugador ya tiene.
 */
export function resolucionDisponible({ tarea, tieneFicha = false, gmPermiteRecursos = false }) {
  const validada = validarTarea(tarea);
  if (!tieneFicha) return Object.freeze({ via: "destreza", enfoques: Object.freeze([]) });
  const enfoques = validada.enfoques.filter((e) => gmPermiteRecursos || !gastaRecurso(e));
  if (enfoques.length === 0) {
    return Object.freeze({ via: "destreza", enfoques: Object.freeze([]) });
  }
  return Object.freeze({ via: "habilidad", enfoques: Object.freeze(enfoques) });
}
