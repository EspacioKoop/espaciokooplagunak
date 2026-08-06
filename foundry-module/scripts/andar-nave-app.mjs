/* Ventana de "andar por la nave" (#427). Envuelve
 * `nave-movimiento-lienzo.mjs` (el bucle) sobre `nave-catalogo-andar.mjs`,
 * que cose la nave real que se puede recorrer hoy — cantina, vestíbulo,
 * ingeniería y el pasillo del puente con sus cinco salas de estación (#508)
 * — y traduce teclado en pulsar/soltar/girar.
 *
 * Capa fina, igual que el resto del módulo: no decide colisión, cámara ni a
 * qué estancia lleva una puerta — eso ya lo resolvió el catálogo. Aquí solo
 * se cablea DOM y se reacciona a `alTocarPuerta` llamando a
 * `mando.cambiarEstancia(...)` con lo que el catálogo ya decidió, y a
 * `alTocarConsola` abriendo el espacio de puesto que toque (#509) — de
 * nuevo, sin decidir nada que el catálogo o `openWorkspaceApp` no hayan
 * decidido ya. Dos clases hermanas (`Application` v11, `ApplicationV2`
 * v12+), sin código de ventana compartido a propósito.
 */

import { MODULE_ID } from "./lagunak-constantes.mjs";
import { arrancarAndar } from "./nave-movimiento-lienzo.mjs";
import { CATALOGO_ANDAR } from "./nave-catalogo-andar.mjs";
import { puntoDeLlegada } from "./nave-estancias.mjs";
import {
  construirMuestra,
  debeMuestrear,
  posicionesVisibles,
  programarMuestra,
} from "./nave-movimiento-red.mjs";
import { avatarDeUsuario } from "./avatar-assignment.mjs";
import { openWorkspaceApp } from "./station-workspace-ui.mjs";
import { SECCION } from "./paleta.mjs";

const ESTANCIA_INICIAL = "cantina";

/**
 * El lienzo no tiene fondo propio en CSS ni en la plantilla: sin uno, cada
 * hueco sin geometría —el marco de cualquier puerta, cualquier borde que no
 * llegue a cubrir el pintor— deja el `<canvas>` transparente y se ve el
 * fondo claro del propio diálogo de Foundry por debajo (QA: "un espacio
 * blanco absurdo").
 *
 * `SECCION.mamparo` y NO `SECCION.vacio`: lo que se ve por el hueco de una
 * puerta es más NAVE sin renderizar todavía (la sala vecina no se compone
 * hasta que se cruza), no el espacio exterior — `mamparo` ya es "el relleno
 * entre salas" en la sección 2D (#427) y es justo ese significado. El vacío
 * de verdad solo aparece donde de verdad hay vacío: por una VENTANA
 * (`nave-sala-caja.mjs`, que pinta su propio campo de estrellas encima de
 * este fondo).
 */
const FONDO_ENTRE_SALAS = SECCION.mamparo;

/**
 * Dónde se guarda la posición: flag del propio `User`, client-side, igual
 * que `station` (#237) — es "dónde estoy yo", no un dato de partida que
 * tenga que sobrevivir a que otro GM tome el relevo. Sirve dos propósitos a
 * la vez con la misma escritura: checkpoint para reabrir la ventana Y
 * muestra en vivo que el resto de la tripulación lee para verte moverse
 * (#453) — cualquier cliente puede LEER el `User` de cualquier otro, solo la
 * ESCRITURA está restringida al propio documento (ver cabecera de
 * `nave-movimiento-red.mjs`).
 */
const FLAG_POSICION = "posicionNave";

const PLANTILLA = `modules/${MODULE_ID}/templates/andar-nave.hbs`;

/** La posición guardada, o `null` si no hay ninguna o apunta a una estancia
 *  que ya no existe (p. ej. tras cambiar el catálogo entre sesiones). */
