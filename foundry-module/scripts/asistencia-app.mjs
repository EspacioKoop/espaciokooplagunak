/* Ventana de asistencia entre puestos (#309): la interfaz que faltaba sobre un
 * motor entero ya probado (`scripts/asistencia/`) y ya cableado
 * (`asistencia-wiring.mjs`). Es la rebanada mínima del diseño
 * (docs/MINIJUEGOS_ASISTENCIA.md): elegir a quién ayudar, ver el rango de
 * éxito ANTES de comprometerse, tirar o jugar el reto de destreza, y esperar
 * a que el titular decida si gasta la ayuda.
 *
 * Capa fina y deliberadamente tonta, igual que el resto del módulo: lo que se
 * PUEDE hacer (qué tareas, qué enfoques, qué banda) lo decide el motor puro;
 * esta ventana solo pinta lo que llega por los hooks de `asistencia-wiring.mjs`
 * y traduce un clic en una llamada a `pedirAsistencia`/`resolverAsistencia`.
 * Nunca importa `station-*` ni un cliente del puente — si algún día lo hiciera,
 * el error estaría aquí.
 *
 * Dos clases hermanas, como el resto del módulo: `Application` clásica en v11
 * y `ApplicationV2` en v12+, sin código de ventana compartido a propósito.
 */

import { MODULE_ID } from "./lagunak-constantes.mjs";
import { FASES, asistenciaVista, bandaDeTirada } from "./asistencia/asistencia-vista.mjs";
import { crearReto, resolverExpiracion, resolverPulsacion } from "./asistencia/temporizacion.mjs";
import {
  HOOK_OFERTA,
  HOOK_RECHAZO,
  HOOK_RESULTADO,
  pedirAsistencia,
  resolverAsistencia,
  tareasCatalogo,
} from "./asistencia-wiring.mjs";
import { normalizeStation } from "./station-assignment.mjs";
import { describirFoco, restaurarFoco } from "./foco-render.mjs";

const PLANTILLA = `modules/${MODULE_ID}/templates/asistencia.hbs`;

/**
 * Ritmo de repintado del reto de temporización. La PRECISIÓN de una pulsación
 * se mide con el reloj real en el instante del clic (`resolverPulsacion`),
 * nunca con este tic: un repintado más lento hace el reto menos fluido de
 * ver, no menos justo de jugar.
 */
const INTERVALO_RETO_MS = 100;

function ahora() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function puestoPropio() {
  return normalizeStation(game.user?.getFlag?.(MODULE_ID, "station") ?? null);
}

/** Estado inicial de una ventana recién abierta: nadie pidiendo nada todavía. */
function estadoInicial() {
  return {
    fase: FASES.LISTA,
    tareaId: null,
    nonce: null,
    oferta: null,
    reto: null,
    resultado: null,
    rechazo: null,
  };
}

/** Contexto de plantilla a partir del estado de la ventana, ya localizado. */
function contexto(estado) {
  const modelo = asistenciaVista({
    tareas: tareasCatalogo(),
    puestoPropio: puestoPropio(),
    fase: estado.fase,
    tareaId: estado.tareaId,
    oferta: estado.oferta,
    reto: estado.reto,
    tMs: ahora(),
    resultado: estado.resultado,
    rechazo: estado.rechazo,
  });
  const textoBanda = (banda) =>
    banda ? game.i18n.localize(`LAGUNAK.Asistencia.Banda.${banda}`) : "";
  return {
    ...modelo,
    // Las plantillas del módulo no usan subexpresiones de Handlebars (`eq`,
    // `concat`): cada fase se resuelve aquí en un booleano propio.
    esLista: modelo.fase === FASES.LISTA,
    esEsperando: modelo.fase === FASES.ESPERANDO,
    esOferta: modelo.fase === FASES.OFERTA,
    esReto: modelo.fase === FASES.RETO,
    esResultado: modelo.fase === FASES.RESULTADO,
    esRechazo: modelo.fase === FASES.RECHAZO,
    tareas: modelo.tareas
      .filter((tarea) => !tarea.propia)
      .map((tarea) => ({
        ...tarea,
        nombre: game.i18n.localize(tarea.claveNombre),
        puestoTexto: game.i18n.localize(`LAGUNAK.Puestos.${tarea.puesto}`),
      })),
    oferta: modelo.oferta && {
      ...modelo.oferta,
      enfoques: modelo.oferta.enfoques.map((enfoque) => ({
        ...enfoque,
        nombre: game.i18n.localize(enfoque.claveNombre),
        esBandaFija: enfoque.via === "banda-fija",
        bandaFijaTexto: enfoque.bandaFija ? textoBanda(enfoque.bandaFija) : null,
        // El porcentaje se calcula aquí porque `game.i18n.format` no formatea
        // números: la plantilla solo interpola texto ya hecho.
        favorablePorcentaje: Number.isFinite(enfoque.favorable) ? Math.round(enfoque.favorable * 100) : null,
        distribucion: enfoque.distribucion?.map((banda) => ({
          ...banda,
          porcentaje: Math.round(banda.fraccion * 100),
          etiqueta: textoBanda(banda.banda),
        })),
      })),
    },
    reto: modelo.reto && {
      ...modelo.reto,
      zonaTexto: game.i18n.localize(`LAGUNAK.Asistencia.Reto.Zona.${modelo.reto.zona}`),
    },
    resultado: modelo.resultado && { ...modelo.resultado, bandaTexto: textoBanda(modelo.resultado.banda) },
    rechazo: modelo.rechazo && {
      ...modelo.rechazo,
      texto: game.i18n.localize(`LAGUNAK.Asistencia.Error.${modelo.rechazo.codigo}`),
    },
  };
}

