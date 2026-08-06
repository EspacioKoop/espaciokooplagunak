// El modelo de vista de la asistencia (#309): lo que la ventana pinta.
//
// #309 tenía el camino completo de extremo a extremo —petición por flag,
// coordinación en el GM, respuesta dirigida, consumo en el relé— y **ni un
// botón**. Esto es la mitad pura de esa ventana: convierte oferta, reto y
// resultado en datos listos para una plantilla, sin tocar Foundry ni el DOM.
//
// ## Por qué la probabilidad se enseña ANTES de comprometerse
//
// `abrir` ya devuelve el rango de éxito de cada enfoque, y no por lucimiento:
// elegir enfoque es la única decisión real que toma quien ayuda, y tomarla a
// ciegas la convierte en un botón al azar. Aquí se traduce a algo legible sin
// esconder el número — el porcentaje va como texto, no solo como barra, porque
// una barra sola no la lee ni un lector de pantalla ni quien no distingue el
// relleno del fondo.
//
// ## El coste se anuncia donde se decide
//
// Un enfoque que gasta un espacio de conjuro es un coste de campaña real. Va
// pegado a su opción y no en una confirmación posterior: pagar por sorpresa es
// la clase de detalle que hace que nadie vuelva a pulsar el botón.
//
// Puro: ni Foundry, ni DOM, ni reloj. El tiempo entra como parámetro.

import { BANDAS_ORDENADAS } from "./bandas.mjs";
import { estadoEn, lecturaAccesible } from "./temporizacion.mjs";
import {
  estadoEn as estadoEnSecuencia,
  lecturaAccesible as lecturaAccesibleSecuencia,
} from "./secuencia.mjs";

/** Estados de la ventana. La ventana no tiene más; añadir uno es una decisión. */
export const FASES = Object.freeze({
  /** Nadie ha pedido nada: se elige tarea. */
  MENU: "menu",
  /** Pedido y esperando al GM coordinador. */
  ESPERANDO: "esperando",
  /** El GM ofreció: hay que elegir enfoque. */
  OFERTA: "oferta",
  /** Enfoque elegido por destreza: el cursor está corriendo. */
  RETO: "reto",
  /** Hay veredicto, bueno o malo. */
  CERRADA: "cerrada",
});

/**
 * Las tareas ofrecidas, con su puesto y su modo.
 *
 * Las NARRATIVAS se listan igual que las de propuesta y dicen que lo son. No es
 * ruido: una tarea narrativa produce ficción y la adjudica el GM en la mesa, así
 * que esconderla haría creer que a sensores no se le puede ayudar. Lo que no
 * puede es prometer un efecto en la simulación, y eso se escribe.
 */
export function vistaTareas(tareas = []) {
  return tareas.map((tarea) =>
    Object.freeze({
      id: tarea.id,
      puestoAsistido: tarea.puestoAsistido,
      clavePuesto: `LAGUNAK.Puestos.${tarea.puestoAsistido}`,
      claveNombre: `LAGUNAK.Asistencia.Tarea.${tarea.id}`,
      // Sin acción propuesta no hay orden que prestar: es narrativa.
      narrativa: !tarea.accionPropuesta,
      dificultad: tarea.dificultad ?? null,
    }),
  );
}

/** Porcentaje entero 0–100 desde una probabilidad 0–1. */
function porcentaje(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return null;
  return Math.round(Math.max(0, Math.min(1, numero)) * 100);
}

/**
 * Los enfoques de una oferta, listos para pintar.
 *
 * `favorable` es la cifra que de verdad decide: la probabilidad de acabar en una
 * banda que sirva de algo. Las bandas sueltas se dan aparte para quien quiera
 * mirar el detalle, en el orden canónico y no en el que vengan.
 */
export function vistaOferta(oferta) {
  if (!oferta || !Array.isArray(oferta.enfoques)) return null;

  return Object.freeze({
    via: oferta.via ?? null,
    // Solo se usa cuando `via === "destreza"`: qué reto empezar directamente,
    // sin pasar por una lista de enfoques que en esa vía viene vacía.
    minijuegoDestreza: oferta.minijuegoDestreza ?? "temporizacion",
    enfoques: Object.freeze(
      oferta.enfoques.map(({ enfoque, rango }) =>
        Object.freeze({
          id: enfoque.id,
          clase: enfoque.clase,
          claveNombre: `LAGUNAK.Asistencia.Enfoque.${enfoque.id}`,
          // Sin tirada no hay probabilidad que enseñar, y fingir un 100% sería
          // mentir: la banda es fija porque el motor la fija, no porque se gane.
          conTirada: rango?.via === "probabilidad",
          favorable: porcentaje(rango?.favorable),
          dificultad: rango?.dificultad ?? null,
          modificador: rango?.modificador ?? null,
          quienTira: rango?.quienTira ?? null,
          salvacion: Boolean(rango?.salvacion),
          bandaFija: enfoque.bandaFija ?? null,
          // El coste va aquí, pegado a la opción, y no en una confirmación
          // posterior: pagar por sorpresa un espacio de conjuro es cómo se
          // consigue que nadie vuelva a usar la ayuda.
          coste: enfoque.coste ?? null,
          bandas: Object.freeze(
            BANDAS_ORDENADAS.map((banda) => ({
              banda,
              claveNombre: `LAGUNAK.Asistencia.Banda.${banda}`,
              probabilidad: porcentaje(rango?.distribucion?.[banda]),
            })).filter((fila) => fila.probabilidad !== null && fila.probabilidad > 0),
          ),
        }),
      ),
    ),
  });
}