function leerPosicionGuardada() {
  try {
    const guardada = game.user?.getFlag?.(MODULE_ID, FLAG_POSICION);
    // `y` (salto/agachado) se ignora a propósito al RESTAURAR, aunque la
    // muestra en vivo lo incluya: es inercia de un fotograma, no una postura
    // que tenga sentido recuperar al reabrir la ventana — reaparecer a media
    // zancadilla en el aire sería más raro que simplemente reaparecer de pie.
    if (guardada && CATALOGO_ANDAR.tiene(guardada.estancia)) return guardada;
  } catch {
    // Sin ajuste registrado, o sin `game.user` resuelto todavía: se cae al
    // arranque de serie, que es la lectura segura.
  }
  return null;
}

/**
 * Publica la posición actual como muestra en vivo, respetando el throttle
 * de `debeMuestrear` — salvo que `forzar` sea cierto (cruzar una puerta es
 * un evento discreto real, se publica siempre). Devuelve el sello de la
 * última publicación, para que el llamador seleccione el siguiente throttle.
 * Sin esperar la promesa de `setFlag`: es una comodidad de sesión, no una
 * escritura de la que dependa nada más — si falla, el siguiente intento (a
 * lo sumo 150ms después) lo intenta de nuevo.
 */
function publicarPosicion(estanciaId, mando, ultimoSelloEnviado, forzar = false) {
  const ahoraMs = Date.now();
  if (!debeMuestrear({ ahoraMs, ultimoSelloEnviado, cambioDeEstancia: forzar })) {
    return ultimoSelloEnviado;
  }
  const muestra = construirMuestra({ ...mando.posicion(), estancia: estanciaId }, ahoraMs);
  game.user?.setFlag?.(MODULE_ID, FLAG_POSICION, muestra);
  return muestra.sello;
}

/** Tecla física → dirección lógica. WASD y flechas de traslación hacen lo
 *  mismo: cada persona tiene su preferencia y ninguna de las dos es "la
 *  correcta". Girar va aparte, en Q/E, para no pisar ArrowLeft/ArrowRight que
 *  aquí se dejan libres por si alguien los espera para trasladarse también. */
const TECLA_DIRECCION = Object.freeze({
  w: "adelante",
  s: "atras",
  a: "izquierda",
  d: "derecha",
  ArrowUp: "adelante",
  ArrowDown: "atras",
  " ": "saltar",
  Control: "agachado",
  c: "agachado",
});

const TECLA_GIRO = Object.freeze({ q: -1, e: 1, ArrowLeft: -1, ArrowRight: 1 });

/**
 * Engancha teclado a un mando de `arrancarAndar`. Vive fuera de las dos
 * clases a propósito, igual que `encenderSala` en `cantina-app.mjs`: es
 * cableado de DOM, no comportamiento de ventana.
 */
function engancharTeclado(raiz, mando) {
  const lienzo = raiz?.querySelector?.(".lagunak-andar-lienzo");
  if (!lienzo) return () => {};

  const girando = new Set();
  const actualizarGiro = () => {
    let sentido = 0;
    for (const s of girando) sentido += s;
    mando.girar(Math.sign(sentido));
  };

  // `stopPropagation` y no solo `preventDefault` (QA: agacharse — tecla "c" o
  // Control — colgaba la ventana): sin ella, la tecla sigue subiendo por el
  // DOM hasta el gestor de atajos GLOBAL de Foundry (o de cualquier módulo
  // que escuche en `document`), que puede reaccionar a la misma tecla
  // esperando un contexto —token seleccionado, escena activa— que este
  // lienzo no tiene. `preventDefault` solo evita la acción por defecto del
  // NAVEGADOR (p. ej. que Ctrl abra un menú); no aísla el evento de otros
  // listeners de la propia página, que es justo lo que este lienzo necesita:
  // sus teclas son suyas mientras tiene el foco, y de nadie más.
  const onKeyDown = (ev) => {
    const direccion = TECLA_DIRECCION[ev.key];
    if (direccion) {
      ev.preventDefault();
      ev.stopPropagation();
      mando.pulsar(direccion);
      return;
    }
    const giro = TECLA_GIRO[ev.key];
    if (giro) {
      ev.preventDefault();
      ev.stopPropagation();
      girando.add(giro);
      actualizarGiro();
    }
  };
  const onKeyUp = (ev) => {
    const direccion = TECLA_DIRECCION[ev.key];
    if (direccion) {
      ev.stopPropagation();
      mando.soltar(direccion);
      return;
    }
    const giro = TECLA_GIRO[ev.key];
    if (giro) {
      ev.stopPropagation();
      girando.delete(giro);
      actualizarGiro();
    }
  };
  // Al perder el foco (Tab fuera, o el usuario cambia de ventana) se sueltan
  // todas las teclas: sin esto, un Alt+Tab con "adelante" pulsado deja al
  // personaje andando solo contra una pared para siempre.
  const onBlur = () => {
    for (const direccion of new Set(Object.values(TECLA_DIRECCION))) mando.soltar(direccion);
    girando.clear();
    mando.girar(0);
  };

  lienzo.tabIndex = 0;
  lienzo.addEventListener("keydown", onKeyDown);
  lienzo.addEventListener("keyup", onKeyUp);
  lienzo.addEventListener("blur", onBlur);
  lienzo.focus();

  return () => {
    lienzo.removeEventListener("keydown", onKeyDown);
    lienzo.removeEventListener("keyup", onKeyUp);
    lienzo.removeEventListener("blur", onBlur);
  };
}

