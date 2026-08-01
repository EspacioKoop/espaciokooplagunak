// Token de propuesta consumible: el modo B de la asistencia (#309).
//
// EL MURO DE DISEÑO, en una frase: el minijuego vive en Foundry y NO EMITE NADA.
// Un éxito solo produce este token efímero, y quien lo gasta es el TITULAR del
// puesto asistido, como una de SUS órdenes ya autorizadas, bajo su identidad
// autenticada (relé #237). El ayudante nunca gana derechos de emisión sobre un
// puesto que no ocupa; si los ganara, habría dos autoridades sobre la verdad de
// la nave y eso lo prohíbe ADR-0002 aunque compile.
//
// Regla invariable que este módulo hace cumplir con código, no con prosa:
// «ayudar» no puede hacer nada que el puesto asistido no pudiera pedir por sí
// mismo. Ni siquiera el crítico abre un rango nuevo: el grado de éxito elige
// DÓNDE dentro de un rango ya autorizado.
//
// Puro: ni flags, ni sockets, ni reloj propio (`ahora` entra como parámetro).

import { BANDAS, bandaEsFavorable } from "./bandas.mjs";
import { STATION_ACTIONS } from "../station-actions.mjs";

export const PROPUESTA_ERRORES = Object.freeze({
  BANDA_SIN_FRUTO: "banda-sin-fruto",
  CADUCADA: "caducada",
  NO_ES_TITULAR: "no-es-titular",
  ACCION_NO_AUTORIZADA: "accion-no-autorizada",
  PRESUPUESTO_AGOTADO: "presupuesto-agotado",
  YA_ASISTE: "ya-asiste",
  YA_CONSUMIDA: "ya-consumida",
  ACCION_SIN_MARGEN: "accion-sin-margen",
  /**
   * El titular emitió UNA acción y la propuesta era para OTRA. La ayuda no se
   * aplica y su orden sale intacta: ver `consumirPropuesta`.
   */
  ACCION_DISTINTA: "accion-distinta",
  PARAMETRO_INVALIDO: "parametro-invalido",
  /**
   * No hay lectura actual del puesto desde la que medir el trayecto. Distinto de
   * un parámetro inválido: aquí no falla nadie, es que la telemetría todavía no
   * está conectada. La orden sale intacta y la propuesta se conserva.
   */
  SIN_LECTURA: "sin-lectura",
});

/**
 * Parámetro que el tier puede modelar, por acción, con el rango que el puente
 * YA autoriza (`bridge/command_models.py`). Es una envolvente, no la autoridad:
 * el puente revalida y el juego recorta por su cuenta.
 *
 * Una acción ausente aquí NO PUEDE producir propuesta. Es deliberado: sin un
 * parámetro continuo donde colocar el tier, «éxito» y «crítico» darían
 * exactamente la misma orden y el grado de éxito sería decorado. `set_shields`
 * es booleana y `set_target_heading` es circular —a mitad de camino entre dos
 * rumbos no hay «menos ayuda», hay otro rumbo—, así que ambas quedan fuera de
 * este corte en vez de prometer un efecto que no existe.
 */
export const PARAMETRO_POR_ACCION = Object.freeze({
  set_impulse: Object.freeze({ campo: "value", rango: Object.freeze([-1, 1]) }),
  set_warp: Object.freeze({ campo: "level", rango: Object.freeze([0, 4]), entero: true }),
  set_system_power: Object.freeze({ campo: "level", rango: Object.freeze([0, 3]) }),
  set_system_coolant: Object.freeze({ campo: "level", rango: Object.freeze([0, 10]) }),
});

/**
 * Presupuesto de asistencia concurrente. Permitir que media tripulación ayude a
 * la vez al mismo puesto genera efectos imposibles de equilibrar e incentiva el
 * «todos ayudan siempre al ingeniero». Un asistente activo por puesto y ventana.
 */
export const PRESUPUESTO_POR_DEFECTO = Object.freeze({
  asistentesPorPuesto: 1,
  vigenciaMs: 120_000,
});

/** Tier dentro del rango YA autorizado. El crítico sube de tier, no de rango. */
export const TIERS = Object.freeze({ BAJO: "bajo", ALTO: "alto" });

export function tierDeBanda(banda) {
  if (banda === BANDAS.CRITICO) return TIERS.ALTO;
  if (banda === BANDAS.EXITO) return TIERS.BAJO;
  return null;
}

