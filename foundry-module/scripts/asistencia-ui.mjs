// La ventana del asistente (#309): por fin hay dónde pulsar.
//
// El camino estaba completo de extremo a extremo —petición por flag del propio
// `User`, coordinación en el GM, respuesta por socket dirigido, consumo dentro
// de la orden del titular— y no existía una sola superficie para usarlo. Esto no
// añade mecánica: solo conecta la que ya está.
//
// ## Qué NO hace, y es deliberado
//
// No decide nada. No calcula bandas, no reparte tokens y no habla con el puente.
// Cada gesto de aquí acaba en `pedirAsistencia` o `resolverAsistencia`, que
// escriben una bandera en el propio usuario; **la autoridad sigue entera en el
// GM coordinador**. Si esta ventana mintiera sobre lo que ha logrado, el motor
// del GM la desmentiría, y esa es exactamente la propiedad que no se toca.
//
// ## La máquina de estados vive aquí y el dibujo en `asistencia/vista.mjs`
//
// Este archivo tiene lo que Foundry impone: hooks, ventana, rAF y DOM. Lo que se
// puede razonar sin Foundry —qué se pinta en cada fase— está al lado, es puro y
// tiene pruebas.
//
// ## Por qué el reto se repinta a mano y no re-renderizando
//
// El cursor se mueve a 60 Hz. Un `render()` de Foundry por fotograma reconstruye
// la ventana entera, tira el foco del teclado y convierte un minijuego de
// precisión en una presentación de diapositivas. Se toca el DOM de la barra
// directamente y se deja el render para los cambios de fase, que son cuatro.

import {
  HOOK_OFERTA,
  HOOK_RECHAZO,
  HOOK_RESULTADO,
  pedirAsistencia,
  resolverAsistencia,
  tareasParaPuesto,
} from "./asistencia-wiring.mjs";
import { STATIONS } from "./station-assignment.mjs";
import { crearReto, resolverExpiracion, resolverPulsacion } from "./asistencia/temporizacion.mjs";
import { FASES, vistaCierre, vistaOferta, vistaReto, vistaTareas } from "./asistencia/vista.mjs";

let moduloConfigurado = null;
let ventana = null;

/**
 * Todo el estado de la ventana, en un sitio. Se reinicia entero al volver al
 * menú: arrastrar media oferta de la petición anterior es cómo se acaba
 * resolviendo un nonce que ya no existe.
 */
const estado = {
  fase: FASES.MENU,
  nonce: null,
  tareaId: null,
  oferta: null,
  cierre: null,
  reto: null,
  enfoqueId: null,
  bucle: null,
};

function reiniciar() {
  detenerBucle();
  Object.assign(estado, {
    fase: FASES.MENU,
    nonce: null,
    tareaId: null,
    oferta: null,
    cierre: null,
    reto: null,
    enfoqueId: null,
  });
}

/**
 * ¿Esta respuesta contesta a lo que esta ventana está esperando AHORA?
 *
 * Las tres respuestas del coordinador llegan por socket dirigido, así que son
 * para nosotros; lo que no garantizan es que sean para la petición viva. Una
 * caducidad que se anuncia tarde, o el rechazo de algo que ya se abandonó con
 * «volver», llegarían igual y cerrarían de golpe un menú limpio o —peor— la
 * petición SIGUIENTE, que no tiene nada que ver. Sin nonce vivo no hay nada que
 * cerrar, y con nonce distinto la respuesta es de otra conversación.
 */
function esDeLaPeticionViva(carga) {
  return Boolean(carga) && estado.nonce !== null && carga.nonce === estado.nonce;
}

