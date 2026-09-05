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
// El cursor de temporización se mueve a 60 Hz. Un `render()` de Foundry por
// fotograma reconstruye la ventana entera, tira el foco del teclado y
// convierte un minijuego de precisión en una presentación de diapositivas. Se
// toca el DOM de la barra directamente y se deja el render para los cambios
// de fase.
//
// ## Varios motores de destreza, no uno (#500)
//
// Junto a la temporización (reflejos) están la secuencia (memoria de orden),
// la precisión (puntería sin reloj) y el puzzle (deducción sobre un patrón
// siempre visible). Ninguna de las tres se mueve a 60 Hz —la secuencia
// cambia de símbolo unas pocas veces por segundo, la precisión no se mueve
// en absoluto, el puzzle solo cuando alguien toca una casilla o envía—, así
// que las tres usan `render()` completo en cada cambio: es barato a esa
// cadencia y evita duplicar el parcheo manual de DOM que sí necesita la
// barra de temporización. Qué motor usar lo decide la tarea
// (`minijuegoDestreza` en el catálogo), no quien ayuda.

import {
  cerrarCrisisDeMando,
  HOOK_ORDEN_MANDO,
  HOOK_OFERTA,
  HOOK_RECHAZO,
  HOOK_RESULTADO,
  iniciarCrisisDeMando,
  pedirAsistencia,
  pedirOrdenMando,
  resolverAsistencia,
  sincronizarEstadoMando,
  tareasParaPuesto,
} from "./asistencia-wiring.mjs";
import { STATIONS, normalizeStation } from "./station-assignment.mjs";
import {
  crearReto as crearRetoTemporizacion,
  resolverExpiracion as resolverExpiracionTemporizacion,
  resolverPulsacion,
} from "./asistencia/temporizacion.mjs";
import {
  crearReto as crearRetoSecuencia,
  resolverIntentos as resolverIntentosSecuencia,
} from "./asistencia/secuencia.mjs";
import {
  crearReto as crearRetoPrecision,
  resolverClic as resolverClicPrecision,
  resolverExpiracion as resolverExpiracionPrecision,
} from "./asistencia/precision.mjs";
import {
  crearReto as crearRetoPuzzle,
  resolverEnvio as resolverEnvioPuzzle,
  resolverExpiracion as resolverExpiracionPuzzle,
} from "./asistencia/puzzle.mjs";
import {
  FASES,
  vistaCierre,
  vistaOferta,
  vistaReto,
  vistaRetoPrecision,
  vistaRetoPuzzle,
  vistaRetoSecuencia,
  vistaTareas,
} from "./asistencia/vista.mjs";
import { esTareaDePropuesta } from "./asistencia/enfoques.mjs";
import { anadirHerramienta } from "./control-escena.mjs";

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
  // "temporizacion" | "secuencia" | "puzzle" | null. Fija qué motor y qué
  // plantilla del reto se usan; no se puede leer del `reto` en sí porque
  // cada motor devuelve objetos con forma distinta a propósito (#500).
  tipoReto: null,
  // Solo lo usa la secuencia: los símbolos pulsados en orden hasta ahora. La
  // temporización no acumula nada entre pulsaciones.
  intentos: [],
  // Solo lo usa el puzzle: qué casillas están encendidas AHORA (se puede
  // seguir tocando entre envíos), y el resultado del último envío, para dar
  // pista sin cerrar el reto.
  panel: [],
  ultimoIntentoPuzzle: null,
  enfoqueId: null,
  mando: Object.freeze({ crisisActiva: false, disponibles: 0, ventajaActiva: null }),
  mandoNonce: null,
  mandoError: null,
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
    tipoReto: null,
    intentos: [],
    panel: [],
    ultimoIntentoPuzzle: null,
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

function puestoValido(puesto) {
  try {
    return normalizeStation(puesto);
  } catch {
    return null;
  }
}

function puestoActual() {
  return puestoValido(game.user?.getFlag?.(moduloConfigurado, "station") ?? null);
}