function propuestasVivas(propuestas, puesto, ahora) {
  return (propuestas ?? []).filter(
    (p) => p.puestoAsistido === puesto && propuestaVigente(p, ahora),
  );
}

/** ¿Cabe una asistencia más a este puesto ahora mismo? */
export function puedeAsistir({
  puestoAsistido,
  asistenteId,
  propuestas = [],
  ahora = Date.now(),
  presupuesto = PRESUPUESTO_POR_DEFECTO,
}) {
  const vivas = propuestasVivas(propuestas, puestoAsistido, ahora);
  if (vivas.some((p) => p.asistenteId === asistenteId)) {
    return { ok: false, error: PROPUESTA_ERRORES.YA_ASISTE };
  }
  if (vivas.length >= presupuesto.asistentesPorPuesto) {
    return { ok: false, error: PROPUESTA_ERRORES.PRESUPUESTO_AGOTADO };
  }
  return { ok: true };
}

/**
 * Crea el token a partir de la banda. Fallo y pifia no dejan token: la ayuda es
 * un bonus, y su ausencia nunca puede bloquear una orden que el titular ya podía
 * dar por sí mismo (la asistencia es sal, no peaje).
 *
 * Registra `asistenteId` aparte de quien luego emita, para que al cerrar una
 * crisis siga estando claro quién decidió y quién prestó apoyo.
 */
export function crearPropuesta({
  tareaId,
  puestoAsistido,
  accion,
  banda,
  asistenteId,
  nonce,
  ahora = Date.now(),
  vigenciaMs = PRESUPUESTO_POR_DEFECTO.vigenciaMs,
}) {
  if (!asistenteId) throw new TypeError("crearPropuesta requiere asistenteId");
  if (!nonce) throw new TypeError("crearPropuesta requiere nonce");
  if (!bandaEsFavorable(banda)) {
    return { ok: false, error: PROPUESTA_ERRORES.BANDA_SIN_FRUTO };
  }
  const permitidas = STATION_ACTIONS[puestoAsistido] ?? [];
  if (!permitidas.includes(accion)) {
    return { ok: false, error: PROPUESTA_ERRORES.ACCION_NO_AUTORIZADA };
  }
  if (!PARAMETRO_POR_ACCION[accion]) {
    return { ok: false, error: PROPUESTA_ERRORES.ACCION_SIN_MARGEN };
  }
  return {
    ok: true,
    propuesta: Object.freeze({
      tareaId,
      puestoAsistido,
      accion,
      banda,
      tier: tierDeBanda(banda),
      asistenteId,
      nonce,
      creadaEn: ahora,
      caducaEn: ahora + vigenciaMs,
    }),
  };
}

export function propuestaVigente(propuesta, ahora = Date.now()) {
  return Boolean(propuesta) && ahora < propuesta.caducaEn;
}

/**
 * Lectura numérica o nada, sin pasar por `Number()` a pelo.
 *
 * `Number(null)` es `0` y `Number("")` también: coerción directa, una ausencia de
 * telemetría se convertía en «el reactor está a cero» y la ayuda arrastraba la
 * orden del titular HACIA ABAJO desde un número que nadie había leído. La
 * ausencia tiene que ser reconocible ANTES de tocar aritmética, así que aquí se
 * distingue en el tipo y no en el valor resultante.
 */
