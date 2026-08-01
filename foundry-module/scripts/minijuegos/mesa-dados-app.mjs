/* Ventana de la mesa de dados (#413), hermana de `mesa-poker-app.mjs`.
 *
 * Capa fina y deliberadamente tonta, igual que la del póker:
 * - lo que se pinta lo decide `dados-vista.mjs`, que es puro y está probado;
 * - lo que se PUEDE hacer no lo decide esta ventana: llega desde el coordinador
 *   junto con cada vista. Un botón de más aquí no concedería nada —el
 *   coordinador rechazaría la propuesta igual— pero uno de menos dejaría a
 *   alguien sin jugar, así que la lista viene de quien tiene la autoridad.
 *
 * LO ÚNICO QUE ESTA VENTANA HACE Y LA DEL PÓKER NO: pintar. Las cartas son
 * imágenes y viajan en el modelo; los dados son geometría 3D y se pintan sobre
 * un `<canvas>` después de cada render. Eso vive aquí y no en el modelo puro
 * porque un `<canvas>` no existe en Node — el reparto es el mismo de siempre:
 * `dados-lienzo.mjs` sabe pintar y no sabe de Foundry, esta ventana sabe de
 * Foundry y no sabe de geometría.
 *
 * LA TIRADA SE VE UNA VEZ. Los dados ruedan cuando llega una tirada NUEVA, no
 * en cada repintado: sin eso, cada vez que alguien apostara al otro lado de la
 * mesa los dados de todos se pondrían a dar vueltas otra vez, y una animación
 * que se repite sin motivo deja de significar nada. Lo que la distingue es el
 * cubilete propio, que solo cambia al tirar.
 */

import { MODULE_ID } from "../lagunak-constantes.mjs";
import { dadosVista } from "./dados-vista.mjs";
import { pintarCubilete, rodarDados } from "./dados-lienzo.mjs";
import { PREFIJO_AUTOMATICO } from "./sesion-motor.mjs";

const PLANTILLA = `modules/${MODULE_ID}/templates/mesa-dados.hbs`;

/** Tamaño del búfer de cada cubilete. Bajo a propósito: es el efecto (#362). */
export const ANCHO_CUBILETE = 120;
export const ALTO_CUBILETE = 28;

let ultimaVista = null;
let ultimasAcciones = [];
// Huella del último cubilete propio pintado. Sirve para saber si hay tirada
// nueva que enseñar, y se guarda fuera de la ventana porque la ventana se
// destruye al cerrarse y volver a abrirla no es volver a tirar.
let huellaTirada = null;

export function recordarVista(vista, acciones) {
  ultimaVista = vista ?? null;
  ultimasAcciones = Array.isArray(acciones) ? acciones : [];
}

export function vistaRecordada() {
  return { vista: ultimaVista, acciones: ultimasAcciones };
}

/**
 * Huella de una tirada: los dados propios y de qué ronda son. Pura y exportada
 * para poder probar la regla «se rueda solo con tirada nueva» sin ventana.
 */
export function huellaDe(modelo) {
  if (!modelo?.tuCubilete) return null;
  return `${modelo.id ?? ""}:${modelo.rondaEnCurso ? 1 : 0}:${modelo.tuCubilete.join(",")}`;
}

/** ¿Toca rodar? Solo si hay cubilete propio y no es el que ya se enseñó. */
export function hayTiradaNueva(modelo, ultima = huellaTirada) {
  const huella = huellaDe(modelo);
  return Boolean(huella) && huella !== ultima;
}

