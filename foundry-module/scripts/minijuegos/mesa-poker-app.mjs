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
import { PIXEL } from "../paleta.mjs";
import { lineasResultado, mesaVista } from "./mesa-vista.mjs";
import { PREFIJO_AUTOMATICO } from "./sesion-motor.mjs";
import { componerMesa } from "./poker-3d.mjs";
import { pintarEscena } from "../retro3d-lienzo.mjs";
import { intentoDesdeArrastre } from "./carta-intento.mjs";

// Formato del `dataTransfer` de un arrastre de carta propia (#458): un MIME a
// propósito propio del módulo, para que soltar cualquier otra cosa que use
// `text/plain` (un enlace, texto seleccionado) nunca se confunda con un
// intento de mostrar carta.
const MIME_CARTA = `application/x-${MODULE_ID}-carta-mano`;

/**
 * Envía la intención de mostrar la carta `indice` de la mano propia. Pasa
 * SIEMPRE por `intentoDesdeArrastre` (#458): ni el arrastre ni el clic tocan
 * el motor directamente, solo construyen la misma forma cerrada que
 * validaría cualquier otro origen del gesto.
 */
function mostrarCarta(indice, proponer) {
  const intento = intentoDesdeArrastre({ tipo: "mostrar", indice });
  if (!intento) return;
  proponer({ tipo: "act", parametros: intento });
}

/**
 * Cablea el arrastre y el clic/teclado de las cartas de la mano propia hacia
 * `mostrarCarta`. Fuera de las dos clases hermanas por la misma razón que
 * `pintarMesa3D`: es DOM, no comportamiento de ventana.
 *
 * Dos caminos al mismo intento, a propósito:
 * - arrastrar una carta hasta el tapete (`[data-zona-mostrar]`) es el gesto
 *   pensado para esto — enseñar una carta es ponerla físicamente en la mesa;
 * - pulsar la carta (clic, o Intro/Espacio con el foco encima) hace lo mismo
 *   sin arrastre, porque un gesto que solo funciona con ratón deja fuera a
 *   quien navega por teclado o con lector de pantalla.
 *
 * Ninguno de los dos concede nada por sí mismo: `mostrarCarta` termina en el
 * mismo `aplicar` del motor que rechazaría igual una carta ya mostrada, un
 * índice inválido o una mano retirada — la ventana no puede saltarse esa
 * autoridad por arrastrar en vez de pulsar un botón.
 */
function cablearCartasPropias(raiz, proponer) {
  const zonaMostrar = raiz?.querySelector?.("[data-zona-mostrar]");

  raiz?.querySelectorAll?.(".lagunak-mesa-carta-propia")?.forEach((carta) => {
    const indice = Number.parseInt(carta.dataset.indice, 10);

    carta.addEventListener("dragstart", (ev) => {
      ev.dataTransfer?.setData(MIME_CARTA, String(indice));
      if (ev.dataTransfer) ev.dataTransfer.effectAllowed = "move";
    });

    carta.addEventListener("click", () => mostrarCarta(indice, proponer));
    carta.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      ev.preventDefault();
      mostrarCarta(indice, proponer);
    });
  });

  if (!zonaMostrar) return;
  const CLASE_ACTIVA = "lagunak-zona-mostrar-activa";
  zonaMostrar.addEventListener("dragover", (ev) => {
    if (!ev.dataTransfer?.types?.includes(MIME_CARTA)) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = "move";
    zonaMostrar.classList.add(CLASE_ACTIVA);
  });
  zonaMostrar.addEventListener("dragleave", () => {
    zonaMostrar.classList.remove(CLASE_ACTIVA);
  });
  zonaMostrar.addEventListener("drop", (ev) => {
    zonaMostrar.classList.remove(CLASE_ACTIVA);
    const crudo = ev.dataTransfer?.getData(MIME_CARTA);
    if (!crudo) return;
    ev.preventDefault();
    mostrarCarta(Number.parseInt(crudo, 10), proponer);
  });
}