/**
 * Toda la máquina de estados vive aquí, fuera de las dos clases, para que las
 * dos rutas (v11/v12) compartan exactamente el mismo comportamiento y solo
 * difieran en cómo Foundry las monta. Recibe `estado` y lo MUTA — es cableado
 * de ventana, no lógica pura; la lógica pura ya vive en `asistencia/`.
 */
function crearMaquina(estado, pedirRender) {
  let intervalo = null;

  function pararTic() {
    if (intervalo) globalThis.clearInterval(intervalo);
    intervalo = null;
  }

  function arrancarTic() {
    pararTic();
    intervalo = globalThis.setInterval(() => {
      if (estado.fase !== FASES.RETO || !estado.reto) {
        pararTic();
        return;
      }
      // El reto se cierra solo al expirar: nadie puede dejarlo abierto
      // ocupando el presupuesto del puesto (mismo criterio que el motor).
      const restante = estado.reto.inicioMs + estado.reto.limiteMs - ahora();
      if (restante <= 0) {
        const resultado = resolverExpiracion();
        resolverAsistencia({ nonce: estado.nonce, banda: resultado.banda });
        pararTic();
        estado.fase = FASES.ESPERANDO;
      }
      pedirRender();
    }, INTERVALO_RETO_MS);
  }

  function volver() {
    pararTic();
    Object.assign(estado, estadoInicial());
    pedirRender();
  }

  function pedir(tareaId) {
    if (!tareaId) return;
    const nonce = pedirAsistencia(tareaId);
    if (!nonce) return;
    estado.tareaId = tareaId;
    estado.nonce = nonce;
    estado.fase = FASES.ESPERANDO;
    pedirRender();
  }

  function alOferta(carga) {
    if (!carga || carga.nonce !== estado.nonce) return;
    estado.oferta = carga.oferta;
    if (carga.oferta?.via === "destreza") {
      // El motor ya dijo «destreza»: no hay enfoques que elegir, se juega el
      // reto directamente. La semilla es el nonce: reproducible por cliente,
      // sin depender de un reloj propio (contrato de #308).
      estado.reto = crearReto({ semilla: estado.nonce, dificultad: "normal", inicioMs: ahora() });
      estado.fase = FASES.RETO;
      arrancarTic();
    } else {
      estado.fase = FASES.OFERTA;
    }
    pedirRender();
  }

  function alResultado(carga) {
    if (!carga) return;
    pararTic();
    estado.resultado = carga;
    estado.fase = FASES.RESULTADO;
    pedirRender();
  }

  function alRechazo(carga) {
    if (!carga) return;
    pararTic();
    estado.rechazo = carga;
    estado.fase = FASES.RECHAZO;
    pedirRender();
  }

  /** Enfoque con tirada (clases a/b): el total lo escribe quien ayuda. */
  function tirarEnfoque(enfoqueId, total) {
    const entrada = estado.oferta?.enfoques?.find((e) => e.enfoque.id === enfoqueId);
    if (!entrada) return;
    if (entrada.rango.via !== "banda-fija" && !Number.isInteger(total)) {
      ui.notifications?.warn(game.i18n.localize("LAGUNAK.Asistencia.TotalInvalido"));
      return;
    }
    const banda =
      entrada.rango.via === "banda-fija"
        ? entrada.rango.bandaFija
        : bandaDeTirada({ rango: entrada.rango, total });
    resolverAsistencia({ nonce: estado.nonce, banda, enfoqueId });
    estado.fase = FASES.ESPERANDO;
    pedirRender();
  }

  /** Suelta el reto de temporización en el instante actual. */
  function pulsarReto() {
    if (estado.fase !== FASES.RETO || !estado.reto) return;
    const resultado = resolverPulsacion(estado.reto, ahora());
    resolverAsistencia({ nonce: estado.nonce, banda: resultado.banda });
    pararTic();
    estado.fase = FASES.ESPERANDO;
    pedirRender();
  }

  return { pedir, alOferta, alResultado, alRechazo, tirarEnfoque, pulsarReto, volver, pararTic };
}

