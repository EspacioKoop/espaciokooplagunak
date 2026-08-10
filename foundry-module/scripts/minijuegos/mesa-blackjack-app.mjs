/* Ventana de la mesa de blackjack (#308, tercer vertical), hermana de
 * `mesa-poker-app.mjs` y `mesa-dados-app.mjs`.
 *
 * Capa fina y deliberadamente tonta, igual que las otras dos:
 * - lo que se pinta lo decide `blackjack-vista.mjs`, que es puro y está
 *   probado;
 * - lo que se PUEDE hacer no lo decide esta ventana: llega desde el
 *   coordinador junto con cada vista. Un botón de más aquí no concedería
 *   nada —el coordinador rechazaría la propuesta igual—, pero uno de menos
 *   dejaría a alguien sin jugar, así que la lista viene de quien tiene la
 *   autoridad.
 *
 * Dos clases hermanas, como el resto del módulo: `Application` clásica en
 * v11 y `ApplicationV2` en v12+. No comparten código de ventana a propósito.
 */

import { MODULE_ID } from "../lagunak-constantes.mjs";
import { PIXEL } from "../paleta.mjs";
import { blackjackVista } from "./blackjack-vista.mjs";
import { lecturaBlackjack } from "./blackjack-lectura.mjs";
import { normalizarMesaBlackjack } from "./mesa-config.mjs";
import { AJUSTE_APUESTA_BLACKJACK, AJUSTE_FICHAS } from "../minijuegos-wiring.mjs";
import { PREFIJO_AUTOMATICO } from "./sesion-motor.mjs";
import { componerMesa } from "./blackjack-3d.mjs";
import { pintarEscena } from "../retro3d-lienzo.mjs";

const PLANTILLA = `modules/${MODULE_ID}/templates/mesa-blackjack.hbs`;

// Última vista recibida por ESTE cliente, y las acciones que la acompañaban.
// Igual que en las otras dos mesas: vive fuera de la ventana porque las
// vistas llegan tanto si la ventana está abierta como si no.
let ultimaVista = null;
let ultimasAcciones = [];

export function recordarVista(vista, acciones) {
  ultimaVista = vista ?? null;
  ultimasAcciones = Array.isArray(acciones) ? acciones : [];
}

export function vistaRecordada() {
  return { vista: ultimaVista, acciones: ultimasAcciones };
}

/**
 * Pinta la mesa en 3D dentro de la raíz ya renderizada. Fuera de las dos
 * clases hermanas, igual que en póker: es cableado de DOM y duplicarlo
 * aseguraría que un arreglo llegara a una sola de las dos rutas.
 *
 * Sin lienzo no pasa nada: la mesa en texto es la verdad y sigue completa.
 */
function pintarMesa3D(raiz, modelo) {
  const lienzo = raiz?.querySelector?.(".lagunak-mesa-3d");
  const ctx = lienzo?.getContext?.("2d");
  if (!ctx || !modelo?.hayMesa) return false;
  const escena = componerMesa(
    {
      banca: modelo.banca ? { cartas: modelo.banca.cartas.length, oculta: modelo.banca.oculta } : { cartas: 0, oculta: true },
      jugadores: (modelo.jugadores ?? []).map((jugador) => ({
        cartas: jugador.cartas.length,
        apuesta: jugador.apuesta ?? 0,
        propio: jugador.userId === game.user?.id,
      })),
    },
    { ancho: lienzo.width, alto: lienzo.height },
  );
  pintarEscena(ctx, escena, { fondo: PIXEL.dorsoFondo });
  return true;
}

const ETIQUETA_MOTIVO = Object.freeze({
  bust: "LAGUNAK.Blackjack.Mesa.Motivo.bust",
  blackjack: "LAGUNAK.Blackjack.Mesa.Motivo.blackjack",
  plantado: "LAGUNAK.Blackjack.Mesa.Motivo.plantado",
  doblado: "LAGUNAK.Blackjack.Mesa.Motivo.doblado",
});

