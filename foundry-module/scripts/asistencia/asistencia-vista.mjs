// Modelo de presentación de la ventana de asistencia (#309), hermano de
// `../minijuegos/dados-vista.mjs`. Traduce lo que YA decidió el motor —oferta,
// resultado, reto de temporización— en algo que una plantilla pueda pintar sin
// reimplementar ninguna regla. No decide bandas ni tiers: eso vive en
// `bandas.mjs`/`propuesta.mjs`, y esto solo presenta lo que ya salió de ahí.
//
// Puro: ni Foundry, ni DOM, ni reloj propio (`tMs` entra como parámetro, igual
// que en `temporizacion.mjs`). Se prueba desde Node.

import {
  BANDAS_ORDENADAS,
  aplicarReglaCasaNatural,
  bandaDesdeMargen,
  margenContraObjetivo,
  margenContraSalvacion,
} from "./bandas.mjs";
import { estadoEn, lecturaAccesible } from "./temporizacion.mjs";

/** Las fases de la ventana. Una sola a la vez; no hay estado compuesto. */
export const FASES = Object.freeze({
  LISTA: "lista",
  ESPERANDO: "esperando",
  OFERTA: "oferta",
  RETO: "reto",
  RESULTADO: "resultado",
  RECHAZO: "rechazo",
});

function claveTarea(id) {
  return `LAGUNAK.Asistencia.Tarea.${id}`;
}

function claveEnfoque(id) {
  return `LAGUNAK.Asistencia.Enfoque.${id}`;
}

/**
 * Las tareas que tiene sentido ofrecer: nunca la del propio puesto, porque
 * asistirse a uno mismo no es cooperación (`asistencia-wiring.mjs` lo rechaza
 * igual, esto solo evita enseñar un botón que el motor va a negar).
 */
export function tareasOfrecibles(tareas, puestoPropio) {
  return (tareas ?? []).map((tarea) => ({
    id: tarea.id,
    puesto: tarea.puestoAsistido,
    claveNombre: claveTarea(tarea.id),
    // Sensores no está en la matriz de autoridad (#268): su tarea es narrativa
    // y el modo propuesta no rinde nada. Se sigue enseñando —el GM adjudica el
    // fruto en mesa— pero marcada, para no prometer un token que no vendrá.
    narrativa: !tarea.accionPropuesta,
    propia: tarea.puestoAsistido === puestoPropio,
  }));
}

/** Un enfoque de la oferta (`sesion.abrir().oferta.enfoques[i]`), para pintar. */
function modeloEnfoque({ enfoque, rango }) {
  const base = {
    id: enfoque.id,
    claveNombre: claveEnfoque(enfoque.id),
    clase: enfoque.clase,
    coste: rango.coste ?? null,
    via: rango.via,
    quienTira: rango.quienTira,
  };
  if (rango.via === "banda-fija") {
    return { ...base, bandaFija: rango.bandaFija };
  }
  return {
    ...base,
    salvacion: rango.salvacion,
    dificultad: rango.dificultad,
    modificador: rango.modificador,
    reglaCasaNatural: Boolean(rango.reglaCasaNatural),
    favorable: rango.favorable,
    distribucion: BANDAS_ORDENADAS.map((banda) => ({
      banda,
      fraccion: rango.distribucion?.[banda] ?? 0,
    })),
  };
}

/** El reto de temporización, en el instante `tMs`. */
function modeloReto(reto, tMs) {
  const estado = estadoEn(reto, tMs);
  const lectura = lecturaAccesible(reto, tMs);
  return {
    posicion: estado.posicion,
    objetivo: estado.objetivo,
    tolerancia: estado.tolerancia,
    // El borde de la zona, no el centro: es lo que una barra necesita para
    // pintar el tramo entero de un solo elemento.
    zonaDesde: Math.max(0, estado.objetivo - estado.tolerancia),
    zonaHasta: Math.min(1, estado.objetivo + estado.tolerancia),
    expirado: estado.expirado,
    zona: lectura.zona,
    segundosRestantes: lectura.segundosRestantes,
  };
}

/**
 * Modelo completo de la ventana. Una sola fase manda; las demás claves de
 * detalle solo aparecen si la fase las necesita, para que la plantilla no
 * tenga que adivinar cuál mirar.
 */
export function asistenciaVista({
  tareas = [],
  puestoPropio = null,
  fase = FASES.LISTA,
  tareaId = null,
  oferta = null,
  reto = null,
  tMs = 0,
  resultado = null,
  rechazo = null,
} = {}) {
  const base = {
    fase,
    tareas: tareasOfrecibles(tareas, puestoPropio),
    tareaId,
  };
  if (fase === FASES.OFERTA && oferta) {
    return {
      ...base,
      oferta: {
        via: oferta.via,
        enfoques: (oferta.enfoques ?? []).map(modeloEnfoque),
      },
    };
  }
  if (fase === FASES.RETO && reto) {
    return { ...base, reto: modeloReto(reto, tMs) };
  }
  if (fase === FASES.RESULTADO && resultado) {
    return {
      ...base,
      resultado: {
        banda: resultado.propuesta?.banda ?? null,
        tier: resultado.propuesta?.tier ?? null,
      },
    };
  }
  if (fase === FASES.RECHAZO && rechazo) {
    return { ...base, rechazo: { codigo: rechazo.codigo } };
  }
  return base;
}

/**
 * Banda lograda por una tirada real de dnd5e, dado el rango que el motor ya
 * ofreció para ese enfoque (`rangoDeExito`, vía `sesion.abrir`).
 *
 * Vive aquí y no en `bandas.mjs` porque necesita `salvacion`/`dificultad`/
 * `reglaCasaNatural` ya resueltos por enfoque, y la ventana es quien los tiene
 * a mano tras recibir la oferta: `bandas.mjs` no conoce el enfoque, solo el
 * margen. Un enfoque de clase (c) no tira — su banda es la fija de la oferta.
 */
export function bandaDeTirada({ rango, total, natural = null }) {
  if (rango.via === "banda-fija") return rango.bandaFija;
  const margen = rango.salvacion
    ? margenContraSalvacion({ cdSalvacion: rango.dificultad, totalSalvacion: total })
    : margenContraObjetivo({ total, dificultad: rango.dificultad });
  const banda = bandaDesdeMargen({ margen, salvacion: rango.salvacion });
  // La regla de la casa nunca se aplica a una salvación (no es «su» natural):
  // misma frontera que en `probabilidad.mjs`.
  if (rango.salvacion) return banda;
  return aplicarReglaCasaNatural({ banda, natural, activa: rango.reglaCasaNatural });
}