/** Contexto de plantilla a partir del modelo puro, ya localizado. */
export function contexto() {
  const userId = game.user?.id ?? "";
  const modelo = dadosVista(ultimaVista, { userId, acciones: ultimasAcciones });
  if (!modelo.hayMesa) return modelo;

  const nombre = (id) => {
    if (typeof id === "string" && id.startsWith(PREFIJO_AUTOMATICO)) {
      return game.i18n.format("LAGUNAK.Minijuegos.Mesa.NombreAutomatico", {
        numero: id.slice(PREFIJO_AUTOMATICO.length),
      });
    }
    return game.users?.get?.(id)?.name ?? id;
  };

  return {
    ...modelo,
    anchoCubilete: ANCHO_CUBILETE,
    altoCubilete: ALTO_CUBILETE,
    faseTexto: game.i18n.format("LAGUNAK.Minijuegos.Mesa.Fase", {
      fase: game.i18n.localize(`LAGUNAK.Minijuegos.Fase.${modelo.fase ?? "lobby"}`),
    }),
    apuestaTexto: modelo.apuesta
      ? game.i18n.format("LAGUNAK.Dados.Mesa.Apuesta", {
        nombre: nombre(modelo.apuesta.userId),
        cantidad: modelo.apuesta.cantidad,
        cara: modelo.apuesta.cara,
      })
      : game.i18n.localize("LAGUNAK.Dados.Mesa.SinApuesta"),
    recuentoTexto: game.i18n.format("LAGUNAK.Dados.Mesa.EnJuego", {
      dados: modelo.dadosEnJuego ?? 0,
    }),
    carasOpciones: modelo.caras.map((valor) => ({
      valor,
      seleccionada: valor === modelo.sugerencia.cara,
    })),
    pideApuesta: modelo.acciones.some((accion) => accion.requiereApuesta),
    jugadores: modelo.jugadores.map((jugador) => ({
      ...jugador,
      nombre: nombre(jugador.userId),
      esAutomatico: jugador.controlador === "automatico",
      dadosTexto: game.i18n.format("LAGUNAK.Dados.Mesa.Dados", { dados: jugador.dados ?? 0 }),
      // El cubilete EN TEXTO. No es una etiqueta de cortesía para el lienzo: es
      // el mismo dato por otra vía, que es lo que #362 exige —un visor 3D no
      // puede ser la única forma de leer algo—. Y de un cubilete ajeno dice
      // cuántos dados hay, nunca cuáles: lo que no llegó no se puede escribir.
      cubileteTexto: textoCubilete(jugador, modelo),
    })),
    destapeTexto: textoDestape(modelo, nombre),
  };
}

function textoCubilete(jugador, modelo) {
  const visibles = jugador.destapado ?? jugador.valores;
  if (Array.isArray(visibles) && visibles.length > 0) {
    return game.i18n.format(
      jugador.eresTu ? "LAGUNAK.Dados.Mesa.TuCubilete" : "LAGUNAK.Dados.Mesa.CubileteVisto",
      { nombre: jugador.userId, valores: visibles.join(", ") },
    );
  }
  if (jugador.eresTu && modelo.rondaEnCurso) {
    return game.i18n.localize("LAGUNAK.Dados.Mesa.CubileteSinTirar");
  }
  return game.i18n.format("LAGUNAK.Dados.Mesa.CubileteOculto", { dados: jugador.dados ?? 0 });
}

function textoDestape(modelo, nombre) {
  const destape = modelo.destape;
  if (!destape) return "";
  return game.i18n.format(
    destape.apuestaSostenida
      ? "LAGUNAK.Dados.Mesa.DestapeSostenida"
      : "LAGUNAK.Dados.Mesa.DestapeFarol",
    {
      cantidad: destape.cantidad,
      cara: destape.cara,
      reales: destape.reales,
      perdedor: nombre(destape.perdedorId),
    },
  );
}

/**
 * Pinta cada cubilete sobre su lienzo. Con tirada nueva, los dados propios
 * ruedan; los demás se pintan quietos, porque de ellos no ha cambiado nada que
 * se pueda ver.
 *
 * Devuelve la función de parada de la animación, o null.
 */