const ETIQUETA_DESENLACE = Object.freeze({
  gana: "LAGUNAK.Blackjack.Mesa.Desenlace.gana",
  pierde: "LAGUNAK.Blackjack.Mesa.Desenlace.pierde",
  empate: "LAGUNAK.Blackjack.Mesa.Desenlace.empate",
  blackjack: "LAGUNAK.Blackjack.Mesa.Desenlace.blackjack",
});

/**
 * Las opciones de ESTA mesa, leídas de los mismos ajustes que usa el
 * coordinador para construir la mano (`configuracionDeBlackjack`).
 *
 * Se leen aquí y no llegan con la vista a propósito: el cartel de reglas es
 * información de la MESA, no del reparto, y tiene que poder pintarse antes de
 * que se reparta la primera carta — que es justo cuando alguien necesita leerlo.
 */
function opcionesDeMesa() {
  try {
    return normalizarMesaBlackjack({
      fichasIniciales: game.settings?.get?.(MODULE_ID, AJUSTE_FICHAS),
      apuesta: game.settings?.get?.(MODULE_ID, AJUSTE_APUESTA_BLACKJACK),
    });
  } catch {
    // Un ajuste que todavía no existe no puede dejar la mesa sin abrir: sin
    // cifras, el cartel pierde la línea de la apuesta y conserva el resto.
    return normalizarMesaBlackjack({});
  }
}

/** Contexto de plantilla a partir del modelo puro, ya localizado. */
function contexto() {
  const userId = game.user?.id ?? "";
  const modelo = blackjackVista(ultimaVista, { userId, acciones: ultimasAcciones });
  if (!modelo.hayMesa) return modelo;
  // La lectura (#553): qué pasa ahora y con qué reglas se juega. Es lo que el QA
  // echó en falta, y va por delante del resto del contexto porque es lo primero
  // que se lee.
  const lectura = lecturaBlackjack(modelo, opcionesDeMesa());

  const nombre = (id) => {
    if (typeof id === "string" && id.startsWith(PREFIJO_AUTOMATICO)) {
      return game.i18n.format("LAGUNAK.Minijuegos.Mesa.NombreAutomatico", {
        numero: id.slice(PREFIJO_AUTOMATICO.length),
      });
    }
    return game.users?.get?.(id)?.name ?? id;
  };
  const cifra = (valor) => (Number.isInteger(valor) ? String(valor) : "—");
  // La lectura trabaja con `userId` porque es puro y no conoce a nadie; quien sí
  // sabe traducir un id a un nombre es esta capa, y aquí es donde toca hacerlo.
  // Sin este paso, «Juega {userId}» se leería como un identificador en crudo.
  const frase = ({ clave, datos }) => {
    const partes = { ...(datos ?? {}) };
    if (typeof partes.userId === "string") partes.userId = nombre(partes.userId);
    return game.i18n.format(clave, partes);
  };

  return {
    ...modelo,
    situacionTexto: frase(lectura.situacion),
    esTuTurno: lectura.situacion.esTuTurno,
    reglasTexto: lectura.reglas.map(frase),
    noPuedesDoblarTexto: lectura.noPuedesDoblar ? frase(lectura.noPuedesDoblar) : "",
    faseTexto: game.i18n.format("LAGUNAK.Minijuegos.Mesa.Fase", {
      fase: game.i18n.localize(`LAGUNAK.Minijuegos.Fase.${modelo.fase ?? "lobby"}`),
    }),
    bancaTexto: modelo.banca && Number.isInteger(modelo.banca.total)
      ? game.i18n.format("LAGUNAK.Blackjack.Mesa.BancaTotal", { total: modelo.banca.total })
      : game.i18n.localize("LAGUNAK.Blackjack.Mesa.BancaTapada"),
    jugadores: modelo.jugadores.map((jugador) => ({
      ...jugador,
      nombre: nombre(jugador.userId),
      esAutomatico: jugador.controlador === "automatico",
      fichasTexto: game.i18n.format("LAGUNAK.Minijuegos.Mesa.Fichas", { fichas: cifra(jugador.fichas) }),
      apuestaTexto: game.i18n.format("LAGUNAK.Blackjack.Mesa.Apuesta", { fichas: cifra(jugador.apuesta) }),
      totalTexto: Number.isInteger(jugador.total)
        ? game.i18n.format("LAGUNAK.Blackjack.Mesa.Total", { total: jugador.total })
        : "",
      estadoTexto: textoEstado(jugador),
    })),
    resultadoTexto: textoResultado(modelo.resultado, nombre),
  };
}