function lecturaNumerica(valor) {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "boolean") return null;
  if (typeof valor === "string" && valor.trim() === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

/**
 * Acota un valor propuesto al rango que la orden YA permitía, eligiendo el tramo
 * según el tier. `rango` es [min, max] del propio contrato del puente; el tier
 * bajo se queda en la mitad inferior del margen de ayuda y el alto llega al tope
 * de ese margen — nunca por encima del máximo autorizado.
 */
export function acotarPorTier({ base, objetivo, rango, tier, entero = false }) {
  const [min, max] = rango;
  const acotar = (v) => Math.min(max, Math.max(min, v));
  const desde = acotar(Number(base));
  const hasta = acotar(Number(objetivo));
  const fraccion = tier === TIERS.ALTO ? 1 : 0.5;
  const valor = acotar(desde + (hasta - desde) * fraccion);
  // Un warp 2.5 no existe: redondear hacia la base es lo conservador —el tier
  // bajo nunca se pasa del alto por un redondeo.
  if (!entero) return valor;
  return hasta >= desde ? Math.floor(valor) : Math.ceil(valor);
}

/**
 * El titular gasta la propuesta. Devuelve la orden lista para `buildStationOrder`
 * —el mismo camino que cualquier orden suya—, o el motivo del rechazo.
 *
 * `emisorPuesto` DEBE venir resuelto por la identidad autenticada del emisor (el
 * relé lo saca de `userDoc.id`), nunca de un campo declarado por el cliente.
 */
/**
 * @param {object} entrada
 *   - `accion`: la acción que el TITULAR está emitiendo. Obligatoria: sin ella
 *     no se puede saber si la ayuda es para lo que se está pidiendo.
 */
export function consumirPropuesta({
  propuesta,
  emisorId,
  emisorPuesto,
  accion,
  params = {},
  base,
  consumidos = [],
  ahora = Date.now(),
}) {
  if (!propuestaVigente(propuesta, ahora)) {
    return { ok: false, error: PROPUESTA_ERRORES.CADUCADA };
  }
  // Antes que nada, el replay: una propuesta gastada no vuelve a servir aunque
  // le queden 119 segundos de vigencia. Sin esto, un único éxito autorizaría
  // órdenes ilimitadas durante toda la ventana y «consumible» sería una palabra.
  if (consumidos.includes(propuesta.nonce)) {
    return { ok: false, error: PROPUESTA_ERRORES.YA_CONSUMIDA, consumidos };
  }
  if (!emisorId || emisorPuesto !== propuesta.puestoAsistido) {
    return { ok: false, error: PROPUESTA_ERRORES.NO_ES_TITULAR };
  }
  // La ayuda es para UNA acción concreta y no para el puesto entero. Sin esta
  // comprobación, una propuesta de refrigerante se gastaba en una orden de
  // potencia y la salida llevaba la acción de la PROPUESTA: la decisión que el
  // titular había autenticado se convertía en otra distinta, y encima con
  // parámetros validados contra el margen de una acción que no era la suya.
  // Ambas están autorizadas para ingeniería, así que ningún otro control lo
  // habría detenido.
  if (accion !== propuesta.accion) {
    return { ok: false, error: PROPUESTA_ERRORES.ACCION_DISTINTA };
  }
  const permitidas = STATION_ACTIONS[emisorPuesto] ?? [];
  if (!permitidas.includes(propuesta.accion)) {
    return { ok: false, error: PROPUESTA_ERRORES.ACCION_NO_AUTORIZADA };
  }
  const spec = PARAMETRO_POR_ACCION[propuesta.accion];
  if (!spec) {
    return { ok: false, error: PROPUESTA_ERRORES.ACCION_SIN_MARGEN };
  }
  // El tier no es una etiqueta en el crédito: decide DÓNDE, dentro del rango
  // que la orden ya permitía, cae el parámetro. Por eso hace falta la lectura
  // actual del puesto: la ayuda mueve desde donde está la nave hacia lo pedido,
  // y el tier bajo se queda a mitad de ese trayecto.
  const objetivo = lecturaNumerica(params?.[spec.campo]);
  if (objetivo === null) {
    return { ok: false, error: PROPUESTA_ERRORES.PARAMETRO_INVALIDO };
  }
  // Sin lectura autoritativa no se inventa el punto de partida. Salir por aquí
  // deja la orden del titular tal cual la mandó Y no gasta la propuesta: quien
  // ayudó no pierde su éxito porque la telemetría no estuviera conectada, y sobre
  // todo la ayuda nunca puede EMPEORAR una orden que se podía dar sin ella.
  const desde = lecturaNumerica(base);
  if (desde === null) {
    return { ok: false, error: PROPUESTA_ERRORES.SIN_LECTURA };
  }
  const valor = acotarPorTier({
    base: desde,
    objetivo,
    rango: spec.rango,
    tier: propuesta.tier,
    entero: spec.entero === true,
  });
  return {
    ok: true,
    orden: { action: propuesta.accion, params: { ...params, [spec.campo]: valor } },
    // Estado puro: quien llame guarda esto y lo vuelve a pasar. Ni Set mutable
    // ni flag escondido, para que el rechazo del segundo consumo sea probable
    // sin Foundry delante.
    consumidos: Object.freeze([...consumidos, propuesta.nonce]),
    // Quién apoyó y quién decidió, por separado: la ayuda amplifica al
    // especialista, no diluye la identidad del puesto.
    credito: Object.freeze({
      asistenteId: propuesta.asistenteId,
      emisorId,
      banda: propuesta.banda,
      tier: propuesta.tier,
      tareaId: propuesta.tareaId,
    }),
  };
}