function actualizarMando(mando) {
  if (!mando || typeof mando !== "object") return false;
  const puestoAsistido = puestoValido(mando.ventajaActiva?.puestoAsistido);
  estado.mando = Object.freeze({
    crisisActiva: Boolean(mando.crisisActiva),
    disponibles: Number.isSafeInteger(mando.disponibles) && mando.disponibles >= 0 ? mando.disponibles : 0,
    ventajaActiva: puestoAsistido ? Object.freeze({ puestoAsistido }) : null,
  });
  return true;
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

  Hooks.on(HOOK_ORDEN_MANDO, (carga) => {
    if (!actualizarMando(carga?.mando)) return;
    if (estado.mandoNonce !== null && carga?.nonce === estado.mandoNonce) {
      estado.mandoNonce = null;
      estado.mandoError = carga.ok ? null : (carga.error ?? "desconocido");
    }
    repintar();
  });
}

/** Contexto de la ventana. Separado del render para poder probarlo sin Foundry. */
export function contextoAsistencia({ tareas = tareasDisponibles() } = {}) {
  const tareasVista = vistaTareas(tareas);
  const esGM = Boolean(game.user?.isGM);
  const esCapitan = puestoActual() === "captain";
  const mandoVisible = estado.mando.crisisActiva && (esCapitan || esGM);
  const puestosMando = [...new Set(tareas.filter(esTareaDePropuesta).map((tarea) => tarea.puestoAsistido))]
    .map((id) => ({ id, claveNombre: `LAGUNAK.Puestos.${id}` }));
  return {
    fase: estado.fase,
    enMenu: estado.fase === FASES.MENU,
    esperando: estado.fase === FASES.ESPERANDO,
    enOferta: estado.fase === FASES.OFERTA,
    // La vía «destreza» no tiene enfoques que elegir (la oferta llega con la
    // lista vacía): en esa vía la ventana ofrece un único botón que empieza
    // el reto directamente, no una lista.
    ofertaEsDestreza: estado.fase === FASES.OFERTA && estado.oferta?.via === "destreza",
    enReto: estado.fase === FASES.RETO,
    retoEsSecuencia: estado.fase === FASES.RETO && estado.tipoReto === "secuencia",
    retoEsPrecision: estado.fase === FASES.RETO && estado.tipoReto === "precision",
    retoEsPuzzle: estado.fase === FASES.RETO && estado.tipoReto === "puzzle",
    retoEsTemporizacion: estado.fase === FASES.RETO && estado.tipoReto === "temporizacion",
    cerrada: estado.fase === FASES.CERRADA,
    tareas: tareasVista,
    oferta: estado.oferta,
    cierre: estado.cierre,
    reto: vistaDelRetoActual(),
    esGM,
    esCapitan,
    mandoVisible,
    mando: estado.mando,
    mandoPendiente: estado.mandoNonce !== null,
    mandoErrorClave: estado.mandoError ? `LAGUNAK.Asistencia.Mando.Error.${estado.mandoError}` : null,
    mandoVentajaClavePuesto: estado.mando.ventajaActiva
      ? `LAGUNAK.Puestos.${estado.mando.ventajaActiva.puestoAsistido}`
      : null,
    puedeOrdenarMando: mandoVisible && estado.mando.disponibles > 0 &&
      estado.mando.ventajaActiva === null && estado.mandoNonce === null,
    puestosMando,
  };
}