export function registrarAsistenciaUI(moduleId) {
  moduloConfigurado = moduleId;

  // Las tres respuestas del coordinador. Se escuchan SIEMPRE, aunque la ventana
  // esté cerrada: quien pide ayuda y cierra la ventana sin querer no debe
  // quedarse con una reserva viva y ninguna forma de resolverla.
  Hooks.on(HOOK_OFERTA, (carga) => {
    if (!esDeLaPeticionViva(carga)) return;
    estado.oferta = vistaOferta(carga.oferta);
    estado.fase = estado.oferta ? FASES.OFERTA : FASES.MENU;
    repintar();
  });

  Hooks.on(HOOK_RESULTADO, (carga) => {
    if (!esDeLaPeticionViva(carga)) return;
    estado.cierre = vistaCierre({ propuesta: carga.propuesta ?? null });
    estado.fase = FASES.CERRADA;
    detenerBucle();
    repintar();
  });

  Hooks.on(HOOK_RECHAZO, (carga) => {
    if (!esDeLaPeticionViva(carga)) return;
    estado.cierre = vistaCierre({ rechazo: carga.codigo ?? "desconocido" });
    estado.fase = FASES.CERRADA;
    detenerBucle();
    repintar();
  });
}

/** Contexto de la ventana. Separado del render para poder probarlo sin Foundry. */
export function contextoAsistencia({ tareas = tareasDisponibles() } = {}) {
  return {
    fase: estado.fase,
    enMenu: estado.fase === FASES.MENU,
    esperando: estado.fase === FASES.ESPERANDO,
    enOferta: estado.fase === FASES.OFERTA,
    enReto: estado.fase === FASES.RETO,
    cerrada: estado.fase === FASES.CERRADA,
    tareas: vistaTareas(tareas),
    oferta: estado.oferta,
    cierre: estado.cierre,
    reto: estado.reto ? vistaReto(estado.reto, ahora()) : null,
  };
}

/**
 * Las tareas con las que se puede ayudar hoy: las de TODOS los puestos, no las
 * del propio. Ayudar es cruzar de puesto por definición; filtrar por el tuyo
 * dejaría la lista vacía justo para quien más ganas tiene de echar una mano.
 */
function tareasDisponibles() {
  return STATIONS.flatMap((puesto) => tareasParaPuesto(puesto));
}

function ahora() {
  return Date.now();
}

// --- Gestos ------------------------------------------------------------------

/**
 * Abrir una petición de ayuda. Es el único punto por el que nace un nonce, y se
 * exporta porque la correlación de respuestas no se puede probar sin él: un test
 * que fabricara el nonce a mano estaría probando otra máquina de estados.
 */
export function pedirDesdeVentana(tareaId) {
  if (estado.fase !== FASES.MENU) return;
  const nonce = pedirAsistencia(tareaId);
  if (!nonce) return;
  Object.assign(estado, { nonce, tareaId, fase: FASES.ESPERANDO, cierre: null });
  repintar();
}

/**
 * Elegir enfoque. Los que no exigen tirada se cierran al momento: su banda la
 * fija el motor, así que pedir un gesto extra sería teatro.
 *
 * Exportada por la misma razón que `pedirDesdeVentana`: el gesto solo existe
 * colgado del DOM, y una máquina de estados que solo se puede pulsar dentro de
 * Foundry es una máquina de estados sin pruebas.
 */
export function elegirEnfoqueDesdeVentana(enfoqueId) {
  if (estado.fase !== FASES.OFERTA) return;
  const enfoque = estado.oferta?.enfoques?.find((e) => e.id === enfoqueId);
  if (!enfoque) return;
  estado.enfoqueId = enfoqueId;

  if (!enfoque.conTirada) {
    // Se sale de OFERTA ANTES de enviar, igual que hace `cerrarReto`. Quedarse
    // en OFERTA deja los botones de enfoque vivos mientras vuela la respuesta:
    // el segundo clic manda un `resolver` para un nonce cuya reserva el motor ya
    // gastó, y lo que vuelve es un rechazo que cierra en falso una ayuda que en
    // realidad salió bien. Además, sin repintar no hay ni una señal de que el
    // clic haya hecho algo.
    estado.fase = FASES.ESPERANDO;
    repintar();
    resolverAsistencia({ nonce: estado.nonce, banda: enfoque.bandaFija, enfoqueId });
    return;
  }

  // La semilla sale del nonce, que lo repartió el coordinador: el reto es el
  // mismo que habría salido en cualquier otra pantalla, y nadie puede repetirlo
  // hasta que le toque una zona cómoda.
  estado.reto = crearReto({ semilla: `${estado.nonce}:${enfoqueId}`, inicioMs: ahora() });
  estado.fase = FASES.RETO;
  repintar();
  arrancarBucle();
}