function arrancar(raiz) {
  const lienzo = raiz?.querySelector?.(".lagunak-andar-lienzo");
  if (!lienzo) return null;

  const guardada = leerPosicionGuardada();
  const inicial = CATALOGO_ANDAR.obtener(guardada?.estancia ?? ESTANCIA_INICIAL);
  // Vive fuera del mando a propósito: `arrancarAndar` sabe de planta/render/
  // posición, pero nunca supo que existen "estancias" con nombre — ese
  // conocimiento es de este archivo y del catálogo, no del bucle.
  let estanciaActual = guardada?.estancia ?? ESTANCIA_INICIAL;
  let ultimoSelloEnviado = null;

  // Muestras en vivo de los demás jugadores (#453), acumuladas por
  // `updateUser`.
  const otrosJugadores = new Map();

  /** Jugadores visibles ahora mismo en la MISMA sala, ya interpolados y con
   *  el avatar que cada cual eligió (#450, mismo molde que la cantina) — la
   *  forma exacta que consume `poligonosOtrosJugadores`
   *  (`nave-avatares-render.mjs`, #498). */
  function jugadoresParaRender() {
    return posicionesVisibles(otrosJugadores, {
      estanciaPropia: estanciaActual,
      miUserId: game.user?.id,
      ahoraMs: Date.now(),
    }).map((jugador) => ({
      ...jugador,
      avatar: avatarDeUsuario(game.users?.get?.(jugador.userId), MODULE_ID),
    }));
  }

  const mando = arrancarAndar(lienzo, {
    componer: inicial.componer,
    planta: inicial.planta,
    puertas: inicial.puertas,
    consolas: inicial.consolas,
    x: guardada?.x ?? inicial.entrada.x,
    z: guardada?.z ?? inicial.entrada.z,
    yaw: guardada?.yaw ?? inicial.entrada.yaw,
    // La costura entre salas: el catálogo ya decidió a qué estancia lleva
    // cada puerta y con qué posición/orientación se llega. Esta ventana solo
    // aplica lo que `puntoDeLlegada` ya resolvió — no vuelve a decidir nada.
    alTocarPuerta: (destino) => {
      const llegada = puntoDeLlegada(CATALOGO_ANDAR, destino);
      if (!llegada) return;
      estanciaActual = llegada.estancia;
      mando.cambiarEstancia(llegada);
      // Se publica AQUÍ y no solo al cerrar/cada 150ms: un refresco de página
      // no debería devolver a quien cruzó una puerta a la estancia de la que
      // salió, y el resto de la tripulación no debería esperar hasta 150ms
      // para saber que alguien cambió de sala.
      ultimoSelloEnviado = publicarPosicion(estanciaActual, mando, ultimoSelloEnviado, true);
    },
    // #509: acercarse a la consola de un puesto abre su espacio de trabajo —
    // el MISMO que ya se abre por botón (`openWorkspaceApp`, #276). Un
    // atajo, no autoridad nueva: para quien no es GM, `openWorkspaceApp`
    // ignora el `puesto` que se le pasa y abre el propio (#237, ver la
    // cabecera de `station-workspace-ui.mjs`) — caminar hasta una consola
    // ajena no enseña nada que el relé no dejara ver igualmente por botón.
    alTocarConsola: (puesto) => openWorkspaceApp(puesto),
    fondo: FONDO_ENTRE_SALAS,
    pedirFotograma: (cb) => globalThis.requestAnimationFrame?.(cb),
    cancelarFotograma: (id) => globalThis.cancelAnimationFrame?.(id),
    // Se evalúa en cada fotograma pintado (#498): el bucle nunca ve un Map,
    // solo la lista ya resuelta de ese instante.
    otrosJugadores: jugadoresParaRender,
  });
  const desenganchar = engancharTeclado(raiz, mando);

  // Publicación periódica mientras la ventana está abierta: `debeMuestrear`
  // hace el throttle real (~150ms), este intervalo solo ofrece la
  // oportunidad de comprobarlo con más frecuencia de la que hace falta
  // publicar, no al revés.
  const intervaloPublicacion = globalThis.setInterval?.(() => {
    ultimoSelloEnviado = publicarPosicion(estanciaActual, mando, ultimoSelloEnviado);
  }, 50);

  // Recepción: cualquier cliente puede leer el `User` de cualquier otro (solo
  // la escritura está restringida al propio documento), así que no hace
  // falta relé del GM — se escucha `updateUser` directamente, mismo patrón
  // de lectura que `station-order-relay.mjs` usa para la identidad del
  // emisor, aplicado aquí a la posición en vez de a una orden.
  const alCambiarUsuario = (userDoc, changes) => {
    if (userDoc?.id === game.user?.id) return; // la propia muestra no se recibe de vuelta
    if (!(FLAG_POSICION in (changes?.flags?.[MODULE_ID] ?? {}))) return; // cambio ajeno a la posición
    const muestra = userDoc?.getFlag?.(MODULE_ID, FLAG_POSICION);
    if (!muestra) return;
    const anterior = otrosJugadores.get(userDoc.id) ?? null;
    otrosJugadores.set(userDoc.id, programarMuestra(anterior, muestra, Date.now()));
  };
  Hooks.on("updateUser", alCambiarUsuario);

  return {
    /** Jugadores visibles ahora mismo en la MISMA sala, ya interpolados y
     *  con avatar — lo mismo que consume el pintor en cada fotograma,
     *  expuesto por si algo fuera de este archivo necesita leerlo. */
    jugadoresVisibles: jugadoresParaRender,
    detener() {
      publicarPosicion(estanciaActual, mando, ultimoSelloEnviado, true);
      globalThis.clearInterval?.(intervaloPublicacion);
      Hooks.off("updateUser", alCambiarUsuario);
      desenganchar();
      mando.detener();
    },
  };
}