/**
 * Pinta la mesa en 3D dentro de la raíz ya renderizada. Fuera de las dos clases
 * hermanas a propósito: es cableado de DOM, no comportamiento de ventana, y
 * duplicarlo aseguraría que un día el arreglo llegue a una sola de las dos.
 *
 * Sin lienzo no pasa nada: la mesa en texto es la verdad y sigue completa. El
 * 3D es lo que hace que apostar se sienta apostar, no lo que dice qué hay.
 */
function pintarMesa3D(raiz, modelo) {
  const lienzo = raiz?.querySelector?.(".lagunak-mesa-3d");
  const ctx = lienzo?.getContext?.("2d");
  if (!ctx || !modelo?.hayMesa) return false;
  const escena = componerMesa(
    {
      comunitarias: Array.isArray(modelo.comunitarias) ? modelo.comunitarias.length : 0,
      jugadores: (modelo.jugadores ?? []).map((jugador) => ({
        fichas: jugador.stack,
        // «Propio» es quien mira: sus cartas van boca arriba y no se le pinta
        // busto, porque la cámara está donde está él.
        propio: jugador.userId === game.user?.id,
        enMano: jugador.estado !== "retirado" && !jugador.eliminado,
      })),
    },
    { ancho: lienzo.width, alto: lienzo.height },
  );
  pintarEscena(ctx, escena, { fondo: PIXEL.dorsoFondo });
  return true;
}

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

  // Un asiento automático no es un usuario de Foundry: no hay documento del que
  // sacar el nombre, y enseñar «auto:2» en la mesa sería enseñar una tripa.
  const nombre = (id) => {
    if (typeof id === "string" && id.startsWith(PREFIJO_AUTOMATICO)) {
      return game.i18n.format("LAGUNAK.Minijuegos.Mesa.NombreAutomatico", {
        numero: id.slice(PREFIJO_AUTOMATICO.length),
      });
    }
    return game.users?.get?.(id)?.name ?? id;
  };
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
      // Lo apostado en esta ronda va con su cifra al lado del montón: el
      // montón es el atajo, no el dato.
      apuestaTexto: game.i18n.format("LAGUNAK.Minijuegos.Mesa.Apostado", {
        fichas: cifra(jugador.apostadoRonda),
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

export function crearClaseMesaV2({ proponer, alCerrar = () => {} }) {
  const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

  return class MesaPokerAppV2 extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "lagunak-mesa-poker",
      classes: ["lagunak-mesa"],
      window: { title: "LAGUNAK.Minijuegos.Mesa.Titulo", icon: "fa-solid fa-diamond" },
      // Cinco comunitarias a escala ×3 más el marco: por debajo de esto la
      // ventana empieza a envolver el tapete.
      position: { width: 600, height: "auto" },
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
      cablearCartasPropias(this.element, proponer);
      pintarMesa3D(this.element, context);
    }

    // Una ApplicationV2 cerrada NO se reutiliza: hay que construir otra. Quien
    // guarda la referencia se entera por aquí, y no por adivinación.
    _onClose(options) {
      super._onClose?.(options);
      alCerrar(this);
    }
  };
}

/* ---- v11 ---------------------------------------------------------------- */

export function crearClaseMesaV1({ proponer, alCerrar = () => {} }) {
  return class MesaPokerAppV1 extends Application {
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "lagunak-mesa-poker",
        classes: ["lagunak-mesa"],
        title: game.i18n.localize("LAGUNAK.Minijuegos.Mesa.Titulo"),
        template: PLANTILLA,
        width: 600,
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
      cablearCartasPropias(html?.[0], proponer);
      pintarMesa3D(html?.[0], contexto());
    }

    // La ruta v11 sí admitiría reutilizar la instancia, pero se descarta igual:
    // un contrato de descarte distinto en cada ruta es una diferencia invisible
    // que acaba mordiendo en la que menos se prueba.
    async close(options) {
      alCerrar(this);
      return super.close(options);
    }
  };
}