/** Qué vista de reto corresponde al motor activo ahora mismo, o `null` fuera de FASES.RETO. */
function vistaDelRetoActual() {
  if (estado.fase !== FASES.RETO || !estado.reto) return null;
  if (estado.tipoReto === "secuencia") return vistaRetoSecuencia(estado.reto, estado.intentos, ahora());
  if (estado.tipoReto === "precision") return vistaRetoPrecision(estado.reto, ahora());
  if (estado.tipoReto === "puzzle") return vistaRetoPuzzle(estado.reto, estado.panel, estado.ultimoIntentoPuzzle, ahora());
  return vistaReto(estado.reto, ahora());
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

export function ordenarDesdeVentana(puestoAsistido) {
  const puesto = puestoValido(puestoAsistido);
  const contexto = contextoAsistencia();
  if (!puesto || !contexto.puedeOrdenarMando) return null;
  if (!contexto.puestosMando.some((candidato) => candidato.id === puesto)) return null;
  const nonce = pedirOrdenMando(puesto, {
    alFallar: (fallido) => {
      if (estado.mandoNonce !== fallido) return;
      estado.mandoNonce = null;
      estado.mandoError = "desconocido";
      repintar();
    },
  });
  if (!nonce) return null;
  estado.mandoNonce = nonce;
  estado.mandoError = null;
  repintar();
  return nonce;
}

export function iniciarCrisisDesdeVentana() {
  if (!game.user?.isGM) return null;
  return iniciarCrisisDeMando();
}

export function cerrarCrisisDesdeVentana() {
  if (!game.user?.isGM) return null;
  return cerrarCrisisDeMando();
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
  estado.reto = crearRetoTemporizacion({ semilla: `${estado.nonce}:${enfoqueId}`, inicioMs: ahora() });
  estado.tipoReto = "temporizacion";
  estado.fase = FASES.RETO;
  repintar();
  arrancarBucle();
}

/**
 * Empezar el reto de destreza directamente, sin elegir enfoque antes.
 *
 * Existe porque la vía «destreza» —sin ficha, o sin dnd5e— llega con la lista
 * de enfoques vacía a propósito (`resolucionDisponible`): no hay entre qué
 * elegir, así que la ventana no ofrece una lista de un solo botón, ofrece
 * empezar. Qué motor usar lo decidió la tarea, no quien ayuda.
 */
const CREADORES_RETO_DESTREZA = Object.freeze({
  secuencia: crearRetoSecuencia,
  precision: crearRetoPrecision,
  puzzle: crearRetoPuzzle,
  temporizacion: crearRetoTemporizacion,
});

export function empezarDestrezaDesdeVentana() {
  if (estado.fase !== FASES.OFERTA || estado.oferta?.via !== "destreza") return;
  estado.enfoqueId = null;
  const tipo = CREADORES_RETO_DESTREZA[estado.oferta.minijuegoDestreza] ? estado.oferta.minijuegoDestreza : "temporizacion";
  const semilla = `${estado.nonce}:destreza`;
  estado.tipoReto = tipo;
  estado.intentos = [];
  estado.panel = [];
  estado.ultimoIntentoPuzzle = null;
  estado.reto = CREADORES_RETO_DESTREZA[tipo]({ semilla, inicioMs: ahora() });
  estado.fase = FASES.RETO;
  repintar();
  arrancarBucle();
}

function alPulsar() {
  if (estado.fase !== FASES.RETO || estado.tipoReto !== "temporizacion" || !estado.reto) return;
  const resultado = resolverPulsacion(estado.reto, ahora());
  cerrarReto(resultado);
}

/**
 * Pulsar un símbolo del reto de secuencia. Cada pulsación se acumula sobre
 * las anteriores —el motor es puro y no recuerda nada por su cuenta— y solo
 * cierra el reto cuando `resolverIntentos` dice que la cadena ya se cerró:
 * completa, fallada, o el tiempo la cerró por su cuenta.
 */
export function elegirSimboloDesdeVentana(simbolo) {
  if (estado.fase !== FASES.RETO || estado.tipoReto !== "secuencia" || !estado.reto) return;
  estado.intentos = [...estado.intentos, Number(simbolo)];
  const resultado = resolverIntentosSecuencia(estado.reto, estado.intentos, ahora());
  if (resultado.cerrado) {
    cerrarReto(resultado);
    return;
  }
  repintar();
}

/**
 * Pulsar una posición del reto de precisión. A diferencia de la secuencia,
 * no hay nada que acumular: un único clic cierra el reto siempre, acierte o
 * no —no hay una segunda oportunidad que pedir—, así que aquí no hace falta
 * mirar si el resultado está «cerrado»: lo está por definición.
 */
export function elegirPosicionDesdeVentana(posicion) {
  if (estado.fase !== FASES.RETO || estado.tipoReto !== "precision" || !estado.reto) return;
  const resultado = resolverClicPrecision(estado.reto, Number(posicion), ahora());
  cerrarReto(resultado);
}

/**
 * Encender o apagar una casilla del puzzle. No resuelve nada por sí sola
 * —el patrón objetivo está siempre visible, así que tocar una casilla es
 * solo decidir, no arriesgar—: hace falta el gesto de enviar para que el
 * motor la juzgue.
 */
export function alternarCeldaDesdeVentana(indice) {
  if (estado.fase !== FASES.RETO || estado.tipoReto !== "puzzle" || !estado.reto) return;
  const i = Number(indice);
  const panel = [...estado.panel];
  panel[i] = !panel[i];
  estado.panel = panel;
  repintar();
}

/**
 * Enviar el panel actual a juicio. A diferencia de secuencia o precisión,
 * un envío que no acierta del todo NO cierra el reto —se puede seguir
 * ajustando dentro del límite de tiempo—; solo cierra cuando el motor dice
 * que el patrón es exacto, o cuando el tiempo ya se agotó.
 */
export function enviarPuzzleDesdeVentana() {
  if (estado.fase !== FASES.RETO || estado.tipoReto !== "puzzle" || !estado.reto) return;
  const resultado = resolverEnvioPuzzle(estado.reto, estado.panel, ahora());
  estado.ultimoIntentoPuzzle = resultado;
  if (resultado.cerrado) {
    cerrarReto(resultado);
    return;
  }
  repintar();
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

/**
 * El bucle repinta a dos ritmos distintos a propósito. La temporización se
 * mueve a 60 Hz y por eso pinta la barra a mano en cada fotograma —un
 * `render()` completo tiraría el foco 60 veces por segundo—. La secuencia
 * cambia de símbolo activo unas pocas veces por segundo, así que un
 * `render()` completo solo cuando ese símbolo (o la fase) cambia es barato y
 * más simple que replicar el mismo pintado a mano para un reto que no lo
 * necesita.
 */
function arrancarBucle() {
  detenerBucle();
  // Sin `requestAnimationFrame` (v11 en algunos hosts, y los tests) el reto no
  // se anima, pero SIGUE siendo jugable: el reto se queda quieto y la
  // pulsación se resuelve igual contra el reloj. Degradar es preferible a no
  // ofrecerlo.
  if (typeof globalThis.requestAnimationFrame !== "function") return;

  let ultimaFase = null;
  let ultimoSimbolo = null;
  let ultimoSegundo = null;

  const paso = () => {
    if (estado.fase !== FASES.RETO || !estado.reto) return;

    if (estado.tipoReto === "secuencia") {
      const vista = vistaRetoSecuencia(estado.reto, estado.intentos, ahora());
      if (vista.fase !== ultimaFase || vista.simboloActivo !== ultimoSimbolo) {
        ultimaFase = vista.fase;
        ultimoSimbolo = vista.simboloActivo;
        repintar();
      }
      if (vista.lectura.expirado) {
        // Se cierra solo: nadie puede dejar una asistencia abierta ocupando el
        // presupuesto del puesto indefinidamente.
        cerrarReto(resolverIntentosSecuencia(estado.reto, estado.intentos, ahora()));
        return;
      }
    } else if (estado.tipoReto === "precision") {
      // La zona no se mueve: lo único que cambia es la cuenta atrás, así que
      // solo repinta cuando el segundo mostrado cambia de verdad.
      const vista = vistaRetoPrecision(estado.reto, ahora());
      if (vista.lectura.segundosRestantes !== ultimoSegundo) {
        ultimoSegundo = vista.lectura.segundosRestantes;
        repintar();
      }
      if (vista.lectura.expirado) {
        cerrarReto(resolverExpiracionPrecision());
        return;
      }
    } else if (estado.tipoReto === "puzzle") {
      // El panel solo cambia por gesto (alternar/enviar), no por el paso del
      // tiempo: aquí solo hace falta vigilar la cuenta atrás y cerrar solo si
      // se agota sin acertar.
      const vista = vistaRetoPuzzle(estado.reto, estado.panel, estado.ultimoIntentoPuzzle, ahora());
      if (vista.lectura.segundosRestantes !== ultimoSegundo) {
        ultimoSegundo = vista.lectura.segundosRestantes;
        repintar();
      }
      if (vista.lectura.expirado) {
        cerrarReto(resolverExpiracionPuzzle(estado.reto));
        return;
      }
    } else {
      const vista = vistaReto(estado.reto, ahora());
      pintarBarra(vista);
      if (vista.lectura.expirado) {
        cerrarReto(resolverExpiracionTemporizacion());
        return;
      }
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
  nodo?.querySelector?.("[data-asistencia-crisis-abrir]")?.addEventListener("click", iniciarCrisisDesdeVentana);
  nodo?.querySelector?.("[data-asistencia-crisis-cerrar]")?.addEventListener("click", cerrarCrisisDesdeVentana);
  nodo?.querySelectorAll?.("[data-asistencia-mando]").forEach((boton) => {
    boton.addEventListener("click", () => ordenarDesdeVentana(boton.dataset.asistenciaMando));
  });
  nodo?.querySelectorAll?.("[data-asistencia-tarea]").forEach((boton) => {
    boton.addEventListener("click", () => pedirDesdeVentana(boton.dataset.asistenciaTarea));
  });
  nodo?.querySelectorAll?.("[data-asistencia-enfoque]").forEach((boton) => {
    boton.addEventListener("click", () => elegirEnfoqueDesdeVentana(boton.dataset.asistenciaEnfoque));
  });
  nodo?.querySelector?.("[data-asistencia-destreza]")?.addEventListener("click", empezarDestrezaDesdeVentana);
  nodo?.querySelector?.("[data-asistencia-pulsar]")?.addEventListener("click", alPulsar);
  nodo?.querySelectorAll?.("[data-asistencia-simbolo]").forEach((boton) => {
    boton.addEventListener("click", () => elegirSimboloDesdeVentana(boton.dataset.asistenciaSimbolo));
  });
  nodo?.querySelector?.("[data-asistencia-precision-pista]")?.addEventListener("click", (evento) => {
    // La posición del clic ES el dato: no hay coordenada que leer del reto
    // (no hay cursor), así que se traduce aquí, en la única capa que sabe lo
    // que es un `MouseEvent`, y se manda al motor como un número en [0, 1].
    const caja = evento.currentTarget.getBoundingClientRect();
    if (!caja.width) return;
    elegirPosicionDesdeVentana((evento.clientX - caja.left) / caja.width);
  });
  nodo?.querySelectorAll?.("[data-asistencia-celda]").forEach((boton) => {
    boton.addEventListener("click", () => alternarCeldaDesdeVentana(boton.dataset.asistenciaCelda));
  });
  nodo?.querySelector?.("[data-asistencia-enviar]")?.addEventListener("click", enviarPuzzleDesdeVentana);
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

  anadirHerramienta(controls, tool);
}

export function abrirAsistencia() {
  if (!moduloConfigurado) return;
  sincronizarEstadoMando();
  // Una ApplicationV2 cerrada NO se reutiliza (renderizarla otra vez falla en
  // v12+, ver el mismo criterio ya aplicado en main.mjs para la mesa de
  // minijuegos): `ventana ??= ...` bastaba mientras la ventana nunca se
  // cerrara, pero tras el primer cierre `ventana` seguía siendo la instancia
  // vieja y `.render()` no volvía a abrir nada. Se construye una nueva salvo
  // que la actual siga viva.
  if (!ventana?.rendered) ventana = new (claseVentana())();
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
  Object.assign(estado, {
    mando: Object.freeze({ crisisActiva: false, disponibles: 0, ventajaActiva: null }),
    mandoNonce: null,
    mandoError: null,
  });
  ventana = null;
}
