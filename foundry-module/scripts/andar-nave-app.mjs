/* Ventana del prototipo de "andar por la nave" (#427). Envuelve
 * `nave-movimiento-lienzo.mjs` (el bucle) sobre las dos salas de pruebas de
 * `nave-movimiento-sala-prueba.mjs` (no la cantina — ver el porqué en ese
 * archivo), conectadas por una puerta a través del catálogo de
 * `nave-estancias.mjs`, y traduce teclado en pulsar/soltar/girar.
 *
 * Capa fina, igual que el resto del módulo: no decide colisión, cámara ni a
 * qué estancia lleva una puerta — eso ya lo resolvió el catálogo. Aquí solo
 * se cablea DOM y se reacciona a `alTocarPuerta` llamando a
 * `mando.cambiarEstancia(...)` con lo que el catálogo ya decidió. Dos clases
 * hermanas (`Application` v11, `ApplicationV2` v12+), sin código de ventana
 * compartido a propósito.
 *
 * ES UN PROTOTIPO, Y SE DICE EN LA PROPIA VENTANA. Las salas de pruebas no
 * son ninguna sala real de la nave; sirven para verificar que andar,
 * colisionar y cruzar una puerta se sienten bien antes de decidir la costura
 * con salas reales.
 */

import { MODULE_ID } from "./lagunak-constantes.mjs";
import { arrancarAndar } from "./nave-movimiento-lienzo.mjs";
import { CATALOGO_PRUEBA } from "./nave-movimiento-sala-prueba.mjs";
import { puntoDeLlegada } from "./nave-estancias.mjs";

const ESTANCIA_INICIAL = "a";

const PLANTILLA = `modules/${MODULE_ID}/templates/andar-nave.hbs`;

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

  const onKeyDown = (ev) => {
    const direccion = TECLA_DIRECCION[ev.key];
    if (direccion) {
      ev.preventDefault();
      mando.pulsar(direccion);
      return;
    }
    const giro = TECLA_GIRO[ev.key];
    if (giro) {
      ev.preventDefault();
      girando.add(giro);
      actualizarGiro();
    }
  };
  const onKeyUp = (ev) => {
    const direccion = TECLA_DIRECCION[ev.key];
    if (direccion) {
      mando.soltar(direccion);
      return;
    }
    const giro = TECLA_GIRO[ev.key];
    if (giro) {
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
  const inicial = CATALOGO_PRUEBA.obtener(ESTANCIA_INICIAL);
  const mando = arrancarAndar(lienzo, {
    componer: inicial.componer,
    planta: inicial.planta,
    puertas: inicial.puertas,
    x: inicial.entrada.x,
    z: inicial.entrada.z,
    yaw: inicial.entrada.yaw,
    // La costura entre salas: el catálogo ya decidió a qué estancia lleva
    // cada puerta y con qué posición/orientación se llega. Esta ventana solo
    // aplica lo que `puntoDeLlegada` ya resolvió — no vuelve a decidir nada.
    alTocarPuerta: (destino) => {
      const llegada = puntoDeLlegada(CATALOGO_PRUEBA, destino);
      if (llegada) mando.cambiarEstancia(llegada);
    },
    pedirFotograma: (cb) => globalThis.requestAnimationFrame?.(cb),
    cancelarFotograma: (id) => globalThis.cancelAnimationFrame?.(id),
  });
  const desenganchar = engancharTeclado(raiz, mando);
  return {
    detener() {
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
