/* Ventana de la mesa de minijuegos (#308, paso 4).
 *
 * Hasta ahora la mesa existía entera —motor, sesión, cableado y modelo de
 * presentación— pero no había forma de abrirla desde Foundry: se probaba con una
 * macro de andamio. Esto es la superficie que faltaba.
 *
 * Capa fina y deliberadamente tonta:
 * - lo que se pinta lo decide `mesa-vista.mjs`, que es puro y está probado;
 * - lo que se PUEDE hacer no lo decide esta ventana: llega desde el coordinador
 *   junto con cada vista (ver `vistasPrivadas` en el adaptador). Un botón de más
 *   aquí no concedería nada — el coordinador rechazaría la propuesta igual—,
 *   pero un botón de menos dejaría a alguien sin jugar, así que la lista viene
 *   de quien tiene la autoridad y no se recalcula.
 *
 * Dos clases hermanas, como el resto del módulo: `Application` clásica en v11 y
 * `ApplicationV2` en v12+. No comparten código de ventana a propósito; lo que sí
 * comparten es el modelo de presentación, que no sabe de Foundry.
 */

import { MODULE_ID } from "../lagunak-constantes.mjs";
import { lineasResultado, mesaVista } from "./mesa-vista.mjs";

const PLANTILLA = `modules/${MODULE_ID}/templates/mesa-poker.hbs`;

// Última vista recibida por ESTE cliente, y las acciones que la acompañaban.
// Vive fuera de la ventana porque las vistas llegan tanto si la ventana está
// abierta como si no: quien la abre después tiene que encontrar la mesa puesta,
// no una pantalla en blanco hasta la acción siguiente.
let ultimaVista = null;
let ultimasAcciones = [];

export function recordarVista(vista, acciones) {
  ultimaVista = vista ?? null;
  ultimasAcciones = Array.isArray(acciones) ? acciones : [];
}

export function vistaRecordada() {
  return { vista: ultimaVista, acciones: ultimasAcciones };
}

/** Contexto de plantilla a partir del modelo puro, ya localizado. */
function contexto() {
  const userId = game.user?.id ?? "";
  const modelo = mesaVista(ultimaVista, { userId, acciones: ultimasAcciones });
  if (!modelo.hayMesa) return modelo;

  const nombre = (id) => game.users?.get?.(id)?.name ?? id;
  const cifra = (valor) => (Number.isInteger(valor) ? String(valor) : "—");
  return {
    ...modelo,
    faseTexto: game.i18n.format("LAGUNAK.Minijuegos.Mesa.Fase", {
      fase: game.i18n.localize(`LAGUNAK.Minijuegos.Fase.${modelo.fase ?? "lobby"}`),
    }),
    boteTexto: game.i18n.format("LAGUNAK.Minijuegos.Mesa.Bote", { fichas: cifra(modelo.bote) }),
    jugadores: modelo.jugadores.map((jugador) => ({
      ...jugador,
      nombre: nombre(jugador.userId),
      esAutomatico: jugador.controlador === "automatico",
      fichasTexto: game.i18n.format("LAGUNAK.Minijuegos.Mesa.Fichas", {
        fichas: cifra(jugador.stack),
      }),
    })),
    // El importe de una subida es «hasta cuánto», no «cuánto más»: es lo que
    // pide el motor y lo que se dice en una mesa. Se propone la subida mínima
    // legal, que es lo que se teclearía la mayoría de las veces.
    pideImporte: modelo.acciones.some((accion) => accion.requiereImporte),
    importeMinimo: importeMinimo(modelo),
    importeSugerido: importeMinimo(modelo),
    resultadoTexto: textoResultado(modelo.resultado, nombre),
  };
}

/** Subida mínima legal: se sube HASTA, así que es la apuesta viva más el
 *  incremento mínimo. */
function importeMinimo(modelo) {
  const apuesta = Number.isInteger(modelo.apuestaActual) ? modelo.apuestaActual : 0;
  const minima = Number.isInteger(modelo.subidaMinima) ? modelo.subidaMinima : 1;
  return apuesta + minima;
}

/** Una línea con quién se llevó qué. Sin resultado no se inventa nada. */
function textoResultado(resultado, nombre) {
  const lineas = lineasResultado(resultado);
  if (lineas.length === 0) return "";
  return lineas
    .map((linea) =>
      game.i18n.format("LAGUNAK.Minijuegos.Mesa.Gana", {
        nombre: nombre(linea.userId),
        fichas: linea.fichas,
      }),
    )
    .join(" · ");
}

/* Traduce un clic en propuesta. `proponer` se inyecta (es el cableado) para que
 * esta ventana no importe el transporte. */
function alPulsar(objetivo, elemento, proponer) {
  const tipo = objetivo?.dataset?.accion;
  if (!tipo) return;
  if (!tipo.startsWith("act:")) {
    proponer({ tipo });
    return;
  }
  const deJuego = tipo.slice("act:".length);
  const parametros = {};
  if (deJuego === "raise") {
    const campo = elemento?.querySelector?.("input[name='importe']");
    const hasta = Number.parseInt(campo?.value ?? "", 10);
    if (!Number.isInteger(hasta) || hasta <= 0) {
      ui.notifications?.warn(game.i18n.localize("LAGUNAK.Minijuegos.Mesa.ImporteInvalido"));
      return;
    }
    parametros.hasta = hasta;
  }
  proponer({ tipo: "act", parametros: { tipo: deJuego, parametros } });
}

/* ---- v12+ --------------------------------------------------------------- */

export function crearClaseMesaV2({ proponer }) {
  const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

  return class MesaPokerAppV2 extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "lagunak-mesa-poker",
      classes: ["lagunak-mesa"],
      window: { title: "LAGUNAK.Minijuegos.Mesa.Titulo", icon: "fa-solid fa-diamond" },
      position: { width: 520, height: "auto" },
    };

    static PARTS = { main: { template: PLANTILLA } };

    async _prepareContext(_options) {
      return contexto();
    }

    _onRender(context, options) {
      super._onRender?.(context, options);
      this.element?.querySelectorAll?.("[data-accion]")?.forEach((boton) => {
        boton.addEventListener("click", () => alPulsar(boton, this.element, proponer));
      });
    }
  };
}

/* ---- v11 ---------------------------------------------------------------- */

export function crearClaseMesaV1({ proponer }) {
  return class MesaPokerAppV1 extends Application {
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "lagunak-mesa-poker",
        classes: ["lagunak-mesa"],
        title: game.i18n.localize("LAGUNAK.Minijuegos.Mesa.Titulo"),
        template: PLANTILLA,
        width: 520,
        height: "auto",
      });
    }

    getData(_options) {
      return contexto();
    }

    activateListeners(html) {
      super.activateListeners(html);
      html.find("[data-accion]").on("click", (ev) => {
        alPulsar(ev.currentTarget, html[0], proponer);
      });
    }
  };
}