/** Estado de un asiento: prioriza el desenlace ya resuelto sobre el motivo de
 * turno, porque «pierde» dice más que «bust» una vez la mano ha terminado. */
function textoEstado(jugador) {
  if (jugador.desenlace && ETIQUETA_DESENLACE[jugador.desenlace]) {
    return game.i18n.localize(ETIQUETA_DESENLACE[jugador.desenlace]);
  }
  if (jugador.motivo && ETIQUETA_MOTIVO[jugador.motivo]) {
    return game.i18n.localize(ETIQUETA_MOTIVO[jugador.motivo]);
  }
  return "";
}

/** Quién se llevó qué, en una línea. Sin resultado no se inventa nada. */
function textoResultado(resultado, nombre) {
  const jugadores = Array.isArray(resultado?.jugadores) ? resultado.jugadores : [];
  if (jugadores.length === 0) return "";
  return jugadores
    .filter((j) => Number.isFinite(j.ganancia) && j.ganancia !== 0)
    .map((j) =>
      game.i18n.format("LAGUNAK.Minijuegos.Mesa.Gana", { nombre: nombre(j.userId), fichas: j.ganancia }),
    )
    .join(" · ");
}

/* Traduce un clic en propuesta. `proponer` se inyecta (es el cableado) para
 * que esta ventana no importe el transporte. Ninguna acción de blackjack
 * necesita un importe: la apuesta es fija y doblar dobla la que ya hay. */
function alPulsar(objetivo, _elemento, proponer) {
  const tipo = objetivo?.dataset?.accion;
  if (!tipo) return;
  if (!tipo.startsWith("act:")) {
    proponer({ tipo });
    return;
  }
  const deJuego = tipo.slice("act:".length);
  proponer({ tipo: "act", parametros: { tipo: deJuego, parametros: {} } });
}

/* ---- v12+ --------------------------------------------------------------- */

export function crearClaseMesaBlackjackV2({ proponer, alCerrar = () => {} }) {
  const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

  return class MesaBlackjackAppV2 extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "lagunak-mesa-blackjack",
      classes: ["lagunak-mesa", "lagunak-blackjack"],
      window: { title: "LAGUNAK.Blackjack.Mesa.Titulo", icon: "fa-solid fa-cards" },
      position: { width: 560, height: "auto" },
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
      pintarMesa3D(this.element, context);
    }

    _onClose(options) {
      super._onClose?.(options);
      alCerrar(this);
    }
  };
}

/* ---- v11 ---------------------------------------------------------------- */

export function crearClaseMesaBlackjackV1({ proponer, alCerrar = () => {} }) {
  return class MesaBlackjackAppV1 extends Application {
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "lagunak-mesa-blackjack",
        classes: ["lagunak-mesa", "lagunak-blackjack"],
        title: game.i18n.localize("LAGUNAK.Blackjack.Mesa.Titulo"),
        template: PLANTILLA,
        width: 560,
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
      pintarMesa3D(html?.[0], contexto());
    }

    async close(options) {
      alCerrar(this);
      return super.close(options);
    }
  };
}