/** Traduce un clic en la acción de la máquina de estados que le corresponde. */
function alPulsar(boton, raiz, maquina) {
  const accion = boton?.dataset?.action;
  if (!accion) return;
  if (accion === "pedir-asistencia") {
    maquina.pedir(boton.dataset.tarea);
  } else if (accion === "tirar-enfoque") {
    const enfoqueId = boton.dataset.enfoque;
    const campo = raiz?.querySelector?.(`[data-total-de="${enfoqueId}"]`);
    const total = campo ? Number.parseInt(campo.value, 10) : null;
    maquina.tirarEnfoque(enfoqueId, Number.isInteger(total) ? total : null);
  } else if (accion === "pulsar-reto") {
    maquina.pulsarReto();
  } else if (accion === "volver") {
    maquina.volver();
  }
}

function engancharHooks(maquina) {
  const oferta = (carga) => maquina.alOferta(carga);
  const resultado = (carga) => maquina.alResultado(carga);
  const rechazo = (carga) => maquina.alRechazo(carga);
  Hooks.on(HOOK_OFERTA, oferta);
  Hooks.on(HOOK_RESULTADO, resultado);
  Hooks.on(HOOK_RECHAZO, rechazo);
  return () => {
    Hooks.off(HOOK_OFERTA, oferta);
    Hooks.off(HOOK_RESULTADO, resultado);
    Hooks.off(HOOK_RECHAZO, rechazo);
  };
}

/* ---- v12+ ------------------------------------------------------------- */

export function crearClaseAsistenciaV2() {
  const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

  return class AsistenciaAppV2 extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "lagunak-asistencia",
      classes: ["lagunak-asistencia"],
      window: { title: "LAGUNAK.Asistencia.Titulo", icon: "fa-solid fa-hands-helping" },
      position: { width: 480, height: "auto" },
    };

    static PARTS = { main: { template: PLANTILLA } };

    constructor(...args) {
      super(...args);
      this._estado = estadoInicial();
      this._maquina = crearMaquina(this._estado, () => this.render());
      this._desenganchar = engancharHooks(this._maquina);
    }

    async _prepareContext(_options) {
      return contexto(this._estado);
    }

    _onRender(context, options) {
      super._onRender?.(context, options);
      const descriptor = this._foco;
      this.element?.querySelectorAll?.("[data-action]")?.forEach((boton) => {
        boton.addEventListener("click", () => {
          this._foco = describirFoco(this.element?.ownerDocument?.activeElement, this.element);
          alPulsar(boton, this.element, this._maquina);
        });
      });
      restaurarFoco(this.element, descriptor);
    }

    _onClose(options) {
      super._onClose?.(options);
      this._maquina.pararTic();
      this._desenganchar();
    }
  };
}

/* ---- v11 ---------------------------------------------------------------- */

export function crearClaseAsistenciaV1() {
  return class AsistenciaAppV1 extends Application {
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "lagunak-asistencia",
        classes: ["lagunak-asistencia"],
        title: game.i18n.localize("LAGUNAK.Asistencia.Titulo"),
        template: PLANTILLA,
        width: 480,
        height: "auto",
      });
    }

    constructor(...args) {
      super(...args);
      this._estado = estadoInicial();
      this._maquina = crearMaquina(this._estado, () => this.render());
      this._desenganchar = engancharHooks(this._maquina);
    }

    getData(_options) {
      return contexto(this._estado);
    }

    activateListeners(html) {
      super.activateListeners(html);
      const raiz = html?.[0];
      const descriptor = this._foco;
      html.find("[data-action]").on("click", (ev) => {
        this._foco = describirFoco(raiz?.ownerDocument?.activeElement, raiz);
        alPulsar(ev.currentTarget, raiz, this._maquina);
      });
      restaurarFoco(raiz, descriptor);
    }

    async close(options) {
      this._maquina.pararTic();
      this._desenganchar();
      return super.close(options);
    }
  };
}