function contexto() {
  return {};
}

/* ---- v12+ --------------------------------------------------------------- */

export function crearClaseAndarV2() {
  const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

  return class AndarNaveAppV2 extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "lagunak-andar-nave",
      classes: ["lagunak-andar-nave"],
      window: { title: "LAGUNAK.AndarNave.Titulo", icon: "fa-solid fa-person-walking" },
      position: { width: 520, height: "auto" },
    };

    static PARTS = { main: { template: PLANTILLA } };

    async _prepareContext(_options) {
      return contexto();
    }

    _onRender(context, options) {
      super._onRender?.(context, options);
      this.mando?.detener();
      this.mando = arrancar(this.element);
    }

    _onClose(options) {
      super._onClose?.(options);
      this.mando?.detener();
      this.mando = null;
    }
  };
}

/* ---- v11 ------------------------------------------------------------------ */

export function crearClaseAndarV1() {
  return class AndarNaveAppV1 extends Application {
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "lagunak-andar-nave",
        classes: ["lagunak-andar-nave"],
        title: game.i18n.localize("LAGUNAK.AndarNave.Titulo"),
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
      this.mando?.detener();
      this.mando = arrancar(html?.[0]);
    }

    async close(options) {
      this.mando?.detener();
      this.mando = null;
      return super.close(options);
    }
  };
}