/**
 * El estado del reto de temporización en un instante, en unidades de pintado.
 *
 * `porcentaje` de cursor y zona salen ya en 0–100 para que la plantilla no haga
 * cuentas: una plantilla que multiplica por cien es una plantilla que un día
 * multiplicará mal.
 *
 * `lectura` es el canal NO visual, y es obligatorio: un minijuego que solo se
 * puede jugar viendo una barra moverse excluye a quien no la ve, y la asistencia
 * es justo la mecánica que no debería exigir reflejos finos de nadie.
 */
export function vistaReto(reto, tMs) {
  if (!reto) return null;
  const estado = estadoEn(reto, tMs);
  const desde = Math.max(0, estado.objetivo - estado.tolerancia);
  const hasta = Math.min(1, estado.objetivo + estado.tolerancia);
  return Object.freeze({
    cursor: Math.round(estado.posicion * 1000) / 10,
    zonaDesde: Math.round(desde * 1000) / 10,
    zonaAncho: Math.round((hasta - desde) * 1000) / 10,
    // Se deriva aquí y no se lee del estado: `estadoEn` no lo dice, y calcularlo
    // en la plantilla obligaría a repetir el umbral en dos sitios.
    dentro: Math.abs(estado.posicion - estado.objetivo) <= estado.tolerancia,
    restanteMs: Math.max(0, Math.round(estado.restanteMs ?? 0)),
    lectura: lecturaAccesible(reto, tMs),
  });
}

/**
 * El estado del reto de SECUENCIA en un instante, en unidades de pintado.
 *
 * `intentos` entra porque el progreso —cuántos símbolos lleva acertados quien
 * juega— no se puede leer del reto: el reto es la secuencia a adivinar, no lo
 * que ya se ha pulsado. `simbolos` sale ya como la lista de índices a pintar,
 * para que la plantilla no invente un rango.
 *
 * `lectura` es el canal NO visual, obligatorio por la misma razón que en
 * temporización: unos símbolos que solo se distinguen por color o forma
 * excluyen a quien no los ve igual que todos.
 */
export function vistaRetoSecuencia(reto, intentos, tMs) {
  if (!reto) return null;
  const estado = estadoEnSecuencia(reto, tMs);
  return Object.freeze({
    fase: estado.fase,
    // Booleanos precalculados y no `fase === "muestra"` en la plantilla: este
    // módulo no registra helpers de Handlebars (`eq` no existe aquí), y es el
    // mismo patrón que ya usan `enOferta`/`enReto` en `asistencia-ui.mjs`.
    enMuestra: estado.fase === "muestra",
    simboloActivo: estado.simboloActivo,
    simbolos: Object.freeze(Array.from({ length: reto.simbolos }, (_, i) => i)),
    progreso: (intentos ?? []).length,
    longitud: reto.secuencia.length,
    restanteMs: Math.max(0, Math.round(estado.restanteMs ?? 0)),
    lectura: lecturaAccesibleSecuencia(reto, tMs),
  });
}

/**
 * El veredicto final, ya traducido a lo que la ventana dice.
 *
 * Distingue tres finales que un «no se pudo» aplasta: la ayuda no cuajó (banda
 * sin fruto), la ayuda salió y espera al titular, o la petición fue rechazada
 * antes de empezar. Solo el tercero es un problema del jugador; los otros dos
 * son el juego funcionando.
 */
export function vistaCierre({ propuesta = null, rechazo = null } = {}) {
  if (rechazo) {
    return Object.freeze({
      tipo: "rechazo",
      claveTitular: "LAGUNAK.Asistencia.Cierre.Rechazo",
      claveDetalle: `LAGUNAK.Asistencia.Error.${rechazo}`,
    });
  }
  if (!propuesta) return null;

  const hayFruto = Boolean(propuesta.accion);
  return Object.freeze({
    tipo: hayFruto ? "propuesta" : "sin-fruto",
    claveTitular: hayFruto ? "LAGUNAK.Asistencia.Cierre.Propuesta" : "LAGUNAK.Asistencia.Cierre.SinFruto",
    claveBanda: propuesta.banda ? `LAGUNAK.Asistencia.Banda.${propuesta.banda}` : null,
    // Quién la gasta importa y no es quien ayudó: el token lo consume el TITULAR
    // dentro de una orden suya. Decirlo evita que el asistente se quede
    // esperando un efecto que nunca va a ver salir de su propia pantalla.
    puestoAsistido: propuesta.puestoAsistido ?? null,
    clavePuesto: propuesta.puestoAsistido ? `LAGUNAK.Puestos.${propuesta.puestoAsistido}` : null,
  });
}