function alPulsar() {
  if (estado.fase !== FASES.RETO || !estado.reto) return;
  const resultado = resolverPulsacion(estado.reto, ahora());
  cerrarReto(resultado);
}

function cerrarReto(resultado) {
  detenerBucle();
  estado.fase = FASES.ESPERANDO;
  repintar();
  // El veredicto lo dicta el GM: aquí solo se envía la banda lograda y se espera.
  resolverAsistencia({ nonce: estado.nonce, banda: resultado.banda, enfoqueId: estado.enfoqueId });
}

// --- El bucle del reto -------------------------------------------------------

function detenerBucle() {
  if (estado.bucle === null) return;
  globalThis.cancelAnimationFrame?.(estado.bucle);
  estado.bucle = null;
}

function arrancarBucle() {
  detenerBucle();
  // Sin `requestAnimationFrame` (v11 en algunos hosts, y los tests) el reto no
  // se anima, pero SIGUE siendo jugable: la barra se queda quieta y la pulsación
  // se resuelve igual contra el reloj. Degradar es preferible a no ofrecerlo.
  if (typeof globalThis.requestAnimationFrame !== "function") return;

  const paso = () => {
    if (estado.fase !== FASES.RETO || !estado.reto) return;
    const vista = vistaReto(estado.reto, ahora());
    pintarBarra(vista);
    if (vista.lectura.expirado) {
      // Se cierra solo: nadie puede dejar una asistencia abierta ocupando el
      // presupuesto del puesto indefinidamente.
      cerrarReto(resolverExpiracion());
      return;
    }
    estado.bucle = globalThis.requestAnimationFrame(paso);
  };
  estado.bucle = globalThis.requestAnimationFrame(paso);
}

/**
 * Repinta SOLO la barra, sin re-renderizar. Exportada para poder probar que
 * mueve lo que dice mover sin levantar una ventana de Foundry.
 */
export function pintarBarra(vista, raiz = ventana?.element) {
  const nodo = raizReal(raiz);
  if (!nodo || !vista) return null;
  const cursor = nodo.querySelector?.("[data-asistencia-cursor]");
  const zona = nodo.querySelector?.("[data-asistencia-zona]");
  const lectura = nodo.querySelector?.("[data-asistencia-lectura]");

  if (cursor) {
    cursor.style.left = `${vista.cursor}%`;
    // El estado no viaja solo por color: la clase mueve el color y el
    // `aria-*` lleva el mismo dato en texto, por la misma razón que el aviso de
    // alerta acompaña siempre al borde.
    cursor.classList.toggle("lagunak-asistencia__cursor--dentro", vista.dentro);
  }
  if (zona) {
    zona.style.left = `${vista.zonaDesde}%`;
    zona.style.width = `${vista.zonaAncho}%`;
  }
  if (lectura) {
    const texto = game?.i18n?.format?.("LAGUNAK.Asistencia.Reto.Lectura", {
      zona: game.i18n.localize(`LAGUNAK.Asistencia.Reto.Zona.${vista.lectura.zona}`),
      segundos: vista.lectura.segundosRestantes,
    });
    if (texto && lectura.textContent !== texto) lectura.textContent = texto;
  }
  return vista;
}