export function pintarCubiletes(raiz, modelo, opciones = {}) {
  if (!raiz?.querySelectorAll) return null;
  const rodar = opciones.rodar ?? hayTiradaNueva(modelo);
  let parar = null;
  for (const lienzo of raiz.querySelectorAll("[data-cubilete]")) {
    const userId = lienzo.dataset?.cubilete;
    const jugador = modelo.jugadores?.find((j) => j.userId === userId);
    if (!jugador) continue;
    // Tras el destape se ven los valores de todos; antes, solo los propios. Un
    // cubilete sin valores se pinta como cubos lisos: no es un dado tapado, es
    // que sus valores no han llegado hasta aquí.
    const valores = jugador.destapado ?? jugador.valores ?? null;
    const comun = { valores, cantidad: jugador.dados ?? 0, epoca: opciones.epoca };
    if (rodar && jugador.eresTu && valores) {
      parar = (opciones.rodarDados ?? rodarDados)(lienzo, comun);
    } else {
      (opciones.pintarCubilete ?? pintarCubilete)(lienzo, comun);
    }
  }
  if (rodar) huellaTirada = huellaDe(modelo);
  return parar;
}

/* Traduce un clic en propuesta. `proponer` se inyecta (es el cableado) para que
 * esta ventana no importe el transporte. */
export function alPulsar(objetivo, elemento, proponer) {
  const tipo = objetivo?.dataset?.accion;
  if (!tipo) return;
  if (!tipo.startsWith("act:")) {
    proponer({ tipo });
    return;
  }
  const deJuego = tipo.slice("act:".length);
  if (deJuego !== "apostar") {
    proponer({ tipo: "act", parametros: { tipo: deJuego, parametros: {} } });
    return;
  }
  const cantidad = Number.parseInt(
    elemento?.querySelector?.("input[name='cantidad']")?.value ?? "",
    10,
  );
  const cara = Number.parseInt(
    elemento?.querySelector?.("select[name='cara']")?.value ?? "",
    10,
  );
  if (!Number.isInteger(cantidad) || cantidad <= 0 || !Number.isInteger(cara)) {
    ui.notifications?.warn(game.i18n.localize("LAGUNAK.Dados.Mesa.ApuestaInvalida"));
    return;
  }
  proponer({ tipo: "act", parametros: { tipo: "apostar", parametros: { cantidad, cara } } });
}

/* ---- v12+ --------------------------------------------------------------- */

export function crearClaseMesaDadosV2({ proponer, alCerrar = () => {} }) {
  const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

  return class MesaDadosAppV2 extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "lagunak-mesa-dados",
      classes: ["lagunak-mesa", "lagunak-dados"],
      window: { title: "LAGUNAK.Dados.Mesa.Titulo", icon: "fa-solid fa-dice" },
      position: { width: 520, height: "auto" },
    };

    static PARTS = { main: { template: PLANTILLA } };

    async _prepareContext(_options) {
      this.modelo = contexto();
      return this.modelo;
    }

    _onRender(context, options) {
      super._onRender?.(context, options);
      this.element?.querySelectorAll?.("[data-accion]")?.forEach((boton) => {
        boton.addEventListener("click", () => alPulsar(boton, this.element, proponer));
      });
      // Una animación viva cuando llega el render siguiente se corta: dos
      // bucles pintando el mismo lienzo se pisan y el dado tiembla.
      this.pararTirada?.();
      this.pararTirada = pintarCubiletes(this.element, context);
    }

    _onClose(options) {
      super._onClose?.(options);
      this.pararTirada?.();
      alCerrar(this);
    }
  };
}

/* ---- v11 ---------------------------------------------------------------- */

export function crearClaseMesaDadosV1({ proponer, alCerrar = () => {} }) {
  return class MesaDadosAppV1 extends Application {
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "lagunak-mesa-dados",
        classes: ["lagunak-mesa", "lagunak-dados"],
        title: game.i18n.localize("LAGUNAK.Dados.Mesa.Titulo"),
        template: PLANTILLA,
        width: 520,
        height: "auto",
      });
    }

    getData(_options) {
      this.modelo = contexto();
      return this.modelo;
    }

    activateListeners(html) {
      super.activateListeners(html);
      html.find("[data-accion]").on("click", (ev) => {
        alPulsar(ev.currentTarget, html[0], proponer);
      });
      this.pararTirada?.();
      this.pararTirada = pintarCubiletes(html[0], this.modelo);
    }

    async close(options) {
      this.pararTirada?.();
      alCerrar(this);
      return super.close(options);
    }
  };
}
