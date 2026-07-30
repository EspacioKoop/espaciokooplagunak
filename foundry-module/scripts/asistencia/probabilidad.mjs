// «Ver el rango de éxito» antes de comprometerse (#309).
//
// La decisión de qué enfoque usar debe ser táctica de personaje —«con mi Arcana
// +7 tengo buena banda; con Herramientas +2, no»— sin destripar el resultado,
// que sigue siendo una tirada real de dnd5e. Por eso la interfaz enseña, ANTES
// de tirar, la probabilidad de cada banda, y en claro la CD/CA y el modificador
// aplicado: nada de números mágicos.
//
// Dos avisos que este módulo hace explícitos porque la lectura intuitiva es la
// contraria:
// - En una salvación tira el OBJETIVO, y un éxito suyo es el FALLO del enfoque.
// - La clase (c) no tiene probabilidad que mostrar: enseñar un porcentaje ahí
//   sería inventar una tirada inexistente. Se devuelve la banda fija y ya.
//
// Puro: enumera las 20 caras del d20, no tira ninguna.

import {
  BANDAS,
  BANDAS_ORDENADAS,
  aplicarReglaCasaNatural,
  bandaDesdeMargen,
} from "./bandas.mjs";
import { CLASES_ENFOQUE } from "./enfoques.mjs";

const CARAS = 20;

function distribucionVacia() {
  return Object.fromEntries(BANDAS_ORDENADAS.map((b) => [b, 0]));
}

/**
 * Distribución de bandas de un `d20 + modificador` frente a un objetivo fijo.
 *
 * `salvacion` invierte el margen (tira el objetivo) y desplaza la frontera del
 * cero: igualar la CD ya es salvación superada, así que el margen 0 es fallo del
 * enfoque. `reglaCasaNatural` es la regla opcional de la casa, apagada de serie.
 */
export function distribucionBandas({
  modificador = 0,
  dificultad,
  salvacion = false,
  reglaCasaNatural = false,
}) {
  const conteo = distribucionVacia();
  for (let cara = 1; cara <= CARAS; cara += 1) {
    const total = cara + Math.trunc(Number(modificador) || 0);
    const margen = salvacion
      ? Math.trunc(Number(dificultad)) - total
      : total - Math.trunc(Number(dificultad));
    const base = bandaDesdeMargen({ margen, salvacion });
    // En salvación la regla de la casa la dispararía el natural del OBJETIVO, no
    // el del ayudante: no es «su» 20 y por eso no se aplica aquí.
    const banda = salvacion
      ? base
      : aplicarReglaCasaNatural({ banda: base, natural: cara, activa: reglaCasaNatural });
    conteo[banda] += 1;
  }
  return Object.freeze(
    Object.fromEntries(BANDAS_ORDENADAS.map((b) => [b, conteo[b] / CARAS])),
  );
}

/** Probabilidad de que el enfoque dé fruto (éxito o crítico). */
export function probabilidadFavorable(distribucion) {
  return (distribucion[BANDAS.EXITO] ?? 0) + (distribucion[BANDAS.CRITICO] ?? 0);
}

/**
 * Rango de éxito de un enfoque concreto, listo para pintar.
 *
 * Devuelve siempre `via` para que la interfaz sepa qué contar: `"probabilidad"`
 * (clases a y b) o `"banda-fija"` (clase c). Y `quienTira`, porque en salvación
 * no es el ayudante y hay que decirlo con esas palabras.
 */
export function rangoDeExito({ enfoque, tarea = {}, modificador = 0, reglaCasaNatural = false }) {
  switch (enfoque?.clase) {
    case CLASES_ENFOQUE.PRUEBA: {
      const dificultad = Math.trunc(Number(enfoque.cd));
      const distribucion = distribucionBandas({ modificador, dificultad, reglaCasaNatural });
      return Object.freeze({
        via: "probabilidad",
        quienTira: "ayudante",
        salvacion: false,
        dificultad,
        modificador: Math.trunc(Number(modificador) || 0),
        reglaCasaNatural,
        distribucion,
        favorable: probabilidadFavorable(distribucion),
        coste: enfoque.coste ?? null,
      });
    }
    case CLASES_ENFOQUE.TIRADA_CONTRA_OBJETIVO: {
      const objetivo = tarea.objetivo ?? {};
      const porSalvacion = Boolean(objetivo.salvacion);
      // Por ataque: el ayudante tira contra la CA. Por salvación: tira el
      // objetivo con SU modificador contra la CD de salvación del lanzador.
      const dificultad = Math.trunc(
        Number(porSalvacion ? enfoque.cdSalvacion ?? objetivo.cdSalvacion : objetivo.ca),
      );
      const modificadorTirador = porSalvacion
        ? Math.trunc(Number(objetivo.modificadorSalvacion) || 0)
        : Math.trunc(Number(modificador) || 0);
      const distribucion = distribucionBandas({
        modificador: modificadorTirador,
        dificultad,
        salvacion: porSalvacion,
      });
      return Object.freeze({
        via: "probabilidad",
        quienTira: porSalvacion ? "objetivo" : "ayudante",
        salvacion: porSalvacion,
        dificultad,
        modificador: modificadorTirador,
        // El crítico natural del ataque de conjuro SÍ es regla base de 5e; lo que
        // no se hace es extrapolarlo a las demás clases.
        reglaCasaNatural: false,
        distribucion,
        favorable: probabilidadFavorable(distribucion),
        coste: enfoque.coste ?? null,
      });
    }
    case CLASES_ENFOQUE.SIN_TIRADA:
      return Object.freeze({
        via: "banda-fija",
        quienTira: "nadie",
        salvacion: false,
        bandaFija: enfoque.bandaFija,
        // Se gasta al confirmar, no al conocer el resultado: la interfaz avisa.
        coste: enfoque.coste ?? null,
      });
    default:
      throw new TypeError(`enfoque sin clase válida: ${enfoque?.clase}`);
  }
}