// `element` es un HTMLElement en ApplicationV2 y un jQuery en la V1 clásica.
function raizReal(raiz) {
  if (!raiz) return null;
  return typeof raiz.querySelector === "function" ? raiz : (raiz[0] ?? null);
}

function repintar() {
  if (!ventana?.rendered) return;
  if (foundry.applications?.api?.ApplicationV2) ventana.render({ force: true });
  else ventana.render(false);
}

function conectar(raiz) {
  const nodo = raizReal(raiz);
  nodo?.querySelectorAll?.("[data-asistencia-tarea]").forEach((boton) => {
    boton.addEventListener("click", () => pedirDesdeVentana(boton.dataset.asistenciaTarea));
  });
  nodo?.querySelectorAll?.("[data-asistencia-enfoque]").forEach((boton) => {
    boton.addEventListener("click", () => elegirEnfoqueDesdeVentana(boton.dataset.asistenciaEnfoque));
  });
  nodo?.querySelector?.("[data-asistencia-pulsar]")?.addEventListener("click", alPulsar);
  nodo?.querySelector?.("[data-asistencia-volver]")?.addEventListener("click", () => {
    reiniciar();
    repintar();
  });
}

// --- Ventana y control -------------------------------------------------------

export function addAsistenciaControl(controls) {
  const tool = {
    name: "lagunak-asistencia",
    title: "LAGUNAK.Asistencia.Control",
    icon: "fa-solid fa-hands-helping",
    button: true,
    onClick: () => abrirAsistencia(),
  };

  if (Array.isArray(controls)) {
    const grupo = controls.find?.((group) => group.name === "lagunak");
    if (grupo) grupo.tools.push(tool);
    return;
  }

  const group = controls?.lagunak;
  if (group?.tools && !Array.isArray(group.tools)) {
    group.tools[tool.name] = { ...tool, order: Object.keys(group.tools).length, onChange: tool.onClick };
  }
}

export function abrirAsistencia() {
  if (!moduloConfigurado) return;
  ventana ??= new (claseVentana())();
  if (foundry.applications?.api?.ApplicationV2) ventana.render({ force: true });
  else ventana.render(true);
}

function claseVentana() {
  return foundry.applications?.api?.ApplicationV2 ? crearClaseV2() : crearClaseV1();
}

function crearClaseV2() {
  const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
  return class AsistenciaV2 extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "lagunak-asistencia",
      classes: ["lagunak-asistencia"],
      window: { title: "LAGUNAK.Asistencia.Titulo", icon: "fa-solid fa-hands-helping" },
      position: { width: 460, height: "auto" },
    };

    static PARTS = { main: { template: `modules/${moduloConfigurado}/templates/asistencia.hbs` } };

    async _prepareContext() {
      return contextoAsistencia();
    }

    _onRender(contextData, options) {
      super._onRender?.(contextData, options);
      conectar(this.element);
    }

    _onClose(options) {
      // Cerrar la ventana no cancela la ayuda —la reserva es del coordinador—
      // pero sí para el bucle: un rAF corriendo sobre una ventana cerrada es
      // trabajo por nada hasta que caduque.
      detenerBucle();
      super._onClose?.(options);
    }
  };
}

function crearClaseV1() {
  return class AsistenciaV1 extends Application {
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "lagunak-asistencia",
        classes: ["lagunak-asistencia"],
        template: `modules/${moduloConfigurado}/templates/asistencia.hbs`,
        width: 460,
        height: "auto",
        resizable: true,
      });
    }

    get title() {
      return game.i18n.localize("LAGUNAK.Asistencia.Titulo");
    }

    getData() {
      return contextoAsistencia();
    }

    activateListeners(html) {
      super.activateListeners(html);
      conectar(html);
    }

    async close(options) {
      detenerBucle();
      return super.close(options);
    }
  };
}

/** Solo para pruebas: deja la máquina de estados en el arranque. */
export function _reiniciarParaPruebas() {
  reiniciar();
  ventana = null;
}
